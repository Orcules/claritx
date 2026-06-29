import { useState, useCallback, useEffect } from 'react';
import { InvestorProfile, RiskProfile, Portfolio, PortfolioHolding } from '@/types/portfolioBuilder';
import { api } from '@/lib/api_adapter';
import { ScreenedTicker } from './useTickerScreener';
import { extractBriefInsight } from '@/components/portfolio-builder/AIInsightBadge';

const STORAGE_KEY = 'portfolio-builder-state';

const initialProfile: InvestorProfile = {
  market: 'US',
  instrumentType: 'mixed',
  investmentGoals: 'growth',
  riskTolerance: 'moderate',
  preferredMarketCap: 'any',
  preferredStyle: 'blend',
  dividendImportance: 'medium',
  sectors: [],
  minAiScore: 0,
};

interface SavedState {
  profile: InvestorProfile;
  step: number;
  riskProfile: RiskProfile | null;
  phase: string;
  timestamp: number;
}

function loadSavedState(): SavedState | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved) as SavedState;
    // Only use saved state if it's less than 1 hour old
    if (Date.now() - parsed.timestamp > 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function usePortfolioBuilder() {
  const savedState = loadSavedState();

  const [profile, setProfile] = useState<InvestorProfile>(savedState?.profile || initialProfile);
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(savedState?.riskProfile || null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [step, setStep] = useState(savedState?.step || 0);
  const [restoredPhase] = useState<string | null>(savedState?.phase || null);
  const [usedSymbols, setUsedSymbols] = useState<Set<string>>(new Set());

  // Clear saved state after it's been restored
  useEffect(() => {
    if (savedState) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Function to save state before navigating away
  const saveStateForAuth = useCallback((currentPhase: string) => {
    const stateToSave: SavedState = {
      profile,
      step,
      riskProfile,
      phase: currentPhase,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [profile, step, riskProfile]);

  const updateProfile = useCallback((updates: Partial<InvestorProfile>) => {
    // Ensure numeric fields from strings are converted
    const cleanedUpdates = { ...updates };
    if ('minAiScore' in cleanedUpdates && typeof cleanedUpdates.minAiScore === 'string') {
      cleanedUpdates.minAiScore = parseInt(cleanedUpdates.minAiScore, 10) || 0;
    }
    setProfile(prev => ({ ...prev, ...cleanedUpdates }));
  }, []);

  const calculateRiskProfile = useCallback((): RiskProfile => {
    // Map riskTolerance directly to risk bucket
    const riskBucketMap: Record<string, 1 | 2 | 3 | 4 | 5> = {
      'conservative': 2,
      'moderate': 3,
      'aggressive': 4,
    };
    const riskBucket = riskBucketMap[profile.riskTolerance] || 3;

    const riskLabels: Record<number, RiskProfile['riskLabel']> = {
      1: 'Very Conservative',
      2: 'Conservative',
      3: 'Moderate',
      4: 'Aggressive',
      5: 'Very Aggressive',
    };

    // Build style tags
    const styleTags: string[] = [];
    if (profile.preferredMarketCap !== 'any') styleTags.push(`${profile.preferredMarketCap}-cap`);
    if (profile.preferredStyle !== 'blend') styleTags.push(profile.preferredStyle);
    if (profile.dividendImportance === 'high') styleTags.push('dividend-focused');
    if (riskBucket <= 2) styleTags.push('defensive');

    if (profile.investmentGoals === 'income') styleTags.push('income-generating');
    if (profile.investmentGoals === 'growth') styleTags.push('growth-oriented');

    const result: RiskProfile = {
      riskBucket,
      riskLabel: riskLabels[riskBucket],
      styleTags,
      constraints: [],
    };

    setRiskProfile(result);
    return result;
  }, [profile]);

  // Local filterTickers function removed since everything comes from API now

  const generatePortfolio = useCallback(async (): Promise<Portfolio> => {
    const risk = riskProfile || calculateRiskProfile();
    const volatilityTolerance = risk.riskBucket <= 2 ? 'low' : risk.riskBucket >= 4 ? 'high' : 'medium';

    // Call the portfolio recommendations API based on saved profile
    let candidates: ScreenedTicker[] = [];

    try {
      const queryParams = new URLSearchParams({
        min_ai_score: profile.minAiScore?.toString() || '0',
        sectors: profile.sectors?.join(',') || '',
        market_cap: profile.preferredMarketCap || 'all',
        instrument_type: profile.instrumentType || 'mixed',
        risk_tolerance: profile.riskTolerance || 'moderate',
        value_or_growth: profile.preferredStyle || 'blend',
        income_vs_growth: profile.investmentGoals || 'both',
        country: profile.market || 'US',
      });
      const response = await api.get(`/portfolio/recommendations?${queryParams.toString()}`);
      const tickers = response.tickers || [];

      if (tickers.length > 0) {
        candidates = tickers.map((t: any) => ({
          symbol: t.symbol,
          name: t.name,
          sector: t.sector || 'Other',
          marketCap: t.market_cap_category || t.marketCap || 'mid',
          style: t.style || 'blend',
          dividendYield: t.dividend_yield_category || t.dividendYield || 'none',
          volatility: t.volatility || 'medium',
          riskLevel: t.risk_level || t.riskLevel || 3,
          isESG: t.is_esg || t.isESG || false,
          country: t.country || 'US',
          exchange: t.exchange || 'NYSE',
          instrumentType: t.instrument_type === 'etf' || t.instrumentType === 'etf' ? 'etf' : 'stock',
          ai_score: t.ai_score,
          ai_analysis: t.ai_analysis,
        }));
        console.log(`Got ${candidates.length} tickers from AI API Recommendations`);
      }
    } catch (err: any) {
      if (err?.name === 'InsufficientCreditsError') {
        throw err;
      }
      console.error('Failed to fetch AI portfolio recommendations:', err);
    }

    // Separate Core (ETFs) and Satellite (Stocks)
    const etfCandidates = candidates.filter(c => c.instrumentType === 'etf' && !usedSymbols.has(c.symbol));
    const stockCandidates = candidates.filter(c => c.instrumentType !== 'etf' && !usedSymbols.has(c.symbol));

    const holdings: PortfolioHolding[] = [];

    // --- 1. Fill the Core with ETFs ---
    // If the user's profile includes funds/ETFs, we use up to 5 of them as the foundation
    etfCandidates.slice(0, 5).forEach(etf => {
      const briefInsight = etf.ai_analysis ? extractBriefInsight(etf.ai_analysis) : '';
      holdings.push({
        symbol: etf.symbol,
        name: etf.name,
        sector: etf.sector,
        weight: 0,
        riskLevel: etf.riskLevel,
        aiScore: etf.ai_score,
        savedAiScore: etf.ai_score,
        addedAt: new Date().toISOString(),
        instrumentType: 'etf',
        whyFits: briefInsight || generateWhyFits(etf, risk),
      });
    });

    // --- 2. Fill the Satellites with Individual Stocks ---
    // Target up to 20 holdings total, or 15 stocks if we have 5 ETFs
    const coreCount = holdings.length;
    const targetSatelliteCount = profile.instrumentType === 'stocks' ? 20 : 15;

    if (stockCandidates.length > 0) {
      // Group stocks by sector for diversification
      const bySector: Record<string, ScreenedTicker[]> = {};
      stockCandidates.forEach(t => {
        if (!bySector[t.sector]) bySector[t.sector] = [];
        bySector[t.sector].push(t);
      });

      const sectors = Object.keys(bySector);

      // First pass: one from each sector
      const usedSectors = new Set<string>();
      sectors.forEach(sector => {
        const sectorTickers = bySector[sector];
        if (sectorTickers.length === 0) return;

        sectorTickers.sort((a, b) => {
          if (a.ai_score && b.ai_score) return b.ai_score - a.ai_score;
          return Math.abs(a.riskLevel - risk.riskBucket) - Math.abs(b.riskLevel - risk.riskBucket);
        });

        const pick = sectorTickers[0];
        const briefInsight = pick.ai_analysis ? extractBriefInsight(pick.ai_analysis) : '';
        holdings.push({
          symbol: pick.symbol,
          name: pick.name,
          sector: pick.sector,
          weight: 0,
          riskLevel: pick.riskLevel,
          aiScore: pick.ai_score,
          savedAiScore: pick.ai_score,
          addedAt: new Date().toISOString(),
          instrumentType: 'stock',
          whyFits: briefInsight || generateWhyFits(pick, risk),
        });
        usedSectors.add(sector);
      });

      // Second pass: fill up to target satellite count
      let addedInPass = -1;
      while (holdings.length < coreCount + targetSatelliteCount && addedInPass !== 0) {
        addedInPass = 0;
        for (const sector of sectors) {
          if (holdings.length >= coreCount + targetSatelliteCount) break;
          const sectorTickers = bySector[sector];
          const currentSectorCount = holdings.filter(h => h.sector === sector && h.sector !== 'ETF').length;

          if (currentSectorCount >= 3) continue; // Max 3 individual stocks per sector

          for (const ticker of sectorTickers) {
            if (holdings.some(h => h.symbol === ticker.symbol)) continue;
            const briefInsight = ticker.ai_analysis ? extractBriefInsight(ticker.ai_analysis) : '';
            holdings.push({
              symbol: ticker.symbol,
              name: ticker.name,
              sector: ticker.sector,
              weight: 0,
              riskLevel: ticker.riskLevel,
              aiScore: ticker.ai_score,
              savedAiScore: ticker.ai_score,
              addedAt: new Date().toISOString(),
              instrumentType: 'stock',
              whyFits: briefInsight || generateWhyFits(ticker, risk),
            });
            addedInPass++;
            break;
          }
        }
      }
    }

    // --- 3. Calculate Core-Satellite Weighting ---
    // ETFs typically form 60% of the portfolio, Individual Stocks form 40%
    const totalCoreWeight = coreCount > 0 && holdings.length > coreCount ? 60 : (holdings.length === coreCount ? 100 : 0);
    const totalSatelliteWeight = holdings.length > coreCount ? (coreCount > 0 ? 40 : 100) : 0;

    const satelliteCount = holdings.length - coreCount;

    holdings.forEach((h, index) => {
      if (index < coreCount) {
        // Base weight for ETF
        let weight = totalCoreWeight / coreCount;
        h.weight = weight;
      } else {
        // Base weight for Stock
        let weight = totalSatelliteWeight / satelliteCount;

        // Tilt stock weight based on Risk Match
        const riskDiff = Math.abs(h.riskLevel - risk.riskBucket);
        if (riskDiff === 0) weight *= 1.3;
        else if (riskDiff === 1) weight *= 1.1;
        else if (riskDiff >= 2) weight *= 0.8;

        h.weight = weight;
      }
    });

    // Normalize weights inside buckets to exactly 100%
    const currentCoreSum = holdings.slice(0, coreCount).reduce((sum, h) => sum + h.weight, 0);
    if (currentCoreSum > 0) {
      holdings.slice(0, coreCount).forEach(h => {
        h.weight = Math.round((h.weight / currentCoreSum) * totalCoreWeight);
      });
    }

    const currentSatelliteSum = holdings.slice(coreCount).reduce((sum, h) => sum + h.weight, 0);
    if (currentSatelliteSum > 0) {
      holdings.slice(coreCount).forEach(h => {
        h.weight = Math.round((h.weight / currentSatelliteSum) * totalSatelliteWeight);
      });
    }

    // Fix rounding errors to hit exactly 100%
    const finalSum = holdings.reduce((sum, h) => sum + h.weight, 0);
    if (finalSum !== 100 && holdings.length > 0) {
      holdings[0].weight += (100 - finalSum);
    }

    // Calculate sector allocation
    const sectorAllocation: Record<string, number> = {};
    holdings.forEach(h => {
      sectorAllocation[h.sector] = (sectorAllocation[h.sector] || 0) + h.weight;
    });

    const totalRiskScore = Math.round(
      holdings.reduce((sum, h) => sum + h.riskLevel * h.weight, 0) / 100
    );

    // Generate warnings
    const warnings: string[] = [];
    Object.entries(sectorAllocation).forEach(([sector, weight]) => {
      if (weight > 30) warnings.push(`High concentration in ${sector} (${weight}%)`);
    });
    if (holdings.length < 8) warnings.push('Consider adding more holdings for better diversification');
    if (totalRiskScore > risk.riskBucket + 1) warnings.push('Portfolio risk is higher than your profile suggests');

    // Fetch current prices to save as baseline
    try {
      const priceRes = await api.post('/stock-prices', { symbols: holdings.map(h => h.symbol) });
      const prices: Record<string, number> = {};
      (priceRes?.prices || []).forEach((p: any) => { prices[p.symbol] = p.price; });
      holdings.forEach(h => {
        if (prices[h.symbol]) h.savedPrice = prices[h.symbol];
      });
    } catch (e) {
      console.warn('Could not fetch prices for portfolio snapshot', e);
    }

    const result: Portfolio = {
      holdings,
      totalRiskScore,
      sectorAllocation,
      warnings,
    };

    // Track used symbols so regenerate picks new ones
    setUsedSymbols(prev => {
      const next = new Set(prev);
      holdings.forEach(h => next.add(h.symbol));
      return next;
    });

    setPortfolio(result);
    return result;
  }, [riskProfile, calculateRiskProfile, profile, usedSymbols]);

  // getTickersForSector removed since SectorBuilder uses the API cache now

  const addHolding = useCallback((ticker: ScreenedTicker) => {
    const risk = riskProfile || calculateRiskProfile();
    const newHolding: PortfolioHolding = {
      symbol: ticker.symbol,
      name: ticker.name,
      sector: ticker.sector,
      weight: 0,
      riskLevel: ticker.riskLevel,
      aiScore: ticker.ai_score,
      savedAiScore: ticker.ai_score,
      addedAt: new Date().toISOString(),
      instrumentType: (ticker.instrumentType === 'etf' ? 'etf' : 'stock') as 'etf' | 'stock',
      whyFits: generateWhyFits(ticker, risk),
    };

    const currentHoldings = portfolio?.holdings || [];

    // Check if already exists
    if (currentHoldings.some(h => h.symbol === ticker.symbol)) {
      return;
    }

    const newHoldings = [...currentHoldings, newHolding];

    // Rebalance weights
    const baseWeight = 100 / newHoldings.length;
    newHoldings.forEach(h => {
      h.weight = Math.round(baseWeight);
    });

    // Ensure weights sum to 100
    const currentSum = newHoldings.reduce((sum, h) => sum + h.weight, 0);
    if (currentSum !== 100 && newHoldings.length > 0) {
      newHoldings[0].weight += (100 - currentSum);
    }

    // Recalculate sector allocation
    const sectorAllocation: Record<string, number> = {};
    newHoldings.forEach(h => {
      sectorAllocation[h.sector] = (sectorAllocation[h.sector] || 0) + h.weight;
    });

    // Calculate total risk score
    const totalRiskScore = Math.round(
      newHoldings.reduce((sum, h) => sum + h.riskLevel * h.weight, 0) / 100
    );

    setPortfolio({
      holdings: newHoldings,
      sectorAllocation,
      totalRiskScore,
      warnings: portfolio?.warnings || [],
    });
  }, [portfolio, riskProfile, calculateRiskProfile]);

  const removeHolding = useCallback((symbol: string) => {
    if (!portfolio) return;

    const newHoldings = portfolio.holdings.filter(h => h.symbol !== symbol);

    if (newHoldings.length === 0) {
      setPortfolio({
        ...portfolio,
        holdings: [],
        sectorAllocation: {},
      });
      return;
    }

    // Rebalance weights
    const baseWeight = 100 / newHoldings.length;
    newHoldings.forEach(h => {
      h.weight = Math.round(baseWeight);
    });

    // Recalculate sector allocation
    const sectorAllocation: Record<string, number> = {};
    newHoldings.forEach(h => {
      sectorAllocation[h.sector] = (sectorAllocation[h.sector] || 0) + h.weight;
    });

    setPortfolio({
      ...portfolio,
      holdings: newHoldings,
      sectorAllocation,
    });
  }, [portfolio]);

  const replaceHolding = useCallback((oldSymbol: string, newStock: { symbol: string; name: string; sector: string; risk_level: number; quality_score?: number | null }) => {
    if (!portfolio) return;

    const oldHolding = portfolio.holdings.find(h => h.symbol === oldSymbol);
    if (!oldHolding) return;

    const newHoldings = portfolio.holdings.map(h =>
      h.symbol === oldSymbol
        ? {
          symbol: newStock.symbol,
          name: newStock.name,
          sector: newStock.sector,
          weight: h.weight,
          riskLevel: newStock.risk_level,
          aiScore: newStock.quality_score || undefined,
          savedAiScore: newStock.quality_score || undefined,
          addedAt: new Date().toISOString(),
          instrumentType: 'stock' as const,
          whyFits: `Replaced ${oldSymbol}${newStock.quality_score ? ` (Quality: ${Math.round(newStock.quality_score)})` : ''}`
        }
        : h
    );

    // Recalculate sector allocation
    const sectorAllocation: Record<string, number> = {};
    newHoldings.forEach(h => {
      sectorAllocation[h.sector] = (sectorAllocation[h.sector] || 0) + h.weight;
    });

    // Recalculate total risk score
    const totalRiskScore = Math.round(
      newHoldings.reduce((sum, h) => sum + h.riskLevel * h.weight, 0) / 100
    );

    setPortfolio({
      ...portfolio,
      holdings: newHoldings,
      sectorAllocation,
      totalRiskScore,
    });
  }, [portfolio]);

  const resetBuilder = useCallback(() => {
    setProfile(initialProfile);
    setRiskProfile(null);
    setPortfolio(null);
    setStep(0);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    profile,
    updateProfile,
    riskProfile,
    calculateRiskProfile,
    portfolio,
    generatePortfolio,
    addHolding,
    removeHolding,
    replaceHolding,
    step,
    setStep,
    resetBuilder,
    saveStateForAuth,
    restoredPhase,
  };
}

function generateWhyFits(ticker: ScreenedTicker, risk: RiskProfile): string {
  const reasons: string[] = [];

  if (ticker.riskLevel <= risk.riskBucket) {
    reasons.push('matches your risk tolerance');
  }

  if (ticker.dividendYield !== 'none') {
    reasons.push(`provides ${ticker.dividendYield} dividend income`);
  }

  if (ticker.volatility === 'low') {
    reasons.push('offers stability');
  }

  if (ticker.marketCap === 'large') {
    reasons.push('established company');
  }

  if (ticker.style === 'growth') {
    reasons.push('growth potential');
  } else if (ticker.style === 'value') {
    reasons.push('value opportunity');
  }

  return reasons.slice(0, 2).join(', ') || 'fits your profile';
}
