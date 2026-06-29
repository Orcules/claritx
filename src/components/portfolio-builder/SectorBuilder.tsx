import { useState, useEffect } from 'react';
import { RiskProfile, PortfolioHolding } from '@/types/portfolioBuilder';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  Plus,
  Check,
  TrendingUp,
  Building2,
  Cpu,
  Heart,
  DollarSign,
  ShoppingCart,
  Zap,
  Flame,
  Home,
  Boxes,
  Radio,
  BarChart3,
  Sparkles,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { AIInsightBadge } from './AIInsightBadge';
import { useTickerScreener, ScreenedTicker } from '@/hooks/useTickerScreener';
import { InvestorFilters } from '@/types/investorFilters';
import { useStockInfo } from '@/hooks/useStockInfo';

interface SectorBuilderProps {
  riskProfile: RiskProfile;
  currentHoldings: PortfolioHolding[];
  onAddTicker: (ticker: any) => void;
  onDone: () => void;
  onBack: () => void;
  investorFilters?: InvestorFilters;
}

const sectorIcons: Record<string, any> = {
  'Technology': Cpu,
  'Healthcare': Heart,
  'Financials': DollarSign,
  'Consumer': ShoppingCart,
  'Consumer Staples': ShoppingCart,
  'Consumer Discretionary': ShoppingCart,
  'Industrials': Building2,
  'Energy': Flame,
  'Utilities': Zap,
  'Real Estate': Home,
  'Materials': Boxes,
  'Communication': Radio,
  'Communication Services': Radio,
  'ETF': BarChart3,
  'Other': Building2,
};

