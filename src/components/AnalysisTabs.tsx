import { useState } from "react";
import { ScoreRing } from "./ScoreRing";
import {
  Newspaper,
  TrendingUp,
  Flame,
  DollarSign,
  Users,
  Scale,
  CheckCircle,
  Sparkles,
  UserCheck,
  History,
  Coins,
  PieChart,
  BookOpen,
  Database,
  BrainCircuit,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import type { AnalysisAvailability, StockAnalysis } from "@/hooks/useStockAnalysis";
import { SectionChat } from "./SectionChat";
import { FormattedAnalysis } from "./FormattedAnalysis";
import { VerdictSummary } from "./VerdictSummary";
import { useEtoroCompliance } from "@/hooks/useEtoroCompliance";
import { rdtTrack } from "@/lib/reddit-pixel";

interface AnalysisTabsProps {
  analysis: StockAnalysis;
  stockSymbol: string;
  availability?: AnalysisAvailability;
  isETF?: boolean;
}

// Extract a score from text - prioritize explicit ratings and context
function extractScore(text: string): number {
  const lowerText = text.toLowerCase();

  // Look for X/100 pattern
  const slashHundredMatch = text.match(/(?:RATING|Rating|rating)?[\s:]*(\d+(?:\.\d+)?)\s*\/\s*100/i);
  if (slashHundredMatch) return Math.min(100, Math.round(parseFloat(slashHundredMatch[1])));

  // Look for X/10 pattern (negative lookahead for 0 so we don't catch /100 as /10)
  const slashTenMatch = text.match(/(?:RATING|Rating|rating)?[\s:]*(\d+(?:\.\d+)?)\s*\/\s*10(?!0)/i);
  if (slashTenMatch) return Math.min(100, Math.round(parseFloat(slashTenMatch[1]) * 10));

  // Check for explicit action recommendations (highest priority sentiment)
  const hasBuyAction = /\*\*action:\s*buy\*\*/i.test(text) || /action:\s*buy/i.test(text);
  const hasSellAction = /\*\*action:\s*sell\*\*/i.test(text) || /action:\s*sell/i.test(text);
  const hasHoldAction = /\*\*action:\s*hold\*\*/i.test(text) || /action:\s*hold/i.test(text);

  if (hasBuyAction) return 75;
  if (hasSellAction) return 25;
  if (hasHoldAction) return 50;

  // Look for emoji-based signals (these are strong indicators)
  const bullishEmoji = (text.match(/📈/g) || []).length;
  const bearishEmoji = (text.match(/📉/g) || []).length;
  if (bullishEmoji > bearishEmoji) return 70 + (bullishEmoji * 5);
  if (bearishEmoji > bullishEmoji) return 30 - (bearishEmoji * 5);

  // Check for value signal conclusions (💡)
  const valueSignalMatch = text.match(/💡[^:]*:\s*([^.]+)/i);
  if (valueSignalMatch) {
    const signal = valueSignalMatch[1].toLowerCase();
    if (signal.includes('justified') || signal.includes('fair') || signal.includes('growth')) return 65;
    if (signal.includes('undervalued') || signal.includes('attractive')) return 75;
    if (signal.includes('overvalued') || signal.includes('expensive')) return 40;
  }

  // Strong positive/negative phrases (context-aware)
  const strongPositive = [
    'strongly bullish', 'highly positive', 'strong buy', 'outperform',
    'fair value', 'justified', 'leadership', 'growth trajectory',
    'healthy', 'solid', 'robust', 'compelling', 'attractive valuation'
  ];
  const strongNegative = [
    'strongly bearish', 'highly negative', 'strong sell', 'underperform',
    'extremely overvalued', 'avoid', 'significant risk', 'deteriorating',
    'weak', 'concerning', 'poor', 'declining'
  ];
  const moderatePositive = [
    'bullish', 'positive', 'growth', 'beat', 'upside', 'momentum',
    'revenue growth', 'profit margin', 'market position'
  ];
  const moderateNegative = [
    'bearish', 'negative', 'decline', 'miss', 'risk', 'pressure'
  ];
  // Words that modify sentiment (reduce negativity when paired)
  const mitigators = ['slightly', 'somewhat', 'minor', 'but', 'however', 'although', 'while'];

  let score = 50;

  // Strong phrases have more weight
  strongPositive.forEach(phrase => {
    if (lowerText.includes(phrase)) score += 12;
  });
  strongNegative.forEach(phrase => {
    if (lowerText.includes(phrase)) score -= 12;
  });

  // Moderate words with less weight
  moderatePositive.forEach(word => {
    if (lowerText.includes(word)) score += 5;
  });

  // For moderate negatives, check if they're mitigated
  moderateNegative.forEach(word => {
    if (lowerText.includes(word)) {
      // Check if preceded by a mitigator within 20 chars
      const wordIndex = lowerText.indexOf(word);
      const contextBefore = lowerText.slice(Math.max(0, wordIndex - 20), wordIndex);
      const isMitigated = mitigators.some(m => contextBefore.includes(m));
      score -= isMitigated ? 2 : 5;
    }
  });

  // Special case: "overvalued" context check
  if (lowerText.includes('overvalued')) {
    if (lowerText.includes('slightly overvalued') || lowerText.includes('appears overvalued')) {
      // Mild concern, don't penalize too much
      score -= 3;
    } else if (lowerText.includes('fair value') || lowerText.includes('justified')) {
      // The conclusion contradicts overvalued concern
      score += 5;
    } else {
      score -= 8;
    }
  }

  return Math.max(10, Math.min(90, score));
}


const suggestedQuestionsMap: Record<string, string[]> = {
  news: [
    "What's the main sentiment in recent news?",
    "Are there any risks mentioned?",
    "What's driving the headlines?",
  ],
  technical: [
    "What does the RSI indicate?",
    "Is the trend sustainable?",
    "When to enter/exit?",
  ],
  social: [
    "Is social sentiment reliable?",
    "Any unusual activity?",
    "Compare to competitors?",
  ],
  financials: [
    "Are financials healthy?",
    "Revenue growth trend?",
    "Any debt concerns?",
  ],
  analyst: [
    "What's the consensus target?",
    "Recent rating changes?",
    "Most bullish analyst?",
  ],
  relative: [
    "Beating the market?",
    "Sector comparison?",
    "Relative valuation?",
  ],
  insider: [
    "Are insiders buying or selling?",
    "Any large transactions recently?",
    "What does insider activity signal?",
  ],
  dividend: [
    "Is the dividend safe?",
    "What's the payout ratio?",
    "Dividend growth history?",
  ],
  verdict: [
    "Long-term outlook?",
  ],
  previous: [
    "What changed since the last analysis?",
    "Why is the rating different?",
    "Are the same risks still present?",
  ],
  comparison: [
    "What are the main drivers of the rating change?",
    "Is the long-term outlook different now?",
    "Which metrics improved or deteriorated?",
  ],
};

const etfSuggestedQuestionsMap: Record<string, string[]> = {
  news: [
    "What's affecting this ETF recently?",
    "Any sector news I should know?",
    "Recent inflows or outflows?",
  ],
  holdings: [
    "What are the top holdings?",
    "How diversified is this ETF?",
    "What sectors does it cover?",
  ],
  social: [
    "What is the retail sentiment?",
    "Are people bullish or bearish?",
    "Any trending discussions?",
  ],
  relative: [
    "How does it compare to S&P 500?",
    "Is it outperforming peers?",
    "How is the tracking error?",
  ],
  technicals: [
    "Is it overbought or oversold?",
    "Key support and resistance?",
    "Volume trends?",
  ],
  verdict: [
    "Long-term outlook?",
  ],
  previous: [
    "What changed since the last analysis?",
    "Why is the rating different?",
    "Are the same risks still present?",
  ],
  comparison: [
    "What are the main drivers of the rating change?",
    "Is the long-term outlook different now?",
    "Which metrics improved or deteriorated?",
  ],
};



// ─── Collapsible section used inside the verdict tab ─────────────────────────

function CollapsibleSection({
  icon: Icon,
  label,
  iconColor,
  children,
}: {
  icon: React.ElementType;
  label: string;
  iconColor: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span className={`font-semibold text-sm ${iconColor}`}>{label}</span>
        </div>
        {open
          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-border/30 animate-fade-up">
          {children}
        </div>
      )}
    </div>
  );
}

