/**
 * WhatsAppPanel
 * Drop-in component for the UserDashboard that lets authenticated users
 * subscribe / unsubscribe their WhatsApp number for the ClaritX daily digest.
 */
import { useState, useEffect } from "react";
import { MessageCircle, CheckCircle2, XCircle, Phone, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api_adapter";
import { toast } from "sonner";

interface SubscriptionStatus {
  subscribed: boolean;
  phone?: string;
  name?: string;
  since?: string;
}

export function WhatsAppPanel() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Fetch current subscription status ───────────────────────────────────
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await api.get<SubscriptionStatus>("/whatsapp/status");
      if (data) setStatus(data);
      if (data?.phone) setPhone(data.phone);
    } catch (e) {
      console.error("[WhatsApp panel] Failed to load status:", e);
      setStatus({ subscribed: false });
    } finally {
      setLoading(false);
    }
  };

  // ── Subscribe ────────────────────────────────────────────────────────────
  const handleSubscribe = async () => {
    const cleaned = phone.trim();
    if (!cleaned.match(/^\+\d{7,15}$/)) {
      toast.error("Please enter a valid phone number, e.g. +972501234567");
      return;
    }

    setSaving(true);
    try {
      const data = await api.post("/whatsapp/subscribe", {
        phone: cleaned,
        name: "Investor"
      });
      if (!data) throw new Error("No response from server");

      toast.success("✅ Subscribed! Check your WhatsApp for a welcome message.");
      await fetchStatus();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to subscribe. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Unsubscribe ──────────────────────────────────────────────────────────
  const handleUnsubscribe = async () => {
    if (!confirm("Stop receiving WhatsApp daily digests?")) return;
    setSaving(true);
    try {
      await api.delete("/whatsapp/unsubscribe");
      toast.success("Unsubscribed from WhatsApp daily digest.");
      setStatus({ subscribed: false });
      setPhone("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to unsubscribe.");
    } finally {
      setSaving(false);
    }
  };


  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/50 p-5 flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading WhatsApp status…</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-green-500/15 flex items-center justify-center">
          <MessageCircle className="h-5 w-5 text-green-500" />
        </div>
        <div>
          <h3 className="font-semibold text-sm text-foreground">WhatsApp Daily Digest</h3>
          <p className="text-xs text-muted-foreground">
            Receive your portfolio summary &amp; market movers every morning
          </p>
        </div>

        {/* Status badge */}
        {status?.subscribed ? (
          <span className="ml-auto flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
            <CheckCircle2 className="h-3 w-3" /> Active
          </span>
        ) : (
          <span className="ml-auto flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
            <XCircle className="h-3 w-3" /> Not subscribed
          </span>
        )}
      </div>

      {/* Already subscribed */}
      {status?.subscribed && status.phone ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-foreground">{status.phone}</span>
            {status.since && (
              <span className="text-xs text-muted-foreground ml-auto">
                since {new Date(status.since).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-1">
            <p>📱 Text <strong className="text-foreground">DIGEST</strong> to <strong className="text-foreground">+1 (415) 523-8886</strong> to get your digest right now.</p>
            <p>📋 Text <strong className="text-foreground">HELP</strong> to see all bot commands.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={handleUnsubscribe}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
            Unsubscribe
          </Button>
        </div>
      ) : (
        /* Not subscribed — show signup form */
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-2.5">
            <div>
              <p><strong className="text-foreground">Step 1:</strong> Save <strong className="text-foreground">+1 (415) 523-8886</strong> as ClaritX Bot.</p>
            </div>
            
            <div className="space-y-1.5">
              <p><strong className="text-foreground">Step 2:</strong> Activate the sandbox handshake.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full bg-green-500/10 border-green-500/30 hover:bg-green-500/20 text-green-600 dark:text-green-400 gap-2 h-9"
                onClick={() => window.open("https://wa.me/14155238886?text=join%20satisfied-leg", "_blank")}
              >
                <MessageCircle className="h-4 w-4" />
                Click here to Join Sandbox
              </Button>
              <p className="text-[10px] text-center italic opacity-70">
                (This opens WhatsApp with the "join" message pre-filled)
              </p>
            </div>

            <div>
              <p><strong className="text-foreground">Step 3:</strong> Enter your number below to link your ClaritX portfolio.</p>
            </div>
          </div>




          <div className="flex gap-2">
            <Input
              id="whatsapp-phone-input"
              type="tel"
              placeholder="+972501234567"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="flex-1 font-mono text-sm"
              onKeyDown={e => e.key === "Enter" && handleSubscribe()}
            />
            <Button
              size="sm"
              onClick={handleSubscribe}
              disabled={saving || !phone.trim()}
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              {saving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
              Subscribe
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            International format with country code, e.g. <span className="font-mono">+1 (415) 523-8886</span>
          </p>
        </div>
      )}
    </div>
  );
}
