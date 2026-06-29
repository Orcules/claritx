import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Crown, Coins, AlertTriangle, Loader2, Settings, CheckCircle2, XCircle, Clock, CreditCard, Zap, Sparkles, Mail, MessageSquare
} from "lucide-react";
import { useUserCredits } from "@/hooks/useUserCredits";
import { api } from "@/lib/api_adapter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";
import { STRIPE_CONFIG } from "@/lib/stripeConfig";

export default function Account() {
  const { credits, remaining, loading, refetch, isTrialing, isCanceling, isPastDue } = useUserCredits();
  const [managingPortal, setManagingPortal] = useState(false);
  const [cancelingSubscription, setCancelingSubscription] = useState(false);
  const [searchParams] = useSearchParams();

  const isPro = credits?.subscription_tier === 'pro';

  // Always sync from Stripe on mount so the page never shows stale DB data
  useEffect(() => {
    const sync = async () => {
      try {
        await api.post('/check-subscription', {});
      } catch {}
      refetch();
    };
    sync();
  }, []);

  // Re-sync whenever the tab regains focus (handles portal cancellations, payment updates, etc.)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [refetch]);

  const handleManageSubscription = async () => {
    setManagingPortal(true);
    try {
      const data = await api.post('/customer-portal', {});
      if (data?.error) throw new Error(data.error);
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setManagingPortal(false);
    }
  };

  const handleCancelSubscription = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to cancel your Pro subscription? You'll keep access until the end of your billing period."
    );
    if (!confirmed) return;
    setCancelingSubscription(true);
    try {
      const data = await api.post('/cancel-subscription', {});
      if (data?.error) throw new Error(data.error);
      toast.success("Subscription will cancel at end of billing period.");
      refetch();
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setCancelingSubscription(false);
    }
  };

  const statusLabel = () => {
    if (!isPro) return { label: "Free Plan", color: "text-muted-foreground", icon: <XCircle className="h-4 w-4" /> };
    if (isTrialing) return { label: "Pro — Trial Active", color: "text-primary", icon: <Clock className="h-4 w-4 text-primary" /> };
    if (isCanceling) return { label: "Pro — Cancels Soon", color: "text-amber-500", icon: <Clock className="h-4 w-4 text-amber-500" /> };
    if (isPastDue) return { label: "Pro — Payment Issue", color: "text-red-500", icon: <AlertTriangle className="h-4 w-4 text-red-500" /> };
    return { label: "Pro — Active", color: "text-green-500", icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> };
  };

  const status = statusLabel();

  return (
    <>
      <SEOHead title="My Account — ClaritX" description="Manage your ClaritX subscription and credits." canonicalUrl="/account" />
      <Header />
      <main className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-1">My Account</h1>
            <p className="text-muted-foreground">Manage your subscription and credits</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">

              {/* Subscription Status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {isPro
                      ? <Crown className="h-4 w-4 text-yellow-500" />
                      : <Zap className="h-4 w-4 text-muted-foreground" />
                    }
                    Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`flex items-center gap-2 font-medium ${status.color}`}>
                      {status.icon}
                      {status.label}
                    </div>
                    {isPro && (
                      <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">
                        Pro
                      </Badge>
                    )}
                  </div>

                  {isTrialing && credits?.trial_end && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                      <p className="font-medium text-primary">Free trial active</p>
                      <p className="text-muted-foreground mt-0.5">
                        Trial ends on {new Date(credits.trial_end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.
                        After that you'll be charged ${STRIPE_CONFIG.pro.price}/month.
                      </p>
                    </div>
                  )}

                  {isCanceling && credits?.period_end && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-sm">
                      <p className="font-medium text-amber-500">Cancellation scheduled</p>
                      <p className="text-muted-foreground mt-0.5">
                        Your Pro access will end on {new Date(credits.period_end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.
                      </p>
                    </div>
                  )}

                  {isPastDue && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-sm">
                      <p className="font-medium text-red-500">Payment issue</p>
                      <p className="text-muted-foreground mt-0.5">
                        Your last payment failed. Please update your payment method to keep Pro access.
                      </p>
                    </div>
                  )}

                  {!isPro && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm space-y-1">
                      <p className="font-medium text-foreground flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Unlock the full power of ClaritX
                      </p>
                      <p className="text-muted-foreground">
                        Pro gives you 50 monthly credits, deep research reports, and full AI stock rankings — starting with a 14-day free trial.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-1">
                    {isPro ? (
                      <>
                        <Button variant="outline" onClick={handleManageSubscription} disabled={managingPortal} className="w-full">
                          {managingPortal ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
                          Manage Billing & Invoices
                        </Button>
                        {!isCanceling && (
                          <Button
                            variant="ghost"
                            onClick={handleCancelSubscription}
                            disabled={cancelingSubscription}
                            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            {cancelingSubscription && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Cancel Subscription
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button asChild className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
                        <Link to="/pricing">
                          <Sparkles className="h-4 w-4 mr-2" />
                          Start Free {STRIPE_CONFIG.pro.trial_days}-Day Trial
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Credits */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Coins className="h-4 w-4 text-primary" />
                    Credits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-3xl font-bold font-mono">{remaining}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">credits remaining</p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>{credits?.monthly_credits ?? 0} monthly</p>
                      <p>{credits?.bonus_credits ?? 0} bonus</p>
                      <p>{credits?.credits_used_this_period ?? 0} used this period</p>
                    </div>
                  </div>
                  <Progress
                    value={Math.min(100, (remaining / Math.max(1, (credits?.monthly_credits ?? 3) + (credits?.bonus_credits ?? 0))) * 100)}
                    className="h-2"
                  />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Deep Research = 1 credit</p>
                    <p>• Portfolio Simulation = 5 credits</p>
                    <p>• Monthly credits reset each billing cycle. Bonus credits never expire.</p>
                  </div>
                  {isPro && (
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/pricing#credits">
                        <Coins className="h-4 w-4 mr-2" />
                        Buy More Credits
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Credit Packs (Pro only) */}
              {isPro && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Need more credits?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">Bonus credits never expire. Go to pricing to purchase a pack.</p>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/pricing">View Credit Packs →</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Support & Contact */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Support & Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Need help or have a question? Reach out and we'll get back to you.
                  </p>
                  <div className="flex flex-col gap-2">
                    <a
                      href="mailto:info@claritx.ai"
                      className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                    >
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>info@claritx.ai</span>
                      <span className="text-xs text-muted-foreground ml-auto">General & support</span>
                    </a>
                    <a
                      href="mailto:business@claritx.ai"
                      className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                    >
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>business@claritx.ai</span>
                      <span className="text-xs text-muted-foreground ml-auto">Business & partnerships</span>
                    </a>
                  </div>
                </CardContent>
              </Card>

            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
