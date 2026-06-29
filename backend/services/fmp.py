import httpx
import os
import json
import asyncio
from datetime import datetime
from typing import Dict, Any

from utils.network import RateLimiter, async_retry
import logging

logger = logging.getLogger(__name__)

# FMP Rate Limit: 300 calls per minute globally across all Lambdas
fmp_limiter = RateLimiter(calls=300, period=60.0)

async def acquire_distributed_fmp_token():
    """
    Coordinates FMP API usage across distributed Lambdas using PostgreSQL.
    Sleeps the Lambda dynamically if the global 300 calls/min limit is reached.
    """
    from database import engine, get_db_connection
    from sqlalchemy import text
    import time
    
    max_calls = 280 # Under-commit slightly below 300 for safety
    window = 60 # 1 minute window
    
    # Ensure engine is initialized if this worker just booted
    if not engine:
        try:
            # Force lazy-init by generating a connection
            async for _conn in get_db_connection():
                pass
        except Exception as e:
            logger.error(f"CRITICAL: Failed to initialize DB engine for Rate Limiter: {e}")
            await fmp_limiter.acquire()
            return
            
    # Need to re-import engine just in case `get_db_connection` set it
    from database import engine

    if not engine:
        logger.error("CRITICAL: DB engine still None after lazy-init attempt. Falling back to local limits!")
        await fmp_limiter.acquire()
        return
    
    while True:
        try:
            async with engine.begin() as conn: # Use transaction
                # 1. Clean up old windows, or get current if valid
                res = await conn.execute(text("SELECT window_start, request_count FROM api_rate_limits WHERE key = 'fmp' FOR UPDATE"))
                row = res.fetchone()
                
                now = datetime.utcnow()
                
                if not row:
                    # First ever run
                    await conn.execute(text("INSERT INTO api_rate_limits (key, window_start, request_count) VALUES ('fmp', :now, 1)"), {"now": now})
                    return # Acquired!
                    
                window_start = row[0]
                count = row[1]
                
                age_seconds = (now - window_start).total_seconds()
                
                if age_seconds >= window:
                    # Window expired. Reset start and count.
                    await conn.execute(text("UPDATE api_rate_limits SET window_start = :now, request_count = 1 WHERE key = 'fmp'"), {"now": now})
                    return # Acquired newly fresh window!
                
                if count < max_calls:
                    # Window active, under limit. Increment.
                    await conn.execute(text("UPDATE api_rate_limits SET request_count = request_count + 1 WHERE key = 'fmp'"))
                    return # Acquired!
                    
                # If we get here, the window is active AND we are over the limit.
                # Calculate exactly how long we must sleep before the window resets.
                sleep_time = window - age_seconds
                
        except Exception as e:
            logger.error(f"CRITICAL: DB Rate Limiter Transaction Failed! Error: {e}")
            # Fallback to pure local limiting if DB panics during transaction
            await fmp_limiter.acquire()
            return
            
        if sleep_time > 0:
            logger.warning(f"FMP GLOBAL RATE LIMIT REACHED (Count: {count}). Sleeping Lambda for {sleep_time:.2f} seconds...")
            await asyncio.sleep(sleep_time + 0.5) # Sleep exactly until rest, then try again

