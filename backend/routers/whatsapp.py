"""
WhatsApp Bot Router
Handles:
  - POST /whatsapp/webhook  — Twilio inbound message webhook
  - GET  /whatsapp/webhook  — Twilio webhook verification
  - POST /whatsapp/subscribe   — Register a phone number for daily digest
  - DELETE /whatsapp/unsubscribe — Remove a subscription
  - GET  /whatsapp/subscribers — Admin: list all subscribers
  - POST /whatsapp/send-digest  — Admin/internal: trigger a digest now
"""

import os
import json
import logging
from typing import Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Form
from fastapi.responses import PlainTextResponse
from sqlalchemy import text
from pydantic import BaseModel

from database import get_db_connection
from auth import verify_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class SubscribeRequest(BaseModel):
    phone: str           # E.164, e.g. "+972501234567"
    name: Optional[str] = None


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

async def _ensure_table(conn):
    """Lazily create the whatsapp_subscribers table if it doesn't exist."""
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS whatsapp_subscribers (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     UUID,           -- nullable (anonymous opt-in not yet supported)
            phone       TEXT NOT NULL UNIQUE,
            name        TEXT,
            active      BOOLEAN NOT NULL DEFAULT TRUE,
            created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    await conn.commit()


# ---------------------------------------------------------------------------
# Twilio webhook — inbound messages (commands from users)
# ---------------------------------------------------------------------------

@router.post("/webhook", response_class=PlainTextResponse)
async def whatsapp_webhook(request: Request, conn=Depends(get_db_connection)):
    """
    Receive inbound WhatsApp messages from Twilio.
    Handles simple commands:
      SUBSCRIBE  – opt in for daily digest
      STOP       – opt out service
      DIGEST     – get the digest right now
      STATUS     – show current subscription status
      HELP       – show available commands
    """
    form = await request.form()
    body: str = (form.get("Body") or "").strip().upper()
    from_number: str = form.get("From", "")  # e.g. whatsapp:+14155551234

    # Normalise phone: strip "whatsapp:" prefix for storage
    phone = from_number.replace("whatsapp:", "").strip()
    logger.info(f"[WhatsApp Webhook] From: {phone}  Body: {body!r}")

    await _ensure_table(conn)

    # --- SANDBOX JOIN (e.g. "join satisfied-leg") — sent once to activate sandbox ---
    if body.startswith("JOIN "):
        # Auto-subscribe them to make onboarding seamless
        await conn.execute(text("""
            INSERT INTO whatsapp_subscribers (phone, active)
            VALUES (:phone, TRUE)
            ON CONFLICT (phone) DO UPDATE SET active = TRUE, updated_at = NOW()
        """), {"phone": phone})
        await conn.commit()
        welcome_msg = (
            "👋 *Welcome to ClaritX!*\n\n"
            "You're now connected to the ClaritX WhatsApp bot.\n\n"
            "📊 You've been *automatically subscribed* to daily market digests!\n\n"
            "Here's what you can do:\n"
            "  *DIGEST* — Get your market digest right now\n"
            "  *STATUS* — Check your subscription\n"
            "  *STOP* — Unsubscribe at any time\n"
            "  *HELP* — Show all commands\n\n"
            "Your first daily briefing arrives every morning at 7am. 🌅\n"
            "Or text *DIGEST* to get it right now!"
        )
        try:
            from services.whatsapp import send_whatsapp_message
            # Send explicitly via REST API since Twilio Sandbox swallows TwiML replies for 'join' messages
            send_whatsapp_message(phone, welcome_msg)
        except Exception as e:
            logger.error(f"[WhatsApp] Failed to send sandbox welcome explicitly: {e}")
            
        reply = ""

    # --- STOP / UNSUBSCRIBE ---
    elif body in ("STOP", "UNSUBSCRIBE", "OPT OUT", "OPTOUT"):

        await conn.execute(
            text("UPDATE whatsapp_subscribers SET active = FALSE, updated_at = NOW() WHERE phone = :phone"),
            {"phone": phone},
        )
        await conn.commit()
        reply = "✅ You've been unsubscribed from ClaritX daily updates. Reply *SUBSCRIBE* to re-enable them anytime."

    # --- SUBSCRIBE / START ---
    elif body in ("SUBSCRIBE", "START", "YES", "JOIN"):
        await conn.execute(text("""
            INSERT INTO whatsapp_subscribers (phone, active)
            VALUES (:phone, TRUE)
            ON CONFLICT (phone) DO UPDATE SET active = TRUE, updated_at = NOW()
        """), {"phone": phone})
        await conn.commit()
        reply = (
            "🎉 Welcome to *ClaritX Daily Digest*!\n\n"
            "Every morning you'll receive:\n"
            "  📂 Your portfolio summary\n"
            "  🔥 Top market movers\n"
            "  💡 AI-powered opportunities\n\n"
            "Reply *STOP* at any time to unsubscribe."
        )

    # --- STATUS ---
    elif body == "STATUS":
        res = await conn.execute(
            text("SELECT active FROM whatsapp_subscribers WHERE phone = :phone"),
            {"phone": phone},
        )
        row = res.fetchone()
        if row and row[0]:
            reply = "✅ You *are* subscribed to ClaritX daily updates.\nReply *STOP* to unsubscribe."
        elif row and not row[0]:
            reply = "⏸️ Your subscription is *paused*.\nReply *SUBSCRIBE* to re-enable it."
        else:
            reply = "❌ You are *not* subscribed.\nReply *SUBSCRIBE* to get daily ClaritX updates!"

    # --- DIGEST — send digest immediately ---
    elif body == "DIGEST":
        res = await conn.execute(
            text("SELECT active FROM whatsapp_subscribers WHERE phone = :phone"),
            {"phone": phone},
        )
        row = res.fetchone()
        if not row or not row[0]:
            reply = "❌ You're not subscribed yet. Reply *SUBSCRIBE* first, then try *DIGEST* again."
        else:
            # Dispatch to SQS worker because Lambda will freeze our process immediately after returning
            try:
                import boto3
                queue_url = os.environ.get("SQS_BACKGROUND_QUEUE_URL")
                if queue_url:
                    sqs = boto3.client("sqs", region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))
                    sqs.send_message(
                        QueueUrl=queue_url,
                        MessageBody=json.dumps({
                            "action": "WHATSAPP_DAILY_DIGEST",
                            "phone": phone
                        }),
                    )
                    reply = "⏳ Generating your digest... you'll receive it in a few seconds!"
                else:
                    reply = "⚠️ Server configuration error (SQS missing). Please contact support."
            except Exception as e:
                logger.error(f"[WhatsApp] DIGEST SQS dispatch failed: {e}")
                reply = "❌ Sorry, I couldn't process your request right now. Please try again later."


    # --- HELP / unknown ---
    else:
        reply = (
            "🤖 *ClaritX Bot Assistant*\n\n"
            "*Available commands:*\n"
            "  *DIGEST* – Get your market briefing now\n"
            "  *SUBSCRIBE* – Opt-in to daily updates\n"
            "  *STATUS* – Check your subscription status\n"
            "  *STOP* – Unsubscribe from updates\n"
            "  *HELP* – Show this command list\n\n"
            "Visit _claritx.app_ for full analysis."
        )


    # Return TwiML-compatible response
    # We escape the reply to avoid breaking XML
    import html
    if reply:
        safe_reply = html.escape(reply)
        twiml = f'<?xml version="1.0" encoding="UTF-8"?><Response><Message>{safe_reply}</Message></Response>'
    else:
        twiml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
    return PlainTextResponse(content=twiml, media_type="text/xml")


