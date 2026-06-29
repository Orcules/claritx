from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Dict, List
import json
from sqlalchemy import text
from database import get_db_connection
from auth import verify_token
from models import PortfolioModel, InvestorProfile

router = APIRouter()

@router.get("/user-portfolios")
async def get_portfolios(user_id: str = Depends(verify_token), conn = Depends(get_db_connection)):
    """
    Get all portfolios for the current user.
    """
    user_sub = user_id.get("sub", "anonymous") if isinstance(user_id, dict) else "anonymous"
    
    try:
        from sqlalchemy import text
        # Ensure migration happened (drop unique constraint if exists)
        # We did this via psql, but we can also ensure the ID column is there etc.
    
        result = await conn.execute(text("""
            SELECT id, user_id, name, risk_bucket, risk_label, style_tags, constraints, 
                   holdings, sector_allocation, total_risk_score, created_at, updated_at
            FROM user_portfolios WHERE user_id = :uid
            ORDER BY updated_at DESC
        """), {"uid": user_sub})
        rows = result.fetchall()
        
        portfolios = []
        all_symbols = set()
        for row in rows:
            d = dict(row._mapping)
            holdings = d.get("holdings", [])
            if isinstance(holdings, str):
                holdings = json.loads(holdings)
                d["holdings"] = holdings
            for h in holdings:
                if isinstance(h, dict) and h.get("symbol"):
                    all_symbols.add(h["symbol"])
            
            # Format dates and IDs early
            d["id"] = str(d["id"])
            d["user_id"] = str(d["user_id"])
            if d.get("created_at"): d["created_at"] = d["created_at"].isoformat()
            if d.get("updated_at"): d["updated_at"] = d["updated_at"].isoformat()
            portfolios.append(d)

        # 2. Fetch latest scores for all symbols (for response enrichment only)
        scores_map = {}
        if all_symbols:
            sym_list = list(all_symbols)
            score_query = text("""
                SELECT DISTINCT ON (symbol) symbol,
                       COALESCE(NULLIF(REGEXP_REPLACE(split_part(analysis_data->'analysis'->>'ai_score', '/', 1), '[^0-9.]', '', 'g'), '')::numeric, 0) as score
                FROM stock_analyses
                WHERE symbol = ANY(:symbols) AND status = 'complete'
                ORDER BY symbol, updated_at DESC
            """)
            score_result = await conn.execute(score_query, {"symbols": sym_list})
            for r in score_result.fetchall():
                scores_map[r[0]] = float(r[1])

        # 3. Enrich with current aiScore for response only (not persisted)
        for d in portfolios:
            if "holdings" in d:
                for h in d["holdings"]:
                    symbol = h.get("symbol")
                    if symbol in scores_map:
                        h["aiScore"] = scores_map[symbol]

        return portfolios
            
    except Exception as e:
        print(f"Portfolio Fetch Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch portfolios")

@router.get("/admin/portfolios")
async def get_all_portfolios(claims: Dict = Depends(verify_token), conn = Depends(get_db_connection)):
    """
    Get all portfolios for all users (Admin only).
    """
    from auth import verify_admin
    await verify_admin(claims)

    try:
        from sqlalchemy import text
        result = await conn.execute(text("""
            SELECT id, user_id, name, risk_bucket, risk_label, style_tags, constraints, 
                   holdings, sector_allocation, total_risk_score, created_at, updated_at
            FROM user_portfolios
            ORDER BY created_at DESC
        """))
        rows = result.fetchall()
        
        portfolios = []
        for row in rows:
            d = dict(row._mapping)
            d["id"] = str(d["id"])
            d["user_id"] = str(d["user_id"])
            if d["created_at"]: d["created_at"] = d["created_at"].isoformat()
            if d["updated_at"]: d["updated_at"] = d["updated_at"].isoformat()
            portfolios.append(d)
            
        return portfolios
            
    except Exception as e:
        print(f"Admin Portfolio Fetch Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch all portfolios")

