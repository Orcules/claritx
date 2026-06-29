import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/apiAdapter";
import { toast } from "sonner";
import { Brain, RefreshCw, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";

interface AIAnalysisProps {
  clientId: string;
  clientName: string;
}

interface AnalysisResult {
  summary: string;
  riskAssessment: string;
  recommendations: string[];
  warnings: string[];
  score: number;
}

export function AIAnalysis({ clientId, clientName }: AIAnalysisProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [riskProfile, setRiskProfile] = useState<any>(null);

  useEffect(() => {
    fetchClientData();
  }, [clientId]);

  const fetchClientData = async () => {
    try {
      const [portfolioData, riskData] = await Promise.all([
        api.get<any>(`/clients/${clientId}/portfolio`),
        api.get<any>(`/clients/${clientId}/risk-profile`)
      ]);

      if (portfolioData) setPortfolio(portfolioData);
      if (riskData) setRiskProfile(riskData);
    } catch (error) {
      console.error("Error fetching client data for analysis", error);
    }
  };

  const runAnalysis = async () => {
    if (!portfolio || !riskProfile) {
      toast.error("Portfolio and risk profile required for analysis");
      return;
    }

    setLoading(true);

    try {
      const answers = riskProfile.answers || {};
      const data = await api.post<any>(`/clients/${clientId}/portfolio-analysis`, {
        portfolio: {
          cashBalance: portfolio.cash_balance,
          holdings: portfolio.holdings || []
        },
        riskProfile: {
          age: answers.age,
          investmentHorizon: answers.investment_horizon,
          riskTolerance: riskProfile.risk_tolerance,
          investmentGoal: answers.investment_goal,
          lossTolerance: answers.loss_tolerance,
          overallScore: riskProfile.overall_score
        }
      });

      setAnalysis(data);
    } catch (error: any) {
      toast.error("Error analyzing portfolio");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const canAnalyze = portfolio?.portfolio_holdings?.length > 0 && riskProfile?.overall_score;

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-primary" />
            <h3 className="text-lg font-display font-bold">AI Analysis</h3>
          </div>
          <Button
            onClick={runAnalysis}
            disabled={loading || !canAnalyze}
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Run Analysis
              </>
            )}
          </Button>
        </div>

        {!canAnalyze && (
          <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg">
            <p className="text-warning text-sm">
              {!portfolio?.portfolio_holdings?.length && "Please add stocks to portfolio. "}
              {!riskProfile?.overall_score && "Please complete risk profile questionnaire."}
            </p>
          </div>
        )}

        {canAnalyze && !analysis && !loading && (
          <p className="text-muted-foreground">
            Click "Run Analysis" to get personalized AI recommendations based on client profile.
          </p>
        )}
      </div>

      {/* Analysis Results */}
      {analysis && (
        <>
          {/* Summary */}
          <div className="glass-card p-6 animate-fade-up">
            <h4 className="font-display font-bold mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Summary
            </h4>
            <p className="text-muted-foreground leading-relaxed">{analysis.summary}</p>
          </div>

          {/* Risk Assessment */}
          <div className="glass-card p-6 animate-fade-up animation-delay-100">
            <h4 className="font-display font-bold mb-3">Profile Match Assessment</h4>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <span className="text-xl font-bold text-primary-foreground">{analysis.score}%</span>
              </div>
              <div>
                <p className="font-medium">
                  {analysis.score >= 80 ? "Excellent Match" :
                    analysis.score >= 60 ? "Good Match" :
                      analysis.score >= 40 ? "Moderate Match" : "Poor Match"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Portfolio alignment with risk profile
                </p>
              </div>
            </div>
            <p className="text-muted-foreground">{analysis.riskAssessment}</p>
          </div>

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <div className="glass-card p-6 animate-fade-up animation-delay-200">
              <h4 className="font-display font-bold mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                Recommendations
              </h4>
              <ul className="space-y-3">
                {analysis.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center text-xs font-bold text-success flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-muted-foreground">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {analysis.warnings.length > 0 && (
            <div className="glass-card p-6 border-warning/30 animate-fade-up animation-delay-300">
              <h4 className="font-display font-bold mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Warnings
              </h4>
              <ul className="space-y-3">
                {analysis.warnings.map((warning, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
