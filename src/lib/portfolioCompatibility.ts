import { InvestorProfile, RiskProfile } from '@/types/portfolioBuilder';

export interface CompatibilityWarning {
  severity: 'warning' | 'conflict';
  message: string;
  affectedFields: string[];
  suggestion?: string;
}

/**
 * Detects incompatible or conflicting preferences in the investor profile
 * Returns warnings that should be shown to the user
 */
export function detectIncompatibilities(
  profile: Partial<InvestorProfile>,
  riskBucket?: number
): CompatibilityWarning[] {
  const warnings: CompatibilityWarning[] = [];

  // Calculate approximate risk bucket if not provided
  const estimatedRisk = riskBucket ?? estimateRiskBucket(profile);

  // 1. Growth + High Dividend conflict
  if (profile.preferredStyle === 'growth' && profile.dividendImportance === 'high') {
    warnings.push({
      severity: 'conflict',
      message: 'Growth stocks typically reinvest profits instead of paying dividends',
      affectedFields: ['preferredStyle', 'dividendImportance'],
      suggestion: 'Consider "Blend" style or "Medium" dividend importance',
    });
  }


  // 3. Low Risk + Growth warning
  if (estimatedRisk <= 2 && profile.preferredStyle === 'growth') {
    warnings.push({
      severity: 'warning',
      message: 'Growth stocks are typically higher risk, which may not align with your conservative profile',
      affectedFields: ['preferredStyle'],
      suggestion: 'Consider "Value" or "Blend" style for a conservative portfolio',
    });
  }

  // 4. Short time horizon + Growth warning
  if (profile.timeHorizon === '0-2') {
    if (profile.preferredStyle === 'growth') {
      warnings.push({
        severity: 'warning',
        message: 'Growth investing typically requires a longer time horizon',
        affectedFields: ['preferredStyle', 'timeHorizon'],
        suggestion: 'Consider "Value" or "Blend" for short-term investing',
      });
    }
  }

  return warnings;
}

/**
 * Estimates risk bucket based on partial profile (for early detection)
 */
function estimateRiskBucket(profile: Partial<InvestorProfile>): number {
  let score = 50; // Start in the middle

  // Time horizon impact
  if (profile.timeHorizon === '0-2') score -= 20;
  else if (profile.timeHorizon === '10+') score += 15;

  // Loss tolerance impact
  if (profile.maxAcceptableLoss !== undefined) {
    if (profile.maxAcceptableLoss <= 5) score -= 25;
    else if (profile.maxAcceptableLoss >= 30) score += 20;
  }

  // Market drop reaction
  if (profile.marketDropReaction === 'sell') score -= 15;
  else if (profile.marketDropReaction === 'buy_more') score += 15;

  // Normalize to 1-5 bucket
  if (score <= 20) return 1;
  if (score <= 40) return 2;
  if (score <= 60) return 3;
  if (score <= 80) return 4;
  return 5;
}

/**
 * Gets a simple count of how many options will likely be available
 * Lower means more restricted
 */
export function estimateMatchingOptions(profile: Partial<InvestorProfile>): 'many' | 'some' | 'few' | 'very-few' {
  let restrictiveness = 0;

  if (profile.instrumentType === 'etf') restrictiveness += 1;
  if (profile.instrumentType === 'stocks') restrictiveness += 0.5;
  if (profile.preferredMarketCap === 'mid') restrictiveness += 1;
  if (profile.preferredStyle === 'growth') restrictiveness += 1;
  if (profile.preferredStyle === 'value') restrictiveness += 0.5;
  if (profile.dividendImportance === 'high') restrictiveness += 1.5;

  if (restrictiveness <= 2) return 'many';
  if (restrictiveness <= 4) return 'some';
  if (restrictiveness <= 6) return 'few';
  return 'very-few';
}

/**
 * Derives volatility tolerance from risk bucket
 * Used since we removed the volatility question from the questionnaire
 */
export function deriveVolatilityFromRisk(riskBucket: number): 'low' | 'medium' | 'high' {
  if (riskBucket <= 2) return 'low';
  if (riskBucket >= 4) return 'high';
  return 'medium';
}
