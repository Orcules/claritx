import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiAdapter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Clock, Newspaper, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

interface Opportunity {
  symbol: string;
  name: string;
  reason: string;
  newsHeadline: string;
  source: string;
  opportunityScore: number;
  sector: string;
  timeframe: string;
}

interface OpportunitiesResponse {
  opportunities: Opportunity[];
  scanned_at?: string;
  scannedAt?: string;
  status?: string;
}

async function fetchMarketOpportunities(refresh = false): Promise<OpportunitiesResponse> {
  // api.get() returns the raw JSON response directly (not wrapped in {data, error})
  const result = await api.get<OpportunitiesResponse>(`/market-opportunities${refresh ? '?refresh=true' : ''}`);
  if (!result) return { opportunities: [], status: "scanning" };
  return result;
}

export function MarketOpportunities() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<OpportunitiesResponse>({
    queryKey: ["market-opportunities"],
    queryFn: () => fetchMarketOpportunities(),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: 1,
    // Only poll while we have zero opportunities (true first-load scanning state).
    // Once we have any data (fresh or stale), stop polling — the backend lock
    // prevents duplicate scans, so there's no benefit to keep hitting the endpoint.
    refetchInterval: (query) => {
      const d = query.state.data;
      const hasData = (d?.opportunities?.length ?? 0) > 0;
      if (!hasData && !query.state.error) {
        return 15000; // poll every 15s only while completely empty
      }
      return false; // stop once we have any data
    },
  });

  const isScanning = !isLoading && (!data?.opportunities?.length || data?.status === "scanning");

  const opportunities = data?.opportunities || [];
  const scannedAt = data?.scanned_at || data?.scannedAt || null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchMarketOpportunities(true); // kick off the bg scan with ?refresh=true
    await refetch();                       // then reload from cache
    setIsRefreshing(false);
  };


  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-success";
    if (score >= 6) return "text-warning";
    return "text-muted-foreground";
  };

  const getTimeframeBadge = (tf: string) => {
    if (!tf) return "outline";
    if (tf.includes("short")) return "secondary";
    if (tf.includes("medium")) return "default";
    return "outline";
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor(diff / (1000 * 60));
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return "just now";
  };

  if (error && !isLoading && opportunities.length === 0) {
    return null;
  }

  if (isScanning) {
    return (
      <section className="max-w-7xl mx-auto px-2 sm:px-0 text-center py-20" aria-labelledby="opportunities-heading">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 text-success font-medium text-sm mb-4">
          <Newspaper className="h-4 w-4" />
          AI News Scanner
        </div>
        <h2 id="opportunities-heading" className="text-3xl font-bold mb-3">
          <span className="text-foreground">Market</span>{" "}
          <span className="text-success">Opportunities</span>
        </h2>
        <div className="flex flex-col items-center gap-4 mt-8">
          <RefreshCw className="h-8 w-8 text-success animate-spin" />
          <p className="text-muted-foreground text-sm">AI is scanning today's financial news...</p>
          <p className="text-muted-foreground text-xs">This can take up to 60 seconds. Results will appear automatically.</p>
        </div>
      </section>
    );
  }

  return (
    <div className="relative">
      <div>
        <section className="max-w-7xl mx-auto px-2 sm:px-0" aria-labelledby="opportunities-heading">
          <div className="text-center mb-6 sm:mb-10">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-success/10 text-success font-medium text-xs sm:text-sm mb-3 sm:mb-4">
              <Newspaper className="h-3 w-3 sm:h-4 sm:w-4" />
              AI News Scanner
            </div>
            <h2
              id="opportunities-heading"
              className="text-2xl sm:text-3xl md:text-4xl font-display font-bold"
            >
              <span className="text-foreground">Market</span>{" "}
              <span className="text-success">Opportunities</span>
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
              AI-scanned financial news identifying tickers with potential positive catalysts.
              Updated every 12 hours. Not investment advice.
            </p>
            {scannedAt && (
              <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] sm:text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Last scan: {timeAgo(scannedAt)}
                <button
                  onClick={handleRefresh}
                  className="ml-2 hover:text-primary transition-colors disabled:opacity-50"
                  aria-label="Refresh"
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
                </button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="bg-card/50">
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {opportunities.map((opp) => (
                <Card
                  key={opp.symbol}
                  className="bg-card/50 border-border/50 hover:border-success/30 transition-all duration-300 group"
                >
                  <CardHeader className="p-3 sm:p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <Link to={`/ai-stock-analysis?symbol=${opp.symbol}`} className="hover:underline">
                          <CardTitle className="text-base sm:text-lg font-bold text-primary group-hover:text-success transition-colors">
                            {opp.symbol}
                          </CardTitle>
                        </Link>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[140px]">
                          {opp.name}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-lg font-bold ${getScoreColor(opp.opportunityScore)}`}>
                          {opp.opportunityScore}<span className="text-xs font-normal">/10</span>
                        </span>
                        <Badge variant={getTimeframeBadge(opp.timeframe) as any} className="text-[9px] px-1.5 py-0 flex-none bg-background/50">
                          {opp.timeframe || "N/A"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0 space-y-2.5">
                    <p className="text-[11px] sm:text-xs text-foreground/90 leading-relaxed line-clamp-3 h-[48px]">
                      {opp.reason}
                    </p>
                    <div className="flex items-start gap-1.5 bg-muted/30 rounded-md p-2 h-[48px]">
                      <Newspaper className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                        "{opp.newsHeadline}"
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant="outline" className="text-[9px] truncate max-w-[100px]">
                        {opp.sector || 'Unknown'}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground truncate max-w-[100px] text-right">{opp.source || 'News'}</span>
                    </div>
                    <Link
                      to={`/ai-stock-analysis?symbol=${opp.symbol}`}
                      className="pt-2 block"
                    >
                      <Button variant="default" size="sm" className="w-full text-xs gap-1 h-8">
                        <Search className="h-3 w-3" />
                        Deep Analysis
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {opportunities.length > 0 && (
            <p className="text-center text-[9px] sm:text-[10px] text-muted-foreground mt-6">
              Based on automated AI analysis of public news. Not a recommendation to buy or sell any security.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export default MarketOpportunities;
