import os
import time
import uuid
import asyncio
import json
import base64
from datetime import datetime
from typing import Dict, Any

from sqlalchemy import text
from google import genai
from google.genai.types import HttpOptions
from google.genai import types
from google.cloud import storage
import tempfile

from utils.network import RateLimiter, async_retry
from utils.gcp import get_gcp_credentials

def normalize_whitespace(text: str) -> str:
    import re
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()

def generate_analysis_prompt(
    symbol: str, financial_data: Dict[str, Any], social_data: str = "", is_batch: bool = False, previous_analysis: Dict[str, Any] = None
) -> str:
    # Determine if it's an ETF based on FMP data presence
    is_etf = bool(financial_data.get("etf_holdings") or financial_data.get("etf_info"))

    # Build context instructions based on batch vs direct
    if is_batch:
        context_instructions = """The data context below contains ALL the financial data, news, technicals, insider activity, 
analyst ratings, price targets, and earnings history you need. This is your ONLY source of truth.
You do NOT have access to external search in batch mode. Analyze DEEPLY using ONLY the provided data.
Extract and cite specific numbers, dates, and data points from the context to support your analysis."""
    else:
        current_date = datetime.utcnow().strftime("%B %d, %Y")
        context_instructions = f"""The data context is your PRIMARY source of truth.
You also have access to the Google Search tool. Use it to:
1. Find recent news and developments as of {current_date} +- 14 days (+- 2 weeks for broader context) not in the data context.
2. Validate and enrich key information."""

    current_date = datetime.utcnow().strftime("%B %d, %Y")
    prev_date = "N/A"
    
    if previous_analysis:
        if isinstance(previous_analysis, str):
            try:
                previous_analysis = json.loads(previous_analysis)
            except:
                pass

        if isinstance(previous_analysis, dict):
            # Check nested analyzed_at or top-level
            prev_date = previous_analysis.get('analyzed_at') or previous_analysis.get('completed_at')
            if not prev_date and "analysis" in previous_analysis:
                prev_date = previous_analysis["analysis"].get("analyzed_at")
            
            if not prev_date: prev_date = "Historical Record"
        else:
            prev_date = "Historical Archive"
    
    if is_etf:
        # ETF Specific Prompt
        return f"""You are a professional financial analyst AI specializing in Exchange Traded Funds (ETFs). 
Analyze the ETF {symbol} based on the provided data context.

{context_instructions}

DATA CONTEXT START:
{financial_data}
DATA CONTEXT END.

{ f"PREVIOUS ANALYSIS FOR COMPARISON (Use this to explain changes in rating/outlook): {json.dumps(previous_analysis, indent=2)}" if previous_analysis else "" }

Return valid JSON only.

REQUIREMENTS:
- Each text category must be around 300 to 400 words (except final_verdict).
- Cite specific data points (Holdings, Sector Weights, Expense Ratio) and sources.
- Be very detailed.
- **COMPARATIVE ANALYSIS:** If PREVIOUS ANALYSIS is provided, you MUST use the "comparative_analysis" section to compare the current data/outlook with the previous one. Explain clearly WHY the rating has changed or stayed the same. Mention the dates: Previous ({prev_date}) vs Current ({current_date}).
- **CRITICAL:** For something you have no information about, write "Empty as we dont have date for this"
- **CRITICAL:** At the VERY END of each ANALYSIS text section (headlines through final_verdict), you MUST provide a sentiment score in this exact format: "Rating X/100". (0 = Extremely Bearish/Negative, 50 = Neutral, 100 = Extremely Bullish/Positive). Do NOT add ratings to methodology or sources_used or comparative_analysis.

JSON STRUCTURE (ETF Adapted):
{{
  "headlines": "Recent news affecting the ETF's sector/holdings... (300-400 words) ... Rating X/100",
  "technicals": "Technical analysis of the ETF chart (SMA, RSI, Support/Resist)... (300-400 words) ... Rating X/100",
  "social_media_hype": "Sentiment around this ETF and its top holdings from x and reddit as of {current_date} +- 7 days.... (300-400 words) ... Rating X/100",
  "financial_indicators": "Empty as we dont have date for this",
  "analyst_consensus": "Empty as we dont have date for this",
  "relative_to_market": "Performance vs Benchmark (sectors and/or indexes) and Peer ETFs... (300-400 words) ... Rating X/100",
  "insider_activity": "Top Holdings & Concentration Risk. Analyze the top 10 holdings and their impact... (300-400 words) ... Rating X/100",
  "dividend_health": "Empty as ETfs dont give dividend",
  "comparative_analysis": "COMPREHENSIVE comparison between previous ({prev_date}) and current ({current_date}) analysis. Explain rating shifts and data changes. (300-400 words. NO rating here)",
  "final_verdict": "Comprehensive investment thesis. Buy/Hold/Sell rationale... Format as EXACTLY 2 paragraphs, approx 150-200 words total. Rating X/100",
  "ai_score": X/100,  MUST MATCH the final_verdict Rating. This is your FINAL weighted score, NOT a simple average of sub-ratings),
  "methodology": "Explain EXACTLY how you reached the ai_score. Detail the point system, weight of Macro factors vs Technicals. (200-300 words. NO rating here)",
  "sources_used": "List of sources...",
  "quality_flags": {{
    "positives": ["3-5 concise bullet strings highlighting the ETF's key strengths (e.g. 'Low expense ratio', 'Broad diversification', 'Strong AUM growth')"],
    "concerns": ["3-5 concise bullet strings highlighting the ETF's key risks (e.g. 'Sector concentration risk', 'High correlation to index', 'Liquidity concerns')"]
  }}
}}"""
    else:
        # Stock Specific Prompt
        return f"""You are a professional financial analyst AI. Analyze the stock {symbol} 
based on the provided data context. 

{context_instructions}

DATA CONTEXT START:
{financial_data}
DATA CONTEXT END.

{ f"PREVIOUS ANALYSIS FOR COMPARISON (Use this to explain changes in rating/outlook): {json.dumps(previous_analysis, indent=2)}" if previous_analysis else "" }

Return valid JSON only.

REQUIREMENTS:
- Each text category must be around 300 to 400 words (except final_verdict).
- Cite specific data points and sources.
- Be very detailed.
- **COMPARATIVE ANALYSIS:** If PREVIOUS ANALYSIS is provided, you MUST use the "comparative_analysis" section to compare the current data/outlook with the previous one. Explain clearly WHY the rating has changed or stayed the same. Mention the dates: Previous ({prev_date}) vs Current ({current_date}).
- **CRITICAL:** For something you have no information about, write "Empty as we dont have date for this".
- **CRITICAL:** At the VERY END of each ANALYSIS text section (headlines through final_verdict), you MUST provide a sentiment score in this exact format: "Rating X/100". (0 = Extremely Bearish/Negative, 50 = Neutral, 100 = Extremely Bullish/Positive). Do NOT add ratings to methodology or sources_used or comparative_analysis.

JSON STRUCTURE:
{{
  "headlines": "News summary... (300-400 words) ... Rating X/100",
  "technicals": "SMA/RSI... (300-400 words) ... Rating X/100",
  "social_media_hype": "Sentiment from x and reddit from top influencers as of t... (300-400 words) ... Rating X/100",
  "financial_indicators": "Metrics... (300-400 words) ... Rating X/100",
  "analyst_consensus": "Analyst synthesis... (300-400 words) ... Rating X/100",
  "relative_to_market": "Sector comparison... (300-400 words) ... Rating X/100",
  "insider_activity": "Insider transactions... (300-400 words) ... Rating X/100",
  "dividend_health": "Dividend analysis... (300-400 words) ... Rating X/100",
  "comparative_analysis": "COMPREHENSIVE comparison between previous ({prev_date}) and current ({current_date}) analysis. Explain rating shifts and data changes. (300-400 words. NO rating here)",
  "final_verdict": "Comprehensive thesis... Format as EXACTLY 2 paragraphs, approx 150-200 words total. Rating X/100",
  "ai_score": X/100, MUST MATCH the final_verdict Rating. This is your FINAL weighted score, NOT a simple average of sub-ratings),
  "methodology": "Explain EXACTLY how you reached the ai_score. Detail the point system, which factors (Technicals, Sentiment, Fundamentals) carried the most weight. (200-300 words. NO rating here)",
  "sources_used": "List of sources...",
  "quality_flags": {{
    "positives": ["3-5 concise bullet strings highlighting the ETF's key strengths (e.g. 'Low expense ratio', 'Broad diversification', 'Strong AUM growth')"],
    "concerns": ["3-5 concise bullet strings highlighting the ETF's key risks (e.g. 'Sector concentration risk', 'High correlation to index', 'Liquidity concerns')"]
  }}
}}"""