@router.post("/user-portfolios")
async def save_portfolio(portfolio: PortfolioModel, claims: Dict = Depends(verify_token), conn = Depends(get_db_connection)): 
    """
    Save user portfolio settings.
    """
    user_sub = claims.get("sub")
    if not user_sub:
        raise HTTPException(status_code=401, detail="Invalid User")
        
    try:
        from sqlalchemy import text
        
        # If ID is provided, update existing. Else, insert new.
        if portfolio.id:
            query = text("""
                UPDATE user_portfolios SET
                    name = :name,
                    risk_bucket = :risk_bucket,
                    risk_label = :risk_label,
                    style_tags = CAST(:style_tags AS text[]),
                    constraints = CAST(:constraints AS text[]),
                    holdings = CAST(:holdings AS JSONB),
                    sector_allocation = CAST(:sector_allocation AS JSONB),
                    total_risk_score = :total_risk_score,
                    watched_stocks = CAST(:stocks AS JSONB),
                    settings = CAST(:settings AS JSONB),
                    updated_at = NOW()
                WHERE id = :pid AND user_id = :uid
                RETURNING id
            """)
            result = await conn.execute(query, {
                "pid": portfolio.id,
                "uid": user_sub,
                "name": portfolio.name,
                "risk_bucket": portfolio.risk_bucket,
                "risk_label": portfolio.risk_label,
                "style_tags": portfolio.style_tags,
                "constraints": portfolio.constraints,
                "holdings": json.dumps([h.dict() for h in portfolio.holdings]),
                "sector_allocation": json.dumps(portfolio.sector_allocation),
                "total_risk_score": portfolio.total_risk_score,
                "stocks": json.dumps(portfolio.watched_stocks or []),
                "settings": json.dumps(portfolio.settings or {})
            })
            
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="Portfolio not found or unauthorized")
        else:
            # Auto-number name if not provided: "Portfolio N"
            if not portfolio.name:
                count_result = await conn.execute(
                    text("SELECT COUNT(*) FROM user_portfolios WHERE user_id = :uid"),
                    {"uid": user_sub}
                )
                existing_count = count_result.scalar() or 0
                portfolio.name = f"Portfolio {existing_count + 1}"

            query = text("""
                INSERT INTO user_portfolios (
                    user_id, name, risk_bucket, risk_label, style_tags, constraints,
                    holdings, sector_allocation, total_risk_score, watched_stocks, settings, updated_at
                )
                VALUES (
                    :uid, :name, :risk_bucket, :risk_label, CAST(:style_tags AS text[]), CAST(:constraints AS text[]),
                    CAST(:holdings AS JSONB), CAST(:sector_allocation AS JSONB), :total_risk_score,
                    CAST(:stocks AS JSONB), CAST(:settings AS JSONB), NOW()
                )
                RETURNING id
            """)

            result = await conn.execute(query, {
                "uid": user_sub,
                "name": portfolio.name,
                "risk_bucket": portfolio.risk_bucket,
                "risk_label": portfolio.risk_label,
                "style_tags": portfolio.style_tags,
                "constraints": portfolio.constraints,
                "holdings": json.dumps([h.dict() for h in portfolio.holdings]),
                "sector_allocation": json.dumps(portfolio.sector_allocation),
                "total_risk_score": portfolio.total_risk_score,
                "stocks": json.dumps(portfolio.watched_stocks or []),
                "settings": json.dumps(portfolio.settings or {})
            })
            
        new_id = result.fetchone()[0]
        await conn.commit()
        
        return {"status": "success", "message": "Portfolio saved", "id": str(new_id)}
        
    except Exception as e:
        print(f"Portfolio Save Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save portfolio")


