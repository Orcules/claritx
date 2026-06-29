import { useState, useEffect } from "react";
import { rdtTrack } from "@/lib/reddit-pixel";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

import { api } from "@/lib/apiAdapter";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEOHead, BreadcrumbSchema, FAQSchema } from "@/components/SEOHead";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AIStockRankToolSchema } from "@/components/seo";
import {
  Trophy,
  TrendingUp,
  Sparkles,
  Star,
  Zap,
  Crown,
  Medal,
  Award,
  BarChart3,
  Coins,
  Building2,
  Landmark,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  TrendingDown,
  Activity,
  DollarSign,
  Percent,
  Search,
  Lock,
} from "lucide-react";

import { useUserCredits } from "@/hooks/useUserCredits";

interface DataCoverage {
  score?: number;
  missing?: string[];
  present?: string[];
}

interface AIQualityFlags {
  positives?: string[];
  concerns?: string[];
  data_coverage?: number | DataCoverage;
}

interface RankedStock {
  symbol: string;
  name: string;
  instrument_type: string;
  final_ai_score: number;
  sector: string | null;
  industry: string | null;
  current_price: number | null;
  market_cap_value: number | null;
  research_summary: string | null;
  ai_quality_flags: AIQualityFlags | null;
  pe_ratio: number | null;
  roe: number | null;
  beta: number | null;
  debt_to_equity: number | null;
  dividend_yield_value: number | null;
  volatility: string | null;
}

const formatMarketCap = (value: number | null) => {
  if (!value) return "N/A";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
};

const normalizeScore = (score: number): number => {
  // If score is 0-10, scale to 0-100
  if (score <= 10) return Math.round(score * 10);
  // If score is 0-100, return as is
  if (score <= 100) return Math.round(score);
  // Legacy support for 0-10000
  return Math.round((score / 10000) * 100);
};

const getScoreColor = (normalizedScore: number): string => {
  if (normalizedScore >= 80) return "from-emerald-400 to-green-500";
  if (normalizedScore >= 60) return "from-blue-400 to-cyan-500";
  if (normalizedScore >= 40) return "from-amber-400 to-yellow-500";
  return "from-orange-400 to-red-500";
};

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Crown className="h-6 w-6 text-yellow-400" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-300" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  if (rank <= 10) return <Award className="h-4 w-4 text-primary" />;
  return <Star className="h-4 w-4 text-muted-foreground" />;
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'stock': return <BarChart3 className="h-5 w-5" />;
    case 'etf': return <Landmark className="h-5 w-5" />;
    case 'fund': return <Building2 className="h-5 w-5" />;
    default: return <TrendingUp className="h-5 w-5" />;
  }
};

