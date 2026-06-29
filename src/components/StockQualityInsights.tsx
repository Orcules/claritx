import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, Sparkles, BarChart3 } from "lucide-react";
import { AnalysisResult } from "@/hooks/useStockAnalysis";

interface StockQualityInsightsProps {
  data: AnalysisResult;
  /** Which section(s) to render. Default "both". */
  section?: "flags" | "metrics" | "both";
}

const formatMarketCap = (v: number | null | undefined) => {
  if (!v) return "N/A";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toLocaleString()}`;
};

const fmt = (v: number | null | undefined, decimals = 2) =>
  v != null ? v.toFixed(decimals) : "N/A";

const fmtPct = (v: number | null | undefined) =>
  v != null ? `${(v * 100).toFixed(2)}%` : "N/A";

export function StockQualityInsights({ data, section = "both" }: StockQualityInsightsProps) {
  const { stock, analysis } = data;
  const fr = analysis?.financial_ratios || {};

  const flags = analysis?.quality_flags;
  const positives = flags?.positives || [];
  const concerns = flags?.concerns || [];
  const hasInsights = positives.length > 0 || concerns.length > 0;
  const showFlags = section !== "metrics";
  const showMetrics = section !== "flags";

  const metrics = [
    { label: "Market Cap", value: formatMarketCap(stock.marketCap) },
    { label: "P/E Ratio", value: fmt(fr.peRatioTTM) },
    { label: "ROE", value: fmtPct(fr.returnOnEquityTTM) },
    { label: "Beta", value: fmt(stock.beta) },
    { label: "Dividend Yield", value: fmtPct(fr.dividendYielTTM ?? fr.dividendYieldTTM) },
    { label: "Debt/Equity", value: fmt(fr.debtEquityRatioTTM) },
    { label: "Price", value: stock.price != null ? `$${stock.price.toFixed(2)}` : "N/A" },
    ...(fr.netProfitMarginTTM != null ? [{ label: "Profit Margin", value: fmtPct(fr.netProfitMarginTTM) }] : []),
    ...(fr.currentRatioTTM != null ? [{ label: "Current Ratio", value: fmt(fr.currentRatioTTM) }] : []),
  ].filter(m => m.value !== "N/A");

  const hasMetrics = metrics.length > 0;

  const renderFlags = showFlags && hasInsights;
  const renderMetrics = showMetrics && hasMetrics;
  if (!renderFlags && !renderMetrics) return null;

  return (
    <div className="space-y-4">
      {/* AI Quality Insights */}
      {renderFlags && (
        <div className="glass-card p-5 animate-fade-up">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">AI Quality Insights</h3>
              <p className="text-xs text-muted-foreground">From ClaritX AI analysis</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {positives.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-500">Positives</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {positives.map((item, i) => (
                    <Badge key={i} variant="outline"
                      className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {concerns.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ThumbsDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-500">Concerns</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {concerns.map((item, i) => (
                    <Badge key={i} variant="outline"
                      className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Key Metrics */}
      {renderMetrics && (
        <div className="glass-card p-5 animate-fade-up">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Key Metrics</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.map((m) => (
              <div key={m.label} className="text-center p-3 rounded-lg bg-background/50 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                <p className="text-base font-semibold text-foreground">{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
