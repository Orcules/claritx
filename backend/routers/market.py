from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Response
from typing import Dict, Any, List
import os
import json
import asyncio
from datetime import datetime
from sqlalchemy import text
from database import get_db_connection
from services.fmp import fmp_limiter, fetch_screener_stocks
import httpx
from services.vertex import analyze_with_vertex

router = APIRouter()

# In-memory lock to prevent multiple concurrent market opportunity scans
_scan_in_progress = False

def _dispatch_background_scan(background_tasks, job_id: str = "bg-scan"):
    """Send market scan to SQS (Lambda) in production, or run as a local bg task."""
    import boto3
    queue_url = os.environ.get("SQS_BACKGROUND_QUEUE_URL")
    if queue_url:
        try:
            sqs = boto3.client("sqs", region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))
            sqs.send_message(
                QueueUrl=queue_url,
                MessageBody=json.dumps({"action": "SCAN_MARKET_OPPORTUNITIES", "job_id": job_id})
            )
            print(f"[Market Scan] Dispatched to SQS BackgroundTasksQueue (job_id={job_id})")
        except Exception as e:
            print(f"[Market Scan] SQS dispatch failed ({e}), falling back to local background task")
            background_tasks.add_task(scan_market_opportunities, job_id)
    else:
        # Local dev: run as FastAPI background task
        background_tasks.add_task(scan_market_opportunities, job_id)
        print(f"[Market Scan] Dispatched as local background task (no SQS_BACKGROUND_QUEUE_URL set)")

POPULAR_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
    "GME", "AMC", "PLTR", "RIVN", "LCID",
    "AMD", "INTC", "CRM", "NFLX", "DIS",
    "JPM", "V", "MA", "COIN", "HOOD",
]

CRYPTO_SYMBOLS = ["BTCUSD", "ETHUSD", "SOLUSD", "XRPUSD", "DOGEUSD"]

CACHE_DURATION_HOURS = 1
CACHE_DURATION_SECONDS = CACHE_DURATION_HOURS * 3600

async def fetch_recent_news(symbol: str, api_key: str) -> List[str]:
    base_url = "https://financialmodelingprep.com/stable"
    url = f"{base_url}/news/stock?symbol={symbol}&limit=3&apikey={api_key}"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, timeout=10.0)
            if resp.status_code == 200:
                news = resp.json()
                return [f"{n.get('title')}: {n.get('text')[:150]}" for n in news if n.get('title')][:2]
        except Exception as e:
            print(f"Error fetching news for {symbol}: {e}")
    return []

async def generate_explanation(symbol: str, name: str, change: float, news: List[str]) -> Dict[str, str]:
    direction = "rose" if change > 0 else "dropped"
    abs_change = abs(change)
    
    prompt = f"""You are a financial news analyst. Based on the following recent news about {name} ({symbol}), write a brief 1-2 sentence explanation for why the stock {direction} {abs_change:.1f}% today.

Recent news:
{chr(10).join(news) if news else "No specific news available"}

Rules:
- Be concise and factual
- Focus on the most likely cause
- Do not give investment advice
- Maximum 50 words

Respond in JSON format:
{{
  "headline": "Short catchy headline",
  "explanation": "Brief explanation"
}}"""

    try:
        # Use existing vertex service
        res_json = await analyze_with_vertex(symbol, prompt)
        if isinstance(res_json, str):
            res_json = json.loads(res_json)
        return res_json
    except Exception as e:
        print(f"AI explanation failed for {symbol}: {e}")
        return {
            "headline": f"{name} {direction} {abs_change:.1f}%",
            "explanation": f"{name} experienced significant movement today."
        }

