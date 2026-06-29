import { useState } from "react";
import { Info, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface StockInfo {
  description: string;
  industry: string;
  ceo?: string;
  employees?: number;
  website?: string;
}

interface StockInfoPopoverProps {
  symbol: string;
  isLoading: boolean;
  info?: StockInfo;
}

export function StockInfoPopover({ symbol, isLoading, info }: StockInfoPopoverProps) {
  const [expanded, setExpanded] = useState(false);

  // Get first ~25 words for brief intro
  const getBriefDescription = (text: string) => {
    const words = text.split(' ');
    if (words.length <= 25) return text;
    return words.slice(0, 25).join(' ') + '...';
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!info) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        Click to load company information.
      </p>
    );
  }

  const briefDesc = getBriefDescription(info.description);
  const hasMore = info.description.length > briefDesc.length || info.ceo || info.employees || info.website;

  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-foreground flex items-center gap-2">
        <Info className="h-4 w-4 text-primary" />
        About {symbol}
      </h4>
      
      {info.industry && (
        <Badge variant="outline" className="text-xs">
          {info.industry}
        </Badge>
      )}
      
      <p className="text-xs text-muted-foreground leading-relaxed">
        {expanded ? info.description : briefDesc}
      </p>

      {hasMore && (
        <>
          {expanded && (
            <div className="space-y-1.5 pt-1">
              {info.ceo && (
                <p className="text-xs text-muted-foreground">
                  <strong>CEO:</strong> {info.ceo}
                </p>
              )}
              {info.employees && (
                <p className="text-xs text-muted-foreground">
                  <strong>Employees:</strong> {info.employees.toLocaleString()}
                </p>
              )}
              {info.website && (
                <a 
                  href={info.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline block"
                >
                  Visit Website →
                </a>
              )}
            </div>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-primary hover:text-primary/80 w-full justify-center gap-1"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                Read more
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
