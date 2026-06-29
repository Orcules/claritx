import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SEOHead, BreadcrumbSchema, FAQSchema } from '@/components/SEOHead';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api_adapter';
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious,
  PaginationEllipsis 
} from '@/components/ui/pagination';
import {
  Search,
  TrendingUp,
  Building2,
  Cpu,
  Heart,
  Fuel,
  Landmark,
  ShoppingCart,
  Factory,
  Zap,
  Radio,
  Plane,
  Home,
  Sparkles
} from 'lucide-react';

interface StockSummary {
  symbol: string;
  name: string;
  sector: string | null;
  score: number | null;
}

const SECTORS = [
  { name: 'Technology', icon: Cpu, color: 'bg-blue-500/10 text-blue-500' },
  { name: 'Healthcare', icon: Heart, color: 'bg-red-500/10 text-red-500' },
  { name: 'Financial Services', icon: Landmark, color: 'bg-green-500/10 text-green-500' },
  { name: 'Consumer Cyclical', icon: ShoppingCart, color: 'bg-purple-500/10 text-purple-500' },
  { name: 'Industrials', icon: Factory, color: 'bg-orange-500/10 text-orange-500' },
  { name: 'Energy', icon: Fuel, color: 'bg-yellow-500/10 text-yellow-500' },
  { name: 'Utilities', icon: Zap, color: 'bg-teal-500/10 text-teal-500' },
  { name: 'Communication Services', icon: Radio, color: 'bg-indigo-500/10 text-indigo-500' },
  { name: 'Consumer Defensive', icon: Home, color: 'bg-emerald-500/10 text-emerald-500' },
  { name: 'Real Estate', icon: Building2, color: 'bg-cyan-500/10 text-cyan-500' },
];

const STOCKS_PER_PAGE = 48;

// Returns a consistent fake-looking score (5.0–9.4) derived purely from the
// ticker symbol so the DOM never exposes the real DB score.
const fakeScoreForSymbol = (symbol: string): string => {
  const h = symbol.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xfffffff, 0);
  return (5.0 + (h % 45) / 10).toFixed(1);
};

