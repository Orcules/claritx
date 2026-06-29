from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
import json
from sqlalchemy import text
from database import get_db_connection
from auth import verify_token
from models import LogEntryModel

router = APIRouter()

@router.post("/activity-logs")
async def create_logs(logs: List[LogEntryModel], claims: Dict = Depends(verify_token)):
    """
    Inserts activity log entries (Bulk).
    """
    if not logs:
        return {"status": "success", "count": 0}

    try:
        async for conn in get_db_connection():
            for log in logs:
                await conn.execute(text("""
                    INSERT INTO activity_logs (
                        session_id, type, category, message, details, 
                        duration, status, request_body, response_preview, correlation_id
                    ) VALUES (
                        :session_id, :type, :category, :message, :details, 
                        :duration, :status, :request_body, :response_preview, :correlation_id
                    )
                """), {
                    "session_id": log.session_id,
                    "type": log.type,
                    "category": log.category,
                    "message": log.message,
                    "details": json.dumps(log.details) if log.details else None,
                    "duration": log.duration,
                    "status": log.status,
                    "request_body": json.dumps(log.request_body) if log.request_body else None,
                    "response_preview": log.response_preview,
                    "correlation_id": log.correlation_id
                })
            await conn.commit()
            return {"status": "success", "count": len(logs)}
            break
    except Exception as e:
        print(f"CRITICAL LOG ERROR: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database Insertion Failed: {str(e)}")

@router.get("/activity-logs")
async def get_logs(claims: Dict = Depends(verify_token)):
    """
    Returns last 100 logs.
    """
    try:
        async for conn in get_db_connection():
            res = await conn.execute(text("""
                SELECT id, session_id, type, category, message, details, 
                       duration, status, request_body, response_preview, 
                       correlation_id, created_at
                FROM activity_logs
                ORDER BY created_at DESC
                LIMIT 100
            """))
            rows = res.fetchall()
            logs = []
            for r in rows:
                logs.append({
                    "id": str(r[0]),
                    "session_id": r[1],
                    "type": r[2],
                    "category": r[3],
                    "message": r[4],
                    "details": r[5],
                    "duration": r[6],
                    "status": r[7],
                    "request_body": r[8],
                    "response_preview": r[9],
                    "correlation_id": r[10],
                    "created_at": r[11].isoformat()
                })
            return logs
            break
    except Exception as e:
        print(f"Error fetching logs: {e}")
        return []
