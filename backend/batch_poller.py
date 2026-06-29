import asyncio
import json
import os
import logging
import psycopg2
from services.batch import check_and_process_batch_results, reconcile_stuck_staging_jobs

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    """CloudWatch Events / EventBridge scheduled handler."""
    logger.info("Batch Poller triggered.")
    
    conn_url = os.environ.get("DATABASE_URL")
    if not conn_url:
        logger.error("No DATABASE_URL configured.")
        return {"statusCode": 500, "body": "No DATABASE_URL"}
    
    # Run loop for async tasks
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        # 0. Reconcile stuck staging jobs first
        try:
            from database import engine as _engine, parse_json
            engine = _engine
            
            async def run_reconciliation():
                async with engine.connect() as conn:
                    return await reconcile_stuck_staging_jobs(conn)
            
            rec_result = loop.run_until_complete(run_reconciliation())
            logger.info(f"Reconciliation result: {rec_result}")
            loop.run_until_complete(engine.dispose())
        except Exception as e:
            logger.error(f"Reconciliation failed in poller: {e}")

        # 1. Find pending batch jobs...
        with psycopg2.connect(conn_url) as db_conn:
            with db_conn.cursor() as cur:
                cur.execute("""
                    SELECT id, status, created_at 
                    FROM batch_jobs 
                    WHERE status NOT IN ('processed', 'JOB_STATE_FAILED', 'error', 'CANCELLED', 'JOB_STATE_CANCELLED')
                      AND id LIKE 'projects/%'
                      AND created_at > NOW() - INTERVAL '48 hours'
                    ORDER BY created_at DESC
                """)
                pending_jobs = cur.fetchall()
        
        if not pending_jobs:
            loop.close()
            logger.info("No pending batch jobs found.")
            return {"statusCode": 200, "body": "No pending jobs"}
        
        logger.info(f"Found {len(pending_jobs)} pending batch job(s): {[j[0][:60] for j in pending_jobs]}")
        
        # 2. Check each job's status via Vertex AI
        results = []
        for job_id, current_status, created_at in pending_jobs:
            try:
                logger.info(f"Polling batch job: {job_id} (current status: {current_status})")
                result = loop.run_until_complete(check_and_process_batch_results(job_id))
                status = result.get("status", "unknown")
                logger.info(f"Job {job_id[:60]}: {status}")
                results.append({"job_id": job_id, "result": status})
                
                if status == "processed":
                    logger.info(f"Job {job_id[:60]} processed successfully!")
                    
            except Exception as e:
                logger.error(f"Error polling job {job_id[:60]}: {e}")
                results.append({"job_id": job_id, "error": str(e)})
        
        loop.close()
        
        return {
            "statusCode": 200,
            "body": json.dumps({"polled": len(pending_jobs), "results": results})
        }
        
    except Exception as e:
        logger.error(f"Batch Poller failed: {e}", exc_info=True)
        return {"statusCode": 500, "body": str(e)}
