import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, AlertTriangle } from 'lucide-react';

const DISCLAIMER_ACKNOWLEDGED_KEY = 'claritx_disclaimer_acknowledged';

// Context to trigger disclaimer from anywhere in the app
interface DisclaimerContextType {
  showDisclaimer: (onConfirm: () => void) => void;
  isAcknowledged: boolean;
  requireDisclaimer: (action: () => void) => void;
}

const DisclaimerContext = createContext<DisclaimerContextType | null>(null);

export function useDisclaimer() {
  const context = useContext(DisclaimerContext);
  if (!context) {
    throw new Error('useDisclaimer must be used within DisclaimerProvider');
  }
  return context;
}

export function DisclaimerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isSessionAcknowledged, setIsSessionAcknowledged] = useState(() => {
    return localStorage.getItem(DISCLAIMER_ACKNOWLEDGED_KEY) === 'true';
  });

  const showDisclaimer = useCallback((onConfirm: () => void) => {
    setPendingAction(() => onConfirm);
    setOpen(true);
    setAcknowledged(false);
  }, []);

  const requireDisclaimer = useCallback((action: () => void) => {
    if (isSessionAcknowledged) {
      action();
    } else {
      showDisclaimer(action);
    }
  }, [isSessionAcknowledged, showDisclaimer]);

  const handleConfirm = () => {
    localStorage.setItem(DISCLAIMER_ACKNOWLEDGED_KEY, 'true');
    setIsSessionAcknowledged(true);
    setOpen(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleCancel = () => {
    setOpen(false);
    setPendingAction(null);
    setAcknowledged(false);
  };

  return (
    <DisclaimerContext.Provider value={{ showDisclaimer, isAcknowledged: isSessionAcknowledged, requireDisclaimer }}>
      {children}
      <Dialog open={open} onOpenChange={handleCancel}>
        <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <Shield className="w-8 h-8 text-primary" />
              <span>Important Notice</span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Disclaimer acknowledgment required before proceeding
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm">
                ClaritX is an <strong>educational analytics platform</strong>. 
                The information provided is for research purposes only and does not constitute 
                investment advice or a recommendation to buy or sell securities.
              </p>
            </div>

            <p className="text-muted-foreground text-sm leading-relaxed">
              All investment decisions are your own responsibility. You should conduct 
              your own research and consult with a qualified financial advisor before 
              making any investment decisions. Past performance and simulated results 
              do not guarantee future outcomes.
            </p>

            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-border">
              <Checkbox
                id="disclaimer-acknowledge"
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked as boolean)}
              />
              <label
                htmlFor="disclaimer-acknowledge"
                className="text-sm font-medium leading-tight cursor-pointer"
              >
                I understand that ClaritX provides educational content only, not personalized 
                investment advice, and I accept full responsibility for my own investment decisions.
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={!acknowledged}>
                I Understand, Continue
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              By continuing, you agree to our{' '}
              <a href="/terms" className="text-primary hover:underline" target="_blank">Terms of Service</a>,{' '}
              <a href="/privacy" className="text-primary hover:underline" target="_blank">Privacy Policy</a>, and{' '}
              <a href="/disclaimer" className="text-primary hover:underline" target="_blank">Disclaimer</a>.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </DisclaimerContext.Provider>
  );
}

// Legacy component - now empty, disclaimer only shows on action
export function OnboardingDisclaimer() {
  return null;
}

// Helper to check if disclaimer was acknowledged
export function isDisclaimerAcknowledged(): boolean {
  return localStorage.getItem(DISCLAIMER_ACKNOWLEDGED_KEY) === 'true';
}

// Helper to reset disclaimer (for testing)
export function resetDisclaimer(): void {
  localStorage.removeItem(DISCLAIMER_ACKNOWLEDGED_KEY);
}
