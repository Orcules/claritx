import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, PieChart, Shield, Search, Brain, Zap, Target, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const loadingSteps = [
  { icon: Search, label: 'Scanning investment universe...', color: 'text-blue-500' },
  { icon: Brain, label: 'Analyzing AI research scores...', color: 'text-purple-500' },
  { icon: Shield, label: 'Matching to your risk profile...', color: 'text-emerald-500' },
  { icon: PieChart, label: 'Optimizing sector allocation...', color: 'text-amber-500' },
  { icon: Target, label: 'Selecting best candidates...', color: 'text-cyan-500' },
  { icon: BarChart3, label: 'Calculating portfolio weights...', color: 'text-pink-500' },
  { icon: Sparkles, label: 'Finalizing your portfolio...', color: 'text-primary' },
];

export function PortfolioGenerationLoader() {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % loadingSteps.length);
    }, 1200);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 2, 95));
    }, 100);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, []);

  const CurrentIcon = loadingSteps[currentStep].icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md">
      {/* Animated background effects */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(var(--primary)_/_0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--primary)_/_0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      <div className="relative max-w-md w-full mx-4 text-center space-y-8">
        {/* Main animated icon */}
        <div className="relative mx-auto w-32 h-32">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-spin" style={{ animationDuration: '8s' }} />
          <div className="absolute inset-2 rounded-full border-4 border-secondary/30 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }} />
          <div className="absolute inset-4 rounded-full border-4 border-primary/40 animate-spin" style={{ animationDuration: '4s' }} />
          
          {/* Center icon */}
          <div className="absolute inset-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-2xl shadow-primary/40">
            <CurrentIcon className={cn("h-10 w-10 text-primary-foreground animate-pulse")} />
          </div>

          {/* Orbiting dots */}
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-full bg-primary animate-spin"
              style={{
                top: '50%',
                left: '50%',
                transformOrigin: '0 0',
                animation: `spin ${3 + i * 0.5}s linear infinite`,
                transform: `rotate(${i * 60}deg) translateX(60px)`,
              }}
            />
          ))}
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground flex items-center justify-center gap-3">
            <Sparkles className="h-6 w-6 text-primary animate-pulse" />
            Building Your Portfolio
            <Sparkles className="h-6 w-6 text-primary animate-pulse" />
          </h2>
          <p className="text-muted-foreground">AI-powered selection in progress</p>
        </div>

        {/* Current step */}
        <div className="h-8">
          <p className={cn(
            "text-lg font-medium animate-fade-in",
            loadingSteps[currentStep].color
          )} key={currentStep}>
            {loadingSteps[currentStep].label}
          </p>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-secondary to-primary rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_1.5s_infinite]" 
            style={{ transform: 'translateX(-100%)', animation: 'shimmer 1.5s infinite' }} 
          />
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2">
          {loadingSteps.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <div
                key={index}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                  index === currentStep 
                    ? "bg-primary text-primary-foreground scale-125 shadow-lg shadow-primary/30" 
                    : index < currentStep 
                      ? "bg-primary/30 text-primary"
                      : "bg-muted text-muted-foreground"
                )}
              >
                <StepIcon className="h-4 w-4" />
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
