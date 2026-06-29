import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { BreadcrumbSchema } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, X, Sparkles, Coins, Zap, Crown, Loader2, Settings } from "lucide-react";
import { useUserCredits } from "@/hooks/useUserCredits";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api_adapter";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { STRIPE_CONFIG } from "@/lib/stripeConfig";
import { rdtTrack } from "@/lib/reddit-pixel";
import { useAuthenticator } from "@aws-amplify/ui-react";

const features = [
  { name: "Deep Research", free: "3 per day", pro: "50 per month", icon: Zap },
  { name: "AI Stock Rank", free: "Top 10 only", pro: "Full rankings + filters", icon: Crown },
  { name: "Portfolio Simulator", free: "Basic mode", pro: "Full AI insights", icon: Sparkles },
  { name: "Deep Search", free: "Not available", pro: "Full research reports", icon: null },
  { name: "Blog Access", free: "Read only", pro: "Read only", icon: null },
  { name: "Extra Credit Packs", free: "Not available", pro: "Buy anytime", icon: Coins },
];

export default function Pricing() {
  const { credits, remaining, loading, refetch, isTrialing, isCanceling } = useUserCredits();
  const { user, authStatus } = useAuthenticator(context => [context.user, context.authStatus]);
  const [couponCode, setCouponCode] = useState('');
  const [redeemingCoupon, setRedeemingCoupon] = useState(false);
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [managingPortal, setManagingPortal] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('return');
  const isSuccess = searchParams.get('success') === 'true';
  const isCanceled = searchParams.get('canceled') === 'true';

  // After successful checkout: sync immediately, then poll to catch webhook delay.
  // Stripe webhooks typically arrive 2-5s after redirect, so we poll at 3s and 8s.
  const syncAfterPayment = useCallback(async () => {
    try {
      await api.post('/check-subscription', {});
      await refetch();
    } catch (e) {
      console.error('Sync error:', e);
    }
    setTimeout(async () => { try { await refetch(); } catch {} }, 3000);
    setTimeout(async () => { try { await refetch(); } catch {} }, 8000);
  }, [refetch]);

  useEffect(() => {
    if (isSuccess && user) {
      rdtTrack('Purchase');
      toast.success("Payment Successful! 🎉 Credits will appear in your account shortly.");
      syncAfterPayment();
      // Redirect back to the page the user came from (stored before checkout)
      const savedReturn = returnTo || localStorage.getItem('claritx_pricing_return');
      if (savedReturn) {
        localStorage.removeItem('claritx_pricing_return');
        const path = savedReturn.startsWith('/') ? savedReturn : `/${savedReturn}`;
        setTimeout(() => navigate(path), 2000);
      }
    }
    if (isCanceled) {
      toast.info("Checkout Canceled. No charges were made.");
    }
  }, [isSuccess, isCanceled, user, syncAfterPayment]);

  const isPro = credits?.subscription_tier === 'pro';

  const handleCheckout = async (priceId: string, mode: 'subscription' | 'payment') => {
    if (authStatus !== 'authenticated') { navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    setCheckingOut(priceId);
    try {
      // Persist return path so we can redirect back after Stripe checkout completes
      if (returnTo) localStorage.setItem('claritx_pricing_return', returnTo);
      const data = await api.post('/create-checkout', { priceId, mode });
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      toast.error("Checkout Error: " + e.message);
    } finally {
      setCheckingOut(null);
    }
  };

  const handleManageSubscription = async () => {
    if (authStatus !== 'authenticated') return;
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

  const handleSubscribe = () => {
    if (authStatus !== 'authenticated') { navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    setShowCouponInput(true);
  };

  const handleRedeemCoupon = async () => {
    if (authStatus !== 'authenticated' || !couponCode.trim()) return;
    setRedeemingCoupon(true);
    try {
      const data = await api.post('/redeem-coupon', { code: couponCode.trim() });
      if (data?.error) {
        toast.error(data.error || "This coupon code is not valid.");
      } else {
        if (data?.type === 'pro_upgrade') {
          toast.success("Pro Activated! Welcome to ClaritX Pro 🚀");
        } else {
          toast.success(`${data?.bonus_credits ?? ''} Credits Added! 🎉`.trim());
        }
        setCouponCode('');
        refetch();
        if (returnTo) setTimeout(() => navigate(`/${returnTo}`), 1500);
      }
    } catch {
      toast.error("Failed to redeem coupon. Please try again.");
    } finally {
      setRedeemingCoupon(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Pricing — ClaritX AI Deep Research"
        description="Choose your plan. Free deep research or upgrade to Pro for deeper AI insights, full rankings, and more credits."
        canonicalUrl="/pricing"
      />
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Pricing', url: '/pricing' }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          '@id': 'https://www.claritx.ai/#product',
          name: 'ClaritX AI Deep Research Platform',
          url: 'https://www.claritx.ai/pricing',
          image: 'https://www.claritx.ai/og-image.png',
          description: 'AI-powered stock market research platform with 9-perspective analysis for educational purposes.',
          brand: { '@type': 'Brand', name: 'ClaritX' },
          offers: [
            {
              '@type': 'Offer',
              name: 'Free Plan',
              price: '0',
              priceCurrency: 'USD',
              availability: 'https://schema.org/InStock',
              url: 'https://www.claritx.ai/pricing',
              description: '3 deep research analyses per day, basic AI Stock Rank, Portfolio Simulator.',
            },
            {
              '@type': 'Offer',
              name: 'Pro Plan',
              price: '20',
              priceCurrency: 'USD',
              availability: 'https://schema.org/InStock',
              url: 'https://www.claritx.ai/pricing',
              priceSpecification: {
                '@type': 'RecurringChargeSpecification',
                billingDuration: 'P1M',
                price: '20',
                priceCurrency: 'USD',
              },
              description: '50 analyses/month, Deep Search, full AI rankings, extra credit packs.',
            },
          ],
        }) }}
      />
      <Header />
      <main className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Hero */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight mb-3">Simple, transparent pricing</h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Start free. Upgrade when you need deeper analysis and more credits.
            </p>
            {credits && (
              <div className="mt-4 inline-flex items-center gap-2 bg-muted/50 rounded-full px-4 py-2 text-sm">
                <Coins className="h-4 w-4 text-primary" />
                <span>You have <strong>{remaining}</strong> credits remaining</span>
                {isPro && <Badge variant="secondary" className="text-xs">Pro</Badge>}
              </div>
            )}
          </div>

          {/* Plans */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {/* Free Plan */}
            <Card className="relative">
              <CardHeader>
                <CardTitle className="text-xl">Free</CardTitle>
                <CardDescription>Get started with AI stock research</CardDescription>
                <div className="mt-2">
                  <span className="text-4xl font-bold">$0</span>
                  <span className="text-muted-foreground ml-1">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {features.map((f) => (
                    <li key={f.name} className="flex items-start gap-2 text-sm">
                      {f.free === "Not available" ? (
                        <X className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      ) : (
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      )}
                      <span>
                        <span className="font-medium">{f.name}</span>
                        <span className="text-muted-foreground"> — {f.free}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {authStatus !== 'authenticated' ? (
                  <Button variant="outline" className="w-full" onClick={() => navigate('/auth')}>Sign Up Free</Button>
                ) : !isPro ? (
                  <Button variant="outline" className="w-full" disabled>Current Plan</Button>
                ) : (
                  <Button variant="outline" className="w-full" disabled>Free Plan</Button>
                )}
              </CardFooter>
            </Card>

            {/* Pro Plan */}
            <Card className="relative border-primary/50 shadow-lg shadow-primary/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground px-3">Most Popular</Badge>
              </div>
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  Pro
                </CardTitle>
                <CardDescription>Full access to AI-powered insights</CardDescription>
                <div className="mt-2">
                  <span className="text-4xl font-bold">${STRIPE_CONFIG.pro.price}</span>
                  <span className="text-muted-foreground ml-1">/month</span>
                  <p className="text-sm text-primary font-medium mt-1">
                    {STRIPE_CONFIG.pro.trial_days}-day free trial included
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {features.map((f) => (
                    <li key={f.name} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>
                        <span className="font-medium">{f.name}</span>
                        <span className="text-muted-foreground"> — {f.pro}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                {isPro ? (
                  <div className="w-full space-y-2">
                    <Button className="w-full" disabled>
                      {isTrialing ? 'Trial Active' : 'Current Plan'}
                    </Button>
                    {isTrialing && credits?.trial_end && (
                      <p className="text-xs text-center text-muted-foreground">
                        Trial ends {new Date(credits.trial_end).toLocaleDateString()}
                      </p>
                    )}
                    {isCanceling && credits?.period_end && (
                      <p className="text-xs text-center text-amber-500 font-medium">
                        Cancels on {new Date(credits.period_end).toLocaleDateString()}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleManageSubscription}
                      disabled={managingPortal}
                    >
                      {managingPortal ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Settings className="h-4 w-4 mr-2" />}
                      Manage Subscription
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      className="w-full"
                      onClick={() => handleCheckout(STRIPE_CONFIG.pro.price_id, 'subscription')}
                      disabled={checkingOut === STRIPE_CONFIG.pro.price_id}
                    >
                      {checkingOut === STRIPE_CONFIG.pro.price_id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Start Free {STRIPE_CONFIG.pro.trial_days}-Day Trial
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Then ${STRIPE_CONFIG.pro.price}/month. Cancel anytime.
                    </p>
                    <Button variant="ghost" size="sm" onClick={handleSubscribe} className="text-xs text-muted-foreground">
                      Have a coupon code?
                    </Button>
                    {showCouponInput && (
                      <div className="w-full space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Coupon code"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRedeemCoupon()}
                          />
                          <Button size="sm" onClick={handleRedeemCoupon} disabled={redeemingCoupon || !couponCode.trim()}>
                            {redeemingCoupon ? 'Redeeming…' : 'Redeem'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardFooter>
            </Card>
          </div>

          {/* Credit Packs */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-center mb-2">Need more credits?</h2>
            <p className="text-center text-muted-foreground mb-8">
              Pro users can buy additional credit packs anytime. Bonus credits never expire.
            </p>
            <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {STRIPE_CONFIG.credit_packs.map((pack) => (
                <Card
                  key={pack.credits}
                  className={`relative text-center ${pack.popular ? 'border-primary/50 shadow-md' : ''}`}
                >
                  {pack.popular && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <Badge variant="secondary" className="text-xs">Best Value</Badge>
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{pack.label}</CardTitle>
                    <div className="flex items-center justify-center gap-1 text-3xl font-bold mt-1">
                      <Coins className="h-6 w-6 text-primary" />
                      {pack.credits}
                    </div>
                    <CardDescription className="text-lg font-semibold text-foreground">
                      ${pack.price}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="pt-2">
                    <Button
                      variant={pack.popular ? "default" : "outline"}
                      className="w-full"
                      onClick={() => handleCheckout(pack.price_id, 'payment')}
                      disabled={(!isPro && authStatus === 'authenticated') || checkingOut === pack.price_id}
                    >
                      {checkingOut === pack.price_id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      {authStatus !== 'authenticated' ? 'Sign In' : !isPro ? 'Pro Only' : 'Buy Now'}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>

          {/* Credit Costs Table */}
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-center mb-4">Credit costs per action</h3>
            <div className="space-y-2 text-sm">
              {[
                { action: "Deep Research", cost: 1 },
                { action: "Portfolio Simulation", cost: 5 },
                { action: "AI Rank Browse", cost: 0, note: "Free for Pro" },
              ].map((item) => (
                <div key={item.action} className="flex justify-between items-center py-2 border-b border-border/50">
                  <span>{item.action}</span>
                  <span className="font-semibold">
                    {item.cost === 0 ? (
                      <Badge variant="secondary" className="text-xs">{item.note}</Badge>
                    ) : (
                      `${item.cost} credit${item.cost > 1 ? 's' : ''}`
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>


          {/* Return button */}
          {returnTo && (
            <div className="text-center mt-8">
              <Button variant="outline" onClick={() => {
                const path = returnTo.startsWith('/') ? returnTo : `/${returnTo}`;
                navigate(path);
              }}>
                ← Back to {
                  returnTo.startsWith('ai-stock-analysis') ? 'Deep Research'
                  : returnTo === 'portfolio-simulator' ? 'Portfolio Simulator'
                  : returnTo === 'my-portfolio' ? 'My Portfolio'
                  : returnTo.startsWith('stocks/') ? returnTo.replace('stocks/', '').toUpperCase()
                  : 'Previous Page'
                }
              </Button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
