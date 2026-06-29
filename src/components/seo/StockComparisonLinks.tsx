import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft } from 'lucide-react';

interface StockComparisonLinksProps {
  currentSymbol: string;
  sector?: string;
  className?: string;
}

/**
 * Comparison data for popular stock pairs
 * These create natural internal linking opportunities for long-tail searches
 */
const COMPARISON_PAIRS: Record<string, string[]> = {
  // Tech Giants
  'AAPL': ['MSFT', 'GOOGL', 'AMZN', 'SAMSUNG'],
  'MSFT': ['AAPL', 'GOOGL', 'AMZN', 'ORCL'],
  'GOOGL': ['META', 'MSFT', 'AMZN', 'AAPL'],
  'AMZN': ['WMT', 'COST', 'EBAY', 'GOOGL'],
  'META': ['GOOGL', 'SNAP', 'PINS', 'TWTR'],
  'NVDA': ['AMD', 'INTC', 'QCOM', 'TSM'],
  'TSLA': ['F', 'GM', 'RIVN', 'LCID'],
  
  // Finance
  'JPM': ['BAC', 'WFC', 'C', 'GS'],
  'BAC': ['JPM', 'WFC', 'C', 'USB'],
  'V': ['MA', 'AXP', 'PYPL', 'SQ'],
  'MA': ['V', 'AXP', 'PYPL', 'DFS'],
  
  // Healthcare
  'JNJ': ['PFE', 'MRK', 'ABBV', 'UNH'],
  'UNH': ['CVS', 'ANTM', 'CI', 'HUM'],
  'PFE': ['MRK', 'JNJ', 'ABBV', 'BMY'],
  
  // Consumer
  'WMT': ['TGT', 'COST', 'AMZN', 'KR'],
  'KO': ['PEP', 'MNST', 'KDP', 'STZ'],
  'PEP': ['KO', 'MNST', 'KDP', 'MDLZ'],
  'MCD': ['SBUX', 'YUM', 'CMG', 'DPZ'],
  
  // Energy
  'XOM': ['CVX', 'COP', 'BP', 'SHEL'],
  'CVX': ['XOM', 'COP', 'OXY', 'EOG'],
  
  // Semiconductors
  'AMD': ['NVDA', 'INTC', 'QCOM', 'AVGO'],
  'INTC': ['AMD', 'NVDA', 'TSM', 'QCOM'],
  'TSM': ['INTC', 'NVDA', 'ASML', 'SAMSUNG'],
};

/**
 * Default sector-based comparisons when no specific pairs defined
 */
const SECTOR_LEADERS: Record<string, string[]> = {
  'Technology': ['AAPL', 'MSFT', 'GOOGL', 'NVDA'],
  'Healthcare': ['UNH', 'JNJ', 'PFE', 'LLY'],
  'Financial Services': ['JPM', 'BAC', 'V', 'MA'],
  'Consumer Cyclical': ['AMZN', 'TSLA', 'HD', 'MCD'],
  'Consumer Defensive': ['WMT', 'PG', 'KO', 'PEP'],
  'Energy': ['XOM', 'CVX', 'COP', 'EOG'],
  'Industrials': ['CAT', 'HON', 'UPS', 'BA'],
  'Communication Services': ['GOOGL', 'META', 'DIS', 'NFLX'],
  'Utilities': ['NEE', 'DUK', 'SO', 'D'],
  'Real Estate': ['AMT', 'PLD', 'CCI', 'EQIX'],
  'Basic Materials': ['LIN', 'APD', 'SHW', 'FCX'],
};

export function StockComparisonLinks({ currentSymbol, sector, className = '' }: StockComparisonLinksProps) {
  const upperSymbol = currentSymbol.toUpperCase();
  
  // Get comparison targets
  let comparisons = COMPARISON_PAIRS[upperSymbol] || [];
  
  // If no specific comparisons, use sector leaders
  if (comparisons.length === 0 && sector) {
    comparisons = (SECTOR_LEADERS[sector] || []).filter(s => s !== upperSymbol).slice(0, 4);
  }
  
  // Fallback to general top stocks
  if (comparisons.length === 0) {
    comparisons = ['AAPL', 'MSFT', 'GOOGL', 'NVDA'].filter(s => s !== upperSymbol).slice(0, 3);
  }

  if (comparisons.length === 0) return null;

  return (
    <div className={`${className}`}>
      <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4" />
        Compare {upperSymbol}
      </h3>
      <div className="flex flex-wrap gap-2">
        {comparisons.slice(0, 4).map((compSymbol) => (
          <Link 
            key={compSymbol}
            to={`/stocks/${compSymbol}`}
            className="group"
          >
            <Badge 
              variant="outline" 
              className="hover:bg-primary/10 hover:border-primary/50 transition-colors cursor-pointer"
            >
              {upperSymbol} vs {compSymbol}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Schema markup for stock comparison
 */
export function StockComparisonSchema({ 
  symbol1, 
  symbol2,
  name1,
  name2 
}: { 
  symbol1: string; 
  symbol2: string;
  name1?: string;
  name2?: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `${symbol1} vs ${symbol2} Stock Comparison`,
    "description": `Compare ${name1 || symbol1} and ${name2 || symbol2} stock performance, fundamentals, and AI analysis.`,
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": `${symbol1} Deep Research`,
        "url": `https://www.claritx.ai/stocks/${symbol1}`
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": `${symbol2} Deep Research`,
        "url": `https://www.claritx.ai/stocks/${symbol2}`
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
