from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import Dict, Any, List, Optional
import os
import json
import asyncio
import uuid
from datetime import datetime
from sqlalchemy import text
from database import get_db_connection
from auth import verify_token, verify_admin
from services.vertex import analyze_with_vertex, generate_image_with_vertex
import httpx

router = APIRouter()

@router.get("/deep-search-jobs")
async def list_deep_search_jobs(limit: int = 50, claims: Dict = Depends(verify_admin)):
    """
    Lists recent deep search jobs (for admin review).
    """
    try:
        async for conn in get_db_connection():
            res = await conn.execute(text("""
                SELECT id, topic, status, progress_pct, created_at, updated_at 
                FROM deep_search_jobs 
                ORDER BY created_at DESC 
                LIMIT :limit
            """), {"limit": limit})
            return {"success": True, "jobs": [dict(row) for row in res.mappings().all()]}
    except Exception as e:
        return {"success": False, "error": str(e)}

class ResearchGoal(Dict):
    id: str
    type: str
    description: str
    status: str

async def append_log(conn, job_id: str, message: str):
    ts = datetime.utcnow().strftime("%H:%M:%S")
    log_msg = f"[{ts}] {message}"
    await conn.execute(text("""
        UPDATE deep_search_jobs 
        SET progress_logs = progress_logs || CAST(:log AS jsonb),
            updated_at = NOW()
        WHERE id = :id
    """), {"log": json.dumps([log_msg]), "id": job_id})
    await conn.commit()

async def dispatch_worker(job_id: str, action: str = "DEEP_SEARCH_EXECUTE"):
    queue_url = os.environ.get("SQS_BACKGROUND_QUEUE_URL")
    if not queue_url:
        # If no queue, we can't chain effectively in background, but this is mainly for AWS
        return False
    try:
        import boto3
        from botocore.config import Config
        sqs = boto3.client("sqs", 
                           region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
                           config=Config(connect_timeout=2, read_timeout=2, retries={'max_attempts': 1}))
        sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps({"action": action, "job_id": job_id})
        )
        return True
    except Exception as e:
        print(f"[DeepSearch] Failed to dispatch chain: {e}")
        return False

