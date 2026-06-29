import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Clock, Building2, Plus, Check, X, ChevronDown, ChevronUp, Globe, Users, User, RefreshCw, Sparkles, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api_adapter";
import { getCurrentUser } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useEtoroCompliance } from "@/hooks/useEtoroCompliance";
import { rdtTrack } from "@/lib/reddit-pixel";

// Check if US market is currently open
function isMarketOpen(): boolean {
  const now = new Date();
  const nyTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = nyTime.getDay();
  const hours = nyTime.getHours();
  const minutes = nyTime.getMinutes();
  const currentTime = hours * 60 + minutes;

  // Market closed on weekends
  if (day === 0 || day === 6) return false;

  // Market hours: 9:30 AM - 4:00 PM ET
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM

  return currentTime >= marketOpen && currentTime < marketClose;
}

interface CompanyDetails {
  ceo?: string;
  employees?: number;
  website?: string;
}

// Component for collapsible company description with full details
function CompanyDescriptionCard({
  description,
  details
}: {
  description: string;
  details?: CompanyDetails;
}) {
  const [expanded, setExpanded] = useState(false);

  const words = description.split(' ');
  const briefDesc = words.length <= 25 ? description : words.slice(0, 25).join(' ') + '...';
  const hasMore = words.length > 25 || details?.ceo || details?.employees || details?.website;

  return (
    <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border/50">
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            {expanded ? description : briefDesc}
          </p>
        </div>

        {expanded && details && (
          <div className="ml-6 space-y-1.5 pt-1 border-t border-border/30 mt-1">
            {details.ceo && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span><strong>CEO:</strong> {details.ceo}</span>
              </div>
            )}
            {details.employees && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span><strong>Employees:</strong> {details.employees.toLocaleString()}</span>
              </div>
            )}
            {details.website && (
              <a
                href={details.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-primary hover:underline"
              >
                <Globe className="h-3 w-3" />
                Visit Website →
              </a>
            )}
          </div>
        )}

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-primary hover:text-primary/80 self-start ml-6 gap-1"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                Read more
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

interface StockHeaderProps {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap?: string;
  volume?: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  description?: string;
  ceo?: string;
  employees?: number;
  website?: string;
  isETF?: boolean;
  // ETF-specific props
  expenseRatio?: number;
  holdingsCount?: number;
  etfCompany?: string;
  completedAt?: string;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function StockHeader({
  symbol,
  name,
  price,
  change,
  changePercent,
  marketCap,
  volume,
  exchange,
  sector,
  industry,
  description,
  ceo,
  employees,
  website,
  isETF = false,
  expenseRatio,
  holdingsCount,
  etfCompany,
  completedAt,
  onRefresh,
  isLoading: isGlobalLoading,
}: StockHeaderProps) {
  const marketOpen = isMarketOpen();
  const isPositive = change >= 0;
  const navigate = useNavigate();
  const { isRestricted, tier, isLoading: complianceLoading } = useEtoroCompliance();
  const showEtoro = !complianceLoading && !isRestricted;
  const etoroLink = 'https://med.etoro.com/B22260_A128601_TClick_Sstocks_discovery.aspx';
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isInPortfolio, setIsInPortfolio] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      checkIfInPortfolio(u.userId);
    }).catch(() => setUser(null));

    const cancel = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn') {
        getCurrentUser().then((u) => { setUser(u); checkIfInPortfolio(u.userId); }).catch(() => {});
      } else if (payload.event === 'signedOut') {
        setUser(null);
      }
    });
    return () => cancel();
  }, [symbol]);

  const checkIfInPortfolio = async (userId: string) => {
    try {
      const data = await api.get<any>('/user-portfolios');
      if (data?.holdings) {
        const holdings = data.holdings as any[];
        setIsInPortfolio(holdings.some((h: any) => h.symbol === symbol));
      }
    } catch (e) {
      console.error("Not in portfolio or portfolio error:", e);
    }
  };

  const handleAddToPortfolio = async () => {
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    setIsAdding(true);

    try {
      // Get existing portfolio or create new one
      let existingPortfolio = null;
      try {
        existingPortfolio = await api.get<any>('/user-portfolios');
      } catch (e) {
        // Doesn't exist
      }

      // Remove static ticker info lookup since dummy data is gone
      const riskLevel = 3; // Default to moderate risk for manually added single stocks

      const newHolding = {
        symbol,
        name,
        weight: 5, // Default weight
        sector: sector || 'Unknown',
        riskLevel,
        whyFits: 'Added from stock analysis',
        addedAt: new Date().toISOString(),
        addedPrice: price
      };

      if (existingPortfolio) {
        // Add to existing portfolio
        const currentHoldings = (existingPortfolio.holdings as any[]) || [];

        if (currentHoldings.some((h: any) => h.symbol === symbol)) {
          toast({
            title: "Already in Portfolio",
            description: `${symbol} is already in your portfolio.`,
          });
          setIsAdding(false);
          return;
        }

        const updatedHoldings = [...currentHoldings, newHolding];

        // Recalculate sector allocation
        const newSectorAllocation: Record<string, number> = {};
        updatedHoldings.forEach((h: any) => {
          newSectorAllocation[h.sector] = (newSectorAllocation[h.sector] || 0) + h.weight;
        });

        await api.post('/user-portfolios', {
          ...existingPortfolio,
          holdings: updatedHoldings,
          sector_allocation: newSectorAllocation
        });
      } else {
        // Create new portfolio
        await api.post('/user-portfolios', {
          name: 'My Portfolio',
          holdings: [newHolding],
          risk_bucket: 3,
          risk_label: 'Moderate',
          sector_allocation: { [newHolding.sector]: newHolding.weight },
          style_tags: [],
          constraints: [],
          total_risk_score: null
        });
      }

      setIsInPortfolio(true);
      toast({
        title: "Added to Portfolio",
        description: `${symbol} has been added to your portfolio.`,
      });
    } catch (error) {
      console.error('Error adding to portfolio:', error);
      toast({
        title: "Error",
        description: "Failed to add stock to portfolio. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveFromPortfolio = async () => {
    if (!user) return;

    setIsRemoving(true);

    try {
      let existingPortfolio = null;
      try {
        existingPortfolio = await api.get<any>('/user-portfolios');
      } catch (e) {
        setIsRemoving(false);
        return;
      }

      const currentHoldings = (existingPortfolio.holdings as any[]) || [];
      const updatedHoldings = currentHoldings.filter((h: any) => h.symbol !== symbol);

      // Recalculate sector allocation
      const newSectorAllocation: Record<string, number> = {};
      updatedHoldings.forEach((h: any) => {
        newSectorAllocation[h.sector] = (newSectorAllocation[h.sector] || 0) + h.weight;
      });

      await api.post('/user-portfolios', {
        ...existingPortfolio,
        holdings: updatedHoldings,
        sector_allocation: newSectorAllocation
      });

      setIsInPortfolio(false);
      toast({
        title: "Removed from Portfolio",
        description: `${symbol} has been removed from your portfolio.`,
      });
    } catch (error) {
      console.error('Error removing from portfolio:', error);
      toast({
        title: "Error",
        description: "Failed to remove stock from portfolio. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="glass-card p-6 animate-fade-up">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <span className="text-2xl font-display font-bold text-primary">
              {symbol.charAt(0)}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-display font-bold">{symbol}</h2>
              <Badge variant="secondary" className="text-xs">
                {exchange || 'NYSE'}
              </Badge>
              {isETF && (
                <Badge className="text-xs bg-violet-500/20 text-violet-400 border-violet-500/30">
                  ETF
                </Badge>
              )}
              {sector && (
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                  {sector}
                </Badge>
              )}
              {isInPortfolio ? (
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="gap-1 h-7 px-2.5">
                    <Check className="h-3.5 w-3.5" />
                    In Portfolio
                  </Badge>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleRemoveFromPortfolio}
                    disabled={isRemoving}
                    className="gap-1 h-7 px-2"
                  >
                    <X className="h-3.5 w-3.5" />
                    {isRemoving ? "..." : "Remove"}
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleAddToPortfolio}
                  disabled={isAdding}
                  className="gap-1.5 h-7"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {isAdding ? "Adding..." : "Add to Portfolio"}
                </Button>
              )}
            </div>
            <p className="text-muted-foreground">{name}</p>
            {industry && (
              <p className="text-xs text-muted-foreground/70 mt-0.5">{industry}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* eToro trade button — next to price */}
          {showEtoro && (
            <a
              href={etoroLink}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={() => rdtTrack('Custom', { customEventName: 'EtoroClick', content_name: 'etoro_affiliate_click' })}
              className="hidden sm:flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl bg-[hsl(145_70%_18%)] border border-[hsl(145_60%_35%/0.5)] hover:border-[hsl(145_60%_50%/0.8)] hover:bg-[hsl(145_70%_22%)] transition-all group"
            >
              <span className="text-xs font-bold text-[hsl(145_80%_65%)] group-hover:text-[hsl(145_80%_72%)] flex items-center gap-1.5">
                Trade {symbol}
                <ExternalLink className="h-3 w-3" />
              </span>
              <span className="text-[10px] text-[hsl(145_50%_45%)]">via eToro</span>
            </a>
          )}

          <div className="text-right">
            <p className="text-3xl font-display font-bold">
              ${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className={`flex items-center gap-2 justify-end ${isPositive ? "text-success" : "text-destructive"}`}>
              {isPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span className="font-medium">
                {isPositive ? "+" : ""}
                {typeof change === 'number' ? change.toFixed(2) : 'N/A'} ({typeof changePercent === 'number' ? changePercent.toFixed(2) : 'N/A'}%)
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm">
            {marketCap && (
              <div>
                <p className="text-muted-foreground">{isETF ? 'AUM' : 'Market Cap'}</p>
                <p className="font-semibold">{marketCap}</p>
              </div>
            )}
            {isETF && expenseRatio !== undefined && (
              <div>
                <p className="text-muted-foreground">Expense Ratio</p>
                <p className="font-semibold">{(expenseRatio * 100).toFixed(2)}%</p>
              </div>
            )}
            {isETF && holdingsCount !== undefined && (
              <div>
                <p className="text-muted-foreground">Holdings</p>
                <p className="font-semibold">{holdingsCount.toLocaleString()}</p>
              </div>
            )}
            {volume && (
              <div>
                <p className="text-muted-foreground">Volume</p>
                <p className="font-semibold">{volume}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Company Description */}
      {description && (
        <CompanyDescriptionCard
          description={description}
          details={{ ceo, employees, website }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-border/30">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
            <span className={`ml-1 ${marketOpen ? 'pulse-dot' : ''}`}></span>
            <span className={marketOpen ? 'text-success' : 'text-muted-foreground'}>
              {marketOpen ? 'Market Open' : 'Market Closed'}
            </span>
          </div>

          {completedAt && (
            <div className="flex items-center gap-2 pl-4 border-l border-border/30">
              <Sparkles className="h-3 w-3 text-primary/70" />
              <span>AI Research: {new Date(completedAt).toLocaleString()}</span>
            </div>
          )}
        </div>

        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isGlobalLoading}
            className="h-8 text-xs gap-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <RefreshCw className={`h-3 w-3 ${isGlobalLoading ? 'animate-spin' : ''}`} />
            Rerun Analysis
          </Button>
        )}
      </div>
    </div>
  );
}
