import { Target, ArrowRight, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface RecommendationCardProps {
  action: "buy" | "sell" | "hold";
  targetPrice: number;
  currentPrice: number;
  riskLevel: "low" | "medium" | "high";
  timeHorizon: string;
  reasoning: string[];
}

export function RecommendationCard({
  action,
  targetPrice,
  currentPrice,
  riskLevel,
  timeHorizon,
  reasoning,
}: RecommendationCardProps) {
  const actionConfig = {
    buy: {
      color: "text-success",
      bg: "bg-success",
      gradient: "from-success/20 to-success/5",
      label: "Bullish Signals",
    },
    sell: {
      color: "text-destructive",
      bg: "bg-destructive",
      gradient: "from-destructive/20 to-destructive/5",
      label: "Bearish Signals",
    },
    hold: {
      color: "text-warning",
      bg: "bg-warning",
      gradient: "from-warning/20 to-warning/5",
      label: "Neutral",
    },
  };

  const riskConfig = {
    low: { color: "text-success", label: "Low Risk" },
    medium: { color: "text-warning", label: "Medium Risk" },
    high: { color: "text-destructive", label: "High Risk" },
  };

  const config = actionConfig[action];
  const risk = riskConfig[riskLevel];
  const potentialReturn = ((targetPrice - currentPrice) / currentPrice) * 100;

  return (
    <div className="glass-card overflow-hidden animate-fade-up animation-delay-300">
      <div className={`bg-gradient-to-r ${config.gradient} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${config.bg} flex items-center justify-center`}>
              <Target className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-display font-bold text-xl">Analysis Summary</h3>
              <p className="text-sm text-muted-foreground">Combined signals overview</p>
            </div>
          </div>
          <Badge className={`${config.bg} text-primary-foreground text-lg px-4 py-2`}>
            {config.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-card/50">
            <p className="text-xs text-muted-foreground mb-1">Analyst Target</p>
            <p className="text-xl font-display font-bold">${targetPrice.toFixed(2)}</p>
          </div>
          <div className="p-4 rounded-lg bg-card/50">
            <p className="text-xs text-muted-foreground mb-1">Potential Upside*</p>
            <p className={`text-xl font-display font-bold ${potentialReturn >= 0 ? "text-success" : "text-destructive"}`}>
              {potentialReturn >= 0 ? "+" : ""}{potentialReturn.toFixed(1)}%
            </p>
          </div>
          <div className="p-4 rounded-lg bg-card/50">
            <p className="text-xs text-muted-foreground mb-1">Risk Level</p>
            <p className={`text-xl font-display font-bold ${risk.color}`}>{risk.label}</p>
          </div>
          <div className="p-4 rounded-lg bg-card/50">
            <p className="text-xs text-muted-foreground mb-1">Time Horizon</p>
            <p className="text-xl font-display font-bold">{timeHorizon}</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Key Reasons
        </h4>
        <ul className="space-y-2">
          {reasoning.map((reason, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
              <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              {reason}
            </li>
          ))}
        </ul>

        <div className="flex items-start gap-2 mt-6 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Not Investment Advice:</strong> This automated analysis is for educational and informational purposes only. 
              It does not consider your personal circumstances and is not a recommendation to buy or sell. 
              Past performance does not guarantee future results. *Analyst targets are not guaranteed. 
              Always conduct your own research and consider consulting a licensed financial advisor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
