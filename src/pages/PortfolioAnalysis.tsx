import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api_adapter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, ArrowLeft, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SEOHead, BreadcrumbSchema } from "@/components/SEOHead";
import { Breadcrumbs } from "@/components/Breadcrumbs";

interface StockAnalysis {
  symbol: string;
  name: string;
  verdict?: string;
  score?: number;
  sentiment?: { label: string; emoji: string } | null;
  loading?: boolean;
  error?: string;
  /** Full analysis payload to reuse when opening "Full Analysis" */
  rawResult?: unknown;
}

interface PortfolioData {
  holdings: Array<{
    symbol: string;
    name: string;
    weight: number;
    sector: string;
    riskLevel: number;
  }>;
  risk_label: string;
  risk_bucket: number;
}

export default function PortfolioAnalysis() {
  const { resolvedTheme } = useTheme();
  const [analyses, setAnalyses] = useState<StockAnalysis[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [overallScore, setOverallScore] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [isRunningDeepResearch, setIsRunningDeepResearch] = useState(false);
  const navigate = useNavigate();

  // NOTE: No Reddit event on page load. Viewing the analysis page is not a conversion.
  // Portfolio conversion is tracked as `PortfolioCreated` in PortfolioBuilder, on a real save.

  // Prevent double execution in React StrictMode (dev) which causes re-analysis + score changes
  const didStartRef = useRef(false);

  useEffect(() => {
    if (didStartRef.current) return;

    // Get portfolio data from sessionStorage
    const storedPortfolio = sessionStorage.getItem('portfolioForAnalysis');
    if (!storedPortfolio) {
      navigate('/my-portfolio');
      return;
    }

    didStartRef.current = true;

    const portfolioData: PortfolioData = JSON.parse(storedPortfolio);
    setPortfolio(portfolioData);

    // Initialize analyses - just show the holdings, don't auto-scan
    const initialAnalyses = portfolioData.holdings.map(h => ({
      symbol: h.symbol,
      name: h.name,
      loading: false,
    }));
    setAnalyses(initialAnalyses);
    setProgress(100);
  }, [navigate]);

  // Run fresh deep research for each symbol using stock-analysis edge function
  const runDeepResearchAll = async () => {
    if (!portfolio || isRunningDeepResearch) return;

    setIsRunningDeepResearch(true);
    const total = portfolio.holdings.length;
    setProgress(0);

    // Reset analyses to loading state
    setAnalyses(portfolio.holdings.map(h => ({
      symbol: h.symbol,
      name: h.name,
      loading: true,
    })));

    toast.info(`Starting deep research for ${total} holdings...`);

    const results: StockAnalysis[] = [];

    // Analyze each stock sequentially to avoid rate limits
    for (let i = 0; i < portfolio.holdings.length; i++) {
      const holding = portfolio.holdings[i];

      try {
        console.log(`Analyzing ${holding.symbol} (${i + 1}/${total})...`);

        let data: any = null;
        let error: any = null;

        try {
          // Call stock-analysis API
          const response = await api.post<any>('/stock-analysis', {
            symbol: holding.symbol,
            force_refresh: false
          });

          data = response;
          if (response.status === 'pending' || response.status === 'processing') {
            const analysisId = response.analysis_id;
            // Poll for completion
            let isComplete = false;
            let attempts = 0;
            while (!isComplete && attempts < 24) { // 2 mins max
              await new Promise(r => setTimeout(r, 5000));
              const statusRes = await api.get<any>(`/analysis-status/${analysisId}`);
              if (statusRes.status === 'complete') {
                data = statusRes;
                isComplete = true;
              } else if (statusRes.status === 'error') {
                throw new Error(statusRes.error || 'Analysis failed');
              }
              attempts++;
            }
            if (!isComplete) {
              throw new Error('Analysis timed out');
            }
          }
        } catch (err: any) {
          error = err;
        }

        if (error) {
          console.error(`Error analyzing ${holding.symbol}:`, error);
          results.push({
            symbol: holding.symbol,
            name: holding.name,
            error: error.message || 'Analysis failed',
          });
        } else {
          // Extract score from final_verdict
          const analysis = data?.analysis;
          const verdict = analysis?.final_verdict || '';
          const score = extractScore(verdict);
          const sentiment = extractSentiment(verdict, score);

          results.push({
            symbol: holding.symbol,
            name: data?.stock?.name || holding.name,
            verdict: verdict.slice(0, 300) + (verdict.length > 300 ? '...' : ''),
            score,
            sentiment,
            rawResult: data,
          });
        }
      } catch (err: any) {
        console.error(`Exception analyzing ${holding.symbol}:`, err);
        results.push({
          symbol: holding.symbol,
          name: holding.name,
          error: err.message || 'Analysis failed',
        });
      }

      // Update progress
      const progressPct = Math.round(((i + 1) / total) * 100);
      setProgress(progressPct);

      // Update UI with current results
      setAnalyses([...results, ...portfolio.holdings.slice(i + 1).map(h => ({
        symbol: h.symbol,
        name: h.name,
        loading: true,
      }))]);
    }

    setAnalyses(results);
    setIsRunningDeepResearch(false);

    // Calculate overall score
    const validScores = results.filter(r => r.score !== undefined).map(r => r.score!);
    if (validScores.length > 0) {
      const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
      setOverallScore(Math.round(avg * 10) / 10);
    }

    toast.success(`Deep research completed for ${total} holdings!`);
  };

  const openFullAnalysis = (symbol: string, rawResult?: unknown) => {
    // Signal to load from database cache, not trigger fresh scan
    localStorage.setItem('deepResearchSymbol', symbol);
    localStorage.setItem('deepResearchFromCache', 'true');
    localStorage.setItem('deepResearchExpiry', String(Date.now() + 5 * 60 * 1000));

    // If we have raw result, include it
    if (rawResult) {
      try {
        localStorage.setItem('deepResearchResult', JSON.stringify(rawResult));
      } catch (e) {
        console.warn('Failed to save rawResult to localStorage', e);
      }
    }

    window.open(`/ai-stock-analysis?symbol=${symbol}`, '_blank');
  };

  const extractScore = (text: string): number | undefined => {
    // Match explicit RESEARCH SCORE or RATING: X/10 patterns and return the raw value (out of 10)
    const researchMatch = text.match(/(?:RESEARCH SCORE|RATING|Rating|rating)[\s:]*(\d+(?:\.\d+)?)\s*\/\s*10/i);
    if (researchMatch) return parseFloat(researchMatch[1]);

    const slashTenMatch = text.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
    if (slashTenMatch) return parseFloat(slashTenMatch[1]);

    // Fallback: look for score in any "score X" pattern
    const scoreWordMatch = text.match(/score[\s:]*(\d+(?:\.\d+)?)/i);
    if (scoreWordMatch) return parseFloat(scoreWordMatch[1]);

    return undefined;
  };

  const extractSentiment = (text: string, score?: number): { label: string; emoji: string } | null => {
    // Use score to determine sentiment if available
    if (score !== undefined) {
      if (score >= 7) return { label: 'Bullish', emoji: '📈' };
      if (score >= 5) return { label: 'Neutral', emoji: '➡️' };
      return { label: 'Bearish', emoji: '📉' };
    }

    // Fall back to text analysis
    if (/strong buy|very bullish|highly positive/i.test(text)) return { label: 'Bullish', emoji: '📈' };
    if (/buy|bullish|positive|upside/i.test(text)) return { label: 'Bullish', emoji: '📈' };
    if (/sell|bearish|negative|downside/i.test(text)) return { label: 'Bearish', emoji: '📉' };
    return null; // Don't show anything if no clear sentiment
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 7) return 'text-emerald-500';
    if (score >= 5) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBgColor = (score?: number) => {
    if (!score) return 'bg-muted';
    if (score >= 7) return 'bg-emerald-500/20 border-emerald-500/30';
    if (score >= 5) return 'bg-yellow-500/20 border-yellow-500/30';
    return 'bg-red-500/20 border-red-500/30';
  };

  const getSentimentBadgeColor = (label: string) => {
    switch (label) {
      case 'Bullish':
        return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
      case 'Bearish':
        return 'bg-red-500/20 text-red-600 dark:text-red-400';
      default:
        return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400';
    }
  };

  const getOverallHealthStatus = () => {
    if (!overallScore) return null;
    if (overallScore >= 7) return { icon: CheckCircle, color: 'text-emerald-500', label: 'Healthy Portfolio' };
    if (overallScore >= 5) return { icon: AlertTriangle, color: 'text-yellow-500', label: 'Mixed Signals' };
    return { icon: XCircle, color: 'text-red-500', label: 'Needs Attention' };
  };

  const healthStatus = getOverallHealthStatus();

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Portfolio Analysis | AI-Powered Stock Research | ClaritX"
        description="Analyze your investment portfolio with AI-powered deep research. Get comprehensive stock analysis, risk assessment, and actionable insights for all your holdings."
        keywords="portfolio analysis, stock portfolio analyzer, AI stock research, investment analysis, portfolio health check, stock deep research"
        canonicalUrl="/portfolio-analysis"
      />
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "/" },
          { name: "Portfolio Analysis", url: "/portfolio-analysis" }
        ]}
      />
      {/* Header */}
      <header className="glass-card border-t-0 rounded-t-none sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center">
              <div className="overflow-hidden h-12">
                <img
                  src={resolvedTheme !== 'light' ? '/logo-white.png' : '/logo-black.png'}
                  alt="ClaritX"
                  className="h-24 w-auto -mt-6"
                />
              </div>
            </Link>

            <Button variant="outline" size="sm" onClick={() => navigate('/my-portfolio')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Portfolio
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Visual Breadcrumbs */}
        <Breadcrumbs
          items={[{ label: "Portfolio Analysis" }]}
          className="mb-8"
        />

        {/* Page H1 */}
        <h1 className="sr-only">AI-Powered Portfolio Analysis - Deep Research Your Holdings</h1>

        {/* Deep Research All Button */}
        {!isRunningDeepResearch && !overallScore && (
          <div className="glass-card p-6 mb-8 animate-fade-up text-center">
            <div className="flex flex-col items-center gap-4">
              <Link to="/">
                <div className="overflow-hidden h-12">
                  <img
                    src={resolvedTheme !== 'light' ? '/logo-white.png' : '/logo-black.png'}
                    alt="ClaritX"
                    className="h-24 w-auto -mt-6"
                  />
                </div>
              </Link>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Deep Research All</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  AI-analyze all {analyses.length} holdings at once
                </p>
              </div>
              <Button
                size="lg"
                className="gap-2 glow-pulse"
                onClick={runDeepResearchAll}
              >
                <Brain className="h-5 w-5" />
                Analyze Portfolio
              </Button>
            </div>
          </div>
        )}

        {/* Progress Section */}
        {isRunningDeepResearch && (
          <div className="glass-card p-6 mb-8 animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <h2 className="font-semibold text-foreground">Running Deep Research...</h2>
              </div>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              Analyzing {analyses.filter(a => !a.loading).length} of {analyses.length} stocks
            </p>
          </div>
        )}

        {/* Overall Score */}
        {overallScore && healthStatus && (
          <div className="glass-card p-6 mb-8 animate-fade-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  <span className={cn("text-2xl font-bold", getScoreColor(overallScore))}>
                    {overallScore}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Portfolio Health Score</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <healthStatus.icon className={cn("h-4 w-4", healthStatus.color)} />
                    <span className={cn("text-sm", healthStatus.color)}>{healthStatus.label}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Risk Profile</p>
                <p className="font-semibold text-foreground">{portfolio?.risk_label}</p>
              </div>
            </div>
          </div>
        )}

        {/* Individual Stock Analyses */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Stock Analyses</h2>

          {analyses.map((analysis) => (
            <div
              key={analysis.symbol}
              className={cn(
                "glass-card p-4 transition-all duration-300",
                analysis.loading && "opacity-60"
              )}
            >
              <div className="flex items-start gap-4">
                {/* Score Circle */}
                {analysis.score !== undefined && !analysis.loading && (
                  <div className={cn(
                    "w-14 h-14 rounded-full border-2 flex items-center justify-center shrink-0",
                    getScoreBgColor(analysis.score)
                  )}>
                    <span className={cn("text-xl font-bold", getScoreColor(analysis.score))}>
                      {analysis.score}
                    </span>
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="font-bold text-lg text-foreground">{analysis.symbol}</span>
                    {!analysis.loading && analysis.score !== undefined && (
                      <Badge className={cn(
                        "text-xs font-bold px-2 py-0.5",
                        analysis.score >= 7 ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                          analysis.score >= 5 ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400" :
                            "bg-red-500/20 text-red-600 dark:text-red-400"
                      )}>
                        AI Score: {analysis.score}/10
                      </Badge>
                    )}
                    {analysis.sentiment && (
                      <Badge className={cn("text-xs", getSentimentBadgeColor(analysis.sentiment.label))}>
                        <span className="mr-1">{analysis.sentiment.emoji}</span>
                        {analysis.sentiment.label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{analysis.name}</p>

                  {analysis.loading ? (
                    <div className="flex items-center gap-2 mt-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                      <span className="text-sm text-muted-foreground">Analyzing...</span>
                    </div>
                  ) : analysis.error ? (
                    <p className="text-sm text-red-500 mt-2">{analysis.error}</p>
                  ) : analysis.verdict ? (
                    <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                      {analysis.verdict}
                    </p>
                  ) : null}
                </div>

                {!analysis.loading && !analysis.error && analysis.rawResult && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openFullAnalysis(analysis.symbol, analysis.rawResult)}
                  >
                    Full Analysis
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Re-run Button after analysis */}
        {overallScore && !isRunningDeepResearch && (
          <div className="mt-6 text-center">
            <Button
              variant="outline"
              onClick={runDeepResearchAll}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Re-run Deep Research
            </Button>
          </div>
        )}

        {/* Back Button */}
        <div className="mt-8 text-center">
          <Button variant="outline" onClick={() => navigate('/my-portfolio')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Portfolio
          </Button>
        </div>
      </main>
    </div>
  );
}