export function SectorBuilder({
  riskProfile,
  currentHoldings,
  onAddTicker,
  onDone,
  onBack,
  investorFilters,
}: SectorBuilderProps) {
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [sectorTickers, setSectorTickers] = useState<ScreenedTicker[]>([]);
  const [showAllSectors, setShowAllSectors] = useState(false);
  const [allScreenedTickers, setAllScreenedTickers] = useState<ScreenedTicker[]>([]);
  const [isLoadingTickers, setIsLoadingTickers] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  const { screenTickers, loading, error } = useTickerScreener();
  const { infoCache, priceCache, loadingInfo, fetchStockInfo, fetchPrices } = useStockInfo();

  // Fetch prices when sector tickers change
  useEffect(() => {
    if (sectorTickers.length > 0) {
      const symbols = sectorTickers.map(t => t.symbol);
      fetchPrices(symbols);
    }
  }, [sectorTickers]);

  // Load screened tickers on mount if we have filters
  useEffect(() => {
    if (investorFilters) {
      loadScreenedTickers();
    }
  }, [investorFilters]);

  const loadScreenedTickers = async () => {
    if (!investorFilters) return;

    setIsLoadingTickers(true);
    try {
      const tickers = await screenTickers(investorFilters);
      setAllScreenedTickers(tickers);
    } catch (err) {
      console.error('Failed to load screened tickers:', err);
    } finally {
      setIsLoadingTickers(false);
    }
  };

  // Get tickers for a sector straight from the API cache
  const getTickersForSectorWithApi = (sector: string): ScreenedTicker[] => {
    return allScreenedTickers.filter(t =>
      t.sector.toLowerCase() === sector.toLowerCase()
    );
  };

  const handleSectorSelect = (sector: string) => {
    setSelectedSector(sector);
    const tickers = getTickersForSectorWithApi(sector);
    tickers.sort((a, b) => {
      if (a.ai_score && b.ai_score) return b.ai_score - a.ai_score;
      return 0;
    });
    setSectorTickers(tickers);
  };

  const handleAddTicker = (ticker: ScreenedTicker) => {
    if (currentHoldings.some(h => h.symbol === ticker.symbol)) {
      toast({
        title: 'Already Added',
        description: `${ticker.symbol} is already in your portfolio`,
        variant: 'destructive',
      });
      return;
    }
    onAddTicker(ticker);
    toast({
      title: 'Added!',
      description: `${ticker.symbol} added to portfolio`,
    });
  };

  const isTickerAdded = (symbol: string) =>
    currentHoldings.some(h => h.symbol === symbol);

  const getRiskBadgeColor = (level: number) => {
    if (level <= 2) return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
    if (level <= 3) return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400';
    return 'bg-red-500/20 text-red-600 dark:text-red-400';
  };

  const getSectorRiskFit = (sector: string): 'good' | 'moderate' | 'risky' => {
    const tickers = getTickersForSectorWithApi(sector);
    if (tickers.length === 0) return 'risky';

    const avgRisk = tickers.reduce((sum, t) => sum + t.riskLevel, 0) / tickers.length;
    if (avgRisk <= riskProfile.riskBucket) return 'good';
    if (avgRisk <= riskProfile.riskBucket + 1) return 'moderate';
    return 'risky';
  };

  // Get unique sectors from screened tickers
  const getAvailableSectors = (): string[] => {
    if (allScreenedTickers.length > 0) {
      const sectorSet = new Set(allScreenedTickers.map(t => t.sector));
      return Array.from(sectorSet);
    }
    return ['Technology', 'Healthcare', 'Financials', 'Consumer', 'Industrials', 'Energy', 'ETF'];
  };

  const availableSectors = getAvailableSectors();

  // Get recommended sectors (good fit) and other sectors
  const recommendedSectors = availableSectors.filter(sector => {
    const tickerCount = getTickersForSectorWithApi(sector).length;
    const fit = getSectorRiskFit(sector);
    return tickerCount > 0 && fit === 'good';
  });

  const otherSectors = availableSectors.filter(sector => {
    const tickerCount = getTickersForSectorWithApi(sector).length;
    const fit = getSectorRiskFit(sector);
    return tickerCount > 0 && fit !== 'good';
  });

  const sectorsToShow = showAllSectors ? [...recommendedSectors, ...otherSectors] : recommendedSectors;

  // Loading state
  if (isLoadingTickers || loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-up">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading stocks from market data...</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!selectedSector) {
    // Sector Selection View
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              {showAllSectors ? 'All Sectors' : 'Suggested Sectors'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {showAllSectors
                ? 'Browse all available sectors for exploration'
                : 'These sectors align with your selected volatility scenario'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {investorFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={loadScreenedTickers}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </Button>
            )}
            {currentHoldings.length > 0 && (
              <Button onClick={onDone} className="gap-2">
                Review Simulation ({currentHoldings.length})
                <TrendingUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Data source indicator */}
        {allScreenedTickers.length > 0 && (
          <div className="glass-card p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-primary/10">
                {allScreenedTickers.length} stocks loaded
              </Badge>
            </div>
          </div>
        )}

        {/* Recommended Sectors */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sectorsToShow.map((sector) => {
            const Icon = sectorIcons[sector] || Building2;
            const fit = getSectorRiskFit(sector);
            const tickerCount = getTickersForSectorWithApi(sector).length;

            return (
              <button
                key={sector}
                onClick={() => handleSectorSelect(sector)}
                disabled={tickerCount === 0}
                className={cn(
                  "glass-card p-5 text-left space-y-3 hover:border-primary/50 hover:bg-primary/5 transition-all group",
                  tickerCount === 0 && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{sector}</h3>
                  <p className="text-sm text-muted-foreground">{tickerCount} stocks</p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    fit === 'good' && "border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
                    fit === 'moderate' && "border-yellow-500/50 text-yellow-600 dark:text-yellow-400",
                    fit === 'risky' && "border-red-500/50 text-red-600 dark:text-red-400"
                  )}
                >
                  {fit === 'good' && 'Aligns with scenario'}
                  {fit === 'moderate' && 'Moderate volatility'}
                  {fit === 'risky' && 'Higher volatility'}
                </Badge>
              </button>
            );
          })}
        </div>

        {/* Add More Sectors Button */}
        {!showAllSectors && otherSectors.length > 0 && (
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => setShowAllSectors(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Show More Sectors ({otherSectors.length})
            </Button>
          </div>
        )}

        {showAllSectors && (
          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() => setShowAllSectors(false)}
              className="gap-2"
            >
              Show Only Recommended
            </Button>
          </div>
        )}

        {/* Current Simulation Summary */}
        {currentHoldings.length > 0 && (
          <div className="glass-card p-4">
            <h3 className="font-semibold text-foreground mb-3">Current Simulation</h3>
            <div className="flex flex-wrap gap-2">
              {currentHoldings.map(h => (
                <Badge key={h.symbol} variant="secondary" className="text-sm">
                  {h.symbol}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Back to Profile
        </Button>
      </div>
    );
  }

  // Ticker Selection View
  const Icon = selectedSector ? (sectorIcons[selectedSector] || Building2) : Building2;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedSector(null)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">
                {selectedSector}
              </h1>
              <p className="text-muted-foreground">
                {sectorTickers.length} stocks available
              </p>
            </div>
          </div>
        </div>
        {currentHoldings.length > 0 && (
          <Button onClick={onDone} className="gap-2">
            Review Portfolio ({currentHoldings.length})
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {sectorTickers.map((ticker) => {
          const added = isTickerAdded(ticker.symbol);
          const info = infoCache[ticker.symbol];
          const price = priceCache[ticker.symbol];
          const isExpanded = expandedDescriptions.has(ticker.symbol);
          const isLoadingThisInfo = loadingInfo.has(ticker.symbol);

          // Auto-fetch info when ticker is visible
          if (!info && !isLoadingThisInfo) {
            fetchStockInfo(ticker.symbol);
          }

          return (
            <div
              key={ticker.symbol}
              className={cn(
                "glass-card p-4 transition-all",
                added && "border-primary/30 bg-primary/5"
              )}
            >
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-lg text-foreground">{ticker.symbol}</span>
                    {price && (
                      <>
                        <span className="font-semibold text-primary">${price.price.toFixed(2)}</span>
                        <span className={cn(
                          "text-sm font-medium",
                          price.changePercent >= 0 ? "text-emerald-500" : "text-red-500"
                        )}>
                          {price.changePercent >= 0 ? '+' : ''}{price.changePercent.toFixed(2)}%
                        </span>
                      </>
                    )}
                    <Badge className={cn('text-xs', getRiskBadgeColor(ticker.riskLevel))}>
                      Volatility {ticker.riskLevel}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {ticker.marketCap}-cap
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {ticker.style}
                    </Badge>
                    {ticker.ai_score && (
                      <Badge variant="outline" className="text-xs text-primary border-primary/50">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Score: {Math.round(ticker.ai_score)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-1">{ticker.name}</p>

                  {/* Description Section */}
                  {info?.description && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">
                        {isExpanded
                          ? info.description
                          : info.description.length > 120
                            ? info.description.slice(0, 120) + '...'
                            : info.description
                        }
                      </p>
                      {info.description.length > 120 && (
                        <button
                          onClick={() => {
                            setExpandedDescriptions(prev => {
                              const next = new Set(prev);
                              if (next.has(ticker.symbol)) {
                                next.delete(ticker.symbol);
                              } else {
                                next.add(ticker.symbol);
                              }
                              return next;
                            });
                          }}
                          className="text-xs text-primary hover:underline mt-1 flex items-center gap-1"
                        >
                          {isExpanded ? (
                            <>Show less <ChevronUp className="h-3 w-3" /></>
                          ) : (
                            <>Read more <ChevronDown className="h-3 w-3" /></>
                          )}
                        </button>
                      )}
                      {isExpanded && (
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {info.industry && (
                            <Badge variant="outline" className="text-xs">{info.industry}</Badge>
                          )}
                          {info.ceo && <span>CEO: {info.ceo}</span>}
                          {info.employees > 0 && <span>Employees: {info.employees.toLocaleString()}</span>}
                        </div>
                      )}
                    </div>
                  )}
                  {isLoadingThisInfo && !info && (
                    <Skeleton className="h-3 w-48 mt-2" />
                  )}

                  <div className="flex flex-wrap gap-2 mt-2">
                    {ticker.dividendYield !== 'none' && (
                      <span className="text-xs text-muted-foreground">
                        💰 {ticker.dividendYield} dividend
                      </span>
                    )}
                    {ticker.volatility === 'low' && (
                      <span className="text-xs text-muted-foreground">📉 Low volatility</span>
                    )}
                    {ticker.isESG && (
                      <span className="text-xs text-muted-foreground">🌱 ESG</span>
                    )}
                    {ticker.ai_analysis && (
                      <AIInsightBadge
                        aiAnalysis={ticker.ai_analysis}
                        symbol={ticker.symbol}
                        compact={true}
                      />
                    )}
                  </div>
                </div>
                <Button
                  variant={added ? "secondary" : "default"}
                  size="sm"
                  onClick={() => !added && handleAddTicker(ticker)}
                  disabled={added}
                  className="gap-2"
                >
                  {added ? (
                    <>
                      <Check className="h-4 w-4" />
                      Added
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setSelectedSector(null)} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Other Sectors
        </Button>
        {currentHoldings.length > 0 && (
          <Button onClick={onDone}>
            Done - Review Simulation
          </Button>
        )}
      </div>
    </div>
  );
}
