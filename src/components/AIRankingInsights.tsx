import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, Sparkles, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/apiAdapter";

interface RankedStock {
  symbol: string;
  name: string;
  sector: string;
  score: number | string;
  verdict: string;
  updated_at: string;
}

import { useUserCredits } from "@/hooks/useUserCredits";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";

export function AIRankingInsights() {
  const { credits } = useUserCredits();
  const navigate = useNavigate();
  const isPro = credits?.subscription_tier === 'pro';
  const [topStocks, setTopStocks] = useState<RankedStock[]>([]);
  const [bottomStocks, setBottomStocks] = useState<RankedStock[]>([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const fetchRankings = async () => {
      try {
        const topData = await api.get('/rankings/top-performing?limit=5');
        setTopStocks(topData);

        const bottomData = await api.get('/rankings/lowest-performing?limit=5');
        setBottomStocks(bottomData);

      } catch (err) {
        console.error('Error fetching rankings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRankings();
  }, []);


  if (loading) {
    return <div className="h-48 flex items-center justify-center text-muted-foreground">Loading AI Rankings...</div>;
  }

  if (topStocks.length === 0 && bottomStocks.length === 0) {
    return (
      <Card className="glass-card border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-10 space-y-4">
          <Sparkles className="h-10 w-10 text-muted-foreground/50" />
          <div className="text-center">
            <h3 className="text-lg font-medium">No Rankings Available Yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
              The AI needs to analyze the market to generate these rankings.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const StockList = ({ stocks, type }: { stocks: RankedStock[], type: 'top' | 'bottom' }) => (
    <div className="space-y-3">
      {stocks.map((stock) => (
        <div key={stock.symbol} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50 hover:bg-background/80 transition-colors cursor-pointer group">
          <div className="flex items-center gap-3">
            <Badge variant={type === 'top' ? 'default' : 'destructive'} className="w-8 h-8 rounded-full flex items-center justify-center p-0 text-xs font-bold">
              {typeof stock.score === 'number' ? Math.round(stock.score) : stock.score}
            </Badge>
            <div>
              <div className="font-semibold flex items-center gap-2">
                {stock.symbol}
                <span className="text-xs font-normal text-muted-foreground hidden sm:inline-block">- {stock.name}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={stock.verdict}>
                {stock.verdict?.substring(0, 60)}...
              </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="relative">
      <div className={cn("grid md:grid-cols-2 gap-6 animate-fade-up", !isPro && "filter blur-sm pointer-events-none select-none")}>
        {/* Top Performers */}
        <Card className="glass-card border-emerald-500/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Top AI Picks</CardTitle>
                <p className="text-xs text-muted-foreground">Highest rated by AI</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <StockList stocks={topStocks} type="top" />
          </CardContent>
        </Card>

        {/* Lowest Performers */}
        <Card className="glass-card border-red-500/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-red-500/10">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Lowest Rated</CardTitle>
                <p className="text-xs text-muted-foreground">Avoid or Short Candidates</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <StockList stocks={bottomStocks} type="bottom" />
          </CardContent>
        </Card>
      </div>

      {!isPro && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/20 backdrop-blur-[2px] rounded-xl z-10 p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4 border border-primary/30">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2">Pro Feature: Market Ranks</h3>
          <p className="text-muted-foreground max-w-sm mb-6 text-sm">
            Unlock the full AI-powered market rankings to see the top performers and high-risk assets identified by our analysis engine.
          </p>
          <Button 
            onClick={() => navigate('/pricing')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-2 rounded-full shadow-lg shadow-primary/20"
          >
            Upgrade to Pro
          </Button>
        </div>
      )}
    </div>
  );
}

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