function EtoroInlineCTA({ symbol }: { symbol: string }) {
  const { isRestricted, isLoading } = useEtoroCompliance();
  if (isLoading || isRestricted) return null;
  const link = 'https://med.etoro.com/B22260_A128601_TClick_Sstocks_discovery.aspx';
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => rdtTrack('Custom', { customEventName: 'EtoroClick', content_name: 'etoro_affiliate_click' })}
      className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-xl bg-[hsl(145_70%_12%)] border border-[hsl(145_60%_30%/0.5)] hover:border-[hsl(145_60%_50%/0.8)] hover:bg-[hsl(145_70%_16%)] transition-all group"
    >
      <div>
        <p className="text-sm font-bold text-[hsl(145_80%_65%)]">
          Ready to trade {symbol}?
        </p>
        <p className="text-xs text-[hsl(145_40%_45%)] mt-0.5">
          Trade on eToro · Your capital is at risk · Sponsored
        </p>
      </div>
      <span className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(145_70%_20%)] border border-[hsl(145_60%_40%/0.4)] text-sm font-bold text-[hsl(145_80%_65%)] group-hover:bg-[hsl(145_70%_25%)] transition-colors whitespace-nowrap">
        Trade on eToro <ExternalLink className="h-3.5 w-3.5" />
      </span>
    </a>
  );
}

