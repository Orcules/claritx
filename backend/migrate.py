import asyncio
import os
import sys
from sqlalchemy import text

# Add current directory to path so we can import database
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

# Simple .env parser
def load_env_file(path):
    if not os.path.exists(path):
        return
    with open(path, "r") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                key, value = line.strip().split("=", 1)
                os.environ[key] = value

load_env_file(os.path.join(current_dir, ".env"))

from database import get_db_connection

async def apply_migrations():
    print("Applying migrations...")
    
    migrations_dir = os.path.join(current_dir, "migrations")
    migration_files = sorted([f for f in os.listdir(migrations_dir) if f.endswith(".sql")])

    async for conn in get_db_connection():
        for filename in migration_files:
            file_path = os.path.join(migrations_dir, filename)
            print(f"Applying migration: {filename}")
            
            with open(file_path, "r") as f:
                sql = f.read()
                
            # Split SQL into individual statements
            # We use a primitive split on semicolon. 
            # Note: This might fail if semicolons are inside strings/blocks.
            statements = [s.strip() for s in sql.split(";") if s.strip()]
            
            try:
                for statement in statements:
                    if not statement: continue
                    # print(f"Executing statement: {statement[:50]}...")
                    await conn.execute(text(statement))
                await conn.commit()
                print(f"Migration {filename} applied successfully.")
            except Exception as e:
                print(f"Error applying {filename}: {e}")
                await conn.rollback()
                # For IF NOT EXISTS scripts, we can sometimes continue, but usually better to stop
                # sys.exit(1)
        
        print("All migrations processed.")
        break

if __name__ == "__main__":
    asyncio.run(apply_migrations())
