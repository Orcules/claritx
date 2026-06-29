from fastapi import APIRouter, Depends
from sqlalchemy import text
from database import get_db_connection
from auth import verify_token, optional_token
from typing import List, Dict, Any, Optional

router = APIRouter()


@router.get("/stocks/directory")
async def get_stocks_directory(
    sector: Optional[str] = None,
    page: int = 1,
    per_page: int = 48,
    conn = Depends(get_db_connection)
):
    """
    Public paginated stock directory. Returns symbol, name, sector, ai_score
    from stock_analyses. Replaces the old Supabase ticker_cache approach.
    """
    try:
        offset = (page - 1) * per_page
        params: dict = {"limit": per_page, "offset": offset}

        sector_filter = ""
        if sector:
            sector_filter = "AND sector = :sector"
            params["sector"] = sector

        query = text(f"""
            WITH latest_analyses AS (
                SELECT DISTINCT ON (symbol)
                    symbol,
                    analysis_data
                FROM stock_analyses
                WHERE status = 'complete'
                ORDER BY symbol, created_at DESC
            ),
            scored AS (
                SELECT
                    symbol,
                    analysis_data->'stock'->>'name' as name,
                    COALESCE(analysis_data->'stock'->>'sector', '') as sector,
                    analysis_data->'analysis'->>'ai_score' as raw_score
                FROM latest_analyses
            )
            SELECT
                symbol,
                name,
                sector,
                COALESCE(
                    NULLIF(
                        REGEXP_REPLACE(split_part(raw_score, '/', 1), '[^0-9.]', '', 'g'), 
                        ''
                    )::numeric, 
                    0
                ) as final_ai_score
            FROM scored
            WHERE raw_score IS NOT NULL 
              AND raw_score != 'NA'
              {sector_filter}
            ORDER BY final_ai_score DESC NULLS LAST
            LIMIT :limit OFFSET :offset
        """)

        result = await conn.execute(query, params)
        rows = result.mappings().all()

        return {
            "data": [dict(row) for row in rows],
            "total": 0, # Frontend uses static fallback for total
            "page": page,
            "per_page": per_page
        }

    except Exception as e:
        print(f"Stocks Directory Error: {e}")
        import traceback
        traceback.print_exc()
        return {"data": [], "total": 0, "page": page, "per_page": per_page}


@router.get("/stocks/detail/{symbol}")
async def get_stock_detail(symbol: str, conn = Depends(get_db_connection)):
    """
    Public single-stock detail page data from stock_analyses.
    Returns enriched data for the SEO stock page, replacing the old
    Supabase ticker_cache lookup.
    """
    try:
        query = text("""
            SELECT
                sa.symbol,
                sa.analysis_data,
                sa.completed_at,
                sa.updated_at
            FROM stock_analyses sa
            WHERE sa.symbol = :symbol AND sa.status = 'complete'
            ORDER BY sa.completed_at DESC
            LIMIT 1
        """)
        result = await conn.execute(query, {"symbol": symbol.upper()})
        row = result.mappings().fetchone()

        if not row:
            return None

        from database import parse_json
        ad = parse_json(row["analysis_data"]) or {}
        stock = ad.get("stock", {})
        analysis = ad.get("analysis", {})
        ratios = analysis.get("financial_ratios", {})

        # Parse ai_score
        raw_score = analysis.get("ai_score", "")
        try:
            score_val = float(raw_score.split("/")[0].strip()) if raw_score and raw_score != "NA" else None
        except (ValueError, AttributeError):
            score_val = None

        # Build fmp_data_json-compatible structure for frontend
        fmp_data = {
            "profile": {
                "companyName": stock.get("name"),
                "exchange": stock.get("exchange"),
                "exchangeFullName": stock.get("exchangeFullName") or stock.get("exchange"),
                "sector": stock.get("sector"),
                "industry": stock.get("industry"),
                "city": stock.get("city"),
                "state": stock.get("state"),
                "country": stock.get("country"),
                "description": stock.get("description"),
                "mktCap": _safe_float(stock.get("marketCap")),
                "beta": _safe_float(stock.get("beta")),
                "price": _safe_float(stock.get("price")),
                "website": stock.get("website"),
                "ceo": stock.get("ceo"),
                "fullTimeEmployees": _safe_int(stock.get("fullTimeEmployees")),
                "ipoDate": stock.get("ipoDate"),
            },
            "keyMetrics": {
                "peRatioTTM": _safe_float(ratios.get("peRatioTTM")),
                "priceToBookRatioTTM": _safe_float(ratios.get("priceToBookRatioTTM")),
                "dividendYieldTTM": _safe_float(ratios.get("dividendYieldTTM") or ratios.get("dividendYielTTM")),
                "roeTTM": _safe_float(ratios.get("returnOnEquityTTM")),
                "debtToEquityTTM": _safe_float(ratios.get("debtEquityRatioTTM")),
                "currentRatioTTM": _safe_float(ratios.get("currentRatioTTM")),
            },
            "ratios": {
                "returnOnEquityTTM": _safe_float(ratios.get("returnOnEquityTTM")),
                "priceEarningsRatioTTM": _safe_float(ratios.get("peRatioTTM")),
                "dividendYieldTTM": _safe_float(ratios.get("dividendYieldTTM") or ratios.get("dividendYielTTM")),
            },
        }

        # Determine instrument type
        is_etf = str(stock.get("isETF", "false")).lower() == "true"
        instrument_type = "etf" if is_etf else "stock"

        return {
            "symbol": row["symbol"],
            "name": stock.get("name", row["symbol"]),
            "research_summary": analysis.get("final_verdict"),
            "final_ai_score": int(score_val * 1000) if score_val else None,
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            "fmp_data_json": fmp_data,
            "instrument_type": instrument_type,
        }

    except Exception as e:
        print(f"Stock Detail Error for {symbol}: {e}")
        import traceback
        traceback.print_exc()
        return None


