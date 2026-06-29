// Portfolio Builder Types — every field maps to a DB filter
export interface InvestorProfile {
  // Onboarding
  market: 'US' | 'Global';

  // Instrument Type → isEtf/isFund filter
  instrumentType: 'etf' | 'stocks' | 'mixed' | 'funds';

  // Investment Goal → dividend yield filter
  investmentGoals: string;

  // Risk Tolerance → beta filter
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';

  // Style Preferences → market cap, P/E, dividend filters
  preferredMarketCap: 'mid' | 'large' | 'any';
  preferredStyle: 'value' | 'growth' | 'blend';
  dividendImportance: 'low' | 'medium' | 'high';

  // Sector filter → screener_cache sector
  sectors: string[];

  // Min AI Score → ai_score threshold
  minAiScore: number;
}

export interface RiskProfile {
  riskBucket: 1 | 2 | 3 | 4 | 5;
  riskLabel: 'Very Conservative' | 'Conservative' | 'Moderate' | 'Aggressive' | 'Very Aggressive';
  styleTags: string[];
  constraints: string[];
}

export interface PortfolioHolding {
  symbol: string;
  name: string;
  sector: string;
  weight: number;
  riskLevel: number;
  whyFits: string;
  aiScore?: number;
  savedAiScore?: number;
  savedPrice?: number;
  addedAt?: string;
  instrumentType?: 'stock' | 'etf' | 'fund';
}

export interface Portfolio {
  holdings: PortfolioHolding[];
  totalRiskScore: number;
  sectorAllocation: Record<string, number>;
  warnings: string[];
}

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
  score?: number;
  disabled?: boolean;
  disabledText?: string;
}

export interface Question {
  id: string;
  type: 'single' | 'multi' | 'slider';
  question: string;
  helpText?: string;
  options: QuestionOption[];
  required: boolean;
}

// Financial safety warnings
export interface FinancialWarning {
  type: 'emergency_fund' | 'liquidity_risk';
  severity: 'warning' | 'danger';
  message: string;
}
