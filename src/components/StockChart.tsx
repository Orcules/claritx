import { useEffect, useRef } from "react";

interface StockChartProps {
  symbol: string;
  isPositive: boolean;
}

let tvScriptLoadingPromise: Promise<void> | null = null;

export function StockChart({ symbol, isPositive }: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const createWidget = () => {
      // Use standard regex formatting to strip non-alphanumeric chars from ID if tradingview strictness
      const safeId = `tradingview_${symbol.replace(/[^a-zA-Z0-9]/g, '')}`;
      if (document.getElementById(safeId) && 'TradingView' in window) {
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: symbol,
          interval: "D",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          calendar: false,
          hide_volume: false,
          support_host: "https://www.tradingview.com",
          container_id: safeId,
          backgroundColor: "rgba(15, 23, 42, 1)",
          gridColor: "rgba(51, 65, 85, 0.3)",
        });
      }
    };

    if (!tvScriptLoadingPromise) {
      tvScriptLoadingPromise = new Promise((resolve) => {
        const script = document.createElement("script");
        script.id = "tradingview-widget-loading-script";
        script.src = "https://s3.tradingview.com/tv.js";
        script.type = "text/javascript";
        script.onload = () => resolve();

        document.head.appendChild(script);
      });
    }

    tvScriptLoadingPromise.then(() => {
      createWidget();
    });

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [symbol]);

  const safeId = `tradingview_${symbol.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div className="glass-card p-6 animate-fade-up animation-delay-100 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-display font-semibold">Price Chart</h3>
        <span className={`text-sm px-2 py-1 rounded ${isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {isPositive ? 'Bullish' : 'Bearish'}
        </span>
      </div>
      <div
        id={safeId}
        className="flex-1 min-h-[400px] w-full"
        ref={containerRef}
      />
    </div>
  );
}
