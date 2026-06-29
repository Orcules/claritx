import { Brain, Sparkles, TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface AIAnalysisCardProps {
  model: string;
  sentiment: "bullish" | "bearish" | "neutral";
  confidence: number;
  summary: string;
  signals: string[];
  delay?: number;
}

export function AIAnalysisCard({
  model,
  sentiment,
  confidence,
  summary,
  signals,
  delay = 0,
}: AIAnalysisCardProps) {
  const getSentimentConfig = () => {
    switch (sentiment) {
      case "bullish":
        return {
          icon: TrendingUp,
          color: "text-success",
          bgColor: "bg-success/10",
          borderColor: "border-success/30",
          label: "Bullish",
        };
      case "bearish":
        return {
          icon: TrendingDown,
          color: "text-destructive",
          bgColor: "bg-destructive/10",
          borderColor: "border-destructive/30",
          label: "Bearish",
        };
      default:
        return {
          icon: Minus,
          color: "text-warning",
          bgColor: "bg-warning/10",
          borderColor: "border-warning/30",
          label: "Neutral",
        };
    }
  };

  const config = getSentimentConfig();
  const Icon = config.icon;

  return (
    <div 
      className={`glass-card p-6 hover:border-primary/30 transition-all duration-300 animate-fade-up`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="font-display font-semibold">{model}</h4>
            <p className="text-xs text-muted-foreground">Automated Analysis</p>
          </div>
        </div>
        <Badge className={`${config.bgColor} ${config.color} ${config.borderColor} border`}>
          <Icon className="h-3 w-3 mr-1" />
          {config.label}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        {summary}
      </p>

      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Signal Strength</span>
          <span className="font-medium">{confidence}%</span>
        </div>
        <Progress value={confidence} className="h-2" />
        <p className="text-xs text-muted-foreground italic">Model confidence may vary; not a guarantee of accuracy</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Key Signals
        </p>
        <div className="flex flex-wrap gap-2">
          {signals.map((signal, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {signal}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