@router.patch("/user-portfolios/{portfolio_id}/name")
async def rename_portfolio(portfolio_id: str, body: dict = Body(...), claims: Dict = Depends(verify_token), conn = Depends(get_db_connection)):
    """
    Rename a portfolio by updating only its name field.
    """
    user_sub = claims.get("sub")
    if not user_sub:
        raise HTTPException(status_code=401, detail="Invalid User")

    new_name = (body.get("name") or "").strip()
    if not new_name:
        raise HTTPException(status_code=422, detail="Name cannot be empty")

    try:
        result = await conn.execute(
            text("""
                UPDATE user_portfolios SET name = :name, updated_at = NOW()
                WHERE id = CAST(:pid AS UUID) AND user_id = :uid
                RETURNING id
            """),
            {"name": new_name, "pid": portfolio_id, "uid": user_sub}
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Portfolio not found or unauthorized")
        await conn.commit()
        return {"status": "success", "name": new_name}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Portfolio Rename Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to rename portfolio")


# --- Investor Profile & Recommendations ---

@router.post("/portfolio/profile")
async def save_investor_profile(profile: InvestorProfile, claims: Dict = Depends(verify_token), conn = Depends(get_db_connection)):
    """
    Save or update the user's investor profile (questionnaire settings).
    Stored in the investor_profiles table.
    """
    user_sub = claims.get("sub")
    if not user_sub:
        raise HTTPException(status_code=401, detail="Invalid User")
    
    try:
        # Upsert into investor_profiles
        await conn.execute(text("""
            INSERT INTO investor_profiles (
                user_id, settings, updated_at
            )
            VALUES (
                :uid, CAST(:settings AS JSONB), NOW()
            )
            ON CONFLICT (user_id) 
            DO UPDATE SET settings = CAST(:settings AS JSONB), updated_at = NOW()
        """), {
            "uid": user_sub,
            "settings": json.dumps({"investor_profile": profile.dict()})
        })
        await conn.commit()
        
        return {"status": "success", "profile": profile.dict()}
        
    except Exception as e:
        print(f"Profile Save Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save profile")


@router.get("/portfolio/profile")
async def get_investor_profile(claims: Dict = Depends(verify_token), conn = Depends(get_db_connection)):
    """Get the user's saved investor profile."""
    user_sub = claims.get("sub")
    if not user_sub:
        raise HTTPException(status_code=401, detail="Invalid User")
    
    try:
        result = await conn.execute(text("SELECT settings FROM investor_profiles WHERE user_id = :uid"), {"uid": user_sub})
        row = result.fetchone()
        
        if row and row[0]:
            settings = row[0] if isinstance(row[0], dict) else json.loads(row[0])
            profile = settings.get("investor_profile", {})
            return {"profile": profile}
        
        return {"profile": {}}
    except Exception as e:
        print(f"Profile Fetch Error: {e}")
        return {"profile": {}}


from auth import verify_token, optional_token
from typing import Optional

@router.get("/portfolio/recommendations")
async def get_recommendations(
    min_ai_score: int = 0,
    sectors: str = "",
    market_cap: str = "all",
    instrument_type: str = "mixed",
    risk_tolerance: str = "moderate",
    value_or_growth: str = "blend",
    income_vs_growth: str = "both",
    country: str = "all",
    claims: Optional[Dict] = Depends(optional_token), 
    conn = Depends(get_db_connection)
):
    """
    Return top 10 stocks by AI score (filtered by profile) + 5 ETFs if requested.
    If authenticated, reads profile from DB. Otherwise, uses query parameters.
    """
    user_sub = claims.get("sub") if isinstance(claims, dict) else None

    try:
        profile = None
        if user_sub:
            # 1. Load user profile from DB if authenticated
            profile_result = await conn.execute(text("SELECT settings FROM investor_profiles WHERE user_id = :uid"), {"uid": user_sub})
            profile_row = profile_result.fetchone()
            if profile_row and profile_row[0]:
                settings = profile_row[0] if isinstance(profile_row[0], dict) else json.loads(profile_row[0])
                profile = settings.get("investor_profile")
        
        # 2. Build dynamic SQL filters from profile or query params
        if profile:
            p_min_ai_score = profile.get("min_ai_score", 0)
            p_sectors = profile.get("sectors", [])
            p_market_cap_pref = profile.get("market_cap", "all")
            p_instrument_type = profile.get("instrument_type", "mixed")
            p_risk_tolerance = profile.get("risk_tolerance", "moderate")
            p_value_or_growth = profile.get("value_or_growth", "blend")
            p_income_vs_growth = profile.get("income_vs_growth", "both")
            p_country_pref = profile.get("country", "all")
        else:
            p_min_ai_score = min_ai_score
            p_sectors = [s.strip() for s in sectors.split(",")] if sectors else []
            if "no_preference" in p_sectors:
                p_sectors = []
            p_market_cap_pref = market_cap
            p_instrument_type = instrument_type
            p_risk_tolerance = risk_tolerance
            p_value_or_growth = value_or_growth
            p_income_vs_growth = income_vs_growth
            p_country_pref = country
        
        
        # Determine Limits based on Instrument Type
        # Core-Satellite approach: 3-5 ETFs, 10-15 Stocks ideally
        etf_limit = 5 if p_instrument_type in ["etf", "funds", "mixed"] else 0
        stock_limit = 0 if p_instrument_type in ["etf", "funds"] else (20 if p_instrument_type == "stocks" else 15)
        
        # Base query for stocks (NOT ETFs)
        formatted_stocks = []
        if stock_limit > 0:
            stock_query = """
                SELECT 
                    sa.symbol,
                    sa.analysis_data->'stock'->>'name' as name,
                    COALESCE(sc.data->>'sector', sa.analysis_data->'stock'->>'sector') as sector,
                    COALESCE(NULLIF(sa.analysis_data->'stock'->>'price', '')::numeric, 0) as price,
                    COALESCE(
                        NULLIF(sa.analysis_data->'stock'->>'marketCap', '')::numeric,
                        NULLIF(sc.data->>'marketCap', '')::numeric,
                        0
                    ) as market_cap,
                    COALESCE(NULLIF(split_part(sa.analysis_data->'analysis'->>'ai_score', '/', 1), 'NA')::numeric, 0) as ai_score,
                    sa.analysis_data->'analysis'->>'final_verdict' as final_verdict,
                    sa.analysis_data->'stock'->'technicals'->>'trend' as trend,
                    sa.analysis_data->'stock'->'technicals'->>'rsi' as rsi,
                    COALESCE(NULLIF(sc.data->>'beta', '')::numeric, NULLIF(sa.analysis_data->'stock'->>'beta', '')::numeric, 0) as beta,
                    COALESCE(NULLIF(sc.data->>'volume', '')::numeric, 0) as volume,
                    COALESCE(
                        NULLIF(sa.analysis_data->'analysis'->'financial_ratios'->>'dividendYielTTM', '')::numeric,
                        NULLIF(sa.analysis_data->'analysis'->'financial_ratios'->>'dividendYieldTTM', '')::numeric,
                        0
                    ) as dividend_yield,
                    COALESCE(NULLIF(sa.analysis_data->'analysis'->'financial_ratios'->>'priceToEarningsRatioTTM', '')::numeric, 0) as pe_ratio,
                    sa.updated_at
                FROM (
                    SELECT DISTINCT ON (symbol) * 
                    FROM stock_analyses 
                    WHERE status = 'complete' 
                    ORDER BY symbol, updated_at DESC
                ) sa
                LEFT JOIN screener_cache sc ON sc.symbol = sa.symbol
                WHERE sa.analysis_data->'analysis'->>'ai_score' IS NOT NULL
                AND sa.analysis_data->'analysis'->>'ai_score' != 'NA'
                AND COALESCE(NULLIF(split_part(sa.analysis_data->'analysis'->>'ai_score', '/', 1), 'NA')::numeric, 0) >= :min_ai
                AND COALESCE(sa.analysis_data->'stock'->>'isETF', 'false') NOT IN ('true', 'True')
                AND COALESCE(sc.data->>'isEtf', 'false') NOT IN ('true', 'True')
                AND COALESCE(sc.data->>'isFund', 'false') NOT IN ('true', 'True')
            """
            
            params = {"min_ai": p_min_ai_score, "uid": user_sub}
        
            # Sector filter
            if p_sectors:
                stock_query += " AND (COALESCE(sc.data->>'sector', sa.analysis_data->'stock'->>'sector') = ANY(:sectors))"
                params["sectors"] = p_sectors
            
            # Market cap filter (stocks only — ETFs are fetched separately without this filter)
            if p_market_cap_pref == "large":
                stock_query += " AND COALESCE(NULLIF(sa.analysis_data->'stock'->>'marketCap', '')::numeric, NULLIF(sc.data->>'marketCap', '')::numeric, 0) >= 10000000000"
            elif p_market_cap_pref == "mid":
                stock_query += " AND COALESCE(NULLIF(sa.analysis_data->'stock'->>'marketCap', '')::numeric, NULLIF(sc.data->>'marketCap', '')::numeric, 0) BETWEEN 2000000000 AND 10000000000"
            
            # Risk tolerance → beta filter
            if p_risk_tolerance == "conservative":
                stock_query += " AND COALESCE(NULLIF(sc.data->>'beta', '')::numeric, NULLIF(sa.analysis_data->'stock'->>'beta', '')::numeric, 1) < 0.8"
            elif p_risk_tolerance == "aggressive":
                stock_query += " AND COALESCE(NULLIF(sc.data->>'beta', '')::numeric, NULLIF(sa.analysis_data->'stock'->>'beta', '')::numeric, 1) > 1.3"
            # moderate = no beta filter
            
            # Value/Growth → P/E filter
            if p_value_or_growth == "value":
                stock_query += " AND COALESCE(NULLIF(sa.analysis_data->'analysis'->'financial_ratios'->>'priceToEarningsRatioTTM', '')::numeric, 0) > 0 AND COALESCE(NULLIF(sa.analysis_data->'analysis'->'financial_ratios'->>'priceToEarningsRatioTTM', '')::numeric, 0) <= 25"
            elif p_value_or_growth == "growth":
                stock_query += " AND COALESCE(NULLIF(sa.analysis_data->'analysis'->'financial_ratios'->>'priceToEarningsRatioTTM', '')::numeric, 0) > 0"
                # Growth: no P/E upper cap, but must have positive earnings
            
            # Income → dividend yield filter
            if p_income_vs_growth == "income":
                stock_query += """ AND (COALESCE(
                    NULLIF(sa.analysis_data->'analysis'->'financial_ratios'->>'dividendYielTTM', '')::numeric,
                    NULLIF(sa.analysis_data->'analysis'->'financial_ratios'->>'dividendYieldTTM', '')::numeric,
                    0
                ) > 0)"""
            
            # EXCLUDE symbols already in user's portfolios
            if user_sub:
                stock_query += """ AND sa.symbol NOT IN (
                    SELECT jsonb_array_elements(holdings)->>'symbol' 
                    FROM user_portfolios 
                    WHERE user_id = :uid
                )"""

            # Country filter
            if p_country_pref == "US":
                stock_query += " AND COALESCE(sc.data->>'country', 'US') = 'US'"
            
            stock_query += f" ORDER BY ai_score DESC LIMIT {stock_limit}"
        
            print(f"Executing Stock Query:\n{stock_query}\nParams: {params}")
            stock_result = await conn.execute(text(stock_query), params)
            stocks = [dict(r._mapping) for r in stock_result.fetchall()]

            # 3. Format for frontend ScreenedTicker type
            for s in stocks:
                formatted_stocks.append({
                    "symbol": s.get("symbol"),
                    "name": s.get("name"),
                    "sector": s.get("sector") or "Other",
                    "marketCap": "mid", # simplified mapping
                    "style": "blend", # simplified mapping
                    "dividendYield": "medium" if float(s.get("dividend_yield") or 0) > 0.02 else "none",
                    "volatility": "high" if float(s.get("beta") or 1) > 1.2 else "low" if float(s.get("beta") or 1) < 0.8 else "medium",
                    "riskLevel": 5 if float(s.get("beta") or 1) > 1.3 else 1 if float(s.get("beta") or 1) < 0.8 else 3,
                    "isESG": False,
                    "country": "US",
                    "exchange": "NYSE",
                    "instrumentType": "stock",
                    "ai_score": float(s.get("ai_score") or 0),
                    "ai_analysis": s.get("final_verdict")
                })
        
        # 3. Fetch top ETFs if requested
        formatted_etfs = []
        if etf_limit > 0:
            etf_query = f"""
                SELECT 
                    sa.symbol,
                    sa.analysis_data->'stock'->>'name' as name,
                    COALESCE(sc.data->>'sector', 'ETF') as sector,
                    COALESCE(NULLIF(split_part(sa.analysis_data->'analysis'->>'ai_score', '/', 1), 'NA')::numeric, 0) as ai_score,
                    sa.analysis_data->'analysis'->>'final_verdict' as final_verdict
                FROM (
                    SELECT DISTINCT ON (symbol) * 
                    FROM stock_analyses 
                    WHERE status = 'complete' 
                    ORDER BY symbol, updated_at DESC
                ) sa
                LEFT JOIN screener_cache sc ON sc.symbol = sa.symbol
                WHERE COALESCE(sa.analysis_data->'stock'->>'isETF', 'false') IN ('true', 'True')
            """
            
            if user_sub:
                etf_query += """ AND sa.symbol NOT IN (
                    SELECT jsonb_array_elements(holdings)->>'symbol' 
                    FROM user_portfolios 
                    WHERE user_id = :uid
                )"""
                
            etf_query += f" ORDER BY ai_score DESC LIMIT {etf_limit}"
            print(f"Executing ETF Query:\n{etf_query}")
            etf_result = await conn.execute(text(etf_query), {"uid": user_sub})
            etfs = [dict(r._mapping) for r in etf_result.fetchall()]
            
            for e in etfs:
                formatted_etfs.append({
                    "symbol": e.get("symbol"),
                    "name": e.get("name"),
                    "sector": "ETF",
                    "marketCap": "all",
                    "style": "blend",
                    "dividendYield": "medium",
                    "volatility": "medium",
                    "riskLevel": 3,
                    "isESG": False,
                    "country": "US",
                    "exchange": "NYSE",
                    "instrumentType": "etf",
                    "ai_score": float(e.get("ai_score") or 0),
                    "ai_analysis": e.get("final_verdict")
                })
        
        # Deduplicate candidates across stock and ETF lists
        candidates = []
        seen_symbols = set()
        
        for item in formatted_stocks + formatted_etfs:
            sym = item.get("symbol")
            if sym and sym not in seen_symbols:
                candidates.append(item)
                seen_symbols.add(sym)
        
        return {
            "tickers": candidates,
            "message": f"Found {len(formatted_stocks)} stocks and {len(formatted_etfs)} ETFs matching your profile."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Recommendations Fetch Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch recommendations: {str(e)}")

@router.delete("/user-portfolios/{portfolio_id}")
async def delete_portfolio(portfolio_id: str, claims: Dict = Depends(verify_token), conn = Depends(get_db_connection)):
    """Delete a user's portfolio."""
    user_sub = claims.get("sub")
    if not user_sub:
        raise HTTPException(status_code=401, detail="Invalid User")
        
    try:
        from sqlalchemy import text
        # Verify ownership before deleting
        result = await conn.execute(text("DELETE FROM user_portfolios WHERE id = :pid AND user_id = :uid RETURNING id"), {
            "pid": portfolio_id,
            "uid": user_sub
        })
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Portfolio not found or unauthorized")
            
        await conn.commit()
        return {"status": "success", "message": "Portfolio deleted"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Portfolio Delete Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete portfolio")

@router.get("/portfolio/price-snapshots")
async def get_price_snapshots(symbols: str = "", claims: Dict = Depends(verify_token), conn = Depends(get_db_connection)):
    """Fetch user's price snapshots for specific symbols."""
    user_sub = claims.get("sub")
    if not user_sub:
        raise HTTPException(status_code=401, detail="Invalid User")
        
    symbol_list = [s.strip().upper() for s in symbols.split(",")] if symbols else []
    
    try:
        from sqlalchemy import text
        # Lazy table creation if needed
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS portfolio_price_snapshots (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                symbol TEXT NOT NULL,
                price NUMERIC NOT NULL,
                captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(user_id, symbol)
            )
        """))
        await conn.commit()
        
        query = "SELECT symbol, price, captured_at FROM portfolio_price_snapshots WHERE user_id = :uid"
        params = {"uid": user_sub}
        
        if symbol_list:
            query += " AND symbol = ANY(:symbols)"
            params["symbols"] = symbol_list
            
        result = await conn.execute(text(query), params)
        rows = result.fetchall()
        
        snapshots = []
        for row in rows:
            snapshots.append({
                "symbol": row[0],
                "price": float(row[1]),
                "captured_at": row[2].isoformat() if row[2] else None
            })
            
        return snapshots
    except Exception as e:
        print(f"Price Snapshots Fetch Error: {e}")
        return []

from typing import Any
@router.post("/portfolio/price-snapshots")
async def save_price_snapshots(request: Dict[str, Any], claims: Dict = Depends(verify_token), conn = Depends(get_db_connection)):
    """Save user's price snapshots for a list of symbols."""
    user_sub = claims.get("sub")
    if not user_sub:
        raise HTTPException(status_code=401, detail="Invalid User")
        
    snapshots = request.get("snapshots", [])
    if not snapshots:
        return {"status": "success", "message": "No snapshots provided"}
        
    try:
        from sqlalchemy import text
        from datetime import datetime
        for snap in snapshots:
            symbol = snap.get("symbol")
            price = snap.get("price")
            captured_at = snap.get("captured_at")
            if isinstance(captured_at, str):
                captured_at = datetime.fromisoformat(captured_at.replace("Z", "+00:00"))
            if not symbol or price is None:
                continue
                
            await conn.execute(text("""
                INSERT INTO portfolio_price_snapshots (user_id, symbol, price, captured_at)
                VALUES (:uid, :symbol, :price, COALESCE(:captured_at, NOW()))
                ON CONFLICT (user_id, symbol)
                DO UPDATE SET price = EXCLUDED.price, captured_at = EXCLUDED.captured_at
            """), {
                "uid": user_sub,
                "symbol": symbol.upper(),
                "price": float(price),
                "captured_at": captured_at
            })
            
        await conn.commit()
        return {"status": "success", "message": f"Saved {len(snapshots)} snapshots"}
    except Exception as e:
        print(f"Price Snapshots Save Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save snapshots")

