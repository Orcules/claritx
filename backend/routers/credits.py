from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List
import os
import json
from datetime import datetime, timedelta
from sqlalchemy import text
from database import get_db_connection
from auth import verify_token

router = APIRouter()

COST_MAP = {
    "deep-search": 1,
    "analyze-stock": 1,
    "portfolio-simulation": 5,
    "ai-chat": 1,
}

async def _ensure_user_and_merge(conn, user_id: str, email: str | None):
    """Insert user if new, merge with existing email account if duplicate provider."""
    if email:
        # Check if another user_id already owns this email
        res = await conn.execute(text(
            "SELECT user_id FROM user_credits WHERE email = :email AND user_id != :uid LIMIT 1"
        ), {"email": email, "uid": user_id})
        existing = res.fetchone()
        if existing:
            # Merge: copy the better record to this user_id, delete the old one
            await conn.execute(text("""
                INSERT INTO user_credits (user_id, email, subscription_tier, monthly_credits, bonus_credits,
                    credits_used_this_period, stripe_customer_id, stripe_subscription_id,
                    subscription_status, trial_end, cancel_at_period_end, period_end)
                SELECT :new_uid, :email, subscription_tier, monthly_credits, bonus_credits,
                    credits_used_this_period, stripe_customer_id, stripe_subscription_id,
                    subscription_status, trial_end, cancel_at_period_end, period_end
                FROM user_credits WHERE user_id = :old_uid
                ON CONFLICT (user_id) DO UPDATE SET
                    subscription_tier = EXCLUDED.subscription_tier,
                    monthly_credits = GREATEST(user_credits.monthly_credits, EXCLUDED.monthly_credits),
                    bonus_credits = GREATEST(user_credits.bonus_credits, EXCLUDED.bonus_credits),
                    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, user_credits.stripe_customer_id),
                    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, user_credits.stripe_subscription_id),
                    email = EXCLUDED.email
            """), {"new_uid": user_id, "old_uid": existing[0], "email": email})
            await conn.execute(text("DELETE FROM user_credits WHERE user_id = :old_uid"), {"old_uid": existing[0]})
            await conn.commit()
            return

    # Normal insert for new user
    await conn.execute(text("""
        INSERT INTO user_credits (user_id, email, monthly_credits, bonus_credits, credits_used_this_period, subscription_tier)
        VALUES (:user_id, :email, 3, 0, 0, 'free')
        ON CONFLICT (user_id) DO UPDATE SET email = COALESCE(EXCLUDED.email, user_credits.email)
    """), {"user_id": user_id, "email": email})
    await conn.commit()


@router.get("/check-credits")
async def check_credits(claims: Dict = Depends(verify_token), conn = Depends(get_db_connection)):
    user_id = claims.get("sub")
    email = claims.get("email")

    await _ensure_user_and_merge(conn, user_id, email)
    
    res = await conn.execute(text(
        "SELECT subscription_tier, monthly_credits, bonus_credits, credits_used_this_period, "
        "subscription_status, trial_end, cancel_at_period_end, period_end "
        "FROM user_credits WHERE user_id = :uid"
    ), {"uid": user_id})
    
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=500, detail="User credits not found")

    row_dict = dict(row._mapping)
    total_credits = row_dict["monthly_credits"] + row_dict["bonus_credits"]
    remaining = max(0, total_credits - row_dict["credits_used_this_period"])

    return {
        "allowed": True,
        "remaining": remaining,
        "subscription_tier": row_dict["subscription_tier"],
        "monthly_credits": row_dict["monthly_credits"],
        "bonus_credits": row_dict["bonus_credits"],
        "credits_used_this_period": row_dict["credits_used_this_period"],
        "subscription_status": row_dict["subscription_status"],
        "trial_end": row_dict["trial_end"].isoformat() if row_dict["trial_end"] else None,
        "cancel_at_period_end": row_dict["cancel_at_period_end"],
        "period_end": row_dict["period_end"].isoformat() if row_dict["period_end"] else None,
    }

