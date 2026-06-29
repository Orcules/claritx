import { Question } from '@/types/portfolioBuilder';

// All questions map directly to DB-filterable fields in screener_cache + stock_analyses

export const onboardingQuestions: Question[] = [
  {
    id: 'market',
    type: 'single',
    question: 'Where do you primarily invest?',
    options: [
      { value: 'US', label: 'United States', description: 'NYSE, NASDAQ, S&P 500' },
      { value: 'Global', label: 'Global / Multiple', description: 'Invest across all markets', disabled: true, disabledText: 'Coming Soon' },
    ],
    required: true,
  },
];

export const mainQuestions: Question[] = [
  {
    id: 'investmentGoals',
    type: 'single',
    question: 'What is your primary investment goal?',
    helpText: 'This determines what you want to RECEIVE from your investments',
    options: [
      { value: 'growth', label: 'Long-term Growth', description: 'Maximize portfolio value — you don\'t need regular payouts' },
      { value: 'income', label: 'Regular Income', description: 'Receive consistent dividends and distributions into your account' },
      { value: 'stability', label: 'Stability & Balance', description: 'Mix of modest growth and some dividend income' },
    ],
    required: true,
  },
  {
    id: 'riskTolerance',
    type: 'single',
    question: 'What is your risk tolerance?',
    helpText: 'This filters stocks by beta — how much they move with the market',
    options: [
      { value: 'conservative', label: 'Conservative', description: 'Low-volatility stocks (beta < 0.8). Stable, less ups and downs.' },
      { value: 'moderate', label: 'Moderate', description: 'Market-average volatility (beta 0.8-1.3). Balanced risk and reward.' },
      { value: 'aggressive', label: 'Aggressive', description: 'High-volatility stocks (beta > 1.3). Bigger swings, bigger potential.' },
    ],
    required: true,
  },
];

export const styleQuestions: Question[] = [
  {
    id: 'instrumentType',
    type: 'single',
    question: 'What type of investments do you prefer?',
    helpText: 'Filters by stocks, ETFs, mutual funds, or a mix',
    options: [
      { value: 'etf', label: 'ETFs Only', description: 'Diversified funds traded on exchanges. Low fees, instant diversification.' },
      { value: 'stocks', label: 'Individual Stocks Only', description: 'Direct ownership in specific companies. More control, more research needed.' },
      { value: 'funds', label: 'Mutual Funds Only', description: 'Professionally managed portfolios. Active management with daily pricing.' },
      { value: 'mixed', label: 'Mix of All', description: 'Combine ETFs for core stability, stocks for targeted bets, and funds for professional management.' },
    ],
    required: true,
  },
  {
    id: 'preferredMarketCap',
    type: 'single',
    question: 'Do you have a preference for company size?',
    helpText: 'Filters by market capitalization (for ETFs/funds, this refers to assets under management)',
    options: [
      { value: 'large', label: 'Large-cap', description: 'Market cap > $10B — established, stable companies' },
      { value: 'mid', label: 'Mid-cap', description: 'Market cap $2B–$10B — balance of stability and growth' },
      { value: 'any', label: 'No preference', description: 'Mix of all sizes' },
    ],
    required: true,
  },
  {
    id: 'preferredStyle',
    type: 'single',
    question: 'What stock-picking style appeals to you?',
    helpText: 'This determines HOW we select stocks — filters by P/E ratio',
    options: [
      { value: 'value', label: 'Value', description: 'Buy cheap, undervalued stocks (low P/E) and wait for the market to catch up' },
      { value: 'growth', label: 'Growth', description: 'Buy fast-growing companies — they reinvest profits instead of paying dividends' },
      { value: 'blend', label: 'Blend', description: 'Mix of both — balance bargains with high-growth opportunities' },
    ],
    required: true,
  },
  {
    id: 'dividendImportance',
    type: 'single',
    question: 'How important are dividends to you?',
    helpText: 'Filters stocks by dividend yield from financial ratios',
    options: [
      { value: 'high', label: 'Very important', description: 'Only show stocks with dividend yield > 2%' },
      { value: 'medium', label: 'Nice to have', description: 'Prefer some dividend exposure, but not required' },
      { value: 'low', label: 'Not important', description: 'Total return is what matters — dividends optional' },
    ],
    required: true,
  },
  {
    id: 'sectors',
    type: 'multi',
    question: 'Any sector preferences?',
    options: [
      { value: 'no_preference', label: 'No Preference', description: 'Show me stocks from all industries' },
      { value: 'Technology', label: 'Technology', description: 'Software, hardware, semiconductors' },
      { value: 'Healthcare', label: 'Healthcare', description: 'Pharma, biotech, medical devices' },
      { value: 'Financial Services', label: 'Financial Services', description: 'Banks, insurance, asset management' },
      { value: 'Consumer Cyclical', label: 'Consumer Cyclical', description: 'Retail, auto, entertainment' },
      { value: 'Consumer Defensive', label: 'Consumer Defensive', description: 'Food, beverages, household products' },
      { value: 'Industrials', label: 'Industrials', description: 'Aerospace, machinery, construction' },
      { value: 'Energy', label: 'Energy', description: 'Oil, gas, renewable energy' },
      { value: 'Communication Services', label: 'Communication Services', description: 'Telecom, media, social platforms' },
      { value: 'Real Estate', label: 'Real Estate', description: 'REITs, property management' },
      { value: 'Basic Materials', label: 'Basic Materials', description: 'Mining, chemicals, forestry' },
      { value: 'Utilities', label: 'Utilities', description: 'Electric, gas, water utilities' },
    ],
    required: false,
  },
  {
    id: 'minAiScore',
    type: 'single',
    question: 'Minimum AI quality score?',
    helpText: 'Only show stocks with an AI score above this threshold (0-100)',
    options: [
      { value: '0', label: 'Show all', description: 'No minimum — display everything we\'ve analyzed' },
      { value: '40', label: '40+', description: 'Filter out the lowest-rated stocks' },
      { value: '60', label: '60+', description: 'Only above-average quality stocks' },
      { value: '75', label: '75+', description: 'Only high-quality, top-rated stocks' },
    ],
    required: true,
  },
];

export const allQuestions = [
  ...onboardingQuestions,
  ...mainQuestions,
  ...styleQuestions,
];

export const totalQuestions = allQuestions.length;
