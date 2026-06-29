"""
Portfolio Recommendation Engine.

Scores analyzed stocks against a user's InvestorProfile.
Returns top 10 stocks + 5 ETFs ranked by compatibility score.
"""
import json
from typing import Dict, Any, List, Tuple


def safe_float(val, default=0.0):
    """Safely convert any value to float."""
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def score_risk_tolerance(beta: float, preference: str) -> float:
    """
    Score 0-100 based on beta vs risk preference.
    Conservative wants beta < 0.8, Aggressive wants beta > 1.2
    """
    if preference == "conservative":
        if beta <= 0.6: return 100
        if beta <= 0.8: return 85
        if beta <= 1.0: return 60
        if beta <= 1.2: return 30
        return 10  # Very high beta = bad for conservative
    elif preference == "aggressive":
        if beta >= 1.5: return 100
        if beta >= 1.2: return 85
        if beta >= 1.0: return 65
        if beta >= 0.8: return 40
        return 20  # Low beta = boring for aggressive
    else:  # moderate
        if 0.8 <= beta <= 1.2: return 100
        if 0.6 <= beta <= 1.4: return 75
        return 40


def score_time_horizon(technicals: Dict, preference: str) -> float:
    """
    Score based on SMA alignment and RSI vs time horizon preference.
    Short-term: needs positive momentum now
    Long-term: technicals matter less
    """
    price = safe_float(technicals.get("current_price") or technicals.get("price"))
    sma20 = safe_float(technicals.get("sma20") or technicals.get("sma_20"))
    sma50 = safe_float(technicals.get("sma50") or technicals.get("sma_50"))
    sma200 = safe_float(technicals.get("sma200") or technicals.get("sma_200"))
    rsi = safe_float(technicals.get("rsi"))
    
    if not price or not sma200:
        return 50  # Unknown = neutral
    
    if preference == "short":
        # Must have positive momentum
        if price > sma20 > sma50: return 95
        if price > sma20: return 75
        if price > sma50: return 55
        if rsi < 30: return 35  # Oversold bounce possible
        return 15  # Downtrend = avoid
    elif preference == "long":
        # Fundamentals matter most, technicals secondary
        # Below all SMAs could be a value buy
        if price > sma200: return 85
        if price > sma50: return 70
        if rsi < 30: return 60  # Deep value opportunity
        return 50  # Still ok for long term if fundamentals strong
    else:  # medium
        if price > sma50 > sma200: return 90
        if price > sma200: return 70
        if rsi < 35: return 55  # Contrarian dip buy
        return 30


def score_income_vs_growth(dividend_yield: float, payout_ratio: float, preference: str) -> float:
    """
    Score based on dividend characteristics.
    Income: wants high yield + sustainable payout
    Growth: doesn't care about dividends
    """
    if preference == "income":
        if dividend_yield <= 0:
            return 5  # No dividend = terrible for income
        score = 0
        # Yield scoring (higher = better, cap at 6%)
        if dividend_yield >= 0.04: score += 60
        elif dividend_yield >= 0.02: score += 45
        elif dividend_yield >= 0.01: score += 25
        else: score += 10
        # Payout sustainability (lower ratio = more sustainable)
        if 0.2 <= payout_ratio <= 0.6: score += 40  # Sweet spot
        elif payout_ratio < 0.2: score += 30  # Low payout
        elif payout_ratio <= 0.8: score += 20  # Getting risky
        else: score += 5  # Unsustainable
        return min(score, 100)
    elif preference == "growth":
        # Growth investors prefer companies reinvesting profits
        if dividend_yield <= 0: return 80  # No dividend = reinvesting
        if dividend_yield < 0.01: return 70  # Tiny yield = mostly reinvesting
        if payout_ratio < 0.3: return 60  # Low payout = still mostly growth
        return 40  # High payout = less growth focus
    else:  # both
        if dividend_yield > 0.01 and payout_ratio < 0.6:
            return 85  # Good yield + sustainable
        if dividend_yield > 0:
            return 60  # Some dividend
        return 50  # No dividend but still ok


