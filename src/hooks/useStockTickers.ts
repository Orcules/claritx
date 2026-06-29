import { useEffect, useState, useCallback, useSyncExternalStore } from 'react';

export interface LocalTicker {
    ticker: string;
    title: string;
}

interface RawData {
    [key: string]: {
        ticker: string;
        title: string;
    };
}

// ── Module-level singleton: fetch and parse the 2.6 MB ticker JSON once,
// then share it across every hook consumer. Without this, each StockSearch /
// PortfolioManager mount re-fetches and re-parses the whole list.
let tickersCache: LocalTicker[] | null = null;
let inflight: Promise<LocalTicker[]> | null = null;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
}

function getSnapshot(): LocalTicker[] | null {
    return tickersCache;
}

async function loadTickers(): Promise<LocalTicker[]> {
    if (tickersCache) return tickersCache;
    if (inflight) return inflight;
    inflight = (async () => {
        try {
            const response = await fetch('/data/company_tickers.json');
            if (!response.ok) throw new Error('Failed to fetch ticker data');
            const data: RawData = await response.json();
            tickersCache = Object.values(data);
            listeners.forEach((cb) => cb());
            return tickersCache;
        } finally {
            inflight = null;
        }
    })();
    return inflight;
}

function scoreTickers(tickers: LocalTicker[], query: string, limit: number): LocalTicker[] {
    if (!query || query.length < 1 || tickers.length === 0) return [];

    const upperQuery = query.toUpperCase();
    const wordRegex = new RegExp(`\\b${upperQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);

    // Score each ticker so the most relevant matches surface first. Lower = better.
    const scored: { t: LocalTicker; score: number }[] = [];
    for (const t of tickers) {
        const ticker = t.ticker.toUpperCase();
        const title = t.title.toUpperCase();
        let score = -1;

        if (ticker === upperQuery) score = 0;                          // exact symbol
        else if (title === upperQuery) score = 1;                      // exact name
        else if (ticker.startsWith(upperQuery)) score = 2;             // symbol prefix
        else if (title.startsWith(upperQuery + ' ')) score = 3;        // name starts with whole word
        else if (title.startsWith(upperQuery)) score = 4;              // name prefix
        else if (wordRegex.test(title)) score = 5;                     // name contains query as whole word
        else if (title.includes(upperQuery)) score = 6;                // name substring
        else if (ticker.includes(upperQuery)) score = 7;               // symbol substring
        else continue;

        scored.push({ t, score });
    }

    // Within same score, shorter titles win (canonical names tend to be shorter).
    scored.sort((a, b) => a.score - b.score || a.t.title.length - b.t.title.length);

    return scored.slice(0, limit).map((s) => s.t);
}

export function useStockTickers() {
    const tickers = useSyncExternalStore(subscribe, getSnapshot, getSnapshot) ?? [];
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (tickersCache) return;
        loadTickers().catch((err) => {
            console.error('Error loading tickers:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        });
    }, []);

    const searchTickers = useCallback(
        (query: string, limit = 10) => scoreTickers(tickers, query, limit),
        [tickers]
    );

    return {
        tickers,
        isLoading: !tickersCache,
        error,
        searchTickers,
    };
}
