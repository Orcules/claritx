import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpCircle } from 'lucide-react';

interface StockData {
  symbol: string;
  name: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  peRatio?: number;
  dividendYield?: number;
  beta?: number;
  price?: number;
  aiScore?: number;
}

interface DynamicStockFAQProps {
  stock: StockData;
  className?: string;
}

function formatMarketCap(value: number | undefined): string {
  if (!value) return 'N/A';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)} trillion`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)} billion`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)} million`;
  return `$${value.toLocaleString()}`;
}

/**
 * Generate dynamic FAQs based on stock data
 * These are optimized for "People Also Ask" and rich snippets
 */
export function generateStockFAQs(stock: StockData): Array<{ question: string; answer: string }> {
  const { symbol, name, sector, industry, marketCap, peRatio, dividendYield, beta, aiScore } = stock;

  const faqs: Array<{ question: string; answer: string }> = [
    // Investment suitability - top search query
    {
      question: `Is ${symbol} stock a good investment in 2026?`,
      answer: `Whether ${symbol} (${name}) is a good investment depends on your individual financial goals, risk tolerance, and investment timeline. ${
        aiScore ? `ClaritX's AI analysis gives ${symbol} a research score of ${(aiScore / 1000).toFixed(1)}/10 based on fundamentals, technicals, and sentiment. ` : ''
      }This score reflects current data and should be one factor in your research. Always consult a financial advisor before making investment decisions.`
    },
    // Sector & Industry
    {
      question: `What sector and industry is ${symbol} in?`,
      answer: `${name} (${symbol}) operates in the ${sector || 'diversified'} sector, specifically within the ${industry || 'multi-industry'} industry. Understanding sector classification helps investors assess ${symbol}'s correlation with market trends and build diversified portfolios.`
    },
    // Valuation
    ...(peRatio ? [{
      question: `What is ${symbol}'s P/E ratio?`,
      answer: `${symbol}'s current price-to-earnings (P/E) ratio is approximately ${peRatio.toFixed(2)}. ${
        peRatio > 30 ? `This is considered high, suggesting investors expect strong future earnings growth.` :
        peRatio > 15 ? `This is within the average range for the ${sector || 'market'} sector.` :
        `This is relatively low, which may indicate value opportunity or slower growth expectations.`
      } Compare this to sector peers and historical averages for context.`
    }] : []),
    // Market Cap
    ...(marketCap ? [{
      question: `What is ${symbol}'s market cap?`,
      answer: `${name} has a market capitalization of ${formatMarketCap(marketCap)}. ${
        marketCap >= 200e9 ? `This classifies ${symbol} as a mega-cap stock, among the largest publicly traded companies globally.` :
        marketCap >= 10e9 ? `This classifies ${symbol} as a large-cap stock, typically offering more stability with moderate growth potential.` :
        marketCap >= 2e9 ? `This classifies ${symbol} as a mid-cap stock, often balancing growth potential with reasonable stability.` :
        `This classifies ${symbol} as a small-cap stock, which may offer higher growth potential but with increased volatility.`
      }`
    }] : []),
    // Dividend
    ...(dividendYield !== undefined ? [{
      question: `Does ${symbol} pay dividends?`,
      answer: dividendYield > 0 
        ? `Yes, ${name} currently pays dividends with an approximate yield of ${(dividendYield * 100).toFixed(2)}%. ${
          dividendYield > 0.04 ? `This is considered a high dividend yield, attractive for income-focused investors.` :
          dividendYield > 0.02 ? `This is a moderate dividend yield typical of established companies.` :
          `This is a modest dividend yield, with the company likely reinvesting more profits for growth.`
        } Dividend sustainability depends on earnings and cash flow—review payout ratios for more context.`
        : `${name} does not currently pay regular dividends. The company may be reinvesting profits for growth. Check for special dividends or recent announcements about dividend policy changes.`
    }] : []),
    // Volatility
    ...(beta !== undefined ? [{
      question: `How volatile is ${symbol} stock?`,
      answer: `${symbol} has a beta of ${beta.toFixed(2)}, which measures volatility relative to the S&P 500. ${
        beta > 1.5 ? `A beta above 1.5 indicates high volatility—${symbol} typically moves more dramatically than the market. This means higher potential returns but also greater risk.` :
        beta > 1 ? `A beta above 1 means ${symbol} is more volatile than the market average, potentially offering higher returns with higher risk.` :
        beta > 0.8 ? `A beta near 1 suggests ${symbol} moves roughly in line with the broader market.` :
        `A beta below 0.8 indicates lower volatility than the market—${symbol} may be suitable for conservative investors seeking stability.`
      }`
    }] : []),
    // AI Analysis
    {
      question: `How does AI analyze ${symbol} stock?`,
      answer: `ClaritX uses multi-angle AI analysis to evaluate ${symbol} across 9 dimensions: news sentiment, technical indicators, social media buzz, fundamental metrics, analyst ratings, peer comparison, insider activity, dividend analysis, and an overall AI synthesis. This comprehensive approach provides a balanced research perspective rather than relying on single data points.`
    },
    // How to buy
    {
      question: `How do I buy ${symbol} stock?`,
      answer: `To buy ${symbol} shares: 1) Open a brokerage account with a platform like Fidelity, Schwab, or Robinhood, 2) Fund your account, 3) Search for "${symbol}" in the trading interface, 4) Decide between a market order (buy immediately) or limit order (set your price), 5) Enter the number of shares and confirm. ClaritX provides research to inform your decision—we don't execute trades.`
    }
  ];

  return faqs;
}

/**
 * Visual FAQ section component for stock pages
 */
export function DynamicStockFAQ({ stock, className = '' }: DynamicStockFAQProps) {
  const faqs = generateStockFAQs(stock);
  
  // Show top 4 FAQs on the page
  const displayFaqs = faqs.slice(0, 4);

  return (
    <section className={className}>
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <HelpCircle className="h-5 w-5" />
        Frequently Asked Questions About {stock.symbol}
      </h2>
      <div className="space-y-4">
        {displayFaqs.map((faq, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">{faq.question}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{faq.answer}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
