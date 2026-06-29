from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy import text
from database import get_db_connection
from auth import verify_admin
from services.batch import run_batch_job_flow, check_and_process_batch_results, submit_google_batch_job_from_staged_prompts

router = APIRouter(prefix="/batch-job", tags=["batch"])

class BatchJobRequest(BaseModel):
    limit: int = 100
    asset_type: str = "stock"
    provider: str = "kie_direct"

class BatchProcessRequest(BaseModel):
    batch_id: str

@router.post("")
async def start_batch_job(
    req: BatchJobRequest,
    admin: dict = Depends(verify_admin),
    conn = Depends(get_db_connection)
):
    """
    Starts a new batch analysis job.
    """
    try:
        result = await run_batch_job_flow(
            limit=req.limit,
            asset_type=req.asset_type,
            provider=req.provider,
            conn=conn
        )
        return result
    except Exception as e:
        print(f"Error starting batch job: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/process")
async def process_batch(
    req: BatchProcessRequest,
    admin: dict = Depends(verify_admin),
    conn = Depends(get_db_connection)
):
    """
    Manually triggers processing of a batch job's results.
    """
    try:
        result = await check_and_process_batch_results(req.batch_id)
        return result
    except Exception as e:
        print(f"Error processing batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/submit-google-batch")
async def submit_google_batch(
    req: BatchProcessRequest,
    admin: dict = Depends(verify_admin),
    conn = Depends(get_db_connection)
):
    """
    Emergency override to submit a staged Google Batch job.
    """
    try:
        # Fetch staged prompts from DB
        query = text("SELECT prompt_json FROM batch_job_prompts WHERE batch_id = :batch_id")
        result = await conn.execute(query, {"batch_id": req.batch_id})
        prompts = [row[0] for row in result.fetchall()]
        
        if not prompts:
            raise HTTPException(status_code=404, detail="No staged prompts found for this batch ID")
            
        result = await submit_google_batch_job_from_staged_prompts(req.batch_id, prompts, conn)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error submitting Google batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Note: The UI calls GET /batch-jobs (plural)
@router.get("s")
async def list_batch_jobs(
    admin: dict = Depends(verify_admin),
    conn = Depends(get_db_connection)
):
    """
    Lists recent batch jobs.
    """
    try:
        query = text("""
            SELECT id, status, gcs_input_uri, gcs_output_uri, created_at, 
                   completed_at, item_count, target_count, asset_type
            FROM batch_jobs
            ORDER BY created_at DESC
            LIMIT 50
        """)
        result = await conn.execute(query)
        rows = result.mappings().all()
        return [dict(row) for row in rows]
    except Exception as e:
        print(f"Error listing batch jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))
