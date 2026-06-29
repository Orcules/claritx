# Stock Tagging Guide for Filtering System

## Overview

This document explains how to tag stocks so they match the investor questionnaire-based filtering system.
Each stock must contain all fields described here to be properly filtered.

---

## Stock Data Structure (TickerData)

```typescript
interface TickerData {
  symbol: string;           // Stock symbol (e.g., "AAPL")
  name: string;             // Company name (e.g., "Apple Inc.")
  sector: string;           // Sector (see list below)
  marketCap: 'large' | 'mid' | 'small';
  style: 'value' | 'growth' | 'blend';
  dividendYield: 'none' | 'low' | 'medium' | 'high';
  volatility: 'low' | 'medium' | 'high';
  riskLevel: 1 | 2 | 3 | 4 | 5;
  isESG: boolean;
  country: string;          // Country (e.g., "US", "IL")
  exchange: string;         // Exchange (e.g., "NASDAQ", "NYSE", "TASE")
  instrumentType: 'stock' | 'etf';
}
```

---

## Field Details and Tagging Guidelines

### 1. Sector

Allowed sectors:
```
Technology        - Tech companies
Healthcare        - Healthcare & Pharma
Financials        - Banks, Insurance, Financial services
Consumer          - Consumer Discretionary
Consumer Staples  - Consumer essentials
Industrials       - Industrial companies
Energy            - Oil, Gas, Renewable energy
Utilities         - Infrastructure & utilities
Real Estate       - REITs and real estate
Materials         - Raw materials & chemicals
Communication     - Telecom & media
ETF               - Exchange Traded Funds (ETFs only)
```

**Filtering usage:** Users can choose sectors to exclude. Stocks in excluded sectors will not be displayed.

---

### 2. Market Cap (marketCap)

| Value | Definition | Examples |
|-------|------------|----------|
| `large` | Over $10B | Apple, Microsoft, Google |
| `mid` | $2B - $10B | CrowdStrike, Palo Alto |
| `small` | Under $2B | Elastic, DigitalOcean |

**Questionnaire mapping:**
- User selects `preferredMarketCap: 'large'` → Show only `large`
- User selects `preferredMarketCap: 'mid'` → Show `large` + `mid`
- User selects `preferredMarketCap: 'small'` → Show all
- User selects `preferredMarketCap: 'any'` → Show all

---

### 3. Investment Style (style)

| Value | Definition | Characteristics |
|-------|------------|-----------------|
| `value` | Value stocks | Low P/E, high dividends, mature companies |
| `growth` | Growth stocks | Rapid growth, usually no dividends, high P/E |
| `blend` | Blended | Combination of both |

**Questionnaire mapping:**
- `preferredStyle: 'value'` → Prefer `value` and `blend`
- `preferredStyle: 'growth'` → Prefer `growth` and `blend`
- `preferredStyle: 'blend'` → Show all

**Relevant question:**
> "What's your investment style preference?"
> - Value investing - Undervalued stocks
> - Growth investing - Fast-growing companies
> - Balanced approach - Mixed strategy

---

### 4. Dividend Yield (dividendYield)

| Value | Annual Yield Range |
|-------|-------------------|
| `none` | 0% |
| `low` | 0.1% - 1.5% |
| `medium` | 1.5% - 3.5% |
| `high` | Above 3.5% |

**Questionnaire mapping:**
- `dividendImportance: 'high'` → Filter out `none`
- `dividendImportance: 'medium'` → Prefer `medium`+ but don't filter
- `dividendImportance: 'low'` → No effect

**Relevant question:**
> "How important are dividends to you?"

---

### 5. Volatility

| Value | Estimated Beta | Characteristics |
|-------|----------------|-----------------|
| `low` | < 0.8 | Stable stocks, small fluctuations |
| `medium` | 0.8 - 1.2 | Reasonable fluctuations |
| `high` | > 1.2 | High fluctuations, speculative |

**Questionnaire mapping:**
- `volatilityTolerance: 'low'` → Filter out `high`
- `volatilityTolerance: 'medium'` → Filter `high` only for conservative investors
- `volatilityTolerance: 'high'` → Show all

**Relevant question:**
> "How do you feel about price volatility?"

---

### 6. Risk Level (riskLevel) ⭐ CRITICAL

| Level | Description | Examples |
|-------|-------------|----------|
| 1 | Very Conservative | Broad ETFs, defensive stocks (JNJ, KO, PG) |
| 2 | Conservative | Stable blue chips (AAPL, MSFT, V) |
| 3 | Moderate | Quality stocks with volatility (NVDA, GS, DIS) |
| 4 | Aggressive | Volatile growth stocks (AMD, TSLA, CRWD) |
| 5 | Very Aggressive | Small caps, speculative (ESTC, SRPT) |

