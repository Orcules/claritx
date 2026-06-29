import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api_adapter";
import { Play, Square, RefreshCw, CheckCircle2, XCircle, Clock, Zap, Database, Brain, TrendingUp, AlertTriangle, Beaker, Loader2, FileText, Trash2, RotateCcw, Filter, Eye, EyeOff } from "lucide-react";
import { isDisclaimerAcknowledged, resetDisclaimer } from "@/components/OnboardingDisclaimer";
import { toast } from "sonner";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'warning' | 'step';
  message: string;
  details?: string;
}

interface BackgroundJobStatus {
  status: 'idle' | 'running' | 'stopping' | 'completed' | 'error';
  current_progress: string | null;
  total_to_process: number | null;
  processed_count: number;
  success_count: number;
  error_count: number;
  started_at: string | null;
  updated_at?: string | null;
  last_chain_at?: string | null;
}

interface GlobalStats {
  totalTickers: number;
  withAIScore: number;
  stocksCount: number;
  etfsCount: number;
  fundsCount: number;
  rateLimitedCount: number;
  insufficientDataCount: number;
  unscoredEligible: number;
}

interface TickerResult {
  symbol: string;
  name: string;
  instrument_type: string;
  current_price: number | null;
  market_cap_value: number | null;
  quality_score: number | null;
  ai_quality_score: number | null;
  ai_score: number | null;
  research_summary: string | null;
  ai_quality_flags: any;
  fmp_data: any;
  volatility: string | null;
  risk_level: number | null;
  sector: string | null;
  industry: string | null;
  beta: number | null;
  pe_ratio: number | null;
  roe: number | null;
  debt_to_equity: number | null;
  dividend_yield_value: number | null;
  is_investable: boolean | null;
  final_ai_score: number | null;
  fmp_data_json: any;
  gemini_prompt_sent: string | null;
  gemini_response_raw: string | null;
  matching_combinations_json: string[] | null;
}

type AssetTypeFilter = 'all' | 'stock' | 'etf' | 'fund';

const ITEMS_PER_PAGE = 50;
const STATS_REFRESH_INTERVAL_MS = 15000; // Refresh stats every 15 seconds when running

