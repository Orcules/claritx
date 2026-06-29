import { useState, useCallback } from 'react';
import { api } from '@/lib/api_adapter';
import { InvestorFilters } from '@/types/investorFilters';

export interface ScreenedTicker {
  symbol: string;
  name: string;
  sector: string;
  marketCap: string;
  style: string;
  dividendYield: string;
  volatility: string;
  riskLevel: number;
  isESG: boolean;
  country: string;
  exchange: string;
  instrumentType: 'stock' | 'etf';
  ai_score?: number;
  ai_analysis?: string;
}

interface ScreenerResponse {
  tickers: ScreenedTicker[];
  fromCache: boolean;
  aiRanked: boolean;
  message?: string;
}

export function useTickerScreener() {
  const [tickers, setTickers] = useState<ScreenedTicker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const screenTickers = useCallback(async (filters: any): Promise<ScreenedTicker[]> => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.post<ScreenerResponse>('/ticker-screener', filters);
      setTickers(data.tickers || []);
      return data.tickers || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to screen tickers';
      setError(errorMessage);
      console.error('Ticker screener error:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    tickers,
    loading,
    error,
    screenTickers,
  };
}
