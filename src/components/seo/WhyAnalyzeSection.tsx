import { Card, CardContent } from '@/components/ui/card';
import {
  Search,
  Building2,
  Target,
  BarChart3,
  DollarSign,
  TrendingUp,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

interface WhyAnalyzeSectionProps {
  symbol: string;
  name: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  aiScore?: number;
  className?: string;
}

interface Reason {
  icon: LucideIcon;
  title: string;
  description: string;
}

function capCategory(value: number | undefined): { label: string; descriptor: string } | null {
  if (!value) return null;
  if (value >= 1e12) return { label: 'trillion-dollar', descriptor: 'deep liquidity and lower volatility' };
  if (value >= 200e9) return { label: 'mega-cap', descriptor: 'institutional ownership concentration and broad index inclusion' };
  if (value >= 10e9) return { label: 'large-cap', descriptor: 'relative price stability with moderate growth potential' };
  if (value >= 2e9) return { label: 'mid-cap', descriptor: 'a balance of growth potential and operational maturity' };
  return { label: 'small-cap', descriptor: 'higher growth potential paired with elevated volatility' };
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)} trillion`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)} billion`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)} million`;
  return `$${value.toLocaleString()}`;
}

export function WhyAnalyzeSection({
  symbol,
  name,
  sector,
  industry,
  marketCap,
  aiScore,
  className = '',
}: WhyAnalyzeSectionProps) {
  const upperSymbol = symbol.toUpperCase();
  const cap = capCategory(marketCap);

  const reasons: Reason[] = [
    {
      icon: Search,
      title: 'Multi-Dimensional Analysis',
      description: `ClaritX evaluates ${upperSymbol} across nine research perspectives: news sentiment, technical patterns, social buzz, fundamentals, analyst ratings, peer comparison, insider activity, dividend health, and AI synthesis. Each dimension feeds the same scoring engine, so the verdict reflects the full picture rather than a single signal.`,
    },
    ...(aiScore !== undefined
      ? [{
          icon: Sparkles,
          title: 'ClaritX AI Score',
          description: `${upperSymbol} carries a ClaritX AI Score of ${aiScore.toFixed(1)} out of 10, derived from multi-angle data fusion across fundamentals, technicals, and sentiment. The score updates as new data arrives and is the same signal that powers the AI Stock Rank.`,
        }]
      : []),
    ...(sector
      ? [{
          icon: Building2,
          title: `${sector} Sector Context`,
          description: `${name} operates in the ${sector} sector, which exposes ${upperSymbol} to ${sector.toLowerCase()}-specific demand cycles, regulation, and macro sensitivities. Sector context is essential for benchmarking ${upperSymbol} against peers rather than the broad market.`,
        }]
      : []),
    ...(industry
      ? [{
          icon: Target,
          title: `${industry} Industry Positioning`,
          description: `${upperSymbol} competes within the ${industry} industry, where peer benchmarking reveals relative pricing power, margin durability, and capital efficiency. Industry-level comparison surfaces whether ${name} is a leader, laggard, or follower in its niche.`,
        }]
      : []),
    ...(cap
      ? [{
          icon: BarChart3,
          title: `${cap.label.charAt(0).toUpperCase() + cap.label.slice(1)} Characteristics`,
          description: `${upperSymbol} is a ${cap.label} stock with a market capitalization of ${formatMarketCap(marketCap as number)}, which historically implies ${cap.descriptor}. Cap category is one of the most reliable predictors of behavior under stress.`,
        }]
      : []),
    {
      icon: DollarSign,
      title: 'Fundamental Health Check',
      description: `Reviewing ${upperSymbol}'s P/E ratio, debt-to-equity, return on equity, and cash flow gives a complete picture of ${name}'s financial resilience beyond price action. Fundamentals separate durable businesses from temporarily popular tickers.`,
    },
    {
      icon: TrendingUp,
      title: 'Technical Momentum',
      description: `Analyzing ${upperSymbol}'s moving averages, RSI, and support/resistance levels reveals where the market is currently positioned. Combining technicals with fundamentals turns a static valuation into a timed thesis.`,
    },
  ];

  const visibleReasons = reasons.slice(0, 4);

  if (visibleReasons.length === 0) return null;

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Why Analyze ${upperSymbol}`,
    numberOfItems: visibleReasons.length,
    itemListElement: visibleReasons.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: r.title,
      description: r.description,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <section
        className={className}
        aria-labelledby="why-analyze-heading"
        itemScope
        itemType="https://schema.org/ItemList"
      >
        <h2 id="why-analyze-heading" className="text-xl font-semibold mb-4">
          Why Analyze {upperSymbol}?
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {visibleReasons.map((reason, index) => {
            const Icon = reason.icon;
            return (
              <article
                key={reason.title}
                itemProp="itemListElement"
                itemScope
                itemType="https://schema.org/ListItem"
              >
                <meta itemProp="position" content={String(index + 1)} />
                <Card className="bg-muted/30 h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 itemProp="name" className="font-medium text-foreground mb-1">
                          {reason.title}
                        </h3>
                        <p itemProp="description" className="text-sm text-muted-foreground">
                          {reason.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