def _safe_float(val) -> float | None:
    """Safely convert a value to float, stripping non-numeric chars."""
    if val is None:
        return None
    try:
        import re
        cleaned = re.sub(r'[^0-9.\-]', '', str(val))
        return float(cleaned) if cleaned else None
    except (ValueError, TypeError):
        return None


def _safe_int(val) -> int | None:
    if val is None:
        return None
    try:
        import re
        cleaned = re.sub(r'[^0-9]', '', str(val))
        return int(cleaned) if cleaned else None
    except (ValueError, TypeError):
        return None


@router.get("/rankings/stock")
async def get_stock_ranking(symbol: str, conn = Depends(get_db_connection)):
    """
    Returns ranking data and key metrics for a single stock symbol.
    Reads from the latest completed analysis stored in stock_analyses.
    """
    try:
        query = text("""
            WITH latest AS (
                SELECT analysis_data
                FROM stock_analyses
                WHERE symbol = :symbol AND status = 'complete'
                ORDER BY completed_at DESC
                LIMIT 1
            )
            SELECT
                COALESCE(
                    NULLIF(REGEXP_REPLACE(l.analysis_data->'stock'->>'price', '[^0-9.]', '', 'g'), '')::numeric,
                    0
                ) as current_price,
                COALESCE(
                    NULLIF(REGEXP_REPLACE(l.analysis_data->'stock'->>'marketCap', '[^0-9.]', '', 'g'), '')::numeric,
                    0
                ) as market_cap_value,
                COALESCE(
                    NULLIF(REGEXP_REPLACE(sc.data->>'beta', '[^0-9.]', '', 'g'), '')::numeric,
                    NULLIF(REGEXP_REPLACE(l.analysis_data->'stock'->>'beta', '[^0-9.]', '', 'g'), '')::numeric,
                    0
                ) as beta,
                COALESCE(
                    NULLIF(REGEXP_REPLACE(l.analysis_data->'analysis'->'financial_ratios'->>'peRatioTTM', '[^0-9.]', '', 'g'), '')::numeric,
                    0
                ) as pe_ratio,
                COALESCE(
                    NULLIF(REGEXP_REPLACE(l.analysis_data->'analysis'->'financial_ratios'->>'returnOnEquityTTM', '[^0-9.]', '', 'g'), '')::numeric,
                    0
                ) as roe,
                COALESCE(
                    NULLIF(REGEXP_REPLACE(l.analysis_data->'analysis'->'financial_ratios'->>'debtEquityRatioTTM', '[^0-9.]', '', 'g'), '')::numeric,
                    0
                ) as debt_to_equity,
                COALESCE(
                    NULLIF(REGEXP_REPLACE(l.analysis_data->'analysis'->'financial_ratios'->>'dividendYielTTM', '[^0-9.]', '', 'g'), '')::numeric,
                    NULLIF(REGEXP_REPLACE(l.analysis_data->'analysis'->'financial_ratios'->>'dividendYieldTTM', '[^0-9.]', '', 'g'), '')::numeric,
                    0
                ) as dividend_yield_value,
                COALESCE(
                    NULLIF(REGEXP_REPLACE(l.analysis_data->'analysis'->'financial_ratios'->>'netProfitMarginTTM', '[^0-9.]', '', 'g'), '')::numeric,
                    0
                ) as profit_margin,
                COALESCE(
                    NULLIF(REGEXP_REPLACE(l.analysis_data->'analysis'->'financial_ratios'->>'currentRatioTTM', '[^0-9.]', '', 'g'), '')::numeric,
                    0
                ) as current_ratio,
                l.analysis_data->'analysis'->'quality_flags' as ai_quality_flags
            FROM latest l
            LEFT JOIN screener_cache sc ON sc.symbol = :symbol
        """)

        result = await conn.execute(query, {"symbol": symbol.upper()})
        row = result.mappings().fetchone()

        if not row:
            return {}

        item = dict(row)

        if not item.get('ai_quality_flags'):
            item['ai_quality_flags'] = {'positives': [], 'concerns': []}

        return item

    except Exception as e:
        print(f"Stock Ranking Error: {e}")
        return {}


