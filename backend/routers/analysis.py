from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List
import json
import asyncio
import os
import uuid
import boto3
from datetime import datetime, timedelta
from sqlalchemy import text
from database import get_db_connection
from auth import verify_token, verify_admin
from models import StockAnalysisRequest, TickerScreenerRequest

router = APIRouter()

# --- Helpers (Moved from main.py) ---
async def get_recent_analysis(symbol: str, user_id: str, hours: int, conn) -> Dict:
    cutoff_time = datetime.utcnow() - timedelta(hours=hours)

    result = await conn.execute(text("""
        SELECT id, symbol, status, analysis_data, created_at, completed_at
        FROM stock_analyses
        WHERE symbol = :symbol
          AND (user_id = :user_id OR user_id IS NULL)
          AND status = 'complete'
          AND created_at >= :cutoff_time
        ORDER BY created_at DESC
        LIMIT 1
    """), {"symbol": symbol, "user_id": user_id, "cutoff_time": cutoff_time})
    
    row = result.fetchone()
    if row:
        from database import parse_json
        return {
            "id": row[0],
            "symbol": row[1],
            "status": row[2],
            "analysis_data": parse_json(row[3]),
            "created_at": row[4],
            "completed_at": row[5]
        }
    return None

async def get_pending_analysis(symbol: str, user_id: str, conn) -> Dict:
    result = await conn.execute(text("""
        SELECT id, symbol, status, created_at
        FROM stock_analyses
        WHERE symbol = :symbol
          AND (user_id = :user_id OR user_id IS NULL)
          AND status IN ('pending', 'processing')
          AND created_at > NOW() - INTERVAL '20 minutes'
        ORDER BY created_at DESC
        LIMIT 1
    """), {"symbol": symbol, "user_id": user_id})
    row = result.fetchone()
    if row:
        return {"id": row[0], "symbol": row[1], "status": row[2], "created_at": row[3]}
    return None

async def create_pending_analysis(symbol: str, user_id: str, conn) -> str:
    # No longer deleting old records to keep history
    analysis_id = str(uuid.uuid4())
    await conn.execute(text("""
        INSERT INTO stock_analyses (id, symbol, user_id, status, created_at, updated_at)
        VALUES (:id, :symbol, :user_id, 'pending', NOW(), NOW())
    """), {"id": analysis_id, "symbol": symbol, "user_id": user_id})
    await conn.commit()
    return analysis_id

async def get_analysis_by_id(analysis_id: str, conn) -> Dict:
    result = await conn.execute(text("""
        SELECT id, symbol, status, analysis_data, error_message, created_at, completed_at
        FROM stock_analyses
        WHERE id = :id
    """), {"id": analysis_id})
    row = result.fetchone()
    if row:
        from database import parse_json
        return {
            "id": row[0],
            "symbol": row[1],
            "status": row[2],
            "analysis_data": parse_json(row[3]),
            "error_message": row[4],
            "created_at": row[5],
            "completed_at": row[6]
        }
    return None

# --- Endpoints ---

@router.get("/analysis-status/{analysis_id}")
async def get_analysis_status(analysis_id: str, token: str = Depends(verify_token), conn = Depends(get_db_connection)):
    """
    Poll endpoint to check analysis status.
    """
    analysis = await get_analysis_by_id(analysis_id, conn)
    
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    if analysis['status'] == 'complete':
        ad = analysis['analysis_data']
        if isinstance(ad, str):
            ad = json.loads(ad)
        return {
            "status": "complete",
            "analysis": ad,
            "completed_at": analysis['completed_at'].isoformat() if analysis['completed_at'] else None
        }
    elif analysis['status'] == 'error':
        return {
            "status": "error",
            "error": analysis['error_message']
        }
    else:
        return {
            "status": analysis['status'],
            "message": "Analysis in progress..."
        }

from auth import verify_token, verify_admin, optional_token
from typing import Optional

