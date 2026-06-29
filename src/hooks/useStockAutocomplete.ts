import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/apiAdapter";
import { useStockTickers } from "./useStockTickers";

export interface AutocompleteStock {
    symbol: string;
    name: string;
    sector: string;
    risk_level: number;
    quality_score: number | null;
    style?: string | null;
    pe_ratio?: number | null;
    roe?: number | null;
    dividend_yield_value?: number | null;
}

// Local results render synchronously on every keystroke; the backend call
// runs in the background with a hard timeout so a slow/dead API never blocks
// what the user sees.
const BACKEND_TIMEOUT_MS = 4000;

export function useStockAutocomplete(query: string, _delay = 0) {
    const { searchTickers, isLoading: tickersLoading } = useStockTickers();
    const [enhanced, setEnhanced] = useState<AutocompleteStock[] | null>(null);
    const reqId = useRef(0);

    // Synchronous local result — no debounce, no await, instant feedback.
    const localResults: AutocompleteStock[] = query
        ? searchTickers(query, 15).map((l) => ({
            symbol: l.ticker,
            name: l.title,
            sector: 'Unknown',
            risk_level: 0,
            quality_score: null,
        }))
        : [];

    useEffect(() => {
        // Reset prior enhancement when the query changes
        setEnhanced(null);
        if (!query) return;

        const myReq = ++reqId.current;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), BACKEND_TIMEOUT_MS);

        // Best-effort: enrich with backend metadata. We don't await it for first paint
        // and we never block the dropdown on it.
        (async () => {
            try {
                const backendData = await api.get<AutocompleteStock[]>(
                    `/search-stocks?q=${encodeURIComponent(query)}`
                );
                if (myReq !== reqId.current) return; // stale
                setEnhanced(backendData || []);
            } catch {
                // Silent — local results are already displayed
            } finally {
                clearTimeout(timer);
            }
        })();

        return () => {
            ctrl.abort();
            clearTimeout(timer);
        };
    }, [query]);

    // Merge backend enrichment with local once it arrives, deduping by symbol
    // and keeping the backend-enriched entry first when both have it.
    const results: AutocompleteStock[] = (() => {
        if (!enhanced || enhanced.length === 0) return localResults;
        const seen = new Set(enhanced.map((s) => s.symbol));
        const merged = [...enhanced];
        for (const local of localResults) {
            if (!seen.has(local.symbol)) {
                merged.push(local);
                seen.add(local.symbol);
            }
        }
        return merged.slice(0, 15);
    })();

    return { results, isLoading: tickersLoading && results.length === 0 };
}
