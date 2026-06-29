import { Activity, BarChart3, Gauge, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Indicator {
  name: string;
  value: string;
  signal: "buy" | "sell" | "hold";
  strength: number;
}

interface TechnicalIndicatorsProps {
  indicators: Indicator[];
}

export function TechnicalIndicators({ indicators }: TechnicalIndicatorsProps) {
  const getSignalConfig = (signal: string) => {
    switch (signal) {
      case "buy":
        return { color: "text-success", bg: "bg-success/10", icon: ArrowUpRight };
      case "sell":
        return { color: "text-destructive", bg: "bg-destructive/10", icon: ArrowDownRight };
      default:
        return { color: "text-warning", bg: "bg-warning/10", icon: Activity };
    }
  };

  const overallScore = Math.min(100, Math.max(0, Math.round(
    indicators.reduce((acc, ind) => {
      let score = 50;
      if (ind.signal === "buy") score = 50 + (ind.strength || 20); // Default strength boost
      else if (ind.signal === "sell") score = 50 - (ind.strength || 20);
      return acc + score;
    }, 0) / (indicators.length || 1)
  )));

  return (
    <div className="glass-card p-6 animate-fade-up animation-delay-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
          <BarChart3 className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h3 className="font-display font-semibold">Technical Analysis</h3>
          <p className="text-xs text-muted-foreground">Based on key indicators</p>
        </div>
      </div>

      <div className="mb-6 p-4 rounded-lg bg-secondary/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Overall Score</span>
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <span className={`font-display font-bold text-lg ${overallScore >= 60 ? "text-success" : overallScore <= 40 ? "text-destructive" : "text-warning"
              }`}>
              {overallScore}/100
            </span>
          </div>
        </div>
        <Progress
          value={overallScore}
          className="h-3"
        />
        <p className="text-xs text-muted-foreground mt-2">
          {overallScore >= 60 ? "Strong Buy Signal" : overallScore <= 40 ? "Strong Sell Signal" : "Hold/Neutral"}
        </p>
      </div>

      <div className="space-y-4">
        {indicators.map((indicator, index) => {
          const config = getSignalConfig(indicator.signal);
          const Icon = config.icon;

          return (
            <div key={index} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-md ${config.bg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium">{indicator.name}</p>
                  <p className="text-xs text-muted-foreground">{indicator.value}</p>
                </div>
              </div>
              <span className={`text-xs font-semibold uppercase ${config.color}`}>
                {indicator.signal}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