async def deep_search_worker_task(job_id: str):
    async for conn in get_db_connection():
        # Fetch job state
        res = await conn.execute(text("""
            SELECT topic, goals, outline, status, updated_at, current_step, findings, result 
            FROM deep_search_jobs WHERE id = :id
        """), {"id": job_id})
        job = res.fetchone()
        if not job:
            return

        topic, goals, outline, status, updated_at, current_step, findings, result = job
        findings = findings or []
        current_step = current_step or 0
        
        # Guard: Only allow retry if status is running/pending
        if status == 'completed' or status == 'failed':
            return
        
        # 1. Start / Initialization
        if status == 'pending':
            await conn.execute(text("UPDATE deep_search_jobs SET status = 'running', progress_pct = 5, current_step = 0 WHERE id = :id"), {"id": job_id})
            await conn.commit()
            await append_log(conn, job_id, f"Initializing research pipeline for '{topic}'")
            # Immediately re-dispatch to start goal processing
            await dispatch_worker(job_id)
            return

        # 2. Process Goals (One by One)
        if current_step < len(goals):
            goal = goals[current_step]
            goal_desc = goal.get("description")
            await append_log(conn, job_id, f"🔍 Researching goal {current_step+1}/{len(goals)}: {goal_desc[:60]}...")
            
            try:
                prompt = f"Research the following for a financial blog post about '{topic}':\nGOAL: {goal_desc}\nProvide comprehensive info from recent reliable sources with citations."
                finding_content = await analyze_with_vertex(topic, prompt, use_search=True)
                
                new_finding = {
                    "goalId": goal.get("id"),
                    "content": finding_content,
                    "sources": [], 
                    "qualityScore": 8.5
                }
                findings.append(new_finding)
                
                pct = 10 + int(((current_step + 1) / len(goals)) * 50)
                await conn.execute(text("""
                    UPDATE deep_search_jobs 
                    SET progress_pct = :pct, findings = :findings, current_step = :next_step, updated_at = NOW()
                    WHERE id = :id
                """), {"pct": pct, "findings": json.dumps(findings), "next_step": current_step + 1, "id": job_id})
                await conn.commit()
                
                await append_log(conn, job_id, f"  → Goal {current_step+1} complete.")
                # Re-dispatch for next goal
                await dispatch_worker(job_id)
                return
            except Exception as e:
                print(f"Goal research failed: {e}")
                error_msg = f"Research failed at goal {current_step+1}: {str(e)}"
                await conn.execute(text("UPDATE deep_search_jobs SET status = 'failed', error_message = :err WHERE id = :id"), 
                                {"err": error_msg, "id": job_id})
                await conn.commit()
                await append_log(conn, job_id, f"❌ {error_msg}")
                return

        # 3. All Goals Done - Composition Phase
        if status == 'running' and current_step >= len(goals):
            await append_log(conn, job_id, "📝 All research gathered. Composing final report...")
            await conn.execute(text("UPDATE deep_search_jobs SET status = 'composing', progress_pct = 70 WHERE id = :id"), {"id": job_id})
            await conn.commit()
            
            try:
                compose_prompt = f"""Compose a comprehensive, 2000-word financial research-grade blog post about '{topic}' based on these findings:
                {json.dumps(findings)}
                Outline: {json.dumps(outline)}
                Return a JSON object with: title, slug, excerpt, content, tags, metaDescription, readTime, imagePrompt."""
                
                blog_raw = await analyze_with_vertex(topic, compose_prompt, use_search=False)
                
                # PARSING logic
                blog_data = {}
                try:
                    if isinstance(blog_raw, str):
                        clean_content = blog_raw.strip()
                        if "```json" in clean_content: clean_content = clean_content.split("```json")[1].split("```")[0].strip()
                        elif "```" in clean_content: clean_content = clean_content.split("```")[1].split("```")[0].strip()
                        blog_data = json.loads(clean_content)
                    else:
                        blog_data = blog_raw
                except:
                    # Fallback if AI output is messy
                    blog_data = {"content": str(blog_raw), "title": topic, "slug": topic.lower().replace(" ","-"), "imagePrompt": f"Financial visualization for {topic}", "excerpt": "Deep research analysis"}

                # Ensure defaults
                for key in ["tags", "sources", "readTime"]:
                    if key not in blog_data: 
                        blog_data[key] = [] if key != "readTime" else 15
                    elif key == "readTime":
                        # Standardize to integer
                        rt_raw = blog_data.get("readTime", 15)
                        try:
                            if isinstance(rt_raw, str):
                                import re
                                m = re.search(r'(\d+)', rt_raw)
                                blog_data[key] = int(m.group(1)) if m else 15
                            else:
                                blog_data[key] = int(rt_raw)
                        except:
                            blog_data[key] = 15

                await conn.execute(text("""
                    UPDATE deep_search_jobs 
                    SET status = 'imaging', progress_pct = 80, result = CAST(:res AS jsonb)
                    WHERE id = :id
                """), {"res": json.dumps({"blog": blog_data}), "id": job_id})
                await conn.commit()
                
                await append_log(conn, job_id, "✅ Composition complete. Moving to visual generation...")
                await dispatch_worker(job_id)
                return
            except Exception as e:
                await append_log(conn, job_id, f"❌ Composition failed: {str(e)}")
                await conn.execute(text("UPDATE deep_search_jobs SET status = 'failed', error_message = :err WHERE id = :id"), {"err": str(e), "id": job_id})
                await conn.commit()
                return

        # 4. Final Phase - Images & Conclusion
        if status == 'imaging':
            try:
                blog_data = result.get("blog")
                if not blog_data: return
                
                await append_log(conn, job_id, "🎨 Generating featured visuals...")
                
                # Generate Hero
                slug = blog_data.get("slug") or str(uuid.uuid4())
                hero_prompt = blog_data.get("imagePrompt")
                hero_url = await generate_image_with_vertex(hero_prompt, slug)
                blog_data["image_url"] = hero_url

                # Generate Inlines
                inline_urls = []
                for i in range(1, 3):
                    await append_log(conn, job_id, f"🖼️ Creating conceptual illustration {i}...")
                    inline_url = await generate_image_with_vertex(f"Conceptual minimalist financial art for {topic}, digital art style, high res", f"{slug}-inline-{i}")
                    if inline_url: inline_urls.append(inline_url)
                
                # Inject images
                content = blog_data.get("content", "")
                if inline_urls and "## " in content:
                    sects = content.split("## ")
                    if len(sects) > 2: sects[1] += f"\n\n![Figure 1]({inline_urls[0]})\n\n"
                    if len(sects) > 4 and len(inline_urls) > 1: sects[3] += f"\n\n![Figure 2]({inline_urls[1]})\n\n"
                    blog_data["content"] = "## ".join(sects)

                # Final Save
                final_result = {
                    "researchStats": {"totalSources": len(findings), "averageQuality": 8.8},
                    "blog": blog_data
                }
                
                await conn.execute(text("""
                    UPDATE deep_search_jobs 
                    SET status = 'completed', progress_pct = 100, result = CAST(:res AS jsonb)
                    WHERE id = :id
                """), {"res": json.dumps(final_result), "id": job_id})
                await conn.commit()
                await append_log(conn, job_id, "🚀 Deep Research fully complete!")
                
            except Exception as e:
                await append_log(conn, job_id, f"⚠️ Partial success (visuals failed): {str(e)}")
                await conn.execute(text("UPDATE deep_search_jobs SET status = 'completed', progress_pct = 100 WHERE id = :id"), {"id": job_id})
                await conn.commit()
            return

        break