async def refresh_market_movers() -> dict:
    """Fetch live market data and write to cache. Called by scheduler or worker — never during a user request."""
    api_key = os.environ.get("FMP_API_KEY")
    if not api_key:
        raise RuntimeError("FMP_API_KEY not configured")

    all_symbols = POPULAR_TICKERS + CRYPTO_SYMBOLS
    threshold = 2.0
    all_quotes: List[Dict] = []

    async with httpx.AsyncClient() as client:
        # One batch call for all stock symbols
        try:
            symbols_str = ",".join(all_symbols)
            resp = await client.get(
                f"https://financialmodelingprep.com/stable/quotes/stock?symbols={symbols_str}&apikey={api_key}",
                timeout=15.0,
            )
            if resp.status_code == 200:
                body = resp.json()
                if isinstance(body, list):
                    all_quotes = body
        except Exception as e:
            print(f"[Market Refresh] Batch fetch failed: {e}")

        # Fallback: parallel per-symbol (no retries)
        if not all_quotes:
            async def _fetch_one(sym: str) -> Dict | None:
                try:
                    r = await client.get(
                        f"https://financialmodelingprep.com/stable/quote?symbol={sym}&apikey={api_key}",
                        timeout=6.0,
                    )
                    if r.status_code == 200:
                        b = r.json()
                        if isinstance(b, list) and b:
                            return b[0]
                        if isinstance(b, dict) and b:
                            return b
                except Exception:
                    pass
                return None
            results = await asyncio.gather(*[_fetch_one(s) for s in all_symbols])
            all_quotes = [r for r in results if r is not None]

        # Build movers list
        movers: List[Dict] = []
        for quote in all_quotes:
            symbol = quote.get("symbol", "")
            if not symbol:
                continue
            is_crypto = symbol in CRYPTO_SYMBOLS
            clean_symbol = symbol.replace("USD", "") if is_crypto else symbol
            change_pct = quote.get("changesPercentage") or 0
            change = quote.get("change") or 0
            prev_close = quote.get("previousClose") or 0
            price = quote.get("price") or 0
            if change_pct == 0 and change != 0 and prev_close != 0:
                change_pct = (change / prev_close) * 100
            movers.append({
                "symbol": clean_symbol,
                "name": quote.get("name", clean_symbol),
                "price": price,
                "change": change,
                "changePercent": round(change_pct, 2),
                "isCrypto": is_crypto,
                "isSignificant": abs(change_pct) >= threshold,
            })

        movers.sort(key=lambda x: abs(x["changePercent"]), reverse=True)

        # Parallel headline fetch for top 8 (no AI)
        async def _headline(sym: str) -> str:
            try:
                r = await client.get(
                    f"https://financialmodelingprep.com/stable/news/stock?symbol={sym}&limit=1&apikey={api_key}",
                    timeout=5.0,
                )
                if r.status_code == 200:
                    news = r.json()
                    if news and news[0].get("title"):
                        return news[0]["title"]
            except Exception:
                pass
            return ""

        headlines = await asyncio.gather(*[
            _headline(m["symbol"] + ("USD" if m["isCrypto"] else ""))
            for m in movers[:8]
        ])

    for mover, headline in zip(movers[:8], headlines):
        direction = "rose" if mover["changePercent"] > 0 else "dropped"
        abs_pct = abs(mover["changePercent"])
        mover["headline"] = headline or f"{mover['name']} {direction} {abs_pct:.1f}%"
        mover["briefExplanation"] = f"{mover['name']} {direction} {abs_pct:.1f}% today."

    gainers = sum(1 for m in movers if m["changePercent"] > 0)
    losers = sum(1 for m in movers if m["changePercent"] < 0)
    sentiment = "bullish" if gainers > losers else "bearish" if losers > gainers else "mixed"

    payload = {
        "movers": movers,
        "significantCount": sum(1 for m in movers if m["isSignificant"]),
        "marketOverview": f"Markets are {sentiment} today — {gainers} of {len(movers)} tracked stocks are higher.",
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Write to cache
    try:
        async for conn in get_db_connection():
            await conn.execute(text("""
                INSERT INTO market_movers_cache (id, data, fetched_at)
                VALUES ('latest', :data, NOW())
                ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, fetched_at = NOW()
            """), {"data": json.dumps(payload)})
            await conn.commit()
            break
        print(f"[Market Refresh] Cache updated — {len(movers)} movers")
    except Exception as e:
        print(f"[Market Refresh] Cache write failed: {e}")

    return payload


def _dispatch_market_refresh():
    """Send REFRESH_MARKET_MOVERS to SQS background queue."""
    import boto3
    queue_url = os.environ.get("SQS_BACKGROUND_QUEUE_URL")
    if not queue_url:
        print("[Market Movers] No SQS queue configured — skipping background refresh")
        return
    try:
        sqs = boto3.client("sqs", region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))
        sqs.send_message(QueueUrl=queue_url, MessageBody=json.dumps({"action": "REFRESH_MARKET_MOVERS"}))
        print("[Market Movers] Background refresh dispatched to SQS")
    except Exception as e:
        print(f"[Market Movers] SQS dispatch failed: {e}")