export function AnalysisTabs({ analysis, stockSymbol, availability, isETF = false }: AnalysisTabsProps) {
  const [activeTab, setActiveTab] = useState("verdict");

  const sourcesText = typeof analysis.sources_used === 'object'
    ? JSON.stringify(analysis.sources_used, null, 2)
    : (analysis.sources_used || "Source data.");

  const previousContent = analysis.previous_analysis
    ? (typeof analysis.previous_analysis === 'object'
      ? (analysis.previous_analysis.final_verdict || "Previous analysis data.")
      : (analysis.previous_analysis || "Previous analysis data."))
    : null;

  // Stock tabs — without AI Logic, Sources, Comparison, Previous
  const stockTabs = [
    { id: "verdict", label: "AI Insight", icon: CheckCircle, content: analysis.final_verdict, color: "from-primary to-secondary", inactiveColor: "bg-primary/20 text-primary border-primary/30", shadow: "0 10px 40px -10px hsl(var(--primary) / 0.5)", isMain: true },
    { id: "news", label: "News", icon: Newspaper, content: analysis.headlines, color: "from-blue-500 to-cyan-400", inactiveColor: "bg-blue-500/20 text-blue-400 border-blue-500/30", shadow: "0 10px 40px -10px rgba(59, 130, 246, 0.5)" },
    { id: "technical", label: "Technical", icon: TrendingUp, content: analysis.technicals, color: "from-emerald-500 to-green-400", inactiveColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", shadow: "0 10px 40px -10px rgba(16, 185, 129, 0.5)" },
    { id: "social", label: "Social Hype", icon: Flame, content: analysis.social_media_hype || "Social sentiment data not available.", color: "from-orange-500 to-amber-400", inactiveColor: "bg-orange-500/20 text-orange-400 border-orange-500/30", shadow: "0 10px 40px -10px rgba(249, 115, 22, 0.5)" },
    { id: "financials", label: "Financials", icon: DollarSign, content: analysis.financial_indicators || "Financial data not available.", color: "from-violet-500 to-purple-400", inactiveColor: "bg-violet-500/20 text-violet-400 border-violet-500/30", shadow: "0 10px 40px -10px rgba(139, 92, 246, 0.5)" },
    { id: "analyst", label: "Analysts", icon: Users, content: analysis.analyst_consensus || "Analyst data not available.", color: "from-pink-500 to-rose-400", inactiveColor: "bg-pink-500/20 text-pink-400 border-pink-500/30", shadow: "0 10px 40px -10px rgba(236, 72, 153, 0.5)" },
    { id: "relative", label: "vs Market", icon: Scale, content: analysis.relative_to_market || "Market comparison not available.", color: "from-indigo-500 to-blue-400", inactiveColor: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30", shadow: "0 10px 40px -10px rgba(99, 102, 241, 0.5)" },
    { id: "insider", label: "Insiders", icon: UserCheck, content: analysis.insider_activity || "Insider activity data not available.", color: "from-teal-500 to-cyan-400", inactiveColor: "bg-teal-500/20 text-teal-400 border-teal-500/30", shadow: "0 10px 40px -10px rgba(20, 184, 166, 0.5)" },
    { id: "dividend", label: "Dividends", icon: Coins, content: analysis.dividend_health || "Dividend data not available.", color: "from-amber-500 to-yellow-400", inactiveColor: "bg-amber-500/20 text-amber-400 border-amber-500/30", shadow: "0 10px 40px -10px rgba(245, 158, 11, 0.5)" },
  ];

  // ETF tabs — without AI Logic, Sources, Comparison, Previous
  const etfTabs = [
    { id: "verdict", label: "AI Insight", icon: CheckCircle, content: analysis.final_verdict, color: "from-primary to-secondary", inactiveColor: "bg-primary/20 text-primary border-primary/30", shadow: "0 10px 40px -10px hsl(var(--primary) / 0.5)", isMain: true },
    { id: "news", label: "News", icon: Newspaper, content: analysis.headlines, color: "from-blue-500 to-cyan-400", inactiveColor: "bg-blue-500/20 text-blue-400 border-blue-500/30", shadow: "0 10px 40px -10px rgba(59, 130, 246, 0.5)" },
    { id: "holdings", label: "Holdings", icon: PieChart, content: analysis.insider_activity || "Holdings analysis not available.", color: "from-orange-500 to-amber-400", inactiveColor: "bg-orange-500/20 text-orange-400 border-orange-500/30", shadow: "0 10px 40px -10px rgba(249, 115, 22, 0.5)" },
    { id: "social", label: "Social", icon: Flame, content: analysis.social_media_hype || "Social sentiment not available.", color: "from-pink-500 to-rose-400", inactiveColor: "bg-pink-500/20 text-pink-400 border-pink-500/30", shadow: "0 10px 40px -10px rgba(236, 72, 153, 0.5)" },
    { id: "relative", label: "vs Market", icon: Scale, content: analysis.relative_to_market || "Relative comparison not available.", color: "from-indigo-500 to-blue-400", inactiveColor: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30", shadow: "0 10px 40px -10px rgba(99, 102, 241, 0.5)" },
    { id: "technical", label: "Technical", icon: TrendingUp, content: analysis.technicals, color: "from-violet-500 to-purple-400", inactiveColor: "bg-violet-500/20 text-violet-400 border-violet-500/30", shadow: "0 10px 40px -10px rgba(139, 92, 246, 0.5)" },
  ];

  const tabs = isETF ? etfTabs : stockTabs;
  const questionsMap = isETF ? etfSuggestedQuestionsMap : suggestedQuestionsMap;

  // Build full context string for AI chat — gives the model the entire analysis
  const fullContext = [
    analysis.headlines && `NEWS SENTIMENT:\n${analysis.headlines}`,
    analysis.technicals && `TECHNICALS:\n${analysis.technicals}`,
    analysis.social_media_hype && `SOCIAL HYPE:\n${analysis.social_media_hype}`,
    analysis.financial_indicators && `FINANCIALS:\n${analysis.financial_indicators}`,
    analysis.analyst_consensus && `ANALYST CONSENSUS:\n${analysis.analyst_consensus}`,
    analysis.relative_to_market && `VS MARKET:\n${analysis.relative_to_market}`,
    analysis.insider_activity && `INSIDER ACTIVITY:\n${analysis.insider_activity}`,
    analysis.dividend_health && `DIVIDEND HEALTH:\n${analysis.dividend_health}`,
    analysis.final_verdict && `AI VERDICT:\n${analysis.final_verdict}`,
    analysis.methodology && `AI METHODOLOGY:\n${analysis.methodology}`,
    analysis.comparative_analysis && `RATING COMPARISON:\n${analysis.comparative_analysis}`,
  ].filter(Boolean).join("\n\n---\n\n");

  return (
    <div className="w-full animate-fade-up animation-delay-300 space-y-6">
      {/* Tab Navigation */}
      <div className="glass-card p-3 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            const btn = (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-300 border z-10
                  ${isActive
                    ? `bg-gradient-to-r ${tab.color} text-white shadow-lg scale-105 border-transparent`
                    : `${tab.inactiveColor} hover:scale-102 hover:brightness-125`
                  }
                `}
                style={isActive ? { boxShadow: tab.shadow } : {}}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'animate-pulse' : ''}`} />
                <span className="font-display whitespace-nowrap">{tab.label}</span>
                {tab.isMain && <Sparkles className="h-4 w-4 ml-1" />}
              </button>
            );

            if (tab.isMain) {
              return (
                <div key={tab.id} className="ai-insight-tab-wrapper">
                  <div className="ai-insight-tab-wrapper__spark" />
                  <div className="ai-insight-tab-wrapper__glow" />
                  {btn}
                </div>
              );
            }

            return btn;
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="glass-card p-0 overflow-hidden">
        {tabs.map((tab) => {
          if (activeTab !== tab.id) return null;
          const Icon = tab.icon;
          const tabScore = extractScore(tab.content);

          return (
            <div key={tab.id} className="animate-fade-up">
              {/* Gradient Header — skipped on verdict tab (verdict pill replaces it below) */}
              {tab.id !== 'verdict' && (
                <div className={`bg-gradient-to-r ${tab.color} p-6 relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-2xl text-white">{tab.label}</h3>
                        <p className="text-white/80 text-sm">{isETF ? 'ETF Analysis' : 'Automated Market Analysis'}</p>
                      </div>
                    </div>
                    <ScoreRing score={tabScore} onColoredBg />
                  </div>
                </div>
              )}

              {/* Score Bar — skipped on verdict tab (already shown in summary pill) */}
              {tab.id !== 'verdict' && (
                <div className="px-6 py-4 bg-secondary/30 border-b border-border/50">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">Score:</span>
                    <div className="flex-1 h-3 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${tab.color} transition-all duration-1000 ease-out`}
                        style={{ width: `${tabScore}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold ${tabScore >= 70 ? 'text-success' : tabScore >= 40 ? 'text-warning' : 'text-destructive'}`}>
                      {tabScore >= 70 ? 'Bullish' : tabScore >= 40 ? 'Neutral' : 'Bearish'}
                    </span>
                  </div>
                </div>
              )}

              {/* Main Content */}
              <div className="p-6 space-y-6">
                {tab.id === 'verdict' ? (
                  <VerdictSummary
                    content={tab.content}
                    score={typeof analysis.ai_score === 'number' ? analysis.ai_score : tabScore}
                    qualityFlags={analysis.quality_flags}
                    tabColor={tab.color}
                  />
                ) : (
                  <FormattedAnalysis content={tab.content} tabColor={tab.color} />
                )}

                {/* eToro CTA — inline after analysis content */}
                <EtoroInlineCTA symbol={stockSymbol} />

                {/* ── Collapsibles only inside AI Insight tab ── */}
                {tab.id === 'verdict' && (
                  <div className="space-y-3 pt-2">
                    {/* AI Logic */}
                    {analysis.methodology && (
                      <CollapsibleSection icon={BrainCircuit} label="AI Logic" iconColor="text-indigo-400">
                        <FormattedAnalysis content={analysis.methodology} />
                      </CollapsibleSection>
                    )}

                    {/* Sources & Data */}
                    <CollapsibleSection icon={BookOpen} label="Sources & Data" iconColor="text-slate-400">
                      <div className="space-y-4">
                        <FormattedAnalysis content={sourcesText} />
                        {/* Raw data blocks */}
                        {isETF && analysis.etf_holdings && analysis.etf_holdings.length > 0 && (
                          <div className="rounded-md border p-4 bg-muted/20">
                            <p className="font-semibold mb-2 text-sm flex items-center gap-2"><Database className="h-4 w-4" /> Top Holdings</p>
                            <div className="overflow-auto max-h-64">
                              <table className="w-full text-xs text-left">
                                <thead className="text-muted-foreground border-b border-border/50">
                                  <tr><th className="pb-2">Asset</th><th className="pb-2 text-right">Weight</th><th className="pb-2 text-right">Shares</th></tr>
                                </thead>
                                <tbody>
                                  {analysis.etf_holdings.map((h: any, i: number) => (
                                    <tr key={i} className="border-b border-border/10 last:border-0 hover:bg-white/5">
                                      <td className="py-2 font-medium">{h.asset} <span className="text-muted-foreground ml-1">({h.symbol})</span></td>
                                      <td className="py-2 text-right">{h.weightPercentage?.toFixed(2)}%</td>
                                      <td className="py-2 text-right">{h.sharesNumber ? Number(h.sharesNumber).toLocaleString() : '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        {analysis.technicals_yahoo && (
                          <div className="rounded-md border p-4 bg-muted/20">
                            <p className="font-semibold mb-2 text-sm">Technical Indicators (raw)</p>
                            <pre className="text-xs overflow-auto max-h-48 p-2 bg-black/20 rounded">{JSON.stringify(analysis.technicals_yahoo, null, 2)}</pre>
                          </div>
                        )}
                        {analysis.financial_ratios && (
                          <div className="rounded-md border p-4 bg-muted/20">
                            <p className="font-semibold mb-2 text-sm">Financial Ratios (raw)</p>
                            <pre className="text-xs overflow-auto max-h-48 p-2 bg-black/20 rounded">{JSON.stringify(analysis.financial_ratios, null, 2)}</pre>
                          </div>
                        )}
                        {analysis.analyst_ratings && (
                          <div className="rounded-md border p-4 bg-muted/20">
                            <p className="font-semibold mb-2 text-sm">Analyst Ratings (raw)</p>
                            <pre className="text-xs overflow-auto max-h-48 p-2 bg-black/20 rounded">{JSON.stringify(analysis.analyst_ratings, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    </CollapsibleSection>

                    {/* Rating Comparison */}
                    {analysis.comparative_analysis && (
                      <CollapsibleSection icon={ArrowLeftRight} label="Rating Comparison" iconColor="text-purple-400">
                        {/* Date header */}
                        <div className="mb-4 grid grid-cols-2 gap-4 p-4 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-xl">
                          <div>
                            <p className="text-[10px] text-purple-400/80 font-bold uppercase tracking-widest mb-1">Previous Run</p>
                            <p className="text-sm font-semibold text-foreground/90 flex items-center gap-1.5">
                              <History className="h-3.5 w-3.5 text-purple-400/60" />
                              {analysis.previous_analysis?.analyzed_at
                                ? new Date(analysis.previous_analysis.analyzed_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                                : 'Historical Archive'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-indigo-400/80 font-bold uppercase tracking-widest mb-1">Current Run</p>
                            <p className="text-sm font-semibold text-foreground/90 flex items-center gap-1.5 justify-end">
                              {analysis.analyzed_at
                                ? new Date(analysis.analyzed_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                                : 'Real-time Run'}
                              <Sparkles className="h-3.5 w-3.5 text-indigo-400/60" />
                            </p>
                          </div>
                        </div>
                        <FormattedAnalysis content={analysis.comparative_analysis} />
                      </CollapsibleSection>
                    )}

                    {/* Previous Insight */}
                    {previousContent && (
                      <CollapsibleSection icon={History} label="Previous Insight" iconColor="text-amber-400">
                        <FormattedAnalysis content={previousContent} />
                      </CollapsibleSection>
                    )}
                  </div>
                )}

                {/* Disclaimer */}
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Important:</strong> This {isETF ? 'ETF analysis' : 'analysis'} is generated by automated systems for informational and educational purposes only.
                    {isETF ? ' ETFs carry risks including market risk and tracking error. ' : ' It does not consider your personal financial situation and is not investment advice. '}
                    Past performance does not guarantee future results. Always conduct your own research.
                  </p>
                </div>

                {/* AI Chat */}
                <SectionChat
                  sectionName={tab.label}
                  sectionContent={tab.content}
                  stockSymbol={stockSymbol}
                  suggestedQuestions={questionsMap[tab.id] || []}
                  fullContext={fullContext}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
