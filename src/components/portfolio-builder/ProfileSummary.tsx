import { RiskProfile, InvestorProfile } from '@/types/portfolioBuilder';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  TrendingUp, 
  Sparkles, 
  AlertTriangle,
  Layers,
  ArrowRight,
  Edit
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileSummaryProps {
  profile: InvestorProfile;
  riskProfile: RiskProfile;
  onGeneratePortfolio: () => void;
  onBuildBySectors: () => void;
  onEdit: () => void;
}

export function ProfileSummary({
  profile,
  riskProfile,
  onGeneratePortfolio,
  onBuildBySectors,
  onEdit,
}: ProfileSummaryProps) {
  const riskColors: Record<number, string> = {
    1: 'from-emerald-500 to-green-500',
    2: 'from-green-500 to-teal-500',
    3: 'from-yellow-500 to-amber-500',
    4: 'from-orange-500 to-red-500',
    5: 'from-red-500 to-rose-600',
  };

  const riskDescriptions: Record<number, string> = {
    1: 'Based on your responses, you may prefer stability and capital preservation. A portfolio aligned with this profile would typically focus on lower-volatility securities.',
    2: 'Based on your responses, you may prefer steady growth with limited downside. A portfolio aligned with this profile would typically balance quality with defensive positions.',
    3: 'Based on your responses, you appear comfortable with market fluctuations. A portfolio aligned with this profile would typically have a diversified mix.',
    4: 'Based on your responses, you may accept higher volatility for growth potential. A portfolio aligned with this profile would typically include more growth-oriented positions.',
    5: 'Based on your responses, you appear to seek maximum growth. A portfolio aligned with this profile would typically be growth-focused.',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-up">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium">
          <Sparkles className="h-4 w-4" />
          Your Investment Profile
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold">
          Profile Complete!
        </h1>
      </div>

      {/* Risk Level Card */}
      <div className="glass-card p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Risk Level</h2>
          <Button variant="ghost" size="sm" onClick={onEdit} className="gap-2">
            <Edit className="h-4 w-4" />
            Edit Answers
          </Button>
        </div>

        {/* Risk Meter */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-20 h-20 rounded-2xl bg-gradient-to-br flex items-center justify-center text-3xl font-bold text-white shadow-lg",
              riskColors[riskProfile.riskBucket]
            )}>
              {riskProfile.riskBucket}
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{riskProfile.riskLabel}</p>
              <p className="text-muted-foreground">Risk Level {riskProfile.riskBucket} of 5</p>
            </div>
          </div>

          {/* Risk Bar */}
          <div className="relative h-4 rounded-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-500 overflow-hidden">
            <div 
              className="absolute top-0 h-full w-2 bg-white rounded-full shadow-lg border-2 border-foreground transition-all duration-500"
              style={{ left: `${((riskProfile.riskBucket - 1) / 4) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Conservative</span>
            <span>Aggressive</span>
          </div>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          {riskDescriptions[riskProfile.riskBucket]}
        </p>
      </div>

      {/* Style Tags */}
      {riskProfile.styleTags.length > 0 && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Your Style</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {riskProfile.styleTags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-sm px-3 py-1">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Constraints */}
      {riskProfile.constraints.length > 0 && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Your Constraints</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {riskProfile.constraints.map(constraint => (
              <Badge key={constraint} variant="outline" className="text-sm px-3 py-1">
                {constraint}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Action Cards - Made more button-like */}
      <div className="grid md:grid-cols-2 gap-4">
        <button
          onClick={onGeneratePortfolio}
          className="relative overflow-hidden glass-card p-6 text-left space-y-4 border-2 border-primary/30 hover:border-primary hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 group cursor-pointer"
        >
          {/* Hover gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="relative">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
              <Sparkles className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>
          <div className="relative">
            <h3 className="font-bold text-xl text-foreground">Generate Sample Portfolio</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Get an automated sample portfolio based on your profile for educational exploration. You can modify it afterwards.
            </p>
          </div>
          <div className="relative flex items-center gap-2 text-primary font-bold text-lg">
            <span className="px-3 py-1 rounded-full bg-primary/10">Recommended</span>
            <ArrowRight className="h-5 w-5 group-hover:translate-x-2 transition-transform" />
          </div>
        </button>

        <button
          onClick={onBuildBySectors}
          className="relative overflow-hidden glass-card p-6 text-left space-y-4 border-2 border-border hover:border-secondary hover:shadow-xl hover:shadow-secondary/10 transition-all duration-300 group cursor-pointer"
        >
          {/* Hover gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="relative">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg group-hover:from-secondary group-hover:to-secondary/70">
              <Layers className="h-7 w-7 text-foreground group-hover:text-secondary-foreground" />
            </div>
          </div>
          <div className="relative">
            <h3 className="font-bold text-xl text-foreground">Build by Sectors</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Choose sectors and pick individual stocks yourself. More control over your portfolio.
            </p>
          </div>
          <div className="relative flex items-center gap-2 text-muted-foreground font-bold text-lg group-hover:text-secondary">
            <span className="px-3 py-1 rounded-full bg-muted group-hover:bg-secondary/10">Advanced</span>
            <ArrowRight className="h-5 w-5 group-hover:translate-x-2 transition-transform" />
          </div>
        </button>
      </div>

      {/* Regulatory Disclaimer */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-warning/10 border border-warning/30">
        <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Educational Tool Only - Not Investment Advice</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This portfolio simulator is for educational and informational purposes only. It does not consider your 
            complete financial situation and is not a recommendation to buy or sell any securities. The sample 
            portfolios generated are hypothetical illustrations, not personalized investment advice. Past performance 
            does not guarantee future results. Always conduct your own research and consider consulting a licensed 
            financial advisor before making investment decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
