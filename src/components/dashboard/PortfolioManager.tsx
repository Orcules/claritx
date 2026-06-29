import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/apiAdapter";
import { toast } from "sonner";
import { Plus, Trash2, Upload, DollarSign, TrendingUp } from "lucide-react";
import { useStockAutocomplete } from "@/hooks/useStockAutocomplete";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useEtoroCompliance } from "@/hooks/useEtoroCompliance";
import { SubtleGalaxyButton } from "@/components/etoro/SubtleGalaxyButton";
import { ExternalLink } from "lucide-react";

// Helper for AI score colors
const getScoreColor = (score: number) => {
  if (score >= 80) return "bg-success/20 text-success border-success/30";
  if (score >= 60) return "bg-blue-500/20 text-blue-500 border-blue-500/30";
  if (score >= 40) return "bg-warning/20 text-warning border-warning/30";
  return "bg-destructive/20 text-destructive border-destructive/30";
};

interface Holding {
  id: string;
  symbol: string;
  shares: number;
  average_cost: number | null;
  aiScore?: number;
  aiRating?: string;
}

interface Portfolio {
  id: string;
  name: string;
  cash_balance: number;
  holdings: Holding[];
}

interface PortfolioManagerProps {
  clientId: string;
}

export function PortfolioManager({ clientId }: PortfolioManagerProps) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [newSymbol, setNewSymbol] = useState("");
  const [newShares, setNewShares] = useState("");
  const [newCost, setNewCost] = useState("");
  const [cashBalance, setCashBalance] = useState("");
  const [loading, setLoading] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { results: suggestions, isLoading: searchLoading } = useStockAutocomplete(newSymbol);

  const { isRestricted, riskWarning, tier, isLoading: etoroLoading } = useEtoroCompliance();
  const showEtoro = !etoroLoading && !isRestricted && !!riskWarning;

  useEffect(() => {
    fetchPortfolio();
  }, [clientId]);

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
  }, [newSymbol]);

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
      const stock = suggestions[selectedIndex];
      setNewSymbol(stock.symbol);
      setSelectedStock(stock);
      setShowSuggestions(false);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (stock: any) => {
    setNewSymbol(stock.symbol);
    setSelectedStock(stock);
    setShowSuggestions(false);
  };

  const fetchPortfolio = async () => {
    try {
      const data = await api.get<any>(`/clients/${clientId}/portfolio`);

      if (data) {
        setPortfolio(data);
        setCashBalance(data.cash_balance?.toString() || "0");
      }
    } catch (error) {
      toast.error("Error loading portfolio");
    } finally {
      setLoading(false);
    }
  };

  const addHolding = async () => {
    if (!portfolio || !newSymbol || !newShares) {
      toast.error("Please enter symbol and number of shares");
      return;
    }

    try {
      await api.post(`/clients/${clientId}/portfolio/holdings`, {
        symbol: newSymbol.toUpperCase(),
        shares: parseFloat(newShares),
        average_cost: newCost ? parseFloat(newCost) : null,
      });

      toast.success("Stock added!");
      setNewSymbol("");
      setNewShares("");
      setNewCost("");
      fetchPortfolio();
    } catch (error: any) {
      toast.error("Error adding stock");
    }
  };

  const removeHolding = async (holdingId: string) => {
    try {
      await api.delete(`/clients/${clientId}/portfolio/holdings/${holdingId}`);
      toast.success("Stock removed");
      fetchPortfolio();
    } catch (error) {
      toast.error("Error removing stock");
    }
  };

  const updateCashBalance = async () => {
    if (!portfolio) return;

    try {
      await api.patch(`/clients/${clientId}/portfolio`, {
        cash_balance: parseFloat(cashBalance) || 0
      });
      toast.success("Cash balance updated");
    } catch (error) {
      toast.error("Error updating balance");
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !portfolio) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter(line => line.trim());
        const holdings: { symbol: string; shares: number; average_cost?: number }[] = [];

        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(",").map(p => p.trim());
          if (parts[0] && parts[1]) {
            holdings.push({
              symbol: parts[0].toUpperCase(),
              shares: parseFloat(parts[1]) || 0,
              average_cost: parts[2] ? parseFloat(parts[2]) : undefined,
            });
          }
        }

        if (holdings.length === 0) {
          toast.error("No stocks found in file");
          return;
        }

        await api.post(`/clients/${clientId}/portfolio/holdings/batch`, {
          holdings: holdings
        });

        toast.success(`Added ${holdings.length} stocks!`);
        fetchPortfolio();
      } catch (error) {
        toast.error("Error processing file");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (loading) {
    return <div className="glass-card p-6 animate-pulse h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Cash Balance */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <DollarSign className="h-5 w-5 text-success" />
          <h3 className="text-lg font-display font-bold">Cash Balance</h3>
        </div>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Label>Amount ($)</Label>
            <Input
              type="number"
              value={cashBalance}
              onChange={(e) => setCashBalance(e.target.value)}
              placeholder="0"
            />
          </div>
          <Button onClick={updateCashBalance}>Update</Button>
        </div>
      </div>

      {/* Holdings */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-display font-bold">Holdings</h3>
          </div>
          <div>
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleCSVUpload}
              className="hidden"
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </Button>
          </div>
        </div>

        {/* Add Holding Form */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6 p-4 bg-secondary/50 rounded-lg">
          <div className="relative">
            <Label>Symbol</Label>
            <Input
              ref={inputRef}
              value={newSymbol}
              onChange={(e) => {
                setNewSymbol(e.target.value.toUpperCase());
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              placeholder="AAPL"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto"
              >
                {suggestions.map((stock, index) => (
                  <button
                    key={stock.symbol}
                    type="button"
                    onClick={() => handleSelectSuggestion(stock)}
                    className={`w-full px-3 py-2 text-left hover:bg-accent/50 flex items-center justify-between transition-colors ${index === selectedIndex ? "bg-accent/50" : ""
                      }`}
                  >
                    <span className="font-semibold text-foreground text-sm">{stock.symbol}</span>
                    <span className="text-xs text-muted-foreground truncate ml-2 max-w-[120px]">{stock.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label>Shares</Label>
            <Input
              type="number"
              value={newShares}
              onChange={(e) => setNewShares(e.target.value)}
              placeholder="100"
            />
          </div>
          <div>
            <Label>Avg Cost ($)</Label>
            <Input
              type="number"
              value={newCost}
              onChange={(e) => setNewCost(e.target.value)}
              placeholder="150"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={addHolding} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </div>

        {/* Holdings List */}
        {portfolio?.holdings && portfolio.holdings.length > 0 ? (
          <div className="space-y-2">
            <div className="grid grid-cols-5 gap-4 px-4 py-2 text-sm text-muted-foreground font-medium">
              <span>Symbol</span>
              <span>Shares</span>
              <span>Avg Cost</span>
              <span>AI Rating</span>
              <span></span>
            </div>
            {portfolio.holdings.map((holding) => (
              <div
                key={holding.id}
                className="grid grid-cols-5 gap-4 px-4 py-3 bg-secondary/30 rounded-lg items-center"
              >
                <span className="font-bold text-primary">{holding.symbol}</span>
                <span>{holding.shares.toLocaleString()}</span>
                <span>{holding.average_cost ? `$${holding.average_cost.toFixed(2)}` : "-"}</span>
                <div className="flex items-center gap-2">
                  {holding.aiRating && (
                    <Badge variant="outline" className={cn("text-[10px] font-bold", getScoreColor(holding.aiScore || 0))}>
                      {holding.aiRating}
                    </Badge>
                  )}
                  {holding.aiScore !== undefined && (
                    <span className="text-xs font-semibold text-muted-foreground">
                      {holding.aiScore.toFixed(0)}%
                    </span>
                  )}
                  {!holding.aiRating && holding.aiScore === undefined && (
                    <span className="text-xs text-muted-foreground italic">Pending...</span>
                  )}
                </div>
                <div className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeHolding(holding.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                  {showEtoro && (
                    <SubtleGalaxyButton
                      href={`https://med.etoro.com/B22260_A128601_TClick_Sstocks_discovery.aspx?URL=${encodeURIComponent(`https://www.etoro.com/markets/${holding.symbol.toLowerCase()}`)}`}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="px-2 py-1.5 rounded-md text-[10px] leading-none"
                      starCount={5}
                      style={{
                        '--etoro-bg-alpha': 0.15,
                        '--etoro-inner-alpha': 0.1,
                        '--etoro-inner-hover-alpha': 0.2,
                      } as React.CSSProperties}
                    >
                      <span className="text-primary font-medium">Trade</span>
                      <ExternalLink className="w-3 h-3 text-primary" />
                    </SubtleGalaxyButton>
                  )}
                </div>
              </div>
            ))}
            {showEtoro && riskWarning && (
              <p className="text-[10px] text-muted-foreground/70 mt-3 leading-relaxed px-4">
                {riskWarning}
              </p>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            No holdings in portfolio. Add stocks manually or upload a CSV file.
          </p>
        )}

        <p className="text-xs text-muted-foreground mt-4">
          CSV format: symbol,shares,average_cost (cost is optional)
        </p>
      </div>
    </div>
  );
}
