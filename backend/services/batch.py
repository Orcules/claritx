import os
import json
import time
import asyncio
import tempfile
import boto3
import uuid
import base64
import psycopg2
from sqlalchemy import text
from typing import List, Dict, Any
from datetime import datetime
from google import genai
from google.genai import types
from google.cloud import storage
from .fmp import fetch_fmp_data
from .yahoo import fetch_yahoo_data
from .vertex import generate_analysis_prompt, analyze_with_vertex
from .grok import analyze_grok
from .kie import run_kie_batch

async def run_batch_job_flow(
    limit: int = 1500,
    asset_type: str = 'stock',
    conn=None, auto_process: bool = True,
    provider: str = os.getenv("BATCH_PROVIDER", "google_batch"),
    session_source: str = "unknown") -> Dict[str, Any]:
    """
    Orchestrates the entire batch job flow:
    1. Load candidates from screener_cache (refreshes if not updated today)
    2. Filter by asset_type and isActivelyTrading
    3. Process Candidates (Google Batch vs Kie Direct)
    """
    from database import engine
    print(f"Starting Batch Job Flow... Type: {asset_type}, Limit: {limit}, Provider: {provider}, Source: {session_source}, Auto-Process: {auto_process}")

    # 1. Ensure screener_cache is populated today (short-lived connection)
    top_candidates = []
    try:
        async with engine.connect() as _conn:
            freshness = await _conn.execute(text(
                "SELECT COUNT(*) FROM screener_cache WHERE updated_at::date = CURRENT_DATE"
            ))
            today_count = freshness.scalar() or 0

            if today_count == 0:
                print("Screener cache not updated today — refreshing from FMP...")
                from screener_cacher import fetch_and_cache_screener
                await fetch_and_cache_screener()
                freshness = await _conn.execute(text(
                    "SELECT COUNT(*) FROM screener_cache WHERE updated_at::date = CURRENT_DATE"
                ))
                today_count = freshness.scalar() or 0

            print(f"Screener cache has {today_count} symbols updated today")

            filter_sql = """
                SELECT symbol,
                       data->>'companyName' as name,
                       data->>'sector' as sector,
                       data->>'marketCap' as marketCap
                FROM screener_cache
                WHERE COALESCE((data->>'isActivelyTrading')::boolean, false) = true
                ORDER BY COALESCE((data->>'marketCap')::numeric, 0) DESC
            """
            result = await _conn.execute(text(filter_sql), {"limit": limit})
            rows = result.fetchall()

            for row in rows:
                top_candidates.append({
                    "symbol": row[0],
                    "name": row[1] or "",
                    "key_info": f"{row[2] or ''} | MCap: {row[3] or 'N/A'}"
                })

            print(f"Selected {len(top_candidates)} {asset_type} candidates from screener_cache")

    except Exception as db_e:
        print(f"Screener cache query failed, falling back to FMP API: {db_e}")
        import traceback
        traceback.print_exc()
    
    if not top_candidates:
        return {"status": "error", "message": f"No {asset_type} candidates found in screener_cache. Ensure the daily screener cacher has run."}
        
    print(f"Final candidate count: {len(top_candidates)} top {asset_type} candidates.")

    # 3. Process Candidates
    if provider == 'kie_direct':
        queue_url = os.environ.get("BATCH_QUEUE_URL") or os.environ.get("SQS_QUEUE_URL")
        if queue_url:
            print(f"Routing {len(top_candidates)} candidates to Kie Direct via distributed SQS messages...")
            import boto3
            sqs = boto3.client('sqs', region_name='us-east-1')
            queued_count = 0
            for candidate in top_candidates:
                try:
                    # Normalize candidate keys (screener uses "s"/"n", code expects "symbol")
                    normalized = {**candidate, "symbol": candidate.get("symbol") or candidate.get("s", "")}
                    sqs.send_message(
                        QueueUrl=queue_url,
                        MessageBody=json.dumps({
                            "action": "PROCESS_SINGLE_KIE_TICKER",
                            "candidate": normalized,
                            "asset_type": asset_type
                        })
                    )
                    queued_count += 1
                except Exception as e:
                    print(f"Failed to queue single ticker for {candidate.get('symbol')}: {e}")
            
            # Log the distribution
          
                  
            return {
                "status": "success", 
                "message": f"Successfully queued {queued_count} individual tickers for independent processing.",
                "universe_size": len(top_candidates),
                "selected_count": len(top_candidates)
            }
    
    elif provider == 'google_batch':
        queue_url = os.environ.get("BATCH_QUEUE_URL") or os.environ.get("SQS_QUEUE_URL")
        if queue_url:
            print(f"Routing {len(top_candidates)} candidates to Google Batch SQS Staging...")
            import boto3
            import uuid
            
            # 1. Create a Master Batch Job Record to track the staging
            batch_id = f"batch_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{str(uuid.uuid4())[:8]}"
            
            try:
                async with engine.connect() as _conn:
                    await _conn.execute(text("""
                        INSERT INTO batch_jobs (id, status, created_at, item_count, target_count, asset_type, gcs_output_uri)
                        VALUES (:id, 'staging', NOW(), 0, :target_count, :asset_type, NULL)
                    """), {
                        "id": batch_id,
                        "target_count": len(top_candidates),
                        "asset_type": asset_type
                    })
                    await _conn.commit()
            except Exception as e:
                print(f"Failed to create master batch record: {e}")
                    
            # 2. Distribute SQS Messages
            sqs = boto3.client('sqs', region_name='us-east-1')
            queued_count = 0
            for candidate in top_candidates:
                try:
                    # Normalize candidate keys (screener uses "s"/"n", code expects "symbol")
                    normalized = {**candidate, "symbol": candidate.get("symbol") or candidate.get("s", "")}
                    sqs.send_message(
                        QueueUrl=queue_url,
                        MessageBody=json.dumps({
                            "action": "GATHER_GOOGLE_BATCH_DATA",
                            "candidate": normalized,
                            "batch_id": batch_id,
                            "target_limit": len(top_candidates)
                        })
                    )
                    queued_count += 1
                except Exception as e:
                    print(f"Failed to queue staging ticker for {candidate.get('symbol')}: {e}")
                    
            batch_result = {
                "batch_id": batch_id, 
                "status": "staging", 
                "message": f"Successfully queued {queued_count} tickers for Google Batch Staging.", 
                "queued_count": queued_count
            }
        else:
            return {"status": "error", "message": "No SQS_QUEUE_URL configured. Google Batch requires SQS for distributed staging."}
    if "error" in batch_result:
        return {"status": "error", "message": batch_result["error"]}
        
    batch_id = batch_result.get("batch_id")
    
    # Force auto_process to False for google_batch to prevent Lambda timeouts and SQS retries
    # Google Batch jobs take 15-45mins, which exceeds Lambda's 15m limit, causing SQS to retry 4 times!
    if provider == 'google_batch':
        print("Notice: Auto-polling is disabled for Google Batch to prevent execution timeout. Job will submit and exit cleanly for manual checking.")
        auto_process = False

    if not auto_process:
        print(f"Batch {batch_id} submitted. Auto-processing disabled. Returning immediately.")
        return {
            "status": "success",
            "universe_size": len(top_candidates),
            "selected_count": len(top_candidates),
            "batch_job": batch_result,
            "message": "Batch submitted. Auto-processing disabled."
        }

    print(f"Batch {batch_id} submitted. Starting polling loop...")
    
    # 4. Auto-Poll for Completion
    # Poll every 30 seconds for up to 30 minutes
    max_retries = 60 
    import asyncio
    
    for i in range(max_retries):
        try:
            print(f"Polling Batch {batch_id} (Attempt {i+1}/{max_retries})...")
            # Wait before checking (give it time to start)
            await asyncio.sleep(30)
            
            poll_result = await check_and_process_batch_results(batch_id)
            
            status = poll_result.get("status")
            if status == "processed":
                print(f"Batch {batch_id} complete and processed!")
                return {
                    "status": "success",
                    "universe_size": len(universe),
                    "selected_count": len(top_candidates),
                    "batch_job": batch_result,
                    "processing_result": poll_result
                }
            elif status == "JOB_STATE_FAILED":
                print(f"Batch {batch_id} failed.")
                return {"status": "error", "message": f"Batch Job Failed: {poll_result.get('message')}"}
            else:
                 print(f"Batch Status: {status}. Waiting...")
                 
        except Exception as e:
            print(f"Polling error: {e}")
            
    return {
        "status": "timeout",
        "message": "Batch job timed out or is still running in background.",
        "batch_id": batch_id
    }

