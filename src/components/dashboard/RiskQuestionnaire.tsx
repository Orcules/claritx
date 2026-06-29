import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api_adapter";
import { toast } from "sonner";
import { ClipboardList, CheckCircle } from "lucide-react";

interface RiskQuestionnaireProps {
  clientId: string;
  existingProfile?: any;
  onProfileUpdated: () => void;
  isPublic?: boolean;
  token?: string; // Token for public access to mark link as completed
}

const questions = [
  {
    key: "age",
    question: "What is your age?",
    type: "number",
    placeholder: "e.g. 35"
  },
  {
    key: "investment_horizon",
    question: "What is your investment horizon?",
    type: "radio",
    options: [
      { value: "short", label: "Short (less than 2 years)", score: 20 },
      { value: "medium", label: "Medium (2-5 years)", score: 50 },
      { value: "long", label: "Long (more than 5 years)", score: 80 }
    ]
  },
  {
    key: "investment_experience",
    question: "What is your investment experience?",
    type: "radio",
    options: [
      { value: "none", label: "No experience", score: 10 },
      { value: "beginner", label: "Beginner (1-2 years)", score: 30 },
      { value: "intermediate", label: "Intermediate (3-5 years)", score: 60 },
      { value: "advanced", label: "Advanced (5+ years)", score: 90 }
    ]
  },
  {
    key: "income_stability",
    question: "How stable is your income?",
    type: "radio",
    options: [
      { value: "unstable", label: "Unstable (freelancer, self-employed)", score: 30 },
      { value: "stable", label: "Stable (permanent position)", score: 60 },
      { value: "very_stable", label: "Very stable (multiple income sources)", score: 90 }
    ]
  },
  {
    key: "loss_tolerance",
    question: "What percentage of your portfolio are you willing to lose in a bad year?",
    type: "radio",
    options: [
      { value: "5", label: "Up to 5%", score: 15 },
      { value: "10", label: "Up to 10%", score: 30 },
      { value: "20", label: "Up to 20%", score: 55 },
      { value: "30", label: "Up to 30%", score: 75 },
      { value: "50", label: "More than 30%", score: 95 }
    ]
  },
  {
    key: "market_drop_reaction",
    question: "If the market drops 20%, what would you do?",
    type: "radio",
    options: [
      { value: "sell_all", label: "Sell everything", score: 10 },
      { value: "sell_some", label: "Sell some", score: 30 },
      { value: "hold", label: "Wait for recovery", score: 60 },
      { value: "buy_more", label: "Buy more", score: 90 }
    ]
  },
  {
    key: "investment_goal",
    question: "What is your primary investment goal?",
    type: "radio",
    options: [
      { value: "preservation", label: "Capital preservation", score: 15 },
      { value: "income", label: "Regular income (dividends)", score: 35 },
      { value: "growth", label: "Balanced growth", score: 60 },
      { value: "aggressive_growth", label: "Aggressive growth", score: 90 }
    ]
  },
  {
    key: "emergency_fund_months",
    question: "How many months of expenses do you have in emergency fund?",
    type: "radio",
    options: [
      { value: "0", label: "No emergency fund", score: 20 },
      { value: "3", label: "Up to 3 months", score: 40 },
      { value: "6", label: "3-6 months", score: 65 },
      { value: "12", label: "More than 6 months", score: 90 }
    ]
  }
];

export function RiskQuestionnaire({ clientId, existingProfile, onProfileUpdated, isPublic = false, token }: RiskQuestionnaireProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (existingProfile) {
      if (existingProfile.answers) {
        setAnswers(existingProfile.answers);
      } else {
        setAnswers({
          age: existingProfile.age?.toString() || "",
          investment_horizon: existingProfile.investment_horizon || "",
          investment_experience: existingProfile.investment_experience || "",
          income_stability: existingProfile.income_stability || "",
          loss_tolerance: existingProfile.loss_tolerance?.toString() || "",
          market_drop_reaction: existingProfile.market_drop_reaction || "",
          investment_goal: existingProfile.investment_goal || "",
          emergency_fund_months: existingProfile.emergency_fund_months?.toString() || ""
        });
      }
    }
  }, [existingProfile]);

  const calculateScore = () => {
    let total = 0;
    let count = 0;

    // Age score (younger = higher risk tolerance)
    const age = parseInt(answers.age);
    if (age) {
      if (age < 30) total += 85;
      else if (age < 40) total += 70;
      else if (age < 50) total += 55;
      else if (age < 60) total += 40;
      else total += 25;
      count++;
    }

    // Other questions
    questions.forEach(q => {
      if (q.type === "radio" && q.options && answers[q.key]) {
        const option = q.options.find(o => o.value === answers[q.key]);
        if (option) {
          total += option.score;
          count++;
        }
      }
    });

    return count > 0 ? Math.round(total / count) : 0;
  };

  const handleSubmit = async () => {
    const requiredFields = ["age", "investment_horizon", "loss_tolerance", "investment_goal"];
    const missing = requiredFields.filter(f => !answers[f]);

    if (missing.length > 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    const overallScore = calculateScore();

    try {
      await api.post(`/clients/${clientId}/risk-profile`, {
        overall_score: overallScore,
        risk_tolerance: overallScore,
        answers: answers,
        token: token || undefined
      });

      toast.success("Profile saved successfully!");
      setCompleted(true);
      onProfileUpdated();
    } catch (error: any) {
      toast.error(error.message || "Error saving profile");
    } finally {
      setLoading(false);
    }
  };

  if (completed && isPublic) {
    return (
      <div className="glass-card p-8 text-center max-w-xl mx-auto">
        <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
        <h2 className="text-2xl font-display font-bold mb-2">Thank You!</h2>
        <p className="text-muted-foreground">The questionnaire has been submitted successfully to your portfolio manager.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList className="h-6 w-6 text-primary" />
        <div>
          <h3 className="text-lg font-display font-bold">Risk Profile Questionnaire</h3>
          <p className="text-sm text-muted-foreground">
            Complete this questionnaire to determine the appropriate risk profile
          </p>
        </div>
      </div>

      {existingProfile && (
        <div className="mb-6 p-4 bg-success/10 border border-success/30 rounded-lg">
          <p className="text-success font-medium">
            Current Score: {existingProfile.overall_score} -
            {existingProfile.overall_score <= 30 ? " Conservative" :
              existingProfile.overall_score <= 60 ? " Moderate" : " Aggressive"}
          </p>
        </div>
      )}

      <div className="space-y-8">
        {questions.map((q, idx) => (
          <div key={q.key} className="space-y-3">
            <Label className="text-base font-medium">
              {idx + 1}. {q.question}
            </Label>

            {q.type === "number" ? (
              <Input
                type="number"
                value={answers[q.key] || ""}
                onChange={(e) => setAnswers(prev => ({ ...prev, [q.key]: e.target.value }))}
                placeholder={q.placeholder}
                className="max-w-xs"
              />
            ) : (
              <RadioGroup
                value={answers[q.key] || ""}
                onValueChange={(value) => setAnswers(prev => ({ ...prev, [q.key]: value }))}
                className="space-y-2"
              >
                {q.options?.map((option) => (
                  <div key={option.value} className="flex items-center space-x-3">
                    <RadioGroupItem value={option.value} id={`${q.key}-${option.value}`} />
                    <Label htmlFor={`${q.key}-${option.value}`} className="cursor-pointer">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-border">
        <Button onClick={handleSubmit} disabled={loading} size="lg">
          {loading ? "Saving..." : existingProfile ? "Update Profile" : "Save Profile"}
        </Button>
      </div>
    </div>
  );
}
