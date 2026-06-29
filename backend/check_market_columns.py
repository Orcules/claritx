from sqlalchemy import create_async_engine, text
import asyncio
import os
from pathlib import Path

async def check():
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ[k] = v.strip('"')

    url = os.environ.get("DATABASE_URL").replace("postgresql://", "postgresql+asyncpg://")
    engine = create_async_engine(url)
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'market_opportunities'"))
        for row in res:
            print(f"{row[0]}: {row[1]}")
    await engine.dispose()

asyncio.run(check())