export default function AIStockRank() {
  const navigate = useNavigate();
  const { credits } = useUserCredits();
  const isPro = credits?.subscription_tier === 'pro';
  const [stocks, setStocks] = useState<RankedStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [expandedStock, setExpandedStock] = useState<string | null>(null);

  const handleDeepResearch = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    navigate(`/ai-stock-analysis?symbol=${symbol}`);
  };



  useEffect(() => {
    rdtTrack('ViewContent');
    fetchTopRanked();
  }, []);

  const fetchTopRanked = async () => {
    try {
      const data = await api.get('/rankings/full-list?limit=400');

      // Sort combined results by score (API already does this but good to ensure)
      const sortedData = data.sort((a: RankedStock, b: RankedStock) => (b.final_ai_score || 0) - (a.final_ai_score || 0));
      setStocks(sortedData);
    } catch (err) {
      console.error('Error fetching ranked stocks:', err);
      toast.error("Error fetching rankings: Could not load ranking data.");
    } finally {
      setLoading(false);
    }
  };


  const toggleExpand = (symbol: string) => {
    setExpandedStock(expandedStock === symbol ? null : symbol);
  };

  const formatMetric = (value: number | null, suffix: string = '') => {
    if (value === null || value === undefined || !isFinite(value)) return 'N/A';
    return `${value.toFixed(2)}${suffix}`;
  };

  const filterByType = (type: string): RankedStock[] => {
    let filtered = stocks;
    if (type === 'fund') filtered = stocks.filter(s => s.instrument_type === 'fund' || s.instrument_type === 'mutual_fund');
    else if (type !== 'all') filtered = stocks.filter(s => s.instrument_type === type);
    return filtered.slice(0, 10);
  };

  const typeCounts = {
    all: Math.min(stocks.length, 40),
    stock: stocks.filter(s => s.instrument_type === 'stock').slice(0, 10).length,
    etf: stocks.filter(s => s.instrument_type === 'etf').slice(0, 10).length,
    fund: stocks.filter(s => s.instrument_type === 'fund' || s.instrument_type === 'mutual_fund').slice(0, 10).length,
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* SEO */}
      <SEOHead
        title="AI Stock Screener & Rankings — Top-Rated Picks | ClaritX"
        description="Free AI stock screener: the top-ranked stocks, ETFs & funds scored by 9-perspective AI analysis. Compare ratings and find the best assets to research right now."
        keywords="AI stock screener, AI stock ranking, best stocks to buy, stock comparison tool, top ETFs, AI stock ratings, find best stocks, stock screener free"
        canonicalUrl="/ai-stock-rank"
      />
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "/" },
          { name: "AI Stock Rank", url: "/ai-stock-rank" },
        ]}
      />
      <FAQSchema
        faqs={[
          {
            question: "What is the ClaritX AI Stock Rank?",
            answer: "ClaritX AI Stock Rank is an educational research tool that uses artificial intelligence to analyze and score thousands of stocks, ETFs, and mutual funds based on financial fundamentals, growth metrics, and risk factors. The scores range from 0-100 and are for informational purposes only."
          },
          {
            question: "How are the AI stock scores calculated?",
            answer: "Our AI analyzes multiple data points including P/E ratio, ROE, debt levels, revenue growth, market cap, dividend yield, and volatility. The algorithm weighs these factors to produce a composite quality score. This is not a recommendation to buy or sell any security."
          },
          {
            question: "How often are the rankings updated?",
            answer: "The AI rankings are updated regularly as new financial data becomes available. Market prices and fundamental metrics are refreshed to ensure the analysis reflects current information."
          },
          {
            question: "Can I use these rankings to make investment decisions?",
            answer: "No. ClaritX rankings are for educational and research purposes only and do not constitute investment advice. Always consult with a licensed financial advisor before making investment decisions. Past performance does not guarantee future results."
          },
          {
            question: "What asset types are included in the rankings?",
            answer: "ClaritX ranks three asset classes: individual stocks, ETFs (Exchange-Traded Funds), and mutual funds. Each asset type can be filtered and viewed separately using the category tabs."
          }
        ]}
      />
      <AIStockRankToolSchema />

      {/* Animated background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-chart-2/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-chart-1/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />

        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary rounded-full animate-float opacity-60"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      <Header />

      <main className="relative pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Visual Breadcrumbs */}
          <Breadcrumbs
            items={[{ label: "AI Stock Rank" }]}
            className="mb-8"
          />

          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 animate-shimmer">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-medium text-primary">AI-Powered Research Rankings</span>
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            </div>

            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              <span className="bg-gradient-to-r from-primary via-chart-1 to-chart-2 bg-clip-text text-transparent animate-gradient-x">
                ClaritX Special
              </span>
              <br />
              <span className="text-foreground">AI Stock Rank</span>
            </h1>

            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-6">
              Our proprietary AI scores every asset across fundamentals, growth, risk, and momentum —
              not just price. Updated regularly. Free to browse.
            </p>

            {/* What makes this different — always visible, even before data loads */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto mb-8 text-left">
              <div className="glass-card px-4 py-3 rounded-xl border border-primary/20">
                <p className="text-xs font-semibold text-primary mb-1">Not just price momentum</p>
                <p className="text-xs text-muted-foreground">Scores combine P/E, ROE, debt, dividends, beta & growth — 9 dimensions per asset</p>
              </div>
              <div className="glass-card px-4 py-3 rounded-xl border border-chart-1/20">
                <p className="text-xs font-semibold text-chart-1 mb-1">Stocks, ETFs & Funds</p>
                <p className="text-xs text-muted-foreground">One unified ranking across all asset classes — filter by type with one click</p>
              </div>
              <div className="glass-card px-4 py-3 rounded-xl border border-chart-2/20">
                <p className="text-xs font-semibold text-chart-2 mb-1">Top 10 Revealed</p>
                <p className="text-xs text-muted-foreground">View the absolute best assets across all categories instantly</p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <div className="glass-card px-6 py-4 rounded-2xl border border-primary/20 hover:border-primary/40 transition-all hover:scale-105">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/20">
                    <Trophy className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <div className="text-2xl font-bold text-foreground">{stocks.length.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Assets Ranked</div>
                  </div>
                </div>
              </div>

              <div className="glass-card px-6 py-4 rounded-2xl border border-chart-1/20 hover:border-chart-1/40 transition-all hover:scale-105">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-chart-1/20">
                    <Zap className="h-5 w-5 text-chart-1" />
                  </div>
                  <div className="text-left">
                    <div className="text-2xl font-bold text-foreground">0-100</div>
                    <div className="text-xs text-muted-foreground">Score Range</div>
                  </div>
                </div>
              </div>

              <div className="glass-card px-6 py-4 rounded-2xl border border-chart-2/20 hover:border-chart-2/40 transition-all hover:scale-105">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-chart-2/20">
                    <Star className="h-5 w-5 text-chart-2" />
                  </div>
                  <div className="text-left">
                    <div className="text-2xl font-bold text-foreground">3 Types</div>
                    <div className="text-xs text-muted-foreground">Asset Classes</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rankings Section */}
          <div className="glass-card rounded-3xl border border-border/50 p-6 md:p-8 backdrop-blur-xl">
            <div />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-8 bg-muted/50 p-1 rounded-2xl">
                <TabsTrigger
                  value="all"
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-chart-1 data-[state=active]:text-primary-foreground rounded-xl transition-all"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">All</span>
                  <Badge variant="secondary" className="ml-1 text-xs">{typeCounts.all}</Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="stock"
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white rounded-xl transition-all"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Stocks</span>
                  <Badge variant="secondary" className="ml-1 text-xs">{typeCounts.stock}</Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="etf"
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-500 data-[state=active]:text-white rounded-xl transition-all"
                >
                  <Landmark className="h-4 w-4" />
                  <span className="hidden sm:inline">ETFs</span>
                  <Badge variant="secondary" className="ml-1 text-xs">{typeCounts.etf}</Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="fund"
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white rounded-xl transition-all"
                >
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Funds</span>
                  <Badge variant="secondary" className="ml-1 text-xs">{typeCounts.fund}</Badge>
                </TabsTrigger>
              </TabsList>

              {['all', 'stock', 'etf', 'fund'].map(type => (
                <TabsContent key={type} value={type} className="mt-0">
                  {loading ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-primary/20 rounded-full animate-spin border-t-primary" />
                        <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {filterByType(type).map((stock, index) => {
                        const normalizedScore = normalizeScore(stock.final_ai_score);
                        const scoreColor = getScoreColor(normalizedScore);
                        const rank = index + 1;
                        // Top 10 are always unlocked and visible
                        const isLocked = false;
                        const isExpanded = !isLocked && expandedStock === stock.symbol;

                        return (
                          <div
                            key={stock.symbol}
                            className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
                              rank <= 3
                                ? 'border-primary/40 bg-card/80 backdrop-blur-sm shadow-md shadow-primary/10 ring-1 ring-primary/20'
                                : 'border-border/50 bg-card/50 backdrop-blur-sm'
                            } hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 cursor-pointer`}
                            style={{ animationDelay: `${index * 20}ms` }}
                            onClick={() => !isLocked && toggleExpand(stock.symbol)}
                          >
                            {rank <= 3 && !isLocked && (
                              <div className={`absolute inset-0 bg-gradient-to-r ${rank === 1 ? 'from-yellow-500/20 via-yellow-400/10' : rank === 2 ? 'from-slate-300/15 via-slate-200/5' : 'from-amber-600/15 via-amber-500/5'} to-transparent pointer-events-none`} />
                            )}

                            {isLocked ? (
                              /* Redacted card for locked top ranks */
                              <div className="relative flex items-center gap-4 p-4 md:p-5">
                                {/* Rank badge — visible so user knows the position */}
                                <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-muted/50 border border-border/50">
                                  <div className="flex flex-col items-center">
                                    {getRankIcon(rank)}
                                    <span className="text-xs font-bold text-muted-foreground">#{rank}</span>
                                  </div>
                                </div>

                                {/* Redacted placeholder blocks */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="h-5 w-16 rounded bg-muted/60 animate-pulse" />
                                    <div className="h-4 w-12 rounded bg-muted/40 animate-pulse" />
                                  </div>
                                  <div className="h-4 w-32 rounded bg-muted/40 mt-1 animate-pulse" />
                                  <div className="h-3 w-24 rounded bg-muted/30 mt-1.5 animate-pulse" />
                                </div>

                                <div className="hidden md:block text-right flex-shrink-0">
                                  <div className="h-5 w-16 rounded bg-muted/50 ml-auto animate-pulse" />
                                  <div className="h-3 w-12 rounded bg-muted/30 mt-1 ml-auto animate-pulse" />
                                </div>

                                {/* Locked score box */}
                                <div className="flex-shrink-0 flex flex-col items-center">
                                  <div className="w-16 h-16 rounded-2xl bg-muted/40 border border-border/30 flex items-center justify-center">
                                    <Lock className="h-5 w-5 text-muted-foreground/50" />
                                  </div>
                                  <span className="text-xs text-muted-foreground mt-1">AI Score</span>
                                </div>

                                <div className="absolute inset-0 z-10 flex items-center justify-center">
                                  <Link
                                    to="/pricing"
                                    onClick={e => e.stopPropagation()}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg"
                                  >
                                    <Crown className="h-4 w-4" />
                                    Sign up to view more rankings
                                  </Link>
                                </div>
                              </div>
                            ) : (
                              /* Normal visible card */
                              <div className="relative flex items-center gap-4 p-4 md:p-5">
                                {/* Rank */}
                                <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-muted/50 border border-border/50">
                                  {rank <= 10 ? (
                                    <div className="flex flex-col items-center">
                                      {getRankIcon(rank)}
                                      <span className="text-xs font-bold text-muted-foreground">#{rank}</span>
                                    </div>
                                  ) : (
                                    <span className="text-lg font-bold text-muted-foreground">#{rank}</span>
                                  )}
                                </div>

                                {/* Symbol & Name */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-lg text-foreground">{stock.symbol}</span>
                                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                                      {getTypeIcon(stock.instrument_type)}
                                      {stock.instrument_type?.toUpperCase()}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground truncate">{stock.name}</p>
                                  {stock.sector && (
                                    <p className="text-xs text-muted-foreground/70 mt-1">{stock.sector} {stock.industry ? `• ${stock.industry}` : ''}</p>
                                  )}
                                </div>

                                {/* Price & Market Cap */}
                                <div className="hidden md:block text-right flex-shrink-0">
                                  <div className="font-semibold text-foreground">
                                    {stock.current_price ? `$${stock.current_price.toFixed(2)}` : 'N/A'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatMarketCap(stock.market_cap_value)}
                                  </div>
                                </div>

                                {/* Score */}
                                <div className="flex-shrink-0 flex flex-col items-center">
                                  <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${scoreColor} p-[2px] group-hover:scale-110 transition-transform duration-300`}>
                                    <div className="w-full h-full rounded-2xl bg-card flex items-center justify-center">
                                      <span className={`text-2xl font-bold bg-gradient-to-r ${scoreColor} bg-clip-text text-transparent`}>
                                        {normalizedScore}
                                      </span>
                                    </div>
                                    <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                                    </div>
                                  </div>
                                  <span className="text-xs text-muted-foreground mt-1">AI Score</span>
                                </div>

                                {/* Expand indicator */}
                                <div className="flex-shrink-0">
                                  {isExpanded
                                    ? <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                    : <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                  }
                                </div>
                              </div>
                            )}

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="border-t border-border/50 p-4 md:p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                {/* Key Metrics */}
                                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                                    <DollarSign className="h-4 w-4 text-blue-500" />
                                    <div>
                                      <p className="text-xs text-muted-foreground">P/E Ratio</p>
                                      <p className="text-sm font-semibold">{formatMetric(stock.pe_ratio)}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                                    <Percent className="h-4 w-4 text-green-500" />
                                    <div>
                                      <p className="text-xs text-muted-foreground">ROE</p>
                                      <p className="text-sm font-semibold">{formatMetric(stock.roe, '%')}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                                    <Activity className="h-4 w-4 text-purple-500" />
                                    <div>
                                      <p className="text-xs text-muted-foreground">Beta</p>
                                      <p className="text-sm font-semibold">{formatMetric(stock.beta)}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                                    <TrendingDown className="h-4 w-4 text-red-500" />
                                    <div>
                                      <p className="text-xs text-muted-foreground">D/E Ratio</p>
                                      <p className="text-sm font-semibold">{formatMetric(stock.debt_to_equity)}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                                    <Coins className="h-4 w-4 text-amber-500" />
                                    <div>
                                      <p className="text-xs text-muted-foreground">Dividend</p>
                                      <p className="text-sm font-semibold">{formatMetric(stock.dividend_yield_value, '%')}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                                    <Zap className="h-4 w-4 text-orange-500" />
                                    <div>
                                      <p className="text-xs text-muted-foreground">Volatility</p>
                                      <p className="text-sm font-semibold">{stock.volatility || 'N/A'}</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Research Summary */}
                                {stock.research_summary && (
                                  <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                                    <p className="text-sm text-muted-foreground leading-relaxed">{stock.research_summary}</p>
                                  </div>
                                )}

                                {/* Positives & Concerns */}
                                {stock.ai_quality_flags && (
                                  <div className="grid md:grid-cols-2 gap-4">
                                    {stock.ai_quality_flags.positives && stock.ai_quality_flags.positives.length > 0 && (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <ThumbsUp className="h-4 w-4 text-emerald-500" />
                                          <span className="text-sm font-semibold text-emerald-500">Positives</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {stock.ai_quality_flags.positives.map((item, i) => (
                                            <Badge key={i} variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                                              {item}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {stock.ai_quality_flags.concerns && stock.ai_quality_flags.concerns.length > 0 && (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <ThumbsDown className="h-4 w-4 text-red-500" />
                                          <span className="text-sm font-semibold text-red-500">Concerns</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {stock.ai_quality_flags.concerns.map((item, i) => (
                                            <Badge key={i} variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30">
                                              {item}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Data Coverage */}
                                {stock.ai_quality_flags?.data_coverage !== undefined && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>Data Coverage:</span>
                                    {(() => {
                                      const coverage = stock.ai_quality_flags.data_coverage;
                                      const score = typeof coverage === 'number' ? coverage : (coverage?.score ?? 0);
                                      return (
                                        <>
                                          <div className="flex-1 max-w-32 h-2 bg-muted/50 rounded-full overflow-hidden">
                                            <div
                                              className="h-full bg-gradient-to-r from-primary to-chart-1 rounded-full transition-all"
                                              style={{ width: `${Math.min(score, 100)}%` }}
                                            />
                                          </div>
                                          <span className="font-medium">{score}%</span>
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}

                                {/* Deep Research Button */}
                                <div className="pt-2 border-t border-border/30">
                                  <Button
                                    onClick={(e) => handleDeepResearch(e, stock.symbol)}
                                    className="w-full bg-gradient-to-r from-primary to-chart-1 hover:from-primary/90 hover:to-chart-1/90 text-primary-foreground font-semibold"
                                  >
                                    <Search className="h-4 w-4 mr-2" />
                                    Deep Research {stock.symbol}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Dummy Blurred Items */}
                      {filterByType(type).length > 0 && [...Array(3)].map((_, i) => {
                         const rank = filterByType(type).length + i + 1;
                         return (
                            <div key={`dummy-${i}`} className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm cursor-default">
                              <div className="relative flex items-center gap-4 p-4 md:p-5">
                                <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-muted/50 border border-border/50">
                                  <span className="text-lg font-bold text-muted-foreground">#{rank}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="h-5 w-16 rounded bg-muted/60 animate-pulse" />
                                    <div className="h-4 w-12 rounded bg-muted/40 animate-pulse" />
                                  </div>
                                  <div className="h-4 w-32 rounded bg-muted/40 mt-1 animate-pulse" />
                                  <div className="h-3 w-24 rounded bg-muted/30 mt-1.5 animate-pulse" />
                                </div>
                                <div className="hidden md:block text-right flex-shrink-0">
                                  <div className="h-5 w-16 rounded bg-muted/50 ml-auto animate-pulse" />
                                  <div className="h-3 w-12 rounded bg-muted/30 mt-1 ml-auto animate-pulse" />
                                </div>
                                <div className="flex-shrink-0 flex flex-col items-center">
                                  <div className="w-16 h-16 rounded-2xl bg-muted/40 border border-border/30 flex items-center justify-center">
                                    <Lock className="h-5 w-5 text-muted-foreground/50" />
                                  </div>
                                  <span className="text-xs text-muted-foreground mt-1">AI Score</span>
                                </div>
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[2px]">
                                  <Link
                                    to="/pricing"
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg"
                                  >
                                    <Crown className="h-4 w-4" />
                                    Sign up to view more rankings
                                  </Link>
                                </div>
                              </div>
                            </div>
                         );
                      })}

                      {filterByType(type).length === 0 && (
                        <div className="text-center py-20 text-muted-foreground">
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
                            {getTypeIcon(type)}
                          </div>
                          <p>No ranked {type === 'all' ? 'assets' : type + 's'} available yet.</p>
                          <p className="text-sm mt-2 mb-4">Run the AI ranking process to populate this list.</p>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* Disclaimer */}
          <div className="mt-8 text-center">
            <p className="text-xs text-muted-foreground max-w-2xl mx-auto">
              <strong>Disclaimer:</strong> AI-generated rankings are for informational purposes only and do not constitute
              investment advice. Past performance does not guarantee future results. Always conduct your own research
              and consult with a qualified financial advisor before making investment decisions.
            </p>
          </div>

          {/* Internal Linking CTA */}
          <div className="mt-12 text-center">
            <div className="glass-card rounded-2xl p-8 max-w-2xl mx-auto border border-primary/20">
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                Build Your <span className="text-primary">Portfolio</span>
              </h2>
              <p className="text-muted-foreground mb-6">
                Use our AI rankings to build a diversified portfolio based on your risk profile.
              </p>
              <Link
                to="/portfolio-simulator"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Start Portfolio Simulation
                <TrendingUp className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Related Reading Section - SEO Internal Linking */}
          <section className="mt-16" aria-labelledby="related-reading">
            <h2 id="related-reading" className="text-2xl font-bold mb-6 text-center text-foreground">
              Learn More About <span className="text-primary">AI Deep Research</span>
            </h2>
            <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
              <Link
                to="/blog/best-stocks-to-buy-2026"
                className="glass-card p-6 rounded-xl border border-border/50 hover:border-primary/50 transition-all group"
              >
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                  Best Stocks to Buy in 2026
                </h3>
                <p className="text-sm text-muted-foreground">
                  AI-powered guide to finding top investment opportunities this year.
                </p>
              </Link>
              <Link
                to="/blog/how-to-analyze-stocks-complete-guide"
                className="glass-card p-6 rounded-xl border border-border/50 hover:border-primary/50 transition-all group"
              >
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                  How to Analyze Stocks
                </h3>
                <p className="text-sm text-muted-foreground">
                  Complete beginner's guide to fundamental and technical analysis.
                </p>
              </Link>
              <Link
                to="/blog/ai-stock-screener-comparison-2026"
                className="glass-card p-6 rounded-xl border border-border/50 hover:border-primary/50 transition-all group"
              >
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                  AI Stock Screener Comparison
                </h3>
                <p className="text-sm text-muted-foreground">
                  Compare top AI-powered stock screening tools for 2026.
                </p>
              </Link>
            </div>
          </section>
        </div>
      </main >

      <Footer />

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.4; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 0.8; }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes gradient-x {
          0%, 100% { background-size: 200% 200%; background-position: left center; }
          50% { background-size: 200% 200%; background-position: right center; }
        }
        .animate-float {
          animation: float 5s ease-in-out infinite;
        }
        .animate-shimmer {
          background: linear-gradient(90deg, transparent, hsl(var(--primary) / 0.1), transparent);
          background-size: 200% 100%;
          animation: shimmer 3s ease-in-out infinite;
        }
        .animate-gradient-x {
          animation: gradient-x 3s ease infinite;
        }
      `}</style>
    </div >
  );
}
