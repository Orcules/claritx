import { useState, useRef, useEffect, useMemo } from "react";
import { Search, TrendingUp, Loader2, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useStockAutocomplete } from "@/hooks/useStockAutocomplete";

interface StockSearchProps {
  onSearch: (symbol: string) => void;
  isLoading?: boolean;
  currentSymbol?: string;
}

const popularStocks = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "GOOGL", name: "Google" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "NVDA", name: "NVIDIA" },
];

export function StockSearch({ onSearch, isLoading, currentSymbol }: StockSearchProps) {
  const [symbol, setSymbol] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { results: suggestions, isLoading: searchLoading } = useStockAutocomplete(symbol);

  // Competitors lookup removed as it relied on static dummy data
  const competitors: any[] = [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (symbol.trim()) {
      onSearch(symbol.trim().toUpperCase());
      setShowSuggestions(false);
    }
  };

  const handleSelect = (ticker: string) => {
    setSymbol(ticker);
    setShowSuggestions(false);
    onSearch(ticker);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex].symbol);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [symbol]);

  return (
    <div className="w-full space-y-3 sm:space-y-4 animate-fade-up">
      <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground z-10" />
          <Input
            ref={inputRef}
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value.toUpperCase());
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder="Enter symbol or name"
            className="pl-9 sm:pl-12 h-11 sm:h-14 text-sm sm:text-lg bg-secondary/30 border-border/50 focus:border-primary"
          />

          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-xl z-[9999] max-h-48 sm:max-h-64 overflow-y-auto"
            >
              {suggestions.map((stock, index) => (
                <button
                  key={stock.symbol}
                  type="button"
                  onClick={() => handleSelect(stock.symbol)}
                  className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-left hover:bg-accent/50 flex items-center justify-between transition-colors ${index === selectedIndex ? "bg-accent/50" : ""
                    }`}
                >
                  <span className="font-semibold text-foreground text-sm sm:text-base">{stock.symbol}</span>
                  <span className="text-xs sm:text-sm text-muted-foreground truncate ml-3 sm:ml-4 max-w-[120px] sm:max-w-none">{stock.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button
          type="submit"
          size="lg"
          variant="glow"
          disabled={isLoading || !symbol.trim()}
          className="h-11 sm:h-14 px-3 sm:px-6"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
          ) : (
            <>
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline ml-2">Analyze</span>
            </>
          )}
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        <span className="text-xs sm:text-sm text-muted-foreground mr-1 sm:mr-2">Popular:</span>
        {popularStocks.map((stock) => (
          <Button
            key={stock.symbol}
            variant="glass"
            size="sm"
            onClick={() => {
              setSymbol(stock.symbol);
              onSearch(stock.symbol);
            }}
            className="text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
          >
            {stock.symbol}
          </Button>
        ))}
      </div>

      {competitors.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/30">
          <span className="text-sm text-muted-foreground mr-2 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-secondary" />
            Competitors:
          </span>
          {competitors.map((stock) => (
            <Button
              key={stock.symbol}
              variant="outline"
              size="sm"
              onClick={() => {
                setSymbol(stock.symbol);
                onSearch(stock.symbol);
              }}
              className="text-xs border-secondary/30 hover:bg-secondary/10 hover:border-secondary/50"
            >
              {stock.symbol}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
