"""
Daily FMP Screener Cache Lambda.

Fetches the full company-screener from FMP and upserts into screener_cache table.
Triggered once daily by EventBridge cron.
"""
import json
import os
import httpx
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool
from sqlalchemy import text
import asyncio

# Import patches the codec globally
import database  # noqa: F401


async def fetch_and_cache_screener():
    """Fetch all stocks from FMP screener and upsert into DB."""
    api_key = os.environ.get("FMP_API_KEY")
    db_url = os.environ.get("DATABASE_URL", "").replace("postgresql://", "postgresql+asyncpg://")
    
    if not api_key or not db_url:
        print("Missing FMP_API_KEY or DATABASE_URL")
        return {"status": "error", "message": "Missing config"}
    
    base_url = "https://financialmodelingprep.com/stable/company-screener"
    common_params = f"volumeMoreThan=100000&isActivelyTrading=true&apikey={api_key}"
    common_etf_params = f"volumeMoreThan=10000&isActivelyTrading=true&apikey={api_key}"
    
    # 3 separate calls: stocks, ETFs, funds
    screener_urls = [
        (f"{base_url}?isFund=false&isEtf=false&marketCapMoreThan=2000000000&limit=750&{common_params}", "stocks"),
        (f"{base_url}?isEtf=true&marketCapMoreThan=100000000&limit=250&{common_etf_params}", "ETFs"),
        (f"{base_url}?isFund=true&marketCapMoreThan=500000000&limit=250&{common_etf_params}", "funds"),
    ]
    
    all_stocks = []
    async with httpx.AsyncClient(timeout=120.0) as client:
        for url, label in screener_urls:
            print(f"Fetching {label} from FMP...")
            resp = await client.get(url)
            if resp.status_code != 200:
                print(f"FMP screener failed for {label}: {resp.status_code}")
                continue
            data = resp.json()
            if isinstance(data, list):
                all_stocks.extend(data)
                print(f"  Got {len(data)} {label}")
    
    stocks = all_stocks
    
    if not stocks or not isinstance(stocks, list):
        print(f"No screener data fetched")
        return {"status": "error", "message": "No data from FMP"}
    
    print(f"Total fetched: {len(stocks)} (stocks + ETFs + funds)")
    
    # 2. Upsert into screener_cache in batches
    engine = create_async_engine(
        db_url, echo=False, poolclass=NullPool, pool_pre_ping=True,
        connect_args={"prepared_statement_cache_size": 0, "statement_cache_size": 0},
    )
    
    # Auto-create table if it doesn't exist
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS screener_cache (
                symbol VARCHAR(10) PRIMARY KEY,
                data JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))
    
    batch_size = 500
    total_upserted = 0
    
    async with engine.begin() as conn:
        for i in range(0, len(stocks), batch_size):
            batch = stocks[i:i + batch_size]
            
            for stock in batch:
                symbol = stock.get("symbol")
                if not symbol:
                    continue
                    
                await conn.execute(text("""
                    INSERT INTO screener_cache (symbol, data, updated_at)
                    VALUES (:symbol, CAST(:data AS JSONB), NOW())
                    ON CONFLICT (symbol) DO UPDATE
                    SET data = CAST(:data AS JSONB), updated_at = NOW()
                """), {
                    "symbol": symbol,
                    "data": json.dumps(stock)
                })
                total_upserted += 1
            
            print(f"Upserted batch {i // batch_size + 1}: {total_upserted}/{len(stocks)}")
    
    await engine.dispose()
    print(f"Screener cache complete: {total_upserted} symbols cached")
    return {"status": "success", "cached_count": total_upserted}


def handler(event, context):
    """Lambda entry point for EventBridge cron trigger."""
    print(f"Screener cache triggered: {json.dumps(event)}")
    result = asyncio.get_event_loop().run_until_complete(fetch_and_cache_screener())
    print(f"Result: {json.dumps(result)}")
    
    # Trigger 1150-symbol AI analysis batch job automatically after screener finishes
    queue_url = os.environ.get("BATCH_QUEUE_URL") or os.environ.get("SQS_QUEUE_URL")
    if queue_url:
        import boto3
        try:
            sqs = boto3.client('sqs', region_name='us-east-1')
            payload = {
                "action": "START_BATCH_JOB",
                "limit": 1150,
                "asset_type": "stock",
                "auto_process": True,
                "provider": "google_batch"
            }
            sqs.send_message(
                QueueUrl=queue_url,
                MessageBody=json.dumps(payload)
            )
            print("Successfully dispatched daily START_BATCH_JOB to SQS for top 1150 stocks.")
        except Exception as e:
            print(f"Failed to push START_BATCH_JOB to SQS: {e}")
            
    return result