async def _get_market_movers_cached_response(response: Response):
    """
    Always returns from cache. If cache is stale, returns stale data immediately
    and fires a background refresh via SQS — never blocks the user request.
    """
    response.headers["Cache-Control"] = f"public, max-age=300, s-maxage={CACHE_DURATION_SECONDS}, stale-while-revalidate=3600"

    try:
        async for conn in get_db_connection():
            res = await conn.execute(text("SELECT data, fetched_at FROM market_movers_cache WHERE id = 'latest'"))
            row = res.fetchone()
            if row:
                data, fetched_at = row
                age_s = (datetime.utcnow() - fetched_at.replace(tzinfo=None)).total_seconds()
                parsed = json.loads(data) if isinstance(data, str) else data
                if age_s > CACHE_DURATION_SECONDS:
                    # Stale — return it but trigger background refresh
                    _dispatch_market_refresh()
                return parsed
            break
    except Exception as e:
        print(f"[Market Movers] Cache read error: {e}")

    # Cache completely empty — dispatch refresh and return empty
    _dispatch_market_refresh()
    return {"movers": [], "marketOverview": "Market data is loading, please check back shortly.", "timestamp": datetime.utcnow().isoformat()}


@router.get("/market-movers")
async def get_market_movers(response: Response):
    return await _get_market_movers_cached_response(response)


@router.post("/market-movers")
async def post_market_movers(response: Response, request: Dict[str, Any] = None):
    return await _get_market_movers_cached_response(response)

