// Investor Classification and Filtering Types

// All possible filter criteria derived from questionnaire answers
export interface InvestorFilters {
  // Risk Level (calculated from multiple questions)
  riskBucket: 1 | 2 | 3 | 4 | 5;
  riskLabel: 'Very Conservative' | 'Conservative' | 'Moderate' | 'Aggressive' | 'Very Aggressive';

  // From questionnaire
  instrumentType: 'etf' | 'stocks' | 'mixed' | 'funds';
  preferredStyle: 'value' | 'growth' | 'blend';
  preferredMarketCap: 'mid' | 'large' | 'any';
  dividendImportance: 'low' | 'medium' | 'high';
  volatilityTolerance: 'low' | 'medium' | 'high';

  // Constraints
  excludedSectors: string[];
}

// Result of filtering - what stocks match and why
export interface FilterResult {
  filters: InvestorFilters;
  matchingCount: number;
  filterSummary: string[];
}

// Classification key for lookup tables (e.g., "aggressive-growth-etf")
export type InvestorClassificationKey = string;

// Helper to generate classification key from filters
export function generateClassificationKey(filters: InvestorFilters): InvestorClassificationKey {
  const riskKey = filters.riskBucket <= 2 ? 'conservative' : filters.riskBucket === 3 ? 'moderate' : 'aggressive';
  return `${riskKey}-${filters.preferredStyle}-${filters.instrumentType}`;
}

// All possible risk levels
export const RISK_LEVELS = [1, 2, 3, 4, 5] as const;
export const RISK_LABELS = {
  1: 'Very Conservative',
  2: 'Conservative',
  3: 'Moderate',
  4: 'Aggressive',
  5: 'Very Aggressive'
} as const;

// All possible styles
export const STYLES = ['value', 'growth', 'blend'] as const;

// All possible instrument types
export const INSTRUMENT_TYPES = ['etf', 'stocks', 'mixed', 'funds'] as const;

// All possible market caps
export const MARKET_CAPS = ['small', 'mid', 'large', 'any'] as const;

// All possible dividend preferences
export const DIVIDEND_PREFERENCES = ['low', 'medium', 'high'] as const;

// All possible volatility tolerances
export const VOLATILITY_TOLERANCES = ['low', 'medium', 'high'] as const;

// All sectors available for exclusion
export const ALL_SECTORS = [
  'Technology',
  'Healthcare',
  'Financials',
  'Consumer',
  'Consumer Staples',
  'Industrials',
  'Energy',
  'Utilities',
  'Real Estate',
  'Materials',
  'Communication Services'
] as const;
