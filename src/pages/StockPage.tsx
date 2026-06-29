import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SEOHead, BreadcrumbSchema } from '@/components/SEOHead';
import { FAQSchema } from '@/components/SEOHead';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import {
  StockPageSchema,
  EEATDisclosure,
  StockComparisonLinks,
  DynamicStockFAQ,
  generateStockFAQs,
  WhyAnalyzeSection
} from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/apiAdapter';
import {
  TrendingUp,
  Building2,
  Globe,
  BarChart3,
  DollarSign,
  Percent,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Calendar,
  BookOpen
} from 'lucide-react';
import { format } from 'date-fns';
import { EtoroAffiliateCTA } from '@/components/EtoroAffiliateCTA';

interface StockData {
  symbol: string;
  name: string;
  research_summary: string | null;
  final_ai_score: number | null;
  updated_at: string;
  fmp_data_json: {
    profile?: {
      companyName?: string;
      exchange?: string;
      exchangeFullName?: string;
      sector?: string;
      industry?: string;
      city?: string;
      state?: string;
      country?: string;
      description?: string;
      mktCap?: number;
      beta?: number;
      price?: number;
      website?: string;
      ceo?: string;
      fullTimeEmployees?: number;
      ipoDate?: string;
    };
    keyMetrics?: {
      peRatioTTM?: number;
      priceToBookRatioTTM?: number;
      dividendYieldTTM?: number;
      roeTTM?: number;
      debtToEquityTTM?: number;
      currentRatioTTM?: number;
    };
    ratios?: {
      returnOnEquityTTM?: number;
      priceEarningsRatioTTM?: number;
      dividendYieldTTM?: number;
    };
  } | null;
  instrument_type: string;
}

