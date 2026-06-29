import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Flame,
  Zap,
  Search,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface Mover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  isSignificant: boolean;
  headline?: string;
  briefExplanation?: string;
}

const MARKET_MOVERS_CACHE_KEY = 'market-movers-cache';
const MARKET_MOVERS_CACHE_TTL_MS = 60 * 60 * 1000;

interface MarketMoversCachePayload {
  movers: Mover[];
  marketOverview: string;
  timestamp: string;
  cachedAt: number;
}

export function MarketMoversSection() {
  const navigate = useNavigate();
  const [movers, setMovers] = useState<Mover[]>([]);
  const [marketOverview, setMarketOverview] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const applyMoversData = (data: { movers?: Mover[]; marketOverview?: string; timestamp?: string }) => {
    if (data?.movers) {
      setMovers(data.movers);
      setMarketOverview(data.marketOverview || '');
      setLastUpdate(data.timestamp ? new Date(data.timestamp) : new Date());
      return true;
    }

    setMovers([]);
    return false;
  };

  const readCachedMovers = (): boolean => {
    try {
      const raw = localStorage.getItem(MARKET_MOVERS_CACHE_KEY);
      if (!raw) return false;

      const parsed: MarketMoversCachePayload = JSON.parse(raw);
      const isFresh = Date.now() - parsed.cachedAt < MARKET_MOVERS_CACHE_TTL_MS;
      if (!isFresh) return false;

      setError(null);
      setLoading(false);
      return applyMoversData(parsed);
    } catch (err) {
      console.error('Error reading market movers cache:', err);
      localStorage.removeItem(MARKET_MOVERS_CACHE_KEY);
      return false;
    }
  };

  const writeCachedMovers = (data: { movers?: Mover[]; marketOverview?: string; timestamp?: string }) => {
    if (!data?.movers) return;

    try {
      const payload: MarketMoversCachePayload = {
        movers: data.movers,
        marketOverview: data.marketOverview || '',
        timestamp: data.timestamp || new Date().toISOString(),
        cachedAt: Date.now(),
      };

      localStorage.setItem(MARKET_MOVERS_CACHE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error('Error writing market movers cache:', err);
    }
  };

  const fetchMovers = async ({ showLoader = true }: { showLoader?: boolean } = {}) => {
    if (showLoader) setLoading(true);
    setError(null);
    const API_URL = import.meta.env.VITE_AWS_API_URL || 'http://localhost:8000';

    try {
      const resp = await fetch(`${API_URL}/market-movers`);

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();

      applyMoversData(data);
      writeCachedMovers(data);
    } catch (err) {
      console.error('Error fetching movers:', err);
      setError('Unable to load market data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const hydratedFromCache = readCachedMovers();
    if (!hydratedFromCache) {
      fetchMovers();
    }
  }, []);

  const handleDeepResearch = (symbol: string) => {
    navigate(`/ai-stock-analysis?symbol=${symbol}`);
  };

  // Calculate glow intensity based on change percentage
  const getGlowIntensity = (changePercent: number): number => {
    const absChange = Math.abs(changePercent);
    if (absChange >= 5) return 1;
    if (absChange >= 2) return 0.7;
    return 0.3;
  };

  if (loading) {
    return (
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-10">
            <Skeleton className="h-10 w-80 mx-auto mb-4" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-16 px-4 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto max-w-6xl text-center">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={fetchMovers} className="mt-4 gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </section>
    );
  }

  const filtered = movers.filter(m => Math.abs(m.changePercent) >= 0.5);
  const fallback = movers.length > 0 && filtered.length < 4;

  const pool = fallback ? movers : filtered;
  const topGainers = [...pool]
    .filter(m => m.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 5);
  const topLosers = [...pool]
    .filter(m => m.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 5);

  return (
    <section className="py-10 px-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background" />
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-red-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="container mx-auto max-w-7xl relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-500 px-5 py-2.5 rounded-full text-sm font-semibold mb-5 border border-amber-500/30">
            <Zap className="h-4 w-4 animate-pulse" />
            Live Market Pulse
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text">
            What Everyone's Talking About
          </h2>
          {marketOverview && (
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-5 leading-relaxed">
              {marketOverview}
            </p>
          )}
          {lastUpdate && (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-full">
              <RefreshCw className="h-3 w-3 animate-spin" style={{ animationDuration: '3s' }} />
              Updated {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Two-column layout: Gainers | Losers */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Top Gainers */}
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <ChevronUp className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">Top Gainers</span>
            </div>
            <div className="space-y-2">
              {topGainers.map((mover, index) => {
                const absChange = Math.abs(mover.changePercent);
                const isExtreme = absChange >= 3;
                const glowIntensity = getGlowIntensity(mover.changePercent);
                return (
                  <Card
                    key={mover.symbol}
                    className={`group cursor-pointer transition-all duration-300 hover:scale-[1.02] animate-fade-in
                      ${isExtreme ? 'border-emerald-400/60' : 'border-emerald-500/20 hover:border-emerald-500/40'}
                    `}
                    style={{
                      animationDelay: `${index * 50}ms`,
                      animationFillMode: 'both',
                      boxShadow: `0 0 ${glowIntensity * 24}px rgba(52, 211, 153, ${glowIntensity * 0.35})`,
                    }}
                    onClick={() => handleDeepResearch(mover.symbol)}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm">{mover.symbol}</span>
                          {isExtreme && <Flame className="h-3 w-3 text-emerald-400 animate-pulse" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{mover.name}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-emerald-400">+{mover.changePercent.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">${mover.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-muted-foreground hover:text-emerald-400 flex-shrink-0 gap-1 text-[10px] font-medium"
                        onClick={(e) => { e.stopPropagation(); handleDeepResearch(mover.symbol); }}
                      >
                        <Search className="h-3 w-3" />
                        <span className="hidden sm:inline">Want to understand why?</span>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
              {topGainers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No significant gainers right now</p>
              )}
            </div>
          </div>

          {/* Top Losers */}
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <ChevronDown className="h-4 w-4 text-red-400" />
              <span className="text-sm font-semibold text-red-400">Top Losers</span>
            </div>
            <div className="space-y-2">
              {topLosers.map((mover, index) => {
                const absChange = Math.abs(mover.changePercent);
                const isExtreme = absChange >= 3;
                const glowIntensity = getGlowIntensity(mover.changePercent);
                return (
                  <Card
                    key={mover.symbol}
                    className={`group cursor-pointer transition-all duration-300 hover:scale-[1.02] animate-fade-in
                      ${isExtreme ? 'border-red-400/60' : 'border-red-500/20 hover:border-red-500/40'}
                    `}
                    style={{
                      animationDelay: `${index * 50}ms`,
                      animationFillMode: 'both',
                      boxShadow: `0 0 ${glowIntensity * 24}px rgba(248, 113, 113, ${glowIntensity * 0.35})`,
                    }}
                    onClick={() => handleDeepResearch(mover.symbol)}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                        <TrendingDown className="h-4 w-4 text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm">{mover.symbol}</span>
                          {isExtreme && <Flame className="h-3 w-3 text-red-400 animate-pulse" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{mover.name}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-red-400">{mover.changePercent.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">${mover.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-muted-foreground hover:text-red-400 flex-shrink-0 gap-1 text-[10px] font-medium"
                        onClick={(e) => { e.stopPropagation(); handleDeepResearch(mover.symbol); }}
                      >
                        <Search className="h-3 w-3" />
                        <span className="hidden sm:inline">Want to understand why?</span>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
              {topLosers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No significant losers right now</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