def setup_gcp_credentials():
    """Sets up GOOGLE_APPLICATION_CREDENTIALS for Vertex/GCS auth, checking env vars first, then bundled files."""
    creds_json = os.environ.get("GOOGLE_CREDENTIALS_JSON")
    cred_path = "/tmp/gcp_creds.json"
    
    if creds_json:
        creds_json = creds_json.strip().strip("'").strip('"')
        if not creds_json.startswith("{"):
            try:
                import base64
                missing_padding = len(creds_json) % 4
                if missing_padding:
                    creds_json += '=' * (4 - missing_padding)
                decoded_creds = base64.b64decode(creds_json).decode('utf-8')
            except Exception as e:
                print(f"Failed to base64 decode credentials: {e}")
                decoded_creds = creds_json
        else:
            decoded_creds = creds_json
            
        with open(cred_path, 'w') as f:
            f.write(decoded_creds)
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = cred_path
        return cred_path
    else:
        # Check for bundled credentials file
        possible_paths = [
            os.path.join(os.getcwd(), "gcp_creds.json"),
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "gcp_creds.json"),
            "/var/task/gcp_creds.json"
        ]
        for p in possible_paths:
            if os.path.exists(p):
                os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = p
                print(f"[Batch] Using GCP credentials from file: {p}")
                return p
                
    return None

def _get_storage_client():
    """
    Returns a google.cloud.storage.Client, handling auth.
    Tries ADC first, then looks for bundled creds file.
    """
    setup_gcp_credentials()
    try:
        return storage.Client()
    except Exception as e:
        print(f"Failed to initialize storage client: {e}")
        raise Exception("Google Cloud Storage client initialization failed (Check credentials).")