function formatMarketCap(value: number | undefined): string {
  if (!value) return 'N/A';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

function formatPercent(value: number | undefined): string {
  if (value === undefined || value === null) return 'N/A';
  return `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value: number | undefined, decimals = 2): string {
  if (value === undefined || value === null) return 'N/A';
  return value.toFixed(decimals);
}

export default function StockPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [stock, setStock] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const upperSymbol = symbol?.toUpperCase() || '';

  useEffect(() => {
    async function fetchStock() {
      if (!upperSymbol) return;

      setLoading(true);
      setError(null);

      try {
        const data = await api.get<StockData | null>(`/stocks/detail/${upperSymbol}`);

        if (!data) {
          setError('Stock not found');
        } else {
          setStock(data);
        }
      } catch (e: any) {
        console.error('Error fetching stock:', e);
        setError(e.message || 'Failed to load stock data');
      } finally {
        setLoading(false);
      }
    }

    fetchStock();
  }, [upperSymbol]);

  const profile = stock?.fmp_data_json?.profile;
  const keyMetrics = stock?.fmp_data_json?.keyMetrics;
  const ratios = stock?.fmp_data_json?.ratios;

  // Extract metrics from various sources
  const roe = ratios?.returnOnEquityTTM || keyMetrics?.roeTTM;
  const pe = ratios?.priceEarningsRatioTTM || keyMetrics?.peRatioTTM;
  const dividendYield = ratios?.dividendYieldTTM || keyMetrics?.dividendYieldTTM;
  const debtToEquity = keyMetrics?.debtToEquityTTM;

  const normalizedScore = stock?.final_ai_score
    ? (stock.final_ai_score / 1000).toFixed(1)
    : null;

  const lastUpdated = stock?.updated_at
    ? format(new Date(stock.updated_at), 'MMM d, yyyy')
    : 'N/A';

  // Build stock data object for dynamic FAQ generation
  const stockDataForFAQ = stock ? {
    symbol: upperSymbol,
    name: stock.name,
    sector: profile?.sector,
    industry: profile?.industry,
    marketCap: profile?.mktCap,
    peRatio: pe,
    dividendYield: dividendYield,
    beta: profile?.beta,
    price: profile?.price,
    aiScore: stock.final_ai_score || undefined
  } : null;

  // Generate dynamic FAQs using the SEO component
  const faqs = stockDataForFAQ ? generateStockFAQs(stockDataForFAQ) : [];

  // Breadcrumb items
  const breadcrumbItems = [
    { label: "Stocks", href: "/stocks" },
    ...(profile?.sector ? [{ label: profile.sector, href: `/stocks?sector=${encodeURIComponent(profile.sector)}` }] : []),
    { label: upperSymbol }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="container mx-auto px-4 pt-24 pb-16 flex-1">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !stock) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SEOHead
          title={`${upperSymbol} Stock Analysis | ClaritX`}
          description={`AI-powered deep research and analysis for ${upperSymbol}. View fundamentals, technicals, and sentiment analysis on ClaritX.`}
          canonicalUrl={`/stocks/${upperSymbol}`}
          noindex
        />
        <Header />
        <main className="container mx-auto px-4 pt-24 pb-16 flex-1">
          <div className="max-w-4xl mx-auto text-center py-16">
            <h1 className="text-2xl font-bold mb-4">Stock Not Found</h1>
            <p className="text-muted-foreground mb-6">
              We couldn't find data for symbol "{symbol}". It may not be in our database yet.
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => navigate('/stocks')}>
                Browse All Stocks
              </Button>
              <Button variant="outline" onClick={() => navigate('/ai-stock-rank')}>
                View AI Rankings
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* SEO Components */}
      <SEOHead
        title={`${upperSymbol} Deep Research - Multi-Angle AI Overview | ClaritX`}
        description={stock.research_summary?.slice(0, 155) || `AI-powered research and analysis for ${stock.name} (${upperSymbol}). View fundamentals, technicals, and sentiment analysis.`}
        keywords={`${upperSymbol}, ${stock.name}, stock analysis, ${profile?.sector || ''}, ${profile?.industry || ''}, AI stock research`}
        canonicalUrl={`/stocks/${upperSymbol}`}
      />
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "/" },
          { name: "Stocks", url: "/stocks" },
          ...(profile?.sector ? [{ name: profile.sector, url: `/stocks?sector=${encodeURIComponent(profile.sector)}` }] : []),
          { name: `${upperSymbol} Analysis`, url: `/stocks/${upperSymbol}` }
        ]}
      />
      {faqs.length > 0 && <FAQSchema faqs={faqs.slice(0, 4)} />}
      <StockPageSchema
        symbol={upperSymbol}
        name={stock.name}
        description={stock.research_summary || undefined}
        sector={profile?.sector}
        exchange={profile?.exchange}
      />

      <Header />

      <main className="container mx-auto px-4 pt-24 pb-16 flex-1">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumbs */}
          <Breadcrumbs items={breadcrumbItems} className="mb-6" />

          {/* H1 Header */}
          <header className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className="text-sm">
                {stock.instrument_type?.toUpperCase() || 'STOCK'}
              </Badge>
              {normalizedScore && (
                <Badge className="bg-primary/10 text-primary">
                  AI Score: {normalizedScore}/10
                </Badge>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
              {upperSymbol} Deep Research
            </h1>
            <p className="text-xl text-muted-foreground">
              Multi-Angle AI Overview for {stock.name}
            </p>
          </header>

          {/* Research Summary - First thing users see = immediate value */}
          {stock.research_summary && (
            <section className="mb-8">
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    AI Research Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none research-summary">
                    <p className="text-foreground leading-relaxed whitespace-pre-line">
                      {stock.research_summary}
                    </p>
                  </div>
                  {/* Deep Research inline CTA — shown right after the summary */}
                  <div className="mt-6 pt-4 border-t border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      Get live technicals, sentiment, insider activity & more:
                    </p>
                    <Button
                      size="sm"
                      className="gap-2 whitespace-nowrap"
                      onClick={() => navigate(`/ai-stock-analysis?symbol=${upperSymbol}`)}
                    >
                      <Sparkles className="h-4 w-4" />
                      Full AI Deep Research
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {/* eToro Affiliate CTA — above Key Metrics */}
          <EtoroAffiliateCTA variant="card" context="stock" symbol={upperSymbol} />

          {/* Key Metrics Grid */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Key Metrics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                icon={DollarSign}
                label="Market Cap"
                value={formatMarketCap(profile?.mktCap)}
              />
              <MetricCard
                icon={TrendingUp}
                label="P/E Ratio"
                value={formatNumber(pe)}
              />
              <MetricCard
                icon={Percent}
                label="ROE"
                value={roe ? formatPercent(roe) : 'N/A'}
              />
              <MetricCard
                icon={BarChart3}
                label="Beta"
                value={formatNumber(profile?.beta)}
              />
              <MetricCard
                icon={DollarSign}
                label="Dividend Yield"
                value={dividendYield ? formatPercent(dividendYield) : 'N/A'}
              />
              <MetricCard
                icon={BarChart3}
                label="Debt/Equity"
                value={formatNumber(debtToEquity)}
              />
              <MetricCard
                icon={DollarSign}
                label="Price"
                value={profile?.price ? `$${profile.price.toFixed(2)}` : 'N/A'}
              />
              <MetricCard
                icon={Calendar}
                label="IPO Date"
                value={profile?.ipoDate || 'N/A'}
              />
            </div>
          </section>

          {/* Company Description */}
          {profile?.description && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                About {stock.name}
              </h2>
              <Card>
                <CardContent className="p-6">
                  <p className="text-muted-foreground leading-relaxed">
                    {profile.description}
                  </p>
                  {profile.website && (
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-4 text-primary hover:underline"
                    >
                      <Globe className="h-4 w-4" />
                      {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          {/* Entity Signals - Critical for SEO */}
          <section className="mb-8 p-4 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">{stock.name}</strong> ({upperSymbol}) trades on the{' '}
              <strong>{profile?.exchangeFullName || profile?.exchange || 'N/A'}</strong>.{' '}
              Sector: <strong>{profile?.sector || 'N/A'}</strong>.{' '}
              Industry: <strong>{profile?.industry || 'N/A'}</strong>.{' '}
              {profile?.city && profile?.country && (
                <>Headquarters: <strong>{profile.city}{profile.state ? `, ${profile.state}` : ''}, {profile.country}</strong>.</>
              )}
              {profile?.ceo && <> CEO: <strong>{profile.ceo}</strong>.</>}
              {profile?.fullTimeEmployees && <> Employees: <strong>{profile.fullTimeEmployees.toLocaleString()}</strong>.</>}
            </p>
          </section>

          {/* Why Analyze - SEO/GEO topical authority + ItemList schema */}
          <WhyAnalyzeSection
            symbol={upperSymbol}
            name={stock.name}
            sector={profile?.sector}
            industry={profile?.industry}
            marketCap={profile?.mktCap}
            aiScore={stock.final_ai_score ? stock.final_ai_score / 1000 : undefined}
            className="mb-8"
          />

          {/* Portfolio Fit CTA - Internal Linking */}
          <section className="mb-8">
            <Card className="border-secondary/20 bg-secondary/5">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Portfolio Fit</h3>
                    <p className="text-muted-foreground">
                      See how {upperSymbol} fits into a diversified portfolio based on your risk profile.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="lg"
                    className="gap-2 whitespace-nowrap"
                    asChild
                  >
                    <Link to={`/portfolio-simulator?stock=${upperSymbol}`}>
                      Try Portfolio Simulator
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Comparison Links - SEO Critical */}
          <StockComparisonLinks
            currentSymbol={upperSymbol}
            sector={profile?.sector}
            className="mb-8"
          />

          {/* Dynamic FAQ Section */}
          {stockDataForFAQ && (
            <DynamicStockFAQ stock={stockDataForFAQ} className="mb-8" />
          )}

          {/* Content Cluster Link - AI Stock Analysis Guide */}
          <section className="mb-8">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <BookOpen className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">Learn About AI Deep Research</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Understand how AI analyzes {upperSymbol} and other stocks across 9 research dimensions.
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/ai-stock-analysis-guide">
                        Read the Ultimate Guide <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* E-E-A-T Disclosure */}
          <EEATDisclosure lastUpdated={lastUpdated} />

          {/* Related Actions */}
          <section className="mt-8 pt-8 border-t border-border">
            <h3 className="text-lg font-semibold mb-4">Explore More</h3>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link to="/ai-stock-rank">View AI Rankings</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/stocks">Browse All Stocks</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/blog">Investment Education</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/ai-stock-analysis-guide">AI Analysis Guide</Link>
              </Button>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// Metric Card Component
function MetricCard({
  icon: Icon,
  label,
  value
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="text-lg font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
