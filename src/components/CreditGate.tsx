import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserCredits } from "@/hooks/useUserCredits";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coins, Sparkles, ArrowRight } from "lucide-react";

interface CreditGateProps {
  cost?: number;
  children: (props: { gate: () => boolean }) => React.ReactNode;
}

export function CreditGate({ cost = 1, children }: CreditGateProps) {
  const { remaining } = useUserCredits();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const gate = (): boolean => {
    if (remaining >= cost) return true;
    setOpen(true);
    return false;
  };

  return (
    <>
      {children({ gate })}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Coins className="h-5 w-5 text-destructive" />
              Out of Credits
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              This action requires {cost} credit{cost > 1 ? "s" : ""}, but you
              have {remaining} remaining. Upgrade or add credits to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-4">
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={() => {
                setOpen(false);
                const returnPath = (location.pathname + location.search).replace(/^\//, '');
                navigate(`/pricing?return=${encodeURIComponent(returnPath)}`);
              }}
            >
              <Sparkles className="h-4 w-4" />
              View Plans & Credits
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Maybe later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