**Calculating User Risk Level (riskBucket):**

The level is calculated from 8 questionnaire questions:

```
Starting points: 0

1. Time Horizon (timeHorizon):
   - "10+" years    → +3 points
   - "6-10" years   → +2 points
   - "3-5" years    → +1 point
   - "0-2" years    → 0 points

2. Maximum Acceptable Loss (maxAcceptableLoss):
   - 30% or more    → +3 points
   - 20%            → +2 points
   - 10%            → +1 point
   - 5%             → 0 points

3. Market Drop Reaction (marketDropReaction):
   - "buy_more"     → +2 points
   - "wait"         → +1 point
   - "sell"         → -1 point
   - "unsure"       → 0 points

4. Risk Preference (riskPreference):
   - "returns"      → +2 points
   - "middle"       → +1 point
   - "sleep"        → 0 points

5. Liquidity Need (needsLiquiditySoon):
   - false          → 0 points
   - true           → -1 point

6. Emergency Fund (emergencyFundMonths):
   - "12+"          → +1 point
   - "0-3"          → -1 point
   - other          → 0 points

7. Investment Experience (investingYears):
   - "5+"           → +1 point
   - "0"            → -1 point
   - other          → 0 points

8. Volatility Tolerance (volatilityTolerance):
   - "high"         → +1 point
   - "low"          → -1 point
   - "medium"       → 0 points

Conversion to Risk Level:
- points ≤ 0  → riskBucket = 1
- points 1-2  → riskBucket = 2
- points 3-5  → riskBucket = 3
- points 6-8  → riskBucket = 4
- points ≥ 9  → riskBucket = 5
```

**Risk Level Filtering:**
```
Stocks are shown if: ticker.riskLevel ≤ user.riskBucket + 1
```

Example:
- Investor with riskBucket=2 will see stocks with riskLevel 1, 2, or 3
- Investor with riskBucket=4 will see stocks with riskLevel 1, 2, 3, 4, or 5

---

### 7. Instrument Type (instrumentType)

| Value | Description |
|-------|-------------|
| `stock` | Individual stock |
| `etf` | Exchange Traded Fund |

**Questionnaire mapping:**
- `instrumentType: 'etf'` → Show only ETFs
- `instrumentType: 'stocks'` → Show only stocks
- `instrumentType: 'mixed'` → Show all

**Relevant question:**
> "What type of investments are you interested in?"
> - ETFs only
> - Individual stocks only  
> - Mixed

---

## Complete Filtering Logic

```typescript
function filterTickers(ticker: TickerData, filters: InvestorFilters): boolean {
  
  // 1. Filter by risk level
  if (ticker.riskLevel > filters.riskBucket + 1) {
    return false;
  }
  
  // 2. Filter by instrument type
  if (filters.instrumentType === 'etf' && ticker.instrumentType !== 'etf') {
    return false;
  }
  if (filters.instrumentType === 'stocks' && ticker.instrumentType !== 'stock') {
    return false;
  }
  
  // 3. Filter by excluded sectors
  if (filters.excludedSectors.includes(ticker.sector)) {
    return false;
  }
  
  // 4. Filter by market cap
  if (filters.preferredMarketCap === 'large' && ticker.marketCap !== 'large') {
    return false;
  }
  if (filters.preferredMarketCap === 'mid' && ticker.marketCap === 'small') {
    return false;
  }
  
  // 5. Filter by volatility
  if (filters.volatilityTolerance === 'low' && ticker.volatility === 'high') {
    return false;
  }
  if (filters.volatilityTolerance === 'medium' && 
      ticker.volatility === 'high' && 
      filters.riskBucket < 3) {
    return false;
  }
  
  // 6. Filter by dividend
  if (filters.dividendImportance === 'high' && ticker.dividendYield === 'none') {
    return false;
  }
  
  return true; // Stock passes all filters
}
```

---

## Tagging Examples

### Example 1: Conservative Stock
```json
{
  "symbol": "JNJ",
  "name": "Johnson & Johnson",
  "sector": "Healthcare",
  "marketCap": "large",
  "style": "value",
  "dividendYield": "medium",
  "volatility": "low",
  "riskLevel": 1,
  "isESG": true,
  "country": "US",
  "exchange": "NYSE",
  "instrumentType": "stock"
}
```
**Why riskLevel=1?** Defensive blue chip, low volatility, stable dividend.