# ---------------------------------------------------------------------------
# Subscribe endpoint (called from the ClaritX web app for authenticated users)
# ---------------------------------------------------------------------------

@router.post("/subscribe")
async def subscribe(
    body: SubscribeRequest,
    claims: Dict = Depends(verify_token),
    conn=Depends(get_db_connection),
):
    """Register the authenticated user's phone for WhatsApp daily digest."""
    user_sub = claims.get("sub")
    if not user_sub:
        raise HTTPException(status_code=401, detail="Invalid user")

    phone = body.phone.strip()
    if not phone.startswith("+"):
        raise HTTPException(status_code=400, detail="Phone must be in E.164 format, e.g. +14155551234")

    await _ensure_table(conn)
    await conn.execute(text("""
        INSERT INTO whatsapp_subscribers (user_id, phone, name, active)
        VALUES (:uid, :phone, :name, TRUE)
        ON CONFLICT (phone) DO UPDATE
            SET user_id = :uid, name = COALESCE(:name, whatsapp_subscribers.name),
                active = TRUE, updated_at = NOW()
    """), {"uid": user_sub, "phone": phone, "name": body.name})
    await conn.commit()

    # Send a welcome message immediately
    try:
        from services.whatsapp import send_whatsapp_message
        send_whatsapp_message(
            phone,
            "🎉 *ClaritX Daily Digest* activated!\n\n"
            "You'll receive a morning briefing with your portfolio summary, "
            "top market movers and AI-powered opportunities.\n\n"
            "*Available commands:*\n"
            "  *DIGEST* – Get your digest right now\n"
            "  *STATUS* – Check your subscription\n"
            "  *STOP* – Unsubscribe\n"
            "  *HELP* – Show all commands",
        )
    except Exception as e:
        logger.warning(f"[WhatsApp] Welcome message failed for {phone}: {e}")

    return {"status": "success", "message": f"Subscribed {phone} for daily WhatsApp updates."}


