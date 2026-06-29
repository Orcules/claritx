import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, User, Briefcase, ClipboardList, Brain, Share2 } from "lucide-react";
import { PortfolioManager } from "./PortfolioManager";
import { RiskQuestionnaire } from "./RiskQuestionnaire";
import { AIAnalysis } from "./AIAnalysis";
import { api } from "@/lib/apiAdapter";
import { toast } from "sonner";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

interface ClientDetailsProps {
  client: Client;
  onBack: () => void;
}

export function ClientDetails({ client, onBack }: ClientDetailsProps) {
  const [riskProfile, setRiskProfile] = useState<any>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);

  useEffect(() => {
    fetchClientFullDetails();
  }, [client.id]);

  const fetchClientFullDetails = async () => {
    try {
      const data = await api.get<any>(`/clients/${client.id}`);
      setRiskProfile(data.risk_profile);
      if (data.share_token) {
        setShareLink(`${window.location.origin}/risk-assessment/${data.share_token}`);
      } else {
        setShareLink(null);
      }
    } catch (error) {
      console.error("Error fetching client details:", error);
    }
  };

  const createShareLink = async () => {
    try {
      const data = await api.post<any>(`/clients/${client.id}/risk-link`);

      const link = `${window.location.origin}/risk-assessment/${data.token}`;
      setShareLink(link);
      await navigator.clipboard.writeText(link);
      toast.success("Link copied to clipboard!");
    } catch (error) {
      toast.error("Error creating link");
    }
  };

  const getRiskLevel = (score: number | null) => {
    if (!score) return { label: "Not defined", color: "text-muted-foreground" };
    if (score <= 30) return { label: "Conservative", color: "text-success" };
    if (score <= 60) return { label: "Moderate", color: "text-warning" };
    return { label: "Aggressive", color: "text-destructive" };
  };

  const risk = getRiskLevel(riskProfile?.overall_score);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-card border-t-0 rounded-t-none sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4 h-16">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowRight className="h-5 w-5 rotate-180" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg">{client.name}</h1>
                <p className="text-xs text-muted-foreground">{client.email || "No email"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className={`text-sm font-medium ${risk.color}`}>
                Profile: {risk.label}
              </span>
              {riskProfile?.overall_score && (
                <span className="px-2 py-1 rounded-full bg-secondary text-xs font-bold">
                  {riskProfile.overall_score}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="portfolio" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="portfolio" className="gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Portfolio</span>
            </TabsTrigger>
            <TabsTrigger value="risk" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Risk Profile</span>
            </TabsTrigger>
            <TabsTrigger value="analysis" className="gap-2">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">AI Analysis</span>
            </TabsTrigger>
            <TabsTrigger value="share" className="gap-2">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="portfolio">
            <PortfolioManager clientId={client.id} />
          </TabsContent>

          <TabsContent value="risk">
            <RiskQuestionnaire
              clientId={client.id}
              existingProfile={riskProfile}
              onProfileUpdated={fetchClientFullDetails}
            />
          </TabsContent>

          <TabsContent value="analysis">
            <AIAnalysis clientId={client.id} clientName={client.name} />
          </TabsContent>

          <TabsContent value="share">
            <div className="glass-card p-6 max-w-xl">
              <h3 className="text-lg font-display font-bold mb-4">Share Risk Questionnaire</h3>
              <p className="text-muted-foreground mb-6">
                Share this link with your client so they can fill out their risk profile questionnaire.
                The link is valid for 7 days.
              </p>

              {shareLink ? (
                <div className="space-y-4">
                  <div className="p-3 bg-secondary rounded-lg break-all text-sm">
                    {shareLink}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(shareLink);
                        toast.success("Copied!");
                      }}
                    >
                      Copy Link
                    </Button>
                    <Button variant="outline" onClick={createShareLink}>
                      Generate New Link
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={createShareLink}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Create Share Link
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
