import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { Question, QuestionOption, InvestorProfile, FinancialWarning } from '@/types/portfolioBuilder';
import { cn } from '@/lib/utils';
import { detectIncompatibilities, CompatibilityWarning } from '@/lib/portfolioCompatibility';
import { useMemo } from 'react';

interface QuestionnaireStepProps {
  question: Question;
  currentValue: string | string[] | number | boolean | null;
  onAnswer: (value: string | string[] | number | boolean | null) => void;
  onNext: () => void;
  onBack: () => void;
  currentStep: number;
  totalSteps: number;
  canGoBack: boolean;
  canGoNext: boolean;
  profile?: Partial<InvestorProfile>;
}

export function QuestionnaireStep({
  question,
  currentValue,
  onAnswer,
  onNext,
  onBack,
  currentStep,
  totalSteps,
  canGoBack,
  canGoNext,
  profile,
}: QuestionnaireStepProps) {
  const progress = ((currentStep + 1) / totalSteps) * 100;
  
  // Calculate risk bucket for dynamic option disabling
  const estimatedRiskBucket = useMemo(() => {
    if (!profile) return 3;
    let score = 3;
    
    // Time horizon
    if (profile.timeHorizon === '0-2') score -= 1.5;
    else if (profile.timeHorizon === '10+') score += 1;
    
    // Loss tolerance
    if (profile.maxAcceptableLoss !== undefined) {
      if (profile.maxAcceptableLoss <= 5) score -= 1.5;
      else if (profile.maxAcceptableLoss >= 30) score += 1;
    }
    
    // Market reaction
    if (profile.marketDropReaction === 'sell') score -= 1;
    else if (profile.marketDropReaction === 'buy_more') score += 0.5;
    
    return Math.max(1, Math.min(5, Math.round(score)));
  }, [profile]);
  
  // Detect financial warnings (persistent throughout questionnaire)
  const financialWarnings = useMemo((): FinancialWarning[] => {
    const warnings: FinancialWarning[] = [];
    
    if (profile?.emergencyFundMonths === '0-3') {
      warnings.push({
        type: 'emergency_fund',
        severity: 'danger',
        message: '⚠️ It\'s risky to invest without a sufficient emergency fund. Only invest money you can afford to lose.',
      });
    }
    
    if (profile?.needsLiquiditySoon === true) {
      warnings.push({
        type: 'liquidity_risk',
        severity: 'warning',
        message: '⚠️ Be careful not to invest more money than you\'re willing to lose if you may need it soon.',
      });
    }
    
    return warnings;
  }, [profile]);
  
  // Detect incompatibilities based on current profile
  const warnings = useMemo(() => {
    if (!profile) return [];
    return detectIncompatibilities(profile, estimatedRiskBucket);
  }, [profile, estimatedRiskBucket]);
  
  // Filter warnings relevant to current question
  const relevantWarnings = useMemo(() => {
    return warnings.filter(w => w.affectedFields.includes(question.id));
  }, [warnings, question.id]);
  
  // Determine which options should be disabled based on previous answers
  const getOptionDisabledState = useMemo(() => {
    return (option: QuestionOption): { disabled: boolean; reason?: string } => {
      if (option.disabled) {
        return { disabled: true, reason: option.disabledText };
      }
      
      // Dynamic disabling based on risk profile
      
      if (question.id === 'preferredStyle') {
        // Conservative investors with short time horizon shouldn't pick growth
        if (option.value === 'growth' && estimatedRiskBucket <= 2 && profile?.timeHorizon === '0-2') {
          return { 
            disabled: true, 
            reason: 'Not suitable for short-term conservative investing' 
          };
        }
      }
      
      return { disabled: false };
    };
  }, [question.id, estimatedRiskBucket, profile]);
  
  const handleOptionClick = (option: QuestionOption) => {
    const disabledState = getOptionDisabledState(option);
    if (disabledState.disabled) return;
    
    if (question.type === 'multi') {
      const currentArray = Array.isArray(currentValue) ? currentValue : [];
      if (currentArray.includes(option.value)) {
        onAnswer(currentArray.filter(v => v !== option.value));
      } else {
        onAnswer([...currentArray, option.value]);
      }
    } else {
      // Parse value types
      let value: string | number | boolean | null = option.value;
      if (option.value === 'true') value = true;
      else if (option.value === 'false') value = false;
      else if (option.value === 'null') value = null;
      else if (!isNaN(Number(option.value)) && question.id === 'maxAcceptableLoss') {
        value = Number(option.value);
      }
      onAnswer(value);
    }
  };

  const isSelected = (option: QuestionOption): boolean => {
    if (question.type === 'multi') {
      return Array.isArray(currentValue) && currentValue.includes(option.value);
    }
    // Handle boolean/null comparisons
    if (currentValue === true && option.value === 'true') return true;
    if (currentValue === false && option.value === 'false') return true;
    if (currentValue === null && option.value === 'null') return true;
    if (typeof currentValue === 'number' && option.value === String(currentValue)) return true;
    return currentValue === option.value;
  };

  const hasAnswer = question.type === 'multi' 
    ? Array.isArray(currentValue) && currentValue.length > 0
    : currentValue !== undefined && currentValue !== '';

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-up">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Question {currentStep + 1} of {totalSteps}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Persistent Financial Warnings */}
      {financialWarnings.length > 0 && (
        <div className="space-y-2">
          {financialWarnings.map((warning, idx) => (
            <div 
              key={idx}
              className={cn(
                "flex items-start gap-3 p-4 rounded-lg border-2",
                warning.severity === 'danger' 
                  ? "bg-destructive/15 border-destructive text-destructive"
                  : "bg-orange-500/15 border-orange-500 text-orange-700 dark:text-orange-400"
              )}
            >
              <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{warning.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Question */}
      <div className="space-y-3">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">
          {question.question}
        </h2>
        {question.helpText && (
          <p className="text-muted-foreground text-lg">
            {question.helpText}
          </p>
        )}
        {question.type === 'multi' && (
          <p className="text-sm text-primary">Select all that apply</p>
        )}
      </div>

      {/* Compatibility Warnings */}
      {relevantWarnings.length > 0 && (
        <div className="space-y-2">
          {relevantWarnings.map((warning, idx) => (
            <div 
              key={idx}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border",
                warning.severity === 'conflict' 
                  ? "bg-destructive/10 border-destructive/30 text-destructive"
                  : "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400"
              )}
            >
              {warning.severity === 'conflict' ? (
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              ) : (
                <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="text-sm font-medium">{warning.message}</p>
                {warning.suggestion && (
                  <p className="text-xs opacity-80">💡 {warning.suggestion}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Options */}
      <div className="grid gap-3">
        {question.options.map((option) => {
          const disabledState = getOptionDisabledState(option);
          const isDisabled = disabledState.disabled;
          
          return (
            <button
              key={option.value}
              onClick={() => handleOptionClick(option)}
              disabled={isDisabled}
              className={cn(
                "w-full text-left p-4 rounded-xl border-2 transition-all duration-200",
                isDisabled
                  ? "opacity-60 cursor-not-allowed border-border bg-muted"
                  : "hover:border-primary/50 hover:bg-primary/5",
                isSelected(option) && !isDisabled
                  ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                  : !isDisabled && "border-border bg-card"
              )}
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
                  isSelected(option) && !isDisabled
                    ? "border-primary bg-primary"
                    : "border-muted-foreground"
                )}>
                  {isSelected(option) && !isDisabled && (
                    <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{option.label}</p>
                    {isDisabled && disabledState.reason && (
                      <span className="text-xs px-2 py-0.5 bg-muted-foreground/20 text-muted-foreground rounded-full">
                        {disabledState.reason}
                      </span>
                    )}
                  </div>
                  {option.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {option.description}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button
          variant="ghost"
          onClick={onBack}
          disabled={!canGoBack}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!hasAnswer && question.required}
          className="gap-2"
        >
          {currentStep === totalSteps - 1 ? 'See My Profile' : 'Next'}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Reassurance text */}
      <p className="text-center text-sm text-muted-foreground">
        You can change your answers anytime
      </p>
    </div>
  );
}
