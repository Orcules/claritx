import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def create_table():
    database_url = os.environ.get("DATABASE_URL", "").replace("postgresql://", "postgresql+asyncpg://")
    engine = create_async_engine(database_url)
    
    async with engine.connect() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS blog_jobs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR(255) NOT NULL,
                topic TEXT NOT NULL,
                count INTEGER DEFAULT 1,
                status TEXT NOT NULL DEFAULT 'pending',
                progress_pct INTEGER DEFAULT 0,
                progress_logs JSONB DEFAULT '[]'::JSONB,
                result JSONB,
                error_message TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """))
        await conn.commit()
    print("Table blog_jobs created or already exists.")

if __name__ == "__main__":
    asyncio.run(create_table())