@async_retry(retries=3, delay=5.0, backoff=2.0, exceptions=(Exception,))
async def analyze_stock_with_vertex(symbol: str, financial_data: Dict[str, Any], conn=None, previous_analysis: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Calls Google Vertex AI to analyze the stock.
    Replaces Google Gemini (consumer API).
    """
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")

    if not project_id:
        return {"error": "AI Analysis unavailable (Missing Google Cloud Project ID)."}

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return "AI Analysis unavailable (Missing Google API Key)."

    deployment_id = os.environ.get("DENO_DEPLOYMENT_ID", "backend-local")
    correlation_id = str(uuid.uuid4())

    model_id = "gemini-3.1-pro-preview"

    if previous_analysis is None and conn:
        try:
            prev_res = await conn.execute(text("""
                SELECT analysis_data
                FROM stock_analyses
                WHERE symbol = :symbol AND status = 'complete'
                ORDER BY completed_at DESC
                LIMIT 1
            """), {"symbol": symbol})
            prev_row = prev_res.fetchone()
            if prev_row:
                previous_analysis = prev_row[0]
                print(f"[Vertex] Found previous analysis for {symbol} for comparison.")
        except Exception as e:
            print(f"Failed to fetch previous analysis in vertex service: {e}")

    prompt = generate_analysis_prompt(symbol, financial_data, previous_analysis=previous_analysis)

    # Log Request

    try:
        start_time = time.time()
        creds_json = os.environ.get("GOOGLE_CREDENTIALS_JSON")
        cred_path = "/tmp/gcp_creds.json"
        
        if creds_json:
            # If provided via env var (for local dev or small enough keys)
            decoded_creds = base64.b64decode(creds_json).decode('utf-8')
            with open(cred_path, 'w') as f:
                f.write(decoded_creds)
            os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = cred_path
        else:
            # Check for bundled credentials file (to bypass 4KB Lambda env limit)
            # Try root and current dir
            possible_paths = [
                os.path.join(os.getcwd(), "gcp_creds.json"),
                os.path.join(os.path.dirname(os.path.dirname(__file__)), "gcp_creds.json"),
                "/var/task/gcp_creds.json"
            ]
            for p in possible_paths:
                if os.path.exists(p):
                    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = p
                    print(f"[Vertex] Using GCP credentials from file: {p}")
                    break

        client = genai.Client(
            vertexai=True,
            location="global",
            project=project_id,
            http_options=HttpOptions(
                api_version="v1",
                headers={"X-Vertex-AI-LLM-Shared-Request-Type": "priority"},
                timeout=600000 # 10 minutes for single heavy AI request
            ),
        )

        def run_vertex():
            response = client.models.generate_content(
                model=model_id,
                contents=prompt,
                config={"response_mime_type": "application/json", "tools": [{"google_search": {}}]},
            )
            return response.text

        loop = asyncio.get_event_loop()
        
        # Internal timeout to fail before Lambda does (300s)
        ai_text = await asyncio.wait_for(
            loop.run_in_executor(None, run_vertex), 
            timeout=720
        )

        duration = (time.time() - start_time) * 1000

        # Log Response

        return ai_text

    except Exception as e:
        duration = (time.time() - start_time) * 1000 if "start_time" in locals() else 0
        print(f"Vertex Analysis Failed: {e}")

        # Log Error

        raise Exception(f"Failed to generate analysis: {str(e)}")



@async_retry(retries=3, delay=2.0, backoff=2.0, exceptions=(Exception,))
async def analyze_with_vertex(symbol: str, prompt: str, conn=None, use_search: bool = True) -> Dict[str, Any]:
    """
    Calls Google Vertex AI to analyze the stock.
    Replaces Google Gemini (consumer API).
    """
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")

    if not project_id:
        return {"error": "AI Analysis unavailable (Missing Google Cloud Project ID)."}

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return "AI Analysis unavailable (Missing Google API Key)."

    deployment_id = os.environ.get("DENO_DEPLOYMENT_ID", "backend-local")
    correlation_id = str(uuid.uuid4())

    model_id = "gemini-3.1-pro-preview"

    # Normalize inputs
    def normalize_whitespace(text: str) -> str:
        import re

        if not text:
            return ""
        return re.sub(r"\s+", " ", text).strip()


    # Log Request

    try:
        start_time = time.time()
        
        # Load GCP credentials using unified utility
        get_gcp_credentials()

        client = genai.Client(
            vertexai=True,
            location="global",
            project=project_id,
            http_options=HttpOptions(
                api_version="v1",
                headers={"X-Vertex-AI-LLM-Shared-Request-Type": "priority"},
                timeout=600000
            ),
        )

        def run_vertex():
            response = client.models.generate_content(
                model=model_id,
                contents=prompt,
                config={"response_mime_type": "application/json", "tools": [{"google_search": {}}]} if use_search else {"response_mime_type": "application/json"},
            )
            return response.text

        loop = asyncio.get_event_loop()
        
        ai_text = await asyncio.wait_for(
            loop.run_in_executor(None, run_vertex),
            timeout=720
        )

        duration = (time.time() - start_time) * 1000

        # Log Response

        return ai_text

    except Exception as e:
        duration = (time.time() - start_time) * 1000 if "start_time" in locals() else 0
        print(f"Vertex Analysis Failed: {e}")

        # Log Error
      

        raise Exception(f"Failed to generate analysis: {str(e)}")


async def analyze_portfolio_with_vertex(
    client_name: str,
    portfolio: Dict[str, Any],
    risk_profile: Dict[str, Any],
    conn=None
) -> Dict[str, Any]:
    """Generates a personalized portfolio analysis based on client risk profile."""
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        return {"error": "AI Analysis unavailable (Missing Project ID)."}

    model_id = "gemini-3.1-pro-preview"
    from google import genai
    import json
    
    prompt = f"""You are a professional financial advisor. Analyze the following portfolio for client "{client_name}" 
against their risk profile and provide a detailed analysis.

CLIENT RISK PROFILE:
{json.dumps(risk_profile, indent=2)}

PORTFOLIO DATA:
{json.dumps(portfolio, indent=2)}

REQUIREMENTS:
1. Provide a "summary" (2-3 paragraphs) of the current situation.
2. Provide a "riskAssessment" (2-3 paragraphs) of how well the portfolio matches the risk profile.
3. Provide a list of 3-5 specific "recommendations".
4. Provide a list of 2-3 specific "warnings" or risks.
5. Provide a "score" from 0-100 representing the alignment (0=Poor, 100=Perfect).

Return ONLY valid JSON in this structure:
{{
  "summary": "...",
  "riskAssessment": "...",
  "recommendations": ["...", "..."],
  "warnings": ["...", "..."],
  "score": 85
}}
"""

    try:
        client = genai.Client(
            vertexai=True,
            location="global",
            project=project_id,
        )

        response = client.models.generate_content(
            model=model_id,
            contents=prompt,
            config={"response_mime_type": "application/json"}
        )
        
        return json.loads(response.text)
    except Exception as e:
        print(f"Portfolio Analysis Failed: {e}")
        raise Exception(f"Failed to generate analysis: {str(e)}")


async def upload_to_gcs(data: bytes, filename: str, content_type: str = "image/jpeg") -> str:
    """
    Uploads data to the configured GCS bucket and returns the public URL.
    """
    bucket_name = os.environ.get("GCS_BUCKET_NAME")
    if not bucket_name:
        print("[GCS] No bucket name configured, skipping upload.")
        return ""

    try:
        # Auth handled by GOOGLE_APPLICATION_CREDENTIALS set in analyze_with_vertex
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(filename)
        
        blob.upload_from_string(data, content_type=content_type)
        
        # Try to make public for blog access
        try:
            blob.make_public()
        except Exception as e:
            print(f"[GCS] Could not make public (policy may prevent it): {e}")

        # Return public URL
        return f"https://storage.googleapis.com/{bucket_name}/{filename}"
    except Exception as e:
        print(f"[GCS] Upload failed: {e}")
        return ""


BLOG_IMAGE_STYLE_PREFIX = (
    "Vivid stylized digital illustration for a financial blog. "
    "Rich saturated colors, dramatic lighting, modern editorial style. "
    "Bold shapes, cinematic composition, slightly fantastical and visually striking. "
    "16:9 wide format. No text, no words, no watermarks, no logos. "
    "Subject: "
)


async def generate_image_with_vertex(prompt: str, slug: str) -> str:
    """
    Generates an image using Vertex AI Imagen 3 and uploads to GCS.
    """
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if not project_id: return ""

    cred_path = get_gcp_credentials()
    if not cred_path:
        print("[Chat] Warning: GCP credentials not found, trying ADC")

    # Ensure consistent visual style across all blog images
    styled_prompt = prompt if "vivid stylized" in prompt.lower() else BLOG_IMAGE_STYLE_PREFIX + prompt

    try:
        client = genai.Client(
            vertexai=True,
            location="global",
            project=project_id,
        )

        print(f"[Vertex] Generating image for prompt: {styled_prompt[:80]}...")
        response = client.models.generate_content(
            model="gemini-3.1-flash-image-preview",
            contents=styled_prompt,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
            ),
        )

    # Extract the generated image from the response
        filename = ""
        if response.candidates:
            for candidate in response.candidates:
                for part in candidate.content.parts:
                    if part.inline_data:
                        # part.inline_data.data contains the raw bytes
                        # mime_type = part.inline_data.mime_type
                        # ext = mime_type.split("/")[-1] if "/" in mime_type else "png"
                        # filename = f"generated_image_genai.{ext}"
                        filename = f"images/blog/{slug}-{int(time.time())}.jpg"
                        gcs_url = await upload_to_gcs(part.inline_data.data, filename)
                        # with open(filename, "wb") as f:
                        #     f.write(part.inline_data.data)
                        print(f"Success! Image saved as {filename}")
                       
        return filename

    except Exception as e:
        print(f"[Vertex] Image generation failed: {e}")
        return ""