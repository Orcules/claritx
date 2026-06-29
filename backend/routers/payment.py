import os
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Dict, Any
from datetime import datetime
from auth import verify_token
from database import get_db_connection
from sqlalchemy import text

router = APIRouter()

# Stripe initialization
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

# Pro product ID and Price IDs
PRO_PRODUCT_ID = "prod_UJisTjrvRHsqu9"
PRICES = {
    "pro_subscription": "price_1TO2zPG2W6QER8MhGrhIPPy2",   # $20/month
    "starter_pack": "price_1TO2zPG2W6QER8MhUJsHaWz2",       # $5 / 20 credits
    "power_pack": "price_1TO2zQG2W6QER8MhBiHP2pwl",         # $10 / 50 credits
    "pro_pack": "price_1TO2zQG2W6QER8MhsaCw6i8k",           # $20 / 120 credits
}

CREDIT_PACKS = {
    PRICES["starter_pack"]: 20,   # $5
    PRICES["power_pack"]: 50,     # $10
    PRICES["pro_pack"]: 120,      # $20
}

TRIAL_DAYS = 14


@router.post("/create-checkout")
async def create_checkout(request: Request, request_data: Dict[str, Any], claims: Dict = Depends(verify_token)):
    user_id = claims.get("sub")
    email = claims.get("email") or claims.get("cognito:username")

    price_id = request_data.get("priceId")
    mode = request_data.get("mode", "payment")  # 'subscription' or 'payment'

    if not price_id:
        raise HTTPException(status_code=400, detail="priceId is required")

    try:
        # Find or create customer
        customers = stripe.Customer.list(email=email, limit=1)
        if customers.data:
            customer_id = customers.data[0].id
        else:
            customer = stripe.Customer.create(email=email, metadata={"user_id": user_id})
            customer_id = customer.id

        # Dynamically determine origin from headers
        header_origin = request.headers.get("origin") or request.headers.get("referer")
        from urllib.parse import urlparse
        p = urlparse(header_origin) if header_origin else None
        origin = f"{p.scheme}://{p.netloc}" if p and p.netloc else "http://localhost:8080"

        session_params = {
            "customer": customer_id,
            "line_items": [{"price": price_id, "quantity": 1}],
            "mode": mode,
            "allow_promotion_codes": True,
            "success_url": f"{origin}/pricing?success=true&session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{origin}/pricing?canceled=true",
            "metadata": {
                "user_id": user_id,
                "price_id": price_id
            }
        }

        # Add 14-day free trial for first-time Pro subscribers
        if mode == "subscription" and price_id == PRICES["pro_subscription"]:
            had_prior_subscription = False
            for status in ("active", "trialing", "past_due", "canceled"):
                existing_subs = stripe.Subscription.list(
                    customer=customer_id,
                    status=status,
                    limit=10,
                )
                if any(
                    item['price']['product'] == PRO_PRODUCT_ID
                    for sub in existing_subs.data
                    for item in sub['items']['data']
                ):
                    had_prior_subscription = True
                    break
            if not had_prior_subscription:
                session_params["subscription_data"] = {
                    "trial_period_days": TRIAL_DAYS,
                }

        # Enforce invoice generation for one-time payments
        if mode == "payment":
            session_params["invoice_creation"] = {"enabled": True}

        if price_id in CREDIT_PACKS:
            session_params["metadata"]["credits"] = str(CREDIT_PACKS[price_id])

        session = stripe.checkout.Session.create(**session_params)
        return {"url": session.url}

    except Exception as e:
        print(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/customer-portal")
@router.post("/customer-portal")
async def customer_portal(request: Request, claims: Dict = Depends(verify_token)):
    user_id = claims.get("sub")
    email = claims.get("email") or claims.get("cognito:username")

    try:
        customers = stripe.Customer.list(email=email, limit=1)
        if not customers.data:
            raise HTTPException(status_code=404, detail="No stripe customer found")

        customer_id = customers.data[0].id

        # Dynamically determine origin from headers
        header_origin = request.headers.get("origin") or request.headers.get("referer")
        from urllib.parse import urlparse
        p = urlparse(header_origin) if header_origin else None
        origin = f"{p.scheme}://{p.netloc}" if p and p.netloc else "http://localhost:8080"

        portal_session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{origin}/account?portal_return=1",
        )
        return {"url": portal_session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cancel-subscription")
async def cancel_subscription(claims: Dict = Depends(verify_token)):
    user_id = claims.get("sub")
    email = claims.get("email") or claims.get("cognito:username")

    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        # Look up subscription ID from DB first
        sub_id = None
        async for conn in get_db_connection():
            res = await conn.execute(
                text("SELECT stripe_subscription_id FROM user_credits WHERE user_id = :uid"),
                {"uid": user_id}
            )
            row = res.fetchone()
            if row:
                sub_id = row[0]
            break

        # Fallback: look up via Stripe customer
        if not sub_id:
            customers = stripe.Customer.list(email=email, limit=1)
            if not customers.data:
                raise HTTPException(status_code=404, detail="No subscription found")
            customer_id = customers.data[0].id
            for status in ("active", "trialing"):
                subs = stripe.Subscription.list(customer=customer_id, status=status, limit=1)
                if subs.data:
                    sub_id = subs.data[0].id
                    break

        if not sub_id:
            raise HTTPException(status_code=404, detail="No active subscription found")

        # Cancel at period end (not immediately — user keeps access until billing cycle ends)
        updated_sub = stripe.Subscription.modify(sub_id, cancel_at_period_end=True)

        # Sync to DB
        async for conn in get_db_connection():
            await conn.execute(text("""
                UPDATE user_credits
                SET cancel_at_period_end = TRUE,
                    updated_at = NOW()
                WHERE user_id = :uid
            """), {"uid": user_id})
            await conn.commit()
            break

        return {
            "success": True,
            "cancel_at_period_end": True,
            "current_period_end": updated_sub.current_period_end,
            "message": "Subscription will cancel at end of billing period"
        }

    except stripe.error.StripeError as e:
        print(f"Stripe cancel error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        print(f"Cancel subscription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/check-subscription")
@router.post("/check-subscription")
async def check_subscription(claims: Dict = Depends(verify_token)):
    user_id = claims.get("sub")
    email = claims.get("email") or claims.get("cognito:username")

    try:
        customers = stripe.Customer.list(email=email, limit=1)
        if not customers.data:
            # No Stripe customer found — don't downgrade, just report current DB state
            async for conn in get_db_connection():
                res = await conn.execute(text(
                    "SELECT subscription_tier, subscription_status FROM user_credits WHERE user_id = :uid"
                ), {"uid": user_id})
                row = res.fetchone()
                break
            current_tier = row[0] if row else "free"
            current_status = row[1] if row else "none"
            return {"subscribed": current_tier == "pro", "tier": current_tier, "subscription_status": current_status or "none"}

        customer_id = customers.data[0].id

        # Check active AND trialing subscriptions
        subscriptions = stripe.Subscription.list(customer=customer_id, limit=5)
        active_subs = [s for s in subscriptions.data if s.status in ("active", "trialing")]

        has_active_sub = len(active_subs) > 0
        tier = "free"
        sub = None

        if has_active_sub:
            sub = active_subs[0]
            product_id = sub["items"]["data"][0]["price"]["product"]
            is_pro = product_id == PRO_PRODUCT_ID
            tier = "pro" if is_pro else "free"

            trial_end_ts = sub.trial_end
            cancel_at_period_end = sub.cancel_at_period_end

            # Sync active subscription to DB
            async for conn in get_db_connection():
                await conn.execute(text("""
                    UPDATE user_credits
                    SET subscription_tier = :tier,
                        monthly_credits = :credits,
                        stripe_customer_id = :cust_id,
                        stripe_subscription_id = :sub_id,
                        period_end = :period_end,
                        subscription_status = :sub_status,
                        trial_end = :trial_end,
                        cancel_at_period_end = :cancel_at_end,
                        updated_at = NOW()
                    WHERE user_id = :user_id
                """), {
                    "tier": tier,
                    "credits": 50 if is_pro else 3,
                    "cust_id": customer_id,
                    "sub_id": sub.id,
                    "period_end": datetime.fromtimestamp(sub.current_period_end),
                    "sub_status": sub.status,
                    "trial_end": datetime.fromtimestamp(trial_end_ts) if trial_end_ts else None,
                    "cancel_at_end": cancel_at_period_end,
                    "user_id": user_id
                })
                await conn.commit()
                break
        else:
            # No active subscription — only downgrade if there's a confirmed canceled subscription
            canceled_subs = [s for s in subscriptions.data if s.status == "canceled"]
            canceled_sub = canceled_subs[0] if canceled_subs else None
            if canceled_sub:
                async for conn in get_db_connection():
                    await conn.execute(text("""
                        UPDATE user_credits
                        SET subscription_tier = 'free',
                            monthly_credits = 3,
                            subscription_status = 'canceled',
                            cancel_at_period_end = FALSE,
                            stripe_subscription_id = NULL,
                            updated_at = NOW()
                        WHERE user_id = :user_id
                    """), {"user_id": user_id})
                    await conn.commit()
                    break

        return {
            "subscribed": has_active_sub,
            "tier": tier,
            "stripe_customer_id": customer_id,
            "subscription_status": sub.status if sub else "none",
            "is_trialing": sub.status == "trialing" if sub else False,
            "trial_end": sub.trial_end if sub and sub.trial_end else None,
            "cancel_at_period_end": sub.cancel_at_period_end if sub else False,
            "current_period_end": sub.current_period_end if sub else None,
        }
    except Exception as e:
        print(f"Subscription check error: {e}")
        return {"subscribed": False, "tier": "free", "subscription_status": "none", "error": str(e)}


@router.post("/stripe-webhook")
async def stripe_webhook(request: Request):
    print(">>> STRIPE WEBHOOK CALLED")

    client_host = request.client.host if request.client else "unknown"
    print(f"Webhook IP: {client_host}")
    print(f"Headers: {dict(request.headers)}")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")

    if not sig_header or not webhook_secret:
        print("Webhook Error: Missing signature or webhook secret config")
        raise HTTPException(status_code=400, detail="Missing signature or webhook secret config")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        print(f">>> STRIPE EVENT RECEIVED: {event['type']} (ID: {event['id']})")
    except ValueError:
        print("Invalid payload in stripe webhook")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        print("Invalid signature in stripe webhook")
        raise HTTPException(status_code=400, detail="Invalid signature")

    # ── checkout.session.completed ──────────────────────────────────────────────
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]

        user_id = session.get("metadata", {}).get("user_id")
        credits_str = session.get("metadata", {}).get("credits")
        mode = session.get("mode")

        if user_id:
            async for conn in get_db_connection():
                try:
                    await conn.execute(text("""
                        INSERT INTO user_credits (user_id, monthly_credits, bonus_credits, credits_used_this_period, subscription_tier)
                        VALUES (:user_id, 3, 0, 0, 'free')
                        ON CONFLICT (user_id) DO NOTHING
                    """), {"user_id": user_id})

                    # One-time credit pack purchase
                    if credits_str:
                        await conn.execute(text("""
                            UPDATE user_credits
                            SET bonus_credits = bonus_credits + :credits,
                                updated_at = NOW()
                            WHERE user_id = :uid
                        """), {"credits": int(credits_str), "uid": user_id})

                    # Subscription (Pro tier)
                    if mode == "subscription":
                        sub_id = session.get("subscription")
                        customer_id = session.get("customer")

                        if sub_id:
                            sub = stripe.Subscription.retrieve(sub_id)
                            product_id = sub["items"]["data"][0]["price"]["product"]
                            is_pro = product_id == PRO_PRODUCT_ID

                            if is_pro:
                                trial_end_ts = sub.trial_end
                                await conn.execute(text("""
                                    UPDATE user_credits
                                    SET subscription_tier = 'pro',
                                        monthly_credits = 50,
                                        stripe_customer_id = :cust_id,
                                        stripe_subscription_id = :sub_id,
                                        period_end = :period_end,
                                        subscription_status = :sub_status,
                                        trial_end = :trial_end,
                                        cancel_at_period_end = FALSE,
                                        updated_at = NOW()
                                    WHERE user_id = :uid
                                """), {
                                    "cust_id": customer_id,
                                    "sub_id": sub.id,
                                    "period_end": datetime.fromtimestamp(sub.current_period_end),
                                    "sub_status": sub.status,
                                    "trial_end": datetime.fromtimestamp(trial_end_ts) if trial_end_ts else None,
                                    "uid": user_id
                                })

                    await conn.commit()
                    print(f"Successfully processed {event['type']} for user {user_id}")
                except Exception as db_err:
                    print(f"Error updating DB in stripe webhook: {db_err}")
                finally:
                    break

    # ── customer.subscription.deleted ──────────────────────────────────────────
    elif event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        customer_id = sub.get("customer")
        sub_id = sub.get("id")

        print(f"Subscription deleted: {sub_id} for customer {customer_id}")

        async for conn in get_db_connection():
            try:
                await conn.execute(text("""
                    UPDATE user_credits
                    SET subscription_tier = 'free',
                        monthly_credits = 3,
                        subscription_status = 'canceled',
                        cancel_at_period_end = FALSE,
                        stripe_subscription_id = NULL,
                        updated_at = NOW()
                    WHERE stripe_subscription_id = :sub_id
                       OR stripe_customer_id = :cust_id
                """), {"sub_id": sub_id, "cust_id": customer_id})
                await conn.commit()
                print(f"User downgraded to free for subscription {sub_id}")
            except Exception as db_err:
                print(f"Error handling subscription.deleted: {db_err}")
            finally:
                break

    # ── customer.subscription.updated ──────────────────────────────────────────
    elif event["type"] == "customer.subscription.updated":
        sub = event["data"]["object"]
        customer_id = sub.get("customer")
        sub_id = sub.get("id")
        status = sub.get("status")
        cancel_at_period_end = sub.get("cancel_at_period_end", False)

        print(f"Subscription updated: {sub_id}, status={status}, cancel_at_period_end={cancel_at_period_end}")

        product_id = sub["items"]["data"][0]["price"]["product"]
        is_pro = product_id == PRO_PRODUCT_ID

        async for conn in get_db_connection():
            try:
                if status in ("active", "trialing"):
                    tier = "pro" if is_pro else "free"
                    credits = 50 if is_pro else 3
                    trial_end_ts = sub.get("trial_end")

                    await conn.execute(text("""
                        UPDATE user_credits
                        SET subscription_tier = :tier,
                            monthly_credits = :credits,
                            subscription_status = :status,
                            period_end = :period_end,
                            trial_end = :trial_end,
                            cancel_at_period_end = :cancel_at_end,
                            updated_at = NOW()
                        WHERE stripe_subscription_id = :sub_id
                           OR stripe_customer_id = :cust_id
                    """), {
                        "tier": tier,
                        "credits": credits,
                        "status": status,
                        "period_end": datetime.fromtimestamp(sub["current_period_end"]),
                        "trial_end": datetime.fromtimestamp(trial_end_ts) if trial_end_ts else None,
                        "cancel_at_end": cancel_at_period_end,
                        "sub_id": sub_id,
                        "cust_id": customer_id,
                    })
                elif status == "past_due":
                    await conn.execute(text("""
                        UPDATE user_credits
                        SET subscription_status = 'past_due',
                            updated_at = NOW()
                        WHERE stripe_subscription_id = :sub_id
                           OR stripe_customer_id = :cust_id
                    """), {"sub_id": sub_id, "cust_id": customer_id})
                elif status in ("unpaid", "canceled", "incomplete_expired"):
                    await conn.execute(text("""
                        UPDATE user_credits
                        SET subscription_tier = 'free',
                            monthly_credits = 3,
                            subscription_status = :status,
                            cancel_at_period_end = FALSE,
                            updated_at = NOW()
                        WHERE stripe_subscription_id = :sub_id
                           OR stripe_customer_id = :cust_id
                    """), {"status": status, "sub_id": sub_id, "cust_id": customer_id})

                await conn.commit()
                print(f"Subscription updated to {status} for {sub_id}")
            except Exception as db_err:
                print(f"Error handling subscription.updated: {db_err}")
            finally:
                break

    # ── invoice.payment_failed ──────────────────────────────────────────────────
    elif event["type"] == "invoice.payment_failed":
        invoice = event["data"]["object"]
        customer_id = invoice.get("customer")
        sub_id = invoice.get("subscription")
        attempt_count = invoice.get("attempt_count", 0)

        print(f"Payment failed for customer {customer_id}, subscription {sub_id}, attempt {attempt_count}")

        if sub_id:
            async for conn in get_db_connection():
                try:
                    await conn.execute(text("""
                        UPDATE user_credits
                        SET subscription_status = 'past_due',
                            updated_at = NOW()
                        WHERE stripe_subscription_id = :sub_id
                           OR stripe_customer_id = :cust_id
                    """), {"sub_id": sub_id, "cust_id": customer_id})
                    await conn.commit()
                except Exception as db_err:
                    print(f"Error handling invoice.payment_failed: {db_err}")
                finally:
                    break

    # ── invoice.paid ────────────────────────────────────────────────────────────
    elif event["type"] == "invoice.paid":
        invoice = event["data"]["object"]
        customer_id = invoice.get("customer")
        sub_id = invoice.get("subscription")

        print(f"Invoice paid for customer {customer_id}, subscription {sub_id}")

        if sub_id:
            async for conn in get_db_connection():
                try:
                    sub = stripe.Subscription.retrieve(sub_id)
                    product_id = sub["items"]["data"][0]["price"]["product"]
                    is_pro = product_id == PRO_PRODUCT_ID

                    if is_pro:
                        # Reset credits for the new billing period
                        await conn.execute(text("""
                            UPDATE user_credits
                            SET subscription_status = 'active',
                                credits_used_this_period = 0,
                                period_start = :period_start,
                                period_end = :period_end,
                                cancel_at_period_end = :cancel_at_end,
                                updated_at = NOW()
                            WHERE stripe_subscription_id = :sub_id
                               OR stripe_customer_id = :cust_id
                        """), {
                            "period_start": datetime.fromtimestamp(sub.current_period_start),
                            "period_end": datetime.fromtimestamp(sub.current_period_end),
                            "cancel_at_end": sub.cancel_at_period_end,
                            "sub_id": sub_id,
                            "cust_id": customer_id,
                        })
                    await conn.commit()
                    print(f"Credits reset for new billing period, sub {sub_id}")
                except Exception as db_err:
                    print(f"Error handling invoice.paid: {db_err}")
                finally:
                    break

    return {"status": "success"}
# Force redeploy Sun Apr 19 23:15:00 WEDT 2026