@router.post("/stock-analysis")
async def stock_analysis_with_cache(req: StockAnalysisRequest, token: Optional[Dict] = Depends(optional_token), conn = Depends(get_db_connection)):
    """
    Comprehensive stock analysis with database caching.
    """
    symbol = req.symbol.upper()
    user_id = token.get("sub", "anonymous") if isinstance(token, dict) else "anonymous"

    # Always deduct 1 credit per request

    # 1. Check Cache
    if not req.force_refresh:
        cached = await get_recent_analysis(symbol, user_id, hours=72, conn=conn)
        if cached and cached['status'] == 'complete':
            analysis_data = cached.get('analysis_data', {})
            if isinstance(analysis_data, str):
                analysis_data = json.loads(analysis_data)
            if not analysis_data or 'stock' not in analysis_data:
                await conn.execute(text("DELETE FROM stock_analyses WHERE id = :id"), {"id": cached['id']})
                await conn.commit()
            else:
                analysis = analysis_data.get('analysis', {})
                required_fields = ['final_verdict']
                missing_fields = [f for f in required_fields if f not in analysis or not analysis[f]]

                if missing_fields:
                    print(f"Cache invalid for {symbol}: missing {missing_fields}")
                    await conn.execute(text("DELETE FROM stock_analyses WHERE id = :id"), {"id": cached['id']})
                    await conn.commit()
                else:
                    return {
                        "status": "complete",
                        "from_cache": True,
                        "completed_at": cached['completed_at'].isoformat() if cached['completed_at'] else None,
                        **analysis_data
                    }

    # 2. Check Pending
    if not req.force_refresh:
        pending = await get_pending_analysis(symbol, user_id, conn=conn)
        if pending:
             return {
                "status": "processing",
                "analysis_id": str(pending['id']),
                "message": "Analysis in progress."
            }

    analysis_id = await create_pending_analysis(symbol, user_id, conn=conn)
    
    # 4. Trigger SQS (Worker)
    queue_url = os.environ.get("SQS_QUEUE_URL")
    if queue_url:
        try:
            sqs = boto3.client('sqs', region_name='us-east-1')
            sqs.send_message(
                QueueUrl=queue_url,
                MessageBody=json.dumps({"analysis_id": analysis_id, "symbol": symbol, "user_id": user_id})
            )
        except Exception as e:
            print(f"SQS Error: {e}")
            # Fallback? Or just log. Analysis will stay pending.
    
    return {
        "status": "pending",
        "analysis_id": analysis_id,
        "message": "Analysis started."
    }

