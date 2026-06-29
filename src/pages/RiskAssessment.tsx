import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/apiAdapter";
import { AlertCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { RiskQuestionnaire } from "@/components/dashboard/RiskQuestionnaire";

interface RiskAssessmentData {
  link_id?: string;
  client_id: string;
  client_name: string;
  expires_at: string;
  completed: boolean;
}

export default function RiskAssessment() {
  const { resolvedTheme } = useTheme();
  const { token } = useParams();
  const [assessmentData, setAssessmentData] = useState<RiskAssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchLinkData();
    }
  }, [token]);

  const fetchLinkData = async () => {
    try {
      const data = await api.get<RiskAssessmentData>(`/public/risk-assessment/${token}`);

      if (!data) {
        setError("Invalid link");
        return;
      }

      if (data.completed) {
        setError("Questionnaire already completed");
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError("Link has expired");
        return;
      }

      setAssessmentData(data);
    } catch (err: any) {
      console.error("Error fetching link data:", err);
      setError(err.message || "Error loading data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold mb-2">Error</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container mx-auto max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-center mb-8">
          <Link to="/">
            <div className="overflow-hidden h-12">
              <img
                src={resolvedTheme !== 'light' ? '/logo-white.png' : '/logo-black.png'}
                alt="ClaritX"
                className="h-24 w-auto -mt-6"
              />
            </div>
          </Link>
        </div>

        {assessmentData && (
          <>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-display font-bold mb-2">Hello {assessmentData.client_name}</h2>
              <p className="text-muted-foreground">
                Your portfolio manager has requested you to fill out a short questionnaire to tailor your investment strategy to your needs.
              </p>
            </div>

            <RiskQuestionnaire
              clientId={assessmentData.client_id}
              onProfileUpdated={() => { }}
              isPublic={true}
              token={token}
            />
          </>
        )}
      </div>
    </div>
  );
}