@async_retry(retries=3, delay=1.0, backoff=2.0)
async def fetch_fmp_data(symbol: str) -> Dict[str, Any]:
    """
    Fetches comprehensive financial data from FMP API.
    """
    api_key = os.environ.get("FMP_API_KEY")
    if not api_key:
        logger.warning("Warning: FMP_API_KEY not set")
        return {}

    base_url = "https://financialmodelingprep.com/stable"
    results = {}
    
    async with httpx.AsyncClient() as client:
        # Step 1: Fetch Profile first to determine if it is an ETF
        profile_url = f"{base_url}/profile?symbol={symbol}&apikey={api_key}"
        await acquire_distributed_fmp_token()
        
        try:
            profile_resp = await client.get(profile_url, timeout=30.0)
            if profile_resp.status_code == 200:
                results["profile"] = profile_resp.json()
            elif profile_resp.status_code == 429:
                raise Exception("FMP Rate Limit Exceeded (429) on profile")
            else:
                logger.error(f"FMP profile failed: {profile_resp.status_code}")
                results["profile"] = {}
        except Exception as e:
            logger.error(f"FMP profile error: {e}. Raising exception to trigger retry.")
            raise e

        # Check if asset is ETF or Fund
        is_etf = False
        is_fund = False
        if results.get("profile") and isinstance(results["profile"], list) and len(results["profile"]) > 0:
            is_etf = results["profile"][0].get("isEtf", False)
            is_fund = results["profile"][0].get("isFund", False)

        # Step 2: Define remaining endpoints based on asset type
        endpoints = {
            "quote": f"{base_url}/quote?symbol={symbol}&apikey={api_key}",
        }
        
        if is_etf or is_fund:
            # ETF/Fund Specific Endpoints
            endpoints.update({
                "etf_info": f"{base_url}/etf/info?symbol={symbol}&apikey={api_key}",
                "etf_holdings": f"{base_url}/etf-holder/{symbol}?apikey={api_key}",
                "news": f"{base_url}/news/stock?symbols={symbol}&limit=10&apikey={api_key}"
            })

        else:
            # Stock Specific Endpoints
            endpoints.update({
                "ratios_ttm": f"{base_url}/ratios-ttm?symbol={symbol}&apikey={api_key}",
                "key_metrics_ttm": f"{base_url}/key-metrics-ttm?symbol={symbol}&apikey={api_key}",
                "news": f"{base_url}/news/stock?symbols={symbol}&limit=10&apikey={api_key}",
                "insider_stats": f"{base_url}/insider-trading/statistics?symbol={symbol}&apikey={api_key}",
                "price_target": f"{base_url}/price-target-summary?symbol={symbol}&apikey={api_key}", 
                "ratings_snapshot": f"{base_url}/ratings-snapshot?symbol={symbol}&apikey={api_key}",
                "earnings": f"{base_url}/earnings?symbol={symbol}&limit=4&apikey={api_key}"
            })
    
        # Fetch sequentially to ensure DB limits increment correctly and protect burst
        for key, url in endpoints.items():
            # Acquire distributed rate limit token for each request
            await acquire_distributed_fmp_token()
            
            try:
                # Add a tiny 0.1s jitter to avoid hammering the FMP API too quickly even under the limit
                await asyncio.sleep(0.1) 
                resp = await client.get(url, timeout=30.0)
                
                if resp.status_code == 200:
                    try:
                        results[key] = resp.json()
                    except:
                        results[key] = None
                elif resp.status_code == 429:
                    # Raise exception to trigger the @async_retry decorator
                    raise Exception(f"FMP Rate Limit Exceeded (429) on {key}")
                else:
                    logger.error(f"FMP {key} failed: {resp.status_code}")
                    results[key] = None
            except Exception as e:
                logger.error(f"FMP {key} error: {e}. Raising exception to trigger retry.")
                raise e
                
    return results

async def fetch_screener_stocks(limit: int = 2000) -> list:
    """
    Fetches a list of active stocks from FMP screener.
    Criteria: Market Cap > 50M, Volume > 10k, Sector = Technology (for now, or broad)
    """
    api_key = os.environ.get("FMP_API_KEY")
    if not api_key:
        return []

    # Broad criteria to get a good universe
    # sector=Technology is just an example, removing it to be broader or keeping it if user wants tech focus.
    # User asked for "top 500 tickers which have high potential", not specific sector. Let's make it broad.
    # But FMP screener might timeout if too broad. Let's try a reasonable filter.
    # Market Cap > 200M (Small Cap+), Vol > 50k.
    
    url = f"https://financialmodelingprep.com/stable/stock-screener?marketCapMoreThan=200000000&volumeMoreThan=50000&limit={limit}&apikey={api_key}"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, timeout=30.0)
            if resp.status_code == 200:
                return resp.json()
            else:
                logger.error(f"FMP Screener failed: {resp.status_code}")
                return []
        except Exception as e:
            logger.error(f"FMP Screener error: {e}")
            return []

async def fetch_active_stocks() -> list:
    """
    Fetches the list of all available traded symbols from FMP.
    Endpoint: /v3/available-traded/list
    """
    api_key = os.environ.get("FMP_API_KEY")
    if not api_key:
        return []
        
    url = f"https://financialmodelingprep.com/stable/actively-trading-list?apikey={api_key}"
    
    async with httpx.AsyncClient() as client:
        try:
            # Short timeout might be risky for large list, but 30s should be enough
            resp = await client.get(url, timeout=30.0)
            if resp.status_code == 200:
                data = resp.json()
                # Data format: [{"symbol": "SPY", "name": "...", "price": 123, "exchange": "..."}, ...]
                return data
            else:
                logger.error(f"FMP Active List failed: {resp.status_code}")
                return []
        except Exception as e:
            logger.error(f"FMP Active List error: {e}")
            return []
