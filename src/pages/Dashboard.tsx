import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import { Button } from "@/components/ui/button";
import { Brain, Plus, LogOut, Users, Briefcase, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api_adapter";
import { Badge } from "@/components/ui/badge";
import { ClientList } from "@/components/dashboard/ClientList";
import { AddClientDialog } from "@/components/dashboard/AddClientDialog";
import { ClientDetails } from "@/components/dashboard/ClientDetails";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  client_risk_profiles?: {
    overall_score: number | null;
    risk_tolerance: number | null;
  } | null;
  portfolios?: {
    id: string;
    cash_balance: number;
  }[];
}

export default function Dashboard() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [systemPortfolios, setSystemPortfolios] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'clients' | 'system'>('clients');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await fetchAuthSession();
        if (!session.tokens) {
          navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          return;
        }
        setUserEmail(session.tokens.idToken?.payload.email as string || null);
        fetchClients();
        fetchSystemPortfolios();
      } catch (error) {
        console.error("Auth error:", error);
        navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      }
    };

    checkAuth();
  }, [navigate]);

  const fetchSystemPortfolios = async () => {
    try {
      const data = await api.get<any[]>("/admin/portfolios");
      if (data) setSystemPortfolios(data);
    } catch (error) {
      console.error("Error fetching system portfolios:", error);
    }
  };

  const fetchClients = async () => {
    try {
      const data = await api.get<Client[]>("/clients");
      if (data) {
        setClients(data);
      }
    } catch (error: any) {
      console.error("Error loading clients:", error);
      toast.error("Error loading clients");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
      navigate("/");
    }
  };

  const stats = {
    totalClients: clients.length,
    totalPortfolios: clients.reduce((acc, c) => acc + (c.portfolios?.length || 0), 0) + systemPortfolios.length,
    avgRiskScore: clients.length > 0
      ? Math.round(clients.reduce((acc, c) => acc + (c.client_risk_profiles?.overall_score || 0), 0) / clients.filter(c => c.client_risk_profiles?.overall_score).length) || 0
      : 0
  };

  if (selectedClient) {
    return (
      <ClientDetails
        client={selectedClient}
        onBack={() => {
          setSelectedClient(null);
          fetchClients();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-card border-t-0 rounded-t-none sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center glow-primary">
                <Brain className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg gradient-text">Market AIviser</h1>
                <p className="text-xs text-muted-foreground -mt-0.5">Portfolio Management</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden md:block">
                {userEmail}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="stat-card animate-fade-up">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Clients</p>
                <p className="text-3xl font-display font-bold">{stats.totalClients}</p>
              </div>
            </div>
          </div>

          <div className="stat-card animate-fade-up animation-delay-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Portfolios</p>
                <p className="text-3xl font-display font-bold">{stats.totalPortfolios}</p>
              </div>
            </div>
          </div>

          <div className="stat-card animate-fade-up animation-delay-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Avg Risk Score</p>
                <p className="text-3xl font-display font-bold">{stats.avgRiskScore}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Management Tabs */}
        <div className="glass-card p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex bg-muted p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('clients')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                  activeTab === 'clients' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Client Management
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                  activeTab === 'system' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                System Portfolios
              </button>
            </div>
            {activeTab === 'clients' && (
              <Button onClick={() => setShowAddClient(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Client
              </Button>
            )}
          </div>

          {activeTab === 'clients' ? (
            <ClientList
              clients={clients}
              loading={loading}
              onSelectClient={setSelectedClient}
              onRefresh={fetchClients}
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {systemPortfolios.map((p) => (
                  <div key={p.id} className="p-4 rounded-xl border border-border bg-card/50 hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-foreground truncate max-w-[150px]">{p.name || 'Untitled'}</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{p.risk_label}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {p.holdings?.length || 0} Assets
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">User ID</span>
                        <span className="font-mono text-[10px] truncate max-w-[100px]">{p.user_id}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Updated</span>
                        <span>{new Date(p.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-4 text-xs h-8 border border-border/50 hover:bg-primary/5"
                      onClick={() => navigate(`/my-portfolio`)} // Simplified, usually admin would view specific one
                    >
                      View Template
                    </Button>
                  </div>
                ))}
              </div>
              {systemPortfolios.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No system portfolios found in AWS backend.
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <AddClientDialog
        open={showAddClient}
        onOpenChange={setShowAddClient}
        onClientAdded={fetchClients}
      />
    </div>
  );
}
