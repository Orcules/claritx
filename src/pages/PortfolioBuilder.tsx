import { useState, useEffect } from 'react';
import { rdtTrack } from "@/lib/reddit-pixel";
import { useNavigate, Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { QuestionnaireStep } from '@/components/portfolio-builder/QuestionnaireStep';
import { ProfileSummary } from '@/components/portfolio-builder/ProfileSummary';
import { PortfolioView } from '@/components/portfolio-builder/PortfolioView';
import { SectorBuilder } from '@/components/portfolio-builder/SectorBuilder';
import { PortfolioGenerationLoader } from '@/components/portfolio-builder/PortfolioGenerationLoader';
import { usePortfolioBuilder } from '@/hooks/usePortfolioBuilder';
import { allQuestions, totalQuestions } from '@/data/portfolioQuestions';
import { api } from '@/lib/api_adapter';
import { Button } from '@/components/ui/button';
import { Sparkles, Shield, Clock, ArrowRight, LogIn, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
// import { User } from '@supabase/supabase-js';
import { extractFiltersFromProfile } from '@/hooks/useInvestorFilters';
import { SEOHead, BreadcrumbSchema, FAQSchema } from '@/components/SEOHead';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { PortfolioBuilderToolSchema } from '@/components/seo';
import { useAuthModal } from '@/context/AuthModalContext';

type BuilderPhase = 'landing' | 'questionnaire' | 'profile' | 'auth-required' | 'ready-portfolio' | 'sector-builder' | 'generating';

export default function PortfolioBuilder() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<BuilderPhase>('landing');
  const [user, setUser] = useState<any | null>(null);
  const [pendingAction, setPendingAction] = useState<'ready' | 'sectors' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { openAuthModal } = useAuthModal();

  const {
    profile,
    updateProfile,
    riskProfile,
    calculateRiskProfile,
    portfolio,
    generatePortfolio,
    addHolding,
    removeHolding,
    replaceHolding,
    step,
    setStep,
    resetBuilder,
    saveStateForAuth,
    restoredPhase,
  } = usePortfolioBuilder();

  // NOTE: We intentionally do NOT fire a Reddit event on page load.
  // Portfolio conversion is tracked as `PortfolioCreated` only after a real save (see savePortfolioToDb).

  // Restore phase from saved state on mount
  useEffect(() => {
    if (restoredPhase && restoredPhase !== 'landing' && restoredPhase !== 'auth-required') {
      // If we have a restored phase and user is logged in, go to that phase
      if (restoredPhase === 'profile' && riskProfile) {
        setPhase('profile');
      } else if (restoredPhase === 'questionnaire') {
        setPhase('questionnaire');
      } else if (restoredPhase === 'sector-builder' && riskProfile) {
        setPhase('sector-builder');
      }
    }
  }, [restoredPhase, riskProfile]);


  // New Effect: Load existing portfolio
  useEffect(() => {
    async function loadUserPortfolio() {
      if (!user) return;

      try {
        const { data, error } = await api.functions.invoke('user-portfolios', { method: 'GET' });

        if (error) {
          console.error('Error fetching portfolio:', error);
          return;
        }

        if (data) {
          // If we found a portfolio, load it into state
          console.log("Found existing portfolio:", data);

          // We need to map database fields back to our hook's state if possible.
          // Since usePortfolioBuilder handles state internally, we might need a way to 'set' it from outside,
          // OR we simply move the user to the 'ready-portfolio' phase and show them what we found.
          // However, usePortfolioBuilder doesn't export a 'setPortfolio' directly for full object replacement easily
          // without major refactoring.
          // For now, let's at least acknowledge we found it. 

          // Ideally, we should parse 'data.holdings' etc. and populate the hook.
          // But since 'generatePortfolio' creates a fresh one based on answers, loading an OLD one is different.
          // Let's assume for now we just want to SHOW it if it exists.

          // Hack: Determine if we should show it instead of the landing page
          // If the user hasn't started (step 0, phase landing), and has a portfolio, show it?
          if (phase === 'landing') {
            toast({
              title: "Welcome Back",
              description: "We found your saved portfolio.",
            });
            // To fully support editing loaded portfolios, we'd need to update usePortfolioBuilder to accept initialData.
          }
        }
      } catch (e) {
        console.error("Load portfolio error:", e);
      }
    }

    loadUserPortfolio();
  }, [user, phase]);

  const handleAnswer = (value: any) => {
    const question = allQuestions[step];
    updateProfile({ [question.id]: value });
  };

  const handleNext = () => {
    if (step < totalQuestions - 1) {
      setStep(step + 1);
    } else {
      calculateRiskProfile();
      setPhase('profile');
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      setPhase('landing');
    }
  };

  const getCurrentValue = () => {
    const question = allQuestions[step];
    return (profile as any)[question.id];
  };

  const savePortfolioToDb = async (portfolioData: typeof portfolio) => {
    if (!portfolioData || !riskProfile) return;

    if (!user) {
      // If not logged in, prompt for auth instead of failing silently
      openAuthModal({
        onSuccess: () => savePortfolioToDb(portfolioData)
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await api.functions.invoke('user-portfolios', {
        body: {
          risk_bucket: riskProfile.riskBucket,
          risk_label: riskProfile.riskLabel,
          style_tags: riskProfile.styleTags,
          constraints: riskProfile.constraints,
          holdings: portfolioData.holdings,
          sector_allocation: portfolioData.sectorAllocation,
          total_risk_score: portfolioData.totalRiskScore,
        }
      });

      if (error) throw error;

      // Real conversion: portfolio actually created/saved to the user's account.
      rdtTrack('Custom', {
        customEventName: 'PortfolioCreated',
        content_name: 'portfolio_created',
      });

      toast({
        title: 'Portfolio Saved!',
        description: 'Your portfolio has been saved to your account.',
      });

      // Only navigate if we actually have holdings to show in 'My Portfolio'
      if (portfolioData.holdings.length > 0) {
        navigate('/my-portfolio');
      }
    } catch (error: any) {
      console.error('Error saving portfolio:', error);
      toast({
        title: 'Save Failed',
        description: error.message || 'Could not save portfolio.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Map questionnaire answers directly to backend InvestorProfile
  const mapToInvestorProfile = () => {
    // Income vs growth from investmentGoals
    let income_vs_growth = 'both';
    if (profile.investmentGoals === 'income') income_vs_growth = 'income';
    else if (profile.investmentGoals === 'growth') income_vs_growth = 'growth';

    // Include ETFs from instrumentType
    const include_etfs = profile.instrumentType === 'etf' || profile.instrumentType === 'mixed' || profile.instrumentType === 'funds';

    // Market cap
    const market_cap = profile.preferredMarketCap === 'any' ? 'all' : profile.preferredMarketCap;

    // Sectors handling: if 'no_preference' is selected, send empty array to get all sectors
    let formatted_sectors = profile.sectors || [];
    if (formatted_sectors.includes('no_preference')) {
      formatted_sectors = [];
    }

    return {
      risk_tolerance: profile.riskTolerance,
      income_vs_growth,
      market_cap,
      sectors: formatted_sectors,
      include_etfs,
      instrument_type: profile.instrumentType,
      value_or_growth: profile.preferredStyle || 'blend',
      min_ai_score: profile.minAiScore || 0,
      min_volume: 0,
      country: profile.market === 'US' ? 'US' : 'all',
    };
  };

  // Save investor profile to backend for recommendations
  const saveInvestorProfile = async () => {
    if (!user) return; // Skip saving profile for guests to avoid 401 errors
    try {
      const investorProfile = mapToInvestorProfile();
      await api.post('/portfolio/profile', investorProfile);
      console.log('Investor profile saved for recommendations:', investorProfile);
    } catch (err) {
      console.error('Failed to save investor profile (non-fatal):', err);
    }
  };

  const handleGeneratePortfolio = async () => {
    // Show loading animation
    setPhase('generating');

    // CRITICAL: Save investor profile BEFORE generating so backend has newest filters
    await saveInvestorProfile();

    try {
      const newPortfolio = await generatePortfolio();
      setPhase('ready-portfolio');

      if (newPortfolio.holdings.length > 0 && user) {
        savePortfolioToDb(newPortfolio);
      }
    } catch (err: any) {
      if (err?.name === 'InsufficientCreditsError') {
        setPhase('profile');
        toast({ title: "Insufficient Credits", description: "Redirecting to add credits…", variant: "destructive" });
        setTimeout(() => navigate('/pricing?return=portfolio-simulator'), 600);
        return;
      }
      setPhase('profile');
      toast({ title: "Portfolio Generation Failed", description: err?.message || "Something went wrong", variant: "destructive" });
    }
  };

  const handleBuildBySectors = () => {
    setPhase('sector-builder');
  };

  const handleSectorsDone = () => {
    setPhase('ready-portfolio');
    if (portfolio && user) {
      savePortfolioToDb(portfolio);
    }
  };

  useEffect(() => {
    // Check initial user
    getCurrentUser().then(u => setUser(u)).catch(() => setUser(null));

    // Listen for auth changes
    const listener = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn') {
        getCurrentUser().then(u => {
          setUser(u);
          // If user just logged in and had a pending action, continue
          if (pendingAction) {
            if (pendingAction === 'ready') {
              handleGeneratePortfolio();
            } else if (pendingAction === 'sectors') {
              setPhase('sector-builder');
            }
            setPendingAction(null);
          }
        });
      } else if (payload.event === 'signedOut') {
        setUser(null);
      }
    });

    return () => listener();
  }, [pendingAction, restoredPhase, riskProfile]);

  // SEO HowTo steps for portfolio building
  const portfolioHowToSteps = [
    { name: "Answer Risk Questionnaire", text: "Complete a 2-minute questionnaire about your investment preferences, risk tolerance, and financial goals." },
    { name: "Review Your Risk Profile", text: "ClaritX analyzes your answers and generates a personalized risk profile with recommended asset allocation." },
    { name: "Generate or Customize Portfolio", text: "Choose to auto-generate a diversified portfolio or build one sector-by-sector with AI recommendations." },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* SEO */}
      <SEOHead
        title="Investment Portfolio Simulator - Free AI Tool | ClaritX"
        description="Free AI-powered portfolio simulator. Answer a quick risk questionnaire, get a personalized risk profile, and explore diversified portfolio scenarios for educational purposes."
        keywords="portfolio simulator, investment portfolio simulator, stock portfolio simulator, ai portfolio tool, portfolio builder, risk assessment, asset allocation"
        canonicalUrl="/portfolio-simulator"
      />
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "/" },
          { name: "Portfolio Simulator", url: "/portfolio-simulator" },
        ]}
      />
      <FAQSchema
        faqs={[
          {
            question: "What is the ClaritX Portfolio Simulator?",
            answer: "ClaritX Portfolio Simulator is a free educational tool that helps you explore hypothetical investment portfolio scenarios. By answering a brief risk questionnaire, you receive a personalized risk profile and can generate or customize a simulated portfolio for learning purposes."
          },
          {
            question: "How does the risk assessment work?",
            answer: "Our questionnaire follows MiFID II guidelines and evaluates factors like your investment timeline, risk tolerance, income stability, and financial goals. The AI analyzes your responses to determine a risk bucket (1-5) and suggests appropriate asset allocations. This is for educational purposes only and is not a suitability assessment."
          },
          {
            question: "Is this real investment advice?",
            answer: "No. The Portfolio Simulator is strictly for educational and research purposes. ClaritX is not a registered investment advisor. The simulations do not constitute personalized financial advice. Always consult a licensed financial professional before making investment decisions."
          },
          {
            question: "Can I save my simulated portfolio?",
            answer: "Yes, by creating a free ClaritX account you can save your portfolio simulations and access them anytime. Your questionnaire answers are preserved so you can continue where you left off."
          },
          {
            question: "What is the difference between 'Generate Portfolio' and 'Build by Sectors'?",
            answer: "Generate Portfolio uses AI to automatically create a diversified portfolio based on your risk profile. Build by Sectors lets you manually select assets for each sector with AI-powered suggestions, giving you more control over the simulation."
          }
        ]}
      />
      <PortfolioBuilderToolSchema />

      {/* Portfolio Generation Loader */}
      {phase === 'generating' && <PortfolioGenerationLoader />}

      <Header />

      <main className="container mx-auto px-4 pt-24 pb-16 flex-1">
        {/* Visual Breadcrumbs */}
        <Breadcrumbs
          items={[{ label: "Portfolio Simulator" }]}
          className="mb-8"
        />

        {phase === 'landing' && (
          <div className="max-w-3xl mx-auto text-center space-y-10 py-12 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium">
              <Sparkles className="h-4 w-4" />
              Portfolio Simulator
            </div>

            <h1 className="text-4xl md:text-6xl font-display font-bold">
              Simulate a Portfolio <span className="gradient-text">Scenario</span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-xl mx-auto">
              Answer a few questions about your preferences, and explore
              a hypothetical portfolio simulation for educational purposes.
            </p>

            <div className="grid md:grid-cols-3 gap-6 text-left">
              {[
                { icon: Clock, title: '2 Minutes', desc: 'Quick questionnaire' },
                { icon: Shield, title: 'Scenario-Based', desc: 'Based on your inputs' },
                { icon: Sparkles, title: 'AI-Powered', desc: 'Pattern analysis' },
              ].map((item) => (
                <div key={item.title} className="glass-card p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center gap-3">
              <Button size="lg" onClick={() => setPhase('questionnaire')} className="gap-2 text-lg px-8">
                Start Simulation
                <ArrowRight className="h-5 w-5" />
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  // TODO: Implement portfolio import functionality
                  toast({
                    title: "Coming Soon",
                    description: "Portfolio import feature is under development.",
                  });
                }}
                className="gap-2"
              >
                Import holdings for analysis
              </Button>
            </div>

            {/* Educational Disclaimer */}
            <div className="max-w-xl mx-auto p-4 rounded-lg bg-warning/10 border border-warning/20 text-left">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-warning">Educational Tool Only:</strong> This portfolio builder is for informational purposes and does not constitute investment advice.
                    The risk profiling questionnaire follows MiFID II guidelines but does not constitute a suitability assessment.
                    Always consult a licensed financial advisor.{" "}
                    <Link to="/disclaimer" className="text-primary hover:underline">Read full disclaimer</Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === 'questionnaire' && (
          <QuestionnaireStep
            question={allQuestions[step]}
            currentValue={getCurrentValue()}
            onAnswer={handleAnswer}
            onNext={handleNext}
            onBack={handleBack}
            currentStep={step}
            totalSteps={totalQuestions}
            canGoBack={true}
            canGoNext={true}
            profile={profile}
          />
        )}

        {phase === 'profile' && riskProfile && (
          <ProfileSummary
            profile={profile}
            riskProfile={riskProfile}
            onGeneratePortfolio={handleGeneratePortfolio}
            onBuildBySectors={handleBuildBySectors}
            onEdit={() => {
              setStep(0);
              setPhase('questionnaire');
            }}
          />
        )}

        {phase === 'auth-required' && (
          <div className="max-w-md mx-auto text-center space-y-8 py-16 animate-fade-up">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <LogIn className="h-10 w-10 text-primary" />
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-display font-bold text-foreground">
                Sign In to Continue
              </h1>
              <p className="text-muted-foreground">
                Create an account or sign in to save your portfolio and access it anytime.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                size="lg"
                onClick={() => navigate('/auth?redirect=/portfolio-simulator')}
                className="w-full gap-2"
              >
                <LogIn className="h-5 w-5" />
                Sign In / Sign Up
              </Button>

              <Button
                variant="ghost"
                onClick={() => setPhase('profile')}
                className="w-full"
              >
                Go Back
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Your questionnaire answers are saved. After signing in, you'll continue right where you left off.
            </p>
          </div>
        )}

        {phase === 'ready-portfolio' && portfolio && riskProfile && (
          <>
            {portfolio.holdings.length === 0 ? (
              <div className="max-w-2xl mx-auto mt-12 p-8 text-center glass-card rounded-2xl border border-border/50">
                <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-8 w-8 text-warning" />
                </div>
                <h2 className="text-2xl font-bold mb-3 text-foreground">No Matching Assets Found</h2>
                <p className="text-muted-foreground mb-6">
                  We currently don't have enough screened stocks in our database that perfectly match your specific filtering criteria (like sector, market cap, and AI score).
                </p>
                <div className="flex gap-4 justify-center">
                  <Button onClick={() => setPhase('profile')} variant="outline">
                    Edit Profile Filters
                  </Button>
                  <Button onClick={handleBuildBySectors}>
                    Build Manually by Sectors
                  </Button>
                </div>
              </div>
            ) : (
              <PortfolioView
                portfolio={portfolio}
                riskProfile={riskProfile}
                onRemoveHolding={removeHolding}
                onRegenerate={async () => {
                  await generatePortfolio();
                  // Don't auto-save on regenerate, let user decide
                }}
                onSave={() => savePortfolioToDb(portfolio)}
                isSaving={isSaving}
                onEdit={() => {
                  setStep(0);
                  setPhase('questionnaire');
                }}
                onReplaceHolding={(oldSymbol, newStock) => replaceHolding(oldSymbol, newStock)}
              />
            )}

            {/* Simulation Disclaimer */}
            <div className="max-w-4xl mx-auto mt-8 p-4 rounded-lg bg-warning/10 border border-warning/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-warning mb-1">⚠️ Simulation Only – Not Investment Advice</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This portfolio simulation is provided for <strong>educational and research purposes only</strong>.
                    It does not constitute personalized financial advice or an investment recommendation.
                    ClaritX is not a registered investment advisor. Investments can go down as well as up, and you may lose some or all of your capital.
                    Please consult a licensed advisor before making investment decisions.{" "}
                    <Link to="/disclaimer" className="text-primary hover:underline">Read full disclaimer</Link>
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {phase === 'sector-builder' && riskProfile && (
          <SectorBuilder
            riskProfile={riskProfile}
            currentHoldings={portfolio?.holdings || []}
            onAddTicker={addHolding}
            onDone={handleSectorsDone}
            onBack={() => setPhase('profile')}
            investorFilters={extractFiltersFromProfile(profile)}
          />
        )}

        {/* Internal Linking CTA - Show on landing */}
        {phase === 'landing' && (
          <>
            <div className="mt-12 text-center">
              <div className="glass-card rounded-2xl p-8 max-w-2xl mx-auto border border-primary/20">
                <h2 className="text-2xl font-bold mb-4 text-foreground">
                  Explore <span className="text-primary">Top-Ranked</span> Stocks
                </h2>
                <p className="text-muted-foreground mb-6">
                  View our AI-powered stock rankings before building your portfolio.
                </p>
                <Link
                  to="/ai-stock-rank"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  View AI Stock Rankings
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Related Reading Section - SEO Internal Linking */}
            <section className="mt-16" aria-labelledby="portfolio-related-reading">
              <h2 id="portfolio-related-reading" className="text-2xl font-bold mb-6 text-center text-foreground">
                Learn About <span className="text-primary">Portfolio Building</span>
              </h2>
              <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
                <Link
                  to="/blog/best-stocks-to-buy-2026"
                  className="glass-card p-6 rounded-xl border border-border/50 hover:border-primary/50 transition-all group"
                >
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                    Best Stocks to Buy in 2026
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Discover top sectors and AI-driven stock selection strategies.
                  </p>
                </Link>
                <Link
                  to="/blog/how-to-analyze-stocks-complete-guide"
                  className="glass-card p-6 rounded-xl border border-border/50 hover:border-primary/50 transition-all group"
                >
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                    How to Analyze Stocks
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Master fundamental and technical analysis for smarter picks.
                  </p>
                </Link>
                <Link
                  to="/blog/why-claritx-multi-angle-analysis"
                  className="glass-card p-6 rounded-xl border border-border/50 hover:border-primary/50 transition-all group"
                >
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                    Multi-Angle Analysis
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Why analyzing stocks from 7 perspectives leads to better decisions.
                  </p>
                </Link>
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