export default function StocksIndex() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sectorFilter = searchParams.get('sector');
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  
  const [stocks, setStocks] = useState<StockSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Pre-computed counts for sectors (static for performance)
  // These are approximate counts that avoid expensive runtime queries
  const SECTOR_COUNTS: Record<string, number> = {
    '': 13680, // All sectors
    'Technology': 1890,
    'Healthcare': 1520,
    'Financial Services': 2100,
    'Consumer Cyclical': 1350,
    'Industrials': 1420,
    'Energy': 680,
    'Utilities': 350,
    'Communication Services': 420,
    'Consumer Defensive': 540,
    'Real Estate': 680,
  };

  useEffect(() => {
    async function fetchStocks() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          per_page: String(STOCKS_PER_PAGE),
        });
        if (sectorFilter) params.append('sector', sectorFilter);

        const result = await api.get<any>(`/stocks/directory?${params}`);

        const estimatedCount = SECTOR_COUNTS[sectorFilter || ''] || 1000;
        setTotalCount(estimatedCount);

        const mapped: StockSummary[] = (result.data || []).map((item: any) => ({
          symbol: item.symbol,
          name: item.name,
          sector: item.sector,
          score: item.final_ai_score,
        }));
        setStocks(mapped);
      } catch (e) {
        console.error('Error fetching stocks:', e);
      } finally {
        setLoading(false);
      }
    }

    fetchStocks();
  }, [sectorFilter, currentPage]);

  const filteredStocks = stocks.filter(stock => {
    const matchesSearch = searchQuery === '' || 
      stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const totalPages = Math.ceil(totalCount / STOCKS_PER_PAGE);

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const faqs = [
    {
      question: "What stocks can I analyze on ClaritX?",
      answer: "ClaritX provides AI-powered analysis for thousands of stocks, ETFs, and funds traded on major US exchanges including NYSE and NASDAQ. Our database covers large-cap, mid-cap, and small-cap securities across all sectors."
    },
    {
      question: "How is the AI score calculated?",
      answer: "The ClaritX AI Score (0-10) is derived from multi-angle analysis including fundamental metrics (P/E, ROE, debt levels), technical indicators, news sentiment, social media trends, and analyst recommendations. The score represents a comprehensive view, not a buy/sell signal."
    },
    {
      question: "How often is stock data updated?",
      answer: "Stock profiles and fundamentals are updated daily during market hours. AI research summaries are refreshed when significant changes occur or when users request deep research on a specific stock."
    }
  ];

  // Generate pagination items
  const getPaginationItems = () => {
    const items: (number | 'ellipsis')[] = [];
    
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(i);
      }
    } else {
      items.push(1);
      
      if (currentPage > 3) {
        items.push('ellipsis');
      }
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        items.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        items.push('ellipsis');
      }
      
      items.push(totalPages);
    }
    
    return items;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* SEO */}
      <SEOHead
        title="Stock Deep Research Directory - AI-Powered Research | ClaritX"
        description="Browse thousands of stocks with AI-powered deep research. View fundamentals, research summaries, and AI scores for stocks across all sectors including Technology, Healthcare, and Finance."
        keywords="stock deep research, stock research, AI deep research, stock directory, stock screener, market research"
        canonicalUrl="/stocks"
      />
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "/" },
          { name: "Stocks", url: "/stocks" },
          ...(sectorFilter ? [{ name: sectorFilter, url: `/stocks?sector=${encodeURIComponent(sectorFilter)}` }] : [])
        ]}
      />
      <FAQSchema faqs={faqs} />

      <Header />

      <main className="container mx-auto px-4 pt-24 pb-16 flex-1">
        {/* Breadcrumbs */}
        <Breadcrumbs 
          items={sectorFilter ? [{ label: "Stocks", href: "/stocks" }, { label: sectorFilter }] : [{ label: "Stocks" }]} 
          className="mb-6"
        />

        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">
            Stock Deep Research Directory
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
            {totalCount.toLocaleString()}+ stocks with AI research summaries and scores.
            Click any stock for fundamentals, news sentiment, technicals, and analyst data.
          </p>
          {/* Value strip */}
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground mb-2">
            <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-primary" /> AI Score preview per stock</span>
            <span className="flex items-center gap-1"><Search className="h-3 w-3 text-primary" /> Search by symbol or name</span>
            <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> Live Deep Research on any ticker</span>
          </div>
        </header>

        {/* Search */}
        <div className="max-w-md mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by symbol or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Sector Filters */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Browse by Sector
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!sectorFilter ? "default" : "outline"}
              size="sm"
              asChild
            >
              <Link to="/stocks">All Sectors</Link>
            </Button>
            {SECTORS.map((sector) => (
              <Button
                key={sector.name}
                variant={sectorFilter === sector.name ? "default" : "outline"}
                size="sm"
                asChild
              >
                <Link to={`/stocks?sector=${encodeURIComponent(sector.name)}`}>
                  <sector.icon className="h-4 w-4 mr-1" />
                  {sector.name}
                </Link>
              </Button>
            ))}
          </div>
        </section>

        {/* Top Stocks Grid */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {sectorFilter ? `${sectorFilter} Stocks` : 'Top Stocks by AI Score'}
            {!loading && <span className="text-sm font-normal text-muted-foreground">
              (Page {currentPage} of {totalPages})
            </span>}
          </h2>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : filteredStocks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No stocks found matching your search.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredStocks.map((stock) => {
                  const score = stock.score ? Number(stock.score) : null;
                  const scoreColor = score
                    ? score > 700 || (score <= 10 && score > 7)
                      ? 'text-emerald-500'
                      : score > 400 || (score <= 10 && score > 4)
                        ? 'text-amber-500'
                        : 'text-rose-500'
                    : 'text-muted-foreground';

                  return (
                    <div
                      key={stock.symbol}
                      role="link"
                      tabIndex={0}
                      onClick={() => navigate(`/stocks/${stock.symbol}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/stocks/${stock.symbol}`);
                        }
                      }}
                    >
                      <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{stock.symbol}</p>
                              <p className="text-sm text-muted-foreground line-clamp-1">{stock.name}</p>
                            </div>
                            {score !== null && (
                              <div
                                className="flex flex-col items-end ml-2 flex-shrink-0"
                                aria-hidden="true"
                                title="Run Deep Research to reveal the AI Score"
                              >
                                <span className={`text-lg font-bold ${scoreColor} blur-sm select-none pointer-events-none`}>
                                  {fakeScoreForSymbol(stock.symbol)}
                                </span>
                                <span className="text-[10px] text-muted-foreground">AI Score</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-3">
                            {stock.sector && (
                              <Badge variant="outline" className="text-[10px] truncate max-w-[120px]">
                                {stock.sector}
                              </Badge>
                            )}
                            <Button
                              asChild
                              size="sm"
                              className="h-7 text-xs gap-1 ml-auto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Link
                                to={`/ai-stock-analysis?symbol=${stock.symbol}`}
                                aria-label={`Run Deep Research on ${stock.symbol}`}
                              >
                                <Sparkles className="h-3 w-3" />
                                Deep Research
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      
                      {getPaginationItems().map((item, index) => (
                        <PaginationItem key={index}>
                          {item === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              onClick={() => handlePageChange(item)}
                              isActive={currentPage === item}
                              className="cursor-pointer"
                            >
                              {item}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </section>

        {/* CTA Section */}
        <section className="mt-12 text-center">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-8">
              <h3 className="text-xl font-semibold mb-2">Want the Real AI Score?</h3>
              <p className="text-muted-foreground mb-4">
                Scores in the directory are previews. Run Deep Research on any ticker for the live, multi-angle AI verdict — fundamentals, technicals, sentiment, and more.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button asChild>
                  <Link to="/ai-stock-analysis">
                    <Sparkles className="h-4 w-4 mr-1" />
                    Run Deep Research
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/ai-stock-rank">View AI Rankings</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
}
