"""
Migration: Create whatsapp_subscribers table
Run once against the production DB:
  python3 backend/migrations/add_whatsapp_subscribers.py
"""
import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from sqlalchemy.pool import NullPool

DATABASE_URL = os.environ.get("DATABASE_URL", "").replace("postgresql://", "postgresql+asyncpg://")


async def main():
    engine = create_async_engine(DATABASE_URL, echo=True, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS whatsapp_subscribers (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id     UUID,
                phone       TEXT NOT NULL UNIQUE,
                name        TEXT,
                active      BOOLEAN NOT NULL DEFAULT TRUE,
                created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_wa_subscribers_user
            ON whatsapp_subscribers (user_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_wa_subscribers_active
            ON whatsapp_subscribers (active) WHERE active = TRUE;
        """))
    print("✅ whatsapp_subscribers table created successfully.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
