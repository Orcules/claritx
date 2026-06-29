import { Link, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  BarChart3,
  DollarSign,
  Activity,
  ArrowLeft,
  CheckCircle2,
  Brain,
  LineChart,
  Target,
  Eye,
  BarChart2,
  Sparkles,
} from "lucide-react";
import { useStockAnalysis } from "@/hooks/useStockAnalysis";
import { useUserCredits } from "@/hooks/useUserCredits";
import { StockHeader } from "@/components/StockHeader";
import { StockChart } from "@/components/StockChart";
import { AnalysisTabs } from "@/components/AnalysisTabs";
import { TechnicalIndicators } from "@/components/TechnicalIndicators";
import { StatCard } from "@/components/StatCard";
import { AnalysisLoadingScreen } from "@/components/AnalysisLoadingScreen";
import { StockQualityInsights } from "@/components/StockQualityInsights";
import { useEffect, useState, useRef } from "react";
import { rdtTrack } from "@/lib/reddit-pixel";
import { StockSearch } from "@/components/StockSearch";
import { EtoroAffiliateCTA } from "@/components/EtoroAffiliateCTA";
import { useTheme } from "next-themes";

export default function AIStockAnalysis() {
  const { resolvedTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const symbolParam = searchParams.get('symbol');
  const { refetch: refetchCredits } = useUserCredits();
  const { analyzeStock, isLoading, data, error, setPreloadedData, reset } = useStockAnalysis(refetchCredits);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [searchingSymbol, setSearchingSymbol] = useState<string | null>(null);
  const analysisRef = useRef<HTMLDivElement>(null);

  // Reset data when navigating back (no symbol in URL)
  useEffect(() => {
    if (!symbolParam) {
      reset();
      setShowAnalysis(false);
      setSearchingSymbol(null);
    }
  }, [symbolParam]);

  // Check for pre-loaded data from Deep Research or URL symbol parameter
  useEffect(() => {
    if (!symbolParam) return;

    const cachedSymbol = localStorage.getItem('deepResearchSymbol');
    const localResult = localStorage.getItem('deepResearchResult');
    const expiry = localStorage.getItem('deepResearchExpiry');

    const cleanupLocalStorage = () => {
      localStorage.removeItem('deepResearchSymbol');
      localStorage.removeItem('deepResearchResult');
      localStorage.removeItem('deepResearchExpiry');
      localStorage.removeItem('deepResearchFromCache');
    };

    // Check if data is expired
    const isExpired = expiry && Date.now() > parseInt(expiry);
    if (isExpired) {
      cleanupLocalStorage();
    }

    // Priority 1: Load from localStorage if we have the actual result data
    if (cachedSymbol === symbolParam && localResult && !isExpired) {
      try {
        const parsedResult = JSON.parse(localResult);
        console.log('Loading cached deep research result for:', symbolParam);
        setPreloadedData(parsedResult);
        cleanupLocalStorage();
        return;
      } catch (e) {
        console.error("Failed to parse localStorage result:", e);
      }
    }

    // Priority 2: Check sessionStorage for same-tab navigation
    const sessionSymbol = sessionStorage.getItem('deepResearchSymbol');
    const sessionResult = sessionStorage.getItem('deepResearchResult');

    if (sessionSymbol === symbolParam && sessionResult) {
      try {
        const parsedResult = JSON.parse(sessionResult);
        setPreloadedData(parsedResult);
        sessionStorage.removeItem('deepResearchResult');
        sessionStorage.removeItem('deepResearchSymbol');
        return;
      } catch (e) {
        console.error("Failed to parse cached result:", e);
      }
    }

    // Priority 3: No cache available, trigger fresh analysis
    cleanupLocalStorage();
    setSearchingSymbol(symbolParam);
    analyzeStock(symbolParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolParam]);

  // Trigger entry animation when data loads
  useEffect(() => {
    if (data) {
      rdtTrack('Search');
      const timer = setTimeout(() => {
        setShowAnalysis(true);
        analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setShowAnalysis(false);
    }
  }, [data]);

  // Clear loading screen when data arrives or error occurs
  useEffect(() => {
    if (data || error) {
      setSearchingSymbol(null);
    }
  }, [data, error]);

  const handleSearch = (symbol: string) => {
    const upper = symbol.toUpperCase();
    setSearchingSymbol(upper);
    setSearchParams({ symbol: upper });
  };

  const handleRefresh = () => {
    if (data?.stock?.symbol) {
      analyzeStock(data.stock.symbol, true);
    }
  };

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null) return "N/A";
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return num.toLocaleString();
  };

  const formatVolume = (num: number | undefined | null) => {
    if (num === undefined || num === null) return "N/A";
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const buildIndicators = () => {
    if (!data?.stock?.technicals) return [];
    const { technicals, price } = data.stock;
    const rsi = parseFloat(technicals.rsi);
    const sma20 = parseFloat(technicals.sma20);
    const sma50 = parseFloat(technicals.sma50);

    return [
      { name: "RSI (14)", value: technicals.rsi, signal: rsi > 70 ? "sell" as const : rsi < 30 ? "buy" as const : "hold" as const, strength: rsi > 50 ? rsi : 100 - rsi },
      { name: "SMA (20)", value: `$${technicals.sma20}`, signal: price > sma20 ? "buy" as const : "sell" as const, strength: Math.abs((price - sma20) / sma20 * 100) + 50 },
      { name: "SMA (50)", value: `$${technicals.sma50}`, signal: price > sma50 ? "buy" as const : "sell" as const, strength: Math.abs((price - sma50) / sma50 * 100) + 50 },
      { name: "Trend", value: technicals.trend === 'bullish' ? 'Bullish' : 'Bearish', signal: technicals.trend === 'bullish' ? "buy" as const : "sell" as const, strength: technicals.trend === 'bullish' ? 70 : 30 },
    ];
  };

  const analysisAngles = [
    { icon: BarChart3, title: "News Sentiment", desc: "Headlines & press analysis", color: "from-blue-500 to-cyan-500" },
    { icon: LineChart, title: "Technical Signals", desc: "Price patterns & indicators", color: "from-purple-500 to-pink-500" },
    { icon: Eye, title: "Market Buzz", desc: "Social media sentiment", color: "from-orange-500 to-red-500" },
    { icon: DollarSign, title: "Financials", desc: "Revenue, earnings & ratios", color: "from-green-500 to-emerald-500" },
    { icon: Target, title: "Analyst Views", desc: "Wall Street consensus", color: "from-yellow-500 to-orange-500" },
    { icon: BarChart2, title: "vs. Market", desc: "Relative performance", color: "from-indigo-500 to-purple-500" },
    { icon: Activity, title: "Insider Activity", desc: "Executive transactions", color: "from-rose-500 to-pink-500" },
    { icon: TrendingUp, title: "Dividend Health", desc: "Yield & payout analysis", color: "from-teal-500 to-cyan-500" },
    { icon: Sparkles, title: "AI Signal", desc: "Automated summary", color: "from-primary to-secondary" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title={symbolParam ? `${symbolParam.toUpperCase()} Stock Analysis — Is It a Buy? | ClaritX` : "Free AI Stock Analysis Tool — Analyze Any Stock | ClaritX"}
        description={symbolParam ? `Should you buy ${symbolParam.toUpperCase()}? Free AI deep research across 9 perspectives — news sentiment, technicals, financials, analyst ratings & a clear verdict.` : "Analyze any stock free with AI: 9 perspectives — news sentiment, technicals, financials, analyst ratings & a clear verdict. Instant deep research on any ticker."}
        canonicalUrl={`/ai-stock-analysis`}
      />
      
      {symbolParam && !data && !error && (
        <AnalysisLoadingScreen symbol={searchingSymbol || symbolParam} />
      )}

      <Header />

      <main className="flex-1 pt-24 pb-16 container mx-auto px-4">
        {/* Always show the search form at the top */}
        <div className="mb-8 max-w-3xl mx-auto">
          {!data && !symbolParam && (
             <div className="relative mb-8">
               <div className="absolute top-0 left-0 md:-left-12 z-10">
                 <Button variant="ghost" onClick={() => window.history.back()} className="gap-2 text-muted-foreground hover:text-foreground">
                   <ArrowLeft className="h-4 w-4" /> Back
                 </Button>
               </div>
               <div className="flex flex-col items-center gap-2 sm:gap-3 animate-fade-up text-center">
                 <div className="overflow-hidden h-14 sm:h-20 md:h-24">
                   <img src={resolvedTheme !== "light" ? "/logo-white.png" : "/logo-black.png"} alt="ClaritX" width="224" height="112" loading="eager" className="h-28 sm:h-40 md:h-48 w-auto -mt-7 sm:-mt-10 md:-mt-12" />
                 </div>
                 <p className="text-sm sm:text-base md:text-lg font-medium text-muted-foreground tracking-wide -mt-1 sm:-mt-2">Clarity before you invest</p>
                 <h1 className="mt-4 sm:mt-5 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold leading-tight">How can we help you <span className="gradient-text">invest smarter</span>?</h1>
                 <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto px-2">Pick a path below — or tell us what you're looking for.</p>
               </div>
             </div>
          )}
          <StockSearch onSearch={handleSearch} isLoading={isLoading} currentSymbol={data?.stock?.symbol || symbolParam || ''} />
          
          {!data && !symbolParam && (
            <div className="mt-6 flex flex-wrap justify-center items-center gap-x-4 gap-y-1 text-[11px] sm:text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /> 13,000+ stocks</span>
              <span className="text-border hidden sm:inline">·</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /> 9 research angles</span>
              <span className="text-border hidden sm:inline">·</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /> Free</span>
            </div>
          )}
        </div>
        
        {!data && !symbolParam && (
          <section className="max-w-7xl mx-auto px-2 sm:px-0 mt-16 sm:mt-24 mb-12" aria-labelledby="analysis-heading">
            <div className="text-center mb-8 sm:mb-12 lg:mb-16">
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary font-medium text-xs sm:text-sm mb-4 sm:mb-6">
                <Brain className="h-3 w-3 sm:h-4 sm:w-4" />
                Automated Analysis Engine
              </div>
              <h2 id="analysis-heading" className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold animate-fade-up">
                <span className="text-foreground">9 Perspectives of</span>{" "}
                <span className="gradient-text">Market Research</span>
              </h2>
              <p className="mt-3 sm:mt-4 text-sm sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-up animation-delay-100 px-2">
                Each stock is analyzed from multiple angles to provide comprehensive research data
              </p>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-9 gap-2 sm:gap-3">
              {analysisAngles.map((angle, index) => (
                <div
                  key={angle.title}
                  className="glass-card-hover p-2 sm:p-3 lg:p-4 text-center group animate-fade-up relative overflow-hidden"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-300" style={{ backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))` }} />
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 mx-auto rounded-lg sm:rounded-xl bg-gradient-to-br ${angle.color} p-1.5 sm:p-2 lg:p-2.5 mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                    <angle.icon className="w-full h-full text-white" />
                  </div>
                  <h3 className="font-semibold text-[10px] sm:text-xs text-foreground leading-tight">{angle.title}</h3>
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground mt-0.5 sm:mt-1 leading-tight hidden sm:block">{angle.desc}</p>
                </div>
              ))}
            </div>

            <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-4 sm:mt-6">
              All analysis is automated and impersonal. Not investment advice.
            </p>
          </section>
        )}

        {symbolParam && !data && !isLoading && error && (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-4">Analysis Failed</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => analyzeStock(symbolParam!)} variant="default">Try Again</Button>
              <Button onClick={() => window.location.href = '/'} variant="outline">Back to Home</Button>
            </div>
          </div>
        )}

        {symbolParam && !data && !isLoading && !error && (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">Something went wrong loading the analysis.</p>
            <Button onClick={() => analyzeStock(symbolParam!)} variant="default">Retry Analysis</Button>
          </div>
        )}

        {data && (
          <div
            ref={analysisRef}
            className={`space-y-6 transition-all duration-700 ease-out ${showAnalysis ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-[0.98]'}`}
          >
            <StockHeader
              symbol={data.stock.symbol}
              name={data.stock.name}
              price={data.stock.price}
              change={data.stock.change}
              changePercent={data.stock.changePercent}
              marketCap={formatNumber(data.stock.marketCap)}
              volume={formatVolume(data.stock.volume)}
              exchange={data.stock.exchange}
              sector={data.stock.sector}
              industry={data.stock.industry}
              description={data.stock.description}
              ceo={data.stock.ceo}
              employees={data.stock.employees}
              website={data.stock.website}
              isETF={data.stock.isETF}
              expenseRatio={data.stock.expenseRatio}
              holdingsCount={data.stock.holdingsCount}
              etfCompany={data.stock.etfCompany}
              completedAt={data.completed_at}
              onRefresh={handleRefresh}
              isLoading={isLoading}
            />

            <StockQualityInsights data={data} section="flags" />

            <AnalysisTabs
              analysis={data.analysis}
              stockSymbol={data.stock.symbol}
              availability={data.availability}
              isETF={data.stock.isETF || (data.stock as any).isFund}
            />

            <StockQualityInsights data={data} section="metrics" />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Day High" value={data.stock.dayHigh ? `$${data.stock.dayHigh.toFixed(2)}` : 'N/A'} icon={TrendingUp} delay={0} />
              <StatCard title="Day Low" value={data.stock.dayLow ? `$${data.stock.dayLow.toFixed(2)}` : 'N/A'} icon={BarChart3} delay={100} />
              <StatCard title="52W High" value={data.stock.fiftyTwoWeekHigh ? `$${data.stock.fiftyTwoWeekHigh.toFixed(2)}` : 'N/A'} icon={DollarSign} delay={200} />
              <StatCard title="52W Low" value={data.stock.fiftyTwoWeekLow ? `$${data.stock.fiftyTwoWeekLow.toFixed(2)}` : 'N/A'} icon={Activity} delay={300} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              <div className="lg:col-span-2 h-full">
                <StockChart symbol={data.stock.symbol} isPositive={data.stock.change >= 0} />
              </div>
              <TechnicalIndicators indicators={buildIndicators()} />
            </div>

            <EtoroAffiliateCTA variant="inline" context="stock" symbol={data.stock.symbol} />

            <div className="mt-8 p-4 rounded-lg bg-warning/10 border border-warning/20">
              <p className="text-xs text-muted-foreground leading-relaxed text-center">
                <strong className="text-warning">Disclaimer:</strong> This AI-generated analysis is for <strong>informational and educational purposes only</strong> and does not constitute investment advice.
                ClaritX is not a registered investment adviser. Investments can go down as well as up. Past performance is not indicative of future results.
                Always do your own research and consider consulting a licensed financial advisor before making investment decisions.{" "}
                <Link to="/disclaimer" className="text-primary hover:underline">Read full disclaimer</Link>
              </p>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