@router.post("/check-credits")
async def check_credits_post(request: Dict[str, Any], claims: Dict = Depends(verify_token), conn = Depends(get_db_connection)):
    user_id = claims.get("sub")
    email = claims.get("email")
    cost = COST_MAP.get(request.get("action", "analyze-stock"), 1)
    
    await _ensure_user_and_merge(conn, user_id, email)
    
    res = await conn.execute(text(
        "SELECT monthly_credits, bonus_credits, credits_used_this_period "
        "FROM user_credits WHERE user_id = :uid"
    ), {"uid": user_id})
    
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=500, detail="User credits not found")
        
    row_dict = dict(row._mapping)
    total_credits = row_dict["monthly_credits"] + row_dict["bonus_credits"]
    remaining = max(0, total_credits - row_dict["credits_used_this_period"])

    return {"allowed": True, "remaining": remaining, "cost": cost}

@router.post("/redeem-coupon")
async def redeem_coupon(request: Dict[str, Any], claims: Dict = Depends(verify_token)):
    user_id = claims.get("sub")
    raw_code = request.get("code", "")

    if not raw_code:
        raise HTTPException(status_code=400, detail="Coupon code is required")

    # Normalize to uppercase for case-insensitive matching
    code = raw_code.strip().upper()

    # Credit coupons: code → bonus_credits to add
    CREDIT_COUPONS = {
        "WELCOME10": 10,
        "PROMO20": 20,
        "GUNTAR": 10,   # legacy (reusable)
        "GONTAR": 50,   # adds 50 bonus credits
    }

    # Pro upgrade coupons: code → (tier, monthly_credits)
    PRO_COUPONS = {
        "GONTARPRO": ("pro", 50),
    }

    # Codes that can be redeemed more than once per user
    REUSABLE_COUPONS = {"GUNTAR"}

    is_credit = code in CREDIT_COUPONS
    is_pro = code in PRO_COUPONS

    if not is_credit and not is_pro:
        raise HTTPException(status_code=400, detail="Invalid or expired coupon code")

    email = claims.get("email")
    async for conn in get_db_connection():
        await _ensure_user_and_merge(conn, user_id, email)

        # Block duplicate redemption (unless reusable)
        if code not in REUSABLE_COUPONS:
            res = await conn.execute(
                text("SELECT 1 FROM credit_transactions WHERE user_id = :user_id AND metadata->>'coupon_code' = :code"),
                {"user_id": user_id, "code": code}
            )
            if res.fetchone():
                raise HTTPException(status_code=400, detail="Coupon already redeemed")

        if is_credit:
            amount = CREDIT_COUPONS[code]
            await conn.execute(
                text("UPDATE user_credits SET bonus_credits = bonus_credits + :amount WHERE user_id = :user_id"),
                {"amount": amount, "user_id": user_id}
            )
            await conn.execute(text("""
                INSERT INTO credit_transactions (user_id, amount, action, metadata)
                VALUES (:user_id, :amount, 'coupon_redemption', :meta)
            """), {"user_id": user_id, "amount": amount, "meta": json.dumps({"coupon_code": code})})
            await conn.commit()
            return {"success": True, "type": "credits", "bonus_credits": amount}

        else:  # is_pro
            tier, monthly = PRO_COUPONS[code]
            await conn.execute(text("""
                UPDATE user_credits
                SET subscription_tier = :tier, monthly_credits = :monthly
                WHERE user_id = :user_id
            """), {"tier": tier, "monthly": monthly, "user_id": user_id})
            await conn.execute(text("""
                INSERT INTO credit_transactions (user_id, amount, action, metadata)
                VALUES (:user_id, 0, 'coupon_redemption', :meta)
            """), {"user_id": user_id, "meta": json.dumps({"coupon_code": code, "upgrade": tier})})
            await conn.commit()
            return {"success": True, "type": "pro_upgrade", "tier": tier}

        break
# trigger deploy Sun Apr 19 23:07:40 WEDT 2026
