import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, TrendingUp, Zap, ArrowRight, Star } from "lucide-react";

interface Opportunity {
  symbol: string;
  name: string;
  reason: string;
  newsHeadline: string;
  source?: string;
  opportunityScore: number;
  sector: string;
  timeframe: string;
}

const API_URL = import.meta.env.VITE_AWS_API_URL || "http://localhost:8000";

const SECTOR_COLORS: Record<string, string> = {
  Technology: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Healthcare: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Finance: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Energy: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Consumer: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  default: "bg-primary/20 text-primary border-primary/30",
};

function scoreColor(score: number) {
  if (score >= 8) return "text-emerald-400";
  if (score >= 6) return "text-amber-400";
  return "text-muted-foreground";
}

function OpportunityCard({ opp, index, locked }: { opp: Opportunity; index: number; locked: boolean }) {
  const navigate = useNavigate();
  const sectorClass = SECTOR_COLORS[opp.sector] || SECTOR_COLORS.default;

  return (
    <div className="relative">
      <Card
        className={`border-border/50 transition-all duration-300 ${
          locked ? "select-none" : "hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 cursor-pointer"
        }`}
        onClick={() => !locked && navigate("/market-opportunities")}
      >
        <CardContent className="p-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div>
                <span className="font-bold text-sm">{opp.symbol}</span>
                <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{opp.name}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className={`flex items-center gap-1 text-xs font-bold ${scoreColor(opp.opportunityScore)}`}>
                <Star className="h-3 w-3 fill-current" />
                {opp.opportunityScore}/10
              </div>
              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${sectorClass}`}>
                {opp.sector}
              </Badge>
            </div>
          </div>

          {/* Headline */}
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-2">
            {opp.newsHeadline}
          </p>

          {/* Reason */}
          <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2 mb-3">
            {opp.reason}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground capitalize border border-border/50 rounded-full px-2 py-0.5">
              {opp.timeframe}
            </span>
            {opp.source && (
              <span className="text-[10px] text-muted-foreground">via {opp.source}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Blur + lock overlay */}
      {locked && (
        <div className="absolute inset-0 rounded-xl backdrop-blur-sm bg-background/60 flex flex-col items-center justify-center gap-2 border border-border/30">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Hidden</span>
        </div>
      )}
    </div>
  );
}

export function DailyOpportunitiesTeaser() {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/market-opportunities`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.opportunities?.length) {
          setOpportunities(data.opportunities.slice(0, 6));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Show placeholder cards when loading or no data
  const placeholderOpps: Opportunity[] = Array.from({ length: 6 }, (_, i) => ({
    symbol: ["NVDA", "AAPL", "MSFT", "AMZN", "META", "GOOGL"][i],
    name: ["NVIDIA Corp", "Apple Inc", "Microsoft Corp", "Amazon", "Meta Platforms", "Alphabet"][i],
    reason: "AI-driven demand surge is accelerating revenue growth across cloud and semiconductor segments.",
    newsHeadline: "Earnings beat expectations as enterprise AI spending continues to expand.",
    source: "Reuters",
    opportunityScore: [9, 8, 8, 7, 7, 7][i],
    sector: ["Technology", "Technology", "Technology", "Consumer", "Technology", "Technology"][i],
    timeframe: "short-term",
  }));

  const displayOpps = opportunities.length >= 3 ? opportunities : placeholderOpps;
  const visibleCount = 2;

  return (
    <section className="py-16 px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-amber-500/5 to-background pointer-events-none" />

      <div className="container mx-auto max-w-5xl relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-500 px-5 py-2.5 rounded-full text-sm font-semibold mb-5 border border-amber-500/30">
            <Zap className="h-4 w-4 animate-pulse" />
            Daily AI Opportunities
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Today's Market Catalysts
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm">
            Our AI scans hundreds of news sources every day to surface stocks with real catalysts driving meaningful moves.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`h-48 rounded-xl bg-muted/40 animate-pulse ${i >= visibleCount ? "opacity-30" : ""}`} />
              ))
            : displayOpps.map((opp, i) => (
                <OpportunityCard
                  key={opp.symbol + i}
                  opp={opp}
                  index={i}
                  locked={i >= visibleCount}
                />
              ))}
        </div>

        {/* Unlock CTA */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span>{displayOpps.length - visibleCount} more opportunities are hidden</span>
          </div>
          <Button
            size="lg"
            onClick={() => navigate("/market-opportunities")}
            className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold shadow-lg shadow-amber-500/25"
          >
            <Zap className="h-4 w-4" />
            Unlock Daily Opportunities
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground">Free to access · Updated twice daily</p>
        </div>
      </div>
    </section>
  );
}