def score_value_or_growth(pe_ratio: float, peg_ratio: float, preference: str) -> float:
    """
    Score based on P/E and PEG ratios.
    Value: wants low P/E
    Growth: wants low PEG (growth justifies price)
    """
    if preference == "value":
        if pe_ratio <= 0: return 30  # Negative P/E = unprofitable
        if pe_ratio <= 12: return 95
        if pe_ratio <= 18: return 80
        if pe_ratio <= 25: return 55
        if pe_ratio <= 35: return 30
        return 10  # Very expensive
    elif preference == "growth":
        if peg_ratio <= 0: return 40  # Can't evaluate
        if peg_ratio <= 0.8: return 100  # Undervalued growth
        if peg_ratio <= 1.2: return 85
        if peg_ratio <= 2.0: return 65
        if peg_ratio <= 3.0: return 40
        return 15  # Growth doesn't justify price
    else:  # blend
        score = 0
        # Balance P/E and PEG
        if 0 < pe_ratio <= 25: score += 50
        elif 0 < pe_ratio <= 40: score += 30
        else: score += 15
        
        if 0 < peg_ratio <= 1.5: score += 50
        elif 0 < peg_ratio <= 2.5: score += 35
        else: score += 15
        return min(score, 100)


def score_sector_match(stock_sector: str, preferred_sectors: List[str]) -> float:
    """Bonus if stock's sector matches user preference. Empty = all sectors ok."""
    if not preferred_sectors:
        return 75  # No preference = neutral positive
    if stock_sector and stock_sector in preferred_sectors:
        return 100
    return 30  # Sector mismatch = penalize but don't exclude


def score_stock(
    stock_data: Dict,
    analysis_data: Dict,
    screener_data: Dict,
    profile: Dict
) -> float:
    """
    Master scoring function. Computes weighted compatibility score (0-100).
    
    stock_data: from analysis_data->'stock'
    analysis_data: from analysis_data->'analysis'
    screener_data: from screener_cache.data
    profile: user's InvestorProfile dict
    """
    # Extract data points
    beta = safe_float(screener_data.get("beta") or stock_data.get("beta"), 1.0)
    ai_score = safe_float(analysis_data.get("ai_score"), 50)
    
    # Technicals (merge sources)
    technicals = stock_data.get("technicals", {})
    tech_yahoo = analysis_data.get("technicals_yahoo", {})
    merged_tech = {**tech_yahoo, **technicals}  # stock technicals override
    merged_tech["price"] = safe_float(stock_data.get("price"))
    
    # Financial ratios
    fin_ratios = analysis_data.get("financial_ratios", {})
    pe_ratio = safe_float(fin_ratios.get("priceToEarningsRatioTTM"), 0)
    peg_ratio = safe_float(fin_ratios.get("priceToEarningsGrowthRatioTTM"), 0)
    dividend_yield = safe_float(fin_ratios.get("dividendYieldTTM") or screener_data.get("lastAnnualDividend", 0))
    payout_ratio = safe_float(fin_ratios.get("dividendPayoutRatioTTM"), 0)
    
    # If dividend_yield came from screener as absolute value, convert to ratio
    if dividend_yield > 1:  # It's an absolute $ amount, not a ratio
        price = safe_float(stock_data.get("price"), 1)
        dividend_yield = dividend_yield / price if price > 0 else 0
    
    sector = screener_data.get("sector") or stock_data.get("sector", "")
    
    # --- Compute sub-scores ---
    risk_score = score_risk_tolerance(beta, profile.get("risk_tolerance", "moderate"))
    horizon_score = score_time_horizon(merged_tech, profile.get("time_horizon", "medium"))
    income_score = score_income_vs_growth(dividend_yield, payout_ratio, profile.get("income_vs_growth", "both"))
    valuation_score = score_value_or_growth(pe_ratio, peg_ratio, profile.get("value_or_growth", "blend"))
    sector_score = score_sector_match(sector, profile.get("sectors", []))
    
    # AI score normalized to 0-100 (already 0-100 scale)
    ai_fit = min(ai_score, 100)
    
    # Volume / liquidity (simple pass/fail → bonus)
    volume = safe_float(screener_data.get("volume") or stock_data.get("volume"), 0)
    min_vol = profile.get("min_volume", 0)
    liquidity_score = 80 if volume >= max(min_vol, 100000) else 40
    
    # --- Weighted combination ---
    total = (
        ai_fit * 0.20 +
        risk_score * 0.20 +
        income_score * 0.15 +
        valuation_score * 0.15 +
        horizon_score * 0.15 +
        sector_score * 0.10 +
        liquidity_score * 0.05
    )
    
    return round(total, 1)


