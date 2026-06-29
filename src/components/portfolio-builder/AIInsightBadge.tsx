import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AIAnalysisData {
  overallScore?: number;
  summary?: string;
  perspectives?: Record<string, { score: number; summary: string }>;
  risks?: string[];
}

interface AIInsightBadgeProps {
  aiAnalysis: string | AIAnalysisData | null | undefined;
  symbol: string;
  showDeepResearch?: boolean;
  compact?: boolean;
}

/**
 * Parses AI analysis data (can be JSON string or object)
 */
function parseAIAnalysis(data: string | AIAnalysisData | null | undefined): AIAnalysisData | null {
  if (!data) return null;

  if (typeof data === 'object') return data;

  if (typeof data === 'string') {
    // Try to parse as JSON
    try {
      return JSON.parse(data);
    } catch {
      // If it's a plain string summary, wrap it
      return { summary: data };
    }
  }

  return null;
}

/**
 * Gets a color class based on score
 */
function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-500';
}

function getScoreBgColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 50) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

function getScoreIcon(score: number) {
  if (score >= 70) return <TrendingUp className="h-3 w-3" />;
  if (score >= 50) return <Minus className="h-3 w-3" />;
  return <TrendingDown className="h-3 w-3" />;
}

/**
 * Displays a brief AI insight with option to deep research
 */
export function AIInsightBadge({
  aiAnalysis,
  symbol,
  showDeepResearch = true,
  compact = false
}: AIInsightBadgeProps) {
  const navigate = useNavigate();
  const data = parseAIAnalysis(aiAnalysis);

  if (!data) return null;

  const score = data.overallScore;
  const summary = data.summary;

  // For simple string analysis (old format)
  if (!score && summary && summary.length < 100) {
    return (
      <span className="text-xs text-primary flex items-center gap-1">
        <Sparkles className="h-3 w-3" />
        {summary}
      </span>
    );
  }

  // For full analysis object
  if (score !== undefined) {
    if (compact) {
      return (
        <Badge
          variant="outline"
          className={`text-xs gap-1 cursor-pointer hover:opacity-80 transition-opacity ${getScoreBgColor(score)} ${getScoreColor(score)}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/ai-stock-analysis?symbol=${symbol}`);
          }}
        >
          {getScoreIcon(score)}
          AI: {(score / 10).toFixed(1)}/10
        </Badge>
      );
    }

    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-xs gap-1 ${getScoreBgColor(score)} ${getScoreColor(score)}`}
          >
            {getScoreIcon(score)}
            AI Score: {(score / 10).toFixed(1)}/10
          </Badge>
        </div>

        {summary && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {summary}
          </p>
        )}

        {showDeepResearch && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-primary hover:text-primary/80 p-0 justify-start"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/ai-stock-analysis?symbol=${symbol}`);
            }}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Deep Research
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>
    );
  }

  // Fallback for summary only
  if (summary) {
    const shortSummary = summary.length > 80 ? summary.slice(0, 80) + '...' : summary;
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground line-clamp-2">
          <Sparkles className="h-3 w-3 inline mr-1 text-primary" />
          {shortSummary}
        </span>
        {showDeepResearch && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-xs text-primary hover:text-primary/80 p-0 justify-start"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/ai-stock-analysis?symbol=${symbol}`);
            }}
          >
            Deep Research →
          </Button>
        )}
      </div>
    );
  }

  return null;
}

/**
 * Extracts a brief one-liner from AI analysis for whyFits field
 */
export function extractBriefInsight(aiAnalysis: string | AIAnalysisData | null | undefined): string {
  const data = parseAIAnalysis(aiAnalysis);
  if (!data) return '';

  if (data.summary) {
    // Truncate to ~60 chars
    return data.summary.length > 60 ? data.summary.slice(0, 60) + '...' : data.summary;
  }

  if (data.overallScore) {
    return `AI Score: ${(data.overallScore / 10).toFixed(1)}/10`;
  }

  return '';
}
