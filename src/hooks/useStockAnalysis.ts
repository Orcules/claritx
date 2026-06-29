import { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import { api, InsufficientCreditsError } from "@/lib/apiAdapter";
import { toast } from "@/hooks/use-toast";
import { useAuthModal } from "@/context/AuthModalContext";

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  marketCap: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  exchange?: string;
  sector?: string;
  industry?: string;
  description?: string;
  ceo?: string;
  employees?: number;
  website?: string;
  isETF?: boolean;
  beta?: number;
  // ETF-specific fields
  expenseRatio?: number;
  holdingsCount?: number;
  etfCompany?: string;
  technicals: {
    sma20: string;
    sma50: string;
    rsi: string;
    trend: "bullish" | "bearish" | "neutral";
  };
  priceHistory: Array<{ date: string; price: number }>;
}

export interface StockAnalysis {
  headlines: string;
  technicals: string;
  social_media_hype?: string;
  financial_indicators?: string;
  analyst_consensus?: string;
  relative_to_market?: string;
  insider_activity?: string;
  dividend_health?: string;
  // ETF-specific fields
  holdings?: string;
  final_verdict: string;
  comparative_analysis?: string;
  methodology?: string;
  sources_used?: string;
  ai_score?: number;
  // Raw Data (flexible)
  technicals_yahoo?: any;
  financial_ratios?: any;
  quality_flags?: {
    positives?: string[];
    concerns?: string[];
  } | null;
  analyst_ratings?: any;
  // ETF Raw Data
  etf_info?: any;
  etf_holdings?: any[];
  etf_sector_weightings?: any[];
  etf_country_weightings?: any[];
  previous_analysis?: any;
  error?: string;
  completed_at?: string;
  analyzed_at?: string;
}

export type DataAvailabilityStatus = "available" | "missing" | "limited";

export interface DataAvailabilityItem {
  status: DataAvailabilityStatus;
  /** Human-readable reason (e.g. empty response, plan limitation, provider HTTP code) */
  reason?: string;
}

export type AnalysisAvailability = Partial<
  Record<
    | "news"
    | "technical"
    | "social"
    | "financials"
    | "analyst"
    | "relative"
    | "insider"
    | "dividend"
    | "verdict"
    // ETF-specific
    | "holdings"
    | "previous",
    DataAvailabilityItem
  >
>;

export interface AnalysisResult {
  stock: StockData;
  analysis: StockAnalysis;
  availability?: AnalysisAvailability;
  isETF?: boolean;
  completed_at?: string;
}

