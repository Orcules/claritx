import { Coins } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useUserCredits } from "@/hooks/useUserCredits";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function CreditBalance() {
  const { credits, remaining, loading, isTrialing } = useUserCredits();
  const location = useLocation();

  if (loading || !credits) return null;

  const isPro = credits.subscription_tier === 'pro';
  const isOut = remaining <= 0;
  const returnPath = (location.pathname + location.search).replace(/^\//, '');
  const pricingUrl = `/pricing?return=${encodeURIComponent(returnPath)}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link to={pricingUrl}>
          <Badge
            variant={isOut ? "destructive" : "outline"}
            className={`gap-1.5 cursor-pointer transition-colors hover:bg-accent ${
              isOut
                ? 'animate-pulse'
                : isPro
                  ? 'border-yellow-500/50 text-yellow-600 dark:text-yellow-400'
                  : 'border-border text-muted-foreground'
            }`}
          >
            <Coins className="h-3.5 w-3.5" />
            <span className="font-semibold">{remaining}</span>
            {isPro && !isOut && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-500">
                {isTrialing ? 'Trial' : 'Pro'}
              </span>
            )}
            {isOut && (
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Add Credits
              </span>
            )}
          </Badge>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        {isOut ? (
          <>
            <p className="font-semibold text-destructive">No credits remaining</p>
            <p className="text-xs text-muted-foreground">Click to add credits or upgrade</p>
          </>
        ) : (
          <>
            <p>{remaining} credits remaining</p>
            <p className="text-xs text-muted-foreground">
              {isTrialing ? 'Pro trial' : isPro ? 'Pro plan' : 'Free plan'} · Click to manage
            </p>
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