@router.delete("/unsubscribe")
async def unsubscribe(
    claims: Dict = Depends(verify_token),
    conn=Depends(get_db_connection),
):
    """Unsubscribe the authenticated user from WhatsApp digests."""
    user_sub = claims.get("sub")
    if not user_sub:
        raise HTTPException(status_code=401, detail="Invalid user")

    await _ensure_table(conn)
    await conn.execute(
        text("UPDATE whatsapp_subscribers SET active = FALSE, updated_at = NOW() WHERE user_id = :uid"),
        {"uid": user_sub},
    )
    await conn.commit()
    return {"status": "success", "message": "Unsubscribed from daily WhatsApp updates."}


@router.get("/status")
async def subscription_status(
    claims: Dict = Depends(verify_token),
    conn=Depends(get_db_connection),
):
    """Return the current user's WhatsApp subscription status."""
    user_sub = claims.get("sub")
    if not user_sub:
        raise HTTPException(status_code=401, detail="Invalid user")

    await _ensure_table(conn)
    res = await conn.execute(
        text("SELECT phone, name, active, created_at FROM whatsapp_subscribers WHERE user_id = :uid"),
        {"uid": user_sub},
    )
    row = res.fetchone()
    if not row:
        return {"subscribed": False}

    return {
        "subscribed": bool(row[2]),
        "phone": row[0],
        "name": row[1],
        "since": row[3].isoformat() if row[3] else None,
    }


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------

@router.get("/subscribers")
async def list_subscribers(
    claims: Dict = Depends(verify_token),
    conn=Depends(get_db_connection),
):
    """Admin: list all active WhatsApp subscribers."""
    from auth import verify_admin
    await verify_admin(claims)

    await _ensure_table(conn)
    res = await conn.execute(text("""
        SELECT id, user_id, phone, name, active, created_at
        FROM whatsapp_subscribers
        ORDER BY created_at DESC
    """))
    rows = res.fetchall()
    return [
        {
            "id": str(r[0]),
            "user_id": str(r[1]) if r[1] else None,
            "phone": r[2],
            "name": r[3],
            "active": r[4],
            "created_at": r[5].isoformat() if r[5] else None,
        }
        for r in rows
    ]


@router.post("/send-digest")
async def trigger_digest(
    claims: Dict = Depends(verify_token),
):
    """Admin: manually trigger the daily digest for all active subscribers now."""
    from auth import verify_admin
    await verify_admin(claims)

    try:
        import boto3
        queue_url = os.environ.get("SQS_BACKGROUND_QUEUE_URL")
        if not queue_url:
            raise HTTPException(status_code=500, detail="SQS_BACKGROUND_QUEUE_URL not configured")

        sqs = boto3.client("sqs", region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))
        sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps({"action": "WHATSAPP_DAILY_DIGEST"}),
        )
        return {"status": "queued", "message": "Daily WhatsApp digest dispatched to background queue."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[WhatsApp] Failed to dispatch digest: {e}")
        raise HTTPException(status_code=500, detail=str(e))
