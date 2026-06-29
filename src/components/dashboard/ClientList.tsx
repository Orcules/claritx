import { User, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/apiAdapter";
import { toast } from "sonner";

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

interface ClientListProps {
  clients: Client[];
  loading: boolean;
  onSelectClient: (client: Client) => void;
  onRefresh: () => void;
}

export function ClientList({ clients, loading, onSelectClient, onRefresh }: ClientListProps) {
  const handleDelete = async (e: React.MouseEvent, clientId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this client?")) return;

    try {
      await api.delete(`/clients/${clientId}`);
      toast.success("Client deleted successfully");
      onRefresh();
    } catch (error) {
      toast.error("Error deleting client");
    }
  };

  const getRiskColor = (score: number | null | undefined) => {
    if (!score) return "text-muted-foreground";
    if (score <= 30) return "text-success";
    if (score <= 60) return "text-warning";
    return "text-destructive";
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-12">
        <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No clients yet</h3>
        <p className="text-muted-foreground">Click "New Client" to add your first client</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {clients.map((client) => (
        <div
          key={client.id}
          onClick={() => onSelectClient(client)}
          className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{client.name}</h3>
              <p className="text-sm text-muted-foreground">{client.email || "No email"}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right hidden md:block">
              <p className="text-sm text-muted-foreground">Portfolios</p>
              <p className="font-semibold">{client.portfolios?.length || 0}</p>
            </div>

            <div className="text-right hidden md:block">
              <p className="text-sm text-muted-foreground">Risk Score</p>
              <p className={`font-semibold ${getRiskColor(client.client_risk_profiles?.overall_score)}`}>
                {client.client_risk_profiles?.overall_score || "-"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => handleDelete(e, client.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