@router.get("/rankings/top-performing")
async def get_top_performing(limit: int = 5, conn = Depends(get_db_connection)):
    """
    Returns the top performing stocks based on AI Score.
    Falls back to 'final_verdict' parsing if 'ai_score' is missing.
    """
    try:
        # Query to extract ai_score from JSONB or fallback
        # We need to cast to numeric for sorting.
        # IF ai_score exists in analysis -> analysis_data->'analysis'->>'ai_score'
        
        query = text("""
            WITH latest_analyses AS (
                SELECT DISTINCT ON (symbol) symbol, analysis_data, updated_at
                FROM stock_analyses
                WHERE status = 'complete'
                AND analysis_data->'analysis'->>'ai_score' IS NOT NULL
                AND analysis_data->'analysis'->>'ai_score' != 'NA'
                ORDER BY symbol, completed_at DESC
            )
            SELECT 
                symbol,
                analysis_data->'stock'->>'name' as name,
                analysis_data->'stock'->>'sector' as sector,
                COALESCE(
                    NULLIF(REGEXP_REPLACE(split_part(analysis_data->'analysis'->>'ai_score', '/', 1), '[^0-9.]', '', 'g'), '')::numeric,
                    0
                ) as score,
                analysis_data->'analysis'->>'final_verdict' as verdict,
                updated_at
            FROM latest_analyses
            ORDER BY score DESC
            LIMIT :limit
        """)
        
        result = await conn.execute(query, {"limit": limit})
        rows = result.mappings().all()
        
        return [dict(row) for row in rows]
        
    except Exception as e:
        print(f"Ranking Error: {e}")
        return []

@router.get("/rankings/lowest-performing")
async def get_lowest_performing(limit: int = 5, conn = Depends(get_db_connection)):
    """
    Returns the lowest performing stocks based on AI Score.
    """
    try:
        query = text("""
            WITH latest_analyses AS (
                SELECT DISTINCT ON (symbol) symbol, analysis_data, updated_at
                FROM stock_analyses
                WHERE status = 'complete'
                AND analysis_data->'analysis'->>'ai_score' IS NOT NULL
                AND analysis_data->'analysis'->>'ai_score' != 'NA'
                ORDER BY symbol, completed_at DESC
            )
            SELECT 
                symbol,
                analysis_data->'stock'->>'name' as name,
                analysis_data->'stock'->>'sector' as sector,
                COALESCE(
                    NULLIF(REGEXP_REPLACE(split_part(analysis_data->'analysis'->>'ai_score', '/', 1), '[^0-9.]', '', 'g'), '')::numeric,
                    0
                ) as score,
                analysis_data->'analysis'->>'final_verdict' as verdict,
                updated_at
            FROM latest_analyses
            ORDER BY score ASC
            LIMIT :limit
        """)
        
        result = await conn.execute(query, {"limit": limit})
        rows = result.mappings().all()
        
        return [dict(row) for row in rows]
        
    except Exception as e:
        print(f"Ranking Error: {e}")
        return []