export default function RankingDashboard() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [globalRankJob, setGlobalRankJob] = useState<BackgroundJobStatus | null>(null);
  const [rankedResults, setRankedResults] = useState<TickerResult[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [assetTypeFilter, setAssetTypeFilter] = useState<AssetTypeFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalTickers: 0,
    withAIScore: 0,
    stocksCount: 0,
    etfsCount: 0,
    fundsCount: 0,
    rateLimitedCount: 0,
    insufficientDataCount: 0,
    unscoredEligible: 0
  });
  const [isPopulatingCombinations, setIsPopulatingCombinations] = useState(false);
  const [isTaggingSymbols, setIsTaggingSymbols] = useState(false);
  const [combinationStats, setCombinationStats] = useState<{
    totalCombinations: number;
    populatedCount: number;
    lastPopulated: string | null;
    taggedSymbolsCount: number;
  } | null>(null);
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(() => isDisclaimerAcknowledged());
  const logsEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const jobChannelRef = useRef<any>(null);
  const globalRankJobRef = useRef<BackgroundJobStatus | null>(null);

  // In-flight guards to prevent overlapping fetches
  const statsFetchInFlightRef = useRef(false);
  const resultsFetchInFlightRef = useRef(false);
  const jobFetchInFlightRef = useRef(false);

  // Auto-refresh timer for stats when job is running
  const statsIntervalRef = useRef<number | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    globalRankJobRef.current = globalRankJob;
  }, [globalRankJob]);

  // Test symbols for Test Sample mode
  const TEST_SYMBOLS = ['AAPL', 'NVDA', 'SPY', 'QQQ'];

  // Fetch job status with retries and maybeSingle
  const fetchJobStatus = useCallback(async () => {
    if (jobFetchInFlightRef.current) return;
    jobFetchInFlightRef.current = true;

    try {
      const data = await api.get<any>('/batch/status');
      if (data && data.job) {
        setGlobalRankJob({
          status: data.job.status,
          processed_count: data.job.item_count || 0,
          total_to_process: data.job.target_count || 0,
          started_at: data.job.created_at,
          current_progress: `${Math.round(((data.job.item_count || 0) / (data.job.target_count || 1)) * 100)}%`
        } as any);
      }
      if (data && data.stats) {
        setGlobalStats(data.stats);
      }
    } catch (error) {
      console.warn('[RankingDashboard] fetchJobStatus error:', error);
    } finally {
      jobFetchInFlightRef.current = false;
    }
  }, []);

  // Fetch global stats using optimized queries with reduced load
  // Fetch global stats using the optimized RPC function
  const fetchGlobalStats = useCallback(async () => {
    // This is now bundled into fetchJobStatus/batch-status in the new API
    // but we can keep it for explicit refreshes if needed.
    await fetchJobStatus();
  }, [fetchJobStatus]);

  const fetchRankedResults = useCallback(async (
    testOnly = false,
    filterType: AssetTypeFilter = assetTypeFilter,
    page = currentPage
  ) => {
    if (resultsFetchInFlightRef.current) return;
    resultsFetchInFlightRef.current = true;
    setIsLoadingResults(true);

    try {
      const data = await api.get<any[]>(`/rankings/full-list?asset_type=${filterType}&limit=${ITEMS_PER_PAGE * 2}`);
      if (data) {
        // Transform backend fields to match frontend TickerResult interface
        const formatted: TickerResult[] = data.map(item => ({
          symbol: item.symbol,
          name: item.name,
          instrument_type: item.instrument_type,
          final_ai_score: item.final_ai_score,
          ai_score: item.final_ai_score,
          sector: item.sector,
          current_price: item.current_price,
          market_cap_value: item.market_cap_value,
          pe_ratio: item.pe_ratio,
          roe: item.roe,
          research_summary: item.research_summary,
          ai_quality_flags: item.ai_quality_flags,
          volatility: item.volatility
        } as any));

        setRankedResults(formatted);
        setTotalCount(data.length > 100 ? 500 : data.length); // Simplified total count
      }
    } catch (err) {
      console.error('Error fetching rankings:', err);
    } finally {
      resultsFetchInFlightRef.current = false;
      setIsLoadingResults(false);
    }
  }, [assetTypeFilter, currentPage]);

  // Re-fetch when filter or page changes
  useEffect(() => {
    fetchRankedResults(false, assetTypeFilter, currentPage);
  }, [assetTypeFilter, currentPage]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [assetTypeFilter]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Fetch existing logs on page load
  const fetchExistingLogs = async () => {
    try {
      const data = await api.get<any[]>('/batch/logs?limit=50');
      if (data && data.length > 0) {
        const existingLogs: LogEntry[] = data.map(log => ({
          id: log.id,
          timestamp: new Date(log.timestamp),
          type: log.type as any,
          message: log.message,
          details: log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)) : undefined
        }));
        setLogs(existingLogs);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  // Detect stale/stuck jobs
  const isJobStale = (job: BackgroundJobStatus | null): boolean => {
    if (!job || job.status !== 'running') return false;
    const jobData = job as any;
    const updatedAt = jobData.updated_at ? new Date(jobData.updated_at) : null;
    if (!updatedAt) return false;
    const staleThresholdMs = 2 * 60 * 1000;
    const now = new Date();
    return now.getTime() - updatedAt.getTime() > staleThresholdMs;
  };

  const resumeStuckJob = async () => {
    addLog('warning', '🔄 Job appears stuck - auto-resuming...');
    toast.info('Job appears stuck, auto-resuming...');

    try {
      await api.post('/batch/control', { mode: 'force-stop' });

      setTimeout(async () => {
        await api.post('/batch/control', {
          mode: 'continue',
          batchSize: 5,
          parallelBatches: 3
        });
        addLog('success', '🚀 Job resumed');
        fetchJobStatus();
      }, 2000);
    } catch (err: any) {
      addLog('error', `Failed to resume: ${err.message}`);
    }
  };

  // Setup auto-refresh timer when job is running
  useEffect(() => {
    if (globalRankJob?.status === 'running') {
      // Start auto-refresh interval
      if (!statsIntervalRef.current) {
        statsIntervalRef.current = window.setInterval(() => {
          fetchGlobalStats();
          fetchJobStatus();
        }, STATS_REFRESH_INTERVAL_MS);
      }
    } else {
      // Clear interval when not running
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
    }

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
    };
  }, [globalRankJob?.status, fetchGlobalStats, fetchJobStatus]);

  useEffect(() => {
    // Initial data fetch
    fetchGlobalStats();
    fetchJobStatus();
    fetchExistingLogs();
    fetchRankedResults();

    // Polling handles updates now instead of Realtime
    const staleCheckInterval = setInterval(() => {
      if (globalRankJob?.status === 'running') {
        fetchExistingLogs();
      }
      if (isJobStale(globalRankJobRef.current)) {
        resumeStuckJob();
      }
    }, 30000);

    return () => {
      clearInterval(staleCheckInterval);
    };
  }, [fetchGlobalStats, fetchJobStatus, fetchRankedResults, globalRankJob?.status]);

  const addLog = (type: LogEntry['type'], message: string, details?: string) => {
    setLogs(prev => {
      const newLogs = [...prev, {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type,
        message,
        details
      }];
      // Keep only last 100 logs to prevent memory issues
      return newLogs.slice(-100);
    });
  };

  const startGlobalRanking = async (mode: 'everything' | 'test-sample' | 'continue') => {
    const modeLabels: Record<string, string> = {
      everything: 'FULL SCAN (rate-limit safe)',
      'test-sample': 'TEST SAMPLE',
      continue: 'CONTINUE (rate-limit safe)',
    };
    addLog('info', `🚀 Starting ranking in ${modeLabels[mode]} mode...`);

    try {
      const response = await api.post<any>('/batch/control', {
        mode,
        batchSize: 5,
        parallelBatches: mode === 'test-sample' ? 1 : 3
      });

      if (response && response.success) {
        toast.success(`Ranking started in ${modeLabels[mode]} mode`);
        addLog('success', `🚀 Ranking started: ${response.message}`);
        fetchJobStatus();
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
      addLog('error', `Error starting ranking: ${err.message}`);
    }
  };

  const stopGlobalRanking = async () => {
    addLog('warning', '⏹️ Sending stop signal...');

    try {
      const response = await api.post<any>('/batch/control', { mode: 'stop' });
      if (response && response.success) {
        toast.success('Stop signal sent');
        addLog('warning', '⏹️ Stop signal sent');
        fetchJobStatus();
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const forceStopGlobalRanking = async () => {
    addLog('warning', '🧯 Force-stopping (resetting job status)...');

    try {
      const response = await api.post<any>('/batch/control', { mode: 'force-stop' });
      if (response && response.success) {
        toast.success('Job force-stopped');
        addLog('warning', '🧯 Job force-stopped');
        fetchJobStatus();
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const resetList = async () => {
    if (!confirm('Are you sure you want to reset all AI scores? This cannot be undone.')) {
      return;
    }

    addLog('warning', '🗑️ Resetting all AI scores...');

    try {
      const response = await api.post<any>('/batch/control', { mode: 'reset' });
      if (response && response.success) {
        toast.success('Reset started');
        setRankedResults([]);
        fetchJobStatus();
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
      addLog('error', `Error resetting: ${err.message}`);
    }
  };

  const retryRateLimited = async () => {
    if (globalStats.rateLimitedCount === 0) {
      toast.info('No rate-limited assets to retry');
      return;
    }

    addLog('info', '🔄 Clearing rate-limit flags...');

    try {
      const result = await api.post<any>('/batch/control', { mode: 'retry-limited' });

      if (result && result.success) {
        toast.success(result.message);
        addLog('success', `🔄 ${result.message}`);
        fetchJobStatus();
        addLog('info', '💡 Run "Continue" mode to re-process these assets');
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
      addLog('error', `Error retrying: ${err.message}`);
    }
  };

  const handleManualRefresh = () => {
    fetchGlobalStats();
    fetchRankedResults();
    fetchJobStatus();
    fetchCombinationStats();
  };

  // Fetch combination stats
  const fetchCombinationStats = useCallback(async () => {
    try {
      const result = await api.post<any>('/batch/control', { mode: 'get-combination-stats' });
      if (result) {
        setCombinationStats({
          totalCombinations: result.totalCombinations ?? 720,
          populatedCount: result.populatedCount ?? 0,
          lastPopulated: result.lastPopulated ?? null,
          taggedSymbolsCount: result.taggedSymbolsCount ?? 0,
        });
      }
    } catch (err) {
      console.error('Error fetching combination stats:', err);
    }
  }, []);

  // Populate combinations with AI-ranked symbols
  const populateCombinations = async (forceRecompute = false) => {
    setIsPopulatingCombinations(true);
    addLog('info', '🔄 Starting questionnaire combination population...');

    try {
      const result = await api.post<any>('/batch/control', {
        mode: 'populate-combinations',
        forceRecompute
      });

      if (result && result.success) {
        toast.success(result.message);
        addLog('success', `✅ ${result.message}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
      addLog('error', `Error populating combinations: ${err.message}`);
    } finally {
      setIsPopulatingCombinations(false);
    }
  };

  // Tag symbols with their matching combinations
  const tagSymbolsWithCombinations = async () => {
    setIsTaggingSymbols(true);
    addLog('info', '🏷️ Starting symbol tagging with combinations...');

    try {
      const result = await api.post<any>('/batch/control', { mode: 'tag-symbols' });

      if (result && result.success) {
        if (result.completed) {
          toast.success("All symbols tagged successfully!");
          addLog('success', `✅ Completed tagging ${result.totalTagged} symbols`);
        } else {
          toast.success(`Tagging started: ${result.progress}`);
          addLog('step', `🔄 Tagging in progress: ${result.progress} - background process running...`);
          // Keep polling until complete
          pollTaggingStatus();
        }
        fetchCombinationStats();
      } else {
        toast.error(`Failed: ${result.error}`);
        addLog('error', `Failed to tag symbols: ${result.error}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
      addLog('error', `Error tagging: ${err.message}`);
    } finally {
      setIsTaggingSymbols(false);
    }
  };

  // Poll tagging status until complete
  const pollTaggingStatus = useCallback(async () => {
    const checkStatus = async () => {
      const result = await api.post<any>('/batch/control', { mode: 'get-combination-stats' }).catch(() => null);
      const totalSymbols = globalStats?.totalTickers || 13000;
      const tagged = result?.taggedSymbolsCount || 0;

      setCombinationStats(prev => prev ? { ...prev, taggedSymbolsCount: tagged } : prev);

      if (tagged >= totalSymbols * 0.95) { // 95% threshold
        setIsTaggingSymbols(false);
        addLog('success', `✅ Tagging complete: ${tagged} symbols tagged`);
        toast.success(`Tagging complete: ${tagged} symbols!`);
        fetchCombinationStats();
      } else {
        // Continue polling every 3 seconds
        setTimeout(checkStatus, 3000);
      }
    };

    setTimeout(checkStatus, 3000);
  }, [globalStats, fetchCombinationStats]);

  const isRunning = globalRankJob?.status === 'running' || globalRankJob?.status === 'stopping';

  const isStale = isJobStale(globalRankJob);

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'step': return <Zap className="h-4 w-4 text-blue-500" />;
      default: return <Database className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const progressPercent = globalStats.totalTickers > 0
    ? Math.round((globalStats.withAIScore / globalStats.totalTickers) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">AI Ranking Dashboard</h1>
            <p className="text-muted-foreground">
              Research and score all assets using Gemini AI (0-10000 unified score)
            </p>
          </div>
          <Button
            variant={disclaimerAcknowledged ? "outline" : "default"}
            size="sm"
            onClick={() => {
              resetDisclaimer();
              setDisclaimerAcknowledged(false);
              toast.success('Disclaimer reset - users will need to acknowledge again');
            }}
            className="flex items-center gap-2 self-start sm:self-auto"
          >
            {disclaimerAcknowledged ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {disclaimerAcknowledged ? 'Reset Disclaimer' : 'Not Acknowledged'}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Total Tickers</p>
              <p className="text-xl font-bold">
                {isLoadingStats && globalStats.totalTickers === 0 ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  globalStats.totalTickers.toLocaleString()
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">AI Scored</p>
              <p className="text-xl font-bold text-primary">
                {isLoadingStats && globalStats.withAIScore === 0 ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  globalStats.withAIScore.toLocaleString()
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Stocks</p>
              <p className="text-xl font-bold">{globalStats.stocksCount.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">ETFs</p>
              <p className="text-xl font-bold">{globalStats.etfsCount.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Funds</p>
              <p className="text-xl font-bold">{globalStats.fundsCount.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Crypto</p>
              <p className="text-xl font-bold">{globalStats.cryptoCount.toLocaleString()}</p>
            </CardContent>
          </Card>

          {/* Continue-eligible count */}
          {globalStats.unscoredEligible > 0 && (
            <Card className="border-blue-500/50">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" />
                  Continue Eligible
                </p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{globalStats.unscoredEligible.toLocaleString()}</p>
              </CardContent>
            </Card>
          )}

          {/* Rate Limited */}
          {globalStats.rateLimitedCount > 0 && (
            <Card className="border-yellow-500/50">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-yellow-600 dark:text-yellow-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Rate Limited
                </p>
                <p className="text-xl font-bold text-yellow-600 dark:text-yellow-500">{globalStats.rateLimitedCount.toLocaleString()}</p>
              </CardContent>
            </Card>
          )}

          {/* Insufficient Data */}
          {globalStats.insufficientDataCount > 0 && (
            <Card className="border-orange-500/50">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-orange-600 dark:text-orange-500 flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  No Data
                </p>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-500">{globalStats.insufficientDataCount.toLocaleString()}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Rate Limited Warning */}
        {globalStats.rateLimitedCount > 0 && (
          <Card className="mb-4 border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
            <CardContent className="pt-4 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-400">
                    {globalStats.rateLimitedCount} assets hit FMP API rate limits
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-500">
                    These were skipped to save AI credits. Click "Retry Rate-Limited" when FMP limits reset.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={retryRateLimited}
                disabled={isRunning}
                className="border-yellow-500 text-yellow-700 hover:bg-yellow-100 dark:text-yellow-400 dark:hover:bg-yellow-950"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Rate-Limited
              </Button>
            </CardContent>
          </Card>
        )}


        {/* Progress Bar */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-muted-foreground">AI Scoring Progress</span>
              <span className="text-sm font-medium">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{globalStats.withAIScore.toLocaleString()} AI scored</span>
              <span>{(globalStats.totalTickers - globalStats.withAIScore).toLocaleString()} remaining</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Ranking Control Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Ranking Control
              </CardTitle>
              <CardDescription>
                Run AI research on all assets or test with a sample first
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Action Buttons */}
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {!isRunning ? (
                    <>
                      <Button
                        onClick={() => startGlobalRanking('everything')}
                        size="lg"
                      >
                        <Play className="h-5 w-5 mr-2" />
                        Full Scan
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => startGlobalRanking('continue')}
                        size="lg"
                      >
                        <RotateCcw className="h-5 w-5 mr-2" />
                        Continue
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => startGlobalRanking('test-sample')}
                        size="lg"
                      >
                        <Beaker className="h-5 w-5 mr-2" />
                        Test Sample
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={resetList}
                        size="lg"
                      >
                        <Trash2 className="h-5 w-5 mr-2" />
                        Reset
                      </Button>
                    </>
                  ) : (
                    <div className="flex flex-1 gap-2">
                      <Button
                        variant="destructive"
                        onClick={stopGlobalRanking}
                        className="flex-1"
                        size="lg"
                        disabled={globalRankJob?.status === 'stopping'}
                      >
                        <Square className="h-5 w-5 mr-2" />
                        {globalRankJob?.status === 'stopping' ? 'Stopping…' : 'Stop'}
                      </Button>

                      {globalRankJob?.status === 'stopping' && (
                        <Button
                          variant="outline"
                          onClick={forceStopGlobalRanking}
                          className="flex-1"
                          size="lg"
                        >
                          <AlertTriangle className="h-5 w-5 mr-2" />
                          Force Stop
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  <strong>Full Scan</strong> = Start fresh, AI research on all stocks, ETFs, top 100 crypto<br />
                  <strong>Continue</strong> = Resume scanning only assets without AI scores<br />
                  <strong>Test Sample</strong> = Test on 6 tickers (AAPL, NVDA, SPY, QQQ, BTCUSD, ETHUSD)<br />
                  <strong>Reset</strong> = Clear all AI scores from database
                </p>
              </div>

              {/* Stuck Job Warning */}
              {isStale && (
                <div className="p-4 rounded-lg border-2 border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      <div>
                        <span className="font-medium text-orange-800 dark:text-orange-400">
                          Job appears stuck (no update for 2+ minutes)
                        </span>
                        <p className="text-sm text-orange-600 dark:text-orange-500">
                          Edge function may have timed out. Auto-resume will trigger in ~30 seconds.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={resumeStuckJob}
                      className="border-orange-500 text-orange-700 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-950"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Resume Now
                    </Button>
                  </div>
                </div>
              )}

              {/* Job Status */}
              {isRunning && globalRankJob && !isStale && (
                <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="font-medium">
                        {globalRankJob.status === 'stopping' ? 'Stopping...' : 'Running'}
                      </span>
                    </div>
                    <Badge variant="default" className="animate-pulse">Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{globalRankJob.current_progress}</p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span>Processed: {globalRankJob.processed_count}</span>
                    <span className="text-green-500">Success: {globalRankJob.success_count}</span>
                    <span className="text-red-500">Errors: {globalRankJob.error_count}</span>
                  </div>
                  {/* Chain Status */}
                  {globalRankJob.last_chain_at && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t text-xs text-muted-foreground">
                      <span>🔗 Last chain: {formatTime(new Date(globalRankJob.last_chain_at))}</span>
                      <span className="text-green-500">• Cloud-persistent</span>
                    </div>
                  )}
                </div>
              )}

              {/* Refresh Button */}
              <div className="pt-4 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleManualRefresh}
                  disabled={isLoadingStats || isLoadingResults}
                >
                  {(isLoadingStats || isLoadingResults) ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh Stats & Results
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Questionnaire Combinations Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Questionnaire Combinations
              </CardTitle>
              <CardDescription>
                Pre-compute AI-ranked symbols for all 2,160 questionnaire combinations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats */}
              {combinationStats && (
                <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-xs text-muted-foreground">Populated</p>
                    <p className="text-xl font-bold">
                      {combinationStats.populatedCount} / {combinationStats.totalCombinations}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tagged Symbols</p>
                    <p className="text-xl font-bold">
                      {combinationStats.taggedSymbolsCount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last Updated</p>
                    <p className="text-sm font-medium">
                      {combinationStats.lastPopulated
                        ? new Date(combinationStats.lastPopulated).toLocaleString()
                        : 'Never'}
                    </p>
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              {combinationStats && (
                <div>
                  <div className="flex justify-between mb-1 text-xs">
                    <span>Population Progress</span>
                    <span>{Math.round((combinationStats.populatedCount / combinationStats.totalCombinations) * 100)}%</span>
                  </div>
                  <Progress
                    value={(combinationStats.populatedCount / combinationStats.totalCombinations) * 100}
                    className="h-2"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => populateCombinations(false)}
                  disabled={isPopulatingCombinations || isTaggingSymbols || isRunning || globalStats.withAIScore === 0}
                  size="lg"
                >
                  {isPopulatingCombinations ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-5 w-5 mr-2" />
                  )}
                  Populate Combinations
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => populateCombinations(true)}
                  disabled={isPopulatingCombinations || isTaggingSymbols || isRunning || globalStats.withAIScore === 0}
                  size="lg"
                >
                  <RefreshCw className="h-5 w-5 mr-2" />
                  Force Recompute
                </Button>
                <Button
                  variant="outline"
                  onClick={tagSymbolsWithCombinations}
                  disabled={isTaggingSymbols || isPopulatingCombinations || isRunning || (combinationStats?.populatedCount || 0) === 0}
                  size="lg"
                >
                  {isTaggingSymbols ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Database className="h-5 w-5 mr-2" />
                  )}
                  Tag Symbols
                </Button>
              </div>

              {/* Warning if no AI scores */}
              {globalStats.withAIScore === 0 && (
                <div className="p-3 rounded-lg border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm text-yellow-800 dark:text-yellow-400">
                      Run AI Ranking first to populate combinations with scored symbols
                    </span>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                <strong>Populate</strong> = Update combinations that are stale (&gt;24h old)<br />
                <strong>Force Recompute</strong> = Recalculate ALL combinations with latest AI scores<br />
                <strong>Tag Symbols</strong> = Update each symbol's matching_combinations_json for fast reverse lookup<br />
                Uses precise matching + fallback to nearest alternatives when no exact matches exist
              </p>
            </CardContent>
          </Card>

          {/* Live Logs */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Live Logs
              </CardTitle>
              <CardDescription>Real-time process output</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              <ScrollArea className="h-[400px] rounded border p-4 bg-muted/30">
                {logs.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No logs yet. Start a process to see output.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {logs.map(log => (
                      <div key={log.id} className="flex gap-2 text-sm">
                        <span className="text-muted-foreground text-xs min-w-[70px]">
                          {formatTime(log.timestamp)}
                        </span>
                        {getLogIcon(log.type)}
                        <div className="flex-1">
                          <span className={
                            log.type === 'error' ? 'text-red-500' :
                              log.type === 'success' ? 'text-green-500' :
                                log.type === 'warning' ? 'text-yellow-500' :
                                  ''
                          }>
                            {log.message}
                          </span>
                          {log.details && (
                            <div className="text-xs text-muted-foreground mt-1 font-mono">
                              {log.details}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </ScrollArea>
              {logs.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setLogs([])}
                >
                  Clear Logs
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Ranked Results
                </CardTitle>
                <CardDescription>
                  Assets scored by Gemini AI (sorted by Research Score)
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {/* Asset Type Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={assetTypeFilter} onValueChange={(v) => setAssetTypeFilter(v as AssetTypeFilter)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Assets</SelectItem>
                      <SelectItem value="stock">Stocks</SelectItem>
                      <SelectItem value="etf">ETFs</SelectItem>
                      <SelectItem value="fund">Mutual Funds</SelectItem>
                      <SelectItem value="crypto">Crypto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => fetchRankedResults()}
                  disabled={isLoadingResults}
                  variant="outline"
                >
                  {isLoadingResults ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {rankedResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                {isLoadingResults ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <p>Loading ranked results...</p>
                  </div>
                ) : (
                  <p>No ranked results yet. Run "Test Sample" or "Run Everything" to score assets.</p>
                )}
              </div>
            ) : (
              <>
                <Accordion type="multiple" className="space-y-4">
                  {rankedResults.map((ticker, index) => {
                    const researchScore = ticker.final_ai_score ?? ticker.ai_score ?? 0;
                    const dataCoverage = ticker.ai_quality_flags?.data_coverage?.score as number | undefined;
                    const missingFields = ticker.ai_quality_flags?.data_coverage?.missing as string[] | undefined;
                    const globalRank = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;

                    return (
                      <AccordionItem
                        key={ticker.symbol}
                        value={ticker.symbol}
                        className="border rounded-lg px-4"
                      >
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-4 w-full">
                            <Badge variant={researchScore >= 7000 ? "default" : researchScore >= 4000 ? "secondary" : "destructive"}>
                              #{globalRank}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-lg">{ticker.symbol}</span>
                              <Badge variant="outline" className="text-xs">
                                {ticker.instrument_type?.toUpperCase() || 'UNKNOWN'}
                              </Badge>
                            </div>
                            <div className="flex-1 text-left">
                              <span className="text-sm text-muted-foreground truncate">{ticker.name}</span>
                            </div>
                            <div className="flex items-center gap-6 text-sm">
                              <div className="text-right">
                                <span className="text-muted-foreground">Score:</span>
                                <span className="ml-2 font-bold text-lg">{researchScore}/10000</span>
                              </div>
                              <div className="text-right hidden md:block">
                                <span className="text-muted-foreground">Data:</span>
                                <span className="ml-1 font-medium">{typeof dataCoverage === 'number' ? `${dataCoverage}%` : 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left Column: FMP Data */}
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-2">
                                  <Database className="h-4 w-4" />
                                  Market Data
                                </h4>
                                <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div><span className="text-muted-foreground">Price:</span> <span className="font-medium">${ticker.current_price?.toLocaleString() || 'N/A'}</span></div>
                                    <div><span className="text-muted-foreground">Market Cap:</span> <span className="font-medium">${ticker.market_cap_value ? (ticker.market_cap_value / 1e9).toFixed(2) + 'B' : 'N/A'}</span></div>
                                    <div><span className="text-muted-foreground">Sector:</span> <span className="font-medium">{ticker.sector || 'N/A'}</span></div>
                                    <div><span className="text-muted-foreground">Industry:</span> <span className="font-medium">{ticker.industry || 'N/A'}</span></div>
                                    <div><span className="text-muted-foreground">Beta:</span> <span className="font-medium">{ticker.beta?.toFixed(2) || 'N/A'}</span></div>
                                    <div><span className="text-muted-foreground">P/E Ratio:</span> <span className="font-medium">{ticker.pe_ratio?.toFixed(2) || 'N/A'}</span></div>
                                    <div><span className="text-muted-foreground">ROE:</span> <span className="font-medium">{ticker.roe ? ticker.roe.toFixed(2) + '%' : 'N/A'}</span></div>
                                    <div><span className="text-muted-foreground">Debt/Equity:</span> <span className="font-medium">{ticker.debt_to_equity?.toFixed(2) || 'N/A'}</span></div>
                                    <div><span className="text-muted-foreground">Dividend:</span> <span className="font-medium">{ticker.dividend_yield_value ? ticker.dividend_yield_value.toFixed(2) + '%' : 'N/A'}</span></div>
                                    <div><span className="text-muted-foreground">Volatility:</span> <span className="font-medium">{ticker.volatility || 'N/A'}</span></div>
                                    <div><span className="text-muted-foreground">Risk Level:</span> <span className="font-medium">{ticker.risk_level || 'N/A'}/5</span></div>
                                    <div><span className="text-muted-foreground">Investable:</span> <span className={`font-medium ${ticker.is_investable ? 'text-green-500' : 'text-red-500'}`}>{ticker.is_investable ? 'Yes' : 'No'}</span></div>
                                  </div>

                                  <div className="pt-2 border-t">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                      <span>Data Coverage</span>
                                      <span>{typeof dataCoverage === 'number' ? `${dataCoverage}%` : 'N/A'}</span>
                                    </div>
                                    <Progress value={typeof dataCoverage === 'number' ? dataCoverage : 0} className="h-2" />
                                    {missingFields?.length ? (
                                      <p className="text-xs text-muted-foreground mt-2">
                                        Missing: <span className="font-medium">{missingFields.join(', ')}</span>
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              {/* Raw FMP Data */}
                              {(ticker.fmp_data_json || ticker.fmp_data) && (
                                <div>
                                  <h4 className="font-semibold text-sm text-muted-foreground mb-2">Raw FMP Response</h4>
                                  <ScrollArea className="h-48 bg-muted/30 rounded-lg p-3">
                                    <pre className="text-xs whitespace-pre-wrap break-all">
                                      {JSON.stringify(ticker.fmp_data_json || ticker.fmp_data, null, 2)}
                                    </pre>
                                  </ScrollArea>
                                </div>
                              )}
                            </div>

                            {/* Right Column: AI Analysis */}
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-2">
                                  <Brain className="h-4 w-4" />
                                  Gemini AI Research
                                </h4>
                                <div className="bg-muted/50 rounded-lg p-4">
                                  <div className="mb-3">
                                    <span className="text-sm text-muted-foreground">AI Research Score: </span>
                                    <span className="font-bold text-lg">{researchScore}/10000</span>
                                  </div>

                                  {ticker.ai_quality_flags && (
                                    <div className="space-y-2 mb-3">
                                      {ticker.ai_quality_flags.positive?.length > 0 && (
                                        <div>
                                          <span className="text-xs text-muted-foreground">Positives: </span>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {ticker.ai_quality_flags.positive.map((p: string, i: number) => (
                                              <Badge key={i} variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">{p}</Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {ticker.ai_quality_flags.negative?.length > 0 && (
                                        <div>
                                          <span className="text-xs text-muted-foreground">Concerns: </span>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {ticker.ai_quality_flags.negative.map((n: string, i: number) => (
                                              <Badge key={i} variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/30">{n}</Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {ticker.ai_quality_flags.risk_level && (
                                        <div>
                                          <span className="text-xs text-muted-foreground">Risk Level: </span>
                                          <Badge variant="outline" className="text-xs">{ticker.ai_quality_flags.risk_level}/5</Badge>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {ticker.research_summary && (
                                    <div>
                                      <span className="text-xs text-muted-foreground">Research Summary:</span>
                                      <p className="text-sm mt-1">{ticker.research_summary}</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Gemini Prompt */}
                              {ticker.gemini_prompt_sent && (
                                <div>
                                  <h4 className="font-semibold text-sm text-muted-foreground mb-2">Gemini Prompt Sent</h4>
                                  <ScrollArea className="h-32 bg-muted/30 rounded-lg p-3">
                                    <pre className="text-xs whitespace-pre-wrap break-all">
                                      {ticker.gemini_prompt_sent}
                                    </pre>
                                  </ScrollArea>
                                </div>
                              )}

                              {/* Gemini Response */}
                              {ticker.gemini_response_raw && (
                                <div>
                                  <h4 className="font-semibold text-sm text-muted-foreground mb-2">Gemini Raw Response</h4>
                                  <ScrollArea className="h-48 bg-muted/30 rounded-lg p-3">
                                    <pre className="text-xs whitespace-pre-wrap break-all">
                                      {ticker.gemini_response_raw}
                                    </pre>
                                  </ScrollArea>
                                </div>
                              )}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount.toLocaleString()} results
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1 || isLoadingResults}
                      >
                        First
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1 || isLoadingResults}
                      >
                        Previous
                      </Button>
                      <span className="text-sm px-3">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || isLoadingResults}
                      >
                        Next
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages || isLoadingResults}
                      >
                        Last
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
