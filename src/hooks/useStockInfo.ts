import { useState, useCallback } from "react";
import { api } from "@/lib/apiAdapter";
import { toast } from "sonner";

export interface StockPrice {
  symbol: string;
  price: number;
  changePercent: number;
}

export interface StockInfo {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
  marketCap: number;
  volume: number;
  avgVolume: number;
  sector: string;
  industry: string;
  description: string;
  website: string;
  exchange: string;
  ceo?: string;
  employees?: number;
}

export function useStockInfo() {
  const [infoCache, setInfoCache] = useState<Record<string, StockInfo>>({});
  const [priceCache, setPriceCache] = useState<Record<string, StockPrice>>({});
  const [loadingInfo, setLoadingInfo] = useState<Set<string>>(new Set());
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStockInfo = useCallback(async (symbol: string) => {
    if (infoCache[symbol] || loadingInfo.has(symbol)) return;

    setLoadingInfo(prev => {
      const next = new Set(prev);
      next.add(symbol);
      return next;
    });
    setError(null);

    try {
      const data = await api.get<StockInfo>(`/stock-info/${symbol}`);
      setInfoCache(prev => ({ ...prev, [symbol]: data }));
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to fetch info for ${symbol}`;
      console.error(errorMessage);
      return null;
    } finally {
      setLoadingInfo(prev => {
        const next = new Set(prev);
        next.delete(symbol);
        return next;
      });
    }
  }, [infoCache, loadingInfo]);

  const fetchPrices = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return;

    setLoadingPrices(true);
    try {
      // Expect backend to return { prices: [{ symbol, price, changePercent }] }
      const response = await api.post<{ prices: StockPrice[] }>('/stock-prices', { symbols });
      const newPrices: Record<string, StockPrice> = {};

      if (response && response.prices) {
        response.prices.forEach(p => {
          newPrices[p.symbol] = p;
        });
        setPriceCache(prev => ({ ...prev, ...newPrices }));
      }
    } catch (err) {
      console.error('Failed to fetch stock prices:', err);
    } finally {
      setLoadingPrices(false);
    }
  }, []);

  return {
    infoCache,
    priceCache,
    loadingInfo,
    loadingPrices,
    fetchStockInfo,
    fetchPrices,
    // Add compatibility fields for components using the older interface
    stockInfo: null,
    loading: loadingPrices,
    error,
  };
}