export function useStockAnalysis(onCreditSpent?: () => void) {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { openAuthModal } = useAuthModal();
  const navigate = useNavigate();
  const location = useLocation();
  // Ref so the timeout closure can read current loading state without going stale
  const isLoadingRef = useRef(false);

  const analyzeStock = async (symbol: string, forceRefresh: boolean = false) => {
    // Show loading screen immediately so user sees what's "waiting" for them
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    // Check if user is logged in
    let isLoggedIn = false;
    try {
      const session = await fetchAuthSession();
      if (session.tokens?.idToken) {
        isLoggedIn = true;
      }
    } catch (e) {
      isLoggedIn = false;
    }

    if (!isLoggedIn) {
      const guestAnalysisCount = parseInt(localStorage.getItem('guestAnalysisCount') || '0', 10);
      if (guestAnalysisCount >= 3) {
        // Limit reached for guest
        openAuthModal({
          title: "Unsigned Limit Reached",
          description: "To continue analysing for free, please sign up.",
          onSuccess: () => analyzeStock(symbol, forceRefresh),
          onDismiss: () => { isLoadingRef.current = false; setIsLoading(false); },
        });
        return;
      }
    }

    try {
      // Pre-flight credit check removed to allow usage without credits

      // Increment guest count if not logged in
      if (!isLoggedIn) {
        const currentCount = parseInt(localStorage.getItem('guestAnalysisCount') || '0', 10);
        localStorage.setItem('guestAnalysisCount', (currentCount + 1).toString());
      }

      // Call cached endpoint (returns immediately with analysis_id or cached data)
      const initialResponse = await api.post<any>('/stock-analysis', {
        symbol: symbol.toUpperCase(),
        force_refresh: forceRefresh
      });

      console.log('[Stock Analysis] Initial response:', initialResponse);

      // If cached, return immediately
      if (initialResponse.status === 'complete' && initialResponse.from_cache) {
        console.log('[Cache Hit] Using cached analysis');
        setData(initialResponse);
        isLoadingRef.current = false;
        setIsLoading(false);
        return;
      }

      // If pending or processing, poll for completion
      if (initialResponse.status === 'pending' || initialResponse.status === 'processing') {
        const analysisId = initialResponse.analysis_id;
        console.log(`[Polling] Analysis ${analysisId} in progress...`);

        toast({
          title: "Analysis Started",
          description: "Analyzing stock... this may take up to 60 seconds",
        });

        // Poll every 15 seconds
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await api.get<any>(`/analysis-status/${analysisId}`);
            console.log('[Poll Status]', statusResponse.status);

            if (statusResponse.status === 'complete') {
              clearInterval(pollInterval);

              // Validate response structure
              if (!statusResponse.analysis || !statusResponse.analysis.stock) {
                const msg = "Received incomplete analysis data — please try again";
                setError(msg);
                isLoadingRef.current = false;
                setIsLoading(false);
                toast({ title: "Analysis Error", description: msg, variant: "destructive" });
                return;
              }

              setData({
                ...statusResponse.analysis,
                completed_at: statusResponse.completed_at
              });
              isLoadingRef.current = false;
              setIsLoading(false);
              onCreditSpent?.();
              toast({
                title: "Analysis Complete",
                description: `Successfully analyzed ${symbol}`,
              });
            } else if (statusResponse.status === 'error') {
              clearInterval(pollInterval);
              const msg = statusResponse.error || 'Analysis failed on server';
              setError(msg);
              isLoadingRef.current = false;
              setIsLoading(false);
              toast({ title: "Analysis Failed", description: msg, variant: "destructive" });
            }
            // else status is still 'processing', continue polling
          } catch (pollError) {
            // Errors inside setInterval won't propagate to the outer catch —
            // handle them explicitly here so the user always gets feedback.
            clearInterval(pollInterval);
            const msg = pollError instanceof Error ? pollError.message : "Polling error — please retry";
            if (msg !== 'AUTH_REDIRECT') {
              setError(msg);
              toast({ title: "Analysis Failed", description: msg, variant: "destructive" });
            } else {
              openAuthModal({ onSuccess: () => analyzeStock(symbol, forceRefresh) });
            }
            isLoadingRef.current = false;
            setIsLoading(false);
          }
        }, 15000); // Poll every 15 seconds

        // Timeout after 3 minutes — use ref so we read current loading state, not stale closure
        setTimeout(() => {
          clearInterval(pollInterval);
          if (isLoadingRef.current) {
            isLoadingRef.current = false;
            setIsLoading(false);
            setError("Analysis is taking longer than expected. Please try again.");
            toast({
              title: "Analysis Timeout",
              description: "Please try again.",
              variant: "destructive",
            });
          }
        }, 180000); // 3 minute timeout

        return; // Exit function, polling will handle the rest
      }

      // Shouldn't reach here, but handle unexpected responses
      throw new Error("Unexpected response from server");

    } catch (err) {
      console.error('[Stock Analysis Error]', err);
      const message = err instanceof Error ? err.message : "Failed to analyze stock";

      // Token expired mid-analysis — show modal so user can re-auth and retry
      if (message === 'AUTH_REDIRECT') {
        openAuthModal({
          onSuccess: () => analyzeStock(symbol, forceRefresh),
          onDismiss: () => { isLoadingRef.current = false; setIsLoading(false); },
        });
        return;
      }

      if (err instanceof InsufficientCreditsError) {
        setError(err.message);
        toast({ title: "Insufficient Credits", description: "Redirecting to add credits…", variant: "destructive" });
        const returnPath = (location.pathname + location.search).replace(/^\//, '');
        setTimeout(() => navigate(`/pricing?return=${encodeURIComponent(returnPath)}`), 600);
      } else if (message.includes("429")) {
        setError("Rate limit exceeded. Please try again later.");
        toast({ title: "Analysis Failed", description: message, variant: "destructive" });
      } else {
        setError(message);
        toast({ title: "Analysis Failed", description: message, variant: "destructive" });
      }
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  };

  const reset = () => {
    setData(null);
    setError(null);
    isLoadingRef.current = false;
  };

  const setPreloadedData = (result: AnalysisResult) => {
    setData(result);
    setError(null);
    isLoadingRef.current = false;
    setIsLoading(false);
  };

  return {
    analyzeStock,
    isLoading,
    data,
    error,
    reset,
    setPreloadedData,
  };
}