### Example 2: Aggressive Growth Stock
```json
{
  "symbol": "TSLA",
  "name": "Tesla Inc.",
  "sector": "Consumer",
  "marketCap": "large",
  "style": "growth",
  "dividendYield": "none",
  "volatility": "high",
  "riskLevel": 4,
  "isESG": true,
  "country": "US",
  "exchange": "NASDAQ",
  "instrumentType": "stock"
}
```
**Why riskLevel=4?** Very high volatility, no dividend, depends on future expectations.

### Example 3: Conservative ETF
```json
{
  "symbol": "VOO",
  "name": "Vanguard S&P 500 ETF",
  "sector": "ETF",
  "marketCap": "large",
  "style": "blend",
  "dividendYield": "low",
  "volatility": "low",
  "riskLevel": 1,
  "isESG": false,
  "country": "US",
  "exchange": "NYSE",
  "instrumentType": "etf"
}
```
**Why riskLevel=1?** Broad diversification, tracks S&P 500, low risk.

### Example 4: Speculative Small Cap
```json
{
  "symbol": "DOCN",
  "name": "DigitalOcean Holdings",
  "sector": "Technology",
  "marketCap": "small",
  "style": "growth",
  "dividendYield": "none",
  "volatility": "high",
  "riskLevel": 5,
  "isESG": true,
  "country": "US",
  "exchange": "NYSE",
  "instrumentType": "stock"
}
```
**Why riskLevel=5?** Small cap, high volatility, young company.

---

## Key Investor Combination Matrix

| Risk Bucket | Style | Instrument | Example Stocks |
|-------------|-------|------------|----------------|
| 1-2 (Conservative) | Value | ETF | VOO, VYM, SCHD, AGG |
| 1-2 (Conservative) | Value | Stocks | JNJ, KO, PG, V |
| 3 (Moderate) | Blend | Mixed | AAPL, MSFT, QQQ, JPM |
| 3 (Moderate) | Growth | ETF | QQQ, XLK, VGT |
| 4-5 (Aggressive) | Growth | Stocks | NVDA, AMD, TSLA, CRWD |
| 4-5 (Aggressive) | Growth | ETF | IWM, VWO, XLE |

---

## Field Summary by Importance

| Field | Required | Filtering Significance |
|-------|----------|------------------------|
| riskLevel | ✅ | Critical - Filters by risk profile |
| instrumentType | ✅ | Critical - ETF/Stock |
| sector | ✅ | Critical - Excluded sectors |
| volatility | ✅ | Important - Volatility tolerance |
| marketCap | ✅ | Important - Size preference |
| dividendYield | ✅ | Medium - Dividend importance |
| style | ✅ | Medium - Investment style |
| isESG | ⚠️ | Not currently used |

---

## FAQ

**Q: What if a stock fits multiple risk levels?**
A: Choose the higher level. Better to restrict than to show a risky stock to a conservative investor.

**Q: How do I tag a stock that is both Value and Growth?**
A: Use `blend`.

**Q: What about non-US stocks?**
A: They can be added. Just ensure `exchange` is correct and `country` is updated.

**Q: Should tags be updated regularly?**
A: Yes, quarterly review is recommended - volatility and dividends can change.

---

## Questionnaire to Filter Mapping Summary

| Questionnaire Field | Filter Field | Possible Values |
|--------------------|--------------|-----------------|
| timeHorizon | (affects riskBucket) | '0-2', '3-5', '6-10', '10+' |
| maxAcceptableLoss | (affects riskBucket) | 5, 10, 20, 30, 40 |
| marketDropReaction | (affects riskBucket) | 'sell', 'wait', 'buy_more', 'unsure' |
| riskPreference | (affects riskBucket) | 'sleep', 'middle', 'returns' |
| needsLiquiditySoon | (affects riskBucket) | true, false |
| emergencyFundMonths | (affects riskBucket) | '0-3', '4-6', '7-12', '12+' |
| investingYears | (affects riskBucket) | '0', '1-2', '3-5', '5+' |
| volatilityTolerance | volatilityTolerance | 'low', 'medium', 'high' |
| preferredStyle | preferredStyle | 'value', 'growth', 'blend' |
| preferredMarketCap | preferredMarketCap | 'small', 'mid', 'large', 'any' |
| dividendImportance | dividendImportance | 'low', 'medium', 'high' |
| instrumentType | instrumentType | 'etf', 'stocks', 'mixed' |
| excludedSectors | excludedSectors | Array of sector names |
