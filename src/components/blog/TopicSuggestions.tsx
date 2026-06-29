import { useState } from "react";
import { Check, ChevronsUpDown, Lightbulb, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TopicSuggestion {
  value: string;
  label: string;
  category: string;
}

const topicSuggestions: TopicSuggestion[] = [
  // AI & Stock Analysis
  { value: "how-ai-analyzes-stocks-better-than-humans", label: "How AI Analyzes Stocks Better Than Humans", category: "AI Analysis" },
  { value: "multi-angle-stock-analysis-explained", label: "Multi-Angle Deep Research Explained", category: "AI Analysis" },
  { value: "ai-vs-traditional-stock-research", label: "AI vs Traditional Stock Research Methods", category: "AI Analysis" },
  { value: "understanding-ai-stock-ratings", label: "Understanding AI Stock Ratings", category: "AI Analysis" },
  
  // Investing Basics
  { value: "best-stocks-for-beginners-2026", label: "Best Stocks for Beginners in 2026", category: "Beginner Guides" },
  { value: "how-to-start-investing-with-100-dollars", label: "How to Start Investing with $100", category: "Beginner Guides" },
  { value: "understanding-stock-market-basics", label: "Understanding Stock Market Basics", category: "Beginner Guides" },
  { value: "common-investing-mistakes-to-avoid", label: "Common Investing Mistakes to Avoid", category: "Beginner Guides" },
  
  // Dividend Investing
  { value: "best-dividend-stocks-2026", label: "Best Dividend Stocks for 2026", category: "Dividends" },
  { value: "building-passive-income-with-dividends", label: "Building Passive Income with Dividends", category: "Dividends" },
  { value: "dividend-aristocrats-explained", label: "Dividend Aristocrats Explained", category: "Dividends" },
  { value: "high-yield-vs-dividend-growth", label: "High Yield vs Dividend Growth Stocks", category: "Dividends" },
  
  // ETFs & Index Funds
  { value: "best-etfs-for-long-term-growth", label: "Best ETFs for Long-Term Growth", category: "ETFs" },
  { value: "spy-vs-voo-vs-ivv-comparison", label: "SPY vs VOO vs IVV: Which S&P 500 ETF?", category: "ETFs" },
  { value: "sector-etfs-explained", label: "Sector ETFs Explained", category: "ETFs" },
  { value: "international-etfs-for-diversification", label: "International ETFs for Diversification", category: "ETFs" },
  
  // Market Analysis
  { value: "stock-market-outlook-2026", label: "Stock Market Outlook for 2026", category: "Market Analysis" },
  { value: "understanding-market-cycles", label: "Understanding Market Cycles", category: "Market Analysis" },
  { value: "recession-proof-investing-strategies", label: "Recession-Proof Investing Strategies", category: "Market Analysis" },
  { value: "tech-stocks-analysis-2026", label: "Tech Stocks Analysis 2026", category: "Market Analysis" },
  
  // Risk & Portfolio
  { value: "portfolio-diversification-strategies", label: "Portfolio Diversification Strategies", category: "Portfolio" },
  { value: "understanding-risk-tolerance", label: "Understanding Your Risk Tolerance", category: "Portfolio" },
  { value: "rebalancing-your-portfolio", label: "When and How to Rebalance Your Portfolio", category: "Portfolio" },
  { value: "building-a-retirement-portfolio", label: "Building a Retirement Portfolio", category: "Portfolio" },
  
  // Technical Analysis
  { value: "reading-stock-charts-for-beginners", label: "Reading Stock Charts for Beginners", category: "Technical" },
  { value: "understanding-pe-ratio", label: "Understanding P/E Ratio", category: "Technical" },
  { value: "key-financial-ratios-explained", label: "Key Financial Ratios Explained", category: "Technical" },
  { value: "fundamental-vs-technical-analysis", label: "Fundamental vs Technical Analysis", category: "Technical" },
];

interface TopicSuggestionsProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TopicSuggestions({ value, onChange, placeholder = "Select or type a topic..." }: TopicSuggestionsProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"suggestions" | "freeform">("suggestions");

  const groupedSuggestions = topicSuggestions.reduce((acc, topic) => {
    if (!acc[topic.category]) {
      acc[topic.category] = [];
    }
    acc[topic.category].push(topic);
    return acc;
  }, {} as Record<string, TopicSuggestion[]>);

  if (mode === "freeform") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode("suggestions")}
            className="text-xs text-muted-foreground hover:text-primary"
          >
            <Lightbulb className="h-3 w-3 mr-1" />
            Switch to Suggestions
          </Button>
        </div>
        <Textarea
          placeholder="Write your own topic or detailed instructions for the blog post..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[120px] bg-background text-sm"
        />
        <p className="text-xs text-muted-foreground">
          💡 Tip: Be specific about what you want to cover. The AI will research current data and position ClaritX as the solution.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMode("freeform")}
          className="text-xs text-muted-foreground hover:text-primary"
        >
          <PenLine className="h-3 w-3 mr-1" />
          Switch to Free-Form
        </Button>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-background text-left font-normal h-auto min-h-10 py-2"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || placeholder}
            </span>
            <div className="flex items-center gap-1 ml-2 shrink-0">
              <Lightbulb className="h-4 w-4 text-primary opacity-70" />
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Search topics or type your own..." 
              value={value}
              onValueChange={onChange}
            />
            <CommandList>
              <CommandEmpty>
                <div className="py-3 text-center text-sm">
                  <p className="text-muted-foreground">No matching topics.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Press Enter to use your custom topic
                  </p>
                </div>
              </CommandEmpty>
              {Object.entries(groupedSuggestions).map(([category, topics]) => (
                <CommandGroup key={category} heading={category}>
                  {topics.map((topic) => (
                    <CommandItem
                      key={topic.value}
                      value={topic.label}
                      onSelect={() => {
                        onChange(topic.label);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === topic.label ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{topic.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
