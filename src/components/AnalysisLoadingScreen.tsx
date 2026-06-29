import { useState, useEffect } from "react";
import {
  Newspaper,
  TrendingUp,
  Flame,
  DollarSign,
  Users,
  Scale,
  UserCheck,
  Coins,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface AnalysisLoadingScreenProps {
  symbol: string;
}

const analysisSteps = [
  { id: "news", label: "News", fullLabel: "News Analysis", icon: Newspaper, color: "bg-blue-500" },
  { id: "technical", label: "Technical", fullLabel: "Technical Indicators", icon: TrendingUp, color: "bg-emerald-500" },
  { id: "social", label: "Social", fullLabel: "Social Sentiment", icon: Flame, color: "bg-orange-500" },
  { id: "financials", label: "Financials", fullLabel: "Financial Metrics", icon: DollarSign, color: "bg-violet-500" },
  { id: "analyst", label: "Analysts", fullLabel: "Analyst Ratings", icon: Users, color: "bg-pink-500" },
  { id: "relative", label: "Market", fullLabel: "Market Comparison", icon: Scale, color: "bg-indigo-500" },
  { id: "insider", label: "Insider", fullLabel: "Insider Activity", icon: UserCheck, color: "bg-teal-500" },
  { id: "dividend", label: "Dividend", fullLabel: "Dividend Health", icon: Coins, color: "bg-amber-500" },
  { id: "verdict", label: "AI Verdict", fullLabel: "AI Verdict", icon: Sparkles, color: "bg-primary", isMain: true },
];

const STEP_DURATION = 7700; // Each step takes 7.7 seconds — matches real analysis time (~70s)

export function AnalysisLoadingScreen({ symbol, onRetry }: AnalysisLoadingScreenProps & { onRetry?: () => void }) {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [overallProgress, setOverallProgress] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [showSlowMessage, setShowSlowMessage] = useState(false);

  useEffect(() => {
    let currentStep = 0;
    let stepProgressInterval: NodeJS.Timeout;
    
    const startStepProgress = () => {
      setStepProgress(0);
      stepProgressInterval = setInterval(() => {
        setStepProgress(prev => {
          if (prev >= 100) return 100;
          return prev + 1; // Slower fill for longer steps
        });
      }, STEP_DURATION / 100);
    };
    
    const advanceStep = () => {
      if (currentStep < analysisSteps.length) {
        setActiveStep(currentStep);
        startStepProgress();
        
        setTimeout(() => {
          clearInterval(stepProgressInterval);
          setStepProgress(100);
          setCompletedSteps(current => new Set([...current, currentStep]));
          currentStep++;
          
          if (currentStep < analysisSteps.length) {
            setTimeout(() => {
              setActiveStep(currentStep);
              advanceStep();
            }, 200); // Small pause between steps
          } else {
            setActiveStep(-1);
          }
        }, STEP_DURATION);
      }
    };
    
    advanceStep();
    
    // Logarithmic overall progress — fast at start, gradually slows near 95%
    let elapsed = 0;
    const totalDuration = analysisSteps.length * STEP_DURATION;
    const progressInterval = setInterval(() => {
      elapsed += 100;
      const t = Math.min(elapsed / totalDuration, 1);
      // Ease-out curve: fast early, slow at end — never jumps to 95% early
      const eased = 1 - Math.pow(1 - t, 2.5);
      setOverallProgress(eased * 95);
    }, 100);

    const slowTimer = setTimeout(() => setShowSlowMessage(true), 60_000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepProgressInterval);
      clearTimeout(slowTimer);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center overflow-y-auto">
      {/* Subtle animated background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Soft gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
        
        {/* Floating orbs - subtle and slow */}
        <div 
          className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 rounded-full blur-3xl opacity-30"
          style={{
            background: 'radial-gradient(circle, hsl(var(--primary) / 0.3), transparent)',
            animation: 'float 14s ease-in-out infinite'
          }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 rounded-full blur-3xl opacity-30"
          style={{
            background: 'radial-gradient(circle, hsl(var(--secondary) / 0.3), transparent)',
            animation: 'float 14s ease-in-out infinite 7s'
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-2xl px-4 py-8">
        {/* Symbol display */}
        <div className="text-center mb-8 sm:mb-12">
          {/* Pulsing ring around symbol */}
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" style={{ animationDuration: '4s' }} />
            <div className="relative px-6 sm:px-8 py-3 sm:py-4 rounded-full bg-card border border-border shadow-lg">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-primary animate-ping opacity-75" style={{ animationDuration: '3s' }} />
                </div>
                <span className="text-sm sm:text-base text-muted-foreground font-medium">Analyzing</span>
                <span className="text-2xl sm:text-3xl font-display font-black text-foreground">{symbol}</span>
              </div>
            </div>
          </div>
          
          <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-foreground mb-2">
            Deep Analysis in Progress
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Scanning 9 research dimensions
          </p>
        </div>

        {/* Analysis steps - cleaner list design */}
        <div className="space-y-2 sm:space-y-3 mb-8 sm:mb-10">
          {analysisSteps.map((step, index) => {
            const isActive = activeStep === index;
            const isCompleted = completedSteps.has(index);
            const isPending = !isActive && !isCompleted;
            const Icon = step.icon;

            return (
              <div
                key={step.id}
                className={`
                  relative rounded-xl sm:rounded-2xl border transition-all duration-700 ease-out overflow-hidden
                  ${isActive 
                    ? 'bg-card border-primary/50 shadow-lg shadow-primary/10' 
                    : isCompleted 
                      ? 'bg-card/50 border-success/30' 
                      : 'bg-muted/20 border-border/30 opacity-50'
                  }
                  ${step.isMain ? 'mt-4 sm:mt-6' : ''}
                `}
              >
                {/* Progress bar background for active step */}
                {isActive && (
                  <div 
                    className="absolute inset-0 bg-primary/10 transition-all duration-300 ease-out"
                    style={{ width: `${stepProgress}%` }}
                  />
                )}
                
                <div className="relative flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
                  {/* Icon */}
                  <div className={`
                    w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all duration-500
                    ${isCompleted 
                      ? 'bg-success/20' 
                      : isActive 
                        ? `${step.color} shadow-lg`
                        : 'bg-muted/50'
                    }
                  `}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
                    ) : (
                      <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
                    )}
                  </div>
                  
                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm sm:text-base transition-colors duration-300 ${
                      isCompleted ? 'text-success' : isActive ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      <span className="sm:hidden">{step.label}</span>
                      <span className="hidden sm:inline">{step.fullLabel}</span>
                    </p>
                    {isActive && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        Processing...
                      </p>
                    )}
                  </div>

                  {/* Status indicator */}
                  <div className="flex-shrink-0">
                    {isCompleted && (
                      <span className="text-xs sm:text-sm font-medium text-success">Done</span>
                    )}
                    {isActive && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.2s' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.4s' }} />
                      </div>
                    )}
                    {isPending && (
                      <span className="text-xs text-muted-foreground/50">Pending</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Overall progress bar */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground font-medium">Overall Progress</span>
            <span className="text-foreground font-bold">{Math.round(overallProgress)}%</span>
          </div>
          <div className="h-2.5 sm:h-3 bg-muted/30 rounded-full overflow-hidden border border-border/30">
            <div 
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500 ease-out relative"
              style={{ width: `${overallProgress}%` }}
            >
              {/* Subtle shine effect */}
              <div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                style={{
                  animation: 'shimmer 4s ease-in-out infinite'
                }}
              />
            </div>
          </div>
        </div>

        {/* Tip */}
        <div className="mt-6 sm:mt-8 text-center">
          <p className="text-xs sm:text-sm text-muted-foreground">
            <span className="inline-block mr-1">💡</span>
            Analyzing real-time data from multiple sources
          </p>
        </div>

        {/* Slow connection message — appears after 60s */}
        {showSlowMessage && (
          <div className="mt-4 mx-auto max-w-md rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-center">
            <p className="text-sm font-medium text-amber-400 mb-1">
              ⏳ Taking longer than usual…
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The analysis is still running in the background. You can wait a bit more, or come back in a few minutes — the results will be ready.
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 text-xs text-primary underline hover:no-underline"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.05); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
