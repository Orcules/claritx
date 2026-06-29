import { useState, useEffect } from "react";
import { fetchAuthSession, getCurrentUser, signOut } from 'aws-amplify/auth';
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api_adapter";
import { Button } from "@/components/ui/button";
import { Brain, LogOut, Plus, TrendingUp, TrendingDown, PieChart, Download, Copy, Trash2, Search, X, RefreshCw, Sparkles, Star, Loader2, AlertTriangle, Info, Bell, Check, Pencil } from "lucide-react";
import { useTheme } from "next-themes";
import { useStockAutocomplete } from "@/hooks/useStockAutocomplete";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { PieChart as RechartsChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { StockInfoPopover } from "@/components/StockInfoPopover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { SEOHead } from "@/components/SEOHead";
import { EtoroAffiliateCTA } from "@/components/EtoroAffiliateCTA";
import { useUserCredits } from "@/hooks/useUserCredits";
import { Coins, Crown } from "lucide-react";
import { WhatsAppPanel } from "@/components/WhatsAppPanel";


// User interface
interface User {
  id: string;
  email?: string;
  [key: string]: any;
}

// Price tracking interfaces
interface PriceData {
  symbol: string;
  currentPrice: number;
  previousPrice: number | null;
  change: number;
  changePercent: number;
  changeFromLastVisit: number | null;
  isSignificant: boolean;
  direction: 'up' | 'down' | 'none';
}

interface PriceSnapshot {
  symbol: string;
  price: number;
  captured_at: string;
}

interface Holding {
  symbol: string;
  name: string;
  sector: string;
  weight: number;
  riskLevel: number;
  whyFits: string;
  aiScore?: number;
  savedAiScore?: number;
  savedPrice?: number;
  addedAt?: string;
  instrumentType?: 'stock' | 'etf' | 'fund';
}

interface SimilarStock {
  symbol: string;
  name: string;
  sector: string;
  risk_level: number;
  quality_score: number | null;
  style?: string | null;
  pe_ratio?: number | null;
  roe?: number | null;
  dividend_yield_value?: number | null;
}

interface UserPortfolio {
  id: string;
  name: string;
  holdings: Holding[];
  risk_bucket: number;
  risk_label: string;
  sector_allocation: Record<string, number>;
  total_risk_score: number | null;
  created_at: string;
}

// Cache for alternatives per symbol
interface AlternativesCache {
  [symbol: string]: SimilarStock[];
}

// Cache for stock descriptions
interface StockInfoCache {
  [symbol: string]: {
    description: string;
    industry: string;
    ceo?: string;
    employees?: number;
    website?: string;
  };
}

const SECTOR_COLORS: Record<string, string> = {
  'Technology': '#3B82F6',
  'Healthcare': '#10B981',
  'Financials': '#8B5CF6',
  'Consumer': '#F59E0B',
  'Consumer Staples': '#06B6D4',
  'Energy': '#EF4444',
  'Industrials': '#6366F1',
  'Materials': '#84CC16',
  'Utilities': '#14B8A6',
  'Real Estate': '#EC4899',
  'Communication': '#F97316',
};

const getColorForSector = (sector: string, index: number): string => {
  if (SECTOR_COLORS[sector]) return SECTOR_COLORS[sector];
  const fallbackColors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#06B6D4', '#EF4444', '#6366F1'];
  return fallbackColors[index % fallbackColors.length];
};

export default function UserDashboard() {
  const { resolvedTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [portfolios, setPortfolios] = useState<UserPortfolio[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replacingSymbol, setReplacingSymbol] = useState<string | null>(null);
  const [similarStocks, setSimilarStocks] = useState<SimilarStock[]>([]);
  const [loadingReplace, setLoadingReplace] = useState(false);
  const [researchingSymbol, setResearchingSymbol] = useState<string | null>(null);
  const [researchingAll, setResearchingAll] = useState(false);
  const [researchAllProgress, setResearchAllProgress] = useState(0);
  const [alternativesCache, setAlternativesCache] = useState<AlternativesCache>({});
  const [loadingAlternatives, setLoadingAlternatives] = useState<Set<string>>(new Set());
  const [styleFilter, setStyleFilter] = useState<string | null>(null);
  const [dividendFilter, setDividendFilter] = useState<boolean>(false);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { results: suggestions, isLoading: autocompleteLoading } = useStockAutocomplete(searchQuery);
  const [stockInfoCache, setStockInfoCache] = useState<StockInfoCache>({});
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [loadingStockInfo, setLoadingStockInfo] = useState<Set<string>>(new Set());
  const [priceData, setPriceData] = useState<Record<string, PriceData>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [significantChanges, setSignificantChanges] = useState<PriceData[]>([]);
  const [lastVisitDate, setLastVisitDate] = useState<string | null>(null);
  const [scoreDegraded, setScoreDegraded] = useState<{ symbol: string; name: string; saved: number; current: number; drop: number; addedAt?: string }[]>([]);
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const { credits, remaining, loading: creditsLoading, refetch: refetchCredits, isTrialing, isCanceling, isPastDue } = useUserCredits();
  const [cancelingSubscription, setCancelingSubscription] = useState(false);
  const navigate = useNavigate();

  // Derived active portfolio
  const portfolio = portfolios.find(p => p.id === activePortfolioId) || null;

  const SIGNIFICANCE_THRESHOLD = 5; // 5% change is considered significant

  // Filter similar stocks based on selected filters
  const filteredSimilarStocks = similarStocks.filter(stock => {
    if (styleFilter && stock.style !== styleFilter) return false;
    if (dividendFilter && (!stock.dividend_yield_value || stock.dividend_yield_value < 0.005)) return false;
    return true;
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await fetchAuthSession();
        if (!session.tokens?.idToken) {
          throw new Error("No session");
        }
        // Get user details
        const currentUser = await getCurrentUser();
        setUser({ id: currentUser.userId, email: currentUser.username } as any);
      } catch (error) {
        console.error("Auth check failed:", error);
        navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      }
    };

    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchPortfolio();
    }
  }, [user]);

  // Fetch stock info sequentially to avoid overwhelming the backend
  useEffect(() => {
    if (!portfolio?.holdings) return;
    let cancelled = false;
    const fetchAll = async () => {
      for (const h of portfolio.holdings) {
        if (cancelled) break;
        if (!stockInfoCache[h.symbol] && !loadingStockInfo.has(h.symbol)) {
          await fetchStockInfo(h.symbol);
        }
      }
    };
    fetchAll();
    return () => { cancelled = true; };
  }, [portfolio?.holdings]);

  // Detect AI score degradation (10+ point drop from when stock was added)
  useEffect(() => {
    if (!portfolio?.holdings) return;
    const degraded = portfolio.holdings
      .filter(h => h.savedAiScore != null && h.aiScore != null && (h.savedAiScore - h.aiScore) >= 10)
      .map(h => ({
        symbol: h.symbol,
        name: h.name,
        saved: h.savedAiScore!,
        current: h.aiScore!,
        drop: Math.round(h.savedAiScore! - h.aiScore!),
        addedAt: h.addedAt,
      }));
    setScoreDegraded(degraded);
  }, [portfolio?.holdings]);

  // Fetch prices and compare with last visit
  useEffect(() => {
    if (portfolio?.holdings && user && portfolio.holdings.length > 0) {
      fetchAndComparePrices(portfolio);
    }
  }, [portfolio, user]);

  const fetchAndComparePrices = async (p?: UserPortfolio | null) => {
    const activePortfolio = p || portfolio;
    if (!activePortfolio || !user) return;

    setLoadingPrices(true);
    const symbols = activePortfolio.holdings.map(h => h.symbol);

    try {
      // Fetch current prices from FMP
      const priceResponse = await api.post('/stock-prices', { symbols });
      const priceArray = priceResponse?.prices || [];
      const currentPrices: Record<string, { price: number; change?: number; changePercent: number }> = {};
      (Array.isArray(priceArray) ? priceArray : []).forEach((p: any) => {
        currentPrices[p.symbol] = p;
      });

      // Fetch previous price snapshots
      const snapshots = await api.get<PriceSnapshot[]>(`/portfolio/price-snapshots?symbols=${symbols.join(',')}`);

      const previousPricesMap: Record<string, PriceSnapshot> = {};
      snapshots?.forEach((snap: PriceSnapshot) => {
        previousPricesMap[snap.symbol] = snap;
      });

      // Find the most recent snapshot date for display
      if (snapshots && snapshots.length > 0) {
        const mostRecent = snapshots.reduce((latest, snap) => {
          return new Date(snap.captured_at) > new Date(latest.captured_at) ? snap : latest;
        });
        setLastVisitDate(mostRecent.captured_at);
      }

      // Calculate price changes and identify significant moves
      const newPriceData: Record<string, PriceData> = {};
      const significant: PriceData[] = [];

      symbols.forEach(symbol => {
        const current = currentPrices[symbol];
        const previous = previousPricesMap[symbol];

        if (current) {
          let changeFromLastVisit: number | null = null;
          let isSignificant = false;
          let direction: 'up' | 'down' | 'none' = 'none';

          if (previous) {
            changeFromLastVisit = ((current.price - previous.price) / previous.price) * 100;
            isSignificant = Math.abs(changeFromLastVisit) >= SIGNIFICANCE_THRESHOLD;
            direction = changeFromLastVisit > 0 ? 'up' : changeFromLastVisit < 0 ? 'down' : 'none';
          }

          const priceInfo: PriceData = {
            symbol,
            currentPrice: current.price,
            previousPrice: previous?.price || null,
            change: current.change || 0,
            changePercent: current.changePercent || 0,
            changeFromLastVisit,
            isSignificant,
            direction
          };

          newPriceData[symbol] = priceInfo;

          if (isSignificant) {
            significant.push(priceInfo);
          }
        }
      });

      setPriceData(newPriceData);
      setSignificantChanges(significant);

      // Save new snapshots if no significant changes (preserve old prices for alerts)
      if (significant.length === 0) {
        try {
          const upsertData = symbols
            .filter(symbol => currentPrices[symbol])
            .map(symbol => ({
              user_id: user.id,
              symbol,
              price: currentPrices[symbol].price,
              captured_at: new Date().toISOString()
            }));

          if (upsertData.length > 0) {
            await api.post('/portfolio/price-snapshots', { snapshots: upsertData });
          }
        } catch (e) {
          console.warn('Failed to save price snapshots:', e);
        }
      }

    } catch (error) {
      console.error('Error fetching prices:', error);
    } finally {
      setLoadingPrices(false);
    }
  };

  const handleDismissAlert = async (symbol: string) => {
    if (!user) return;

    const price = priceData[symbol];
    if (!price) return;

    try {
      // Upsert the snapshot for this specific symbol
      await api.post('/portfolio/price-snapshots', {
        snapshots: [{
          symbol,
          price: price.currentPrice,
          captured_at: new Date().toISOString()
        }]
      });

      // Remove from significant changes
      setSignificantChanges(prev => prev.filter(c => c.symbol !== symbol));

      // Update price data to mark as not significant
      setPriceData(prev => ({
        ...prev,
        [symbol]: {
          ...prev[symbol],
          isSignificant: false,
          changeFromLastVisit: 0,
          previousPrice: price.currentPrice
        }
      }));

      toast.success(`Alert dismissed for ${symbol}`);
    } catch (error) {
      console.error('Error dismissing alert:', error);
      toast.error('Failed to dismiss alert');
    }
  };

  const fetchPortfolio = async () => {
    try {
      const data = await api.get<UserPortfolio[]>("/user-portfolios");

      if (data && Array.isArray(data)) {
        const formatted = data.map(p => ({
          ...p,
          holdings: (p.holdings as any) || [],
          sector_allocation: (p.sector_allocation as any) || {},
        }));
        setPortfolios(formatted);

        // Auto-select first one if none selected
        if (formatted.length > 0 && !activePortfolioId) {
          setActivePortfolioId(formatted[0].id);
        }
      }
    } catch (error: any) {
      console.error("Error loading portfolios:", error);
      if (error.message && !error.message.includes('404')) {
        toast.error("Error loading portfolios");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAlternatives = async (holding: Holding) => {
    setLoadingAlternatives(prev => new Set(prev).add(holding.symbol));

    try {
      const data = await api.post<{ alternatives: SimilarStock[] }>('/similar-stocks', {
        symbol: holding.symbol,
        sector: holding.sector,
        riskLevel: holding.riskLevel,
        limit: 3
      });

      setAlternativesCache(prev => ({
        ...prev,
        [holding.symbol]: data?.alternatives || []
      }));
    } catch (error) {
      console.error(`Error fetching alternatives for ${holding.symbol}:`, error);
    } finally {
      setLoadingAlternatives(prev => {
        const next = new Set(prev);
        next.delete(holding.symbol);
        return next;
      });
    }
  };

  // Fetch stock info/description from FMP API
  const fetchStockInfo = async (symbol: string) => {
    if (stockInfoCache[symbol] || loadingStockInfo.has(symbol)) return;

    setLoadingStockInfo(prev => new Set(prev).add(symbol));

    try {
      const data = await api.get<any>(`/stock-info/${symbol}`);

      if (data) {
        setStockInfoCache(prev => ({
          ...prev,
          [symbol]: {
            description: data.description || 'No description available.',
            industry: data.industry || '',
            ceo: data.ceo,
            employees: data.employees,
            website: data.website,
          }
        }));
      }
    } catch (error) {
      console.error(`Error fetching stock info for ${symbol}:`, error);
      setStockInfoCache(prev => ({
        ...prev,
        [symbol]: { description: 'No description available.', industry: '' }
      }));
    } finally {
      setLoadingStockInfo(prev => {
        const next = new Set(prev);
        next.delete(symbol);
        return next;
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
      navigate("/");
    }
  };

  const handleCancelSubscription = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to cancel your Pro subscription? You'll keep access until the end of your billing period."
    );
    if (!confirmed) return;

    setCancelingSubscription(true);
    try {
      const data = await api.post('/cancel-subscription', {});
      if (data?.error) throw new Error(data.error);
      toast.success("Subscription will cancel at end of billing period.");
      refetchCredits();
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setCancelingSubscription(false);
    }
  };

  const handleCopyTickers = () => {
    if (!portfolio) return;
    const tickers = portfolio.holdings.map(h => h.symbol).join(', ');
    navigator.clipboard.writeText(tickers);
    toast.success("Tickers copied to clipboard");
  };

  const handleExportCSV = () => {
    if (!portfolio) return;
    const headers = 'Symbol,Name,Sector,Weight,Risk Level\n';
    const rows = portfolio.holdings
      .map(h => `${h.symbol},${h.name},${h.sector},${h.weight}%,${h.riskLevel}`)
      .join('\n');
    const csv = headers + rows;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-portfolio.csv';
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Portfolio exported as CSV");
  };

  const handleDeletePortfolio = async () => {
    if (!portfolio) return;

    const confirmed = window.confirm("Are you sure you want to delete this portfolio?");
    if (!confirmed) return;

    try {
      await api.delete(`/user-portfolios/${portfolio.id}`);

      const remainingPortfolios = portfolios.filter(p => p.id !== portfolio.id);
      setPortfolios(remainingPortfolios);
      
      if (remainingPortfolios.length > 0) {
        setActivePortfolioId(remainingPortfolios[0].id);
      } else {
        setActivePortfolioId(null);
      }
      toast.success("Portfolio deleted");
    } catch (error: any) {
      toast.error("Error deleting portfolio");
    }
  };

  const handleRenamePortfolio = async (id: string, newName: string) => {
    const trimmed = newName.trim();
    setEditingPortfolioId(null);
    if (!trimmed) return;
    const prev = portfolios.find(p => p.id === id)?.name;
    if (trimmed === prev) return;
    // Optimistic update
    setPortfolios(ps => ps.map(p => p.id === id ? { ...p, name: trimmed } : p));
    try {
      await api.patch(`/user-portfolios/${id}/name`, { name: trimmed });
      toast.success("Portfolio renamed");
    } catch {
      // Rollback on failure
      setPortfolios(ps => ps.map(p => p.id === id ? { ...p, name: prev ?? '' } : p));
      toast.error("Failed to rename portfolio");
    }
  };

  const getRiskBadgeColor = (level: number) => {
    if (level <= 2) return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
    if (level <= 3) return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400';
    return 'bg-red-500/20 text-red-600 dark:text-red-400';
  };

  const sectorData = portfolio
    ? Object.entries(portfolio.sector_allocation).map(([name, value], index) => ({
      name,
      value,
      fill: getColorForSector(name, index),
    }))
    : [];

  const handleDeleteHolding = async (symbol: string) => {
    if (!portfolio) return;

    const newHoldings = portfolio.holdings.filter(h => h.symbol !== symbol);

    const totalWeight = newHoldings.reduce((sum, h) => sum + h.weight, 0);
    const rebalancedHoldings = newHoldings.map(h => ({
      ...h,
      weight: Math.round((h.weight / totalWeight) * 100)
    }));

    const newSectorAllocation: Record<string, number> = {};
    rebalancedHoldings.forEach(h => {
      newSectorAllocation[h.sector] = (newSectorAllocation[h.sector] || 0) + h.weight;
    });

    try {
      await api.post("/user-portfolios", {
        ...portfolio,
        holdings: rebalancedHoldings,
        sector_allocation: newSectorAllocation
      });

      setPortfolios(prev => prev.map(p => p.id === activePortfolioId ? {
        ...p,
        holdings: rebalancedHoldings,
        sector_allocation: newSectorAllocation
      } : p));
      toast.success(`${symbol} removed from portfolio`);
    } catch (error: any) {
      toast.error("Error updating portfolio");
    }
  };

  const handleOpenReplace = async (holding: Holding) => {
    setReplacingSymbol(holding.symbol);
    setLoadingReplace(true);
    setStyleFilter(null);
    setDividendFilter(false);

    try {
      const data = await api.post<{ alternatives: SimilarStock[] }>('/similar-stocks', {
        symbol: holding.symbol,
        sector: holding.sector,
        riskLevel: holding.riskLevel,
        limit: 10
      });

      setSimilarStocks(data?.alternatives || []);
    } catch (error) {
      console.error("Error fetching similar stocks:", error);
      toast.error("Failed to load alternatives");
      setSimilarStocks([]);
    } finally {
      setLoadingReplace(false);
    }
  };

  const handleReplaceStock = async (newStock: SimilarStock) => {
    if (!portfolio || !replacingSymbol) return;

    const oldHolding = portfolio.holdings.find(h => h.symbol === replacingSymbol);
    if (!oldHolding) return;

    // Fetch current price for the replacement stock
    let replacePrice: number | undefined;
    try {
      const priceResp = await api.post<{ prices: { symbol: string; price: number }[] }>('/stock-prices', { symbols: [newStock.symbol] });
      const match = priceResp?.prices?.find(p => p.symbol === newStock.symbol);
      if (match?.price) replacePrice = match.price;
    } catch {}

    const newHoldings = portfolio.holdings.map(h =>
      h.symbol === replacingSymbol
        ? {
          symbol: newStock.symbol,
          name: newStock.name,
          sector: newStock.sector,
          weight: h.weight,
          riskLevel: newStock.risk_level,
          whyFits: `Replaced ${replacingSymbol} (Quality: ${newStock.quality_score || 'N/A'})`,
          aiScore: newStock.quality_score || undefined,
          savedAiScore: newStock.quality_score || undefined,
          savedPrice: replacePrice,
          addedAt: new Date().toISOString(),
        }
        : h
    );

    const newSectorAllocation: Record<string, number> = {};
    newHoldings.forEach(h => {
      newSectorAllocation[h.sector] = (newSectorAllocation[h.sector] || 0) + h.weight;
    });

    try {
      await api.post("/user-portfolios", {
        ...portfolio,
        holdings: newHoldings,
        sector_allocation: newSectorAllocation
      });

      setPortfolios(prev => prev.map(p => p.id === activePortfolioId ? {
        ...p,
        holdings: newHoldings,
        sector_allocation: newSectorAllocation
      } : p));
      toast.success(`Replaced ${replacingSymbol} with ${newStock.symbol}`);
      setReplacingSymbol(null);

      // Refresh alternatives for the new stock
      const newHolding = newHoldings.find(h => h.symbol === newStock.symbol);
      if (newHolding) {
        fetchAlternatives(newHolding);
      }
    } catch (error: any) {
      toast.error("Error replacing stock");
    }
  };

  const handleQuickReplace = async (currentSymbol: string, newStock: SimilarStock) => {
    if (!portfolio) return;

    const oldHolding = portfolio.holdings.find(h => h.symbol === currentSymbol);
    if (!oldHolding) return;

    // Fetch current price for the replacement stock
    let replacePrice: number | undefined;
    try {
      const priceResp = await api.post<{ prices: { symbol: string; price: number }[] }>('/stock-prices', { symbols: [newStock.symbol] });
      const match = priceResp?.prices?.find(p => p.symbol === newStock.symbol);
      if (match?.price) replacePrice = match.price;
    } catch {}

    const newHoldings = portfolio.holdings.map(h =>
      h.symbol === currentSymbol
        ? {
          symbol: newStock.symbol,
          name: newStock.name,
          sector: newStock.sector,
          weight: h.weight,
          riskLevel: newStock.risk_level,
          whyFits: `Replaced ${currentSymbol} (Quality: ${newStock.quality_score || 'N/A'})`,
          aiScore: newStock.quality_score || undefined,
          savedAiScore: newStock.quality_score || undefined,
          savedPrice: replacePrice,
          addedAt: new Date().toISOString(),
        }
        : h
    );

    const newSectorAllocation: Record<string, number> = {};
    newHoldings.forEach(h => {
      newSectorAllocation[h.sector] = (newSectorAllocation[h.sector] || 0) + h.weight;
    });

    try {
      await api.post("/user-portfolios", {
        ...portfolio,
        holdings: newHoldings,
        sector_allocation: newSectorAllocation
      });

      setPortfolios(prev => prev.map(p => p.id === activePortfolioId ? {
        ...p,
        holdings: newHoldings,
        sector_allocation: newSectorAllocation
      } : p));
      toast.success(`Replaced ${currentSymbol} with ${newStock.symbol}`);

      // Refresh alternatives for the new stock
      const newHolding = newHoldings.find(h => h.symbol === newStock.symbol);
      if (newHolding) {
        fetchAlternatives(newHolding);
      }
    } catch (error: any) {
      toast.error("Error replacing stock");
    }
  };

  const handleDeepResearch = async (symbol: string) => {
    setResearchingSymbol(symbol);

    try {
      const result = await api.post('/stock-analysis', { symbol });

      if (!result) throw new Error("No response from analysis engine");
      if ((result as any)?.error) throw new Error((result as any).error);

      sessionStorage.setItem('deepResearchResult', JSON.stringify(result));
      sessionStorage.setItem('deepResearchSymbol', symbol);

      navigate(`/ai-stock-analysis?symbol=${symbol}`);
    } catch (error: any) {
      console.error("Deep Research error:", error);
      if (error?.name === 'InsufficientCreditsError') {
        toast.error("Insufficient credits. Redirecting…");
        setTimeout(() => navigate('/pricing?return=my-portfolio'), 600);
      } else {
        toast.error("Failed to analyze stock");
      }
      setResearchingSymbol(null);
    }
  };

  const handleDeepResearchAll = async () => {
    if (!portfolio) return;

    setResearchingAll(true);
    setResearchAllProgress(0);

    // Store portfolio data for the analysis page
    sessionStorage.setItem('portfolioForAnalysis', JSON.stringify({
      holdings: portfolio.holdings,
      risk_label: portfolio.risk_label,
      risk_bucket: portfolio.risk_bucket,
    }));

    // Navigate to the portfolio analysis page
    navigate('/portfolio-analysis');
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleAddStock = async (stock: SimilarStock) => {
    if (!portfolio) return;

    // Check if stock already exists
    if (portfolio.holdings.some(h => h.symbol === stock.symbol)) {
      toast.error(`${stock.symbol} is already in your portfolio`);
      return;
    }

    // Fetch current price and AI score for the stock being added
    let currentPrice: number | undefined;
    let currentAiScore: number | undefined = stock.quality_score || undefined;
    try {
      const priceResp = await api.post<{ prices: { symbol: string; price: number }[] }>('/stock-prices', { symbols: [stock.symbol] });
      const match = priceResp?.prices?.find(p => p.symbol === stock.symbol);
      if (match?.price) currentPrice = match.price;
    } catch {}
    if (!currentAiScore) {
      try {
        const searchResp = await api.get<{ symbol: string; quality_score: number }[]>(`/search-stocks?q=${stock.symbol}`);
        const match = searchResp?.find(s => s.symbol === stock.symbol);
        if (match?.quality_score) currentAiScore = match.quality_score;
      } catch {}
    }

    const newHolding: Holding = {
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector,
      weight: 0,
      riskLevel: stock.risk_level,
      whyFits: `Added manually${currentAiScore ? ` (Quality: ${Math.round(currentAiScore)})` : ''}`,
      aiScore: currentAiScore,
      savedAiScore: currentAiScore,
      savedPrice: currentPrice,
      addedAt: new Date().toISOString(),
    };

    const newHoldings = [...portfolio.holdings, newHolding];

    // Rebalance weights equally
    const equalWeight = Math.round(100 / newHoldings.length);
    const rebalancedHoldings = newHoldings.map((h, i) => ({
      ...h,
      weight: i === newHoldings.length - 1 ? 100 - (equalWeight * (newHoldings.length - 1)) : equalWeight
    }));

    // Recalculate sector allocation
    const newSectorAllocation: Record<string, number> = {};
    rebalancedHoldings.forEach(h => {
      newSectorAllocation[h.sector] = (newSectorAllocation[h.sector] || 0) + h.weight;
    });

    try {
      await api.post("/user-portfolios", {
        ...portfolio,
        holdings: rebalancedHoldings,
        sector_allocation: newSectorAllocation
      });

      setPortfolios(prev => prev.map(p => p.id === activePortfolioId ? {
        ...p,
        holdings: rebalancedHoldings,
        sector_allocation: newSectorAllocation
      } : p));
      toast.success(`${stock.symbol} added to portfolio`);
      setAddStockOpen(false);
      setSearchQuery('');

      // Fetch alternatives for the new stock
      fetchAlternatives(newHolding);
    } catch (error: any) {
      toast.error("Error adding stock");
    }
  };

  const getQualityBadge = (score: number | null) => {
    if (!score) return null;
    if (score >= 80) return { label: 'High Quality', color: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' };
    if (score >= 60) return { label: 'Good', color: 'bg-blue-500/20 text-blue-600 dark:text-blue-400' };
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="My Portfolio | ClaritX"
        description="View and manage your simulated investment portfolio. Track holdings, analyze performance, and get AI-powered insights."
        noindex={true}
      />
      {/* Deep Research Transition Overlay */}
      {researchingSymbol && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md animate-fade-in">
          <div className="text-center space-y-8">
            <div className="relative w-32 h-32 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-ping" />
              <div className="absolute inset-2 rounded-full border-4 border-secondary/40 animate-ping animation-delay-200" />
              <div className="absolute inset-4 rounded-full border-4 border-primary/50 animate-ping animation-delay-400" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary via-secondary to-primary animate-pulse flex items-center justify-center shadow-2xl">
                  <Search className="h-8 w-8 text-primary-foreground animate-bounce" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-4xl font-display font-bold">
                <span className="bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent animate-pulse">
                  {researchingSymbol}
                </span>
              </h2>
              <p className="text-lg text-muted-foreground animate-fade-up animation-delay-200">
                Launching Deep Research...
              </p>
            </div>

            <div className="w-64 mx-auto h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary via-secondary to-primary rounded-full research-progress-bar" />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="glass-card border-t-0 rounded-t-none sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center">
              <div className="overflow-hidden h-12">
                <img
                  src={resolvedTheme !== 'light' ? '/logo-white.png' : '/logo-black.png'}
                  alt="ClaritX"
                  className="h-24 w-auto -mt-6"
                />
              </div>
            </Link>

            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-up">
            {/* WhatsApp Daily Digest — Always Visible */}
            <div className="max-w-xl">
              <WhatsAppPanel />
            </div>

            {portfolio ? (
              <div className="space-y-8">
                {/* Simulation Label */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium w-fit">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Simulation Only – Not Investment Advice
                </div>


            {/* Portfolio Selector */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-display font-semibold flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  My Portfolios
                </h2>
                <Link to="/portfolio-simulator">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Portfolio
                  </Button>
                </Link>
              </div>

              {/* Scrollable Portfolio List */}
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                {portfolios.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (editingPortfolioId !== p.id && activePortfolioId !== p.id) {
                        setActivePortfolioId(p.id);
                        setAlternativesCache({});
                        setPriceData({});
                        setSignificantChanges([]);
                      }
                    }}
                    className={cn(
                      "flex-shrink-0 min-w-[200px] p-4 rounded-xl border-2 transition-all text-left group cursor-pointer",
                      activePortfolioId === p.id
                        ? "bg-primary/10 border-primary shadow-lg scale-105"
                        : "bg-card border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1">
                        {editingPortfolioId === p.id ? (
                            <div className="flex items-center gap-1 w-full flex-1">
                              <input
                                autoFocus
                                value={editingName}
                                onChange={e => setEditingName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleRenamePortfolio(p.id, editingName);
                                  if (e.key === 'Escape') setEditingPortfolioId(null);
                                }}
                                onClick={e => e.stopPropagation()}
                                className="flex-1 min-w-0 bg-transparent border-b border-primary text-sm font-bold outline-none"
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRenamePortfolio(p.id, editingName); }}
                                className="p-1 min-w-max text-primary hover:bg-primary/20 rounded transition-colors"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingPortfolioId(null); }}
                                className="p-1 min-w-max text-destructive hover:bg-destructive/20 rounded transition-colors"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                        ) : (
                          <>
                            <p className={cn(
                              "font-bold truncate flex-1 text-sm",
                              activePortfolioId === p.id ? "text-primary" : "text-foreground"
                            )}>
                              {p.name || 'Untitled Portfolio'}
                            </p>
                            <button
                              onClick={e => { e.stopPropagation(); setEditingPortfolioId(p.id); setEditingName(p.name || ''); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                              title="Rename portfolio"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{p.holdings.length} Assets</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {p.risk_label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Current Portfolio Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t">
              <div>
                <div className="flex items-center gap-2 group/title">
                  {editingPortfolioId === portfolio.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenamePortfolio(portfolio.id, editingName);
                          if (e.key === 'Escape') setEditingPortfolioId(null);
                        }}
                        className="text-4xl font-display font-bold text-foreground tracking-tight bg-transparent border-b-2 border-primary outline-none w-full min-w-[200px]"
                      />
                      <button
                        onClick={() => handleRenamePortfolio(portfolio.id, editingName)}
                        className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
                        title="Save name"
                      >
                        <Check className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setEditingPortfolioId(null)}
                        className="p-2 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-md transition-colors"
                        title="Cancel"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-4xl font-display font-bold text-foreground tracking-tight">
                        {portfolio.name || 'My Portfolio'}
                      </h1>
                      <button
                        onClick={() => { setEditingPortfolioId(portfolio.id); setEditingName(portfolio.name || ''); }}
                        className="opacity-0 group-hover/title:opacity-100 transition-opacity text-muted-foreground hover:text-foreground mt-1"
                        title="Rename portfolio"
                      >
                        <Pencil className="h-5 w-5 ml-2" />
                      </button>
                    </>
                  )}
                </div>
                <p className="text-muted-foreground mt-1 flex items-center gap-2">
                  <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 px-2 py-0">
                    {portfolio.risk_label}
                  </Badge>
                  • Last updated {new Date(portfolio.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setAddStockOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add More
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopyTickers} className="gap-2">
                  <Copy className="h-4 w-4" />
                  Copy Tickers
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleDeletePortfolio} className="gap-2 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>

            {/* Deep Research All Button */}
            <div className="glass-card p-4 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Deep Research All</h3>
                    <p className="text-sm text-muted-foreground">
                      AI-analyze all {portfolio.holdings.length} holdings at once
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleDeepResearchAll}
                  className="gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                  disabled={researchingAll}
                >
                  <Brain className="h-4 w-4" />
                  Analyze Portfolio
                </Button>
              </div>
            </div>

            {/* Significant Changes Alert Banner */}
            {significantChanges.length > 0 && (
              <div className="glass-card p-4 border-2 border-primary/50 bg-gradient-to-r from-primary/10 to-secondary/10">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Bell className="h-5 w-5 text-primary animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {significantChanges.length} stock{significantChanges.length > 1 ? 's have' : ' has'} moved significantly!
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {lastVisitDate && `Since your last visit on ${new Date(lastVisitDate).toLocaleDateString()}`}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {significantChanges.map(change => (
                          <span
                            key={change.symbol}
                            className={cn(
                              "px-2 py-1 rounded text-xs font-medium",
                              change.direction === 'up'
                                ? "bg-success/20 text-success"
                                : "bg-destructive/20 text-destructive"
                            )}
                          >
                            {change.symbol} {change.direction === 'up' ? '+' : ''}{change.changeFromLastVisit?.toFixed(1)}%
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={handleDeepResearchAll}
                    variant="outline"
                    size="sm"
                    className="gap-2 shrink-0"
                  >
                    <Search className="h-4 w-4" />
                    Investigate Why
                  </Button>
                </div>
              </div>
            )}

            {/* AI Score Degradation Alert */}
            {scoreDegraded.length > 0 && (
              <div className="glass-card p-4 border-2 border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-5 w-5 text-amber-500 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {scoreDegraded.length} holding{scoreDegraded.length > 1 ? 's have' : ' has'} dropped in AI score
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        These stocks scored lower since you added them — consider replacing with better-rated alternatives.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {scoreDegraded.map(d => (
                          <span
                            key={d.symbol}
                            className="px-2 py-1 rounded text-xs font-medium bg-amber-500/20 text-amber-700 dark:text-amber-400"
                          >
                            {d.symbol} {Math.round(d.saved)} → {Math.round(d.current)} (−{d.drop}pts)
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Holdings List */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Holdings
                  </h2>
                  {loadingPrices && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Fetching prices...
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {portfolio.holdings.map((holding) => {
                    const alternatives = alternativesCache[holding.symbol] || [];
                    const isLoadingAlts = loadingAlternatives.has(holding.symbol);
                    const price = priceData[holding.symbol];
                    const isSignificant = price?.isSignificant;
                    const scoreDropInfo = scoreDegraded.find(d => d.symbol === holding.symbol);

                    return (
                      <div
                        key={holding.symbol}
                        className={cn(
                          "glass-card p-4 transition-all duration-500",
                          isSignificant && price.direction === 'up' && "price-alert-bullish",
                          isSignificant && price.direction === 'down' && "price-alert-bearish"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-lg text-foreground">{holding.symbol}</span>
                              <Badge className={cn('text-xs', getRiskBadgeColor(holding.riskLevel || 3))}>
                                {holding.riskLevel ? `Volatility ${holding.riskLevel}` : 'Volatility 3'}
                              </Badge>
                              {holding.aiScore !== undefined && (
                                <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                                  AI Rating: {Math.round(holding.aiScore)}/100
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{holding.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{holding.sector || 'General'}</Badge>
                              {holding.whyFits && (
                                <span className="text-xs text-muted-foreground">{holding.whyFits}</span>
                              )}
                            </div>

                            {/* Entry Snapshot: date, AI score change, price change */}
                            {(holding.addedAt || holding.savedAiScore != null || holding.savedPrice != null || price?.currentPrice != null) && (
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                                {holding.addedAt && (
                                  <span>Added {new Date(holding.addedAt).toLocaleDateString()}</span>
                                )}
                                {holding.savedAiScore != null && holding.aiScore != null && (
                                  <span className={cn(
                                    "font-medium",
                                    holding.aiScore >= holding.savedAiScore ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                                  )}>
                                    AI: {Math.round(holding.savedAiScore)} → {Math.round(holding.aiScore)}
                                    {' '}({holding.aiScore >= holding.savedAiScore ? '+' : ''}{Math.round(holding.aiScore - holding.savedAiScore)})
                                  </span>
                                )}
                                {price?.currentPrice != null && (
                                  holding.savedPrice != null ? (
                                    <span className={cn(
                                      "font-medium",
                                      price.currentPrice >= holding.savedPrice ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                                    )}>
                                      Price: ${holding.savedPrice.toFixed(2)} → ${price.currentPrice.toFixed(2)}
                                      {' '}({price.currentPrice >= holding.savedPrice ? '+' : ''}{(((price.currentPrice - holding.savedPrice) / holding.savedPrice) * 100).toFixed(1)}%)
                                    </span>
                                  ) : (
                                    <span className="font-medium">
                                      Price: ${price.currentPrice.toFixed(2)}
                                    </span>
                                  )
                                )}
                              </div>
                            )}

                            {/* Inline Stock Description */}
                            {(() => {
                              const info = stockInfoCache[holding.symbol];
                              const isLoading = loadingStockInfo.has(holding.symbol);
                              const isExpanded = expandedDescriptions.has(holding.symbol);

                              if (isLoading) {
                                return (
                                  <p className="text-xs text-muted-foreground mt-2 animate-pulse">
                                    Loading description...
                                  </p>
                                );
                              }

                              if (info?.description) {
                                const shortDesc = info.description.length > 100
                                  ? info.description.substring(0, 100) + '...'
                                  : info.description;
                                const hasMore = info.description.length > 100 || info.ceo || info.employees || info.website;

                                return (
                                  <div className="mt-2">
                                    {info.industry && (
                                      <Badge variant="secondary" className="text-[10px] mb-1">
                                        {info.industry}
                                      </Badge>
                                    )}
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                      {isExpanded ? info.description : shortDesc}
                                    </p>

                                    {/* Expanded details */}
                                    {isExpanded && (info.ceo || info.employees || info.website) && (
                                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                                        {info.ceo && (
                                          <span><strong>CEO:</strong> {info.ceo}</span>
                                        )}
                                        {info.employees && (
                                          <span><strong>Employees:</strong> {info.employees.toLocaleString()}</span>
                                        )}
                                        {info.website && (
                                          <a
                                            href={info.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline"
                                          >
                                            Website →
                                          </a>
                                        )}
                                      </div>
                                    )}

                                    {hasMore && (
                                      <button
                                        onClick={() => {
                                          setExpandedDescriptions(prev => {
                                            const next = new Set(prev);
                                            if (isExpanded) {
                                              next.delete(holding.symbol);
                                            } else {
                                              next.add(holding.symbol);
                                            }
                                            return next;
                                          });
                                        }}
                                        className="text-xs text-primary hover:underline font-medium mt-1"
                                      >
                                        {isExpanded ? '↑ Show less' : '↓ Read more'}
                                      </button>
                                    )}
                                  </div>
                                );
                              }

                              return null;
                            })()}
                          </div>
                          <div className="text-right space-y-1">
                            <p className="text-2xl font-bold text-foreground">{holding.weight}%</p>
                            {/* Current Price */}
                            {price && (
                              <div className="space-y-0.5">
                                <p className="text-sm font-semibold text-foreground">
                                  ${price.currentPrice.toFixed(2)}
                                </p>
                                {holding.savedPrice != null && (
                                  (() => {
                                    const pctChange = ((price.currentPrice - holding.savedPrice) / holding.savedPrice) * 100;
                                    return (
                                      <p className={cn(
                                        "text-xs font-medium flex items-center justify-end gap-1",
                                        pctChange >= 0 ? "text-success" : "text-destructive"
                                      )}>
                                        {pctChange >= 0 ? (
                                          <TrendingUp className="h-3 w-3" />
                                        ) : (
                                          <TrendingDown className="h-3 w-3" />
                                        )}
                                        {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}%
                                      </p>
                                    );
                                  })()
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Significant Change Alert */}
                        {isSignificant && price.changeFromLastVisit !== null && (
                          <div className={cn(
                            "mt-3 p-3 rounded-lg flex items-center justify-between",
                            price.direction === 'up'
                              ? "bg-success/20 border-2 border-success/50"
                              : "bg-destructive/20 border-2 border-destructive/50"
                          )}>
                            <div className="flex items-center gap-2">
                              {price.direction === 'up' ? (
                                <TrendingUp className="h-5 w-5 text-success animate-pulse" />
                              ) : (
                                <TrendingDown className="h-5 w-5 text-destructive animate-pulse" />
                              )}
                              <div>
                                <span className={cn(
                                  "text-sm font-bold",
                                  price.direction === 'up' ? "text-success" : "text-destructive"
                                )}>
                                  {price.direction === 'up' ? '📈 Up' : '📉 Down'} {Math.abs(price.changeFromLastVisit).toFixed(1)}% since your last visit
                                </span>
                                {price.direction === 'down' && (
                                  <p className="text-xs text-destructive/80 mt-0.5">
                                    ⚠️ Investigate what happened - run Deep Research
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant={price.direction === 'down' ? "destructive" : "default"}
                                size="sm"
                                className={cn(
                                  "gap-1.5 font-semibold",
                                  price.direction === 'down' && "flash-button"
                                )}
                                onClick={() => handleDeepResearch(holding.symbol)}
                              >
                                <Search className="h-3.5 w-3.5" />
                                Research
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => handleDismissAlert(holding.symbol)}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Dismiss
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* AI Score Degradation Alert */}
                        {scoreDropInfo && (
                          <div className="mt-3 p-3 rounded-lg flex items-center justify-between bg-amber-500/20 border-2 border-amber-500/50">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-amber-500 animate-pulse" />
                              <div>
                                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                                  AI score dropped {scoreDropInfo.drop} points ({scoreDropInfo.saved} → {scoreDropInfo.current})
                                </span>
                                <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                                  {holding.addedAt
                                    ? `Since added on ${new Date(holding.addedAt).toLocaleDateString()} — consider replacing`
                                    : 'Consider replacing with a higher-rated alternative below'}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                              onClick={() => handleOpenReplace(holding)}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Find Better
                            </Button>
                          </div>
                        )}

                        {/* Similar Instruments Section */}
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="flex items-center gap-2 mb-2">
                            <Star className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Explore Similar (sector/score similarity):</span>
                            {!isLoadingAlts && alternatives.length === 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-2 text-[10px] text-muted-foreground hover:text-primary"
                                onClick={() => fetchAlternatives(holding)}
                              >
                                Load
                              </Button>
                            )}
                          </div>
                          {isLoadingAlts ? (
                            <div className="flex items-center gap-2">
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-primary" />
                              <span className="text-xs text-muted-foreground">Loading...</span>
                            </div>
                          ) : alternatives.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {alternatives.map((alt) => {
                                const qualityBadge = getQualityBadge(alt.quality_score);
                                return (
                                  <button
                                    key={alt.symbol}
                                    onClick={() => handleQuickReplace(holding.symbol, alt)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-muted/30 hover:bg-accent hover:border-primary/50 transition-all text-xs group"
                                    title={`Replace with ${alt.symbol} - ${alt.name}`}
                                  >
                                    <span className="font-medium text-foreground group-hover:text-primary">
                                      {alt.symbol}
                                    </span>
                                    {alt.quality_score && (
                                      <span className={cn(
                                        "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                        alt.quality_score >= 80
                                          ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                          : alt.quality_score >= 60
                                            ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                                            : "bg-muted text-muted-foreground"
                                      )}>
                                        {Math.round(alt.quality_score)}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => handleDeepResearch(holding.symbol)}
                          >
                            <Search className="h-3.5 w-3.5" />
                            Deep Research
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => handleOpenReplace(holding)}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Compare Alternatives
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleDeleteHolding(holding.symbol)}
                          >
                            <X className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sector Allocation */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  Sector Allocation
                </h2>

                <div className="glass-card p-4">
                  {sectorData.length > 0 && (
                    <>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsChart>
                            <Pie
                              data={sectorData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {sectorData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number) => [`${value}%`, 'Allocation']}
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                            />
                          </RechartsChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="space-y-2 mt-4">
                        {sectorData.map((sector) => (
                          <div key={sector.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: sector.fill }}
                              />
                              <span className="text-muted-foreground">{sector.name}</span>
                            </div>
                            <span className="font-medium text-foreground">{sector.value}%</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Right Column: Allocation & Summary */}
                <div className="space-y-6">
                  {/* Risk Summary */}
                  <div className="glass-card p-4 space-y-3">
                    <h3 className="font-semibold text-foreground">Risk Summary</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Risk Profile</span>
                        <span className="font-medium">{portfolio.risk_label}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Risk Score</span>
                        <span className="font-medium">{portfolio.total_risk_score || portfolio.risk_bucket}/5</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Holdings</span>
                        <span className="font-medium">{portfolio.holdings.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Sectors</span>
                        <span className="font-medium">{Object.keys(portfolio.sector_allocation).length}</span>
                      </div>
                    </div>
                  </div>

                  <Button asChild className="w-full">
                    <Link to="/portfolio-simulator">
                      Build New Portfolio
                    </Link>
                  </Button>

                  <div className="mt-4">
                    <EtoroAffiliateCTA variant="inline" context="dashboard" />
                  </div>

                  <div className="mt-6 pt-6 border-t border-border">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Coins className="h-4 w-4 text-primary" />
                        Account Status
                      </h3>
                      {credits?.subscription_tier === 'pro' && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1 py-0.5">
                          <Crown className="h-3 w-3" />
                          {isTrialing ? 'Trial' : 'Pro'}
                        </Badge>
                      )}
                    </div>

                    <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-xs text-muted-foreground">Available Credits</span>
                        <span className="text-xl font-bold font-mono">{remaining}</span>
                      </div>
                      <Progress value={(remaining / (credits?.monthly_credits || 3)) * 100} className="h-1.5 mb-3" />

                      {isTrialing && credits?.trial_end && (
                        <p className="text-xs text-primary mb-3">
                          Trial ends {new Date(credits.trial_end).toLocaleDateString()}
                        </p>
                      )}

                      {isPastDue && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-500 mb-3">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Payment issue — please update your payment method
                        </div>
                      )}

                      {isCanceling && credits?.period_end && (
                        <p className="text-xs text-amber-500 mb-3">
                          Cancels on {new Date(credits.period_end).toLocaleDateString()}
                        </p>
                      )}

                      <div className="space-y-2">
                        <Button asChild variant="outline" size="sm" className="w-full text-xs h-8">
                          <Link to="/pricing">
                            {credits?.subscription_tier === 'pro' ? 'Get More Credits' : 'Upgrade to Pro'}
                          </Link>
                        </Button>

                        {credits?.subscription_tier === 'pro' && !isCanceling && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={handleCancelSubscription}
                            disabled={cancelingSubscription}
                          >
                            {cancelingSubscription && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                            Cancel Subscription
                          </Button>
                        )}
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground mt-3 text-center italic">
                      Credits are used for stock analysis and deep research reports.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>


        ) : (
          /* No Portfolio State */
          <div className="max-w-2xl mx-auto text-center py-20 animate-fade-up">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <PieChart className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">
              No Portfolio Yet
            </h2>
            <p className="text-muted-foreground mb-8">
              You haven't created a portfolio yet. Use our Portfolio Builder to create a personalized investment portfolio based on your risk profile.
            </p>
            <Button asChild size="lg">
              <Link to="/portfolio-simulator">
                <Plus className="h-5 w-5 mr-2" />
                Build My Portfolio
              </Link>
            </Button>

            <div className="mt-12 max-w-lg mx-auto">
              <EtoroAffiliateCTA variant="subtle" context="portfolio" />
            </div>
          </div>
        )}

        {/* Replace Stock Dialog */}
        <Dialog open={!!replacingSymbol} onOpenChange={() => {
          setReplacingSymbol(null);
          setStyleFilter(null);
          setDividendFilter(false);
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Replace {replacingSymbol}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Filter Controls */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Filter by:</p>
                <div className="flex flex-wrap gap-2">
                  {/* Style Filters */}
                  <button
                    onClick={() => setStyleFilter(styleFilter === 'Growth' ? null : 'Growth')}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                      styleFilter === 'Growth'
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/50"
                        : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                    )}
                  >
                    Growth
                  </button>
                  <button
                    onClick={() => setStyleFilter(styleFilter === 'Value' ? null : 'Value')}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                      styleFilter === 'Value'
                        ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/50"
                        : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                    )}
                  >
                    Value
                  </button>
                  <button
                    onClick={() => setStyleFilter(styleFilter === 'Blend' ? null : 'Blend')}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                      styleFilter === 'Blend'
                        ? "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/50"
                        : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                    )}
                  >
                    Blend
                  </button>

                  {/* Divider */}
                  <div className="w-px h-6 bg-border mx-1" />

                  {/* Dividend Filter */}
                  <button
                    onClick={() => setDividendFilter(!dividendFilter)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                      dividendFilter
                        ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/50"
                        : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                    )}
                  >
                    💰 Dividend Paying
                  </button>
                </div>

                {/* Active Filters Summary */}
                {(styleFilter || dividendFilter) && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {filteredSimilarStocks.length} of {similarStocks.length} stocks match
                    </span>
                    <button
                      onClick={() => { setStyleFilter(null); setDividendFilter(false); }}
                      className="text-primary hover:underline"
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </div>

              {/* Stock List */}
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {loadingReplace ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : filteredSimilarStocks.length > 0 ? (
                  filteredSimilarStocks.map((stock) => (
                    <button
                      key={stock.symbol}
                      onClick={() => handleReplaceStock(stock)}
                      className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground">{stock.symbol}</span>
                            {stock.quality_score && (
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                stock.quality_score >= 80
                                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                  : stock.quality_score >= 60
                                    ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                                    : "bg-muted text-muted-foreground"
                              )}>
                                Q: {Math.round(stock.quality_score)}
                              </span>
                            )}
                            {stock.style && (
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                stock.style === 'Growth' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                                stock.style === 'Value' && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                                stock.style === 'Blend' && "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                              )}>
                                {stock.style}
                              </span>
                            )}
                            {stock.dividend_yield_value && stock.dividend_yield_value >= 1 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                {stock.dividend_yield_value.toFixed(1)}% Div
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{stock.name}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            {stock.roe && <span>ROE: {stock.roe.toFixed(1)}%</span>}
                            {stock.pe_ratio && <span>• P/E: {stock.pe_ratio.toFixed(1)}</span>}
                          </div>
                        </div>
                        <Badge className={cn('text-xs shrink-0', getRiskBadgeColor(stock.risk_level))}>
                          Risk {stock.risk_level}
                        </Badge>
                      </div>
                    </button>
                  ))
                ) : similarStocks.length > 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No stocks match current filters. Try adjusting filters.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No similar stocks found in the same sector.
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Stock Dialog */}
        <Dialog open={addStockOpen} onOpenChange={(open) => {
          setAddStockOpen(open);
          if (!open) {
            setSearchQuery('');
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Stock to Portfolio</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by symbol or name..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value.toUpperCase())}
                  className="pl-10"
                  autoFocus
                />
              </div>

              {/* Search Results */}
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {autocompleteLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : suggestions.length > 0 ? (
                  suggestions.map((stock) => {
                    const alreadyInPortfolio = portfolio?.holdings.some(h => h.symbol === stock.symbol);
                    return (
                      <button
                        key={stock.symbol}
                        onClick={() => !alreadyInPortfolio && handleAddStock(stock)}
                        disabled={alreadyInPortfolio}
                        className={cn(
                          "w-full text-left p-3 rounded-lg border transition-colors",
                          alreadyInPortfolio
                            ? "border-border/50 bg-muted/30 opacity-50 cursor-not-allowed"
                            : "border-border hover:bg-accent hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground">{stock.symbol}</span>
                              {alreadyInPortfolio && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  Already added
                                </span>
                              )}
                              {stock.quality_score && (
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                  stock.quality_score >= 80
                                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                    : stock.quality_score >= 60
                                      ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                                      : "bg-muted text-muted-foreground"
                                )}>
                                  Q: {Math.round(stock.quality_score)}
                                </span>
                              )}
                              {stock.style && (
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                  stock.style === 'Growth' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                                  stock.style === 'Value' && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                                  stock.style === 'Blend' && "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                )}>
                                  {stock.style}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{stock.name}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              {stock.sector && stock.sector !== 'Unknown' && <span>{stock.sector}</span>}
                              {stock.roe && <span>• ROE: {stock.roe.toFixed(1)}%</span>}
                              {stock.pe_ratio && <span>• P/E: {stock.pe_ratio.toFixed(1)}</span>}
                            </div>
                          </div>
                          {stock.risk_level > 0 && (
                            <Badge className={cn('text-xs shrink-0', getRiskBadgeColor(stock.risk_level))}>
                              Risk {stock.risk_level}
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })
                ) : searchQuery.length > 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No stocks found for "{searchQuery}"
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Start typing to search for stocks...
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )}
  </main>
</div>
);
}

