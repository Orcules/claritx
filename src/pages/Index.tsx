import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HeroIntent } from "@/components/HeroIntent";
import { MarketMoversSection } from "@/components/MarketMoversSection";
import { DailyOpportunitiesTeaser } from "@/components/DailyOpportunitiesTeaser";
import { SEOHead } from "@/components/SEOHead";
import { StockAnalysisToolSchema } from "@/components/seo";
import { EtoroAffiliateCTA } from "@/components/EtoroAffiliateCTA";

import { Link, useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Brain,
  LineChart,
  Shield,
  Zap,
  CheckCircle2,
  ArrowRight,
  Target,
  Eye,
  PieChart,
  Layers,
  Search,
  BarChart3,
  DollarSign,
  TrendingUp,
  BarChart2,
  Activity
} from "lucide-react";
import { useEffect, useState } from "react";


import { Hub } from 'aws-amplify/utils';
import { getCurrentUser } from 'aws-amplify/auth';

const Index = () => {
  const [searchParams] = useSearchParams();
  const symbolParam = searchParams.get('symbol');
  const navigate = useNavigate();
  const [typedText, setTypedText] = useState("");
  const [user, setUser] = useState<any>(null);
  const fullText = "AAPL";

  // Redirect /?symbol=X to /ai-stock-analysis?symbol=X
  if (symbolParam) {
    return <Navigate to={`/ai-stock-analysis?symbol=${symbolParam}`} replace />;
  }

  useEffect(() => {
    checkUser();

    const hubListenerCancelToken = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          checkUser();
          break;
        case 'signedOut':
          setUser(null);
          break;
      }
    });

    let i = 0;
    const interval = setInterval(() => {
      if (i <= fullText.length) {
        setTypedText(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 200);
    return () => {
      clearInterval(interval);
      hubListenerCancelToken();
    };
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      setUser(null);
    }
  };

  const handleSearch = (symbol: string) => {
    const upper = symbol.toUpperCase();
    navigate(`/ai-stock-analysis?symbol=${upper}`);
  };


  const analysisAngles = [
    { icon: BarChart3, title: "News Sentiment", desc: "Headlines & press analysis", color: "from-blue-500 to-cyan-500" },
    { icon: LineChart, title: "Technical Signals", desc: "Price patterns & indicators", color: "from-purple-500 to-pink-500" },
    { icon: Eye, title: "Market Buzz", desc: "Social media sentiment", color: "from-orange-500 to-red-500" },
    { icon: DollarSign, title: "Financials", desc: "Revenue, earnings & ratios", color: "from-green-500 to-emerald-500" },
    { icon: Target, title: "Analyst Views", desc: "Wall Street consensus", color: "from-yellow-500 to-orange-500" },
    { icon: BarChart2, title: "vs. Market", desc: "Relative performance", color: "from-indigo-500 to-purple-500" },
    { icon: Activity, title: "Insider Activity", desc: "Executive transactions", color: "from-rose-500 to-pink-500" },
    { icon: TrendingUp, title: "Dividend Health", desc: "Yield & payout analysis", color: "from-teal-500 to-cyan-500" },
    { icon: Sparkles, title: "AI Signal", desc: "Automated summary", color: "from-primary to-secondary" },
  ];

  const features = [
    { icon: Brain, title: "Multi-Angle Research", description: "9 comprehensive analysis perspectives: News, Technical, Social, Financials, Analysts, Market Comparison, Insider Activity, Dividends, and AI Signal." },
    { icon: LineChart, title: "Real-Time Market Data", description: "Live stock prices, RSI, Moving Averages, and other key technical indicators to support your independent research." },
    { icon: Shield, title: "Transparency First", description: "Clear data sources, confidence indicators, and risk warnings to help you understand the basis of each analysis." },
  ];

  const portfolioFeatures = [
    { icon: Target, title: "Risk Profiling", desc: "5-question profile" },
    { icon: PieChart, title: "Diversification Model", desc: "AI-powered sector allocation" },
    { icon: Layers, title: "Scenario Simulator", desc: "Build & test hypothetical portfolios" },
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* SEO Head and Structured Data */}
      <SEOHead
        title="ClaritX - AI Deep Research & Portfolio Simulator | Free Market Research"
        description="Deep research any stock from 9 perspectives: news sentiment, technicals, social buzz, financials, analyst ratings & more. Free AI-powered market research tool."
        keywords="deep research tool, AI stock analyzer, stock market research, portfolio simulator, technical analysis, fundamental analysis, stock sentiment analysis, free stock research"
        canonicalUrl="/"
      />
      <StockAnalysisToolSchema />

      <Header />

      <main className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 sm:pb-16" role="main">
          <div className="space-y-16 sm:space-y-24 lg:space-y-32">
            {/* Hero — intent chooser */}
            <HeroIntent onStockSearch={handleSearch} />

            {/* Sign in / pricing — secondary nav */}
            <div className="flex justify-center gap-4 -mt-8 sm:-mt-12 text-sm text-muted-foreground">
              <Link to="/pricing" className="hover:text-primary transition-colors flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Plans & Pricing
              </Link>
              {!user && (
                <>
                  <span className="text-muted-foreground/30">|</span>
                  <Link to="/auth" className="hover:text-primary transition-colors">
                    Sign In
                  </Link>
                </>
              )}
            </div>

            {/* Analysis Angles Section */}
            <section className="max-w-7xl mx-auto px-2 sm:px-0" aria-labelledby="analysis-heading">
              <div className="text-center mb-8 sm:mb-12 lg:mb-16">
                <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary font-medium text-xs sm:text-sm mb-4 sm:mb-6">
                  <Brain className="h-3 w-3 sm:h-4 sm:w-4" />
                  Automated Analysis Engine
                </div>
                <h2 id="analysis-heading" className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold animate-fade-up">
                  <span className="text-foreground">9 Perspectives of</span>{" "}
                  <span className="gradient-text">Market Research</span>
                </h2>
                <p className="mt-3 sm:mt-4 text-sm sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-up animation-delay-100 px-2">
                  Each stock is analyzed from multiple angles to provide comprehensive research data
                </p>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-9 gap-2 sm:gap-3">
                {analysisAngles.map((angle, index) => (
                  <div
                    key={angle.title}
                    className="glass-card-hover p-2 sm:p-3 lg:p-4 text-center group animate-fade-up relative overflow-hidden"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-300" style={{ backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))` }} />
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 mx-auto rounded-lg sm:rounded-xl bg-gradient-to-br ${angle.color} p-1.5 sm:p-2 lg:p-2.5 mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <angle.icon className="w-full h-full text-white" />
                    </div>
                    <h3 className="font-semibold text-[10px] sm:text-xs text-foreground leading-tight">{angle.title}</h3>
                    <p className="text-[8px] sm:text-[10px] text-muted-foreground mt-0.5 sm:mt-1 leading-tight hidden sm:block">{angle.desc}</p>
                  </div>
                ))}
              </div>

              <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-4 sm:mt-6">
                All analysis is automated and impersonal. Not investment advice.
              </p>
            </section>

            {/* Market Movers Section - Why stocks are moving today */}
            <MarketMoversSection />

            {/* Daily Opportunities Teaser */}
            <DailyOpportunitiesTeaser />

            <div className="max-w-4xl mx-auto px-4 mt-8 sm:mt-12 lg:mt-16">
              <p className="text-center text-[10px] text-muted-foreground mb-2">
                Affiliate disclosure: ClaritX may earn a commission if you sign up via the link below, at no extra cost to you.
              </p>
              <EtoroAffiliateCTA variant="inline" context="general" />
            </div>

            {/* Features Section */}
            <section className="max-w-6xl mx-auto px-2 sm:px-0" aria-labelledby="features-heading">
              <div className="grid lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 items-center">
                <div className="space-y-5 sm:space-y-6 lg:space-y-8">
                  <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-success/10 text-success font-medium text-xs sm:text-sm">
                    <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                    Free Research Tools
                  </div>

                  <h2 id="features-heading" className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold animate-fade-up">
                    <span className="text-foreground">Transparent</span>{" "}
                    <span className="gradient-text">AI Research</span>
                  </h2>

                  <div className="space-y-4 sm:space-y-5 lg:space-y-6">
                    {features.map((feature, index) => (
                      <div
                        key={feature.title}
                        className="flex gap-3 sm:gap-4 lg:gap-5 animate-fade-up"
                        style={{ animationDelay: `${(index + 1) * 100}ms` }}
                      >
                        <div className="feature-icon w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                          <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-base sm:text-lg text-foreground">{feature.title}</h3>
                          <p className="text-muted-foreground mt-0.5 sm:mt-1 text-sm sm:text-base">{feature.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Visual demo - hidden on small mobile */}
                <div className="relative animate-fade-up animation-delay-300 hidden sm:block">
                  <div className="glass-card p-4 sm:p-5 lg:p-6 space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary flex items-center justify-center">
                        <Search className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
                      </div>
                      <div className="flex-1 h-8 sm:h-10 rounded-lg bg-muted flex items-center px-3 sm:px-4">
                        <span className="text-foreground font-mono text-sm sm:text-base">{typedText}</span>
                        <span className="text-primary animate-pulse">|</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      {[
                        { label: "News", score: "Bullish", emoji: "📈", color: "text-success" },
                        { label: "Technical", score: "Bullish", emoji: "📈", color: "text-success" },
                        { label: "Social", score: "High Interest", emoji: "🔥", color: "text-warning" },
                        { label: "Financials", score: "Strong", emoji: "💪", color: "text-success" },
                      ].map((item, i) => (
                        <div key={item.label} className="p-2 sm:p-3 rounded-lg bg-muted/50 data-pulse" style={{ animationDelay: `${i * 200}ms` }}>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">{item.label}</p>
                          <p className={`font-semibold text-sm sm:text-base ${item.color}`}>{item.emoji} {item.score}</p>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 sm:p-4 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
                      <div className="flex items-center gap-2 mb-1 sm:mb-2">
                        <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                        <span className="text-xs sm:text-sm font-semibold text-foreground">AI Signal Summary</span>
                      </div>
                      <p className="text-success font-bold text-base sm:text-lg">📊 Bullish Signals Detected</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Automated analysis • Not investment advice</p>
                    </div>
                  </div>

                  {/* Decorative elements */}
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-2xl floating" />
                  <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-br from-secondary/20 to-transparent rounded-full blur-2xl floating-delayed" />
                </div>
              </div>
            </section>

            {/* Portfolio Simulator Section */}
            <section className="max-w-6xl mx-auto px-2 sm:px-0" aria-labelledby="portfolio-heading">
              <div className="relative glass-card p-5 sm:p-8 md:p-12 lg:p-16 overflow-hidden">
                {/* Background effects */}
                <div className="absolute top-0 right-0 w-48 sm:w-72 lg:w-96 h-48 sm:h-72 lg:h-96 bg-gradient-to-bl from-secondary/20 to-transparent rounded-full blur-3xl" aria-hidden="true" />
                <div className="absolute bottom-0 left-0 w-32 sm:w-48 lg:w-64 h-32 sm:h-48 lg:h-64 bg-gradient-to-tr from-primary/20 to-transparent rounded-full blur-3xl" aria-hidden="true" />

                <div className="relative grid lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 items-center">
                  <div className="space-y-4 sm:space-y-5 lg:space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-secondary/10 text-secondary font-medium text-xs sm:text-sm">
                      <PieChart className="h-3 w-3 sm:h-4 sm:w-4" />
                      Portfolio Simulator
                    </div>

                    <h2 id="portfolio-heading" className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold">
                      <span className="text-foreground">Simulate a Portfolio</span><br />
                      <span className="gradient-text">Scenario</span>
                    </h2>

                    <p className="text-sm sm:text-base lg:text-lg text-muted-foreground">
                      Answer a quick questionnaire about your preferences and risk tolerance.
                      Our system will generate a diversified portfolio idea tailored to your profile.
                    </p>

                    <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
                      {portfolioFeatures.map((item, index) => (
                        <div key={item.title} className="p-2 sm:p-3 lg:p-4 rounded-lg sm:rounded-xl bg-card/50 border border-border animate-fade-up" style={{ animationDelay: `${index * 100}ms` }}>
                          <item.icon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-secondary mb-1 sm:mb-2" />
                          <p className="font-semibold text-[10px] sm:text-xs lg:text-sm text-foreground leading-tight">{item.title}</p>
                          <p className="text-[8px] sm:text-[10px] lg:text-xs text-muted-foreground mt-0.5 leading-tight hidden sm:block">{item.desc}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-3 items-start">
                      <Link to="/portfolio-simulator" className="w-full sm:w-auto">
                        <Button size="lg" variant="secondary" className="gap-2 w-full sm:w-auto text-sm sm:text-base">
                          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                          Start Simulation
                          <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                      </Link>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        Hypothetical scenarios · Not investment advice
                      </p>
                    </div>
                  </div>

                  {/* Visual representation - Pie Chart */}
                  <div className="relative hidden sm:block">
                    <div className="aspect-square max-w-xs sm:max-w-sm mx-auto relative">
                      {/* Pie chart visualization using proper segments */}
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        {/* Background circle */}
                        <circle cx="50" cy="50" r="35" fill="hsl(var(--muted))" />

                        {/* Pie segments - Tech 30% */}
                        <circle
                          cx="50" cy="50" r="42"
                          fill="none"
                          stroke="hsl(var(--primary))"
                          strokeWidth="14"
                          strokeDasharray="79.17 184.83"
                          strokeDashoffset="0"
                          className="drop-shadow-md"
                        />
                        {/* Healthcare 20% */}
                        <circle
                          cx="50" cy="50" r="42"
                          fill="none"
                          stroke="hsl(var(--secondary))"
                          strokeWidth="14"
                          strokeDasharray="52.78 211.22"
                          strokeDashoffset="-79.17"
                          className="drop-shadow-md"
                        />
                        {/* Finance 25% */}
                        <circle
                          cx="50" cy="50" r="42"
                          fill="none"
                          stroke="hsl(38 95% 50%)"
                          strokeWidth="14"
                          strokeDasharray="65.97 198.03"
                          strokeDashoffset="-131.95"
                          className="drop-shadow-md"
                        />
                        {/* Energy 25% */}
                        <circle
                          cx="50" cy="50" r="42"
                          fill="none"
                          stroke="hsl(200 70% 50%)"
                          strokeWidth="14"
                          strokeDasharray="65.97 198.03"
                          strokeDashoffset="-197.92"
                          className="drop-shadow-md"
                        />
                      </svg>

                      {/* Center content */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center bg-card rounded-full w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 flex flex-col items-center justify-center shadow-lg">
                          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">12</p>
                          <p className="text-[8px] sm:text-[10px] lg:text-xs text-muted-foreground">Holdings</p>
                        </div>
                      </div>

                      {/* Floating labels */}
                      <div className="absolute top-2 right-0 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-primary text-primary-foreground text-[10px] sm:text-xs font-medium shadow-md floating">
                        Tech 30%
                      </div>
                      <div className="absolute bottom-2 left-0 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-secondary text-secondary-foreground text-[10px] sm:text-xs font-medium shadow-md floating-delayed">
                        Healthcare 20%
                      </div>
                      <div className="absolute top-1/2 -right-2 sm:-right-4 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-warning text-warning-foreground text-[10px] sm:text-xs font-medium shadow-md floating-slow">
                        Finance 25%
                      </div>
                      <div className="absolute bottom-1/4 -left-2 sm:-left-4 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-blue-500 text-white text-[10px] sm:text-xs font-medium shadow-md floating">
                        Energy 25%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Benefits Section */}
            <section className="max-w-5xl mx-auto text-center px-2 sm:px-0" aria-labelledby="benefits-heading">
              <h2 id="benefits-heading" className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-6 sm:mb-8 lg:mb-12 animate-fade-up">
                <span className="text-foreground">Everything You Need for</span><br />
                <span className="gradient-text">Smarter Investing</span>
              </h2>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                {[
                  { icon: CheckCircle2, text: "9 comprehensive research perspectives" },
                  { icon: CheckCircle2, text: "Real-time market data" },
                  { icon: CheckCircle2, text: "Automated sentiment analysis" },
                  { icon: CheckCircle2, text: "Hypothetical portfolio simulation" },
                  { icon: CheckCircle2, text: "Sector diversification models" },
                  { icon: CheckCircle2, text: "Export & save for research" },
                ].map((item, index) => (
                  <div
                    key={item.text}
                    className="flex items-center gap-2 sm:gap-3 lg:gap-4 p-3 sm:p-4 lg:p-5 glass-card animate-fade-up"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                      <item.icon className="h-4 w-4 sm:h-4.5 sm:w-4.5 lg:h-5 lg:w-5 text-success" />
                    </div>
                    <span className="text-foreground font-medium text-left text-xs sm:text-sm lg:text-base leading-tight">{item.text}</span>
                  </div>
                ))}
              </div>

              <p className="text-center text-[10px] sm:text-xs lg:text-sm text-muted-foreground mt-6 sm:mt-8">
                Not investment advice.
              </p>
            </section>

            {/* CTA Section */}
            <section className="max-w-4xl mx-auto text-center py-8 sm:py-10 lg:py-12 px-2 sm:px-0" aria-labelledby="cta-heading">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 rounded-2xl sm:rounded-3xl blur-2xl animate-pulse" aria-hidden="true" />
                <div className="relative glass-card p-6 sm:p-10 md:p-12 lg:p-16 rounded-2xl sm:rounded-3xl border-primary/20">
                  <h2 id="cta-heading" className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-4 sm:mb-6">
                    Start Your Research with <span className="text-primary">Clarit</span><span className="text-secondary">X</span>
                  </h2>
                  <p className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground mb-6 sm:mb-8 lg:mb-10 max-w-xl mx-auto">
                    Explore any stock or simulate a portfolio scenario. All tools are free.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                    <Button size="lg" variant="outline" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="gap-2 text-sm sm:text-base">
                      <Search className="h-4 w-4 sm:h-5 sm:w-5" />
                      Research a Stock
                    </Button>
                    <Link to="/portfolio-simulator">
                      <Button size="lg" className="gap-2 w-full sm:w-auto text-sm sm:text-base">
                        <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                        Simulate Portfolio
                        <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                      </Button>
                    </Link>
                  </div>
                  <div className="mt-6 sm:mt-8 inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-full bg-muted/50 border border-border">
                    <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                    <span className="text-foreground font-medium text-xs sm:text-sm lg:text-base">No signup required • Free to use</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Related Reading Section - SEO Internal Linking */}
            <section className="max-w-5xl mx-auto py-8 sm:py-12" aria-labelledby="learn-more-heading">
              <h2 id="learn-more-heading" className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center text-foreground">
                Learn About <span className="text-primary">Smart Investing</span>
              </h2>
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Link
                  to="/blog/best-stocks-to-buy-2026"
                  className="glass-card p-5 sm:p-6 rounded-xl border border-border/50 hover:border-primary/50 transition-all group"
                >
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                    Best Stocks to Buy in 2026
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    AI-powered analysis reveals top sectors and data-driven stock selection strategies.
                  </p>
                </Link>
                <Link
                  to="/blog/how-to-analyze-stocks-complete-guide"
                  className="glass-card p-5 sm:p-6 rounded-xl border border-border/50 hover:border-primary/50 transition-all group"
                >
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                    How to Analyze Stocks
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Complete guide to fundamental analysis, technical analysis, and AI-powered tools.
                  </p>
                </Link>
                <Link
                  to="/blog/ai-hallucinations-financial-data"
                  className="glass-card p-5 sm:p-6 rounded-xl border border-border/50 hover:border-primary/50 transition-all group"
                >
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                    AI Hallucinations in Finance
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Why verified data matters and how to avoid AI-generated misinformation.
                  </p>
                </Link>
              </div>
              <div className="text-center mt-6 sm:mt-8">
                <Link
                  to="/blog"
                  className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                >
                  View all articles
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>
          </div>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
