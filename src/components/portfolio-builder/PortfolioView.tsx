import { useState, useEffect } from 'react';
import { useTheme } from "next-themes";
import { Portfolio, RiskProfile } from '@/types/portfolioBuilder';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Download,
  Copy,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  PieChart,
  Search,
  Sparkles,
  Shield,
  Zap,
  Brain,
  Star,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { PieChart as RechartsChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '@/lib/apiAdapter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useStockInfo } from '@/hooks/useStockInfo';
import { AIInsightBadge, extractBriefInsight } from './AIInsightBadge';

interface PortfolioViewProps {
  portfolio: Portfolio;
  riskProfile: RiskProfile;
  onRemoveHolding: (symbol: string) => void;
  onRegenerate: () => void;
  onEdit: () => void;
  onSave: () => void;
  isSaving?: boolean;
  onReplaceHolding?: (oldSymbol: string, newStock: SimilarStock) => void;
}

interface SimilarStock {
  symbol: string;
  name: string;
  sector: string;
  risk_level: number;
  quality_score: number | null;
  style: string | null;
  pe_ratio: number | null;
  roe: number | null;
  dividend_yield_value: number | null;
}

interface AlternativesCache {
  [symbol: string]: SimilarStock[];
}

export function PortfolioView({
  portfolio,
  riskProfile,
  onRemoveHolding,
  onRegenerate,
  onEdit,
  onSave,
  isSaving = false,
  onReplaceHolding,
}: PortfolioViewProps) {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const [alternativesCache, setAlternativesCache] = useState<AlternativesCache>({});
  const [loadingAlternatives, setLoadingAlternatives] = useState<Set<string>>(new Set());
  const [replacingSymbol, setReplacingSymbol] = useState<string | null>(null);
  const [similarStocks, setSimilarStocks] = useState<SimilarStock[]>([]);
  const [loadingReplace, setLoadingReplace] = useState(false);
  const [styleFilter, setStyleFilter] = useState<string | null>(null);
  const [dividendFilter, setDividendFilter] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  const { infoCache, priceCache, loadingInfo, loadingPrices, fetchStockInfo, fetchPrices } = useStockInfo();

  // Fetch prices for all holdings
  useEffect(() => {
    if (portfolio.holdings.length > 0) {
      const symbols = portfolio.holdings.map(h => h.symbol);
      fetchPrices(symbols);
    }
  }, [portfolio.holdings]);

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

  const sectorData = Object.entries(portfolio.sectorAllocation).map(([name, value], index) => ({
    name,
    value,
    fill: getColorForSector(name, index),
  }));

  // Fetch alternatives for all holdings
  useEffect(() => {
    portfolio.holdings.forEach(holding => {
      if (!alternativesCache[holding.symbol] && !loadingAlternatives.has(holding.symbol)) {
        fetchAlternatives(holding);
      }
    });
  }, [portfolio.holdings]);

  const fetchAlternatives = async (holding: Portfolio['holdings'][0]) => {
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

  const handleCopyTickers = () => {
    const tickers = portfolio.holdings.map(h => h.symbol).join(', ');
    navigator.clipboard.writeText(tickers);
    toast({
      title: 'Copied!',
      description: 'Tickers copied to clipboard',
    });
  };

  const handleExportCSV = () => {
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

    toast({
      title: 'Exported!',
      description: 'Portfolio saved as CSV',
    });
  };

  const handleViewAnalysis = (symbol: string) => {
    navigate(`/ai-stock-analysis?symbol=${symbol}`);
  };

  const handleDeepResearchAll = () => {
    // Store portfolio data for the analysis page
    sessionStorage.setItem('portfolioForAnalysis', JSON.stringify({
      holdings: portfolio.holdings.map(h => ({
        symbol: h.symbol,
        name: h.name,
        weight: h.weight,
        sector: h.sector,
        riskLevel: h.riskLevel,
      })),
      risk_label: riskProfile.riskLabel,
      risk_bucket: riskProfile.riskBucket,
    }));

    navigate('/portfolio-analysis');
  };

  const handleOpenReplace = async (holding: Portfolio['holdings'][0]) => {
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
      toast({
        title: 'Error',
        description: 'Failed to load alternatives',
        variant: 'destructive',
      });
      setSimilarStocks([]);
    } finally {
      setLoadingReplace(false);
    }
  };

  const handleReplaceStock = (newStock: SimilarStock) => {
    if (onReplaceHolding && replacingSymbol) {
      onReplaceHolding(replacingSymbol, newStock);
      setReplacingSymbol(null);
      toast({
        title: 'Replaced!',
        description: `Replaced ${replacingSymbol} with ${newStock.symbol}`,
      });
    }
  };

  const handleQuickReplace = (currentSymbol: string, newStock: SimilarStock) => {
    if (onReplaceHolding) {
      onReplaceHolding(currentSymbol, newStock);
      // Fetch new alternatives for the replaced stock
      fetchAlternatives({
        symbol: newStock.symbol,
        name: newStock.name,
        sector: newStock.sector,
        weight: 0,
        riskLevel: newStock.risk_level,
        whyFits: '',
      });
      toast({
        title: 'Replaced!',
        description: `Replaced ${currentSymbol} with ${newStock.symbol}`,
      });
    }
  };

  const getRiskBadgeColor = (level: number) => {
    if (level <= 2) return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
    if (level <= 3) return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400';
    return 'bg-red-500/20 text-red-600 dark:text-red-400';
  };

  const filteredSimilarStocks = similarStocks.filter(stock => {
    if (styleFilter && stock.style !== styleFilter) return false;
    if (dividendFilter && (!stock.dividend_yield_value || stock.dividend_yield_value < 0.005)) return false;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-up">
      {/* Simulation Label */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium w-fit">
        <AlertTriangle className="h-3.5 w-3.5" />
        Simulation Only – Not Investment Advice
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Simulated Portfolio
          </h1>
          <p className="text-muted-foreground mt-1">
            {portfolio.holdings.length} holdings • AI Volatility Score: {portfolio.totalRiskScore}/5 • Scenario: {riskProfile.riskLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onSave} disabled={isSaving} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Portfolio'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyTickers} className="gap-2">
            <Copy className="h-4 w-4" />
            Copy Tickers
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={onRegenerate} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            New Simulation
          </Button>
        </div>
      </div>

      {/* Deep Research All Button - PROMINENT */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-r from-primary/15 via-secondary/10 to-primary/15 p-6 shadow-xl shadow-primary/20">
        {/* Animated background effects */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-secondary/20 animate-pulse" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

        <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {/* Glowing icon */}
            <div className="relative">
              <div className="absolute inset-0 w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl blur-lg opacity-60 animate-pulse" />
              <Link to="/">
                <div className="relative overflow-hidden h-12">
                  <img
                    src={resolvedTheme !== 'light' ? '/logo-white.png' : '/logo-black.png'}
                    alt="ClaritX"
                    className="h-24 w-auto -mt-6"
                  />
                </div>
              </Link>
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                Deep Research All Holdings
              </h3>
              <p className="text-muted-foreground mt-1">
                Get comprehensive AI analysis for all <span className="font-semibold text-primary">{portfolio.holdings.length} holdings</span> in one click
              </p>
            </div>
          </div>
          <Button
            onClick={handleDeepResearchAll}
            size="lg"
            className="relative group gap-3 px-8 py-6 text-lg font-bold bg-gradient-to-r from-primary via-primary to-secondary hover:opacity-90 shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all duration-300 hover:scale-105"
          >
            <div className="absolute inset-0 bg-white/20 rounded-md opacity-0 group-hover:opacity-100 transition-opacity" />
            <Search className="h-5 w-5" />
            Analyze Portfolio Now
            <Sparkles className="h-5 w-5 animate-pulse" />
          </Button>
        </div>
      </div>

      {/* Warnings */}
      {portfolio.warnings.length > 0 && (
        <div className="space-y-2">
          {portfolio.warnings.map((warning, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
            >
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-600 dark:text-amber-400">{warning}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Holdings List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Holdings
          </h2>

          <div className="space-y-3">
            {portfolio.holdings.map((holding) => {
              const alternatives = alternativesCache[holding.symbol] || [];
              const isLoadingAlts = loadingAlternatives.has(holding.symbol);
              const info = infoCache[holding.symbol];
              const price = priceCache[holding.symbol];
              const isExpanded = expandedDescriptions.has(holding.symbol);
              const isLoadingThisInfo = loadingInfo.has(holding.symbol);

              // Auto-fetch info when holding is rendered
              if (!info && !isLoadingThisInfo) {
                fetchStockInfo(holding.symbol);
              }

              return (
                <div
                  key={holding.symbol}
                  className="glass-card p-4 group hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-bold text-lg text-foreground">{holding.symbol}</span>
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
                        <Badge className={cn('text-xs', getRiskBadgeColor(holding.riskLevel))}>
                          Risk {holding.riskLevel}
                        </Badge>
                        {holding.aiScore !== undefined && (
                          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                            AI Rating: {Math.round(holding.aiScore)}/100
                          </Badge>
                        )}
                        {getQualityBadges(holding)}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{holding.name}</p>

                      {/* Stock Info Section */}
                      {info && (
                        <div className="mt-2 space-y-2">
                          {/* Industry badge */}
                          {info.industry && (
                            <Badge variant="outline" className="text-xs">{info.industry}</Badge>
                          )}

                          {/* Description */}
                          {info.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {isExpanded
                                ? info.description
                                : info.description.length > 120
                                  ? info.description.slice(0, 120) + '...'
                                  : info.description
                              }
                            </p>
                          )}

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 rounded-lg bg-muted/50 text-xs">
                              {info.ceo && (
                                <div>
                                  <span className="text-muted-foreground">CEO</span>
                                  <p className="font-medium text-foreground">{info.ceo}</p>
                                </div>
                              )}
                              {info.employees && info.employees > 0 && (
                                <div>
                                  <span className="text-muted-foreground">Employees</span>
                                  <p className="font-medium text-foreground">{info.employees.toLocaleString()}</p>
                                </div>
                              )}
                              {info.website && (
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Website</span>
                                  <a
                                    href={info.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block font-medium text-primary hover:underline truncate"
                                  >
                                    {info.website.replace(/^https?:\/\/(www\.)?/, '')}
                                  </a>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Read more / Show less toggle */}
                          {(info.description?.length > 120 || info.ceo || info.employees || info.website) && (
                            <button
                              onClick={() => {
                                setExpandedDescriptions(prev => {
                                  const next = new Set(prev);
                                  if (next.has(holding.symbol)) {
                                    next.delete(holding.symbol);
                                  } else {
                                    next.add(holding.symbol);
                                  }
                                  return next;
                                });
                              }}
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              {isExpanded ? (
                                <>Show less <ChevronUp className="h-3 w-3" /></>
                              ) : (
                                <>More details <ChevronDown className="h-3 w-3" /></>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                      {isLoadingThisInfo && !info && (
                        <Skeleton className="h-4 w-48 mt-2" />
                      )}

                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">{holding.sector}</Badge>
                        {holding.whyFits && !holding.whyFits.startsWith('{') && (
                          <span className="text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3 inline mr-1 text-emerald-500" />
                            {holding.whyFits}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <p className="text-2xl font-bold text-foreground">{holding.weight}%</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveHolding(holding.symbol)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Similar Instruments Section */}
                  {onReplaceHolding && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Explore Similar (sector/score similarity):</span>
                      </div>
                      {isLoadingAlts ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-3 w-3 border-b border-primary" />
                          <span className="text-xs text-muted-foreground">Loading...</span>
                        </div>
                      ) : alternatives.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {alternatives.map((alt) => (
                            <button
                              key={alt.symbol}
                              onClick={() => handleQuickReplace(holding.symbol, alt)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-muted/30 hover:bg-accent hover:border-primary/50 transition-all text-xs group/alt"
                              title={`Replace with ${alt.symbol} - ${alt.name}`}
                            >
                              <span className="font-medium text-foreground group-hover/alt:text-primary">
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
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No alternatives found</span>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                    <Button
                      variant="glow"
                      size="sm"
                      onClick={() => handleViewAnalysis(holding.symbol)}
                      className="gap-1.5 text-xs font-semibold"
                    >
                      <Search className="h-3.5 w-3.5" />
                      Deep Research
                      <Sparkles className="h-3 w-3 animate-pulse" />
                    </Button>
                    {onReplaceHolding && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenReplace(holding)}
                        className="gap-1 text-xs"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Compare Alternatives
                      </Button>
                    )}
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
          </div>

          {/* Simulation Summary */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="font-semibold text-foreground">Simulation Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Risk Scenario</span>
                <span className="font-medium">{riskProfile.riskLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">AI Volatility Score</span>
                <span className="font-medium">{portfolio.totalRiskScore}/5</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Holdings</span>
                <span className="font-medium">{portfolio.holdings.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sectors</span>
                <span className="font-medium">{Object.keys(portfolio.sectorAllocation).length}</span>
              </div>
            </div>
          </div>

          <Button onClick={onEdit} variant="outline" className="w-full">
            Edit Inputs & New Simulation
          </Button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            ⚠️ Simulation Only – Not Investment Advice
          </p>
          <p className="text-xs text-muted-foreground">
            This simulation reflects inputs selected by the user and does not constitute personalized investment advice.
            Holdings are included based on pattern matching to your selected profile and sector preferences.
            Past performance does not guarantee future results. Always conduct your own research.
          </p>
        </div>
      </div>

      {/* Compare Alternatives Dialog */}
      <Dialog open={!!replacingSymbol} onOpenChange={() => {
        setReplacingSymbol(null);
        setStyleFilter(null);
        setDividendFilter(false);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Compare Similar Instruments to {replacingSymbol}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Explore instruments with similar sector or AI-score for comparison purposes.
            </p>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Filter Controls */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Filter by:</p>
              <div className="flex flex-wrap gap-2">
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

                <div className="w-px h-6 bg-border mx-1" />

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
                              AI Rating: {Math.round(stock.quality_score)}
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
                          {stock.dividend_yield_value && stock.dividend_yield_value >= 0.005 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              {(stock.dividend_yield_value * 100).toFixed(1)}% Div
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
    </div>
  );
}

// Helper function for quality badges
function getQualityBadges(holding: Portfolio['holdings'][0]): JSX.Element[] {
  const badges: JSX.Element[] = [];
  const whyFits = holding.whyFits?.toLowerCase() || '';

  if (whyFits.includes('quality') && /quality\s*[89]\d|quality\s*100/.test(whyFits)) {
    badges.push(
      <Badge key="quality" variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 gap-1">
        <Sparkles className="h-3 w-3" />
        High Quality
      </Badge>
    );
  }

  if (/roe[:\s]*[2-9]\d/.test(whyFits) || whyFits.includes('strong roe')) {
    badges.push(
      <Badge key="roe" variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1">
        <TrendingUp className="h-3 w-3" />
        Strong ROE
      </Badge>
    );
  }

  if (whyFits.includes('low debt') || /d\/e[:\s]*0\.[0-4]/.test(whyFits)) {
    badges.push(
      <Badge key="debt" variant="outline" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 gap-1">
        <Shield className="h-3 w-3" />
        Low Debt
      </Badge>
    );
  }

  if (whyFits.includes('growth') || whyFits.includes('momentum')) {
    badges.push(
      <Badge key="growth" variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 gap-1">
        <Zap className="h-3 w-3" />
        Growth
      </Badge>
    );
  }

  return badges;
}