@router.post("/ticker-screener")
async def screen_tickers(request: TickerScreenerRequest, claims: Dict = Depends(verify_token), conn = Depends(get_db_connection)):
    """
    Search and filter tickers from the database based on screener criteria.
    Uses DISTINCT ON (symbol) to ensure unique results.
    """
    try:
        from sqlalchemy import text
        
        # Base query to fetch latest complete analysis for each symbol
        query_sql = """
            WITH latest AS (
                SELECT DISTINCT ON (symbol)
                    symbol,
                    analysis_data,
                    completed_at
                FROM stock_analyses
                WHERE status = 'complete'
                ORDER BY symbol, completed_at DESC
            )
            SELECT 
                l.symbol,
                l.analysis_data->'stock'->>'name' as name,
                COALESCE(sc.data->>'sector', l.analysis_data->'stock'->>'sector') as sector,
                l.analysis_data->'stock'->>'marketCap' as market_cap,
                l.analysis_data->'stock'->>'style' as style,
                l.analysis_data->'stock'->>'dividendYield' as dividend_yield,
                COALESCE(NULLIF(sc.data->>'beta', '')::numeric, 1.0) as beta,
                COALESCE(
                    NULLIF(REGEXP_REPLACE(split_part(l.analysis_data->'analysis'->>'ai_score', '/', 1), '[^0-9.]', '', 'g'), '')::numeric,
                    0
                ) as ai_score,
                l.analysis_data->'analysis'->>'final_verdict' as ai_analysis,
                CASE 
                    WHEN (l.analysis_data->'stock'->>'isETF')::text = 'true' OR (sc.data->>'isEtf')::text = 'true' THEN 'etf'
                    ELSE 'stock'
                END as instrument_type
            FROM latest l
            LEFT JOIN screener_cache sc ON sc.symbol = l.symbol
            WHERE 1=1
        """
        
        params = {}
        
        if request.sector:
            query_sql += " AND (COALESCE(sc.data->>'sector', l.analysis_data->'stock'->>'sector') = :sector)"
            params["sector"] = request.sector
            
        if request.minPrice:
            query_sql += " AND COALESCE(NULLIF(REGEXP_REPLACE(l.analysis_data->'stock'->>'price', '[^0-9.]', '', 'g'), '')::numeric, 0) >= :min_price"
            params["min_price"] = request.minPrice
            
        if request.maxPrice:
            query_sql += " AND COALESCE(NULLIF(REGEXP_REPLACE(l.analysis_data->'stock'->>'price', '[^0-9.]', '', 'g'), '')::numeric, 0) <= :max_price"
            params["max_price"] = request.maxPrice

        query_sql += " ORDER BY ai_score DESC LIMIT 200"
        
        result = await conn.execute(text(query_sql), params)
        rows = result.fetchall()
        
        tickers = []
        for row in rows:
            beta = float(row.beta)
            risk_level = 5 if beta > 1.3 else 1 if beta < 0.8 else 3
            
            tickers.append({
                "symbol": row.symbol,
                "name": row.name,
                "sector": row.sector or "Other",
                "marketCap": row.market_cap or "Unknown",
                "style": row.style or "Blend",
                "dividendYield": row.dividend_yield or "none",
                "volatility": "high" if beta > 1.3 else "low" if beta < 0.8 else "medium",
                "riskLevel": risk_level,
                "instrumentType": row.instrument_type,
                "ai_score": float(row.ai_score),
                "ai_analysis": row.ai_analysis
            })
            
        return {
            "tickers": tickers,
            "fromCache": True,
            "aiRanked": True
        }
    except Exception as e:
        print(f"Ticker Screener Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import BackgroundTasks
from services.batch import run_batch_job_flow

from pydantic import BaseModel

class BatchJobRequest(BaseModel):
    limit: int = 10
    asset_type: str = "stock" # 'stock' or 'etf'
    auto_process: bool = True
    provider: str = "kie_direct" # Default to new fast provider

@router.post("/batch-job")
async def trigger_batch_job(
    request: BatchJobRequest,
    background_tasks: BackgroundTasks, 
    token: str = Depends(verify_admin)
):
    """
    Triggers the Batch Analysis Job.
    Runs in background: Fetch Universe -> Select Top N -> Submit Batch.
    """
    # In a real app, verify admin or authorized user.
    
    # Send SQS message to batch worker
    queue_url = os.environ.get("BATCH_QUEUE_URL") or os.environ.get("SQS_QUEUE_URL")
    
    if queue_url:
        try:
            sqs = boto3.client('sqs', region_name='us-east-1')
            sqs.send_message(
                QueueUrl=queue_url,
                MessageBody=json.dumps({
                    "action": "START_BATCH_JOB",
                    "limit": request.limit,
                    "asset_type": request.asset_type,
                    "auto_process": request.auto_process,
                    "provider": request.provider
                })
            )
            return {
                "status": "started", 
                "message": f"Batch Analysis Job queued (SQS) for {request.limit} top {request.asset_type}s using {request.provider}."
            }
        except Exception as e:
            print(f"SQS Queue failed: {e}")
            # Do NOT fall back to local background task if SQS was attempted but failed/timed out.
            # This prevents double execution if the message was actually sent but client timed out.
            raise HTTPException(status_code=500, detail=f"Failed to enqueue batch job to SQS: {str(e)}")
            
    # Fallback to local background task ONLY if SQS_QUEUE_URL is NOT set
    # Use env var if provider not in request (though Pydantic defaults it)
    provider = request.provider or os.getenv("BATCH_PROVIDER", "google_batch")
    
    background_tasks.add_task(
        run_batch_job_flow, 
        limit=request.limit, 
        asset_type=request.asset_type, 
        conn=None, 
        auto_process=request.auto_process,
        provider=provider,
        session_source="background_task"
    )
    return {
        "status": "started",
        "message": f"Batch Analysis Background Task started for {request.limit} {request.asset_type}s using {provider}."
    }

class ManualBatchSubmitRequest(BaseModel):
    batch_id: str

@router.post("/batch-job/submit-google-batch")
async def trigger_manual_google_batch_submission(
    request: ManualBatchSubmitRequest,
    token: str = Depends(verify_admin)
):
    """
    Manually triggers submission of staged prompts to Google Vertex AI Batch for a specific batch ID.
    Used as an emergency fallback or manual progression step from the Admin UI if the master task fails.
    """
    from database import engine
    from sqlalchemy import text
    from services.batch import submit_google_batch_job_from_staged_prompts
    
    batch_id = request.batch_id
    if not batch_id:
        raise HTTPException(status_code=400, detail="batch_id is required")

    try:
        async with engine.connect() as conn:
            # 1. Fetch prompts staged for this batch
            res = await conn.execute(text("SELECT prompt_json FROM batch_job_prompts WHERE batch_id = :batch_id"), {"batch_id": batch_id})
            rows = res.fetchall()
            
            prompts = [row[0] for row in rows]
            count = len(prompts)
            
            if count == 0:
                raise HTTPException(status_code=404, detail=f"No staged prompts found in database for batch {batch_id}")
                
            # 2. Submit to Vertex AI
            await submit_google_batch_job_from_staged_prompts(batch_id, prompts, conn)
            
            # 3. Commit state changes
            await conn.commit()
            
            return {
                "status": "success",
                "message": f"Successfully submitted {count} prompts to Google Vertex AI Batch for processing.",
                "batch_id": batch_id
            }
            
    except Exception as e:
        print(f"Manual Google Batch Submission failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class BatchProcessRequest(BaseModel):
    batch_id: str

from services.batch import check_and_process_batch_results

@router.post("/batch-job/process")
async def process_batch_results(
    request: BatchProcessRequest,
    token: str = Depends(verify_admin)
):
    """
    Manually triggers processing of a completed batch job.
    Downloads results and queues them for DB insertion.
    """
    result = await check_and_process_batch_results(request.batch_id)
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result

@router.get("/batch-jobs")
async def list_batch_jobs(token: str = Depends(verify_admin), conn = Depends(get_db_connection)):
    """
    Lists recent batch jobs.
    """
    result = await conn.execute(text("""
        SELECT id, status, created_at, item_count, asset_type, completed_at
        FROM batch_jobs
        ORDER BY created_at DESC
        LIMIT 10
    """))
    
    jobs = []
    for row in result.fetchall():
        jobs.append({
            "batch_id": row[0],
            "status": row[1],
            "created_at": row[2].isoformat() if row[2] else None,
            "item_count": row[3],
            "asset_type": row[4],
            "completed_at": row[5].isoformat() if row[5] else None
        })
        
    return jobs
@router.get("/stock-info/{symbol}")
async def get_stock_info(symbol: str, conn = Depends(get_db_connection)):
    """
    Get basic info for a stock from screener_cache or latest analysis.
    """
    symbol = symbol.upper()

    def safe_float(val, default=0.0):
        try:
            return float(val) if val is not None else default
        except (ValueError, TypeError):
            return default

    try:
        # Try screener_cache for basic metadata
        result = await conn.execute(text("SELECT data FROM screener_cache WHERE symbol = :s"), {"s": symbol})
        row = result.fetchone()
        if row and row[0]:
            data = row[0]
            # Normalize for frontend StockInfo type
            return {
                "symbol": symbol,
                "name": data.get("companyName") or data.get("name"),
                "price": safe_float(data.get("price")),
                "change": safe_float(data.get("change")),
                "changesPercentage": safe_float(data.get("changesPercentage")),
                "marketCap": safe_float(data.get("marketCap")),
                "volume": safe_float(data.get("volume")),
                "avgVolume": safe_float(data.get("avgVolume")),
                "sector": data.get("sector"),
                "industry": data.get("industry"),
                "description": data.get("description"),
                "website": data.get("website"),
                "exchange": data.get("exchange"),
                "ceo": data.get("ceo"),
                "employees": data.get("fullTimeEmployees")
            }

        # Fallback to latest complete analysis
        result = await conn.execute(text("""
            SELECT analysis_data->'stock' 
            FROM stock_analyses 
            WHERE symbol = :s AND status = 'complete' 
            ORDER BY updated_at DESC LIMIT 1
        """), {"s": symbol})
        row = result.fetchone()
        if row and row[0]:
            stock = row[0]
            return {
                "symbol": symbol,
                "name": stock.get("name"),
                "industry": stock.get("industry"),
                "description": stock.get("description"),
                "sector": stock.get("sector"),
                "website": stock.get("website")
            }

        raise HTTPException(status_code=404, detail=f"Stock info for {symbol} not found")
    except Exception as e:
        print(f"Stock Info Error for {symbol}: {e}")
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stock-prices")
async def get_stock_prices(request: Dict[str, Any], conn = Depends(get_db_connection)):
    """
    Bulk fetch latest prices from the most recent completed analysis.
    """
    symbols = request.get("symbols", [])
    if not symbols:
        return {"prices": []}

    symbols = [s.upper() for s in symbols]

    try:
        query = text("""
            SELECT symbol,
                   COALESCE(CAST(analysis_data->'stock'->>'price' AS NUMERIC), 0) as price,
                   COALESCE(CAST(analysis_data->'stock'->>'changesPercentage' AS NUMERIC), 0) as change_percent
            FROM (
                SELECT symbol, analysis_data,
                       ROW_NUMBER() OVER(PARTITION BY symbol ORDER BY updated_at DESC) as rn
                FROM stock_analyses
                WHERE symbol = ANY(:symbols) AND status = 'complete'
            ) t
            WHERE rn = 1
        """)
        result = await conn.execute(query, {"symbols": symbols})
        prices = []
        for row in result.fetchall():
            prices.append({
                "symbol": row[0],
                "price": float(row[1]),
                "changePercent": float(row[2])
            })
        return {"prices": prices}
    except Exception as e:
        print(f"Stock Prices Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search-stocks")
async def search_stocks(q: str, conn = Depends(get_db_connection)):
    """Search for stocks by symbol or name from stock_analyses."""
    if len(q) < 1:
        return []
        
    try:
        from sqlalchemy import text
        query = text("""
            WITH latest AS (
                SELECT DISTINCT ON (symbol)
                    symbol,
                    analysis_data
                FROM stock_analyses
                WHERE status = 'complete'
                ORDER BY symbol, created_at DESC
            ),
            scored AS (
                SELECT
                    symbol,
                    analysis_data->'stock'->>'name' as name,
                    COALESCE(analysis_data->'stock'->>'sector', '') as sector,
                    analysis_data->'analysis'->>'ai_score' as raw_score
                FROM latest
                WHERE symbol ILIKE :q
                   OR analysis_data->'stock'->>'name' ILIKE :q
            )
            SELECT
                symbol,
                name,
                sector,
                COALESCE(
                    NULLIF(
                        REGEXP_REPLACE(
                            split_part(raw_score, '/', 1),
                            '[^0-9.]', '', 'g'
                        ), ''
                    )::numeric,
                    0
                ) as quality_score
            FROM scored
            WHERE raw_score IS NOT NULL AND raw_score != 'NA'
            ORDER BY quality_score DESC NULLS LAST
            LIMIT 10
        """)
        result = await conn.execute(query, {"q": f"%{q}%"})
        rows = result.fetchall()
        
        return [dict(row._mapping) for row in rows]
    except Exception as e:
        print(f"Search Stocks Error: {e}")
        return []

from pydantic import BaseModel
from auth import verify_token, optional_token
from typing import Optional, Dict

class SimilarStocksRequest(BaseModel):
    symbol: str
    sector: str = "Unknown"
    riskLevel: int = 3
    limit: int = 10

@router.post("/similar-stocks")
async def get_similar_stocks(req: SimilarStocksRequest, claims: Optional[Dict] = Depends(optional_token), conn = Depends(get_db_connection)):
    """Find similar stocks based on sector, risk level, and user profile."""
    try:
        from sqlalchemy import text
        min_risk = max(1, req.riskLevel - 1)
        max_risk = min(5, req.riskLevel + 1)
        
        # Base query parameters
        params = {
            "sector": req.sector,
            "symbol": req.symbol.upper(),
            "limit": req.limit
        }
        
        # Base where clauses
        where_clauses = [
            "sector = :sector",
            "symbol != :symbol"
        ]
        
        # Check for user profile to apply stricter constraints
        profile = None
        user_sub = claims.get("sub") if claims else None
        
        if user_sub:
            profile_result = await conn.execute(text("SELECT settings FROM investor_profiles WHERE user_id = :uid"), {"uid": user_sub})
            profile_row = profile_result.fetchone()
            
            if profile_row and profile_row[0]:
                import json
                settings = profile_row[0] if isinstance(profile_row[0], dict) else json.loads(profile_row[0])
                profile = settings.get("investor_profile")
        
        # Apply Profile Filters if they exist
        if profile:
            market_cap_pref = profile.get("market_cap", "all")
            risk_tolerance = profile.get("risk_tolerance", "moderate")
            value_or_growth = profile.get("value_or_growth", "blend")
            income_vs_growth = profile.get("income_vs_growth", "both")
            
            # Market cap filter (only for stocks, not ETFs)
            if market_cap_pref == "large":
                where_clauses.append("COALESCE(market_cap_value, 0) >= 10000000000")
            elif market_cap_pref == "mid":
                where_clauses.append("COALESCE(market_cap_value, 0) BETWEEN 2000000000 AND 10000000000")
                
            # Risk tolerance filter
            if risk_tolerance == "conservative":
                where_clauses.append("COALESCE(beta, 1) < 0.8")
                # Also tighten 1-5 risk_level mapping
                params["max_risk"] = min(3, max_risk)
                where_clauses.append("risk_level <= :max_risk")
            elif risk_tolerance == "aggressive":
                where_clauses.append("COALESCE(beta, 1) > 1.3")
                params["min_risk"] = max(3, min_risk)
                where_clauses.append("risk_level >= :min_risk")
            else:
                params["min_risk"] = min_risk
                params["max_risk"] = max_risk
                where_clauses.append("risk_level >= :min_risk")
                where_clauses.append("risk_level <= :max_risk")
                
            # Value/Growth filter
            if value_or_growth == "value":
                where_clauses.append("COALESCE(pe_ratio, 0) > 0 AND COALESCE(pe_ratio, 0) <= 25")
            elif value_or_growth == "growth":
                where_clauses.append("COALESCE(pe_ratio, 0) > 0") # Positive earnings assumption
                
            # Income filter
            if income_vs_growth == "income":
                where_clauses.append("COALESCE(dividend_yield_value, 0) > 0")
                
        else:
            # Fallback to standard 1-5 risk_level proximity if no profile found
            params["min_risk"] = min_risk
            params["max_risk"] = max_risk
            where_clauses.append("risk_level >= :min_risk")
            where_clauses.append("risk_level <= :max_risk")

        # Determine if we are looking for ETFs or Stocks
        is_etf_req = req.sector == "ETF"
        
        # 1. Main Query: Join unique latest analyses and screener_cache
        query_sql = """
            WITH latest_analyses AS (
                SELECT DISTINCT ON (symbol) 
                    symbol, 
                    analysis_data, 
                    updated_at
                FROM stock_analyses
                WHERE status = 'complete'
                ORDER BY symbol, updated_at DESC
            )
            SELECT 
                sa.symbol,
                sa.analysis_data->'stock'->>'name' as name,
                COALESCE(sc.data->>'sector', sa.analysis_data->'stock'->>'sector') as sector,
                COALESCE(
                    NULLIF(REGEXP_REPLACE(split_part(sa.analysis_data->'analysis'->>'ai_score', '/', 1), '[^0-9.]', '', 'g'), '')::numeric,
                    0
                ) as quality_score,
                'blend' as style,
                COALESCE(NULLIF(sa.analysis_data->'analysis'->'financial_ratios'->>'priceToEarningsRatioTTM', '')::numeric, 0) as pe_ratio,
                COALESCE(NULLIF(sa.analysis_data->'analysis'->'financial_ratios'->>'dividendYieldTTM', '')::numeric, 0) as dividend_yield_value,
                COALESCE(NULLIF(sc.data->>'beta', '')::numeric, 1.0) as beta
            FROM latest_analyses sa
            LEFT JOIN screener_cache sc ON sc.symbol = sa.symbol
            WHERE sa.symbol != :symbol
        """
        
        if is_etf_req:
            # For ETFs, we don't care about sector as much, just find other ETFs
            query_sql += " AND COALESCE(sa.analysis_data->'stock'->>'isETF', 'false') IN ('true', 'True')"
        else:
            # For stocks, stay in same sector
            query_sql += " AND (COALESCE(sc.data->>'sector', sa.analysis_data->'stock'->>'sector') = :sector)"
            query_sql += " AND COALESCE(sa.analysis_data->'stock'->>'isETF', 'false') NOT IN ('true', 'True')"

        # Apply Risk Filter (Beta)
        if req.riskLevel <= 2: # Conservative
            query_sql += " AND COALESCE(NULLIF(sc.data->>'beta', '')::numeric, 1.0) < 1.0"
        elif req.riskLevel >= 4: # Aggressive
            query_sql += " AND COALESCE(NULLIF(sc.data->>'beta', '')::numeric, 1.0) > 1.2"
            
        query_sql += f" ORDER BY quality_score DESC LIMIT {req.limit}"
        
        result = await conn.execute(text(query_sql), {"sector": req.sector, "symbol": req.symbol})
        rows = result.fetchall()
        alternatives = [dict(row._mapping) for row in rows]
        
        # Map risk_level to 3 as default for return
        for a in alternatives:
            beta = float(a.get('beta', 1.0))
            a['risk_level'] = 5 if beta > 1.3 else 1 if beta < 0.8 else 3
        
        return {
            "alternatives": alternatives,
            "originalSymbol": req.symbol
        }
    except Exception as e:
        print(f"Similar Stocks Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