async def check_and_process_batch_results(batch_id: str) -> Dict[str, Any]:
    """
    Checks the status of a batch job. If complete, downloads results and queues them for saving.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"error": "Missing GEMINI_API_KEY"}
    
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    
    setup_gcp_credentials()
    
    client = genai.Client(vertexai=True,
        project=project_id, # Required for Vertex AI
        location='global')

    try:
        # 1. Get current status from DB
        current_status = 'unknown'
        conn_url = os.environ.get("DATABASE_URL")
        if conn_url:
            try:
                with psycopg2.connect(conn_url) as db_conn:
                    with db_conn.cursor() as cur:
                        cur.execute("SELECT status FROM batch_jobs WHERE id = %s", (batch_id,))
                        row = cur.fetchone()
                        if row: current_status = row[0]
            except Exception as e:
                print(f"Warning: could not fetch current batch status from DB: {e}")

        job = client.batches.get(name=batch_id)
        print(f"Batch Job {batch_id} Status from Vertex: {job.state.name} (DB status: {current_status})")
        
        # 2. Determine Output URI (Robustly)
        output_uri = None
        try:
            if hasattr(job, 'dest') and hasattr(job.dest, 'gcs_uri'):
                output_uri = job.dest.gcs_uri
            elif hasattr(job, 'output_uri') and job.output_uri:
                output_uri = job.output_uri
            elif hasattr(job, 'gcs_output_directory') and job.gcs_output_directory:
                output_uri = job.gcs_output_directory
        except:
            pass
            
        # 3. Update Status in DB
        try:
            from database import get_db_connection
            # We need a new connection here since this might be running in a different context
            conn_url = os.environ.get("DATABASE_URL")
            
            error_msg = ""
            if job.state.name == "JOB_STATE_FAILED":
                 if hasattr(job, 'error') and job.error:
                     error_msg = f". Error: {job.error.message}"
                 print(f"Batch Job Failed Details: {job}")

            if conn_url:
                with psycopg2.connect(conn_url) as conn:
                    with conn.cursor() as cur:
                        # Build dynamic update query
                        update_fields = ["status = %s"]
                        params = [job.state.name]
                        
                        if output_uri:
                            update_fields.append("gcs_output_uri = %s")
                            params.append(output_uri)
                            
                        if job.state.name in ["COMPLETED", "JOB_STATE_SUCCEEDED"]:
                            update_fields.append("completed_at = NOW()")
                            
                        query = f"UPDATE batch_jobs SET {', '.join(update_fields)} WHERE id = %s"
                        params.append(batch_id)
                        
                        cur.execute(query, tuple(params))
                    conn.commit()
                    print(f"Updated batch job {batch_id} status to {job.state.name}")
        except Exception as db_e:
            print(f"Failed to update batch job status in DB: {db_e}")
            error_msg = ""
        
        # If failed, return
        if job.state.name == "JOB_STATE_FAILED":
             return {
                "status": job.state.name,
                "message": f"Job is {job.state.name}{error_msg}. Results not yet available."
            }

        # Return if still running
        if job.state.name not in ["COMPLETED", "JOB_STATE_SUCCEEDED"]:
             return {
                "status": job.state.name,
                "message": f"Job is {job.state.name}. Results not yet available."
            }
            
        # If we already processed this job, don't do it again
        if current_status == 'processed':
             return {
                "status": "processed",
                "message": "Job already processed successfully."
            }
        
        if not output_uri:
             return {"error": "Job succeeded but output URI could not be determined."}

        # 4. Download and Process Results from GCS
        print(f"Job Complete. Output Location: {output_uri}")
        
        if not output_uri.startswith("gs://"):
             return {"error": f"Unexpected output URI format: {output_uri}"}
             
        # Parse bucket and prefix
        uri_parts = output_uri.replace("gs://", "").split("/", 1)
        bucket_name = uri_parts[0]
        prefix = uri_parts[1]
        
        # Use Helper for Auth
        storage_client = _get_storage_client()
        bucket = storage_client.bucket(bucket_name)
        
        print(f"Listing blobs in gs://{bucket_name}/{prefix}...")
        blobs = list(bucket.list_blobs(prefix=prefix))
        
        # Filter for JSONL files
        jsonl_blobs = [b for b in blobs if b.name.endswith(".jsonl") and "prediction" in b.name]
        if not jsonl_blobs:
            jsonl_blobs = [b for b in blobs if b.name.endswith(".jsonl")]
            
        print(f"Found {len(jsonl_blobs)} result files.")
        
        result_count = 0
        queue_url = os.environ.get("SQS_QUEUE_URL")
        sqs = boto3.client('sqs', region_name='us-east-1')
        
        if conn_url:
            with psycopg2.connect(conn_url) as persistent_conn:
                with persistent_conn.cursor() as cur:
                    screener_lookup = {} # TODO: fetch if needed, currently using empty to prevent crash
                    for blob in jsonl_blobs:
                        print(f"Streaming and processing results from {blob.name}...")
                        
                        line_count = 0
                        # STREAM the file line by line to avoid Out-Of-Memory (OOM) 
                        with blob.open("r") as f:
                            for line in f:
                                if not line.strip(): continue
                                try:
                                    line_count += 1
                                    if line_count % 50 == 0:
                                        print(f"Progress: Read {line_count} lines from GCS...")
                                    
                                    result = json.loads(line)
                                    custom_id = result.get('custom_id', '')
                                    
                                    if not custom_id.startswith('analysis-'):
                                        continue
                                        
                                    parts = custom_id.replace('analysis-', '').split('-')
                                    symbol = parts[0]
                                
                                    # Extract Response content
                                    try:
                                        response_candidate = result.get('response', {}).get('candidates', [{}])[0]
                                        content_parts = response_candidate.get('content', {}).get('parts', [{}])
                                        text_content = content_parts[0].get('text', '')
                                        
                                        if not text_content:
                                            continue
    
                                        if "```json" in text_content:
                                            text_content = text_content.replace("```json", "").replace("```", "")
                                        
                                        text_content = text_content.strip()
                                        
                                        try:
                                            ai_data = json.loads(text_content)
                                        except json.JSONDecodeError as jde:
                                            # Handle common AI malformation: extra trailing content after valid JSON
                                            if "Extra data" in str(jde):
                                                # Use raw_decode to extract just the first valid JSON object
                                                decoder = json.JSONDecoder()
                                                ai_data, _ = decoder.raw_decode(text_content.lstrip())
                                                print(f"Fixed extra trailing data issue for {symbol} (char {jde.pos})")
                                            else:
                                                raise
                                    except Exception as parse_e:
                                        print(f"Failed to parse analysis content for {symbol}: {parse_e}")
                                        continue
                                
                                    # 5. Extract Original FMP/Yahoo Data from the JSONL Request payload
                                    try:
                                        import ast
                                        stock_meta = {}
                                        yahoo_data = {}
                                        profile = {}
                                        quote = {}
                                        fmp_ratios_ttm = {}
                                        fmp_ratings_snapshot = {}
                                        etf_info = {}
                                        etf_holdings = []
                                        etf_sector_weightings = []
                                        etf_country_weightings = []
                                        
                                        request_obj = result.get('request', {})
                                        if request_obj:
                                            prompt_text = request_obj.get("contents", [{}])[0].get("parts", [{}])[0].get("text", "")
                                            if "DATA CONTEXT START:" in prompt_text:
                                                context_block = prompt_text.split("DATA CONTEXT START:")[1].split("DATA CONTEXT END.")[0].strip()
                                                if "SOCIAL SENTIMENT CONTEXT:" in context_block:
                                                    context_block = context_block.split("SOCIAL SENTIMENT CONTEXT:")[0].strip()
                                                
                                                # Sometimes LLM adds markdown formatting to the prompt echo
                                                if context_block.startswith("```json"):
                                                    context_block = context_block.split("```json")[1].split("```")[0].strip()
                                                elif context_block.startswith("```"):
                                                    context_block = context_block.split("```")[1].split("```")[0].strip()
                                                    
                                                try:
                                                    fin_data = ast.literal_eval(context_block)
                                                    stock_meta = fin_data.get("stock_data", {})
                                                    
                                                    # NEW FORMAT: Try to get full profile & quote arrays
                                                    fmp_profile_str = fin_data.get("fmp_profile", "")
                                                    if fmp_profile_str:
                                                        parsed_profile = json.loads(fmp_profile_str)
                                                        if parsed_profile and isinstance(parsed_profile, list) and len(parsed_profile) > 0:
                                                            profile = parsed_profile[0]
                                                    
                                                    fmp_quote_str = fin_data.get("fmp_quote", "")
                                                    if fmp_quote_str:
                                                        parsed_quote = json.loads(fmp_quote_str)
                                                        if parsed_quote and isinstance(parsed_quote, list) and len(parsed_quote) > 0:
                                                            quote = parsed_quote[0]
                                                    
                                                    yahoo_text = fin_data.get("technicals", "")
                                                    if yahoo_text and "Technical Indicators (Yahoo): " in yahoo_text:
                                                        y_str = yahoo_text.replace("Technical Indicators (Yahoo): ", "").strip()
                                                        if y_str != "None":
                                                            yahoo_data = json.loads(y_str)
                                                            
                                                    ratios_text = fin_data.get("financials", "")
                                                    if ratios_text and "Ratios (TTM): " in ratios_text:
                                                        r_str = ratios_text.replace("Ratios (TTM): ", "").strip()
                                                        if r_str != "None":
                                                            parsed = json.loads(r_str)
                                                            if parsed and isinstance(parsed, list):
                                                                fmp_ratios_ttm = parsed[0]
                                                                
                                                    ratings_text = fin_data.get("ratings_data", "")
                                                    if ratings_text and "Analyst Ratings: " in ratings_text:
                                                        r_str = ratings_text.replace("Analyst Ratings: ", "").strip()
                                                        if r_str != "None":
                                                            parsed = json.loads(r_str)
                                                            if parsed and isinstance(parsed, list):
                                                                fmp_ratings_snapshot = parsed[0]
                                                            
                                                    # Parse ETF fields
                                                    etf_info_text = fin_data.get("etf_info") or ""
                                                    if etf_info_text and isinstance(etf_info_text, str) and "ETF Info: " in etf_info_text:
                                                        try:
                                                            parsed = json.loads(etf_info_text.replace("ETF Info: ", "", 1).strip())
                                                            if parsed and isinstance(parsed, list) and len(parsed) > 0:
                                                                etf_info = parsed[0] if isinstance(parsed[0], dict) else parsed
                                                        except: pass
                                                                
                                                    etf_holdings_text = fin_data.get("etf_holdings") or ""
                                                    if etf_holdings_text and isinstance(etf_holdings_text, str) and "ETF Holdings: " in etf_holdings_text:
                                                        try:
                                                            etf_holdings = json.loads(etf_holdings_text.replace("ETF Holdings: ", "", 1).strip())
                                                        except: pass
                                                    
                                                    etf_sectors_text = fin_data.get("etf_sector_weightings") or ""
                                                    if etf_sectors_text and isinstance(etf_sectors_text, str) and "ETF Sector Weightings: " in etf_sectors_text:
                                                        try:
                                                            etf_sector_weightings = json.loads(etf_sectors_text.replace("ETF Sector Weightings: ", "", 1).strip())
                                                        except: pass
                                                    
                                                    etf_country_text = fin_data.get("etf_country_weightings") or ""
                                                    if etf_country_text and isinstance(etf_country_text, str) and "ETF Country Weightings: " in etf_country_text:
                                                        try:
                                                            etf_country_weightings = json.loads(etf_country_text.replace("ETF Country Weightings: ", "", 1).strip())
                                                        except: pass
                                                
                                                except Exception as parse_fin_e:
                                                    print(f"Could not literal_eval embedded financial context for {symbol}: {parse_fin_e}")
                                    
                                        def safe_float(value, default=0.0):
                                            try:
                                                return float(value) if value is not None else default
                                            except:
                                                return default
                                        
                                        full_result = {
                                            "stock": {
                                                "symbol": symbol,
                                                "name": profile.get("companyName") or stock_meta.get("companyName", "Unknown"),
                                                "price": safe_float(quote.get("price") or stock_meta.get("price")),
                                                "change": safe_float(quote.get("change")),
                                                "changePercent": safe_float(quote.get("changesPercentage")),
                                                "previousClose": safe_float(quote.get("previousClose", quote.get("price") or stock_meta.get("price", 0.0))),
                                                "dayHigh": safe_float(quote.get("dayHigh", quote.get("price") or stock_meta.get("price", 0.0))),
                                                "dayLow": safe_float(quote.get("dayLow", quote.get("price") or stock_meta.get("price", 0.0))),
                                                "volume": safe_float(quote.get("volume") or yahoo_data.get("volume", 0.0)),
                                                "marketCap": safe_float(quote.get("marketCap") or stock_meta.get("marketCap")),
                                                "fiftyTwoWeekHigh": safe_float(yahoo_data.get("high_52w", quote.get("price") or stock_meta.get("price", 0.0))),
                                                "fiftyTwoWeekLow": safe_float(yahoo_data.get("low_52w", quote.get("price") or stock_meta.get("price", 0.0))),
                                                "exchange": profile.get("exchangeShortName") or stock_meta.get("exchange", "Unknown"),
                                                "sector": profile.get("sector") or (stock_meta.get("industry", "Unknown").split("-")[0].strip() if stock_meta.get("industry") else "Unknown"),
                                                "industry": profile.get("industry") or stock_meta.get("industry", "Unknown"),
                                                "website": profile.get("website", ""),
                                                "description": profile.get("description", ""),
                                                "ceo": profile.get("ceo", ""),
                                                "isETF": profile.get("isEtf", False) or bool(etf_info or etf_holdings),
                                                "beta": safe_float(screener_lookup.get(symbol, {}).get("beta") or profile.get("beta")),
                                                "technicals": {
                                                    "sma20": str(safe_float(yahoo_data.get("sma_20"))),
                                                    "sma50": str(safe_float(yahoo_data.get("sma_50"))),
                                                    "sma200": str(safe_float(yahoo_data.get("sma_200"))),
                                                    "rsi": str(safe_float(yahoo_data.get("rsi"))),
                                                    "trend": "bullish" if safe_float(quote.get("price") or stock_meta.get("price")) > safe_float(yahoo_data.get("sma_200")) else "bearish"
                                                }
                                            },
                                            "analysis": {
                                                "headlines": ai_data.get("headlines", ""),
                                                "technicals": ai_data.get("technicals", ""),
                                                "social_media_hype": ai_data.get("social_media_hype", ""),
                                                "financial_indicators": ai_data.get("financial_indicators", ""),
                                                "analyst_consensus": ai_data.get("analyst_consensus", ""),
                                                "relative_to_market": ai_data.get("relative_to_market", ""),
                                                "insider_activity": ai_data.get("insider_activity", ""),
                                                "dividend_health": ai_data.get("dividend_health", ""),
                                                "final_verdict": ai_data.get("final_verdict", ""),
                                                "comparative_analysis": ai_data.get("comparative_analysis", ""),
                                                "ai_score": ai_data.get("ai_score", "NA"),
                                                "methodology": ai_data.get("methodology", ""),
                                                "sources_used": ai_data.get("sources_used", ""),
                                                "technicals_yahoo": yahoo_data,
                                                "financial_ratios": fmp_ratios_ttm,
                                                "analyst_ratings": fmp_ratings_snapshot,
                                                "etf_info": etf_info,
                                                "etf_holdings": etf_holdings,
                                                "etf_sector_weightings": etf_sector_weightings,
                                                "etf_country_weightings": etf_country_weightings
                                            },
                                            "analyzed_at": datetime.utcnow().isoformat()
                                        }
    
                                        # Save to DB
                                        # No longer deleting old records to keep history
                                        cur.execute("""
                                            INSERT INTO stock_analyses (id, symbol, user_id, status, analysis_data, created_at, updated_at, completed_at)
                                            VALUES (%s, %s, NULL, 'complete', %s, NOW(), NOW(), NOW())
                                        """, (str(uuid.uuid4()), symbol, json.dumps(full_result)))
                                        persistent_conn.commit()
                                        print(f"Saved full analysis for {symbol} to stock_analyses.")
                                        result_count += 1
                                            
                                    except Exception as save_e:
                                        print(f"Failed to reconstruct/save analysis for {symbol}: {save_e}")
                                
                                except Exception as line_e:
                                    print(f"Error processing line: {line_e}")
                                    continue
                
                    if result_count > 0:
                        with psycopg2.connect(conn_url) as conn:
                            with conn.cursor() as cur:
                                cur.execute("UPDATE batch_jobs SET status = 'processed', completed_at = NOW() WHERE id = %s", (batch_id,))
                            conn.commit()
                    else:
                        return {"error": "No results found in Vertex output files."}
                
        return {
            "status": "processed",
            "batch_id": batch_id,
            "count": result_count,
            "message": f"Successfully processed {result_count} results from batch at {output_uri}"
        }
        
    except Exception as e:
        print(f"Batch Processing Failed: {e}")
        return {"error": str(e)}

async def submit_google_batch_job_from_staged_prompts(batch_id: str, prompts: List[str]):
    """
    Called by the final worker. Uploads the staged jsonl prompts to GCS and submits the job.
    Uses short-lived connections for DB updates.
    """
    from database import engine
    import base64
    from google import genai
    import uuid
    import time
    from sqlalchemy import text

    # 1. Upload to GCS
    try:
        project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
        bucket_name = os.environ.get("GCS_BUCKET_NAME")

        if not bucket_name and project_id:
             bucket_name = f"{project_id}-batch-jobs"

        if not bucket_name:
            print("Missing GCS_BUCKET_NAME or GOOGLE_CLOUD_PROJECT to infer bucket.")
            return

        storage_client = _get_storage_client()

        try:
            bucket = storage_client.get_bucket(bucket_name)
        except:
            print(f"Bucket {bucket_name} not found. Creating...")
            bucket = storage_client.create_bucket(bucket_name, location="us-central1")

        blob_name = f"batch-jobs/{int(time.time())}-{uuid.uuid4()}.jsonl"
        blob = bucket.blob(blob_name)

        print(f"Uploading batch file to gs://{bucket_name}/{blob_name}")
        blob.upload_from_string('\n'.join(prompts), content_type='application/jsonl')
        gcs_uri = f"gs://{bucket_name}/{blob_name}"

        setup_gcp_credentials()

        client = genai.Client(vertexai=True,
            project=project_id,
            location='global')

        # 2. Submit Batch Job
        print(f"Submitting batch job {batch_id} to Vertex AI...")
        batch_job = client.batches.create(
            model='gemini-3.1-pro-preview',
            src=gcs_uri,
        )

        # 3. Update DB (short-lived connection)
        try:
            async with engine.connect() as _conn:
                await _conn.execute(text("""
                    UPDATE batch_jobs
                    SET id = :vertex_id, status = :status, gcs_input_uri = :gcs_uri
                    WHERE id = :temp_batch_id
                """), {
                    "vertex_id": batch_job.name,
                    "status": batch_job.state.name,
                    "gcs_uri": gcs_uri,
                    "temp_batch_id": batch_id
                })

                await _conn.execute(text("DELETE FROM batch_job_prompts WHERE batch_id = :batch_id"), {"batch_id": batch_id})
                await _conn.commit()
                print(f"Batch Job {batch_job.name} successfully submitted and staged data cleaned.")
        except Exception as e:
            print(f"Failed to update batch status in DB: {e}")

    except Exception as e:
        print(f"Failed to submit Vertex job for {batch_id}: {e}")
        
async def gather_single_google_batch_candidate(candidate: Dict[str, str], batch_id: str, target_limit: int, conn=None) -> Dict[str, Any]:
    """
    Fetches context for a single Google Batch candidate and stages it in Postgres.
    If it's the final candidate, it triggers the GCS upload and job submission.
    Uses short-lived connections to avoid holding connections across external API calls.
    """
    from database import engine
    symbol = candidate.get("symbol") or candidate.get("s")

    if not symbol: return {"error": "Missing symbol"}

    print(f"Gathering Google Batch Context for {symbol} (Batch {batch_id[:15]}...)")
    import uuid
    import time
    from sqlalchemy import text

    prompt_json = None

    try:
        fmp_task = fetch_fmp_data(symbol)
        yahoo_task = asyncio.to_thread(fetch_yahoo_data, symbol)
        grok_task = analyze_grok(symbol, conn=None)

        # 0. Fetch Previous Analysis for Comparison (short-lived connection)
        previous_analysis_data = None
        try:
            async with engine.connect() as _conn:
                prev_res = await _conn.execute(text("""
                    SELECT analysis_data
                    FROM stock_analyses
                    WHERE symbol = :symbol AND status = 'complete'
                    ORDER BY completed_at DESC
                    LIMIT 1
                """), {"symbol": symbol})
                prev_row = prev_res.fetchone()
                if prev_row:
                    previous_analysis_data = prev_row[0]
                    print(f"Found previous analysis for {symbol} for comparison in batch gathering.")
        except Exception as e:
            print(f"Failed to fetch previous analysis for {symbol} in batch gathering: {e}")
        
        results = await asyncio.gather(fmp_task, yahoo_task, grok_task, return_exceptions=True)
        
        fmp_data = results[0]
        yahoo_data = results[1]
        grok_data = results[2]
                
        if isinstance(fmp_data, Exception): fmp_data = None
        if isinstance(yahoo_data, Exception): yahoo_data = {}
        if isinstance(grok_data, Exception): grok_data = "" 
            
        if not fmp_data: 
            raise ValueError(f"FMP fetch failed for {symbol}")
        
        profile_list = fmp_data.get("profile") or [{}]
        profile = profile_list[0] if profile_list else {}
        
        quote_list = fmp_data.get("quote") or [{}]
        quote = quote_list[0] if quote_list else {}
        
        financial_data = {
            "stock_data": {
                "symbol": symbol,
                "companyName": profile.get("companyName"),
                "price": quote.get("price"),
                "marketCap": quote.get("marketCap"),
                "beta": profile.get("beta"),
                "exchange": profile.get("exchangeShortName"),
                "industry": profile.get("industry")
            },
            # Preserve full FMP profile & quote for reconstruction at parse time
            "fmp_profile": json.dumps(fmp_data.get('profile', []), default=str),
            "fmp_quote": json.dumps(fmp_data.get('quote', []), default=str),
            "financials": f"Ratios (TTM): {json.dumps(fmp_data.get('ratios_ttm', []), default=str)}",
            "detailed_financials": f"Key Metrics (TTM): {json.dumps(fmp_data.get('key_metrics_ttm', []), default=str)}",
            "news": f"Recent News: {json.dumps(fmp_data.get('news', []), default=str)}",
            "technicals": f"Technical Indicators (Yahoo): {json.dumps(yahoo_data, default=str)}",
            "insider_stats": f"Insider Trading (Last 6mo): {json.dumps(fmp_data.get('insider_stats', {}), default=str)}",
            "analyst_data": f"Analyst Estimates: {json.dumps(fmp_data.get('analyst_estimates', []), default=str)}",
            "ratings_data": f"Analyst Ratings: {json.dumps(fmp_data.get('ratings_snapshot', []), default=str)}",
            "price_targets": f"Price Targets: {json.dumps(fmp_data.get('price_target', []), default=str)}",
            "earnings_data": f"Earnings History: {json.dumps(fmp_data.get('earnings', []), default=str)}",
            "etf_info": f"ETF Info: {json.dumps(fmp_data.get('etf_info', []), default=str)}" if fmp_data.get("etf_info") else None,
            "etf_holdings": f"ETF Holdings: {json.dumps(fmp_data.get('etf_holdings', []), default=str)}" if fmp_data.get("etf_holdings") else None,
            "etf_sector_weightings": f"ETF Sector Weightings: {json.dumps(fmp_data.get('etf_sector_weightings', []), default=str)}" if fmp_data.get("etf_sector_weightings") else None,
            "etf_country_weightings": f"ETF Country Weightings: {json.dumps(fmp_data.get('etf_country_weightings', []), default=str)}" if fmp_data.get("etf_country_weightings") else None,
        }
            
        prompt_text = generate_analysis_prompt(symbol, financial_data, grok_data, is_batch=True, previous_analysis=previous_analysis_data)
        
        request_obj = {
            "request": {
                "model": "gemini-3.1-pro-preview", 
                "contents": [
                    {"role": "user", "parts": [{"text": prompt_text}]}
                ],
                "generationConfig": {
                    "responseMimeType": "application/json"
                }
            },
            "custom_id": f"analysis-{symbol}-{int(time.time())}"
        }
        
        prompt_json = json.dumps(request_obj)
        
    except Exception as e:
        print(f"Gathering data failed for {symbol}: {e}")
        # We MUST still insert a placeholder so the count reaches the target limit!
        # If we skip the insert, the master batch wait queue will hang forever.
        # We save a valid JSON string that our processing logic can gracefully skip or ignore later.
        # (Vertex AI Batch handles errors on single items gracefully).
        fallback_obj = {
            "request": {
                "model": "gemini-3.1-pro-preview",
                "contents": [{"role": "user", "parts": [{"text": f"Analyze {symbol}. Data fetch failed."}]}]
            },
            "custom_id": f"analysis-{symbol}-failed"
        }
        prompt_json = json.dumps(fallback_obj)

    # Save to staging table and check tally ALWAYS (short-lived connection)
    try:
        async with engine.connect() as _conn:
            # Save prompt (success or simulated fail)
            await _conn.execute(text("""
                INSERT INTO batch_job_prompts (id, batch_id, symbol, prompt_json, created_at)
                VALUES (:id, :batch_id, :sym, :prompt, NOW())
            """), {
                "id": str(uuid.uuid4()),
                "batch_id": batch_id,
                "sym": symbol,
                "prompt": prompt_json
            })

            # ATOMIC TALLY - Update item_count in batch_jobs and get current count
            res = await _conn.execute(text("""
                UPDATE batch_jobs
                SET item_count = item_count + 1
                WHERE id = :batch_id
                RETURNING item_count
            """), {"batch_id": batch_id})
            count_row = res.fetchone()
            count = count_row[0] if count_row else 0

            await _conn.commit()

        print(f"Batch {batch_id[:10]} Progress: {count}/{target_limit} collected.")

        if count >= target_limit:
            print(f"Batch {batch_id[:10]} complete! Submitting master Vertex job...")
            async with engine.connect() as _conn:
                res = await _conn.execute(text("SELECT prompt_json FROM batch_job_prompts WHERE batch_id = :batch_id"), {"batch_id": batch_id})
                all_prompts = [row[0] for row in res.fetchall()]

            await submit_google_batch_job_from_staged_prompts(batch_id, all_prompts)

        return {"status": "success", "symbol": symbol, "count": count}

    except Exception as e:
        print(f"CRITICAL: Failed to save Google Batch prompt for {symbol} to Postgres DB: {e}")
        return {"error": str(e)}

async def process_single_kie_candidate(candidate: Dict[str, str], conn=None, asset_type: str = 'stock') -> Dict[str, Any]:
    """
    Processes a SINGLE ticker via Kie.ai Direct API for the decoupled SQS architecture.
    Uses short-lived DB connections to avoid holding connections across AI calls.
    """
    from database import engine
    symbol = candidate.get("symbol") or candidate.get("s")
    search_data = candidate.get("key_info", "")

    if not symbol:
        return {"error": "Missing symbol in candidate"}

    print(f"Starting Single Kie.ai Processing for {symbol}...")

    # 1. Fetch FMP, Yahoo, and Grok in parallel
    from services.kie import analyze_with_kie
    from sqlalchemy import text
    import uuid

    fmp_task = fetch_fmp_data(symbol)
    yahoo_task = asyncio.to_thread(fetch_yahoo_data, symbol)
    grok_task = analyze_grok(symbol, conn=None)

    # 0. Fetch Previous Analysis for Comparison (short-lived connection)
    previous_analysis_data = None
    try:
        async with engine.connect() as _conn:
            prev_res = await _conn.execute(text("""
                SELECT analysis_data
                FROM stock_analyses
                WHERE symbol = :symbol AND status = 'complete'
                ORDER BY completed_at DESC
                LIMIT 1
            """), {"symbol": symbol})
            prev_row = prev_res.fetchone()
            if prev_row:
                previous_analysis_data = prev_row[0]
                print(f"Found previous analysis for {symbol} for comparison in single kie processing.")
    except Exception as e:
        print(f"Failed to fetch previous analysis for {symbol} in single kie processing: {e}")
            
    results = await asyncio.gather(fmp_task, yahoo_task, grok_task, return_exceptions=True)
    
    fmp_data = results[0]
    yahoo_data = results[1]
    grok_data = results[2]
            
    if isinstance(fmp_data, Exception):
        print(f"FMP fetch failed for {symbol}: {fmp_data}")
        fmp_data = None
    if isinstance(yahoo_data, Exception):
        yahoo_data = {}
    if isinstance(grok_data, Exception):
        grok_data = "" 
        
    if not fmp_data: 
        return {"error": f"Failed to fetch FMP data for {symbol}"}
        
    # Defensive coding
    profile_list = fmp_data.get("profile") or [{}]
    profile = profile_list[0] if profile_list else {}
    
    quote_list = fmp_data.get("quote") or [{}]
    quote = quote_list[0] if quote_list else {}
    
    financial_data = {
        "stock_data": {
            "symbol": symbol,
            "companyName": profile.get("companyName"),
            "price": quote.get("price"),
            "marketCap": quote.get("marketCap"),
            "beta": profile.get("beta"),
            "exchange": profile.get("exchangeShortName"),
            "industry": profile.get("industry")
        },
        # Preserve full FMP profile & quote for reconstruction at parse time
        "fmp_profile": json.dumps(fmp_data.get('profile', []), default=str),
        "fmp_quote": json.dumps(fmp_data.get('quote', []), default=str),
        "financials": f"Ratios (TTM): {json.dumps(fmp_data.get('ratios_ttm', []), default=str)}",
        "detailed_financials": f"Key Metrics (TTM): {json.dumps(fmp_data.get('key_metrics_ttm', []), default=str)}",
        "news": f"Recent News: {json.dumps(fmp_data.get('news', []), default=str)}",
        "technicals": f"Technical Indicators (Yahoo): {json.dumps(yahoo_data, default=str)}",
        "insider_stats": f"Insider Trading (Last 6mo): {json.dumps(fmp_data.get('insider_stats', {}), default=str)}",
        "analyst_data": f"Analyst Estimates: {json.dumps(fmp_data.get('analyst_estimates', []), default=str)}",
        "ratings_data": f"Analyst Ratings: {json.dumps(fmp_data.get('ratings_snapshot', []), default=str)}",
        "price_targets": f"Price Targets: {json.dumps(fmp_data.get('price_target', []), default=str)}",
        "earnings_data": f"Earnings History: {json.dumps(fmp_data.get('earnings', []), default=str)}",
        "etf_info": f"ETF Info: {json.dumps(fmp_data.get('etf_info', []), default=str)}" if fmp_data.get("etf_info") else None,
        "etf_holdings": f"ETF Holdings: {json.dumps(fmp_data.get('etf_holdings', []), default=str)}" if fmp_data.get("etf_holdings") else None,
    }
        
    prompt = generate_analysis_prompt(symbol, financial_data, grok_data, is_batch=False, previous_analysis=previous_analysis_data)
    
    # 2. Call Kie.ai
    ai_analysis_text = await analyze_with_vertex(symbol, prompt)
    
    try:
        if "```json" in ai_analysis_text:
            ai_analysis_text = ai_analysis_text.split("```json")[1].split("```")[0].strip()
        elif "```" in ai_analysis_text:
            ai_analysis_text = ai_analysis_text.split("```")[1].split("```")[0].strip()
        ai_data = json.loads(ai_analysis_text)
    except Exception as e:
        print(f"AI Parse Fail: {e}")
        ai_data = {
            "final_verdict": "Neutral (Parse Error)",
            "ai_score": 50, # Default Neutral
            "summary": "AI analysis generated invalid JSON."
        }
        
    # 4. Construct Final Result Object
    # Match frontend AnalysisResult interface { stock: {}, analysis: {} }
    
    # Fetch screener cache for enrichment (beta, etc.) — short-lived connection
    screener_data = {}
    try:
        async with engine.connect() as _conn:
            sc_row = await _conn.execute(text(
                "SELECT data FROM screener_cache WHERE symbol = :sym"
            ), {"sym": symbol})
            sc_result = sc_row.fetchone()
            if sc_result:
                screener_data = sc_result[0] if isinstance(sc_result[0], dict) else json.loads(sc_result[0])
    except Exception as sc_e:
        print(f"Screener cache lookup failed for {symbol} (non-fatal): {sc_e}")
    
    # Helper to safely get numeric values with fallbacks
    def safe_float(value, default=0.0):
        return value if value is not None else default
    
    full_result = {
        "stock": {
            "symbol": symbol,
            "name": profile.get("companyName", "Unknown"),
            "price": safe_float(quote.get("price")),
            "change": safe_float(quote.get("change")),
            "changePercent": safe_float(quote.get("changesPercentage")),
            "previousClose": safe_float(quote.get("previousClose"), quote.get("price", 0.0)),
            "dayHigh": safe_float(quote.get("dayHigh"), quote.get("price", 0.0)),
            "dayLow": safe_float(quote.get("dayLow"), quote.get("price", 0.0)),
            "volume": safe_float(quote.get("volume")),
            "marketCap": safe_float(quote.get("marketCap")),
            "fiftyTwoWeekHigh": safe_float(yahoo_data.get("high_52w"), quote.get("price", 0.0)),
            "fiftyTwoWeekLow": safe_float(yahoo_data.get("low_52w"), quote.get("price", 0.0)),
            "exchange": profile.get("exchangeShortName"),
            "sector": profile.get("sector"),
            "industry": profile.get("industry"),
            "website": profile.get("website"),
            "description": profile.get("description"),
            "ceo": profile.get("ceo"),
            "isETF": bool(fmp_data.get("etf_info") or fmp_data.get("etf_holdings")),
            "beta": safe_float(screener_data.get("beta") or profile.get("beta")),
            "technicals": {
                "sma20": str(safe_float(yahoo_data.get("sma_20"))),
                "sma50": str(safe_float(yahoo_data.get("sma_50"))),
                "sma200": str(safe_float(yahoo_data.get("sma_200"))),
                "rsi": str(safe_float(yahoo_data.get("rsi"))),
                "trend": "bullish" if safe_float(profile.get("price")) > safe_float(yahoo_data.get("sma_200")) else "bearish"
            }
        },
        "analysis": {
            "headlines": ai_data.get("headlines", ""),
            "technicals": ai_data.get("technicals", ""),
            "social_media_hype": ai_data.get("social_media_hype", ""),
            "financial_indicators": ai_data.get("financial_indicators", ""),
            "analyst_consensus": ai_data.get("analyst_consensus", ""),
            "relative_to_market": ai_data.get("relative_to_market", ""),
            "insider_activity": ai_data.get("insider_activity", ""),
            "dividend_health": ai_data.get("dividend_health", ""),
            "final_verdict": ai_data.get("final_verdict", ""),
            "ai_score": ai_data.get("ai_score", "NA"), # Default to NA if missing
            "methodology": ai_data.get("methodology", ""),
            "sources_used": ai_data.get("sources_used", ""),
            "comparative_analysis": ai_data.get("comparative_analysis", ""),
            # Raw Data support
            "technicals_yahoo": yahoo_data,
            "financial_ratios": fmp_data.get("ratios_ttm", [{}])[0] if fmp_data.get("ratios_ttm") else {},
            "analyst_ratings": fmp_data.get("ratings_snapshot", [{}])[0] if fmp_data.get("ratings_snapshot") else {},
            # ETF Raw Data
            "etf_info": fmp_data.get("etf_info", [{}])[0] if fmp_data.get("etf_info") else {},
            "etf_holdings": fmp_data.get("etf_holdings", []),
        },
        "analyzed_at": datetime.utcnow().isoformat()
    }
    

    
    try:
        async with engine.connect() as _conn:
            await _conn.execute(
                text("""
                    INSERT INTO stock_analyses (id, symbol, user_id, status, analysis_data, created_at, updated_at, completed_at)
                    VALUES (:id, :sym, NULL, 'complete', CAST(:data AS JSONB), NOW(), NOW(), NOW())
                """),
                {
                    "id": str(uuid.uuid4()),
                    "sym": symbol,
                    "data": json.dumps(full_result)
                }
            )
            await _conn.commit()
            print(f"Successfully saved {symbol} to database.")
    except Exception as e:
        print(f"Database save failed for {symbol}: {e}")
        raise e
            
    return {"status": "success", "symbol": symbol}
    
async def reconcile_stuck_staging_jobs(conn) -> Dict[str, Any]:
    """
    Finds batch jobs stuck in 'staging' status and checks if they are actually complete.
    This handles cases where the final worker fails to trigger the submission.
    """
    print("Running Batch Reconciliation for stuck 'staging' jobs...")
    try:
        # Find staging jobs older than 30 minutes
        res = await conn.execute(text("""
            SELECT id, target_count, item_count 
            FROM batch_jobs 
            WHERE status = 'staging' 
              AND created_at < NOW() - INTERVAL '30 minutes'
              AND created_at > NOW() - INTERVAL '24 hours'
        """))
        stuck_jobs = res.fetchall()
        
        if not stuck_jobs:
            print("No stuck staging jobs found.")
            return {"status": "success", "reconciled": 0}
            
        reconciled_count = 0
        for job_id, target_count, item_count in stuck_jobs:
            print(f"Checking stuck job {job_id} (target: {target_count}, current: {item_count})")
            
            # 1. Get ACTUAL count from prompts table to be sure
            p_res = await conn.execute(text("SELECT COUNT(*) FROM batch_job_prompts WHERE batch_id = :bid"), {"bid": job_id})
            actual_count = p_res.scalar() or 0
            
            # 2. If we have enough prompts, or if it's been stalled for a long time at > 90%
            # we trigger submission.
            should_submit = False
            if target_count > 0 and actual_count >= target_count:
                print(f"Job {job_id} has reached target {target_count}. Triggering submission...")
                should_submit = True
            elif actual_count > 0 and actual_count == item_count:
                # If DB tally matches actual prompts and it's old, maybe we lost some SQS messages
                # but we should still process what we have if it's been 2 hours
                # Let's check age more strictly for partial submission
                print(f"Job {job_id} is stalled at {actual_count} items. Checking if we should force submit...")
                should_submit = True # For now, if it's > 30m old and stable, submit it.
            
            if should_submit:
                print(f"Reconciling job {job_id}: Fetching {actual_count} prompts...")
                pr_res = await conn.execute(text("SELECT prompt_json FROM batch_job_prompts WHERE batch_id = :bid"), {"bid": job_id})
                all_prompts = [row[0] for row in pr_res.fetchall()]
                
                if all_prompts:
                    # Sync update counts to match reality before submission
                    await conn.execute(text("""
                        UPDATE batch_jobs 
                        SET item_count = :count, target_count = :count 
                        WHERE id = :bid
                    """), {"count": len(all_prompts), "bid": job_id})
                    await submit_google_batch_job_from_staged_prompts(job_id, all_prompts, conn)
                    reconciled_count += 1
                    print(f"Reconciled and submitted job {job_id} with {len(all_prompts)} items.")
                else:
                    print(f"Job {job_id} had no prompts in DB. Marking as error.")
                    await conn.execute(text("UPDATE batch_jobs SET status = 'error' WHERE id = :bid"))
                    await conn.commit()
        
        # 3. VACUUM ORPHANS: Clean up prompts table for any ID that is no longer in 'staging' or 'gathering_data'
        # This fixes the '1 job left in batch_job_prompts' issue where slow workers arrive after submission.
        try:
            print("Vacuuming orphaned prompts...")
            await conn.execute(text("""
                DELETE FROM batch_job_prompts 
                WHERE batch_id NOT IN (
                    SELECT id FROM batch_jobs WHERE status IN ('staging', 'gathering_data')
                )
                  AND created_at < NOW() - INTERVAL '1 hour'
            """))
            await conn.commit()
        except Exception as ve:
            print(f"Vacuum failed: {ve}")
                    
        return {"status": "success", "reconciled": reconciled_count}
        
    except Exception as e:
        print(f"Reconciliation error: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}