@router.get("/rankings/full-list")
async def get_full_ranking_list(
    limit: int = 100, 
    asset_type: str = 'stock', 
    claims: Optional[Dict] = Depends(optional_token)
):
    """
    Returns the rich data list for the AI Stock Rank page.
    JOINs with screener_cache for enrichment (beta, volume, etc.).
    Enforces premium limits: non-pro users get max 10 items.
    """
    try:
        async for conn in get_db_connection():
            # Pro check disabled — all users get full access
            is_pro = True
            effective_limit = limit

            query = text("""
            WITH latest_analyses AS (
                SELECT DISTINCT ON (symbol) symbol, analysis_data, completed_at, updated_at
                FROM stock_analyses
                WHERE status = 'complete'
                AND analysis_data->'analysis'->>'ai_score' IS NOT NULL
                AND analysis_data->'analysis'->>'ai_score' != 'NA'
                AND symbol NOT LIKE '%-USD'
                AND COALESCE(analysis_data->'stock'->>'type', '') != 'CRYPTO'
                ORDER BY symbol, completed_at DESC
            ),
            categorized_assets AS (
                SELECT 
                    sa.symbol,
                    sa.analysis_data->'stock'->>'name' as name,
                    COALESCE(sc.data->>'sector', sa.analysis_data->'stock'->>'sector') as sector,
                    sa.analysis_data->'stock'->>'industry' as industry,
                    COALESCE(
                        NULLIF(REGEXP_REPLACE(split_part(sa.analysis_data->'analysis'->>'ai_score', '/', 1), '[^0-9.]', '', 'g'), '')::numeric, 
                        0
                    ) as final_ai_score,
                    COALESCE(
                        NULLIF(REGEXP_REPLACE(sa.analysis_data->'stock'->>'price', '[^0-9.]', '', 'g'), '')::numeric,
                        0
                    ) as current_price,
                    COALESCE(
                        NULLIF(REGEXP_REPLACE(sa.analysis_data->'stock'->>'marketCap', '[^0-9.]', '', 'g'), '')::numeric,
                        NULLIF(REGEXP_REPLACE(sc.data->>'marketCap', '[^0-9.]', '', 'g'), '')::numeric,
                        0
                    ) as market_cap_value,
                    sa.analysis_data->'analysis'->>'final_verdict' as research_summary,
                    COALESCE(
                        NULLIF(REGEXP_REPLACE(sa.analysis_data->'analysis'->'financial_ratios'->>'peRatioTTM', '[^0-9.]', '', 'g'), '')::numeric,
                        0
                    ) as pe_ratio,
                    COALESCE(
                        NULLIF(REGEXP_REPLACE(sa.analysis_data->'analysis'->'financial_ratios'->>'returnOnEquityTTM', '[^0-9.]', '', 'g'), '')::numeric,
                        0
                    ) as roe,
                    COALESCE(
                        NULLIF(REGEXP_REPLACE(sc.data->>'beta', '[^0-9.]', '', 'g'), '')::numeric,
                        NULLIF(REGEXP_REPLACE(sa.analysis_data->'stock'->>'beta', '[^0-9.]', '', 'g'), '')::numeric,
                        0
                    ) as beta,
                    COALESCE(
                        NULLIF(REGEXP_REPLACE(sa.analysis_data->'analysis'->'financial_ratios'->>'debtEquityRatioTTM', '[^0-9.]', '', 'g'), '')::numeric,
                        0
                    ) as debt_to_equity,
                    COALESCE(
                        NULLIF(REGEXP_REPLACE(sa.analysis_data->'analysis'->'financial_ratios'->>'dividendYielTTM', '[^0-9.]', '', 'g'), '')::numeric,
                        NULLIF(REGEXP_REPLACE(sa.analysis_data->'analysis'->'financial_ratios'->>'dividendYieldTTM', '[^0-9.]', '', 'g'), '')::numeric,
                        0
                    ) as dividend_yield_value,
                    CASE 
                        WHEN (sa.analysis_data->'stock'->>'isETF')::text = 'true' OR (sc.data->>'isEtf')::text = 'true' THEN 'etf'
                        WHEN (sc.data->>'isFund')::text = 'true' THEN 'fund'
                        ELSE 'stock'
                    END as instrument_type,
                    sa.analysis_data->'analysis'->'quality_flags' as ai_quality_flags
                FROM latest_analyses sa
                LEFT JOIN screener_cache sc ON sc.symbol = sa.symbol
            ),
            ranked_assets AS (
                SELECT 
                    *,
                    ROW_NUMBER() OVER(PARTITION BY instrument_type ORDER BY final_ai_score DESC) as rank_in_type
                FROM categorized_assets
            )
            SELECT * 
            FROM ranked_assets 
            WHERE rank_in_type <= 10
            ORDER BY final_ai_score DESC
            LIMIT :limit
            """)
            
            # Limit to 40 since we only have 3-4 types, and top 10 per type means max 40 results total
            result = await conn.execute(query, {"limit": 40})
            rows = result.mappings().all()
            
            formatted_rows = []
            for row in rows:
                item = dict(row)
                
                # Derive volatility from beta
                beta_val = float(item.get('beta', 1.0))
                if beta_val < 0.8:
                    item['volatility'] = 'low'
                elif beta_val > 1.3:
                    item['volatility'] = 'high'
                else:
                    item['volatility'] = 'medium'
                
                # Confidence score fallback
                if 'ai_quality_flags' not in item or not item['ai_quality_flags']:
                    item['ai_quality_flags'] = {
                        'positives': [],
                        'concerns': [],
                        'data_coverage': 100
                    }
                
                formatted_rows.append(item)
                
            return formatted_rows
            
    except Exception as e:
        print(f"Full List Ranking Error: {e}")
        import traceback
        traceback.print_exc()
        return []
