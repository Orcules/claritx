from services.vertex import analyze_stock_with_vertex
from datetime import datetime, date
import json
import asyncio
from typing import Dict, Any, List

from sqlalchemy import text

# --- DB Helpers ---
async def update_analysis_status(analysis_id: str, status: str, conn):
    await conn.execute(text("""
        UPDATE stock_analyses 
        SET status = :status, updated_at = NOW() 
        WHERE id = :id
    """), {"status": status, "id": analysis_id})
    await conn.commit()

async def save_analysis_results(analysis_id: str, data: Dict, conn):
    await conn.execute(text("""
        UPDATE stock_analyses
        SET status = 'complete',
            analysis_data = CAST(:data AS JSONB),
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = :id
    """), {"data": json.dumps(data), "id": analysis_id})
    await conn.commit()

    symbol = data.get("stock", {}).get("symbol", "")
    if symbol:
        try:
            from utils.seo_ping import notify_search_engines
            await notify_search_engines(f"https://www.claritx.ai/stocks/{symbol}")
        except Exception:
            pass

async def save_analysis_error(analysis_id: str, error_msg: str, conn):
    await conn.execute(text("""
        UPDATE stock_analyses 
        SET status = 'error', 
            error_message = :error, 
            updated_at = NOW() 
        WHERE id = :id
    """), {"error": error_msg, "id": analysis_id})
    await conn.commit()

import uuid

async def save_batch_analysis(symbol: str, data: Dict, conn):
    """
    Saves a batch analysis result. Inserts a new record as 'complete'.
    """
    # No longer deleting old records to keep history
    analysis_id = str(uuid.uuid4())
    
    # Simple INSERT (Logs history, doesn't overwrite old ones necessarily, 
    # but we could check for recent duplicates if we wanted to be strict)
    await conn.execute(text("""
        INSERT INTO stock_analyses (id, symbol, user_id, status, analysis_data, created_at, updated_at, completed_at)
        VALUES (:id, :symbol, 'batch_job', 'complete', CAST(:data AS JSONB), NOW(), NOW(), NOW())
    """), {
        "id": analysis_id,
        "symbol": symbol,
        "data": json.dumps(data)
    })
    await conn.commit()

    try:
        from utils.seo_ping import notify_search_engines
        await notify_search_engines(f"https://www.claritx.ai/stocks/{symbol}")
    except Exception:
        pass

    return analysis_id

from services.fmp import fetch_fmp_data
from services.fmp import fetch_fmp_data
from services.yahoo import fetch_yahoo_data
from services.grok import analyze_grok
from services.vertex import analyze_stock_with_vertex
import logging

logger = logging.getLogger(__name__)