def passes_hard_filters(
    stock_data: Dict,
    screener_data: Dict,
    analysis_data: Dict,
    profile: Dict
) -> bool:
    """Check hard filters — if fails, stock is excluded entirely."""
    # Market cap filter (skip for ETFs/funds — their "market cap" is AUM, not company size)
    is_etf = (
        str(stock_data.get("isETF", "false")).lower() == "true" or
        str(screener_data.get("isEtf", "false")).lower() == "true" or
        str(screener_data.get("isFund", "false")).lower() == "true"
    )
    
    if not is_etf:
        market_cap_pref = profile.get("market_cap", "all")
        market_cap = safe_float(screener_data.get("marketCap") or stock_data.get("marketCap"), 0)
        
        if market_cap_pref == "large" and market_cap < 10_000_000_000:
            return False
        elif market_cap_pref == "mid" and (market_cap < 2_000_000_000 or market_cap > 10_000_000_000):
            return False
    
    # Min AI score
    min_ai = safe_float(profile.get("min_ai_score", 0))
    ai_score = safe_float(analysis_data.get("ai_score"), 0)
    if min_ai > 0 and ai_score < min_ai:
        return False
    
    # Min volume
    min_vol = profile.get("min_volume", 0)
    volume = safe_float(screener_data.get("volume") or stock_data.get("volume"), 0)
    if min_vol > 0 and volume < min_vol:
        return False
    
    # Country
    country_pref = profile.get("country", "all")
    if country_pref != "all":
        country = screener_data.get("country", "US")
        if country != country_pref:
            return False
    
    return True


def rank_portfolio(
    analyses: List[Dict],
    screener_lookup: Dict[str, Dict],
    profile: Dict
) -> Tuple[List[Dict], List[Dict]]:
    """
    Rank all analyzed stocks against profile.
    Returns (top_stocks, top_etfs) tuples.
    """
    stock_scores = []
    etf_scores = []
    
    for entry in analyses:
        symbol = entry.get("symbol", "")
        analysis_json = entry.get("analysis_data", {})
        
        if isinstance(analysis_json, str):
            try:
                analysis_json = json.loads(analysis_json)
            except:
                continue
        
        stock_data = analysis_json.get("stock", {})
        analysis_data = analysis_json.get("analysis", {})
        screener_data = screener_lookup.get(symbol, {})
        
        # Check if ETF
        is_etf = (
            str(stock_data.get("isETF", "false")).lower() == "true" or
            str(screener_data.get("isEtf", "false")).lower() == "true"
        )
        
        # Apply hard filters
        if not passes_hard_filters(stock_data, screener_data, analysis_data, profile):
            continue
        
        # Score
        fit_score = score_stock(stock_data, analysis_data, screener_data, profile)
        
        result = {
            "symbol": symbol,
            "name": stock_data.get("name", "Unknown"),
            "sector": screener_data.get("sector") or stock_data.get("sector", ""),
            "price": safe_float(stock_data.get("price")),
            "beta": safe_float(screener_data.get("beta") or stock_data.get("beta")),
            "ai_score": safe_float(analysis_data.get("ai_score")),
            "fit_score": fit_score,
            "is_etf": is_etf,
            "market_cap": safe_float(screener_data.get("marketCap") or stock_data.get("marketCap")),
            "volume": safe_float(screener_data.get("volume") or stock_data.get("volume")),
            "dividend_yield": safe_float(
                (analysis_data.get("financial_ratios") or {}).get("dividendYieldTTM") or 0
            ),
            "verdict_summary": (analysis_data.get("final_verdict", "")[:200] + "...") if analysis_data.get("final_verdict") else ""
        }
        
        if is_etf:
            etf_scores.append(result)
        else:
            stock_scores.append(result)
    
    # Sort by fit_score descending
    stock_scores.sort(key=lambda x: x["fit_score"], reverse=True)
    etf_scores.sort(key=lambda x: x["fit_score"], reverse=True)
    
    return stock_scores[:10], etf_scores[:5]