async def scan_market_opportunities(job_id: str = "bg-scan"):
    global _scan_in_progress
    if _scan_in_progress:
        print(f"[Market Scan] Scan already in progress. Skipping duplicate job '{job_id}'.")
        return
    _scan_in_progress = True
    print(f"[Market Scan] Starting scan job '{job_id}'")
    try:
        today = datetime.utcnow().strftime("%B %d, %Y")
        prompt = f"""Today is {today}. You are an expert financial news analyst. Perform a COMPREHENSIVE scan of the latest financial news from ALL major sources including:
- Wire services: Reuters, Bloomberg, AP
- Financial media: CNBC, MarketWatch, Yahoo Finance, WSJ, Financial Times, Barron's, Investor's Business Daily
- Sector-specific: TechCrunch (tech), BioPharma Dive (healthcare), E&E News (energy)
- Earnings & filings: SEC EDGAR recent 8-K filings, earnings surprises

Analyze news from the LAST 48 HOURS and identify 10-15 specific stock tickers that could be POSITIVELY impacted by current events.

For each opportunity, analyze multiple angles:
1. The direct news catalyst (earnings beat, FDA approval, contract win, etc.)
2. Supply chain or sector ripple effects (e.g., if TSMC beats, which chip designers benefit?)
3. Regulatory tailwinds (new legislation, deregulation, subsidies)
4. Macro trends (rate cuts benefiting REITs, dollar weakness benefiting exporters)

For each opportunity provide:
- The specific ticker (well-known, liquid US-listed stocks on NYSE/NASDAQ)
- Company full name
- A detailed explanation of WHY this is an opportunity (2-3 sentences)
- The actual news headline or event driving it
- The original news source
- Opportunity score 1-10 based on: catalyst strength (40%), timing (30%), risk/reward (30%)
- Relevant sector
- Expected timeframe: "short-term" (days-weeks), "medium-term" (weeks-months), "long-term" (months+)

IMPORTANT:
- Focus on POSITIVE catalysts only (earnings beats, new contracts, regulatory approvals, sector tailwinds, analyst upgrades, insider buying, technical breakouts)
- This is NOT investment advice - it's educational news analysis
- Be SPECIFIC about the news event - cite real headlines, dates, and numbers
- Include the source of each news item
- Diversify across sectors - don't cluster in one industry
- Include at least 2-3 lesser-known mid-cap opportunities alongside large-caps

Return ONLY a JSON array (no markdown, no explanation):
[
  {{
    "symbol": "TICKER",
    "name": "Company Name",
    "reason": "Detailed 2-3 sentence explanation of the positive catalyst and why it matters",
    "newsHeadline": "Actual headline or summary of the specific news event",
    "source": "News source name",
    "opportunityScore": 8,
    "sector": "Technology",
    "timeframe": "short-term"
  }}
]"""

        res = await analyze_with_vertex("MARKET_OPPS", prompt)
        opportunities = []
        
        if isinstance(res, str):
            try:
                opportunities = json.loads(res.strip())
            except json.JSONDecodeError:
                import re
                json_match = re.search(r'\[[\s\S]*\]', res)
                if json_match:
                    opportunities = json.loads(json_match.group(0))
        elif isinstance(res, list):
            opportunities = res

        valid_opps = [
            o for o in opportunities
            if o.get("symbol") and o.get("name") and o.get("reason") and o.get("opportunityScore", 0) >= 1
        ]
        valid_opps.sort(key=lambda x: x.get("opportunityScore", 0), reverse=True)
        valid_opps = valid_opps[:15]

        print(f"Found {len(valid_opps)} market opportunities via Vertex.")

        if valid_opps:
            async for conn in get_db_connection():
                await conn.execute(text("""
                    INSERT INTO market_opportunities (opportunities, scanned_at, expires_at)
                    VALUES (:opps, NOW(), NOW() + INTERVAL '12 hours')
                """), {"opps": json.dumps(valid_opps)})
                await conn.commit()
                break
    except Exception as e:
        import traceback
        err_msg = f"Failed to scan market opportunities: {e}"
        tb_str = traceback.format_exc()
        print(f"Market Ops Error: {err_msg}")
        print(f"Traceback: {tb_str}")
        
        try:
            async for conn in get_db_connection():
                await conn.execute(text("""
                    INSERT INTO activity_logs (
                        session_id, type, category, message, details, 
                        duration, status, correlation_id
                    ) VALUES (
                        'bg-scan', 'background_job', 'scan_market_opportunities', :msg, :details, 
                        0, 'error', :corr_id
                    )
                """), {
                    "msg": err_msg,
                    "details": json.dumps({"error": str(e), "traceback": tb_str}),
                    "corr_id": job_id
                })
                await conn.commit()
                break
        except Exception as log_err:
            print(f"Failed to save error log for market ops: {log_err}")
    finally:
        _scan_in_progress = False
        print(f"[Market Scan] Scan job '{job_id}' finished, lock released.")

@router.get("/market-opportunities")
async def get_market_opportunities(background_tasks: BackgroundTasks, refresh: bool = False):
    async for conn in get_db_connection():
        if not refresh:
            # Try to get fresh (non-expired) data first
            res = await conn.execute(text("SELECT opportunities, scanned_at FROM market_opportunities WHERE expires_at > NOW() ORDER BY scanned_at DESC LIMIT 1"))
            row = res.fetchone()
            if row:
                return {"opportunities": row[0], "scanned_at": row[1].isoformat()}
        
        # Check for stale data to show while scanning
        res_stale = await conn.execute(text("SELECT opportunities, scanned_at FROM market_opportunities ORDER BY scanned_at DESC LIMIT 1"))
        stale_row = res_stale.fetchone()

        # Only start a new scan if one isn't already running
        if not _scan_in_progress:
            _dispatch_background_scan(background_tasks, "bg-scan")
        else:
            print("[Market Scan] Scan already in progress - not queuing another.")
        
        if stale_row and stale_row[0]:
            return {
                "opportunities": stale_row[0],
                "scanned_at": stale_row[1].isoformat(),
                "is_stale": True,
                "is_scanning": _scan_in_progress
            }
        
        return {"status": "scanning", "message": "Market scan started in background", "opportunities": []}