@router.post("/deep-search-plan")
async def generate_plan(request: Dict[str, Any], background_tasks: BackgroundTasks, claims: Dict = Depends(verify_token)):
    user_id = claims.get("sub")
    topic = request.get("topic")
    if not topic:
        raise HTTPException(status_code=400, detail="Topic is required")

    job_id = str(uuid.uuid4())
    
    async for conn in get_db_connection():
        # Create a job with 'pending' status
        await conn.execute(text("""
            INSERT INTO deep_search_jobs (id, topic, goals, status, progress_pct, progress_logs)
            VALUES (:id, :topic, '[]'::jsonb, 'pending', 0, '[]'::jsonb)
        """), {"id": job_id, "topic": topic})
        await conn.commit()
        break
        
    queue_url = os.environ.get("SQS_BACKGROUND_QUEUE_URL")
    if queue_url:
        try:
            import boto3
            from botocore.config import Config
            # Use short timeout for SQS dispatch to avoid API block
            sqs = boto3.client("sqs", 
                               region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
                               config=Config(connect_timeout=2, read_timeout=2, retries={'max_attempts': 1}))
            
            # Wrap in awaitable for compatibility or just run it
            def dispatch():
                return sqs.send_message(
                    QueueUrl=queue_url,
                    MessageBody=json.dumps({"action": "DEEP_SEARCH_PLAN", "job_id": job_id})
                )
            
            # Use executor to avoid blocking the main event loop
            loop = asyncio.get_event_loop()
            await asyncio.wait_for(loop.run_in_executor(None, dispatch), timeout=5.0)
            print(f"[DeepSearch] Dispatched plan generation for {job_id} to SQS")
        except Exception as e:
            print(f"[DeepSearch] SQS dispatch failed for plan ({e}), falling back to local background task")
            background_tasks.add_task(deep_search_plan_worker_task, job_id)
    else:
        background_tasks.add_task(deep_search_plan_worker_task, job_id)
        
    return {"success": True, "jobId": job_id}

async def deep_search_plan_worker_task(job_id: str):
    async for conn in get_db_connection():
        # Fetch job
        res = await conn.execute(text("SELECT topic, status, updated_at FROM deep_search_jobs WHERE id = :id"), {"id": job_id})
        job = res.fetchone()
        if not job:
            return
        
        topic, status, updated_at = job
        
        # If 'planning' but no update for 10 mins, allow retry
        is_stale = status == 'planning' and (datetime.utcnow() - updated_at.replace(tzinfo=None)).total_seconds() > 600
        if status in ['pending_approval', 'completed'] or (status == 'planning' and not is_stale):
             print(f"[DeepSearch] Plan for {job_id} already active or done. status={status}")
             return
        
        # Mark as planning to prevent duplicate execution
        await conn.execute(text("UPDATE deep_search_jobs SET status = 'planning' WHERE id = :id"), {"id": job_id})
        await conn.commit()
        await append_log(conn, job_id, f"Generating research plan for: {topic}")
        
        prompt = f"""Create a comprehensive research plan for a financial blog post.
TOPIC: "{topic}"
Generate 4-6 specific goals tagged as [RESEARCH] or [DELIVERABLE].
Also provide a suggested outline.
Respond in JSON format with 'goals' (id, type, description) and 'suggestedOutline' (list of strings)."""

        try:
            plan_res = await analyze_with_vertex("PLAN", prompt, use_search=True)
            if isinstance(plan_res, str):
                # Clean JSON if AI wrapped it in markdown
                clean_res = plan_res.strip()
                if clean_res.startswith("```json"):
                    clean_res = clean_res.split("```json")[1].split("```")[0].strip()
                elif clean_res.startswith("```"):
                    clean_res = clean_res.split("```")[1].split("```")[0].strip()
                plan = json.loads(clean_res)
            else:
                plan = plan_res
            
            # Add IDs to goals if missing
            goals = []
            for g in plan.get("goals", []):
                goals.append({
                    "id": g.get("id") or str(uuid.uuid4()),
                    "type": g.get("type") or "RESEARCH",
                    "description": g.get("description") or "Research details",
                    "status": "pending"
                })
            
            await conn.execute(text("""
                UPDATE deep_search_jobs 
                SET goals = :goals, outline = :outline, status = 'pending_approval', progress_pct = 100
                WHERE id = :id
            """), {
                "id": job_id,
                "goals": json.dumps(goals),
                "outline": json.dumps(plan.get("suggestedOutline", []))
            })
            await conn.commit()
            await append_log(conn, job_id, "Research plan ready for approval")
            
        except Exception as e:
            await conn.execute(text("UPDATE deep_search_jobs SET status = 'failed', error_message = :err WHERE id = :id"), 
                            {"err": str(e), "id": job_id})
            await conn.commit()
            await append_log(conn, job_id, f"Plan generation failed: {str(e)}")
        
        break

