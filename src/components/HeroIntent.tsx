import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, PieChart, Flame, MessageCircle, ArrowLeft, Send, Loader2, CheckCircle2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StockSearch } from "@/components/StockSearch";
import { useTheme } from "next-themes";

type Mode = "choose" | "stock" | "chat";

type Intent = "stock" | "portfolio" | "rank" | "unknown";

interface ClassifiedIntent {
  intent: Intent;
  symbol?: string;
}

function classifyIntent(text: string): ClassifiedIntent {
  const lower = text.toLowerCase();
  const symbolMatch = text.match(/\b[A-Z]{2,5}\b/);
  const symbol = symbolMatch?.[0];

  const hasDollarAmount = /\$\s?\d|[\d,]+\s?(usd|dollars?|k\b)/i.test(text);
  const portfolioSignals = /\b(portfolio|diversif|allocat|spread|risk tolerance|build me|how (do|should|can) i (start|begin|invest)|where (do|should|can) i (start|begin)|start investing|to invest|new to invest|beginner|first time|don'?t know what|not sure what)\b/.test(lower);

  if (portfolioSignals || hasDollarAmount) {
    return { intent: "portfolio" };
  }
  if (/\b(hot|trending|top \d|best stocks?|rank|popular|movers|gainers|losers|what'?s up|what'?s moving|today)\b/.test(lower)) {
    return { intent: "rank" };
  }
  if (symbol || /\b(buy|sell|hold|analy|research|worth|stock|share|earnings|price target|good (buy|investment))\b/.test(lower)) {
    return { intent: "stock", symbol };
  }
  return { intent: "unknown" };
}

interface HeroIntentProps {
  onStockSearch: (symbol: string) => void;
}

export function HeroIntent({ onStockSearch }: HeroIntentProps) {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const [mode, setMode] = useState<Mode>("choose");
  const [chatText, setChatText] = useState("");
  const [chatStatus, setChatStatus] = useState<"idle" | "thinking" | "routed">("idle");
  const [routedTo, setRoutedTo] = useState<Intent | null>(null);

  const handleChatSubmit = () => {
    if (!chatText.trim()) return;
    setChatStatus("thinking");

    setTimeout(() => {
      const result = classifyIntent(chatText.trim());
      setRoutedTo(result.intent);
      setChatStatus("routed");

      setTimeout(() => {
        if (result.intent === "portfolio") {
          navigate("/portfolio-simulator");
        } else if (result.intent === "rank") {
          navigate("/ai-stock-rank");
        } else if (result.intent === "stock") {
          if (result.symbol) {
            onStockSearch(result.symbol);
          } else {
            setMode("stock");
            setChatStatus("idle");
          }
        } else {
          navigate("/portfolio-simulator");
        }
      }, 700);
    }, 400);
  };

  const resetToChoose = () => {
    setMode("choose");
    setChatText("");
    setChatStatus("idle");
    setRoutedTo(null);
  };

  return (
    <section className="relative max-w-3xl mx-auto text-center py-10 sm:py-14 lg:py-16">
      <div className="absolute inset-0 bg-grid-animated opacity-20" aria-hidden="true" />
      <div className="hero-glow -top-32 -left-32 opacity-60" aria-hidden="true" />
      <div className="hero-glow-secondary -bottom-32 -right-32 opacity-60" aria-hidden="true" />

      <div className="relative z-10">
        <div className="flex flex-col items-center gap-2 sm:gap-3 animate-fade-up">
          <div className="overflow-hidden h-14 sm:h-20 md:h-24">
            <img
              src={resolvedTheme !== "light" ? "/logo-white.png" : "/logo-black.png"}
              alt="ClaritX"
              width={224}
              height={112}
              loading="eager"
              className="h-28 sm:h-40 md:h-48 w-auto -mt-7 sm:-mt-10 md:-mt-12"
            />
          </div>

          <p className="text-sm sm:text-base md:text-lg font-medium text-muted-foreground tracking-wide -mt-1 sm:-mt-2">
            Clarity before you invest
          </p>

          <h1 className="mt-4 sm:mt-5 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold leading-tight">
            How can we help you <span className="gradient-text">invest smarter</span>?
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto px-2">
            Pick a path below — or tell us what you&apos;re looking for.
          </p>
        </div>

        <div className="mt-8 sm:mt-10 animate-fade-up animation-delay-200">
          {mode === "choose" && (
            <div className="glass-card p-4 sm:p-6 max-w-2xl mx-auto">
              <p className="text-xs sm:text-sm text-muted-foreground mb-4 text-left flex items-center gap-2">
                <MessageCircle className="h-3.5 w-3.5 text-primary" />
                <span>What brings you here today?</span>
              </p>

              <div className="grid sm:grid-cols-2 gap-2 sm:gap-3">
                <IntentButton
                  icon={Search}
                  iconColor="text-blue-500"
                  iconBg="from-blue-500/20 to-cyan-500/10"
                  title="Check a specific stock"
                  subtitle="I have a symbol in mind"
                  onClick={() => setMode("stock")}
                />
                <IntentButton
                  icon={PieChart}
                  iconColor="text-secondary"
                  iconBg="from-secondary/20 to-primary/10"
                  title="Build a portfolio"
                  subtitle="Answer 5 questions, get a plan"
                  badge="Most popular"
                  onClick={() => navigate("/portfolio-simulator")}
                />
                <IntentButton
                  icon={Trophy}
                  iconColor="text-yellow-500"
                  iconBg="from-yellow-500/20 to-amber-500/10"
                  title="AI Rank"
                  subtitle="Today's top AI-ranked stocks"
                  onClick={() => navigate("/ai-stock-rank")}
                />
                <IntentButton
                  icon={Flame}
                  iconColor="text-orange-500"
                  iconBg="from-orange-500/20 to-red-500/10"
                  title="What's hot today"
                  subtitle="Live news catalysts & movers"
                  onClick={() => navigate("/market-opportunities")}
                />
                <div className="sm:col-span-2">
                  <IntentButton
                    icon={MessageCircle}
                    iconColor="text-purple-500"
                    iconBg="from-purple-500/20 to-pink-500/10"
                    title="Something else"
                    subtitle="Tell us in your own words"
                    onClick={() => setMode("chat")}
                  />
                </div>
              </div>

              <p className="text-[10px] sm:text-xs text-muted-foreground/70 mt-4 text-center">
                Free · No signup required
              </p>
            </div>
          )}

          {mode === "stock" && (
            <div className="glass-card p-4 sm:p-6 max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={resetToChoose}
                  className="text-xs sm:text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <p className="text-xs sm:text-sm font-medium text-foreground flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-primary" />
                  Which stock?
                </p>
                <div className="w-12" aria-hidden="true" />
              </div>
              <StockSearch onSearch={onStockSearch} />
            </div>
          )}

          {mode === "chat" && (
            <div className="glass-card p-4 sm:p-6 max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={resetToChoose}
                  className="text-xs sm:text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <p className="text-xs sm:text-sm font-medium text-foreground flex items-center gap-2">
                  <MessageCircle className="h-3.5 w-3.5 text-purple-500" />
                  Tell us what you&apos;re looking for
                </p>
                <div className="w-12" aria-hidden="true" />
              </div>

              {chatStatus === "routed" && routedTo ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                  <p className="text-sm sm:text-base text-foreground">
                    {routedTo === "portfolio" && "Sounds like portfolio building — taking you there now."}
                    {routedTo === "rank" && "Let me show you what's trending — one moment."}
                    {routedTo === "stock" && "Pulling up stock research for you."}
                  </p>
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <Textarea
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSubmit();
                      }
                    }}
                    placeholder="e.g. 'Is NVDA a good buy right now?' or 'I have $10k, where should I start?'"
                    className="min-h-[90px] resize-none bg-background/50 border-border/50 text-sm"
                    disabled={chatStatus === "thinking"}
                    autoFocus
                  />

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <ExampleChip text="Should I buy Tesla?" onClick={(t) => setChatText(t)} />
                    <ExampleChip text="I have $5,000 to invest" onClick={(t) => setChatText(t)} />
                    <ExampleChip text="What stocks are trending?" onClick={(t) => setChatText(t)} />
                  </div>

                  <Button
                    onClick={handleChatSubmit}
                    disabled={!chatText.trim() || chatStatus === "thinking"}
                    className="w-full mt-3 gap-2"
                    size="lg"
                  >
                    {chatStatus === "thinking" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Thinking…
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Find me the right tool
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-center items-center gap-x-4 gap-y-1 text-[11px] sm:text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /> 13,000+ stocks</span>
          <span className="text-border hidden sm:inline">·</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /> 9 research angles</span>
          <span className="text-border hidden sm:inline">·</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /> Free</span>
        </div>
      </div>
    </section>
  );
}

interface IntentButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  badge?: string;
  onClick: () => void;
}

function IntentButton({ icon: Icon, iconColor, iconBg, title, subtitle, badge, onClick }: IntentButtonProps) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-border/50 bg-background/40 hover:bg-background/80 hover:border-primary/40 transition-all duration-200 text-left"
    >
      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-gradient-to-br ${iconBg} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
          {badge && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary border border-secondary/30">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{subtitle}</p>
      </div>
    </button>
  );
}

interface ExampleChipProps {
  text: string;
  onClick: (text: string) => void;
}

function ExampleChip({ text, onClick }: ExampleChipProps) {
  return (
    <button
      onClick={() => onClick(text)}
      className="text-[11px] px-2.5 py-1 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/30 transition-colors"
    >
      {text}
    </button>
  );
}
