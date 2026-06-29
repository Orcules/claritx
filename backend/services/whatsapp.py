"""
WhatsApp Bot Service
Handles sending WhatsApp messages via the Twilio API.
Builds nicely formatted daily digest messages for users.
"""

import os
import logging
import json
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Twilio helpers
# ---------------------------------------------------------------------------

def _get_twilio_client():
    """Lazy-init Twilio client to avoid import overhead on cold starts."""
    from twilio.rest import Client
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    if not account_sid or not auth_token:
        raise ValueError("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set.")
    return Client(account_sid, auth_token)


def _wa_number() -> str:
    """The Twilio WhatsApp sender number (e.g. whatsapp:+14155238886)."""
    raw = os.environ.get("TWILIO_WHATSAPP_FROM", "")
    if not raw.startswith("whatsapp:"):
        raw = f"whatsapp:{raw}"
    return raw


MAX_WA_LENGTH = 1600

def send_whatsapp_message(to_phone: str, body: str) -> bool:
    """
    Send a WhatsApp message, splitting into multiple messages if > 1600 chars.
    """
    try:
        client = _get_twilio_client()
        to_wa = to_phone if to_phone.startswith("whatsapp:") else f"whatsapp:{to_phone}"

        chunks = _split_message(body)
        for chunk in chunks:
            message = client.messages.create(
                from_=_wa_number(),
                to=to_wa,
                body=chunk,
            )
            logger.info(f"[WhatsApp] Sent to {to_phone} — SID: {message.sid}")
        return True
    except Exception as e:
        logger.error(f"[WhatsApp] Failed to send to {to_phone}: {e}")
        return False


def _split_message(body: str) -> list[str]:
    """Split a message into chunks of MAX_WA_LENGTH, breaking at newlines."""
    if len(body) <= MAX_WA_LENGTH:
        return [body]

    chunks = []
    while body:
        if len(body) <= MAX_WA_LENGTH:
            chunks.append(body)
            break
        cut = body.rfind("\n", 0, MAX_WA_LENGTH)
        if cut <= 0:
            cut = MAX_WA_LENGTH
        chunks.append(body[:cut].rstrip())
        body = body[cut:].lstrip("\n")
    return chunks


# ---------------------------------------------------------------------------
# Message formatters
# ---------------------------------------------------------------------------

_RISK_EMOJI = {1: "🟢", 2: "🟢", 3: "🟡", 4: "🟠", 5: "🔴"}
_TREND_EMOJI = {"up": "📈", "down": "📉", "neutral": "➡️"}


def format_portfolio_section(portfolios: List[Dict[str, Any]]) -> str:
    """Format the user's portfolio summary into WhatsApp-friendly text."""
    if not portfolios:
        return "📂 *Your Portfolios*\nNo portfolios found. Visit ClaritX to build your first portfolio!\n"

    lines = ["📂 *Your Portfolios*"]
    for p in portfolios[:2]:
        name = p.get("name") or "My Portfolio"
        risk_label = p.get("risk_label", "")
        holdings = p.get("holdings") or []
        risk_score = p.get("total_risk_score") or 0
        risk_emoji = _RISK_EMOJI.get(min(5, max(1, round(risk_score / 20))), "⚪")

        lines.append(f"\n*{name}*  {risk_emoji} {risk_label}")

        for h in holdings:
            sym = h.get("symbol", "")
            weight = h.get("weight", 0)
            saved_score = h.get("aiScore")
            current_score = h.get("currentAiScore")
            saved_price = h.get("savedPrice")
            current_price = h.get("currentPrice")

            parts = [f"   • *{sym}* {weight:.0f}%"]

            if saved_score is not None and current_score is not None:
                diff = current_score - saved_score
                arrow = "↑" if diff > 0 else "↓" if diff < 0 else "→"
                parts.append(f"AI: {saved_score:.0f}{arrow}{current_score:.0f}")
            elif current_score is not None:
                parts.append(f"AI: {current_score:.0f}")

            if saved_price is not None and current_price is not None and saved_price > 0:
                pct = ((current_price - saved_price) / saved_price) * 100
                parts.append(f"${saved_price:.0f}→${current_price:.0f} ({pct:+.1f}%)")
            elif current_price is not None:
                parts.append(f"${current_price:.0f}")

            lines.append("  ".join(parts))

    return "\n".join(lines)


def format_market_movers_section(movers_data: Dict[str, Any]) -> str:
    """Format market movers data into WhatsApp text."""
    movers: List[Dict] = movers_data.get("movers", [])
    overview: str = movers_data.get("marketOverview", "")
    sig_count: int = movers_data.get("significantCount", 0)

    lines = ["🔥 *Market Movers Today*"]
    if overview:
        lines.append(f"_{overview}_\n")

    if not movers:
        lines.append("No market data available right now.")
        return "\n".join(lines)

    # Top significant movers (up to 6)
    top = sorted(movers, key=lambda x: abs(x.get("changePercent", 0)), reverse=True)[:6]
    for m in top:
        sym = m.get("symbol", "")
        name = m.get("name", sym)
        chg = m.get("changePercent", 0)
        price = m.get("price", 0)
        arrow = "🟢 +" if chg >= 0 else "🔴 "
        headline = m.get("headline") or ""
        lines.append(f"{arrow}{chg:+.2f}%  *{sym}* ${price:.2f}")
        if headline:
            lines.append(f"   _{headline}_")

    if sig_count > 6:
        lines.append(f"\n_… {sig_count - 6} more movers today_")

    return "\n".join(lines)


def format_market_opportunities_section(opps: List[Dict[str, Any]]) -> str:
    """Format top market opportunities into WhatsApp text."""
    if not opps:
        return ""

    lines = ["💡 *Top Opportunities*"]
    for opp in opps[:4]:  # Limit to 4 to keep message readable
        sym = opp.get("symbol", "")
        name = opp.get("name", sym)
        score = opp.get("opportunityScore", 0)
        reason = opp.get("reason", "")
        timeframe = opp.get("timeframe", "")
        # Score bar
        stars = "⭐" * min(5, round(score / 2))
        lines.append(f"\n*{sym}* — {name}")
        lines.append(f"   {stars}  _{timeframe}_")
        if reason:
            # Truncate long reasons
            short_reason = reason[:160] + ("…" if len(reason) > 160 else "")
            lines.append(f"   {short_reason}")

    return "\n".join(lines)


def build_daily_digest(
    user_name: str,
    portfolios: List[Dict[str, Any]],
    movers_data: Dict[str, Any],
    opportunities: List[Dict[str, Any]],
) -> str:
    """
    Assemble the full daily digest WhatsApp message.
    """
    from datetime import date
    today = date.today().strftime("%A, %B %d %Y")

    header = (
        f"🌅 *Good morning, {user_name}!*\n"
        f"Here's your ClaritX daily briefing for *{today}*.\n"
        f"{'─' * 30}"
    )

    portfolio_section = format_portfolio_section(portfolios)
    movers_section = format_market_movers_section(movers_data)
    opps_section = format_market_opportunities_section(opportunities)

    footer = (
        f"{'─' * 30}\n"
        "📊 _Full analysis on www.claritx.ai_\n"
        "Reply *STOP* to unsubscribe from daily updates."
    )

    parts = [header, "", portfolio_section, "", movers_section]
    if opps_section:
        parts += ["", opps_section]
    parts += ["", footer]

    return "\n".join(parts)
