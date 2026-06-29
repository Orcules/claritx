import os
import json
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from sqlalchemy.pool import NullPool
from sqlalchemy.dialects.postgresql.asyncpg import PGDialect_asyncpg

# Register JSON/JSONB codecs using known OIDs directly on connection settings.
# This avoids _introspect_type which uses prepared statements (fails through RDS Proxy).
# OIDs: json=114, jsonb=3802 (stable PostgreSQL built-in OIDs)
def _json_encoder(v):
    if isinstance(v, str):
        return v
    return json.dumps(v)

def _json_decoder(v):
    if v is None:
        return None
    if isinstance(v, (dict, list)):
        return v
    return json.loads(v)

async def _setup_json_codecs(self, conn):
    settings = conn._connection.get_settings()
    settings.add_python_codec(
        114, 'json', 'pg_catalog', (), 'scalar',
        _json_encoder, _json_decoder, 'text'
    )
    settings.add_python_codec(
        3802, 'jsonb', 'pg_catalog', (), 'scalar',
        _json_encoder, _json_decoder, 'text'
    )

PGDialect_asyncpg.setup_asyncpg_json_codec = _setup_json_codecs
PGDialect_asyncpg.setup_asyncpg_jsonb_codec = _setup_json_codecs

# --- Database Setup ---
database_url = os.environ.get("DATABASE_URL", "").replace("postgresql://", "postgresql+asyncpg://")

is_lambda = os.environ.get("AWS_LAMBDA_FUNCTION_NAME") is not None

if database_url:
    engine = create_async_engine(
        database_url,
        echo=not is_lambda,
        poolclass=NullPool,
        pool_pre_ping=True,
        connect_args={
            "prepared_statement_cache_size": 0,
            "statement_cache_size": 0,
        },
    )
else:
    engine = None


def parse_json(value):
    """Parse a JSONB value that may be returned as a string (due to disabled codec)."""
    if value is None:
        return None
    if isinstance(value, str):
        return json.loads(value)
    return value


async def get_db_connection():
    if not engine:
        raise HTTPException(status_code=503, detail="Database not configured")

    async with engine.connect() as conn:
        yield conn
