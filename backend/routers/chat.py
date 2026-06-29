import os
import asyncio
import uuid
import json
import boto3
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from auth import verify_token
from database import get_db_connection
from sqlalchemy import text

router = APIRouter()


class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class SectionChatRequest(BaseModel):
    symbol: str
    section_name: str
    section_content: str
    full_context: Optional[str] = None
    messages: List[ChatMessage]


def _build_system_prompt(symbol: str, section_name: str, section_content: str, full_context: Optional[str]) -> str:
    context_block = ""
    if full_context:
        context_block = f"""
FULL ANALYSIS REPORT FOR {symbol}:
{full_context}

---
"""
    return f"""You are an expert financial research assistant helping a user understand a detailed AI-generated stock analysis report for {symbol}.

{context_block}CURRENT SECTION — {section_name.upper()}:
{section_content}

INSTRUCTIONS:
- Answer questions using the analysis above as your primary source of truth.
- You also have access to Google Search — use it to find the latest news, price movements, earnings, or any recent developments about {symbol} that may not be in the analysis.
- When citing a specific number from the analysis (price target, margin, etc.) include it clearly.
- Keep responses concise but complete. Use bullet points for clarity when helpful.
- If the user asks something not covered by the analysis, search the web and state clearly that you retrieved fresh data.
- Do NOT give personalised investment advice. Always remind users this is for educational purposes.
- Respond in the same language the user writes in."""


async def _call_vertex_chat(system_prompt: str, history: List[ChatMessage], user_message: str) -> str:
    """
    Calls Vertex AI Gemini with Google Search grounding.

    Key implementation notes (from google-genai SDK docs):
    - Must use vertexai=True + ADC credentials (not api_key=)
    - location must be "us-central1", NOT "global", for Google Search grounding to work
    - Use types.Content / types.Part for proper multi-turn conversation format
    - Use types.Tool(google_search=types.GoogleSearch()) for search grounding
    """
    from google import genai
    from google.genai import types
    from google.genai.types import HttpOptions
    from utils.gcp import get_gcp_credentials

    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        return "AI unavailable: missing GOOGLE_CLOUD_PROJECT environment variable."

    # Load GCP credentials (Secrets Manager → env var → bundled file)
    cred_path = get_gcp_credentials()
    if not cred_path:
        print("[Chat] Warning: GCP credentials not found, trying ADC")

    # us-central1 required for Google Search grounding — "global" does NOT support it
    client = genai.Client(
        vertexai=True,
        project=project_id,
        location="global",
        http_options=HttpOptions(api_version="v1", timeout=25000),
    )

    # Build typed conversation history (role must be "user" or "model", NOT "assistant")
    contents: list[types.Content] = []
    for msg in history:
        role = "user" if msg.role == "user" else "model"
        contents.append(
            types.Content(role=role, parts=[types.Part(text=msg.content)])
        )
    # Add the new user message
    contents.append(
        types.Content(role="user", parts=[types.Part(text=user_message)])
    )

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        tools=[types.Tool(google_search=types.GoogleSearch())],
        temperature=0.4,
    )

    try:
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model="gemini-3-flash-preview",
                contents=contents,
                config=config,
            ),
            timeout=60.0,
        )
        return response.text or ""
    except asyncio.TimeoutError:
        print("[Chat] Vertex timed out. Falling back to Gemini.")
    except Exception as e:
        print(f"[Chat] Vertex error: {type(e).__name__}: {e}")


async def chat_section_worker_task(job_id: str, payload: dict):
    from database import engine
    if engine is None:
        print(f"[Chat Worker] Error: Database engine not initialized for job {job_id}")
        return

    async with engine.connect() as conn:
        try:
            req = SectionChatRequest(**payload)
            system_prompt = _build_system_prompt(
                symbol=req.symbol,
                section_name=req.section_name,
                section_content=req.section_content,
                full_context=req.full_context,
            )

            user_message = req.messages[-1].content
            history = req.messages[:-1]

            content = await _call_vertex_chat(system_prompt, history, user_message)
            
            await conn.execute(text("UPDATE chat_jobs SET status = 'completed', content = :content, updated_at = CURRENT_TIMESTAMP WHERE id = :id"), {"content": content, "id": job_id})
            await conn.commit()
        except Exception as e:
            await conn.execute(text("UPDATE chat_jobs SET status = 'failed', error_message = :err, updated_at = CURRENT_TIMESTAMP WHERE id = :id"), {"err": str(e), "id": job_id})
            await conn.commit()
            print(f"[Chat Worker] Failed job {job_id}: {e}")


@router.post("/chat/section")
async def section_chat(
    req: SectionChatRequest,
    background_tasks: BackgroundTasks,
    claims: dict = Depends(verify_token),
    conn = Depends(get_db_connection),
):
    """
    Creates a chat job and dispatches to SQS or BackgroundTasks.
    Free tier: 1 credit per message. Pro: unlimited.
    """
    if not req.messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    user_id = claims.get("sub", "anonymous") if isinstance(claims, dict) else "anonymous"

    job_id = str(uuid.uuid4())

    try:
        await conn.execute(text("""
            INSERT INTO chat_jobs (id, status, created_at, updated_at)
            VALUES (:id, 'running', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """), {"id": job_id})
        await conn.commit()
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail="Failed to initialize chat job")

    queue_url = os.environ.get("SQS_BACKGROUND_QUEUE_URL")
    if queue_url:
        try:
            sqs = boto3.client("sqs", region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))
            sqs.send_message(
                QueueUrl=queue_url,
                MessageBody=json.dumps({"action": "CHAT_SECTION", "job_id": job_id, "payload": req.dict()})
            )
        except Exception as e:
            print(f"[Chat] SQS dispatch failed: {e}, falling back to local background task.")
            background_tasks.add_task(chat_section_worker_task, job_id, req.dict())
    else:
        background_tasks.add_task(chat_section_worker_task, job_id, req.dict())

    return {"job_id": job_id}

@router.get("/chat/section/{job_id}")
async def get_section_chat_status(
    job_id: str,
    claims: dict = Depends(verify_token),
    conn = Depends(get_db_connection)
):
    result = await conn.execute(text("SELECT status, content, error_message FROM chat_jobs WHERE id = :id"), {"id": job_id})
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "status": row[0],
        "content": row[1] or "",
        "error_message": row[2] or ""
    }