async def stock_analysis_internal(symbol: str, source: str = "api", conn=None) -> Dict[str, Any]:
    """
    Orchestrates the full stock analysis process:
    1. Fetch Financial Data (FMP)
    2. Fetch Techncial Data (Yahoo)
    3. AI Analysis (Bedrock)
    4. Return aggregated result
    """
    symbol = symbol.upper()
    logger.info(f"[{source}] Starting analysis for {symbol}")
    
    # 1. Fetch Data Concurrently
    fmp_task = fetch_fmp_data(symbol)
    yahoo_task = asyncio.to_thread(fetch_yahoo_data, symbol)
    
    fmp_data, yahoo_data = await asyncio.gather(fmp_task, yahoo_task)
    
    if not fmp_data or not fmp_data.get("profile"):
        # Critical failure if FMP fails (profile is minimum)
        raise ValueError(f"Could not fetch profile data for {symbol}")

    profile = fmp_data.get("profile", [{}])[0]
    quote = fmp_data.get("quote", [{}])[0]
    
    # 2. Prepare Context for AI
    # Map FMP/Yahoo structure to what call_bedrock_analysis expects
    
    financial_context = {
        "stock_data": {
            "symbol": symbol,
            "companyName": profile.get("companyName"),
            "price": quote.get("price"),
            "marketCap": quote.get("marketCap"),
            "beta": profile.get("beta"),
            "exchange": profile.get("exchangeShortName"),
            "industry": profile.get("industry")
        },
        "financials": f"Ratios (TTM): {json.dumps(fmp_data.get('ratios_ttm', []), default=str)}",
        "detailed_financials": f"Key Metrics (TTM): {json.dumps(fmp_data.get('key_metrics_ttm', []), default=str)}",
        "news": f"Recent News: {json.dumps(fmp_data.get('news', []), default=str)}",
        "technicals": f"Technical Indicators (Yahoo): {json.dumps(yahoo_data, default=str)}",
        "insider_stats": f"Insider Trading (Last 6mo): {json.dumps(fmp_data.get('insider_stats', {}), default=str)}",
        "analyst_data": f"Analyst Estimates: {json.dumps(fmp_data.get('analyst_estimates', []), default=str)}",
        "ratings_data": f"Analyst Ratings: {json.dumps(fmp_data.get('ratings_snapshot', []), default=str)}",
        "price_targets": f"Price Targets: {json.dumps(fmp_data.get('price_target', []), default=str)}",
        "earnings_data": f"Earnings History: {json.dumps(fmp_data.get('earnings', []), default=str)}",
        # ETF Data (will be None/Empty for stocks)
        "etf_info": f"ETF Info: {json.dumps(fmp_data.get('etf_info', []), default=str)}" if fmp_data.get("etf_info") else None,
        "etf_holdings": f"ETF Holdings: {json.dumps(fmp_data.get('etf_holdings', []), default=str)}" if fmp_data.get("etf_holdings") else None,
        "etf_sector_weightings": f"ETF Sector Weightings: {json.dumps(fmp_data.get('etf_sector_weightings', []), default=str)}" if fmp_data.get("etf_sector_weightings") else None,
        "etf_country_weightings": f"ETF Country Weightings: {json.dumps(fmp_data.get('etf_country_weightings', []), default=str)}" if fmp_data.get("etf_country_weightings") else None
    }
    
    # 0. Fetch Previous Analysis for Comparison (short-lived connection)
    from database import engine as _engine
    previous_analysis_data = None
    try:
        async with _engine.connect() as _conn:
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
                logger.info(f"[{source}] Found previous analysis for {symbol} for comparison.")
    except Exception as e:
        logger.error(f"Failed to fetch previous analysis for {symbol}: {e}")

    social_text = await analyze_grok(symbol, profile.get("companyName", ""), conn)
    financial_context["social_search"] = social_text

    # 3. Call AI
    ai_analysis_text = await analyze_stock_with_vertex(symbol, financial_context, conn, previous_analysis=previous_analysis_data)
    
    # Store previous analysis in the final result for frontend display
    previous_analysis_formatted = None
    if previous_analysis_data:
        if isinstance(previous_analysis_data, dict) and "analysis" in previous_analysis_data:
            previous_analysis_formatted = previous_analysis_data["analysis"].copy()
            if "analyzed_at" in previous_analysis_data:
                previous_analysis_formatted["analyzed_at"] = previous_analysis_data["analyzed_at"]
        else:
            previous_analysis_formatted = previous_analysis_data
    
    current_analyzed_at = datetime.utcnow().isoformat()
    try:
        if "```json" in ai_analysis_text:
            ai_analysis_text = ai_analysis_text.split("```json")[1].split("```")[0].strip()
        elif "```" in ai_analysis_text:
            ai_analysis_text = ai_analysis_text.split("```")[1].split("```")[0].strip()
        ai_data = json.loads(ai_analysis_text)
    except Exception as e:
        logger.error(f"AI Parse Fail: {e}")
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
        async with _engine.connect() as _conn:
            sc_row = await _conn.execute(text(
                "SELECT data FROM screener_cache WHERE symbol = :sym"
            ), {"sym": symbol})
            sc_result = sc_row.fetchone()
            if sc_result:
                screener_data = sc_result[0] if isinstance(sc_result[0], dict) else json.loads(sc_result[0])
    except Exception as sc_e:
        logger.warning(f"Screener cache lookup failed for {symbol} (non-fatal): {sc_e}")
    
    # Helper to safely get numeric values with fallbacks
    def safe_float(value, default=0.0):
        return value if value is not None else default
    
    result = {
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
            "isETF": bool(fmp_data.get("etf_info") or fmp_data.get("etf_holdings") or fmp_data.get("profile", [{}])[0].get("isEtf")),
            "isFund": bool(fmp_data.get("profile", [{}])[0].get("isFund")),
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
            "comparative_analysis": ai_data.get("comparative_analysis", ""),
            "final_verdict": ai_data.get("final_verdict", ""),
            "ai_score": ai_data.get("ai_score", "NA"), 
            "methodology": ai_data.get("methodology", ""),
            "sources_used": ai_data.get("sources_used", ""),
            "analyzed_at": current_analyzed_at,
            # Raw Data support
            "technicals_yahoo": yahoo_data,
            "financial_ratios": fmp_data.get("ratios_ttm", [{}])[0] if fmp_data.get("ratios_ttm") else {},
            "analyst_ratings": fmp_data.get("ratings_snapshot", [{}])[0] if fmp_data.get("ratings_snapshot") else {},
            # ETF Raw Data
            "etf_info": fmp_data.get("etf_info", [{}])[0] if fmp_data.get("etf_info") else {},
            "etf_holdings": fmp_data.get("etf_holdings", []),
            "etf_sector_weightings": fmp_data.get("etf_sector_weightings", []),
            "etf_country_weightings": fmp_data.get("etf_country_weightings", []),
            "previous_analysis": previous_analysis_formatted
        },
        "analyzed_at": current_analyzed_at
    }
    
    return result
