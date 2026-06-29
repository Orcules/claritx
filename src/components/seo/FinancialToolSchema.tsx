/**
 * SEO Schema components for financial tools
 * Adds structured data for the AI Stock Rank and related tools
 */

const BASE_URL = 'https://www.claritx.ai';

interface FinancialToolSchemaProps {
  name: string;
  description: string;
  url: string;
  features: string[];
}

export function FinancialToolSchema({ name, description, url, features }: FinancialToolSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    description,
    url: `${BASE_URL}${url}`,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web Browser',
    browserRequirements: 'Requires JavaScript',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: features,
    provider: {
      '@id': `${BASE_URL}/#organization`,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function AIStockRankToolSchema() {
  return (
    <FinancialToolSchema
      name="ClaritX AI Stock Rankings"
      description="AI-powered stock ranking system that analyzes stocks, ETFs, funds, and cryptocurrencies across multiple dimensions including fundamentals, technicals, and sentiment."
      url="/ai-stock-rank"
      features={[
        'AI-Powered Quality Scoring',
        'Multi-Asset Analysis (Stocks, ETFs, Funds, Crypto)',
        'Fundamental Analysis',
        'Technical Indicators',
        'Sentiment Analysis',
        'Market Cap Filtering',
        'Sector Analysis',
        'Risk Assessment',
        'Real-Time Data',
      ]}
    />
  );
}

export function PortfolioBuilderToolSchema() {
  return (
    <FinancialToolSchema
      name="ClaritX Portfolio Simulator"
      description="AI-powered portfolio simulation tool that creates personalized portfolio scenarios based on risk assessment and investment preferences."
      url="/portfolio-simulator"
      features={[
        'Risk Assessment Questionnaire',
        'Personalized Risk Profiling',
        'AI-Generated Portfolio Suggestions',
        'Sector-by-Sector Building',
        'Asset Allocation Visualization',
        'Educational Portfolio Simulations',
        'MiFID II Compliant Questionnaire',
      ]}
    />
  );
}

export function StockAnalysisToolSchema() {
  return (
    <FinancialToolSchema
      name="ClaritX AI Deep Research"
      description="Comprehensive AI-powered deep research tool providing 9-perspective analysis including fundamentals, technicals, news sentiment, social media, and analyst ratings."
      url="/"
      features={[
        'News Sentiment Analysis',
        'Technical Indicators',
        'Social Media Buzz Tracking',
        'Financial Statement Analysis',
        'Analyst Ratings Aggregation',
        'Market Comparison',
        'Insider Activity Monitoring',
        'Dividend Analysis',
        'AI-Powered Summary',
      ]}
    />
  );
}
