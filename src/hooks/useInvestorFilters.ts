import { InvestorProfile, RiskProfile } from '@/types/portfolioBuilder';
import { InvestorFilters, RISK_LABELS, generateClassificationKey } from '@/types/investorFilters';
import { tickerUniverse, TickerData } from '@/data/tickerUniverse';
// Database lookup removed - now using static ticker universe
import { deriveVolatilityFromRisk } from '@/lib/portfolioCompatibility';

export function extractFiltersFromProfile(profile: InvestorProfile): InvestorFilters {
  // Map our modern InvestorProfile to the internal InvestorFilters format
  const riskBucket = profile.riskTolerance === 'conservative' ? 2 : profile.riskTolerance === 'moderate' ? 3 : 4;
  const derivedVolatility = profile.riskTolerance === 'conservative' ? 'low' : profile.riskTolerance === 'moderate' ? 'medium' : 'high';

  return {
    riskBucket,
    riskLabel: profile.riskTolerance === 'conservative' ? 'Conservative' : profile.riskTolerance === 'moderate' ? 'Moderate' : 'Aggressive',
    instrumentType: profile.instrumentType === 'funds' ? 'etf' : profile.instrumentType,
    preferredStyle: profile.preferredStyle,
    preferredMarketCap: profile.preferredMarketCap,
    dividendImportance: profile.dividendImportance,
    volatilityTolerance: derivedVolatility,
    excludedSectors: [],
  };
}

/**
 * Get all possible classification combinations (Mocking count since local universe is removed)
 * Useful for admin view to see all investor categories
 */
export function getAllClassificationCombinations(): Array<{
  key: string;
  riskLevel: string;
  style: string;
  instrumentType: string;
  matchingCount: number;
}> {
  const riskLevels = ['conservative', 'moderate', 'aggressive'] as const;
  const styles = ['value', 'growth', 'blend'] as const;
  const instruments = ['etf', 'stocks', 'mixed'] as const;

  const combinations: Array<{
    key: string;
    riskLevel: string;
    style: string;
    instrumentType: string;
    matchingCount: number;
  }> = [];

  for (const risk of riskLevels) {
    for (const style of styles) {
      for (const instrument of instruments) {
        const key = `${risk}-${style}-${instrument}`;

        combinations.push({
          key,
          riskLevel: risk,
          style,
          instrumentType: instrument,
          matchingCount: 0, // Handled dynamically via DB now
        });
      }
    }
  }

  return combinations;
}