@router.post("/deep-search-execute")
async def execute_search(request: Dict[str, Any], background_tasks: BackgroundTasks, claims: Dict = Depends(verify_token)):
    user_id = claims.get("sub")
    topic = request.get("topic")
    goals = request.get("goals")
    outline = request.get("outline")
    
    if not topic or not goals:
        raise HTTPException(status_code=400, detail="Topic and goals are required")

    async for conn in get_db_connection():
        # 1. Check & Deduct Credits
        cost = 1
        res = await conn.execute(text(
            "SELECT (monthly_credits + bonus_credits - credits_used_this_period) as remaining "
            "FROM user_credits WHERE user_id = :uid FOR UPDATE"
        ), {"uid": user_id})
        row = res.fetchone()

        # We no longer block if credits are insufficient, but we still deduct.
        # if not row or row[0] < cost:
        #    raise HTTPException(status_code=402, detail=f"Insufficient credits. 1 credit required for Deep Search. You have {row[0] if row else 0}.")

        await conn.execute(text("UPDATE user_credits SET credits_used_this_period = credits_used_this_period + :cost WHERE user_id = :uid"), {"cost": cost, "uid": user_id})
        await conn.execute(text("INSERT INTO credit_transactions (user_id, amount, action) VALUES (:uid, :amount, 'deep-search')"), {"uid": user_id, "amount": -cost})

        # 2. Create Job
        job_id = str(uuid.uuid4())
        await conn.execute(text("""
            INSERT INTO deep_search_jobs (id, topic, goals, outline, status, progress_pct)
            VALUES (:id, :topic, :goals, :outline, 'pending', 0)
        """), {
            "id": job_id,
            "topic": topic,
            "goals": json.dumps(goals),
            "outline": json.dumps(outline),
        })
        await conn.commit()
        break
        
    queue_url = os.environ.get("SQS_BACKGROUND_QUEUE_URL")
    if queue_url:
        try:
            import boto3
            from botocore.config import Config
            sqs = boto3.client("sqs", 
                               region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
                               config=Config(connect_timeout=2, read_timeout=2, retries={'max_attempts': 1}))
            
            def dispatch():
                return sqs.send_message(
                    QueueUrl=queue_url,
                    MessageBody=json.dumps({"action": "DEEP_SEARCH_EXECUTE", "job_id": job_id})
                )
                
            loop = asyncio.get_event_loop()
            await asyncio.wait_for(loop.run_in_executor(None, dispatch), timeout=5.0)
            print(f"[DeepSearch] Dispatched job {job_id} to SQS BackgroundTasksQueue")
        except Exception as e:
            print(f"[DeepSearch] SQS dispatch failed ({e}), falling back to local background task")
            background_tasks.add_task(deep_search_worker_task, job_id)
    else:
        background_tasks.add_task(deep_search_worker_task, job_id)

    return {"success": True, "jobId": job_id}

@router.post("/deep-search-job-status")
@router.get("/deep-search-job-status")
async def get_job_status(request: Dict[str, Any] = None, jobId: Optional[str] = None):
    # Try to get jobId from body first, then query param
    jid = None
    if request and "jobId" in request:
        jid = request["jobId"]
    elif jobId:
        jid = jobId
    
    if not jid:
        raise HTTPException(status_code=400, detail="jobId is required")

    async for conn in get_db_connection():
        res = await conn.execute(text("SELECT status, progress_pct, progress_logs, result, error_message, topic, goals, outline FROM deep_search_jobs WHERE id = :id"), {"id": jid})
        row = res.fetchone()
        if not row:
            return {"success": False, "error": "Job not found"}
            
        status, progress_pct, logs, result, error, topic, goals, outline = row
        return {
            "success": True,
            "job": {
                "status": status,
                "progress_pct": progress_pct,
                "progress_logs": logs,
                "result": result,
                "error_message": error,
                "topic": topic,
                "goals": goals,
                "outline": outline
            }
        }
