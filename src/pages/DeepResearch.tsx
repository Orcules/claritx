import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead, BreadcrumbSchema, FAQSchema, ArticleSchema } from "@/components/SEOHead";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sparkles,
  TrendingUp,
  BarChart3,
  LineChart,
  Newspaper,
  Users,
  Target,
  Shield,
  PieChart,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Brain,
  Search,
  Building2,
  Landmark,
} from "lucide-react";

const analysisAngles = [
  {
    icon: BarChart3,
    title: "Fundamental Analysis",
    description: "Financial statements, valuations, P/E ratios, debt levels, and growth metrics",
    color: "text-blue-500",
  },
  {
    icon: LineChart,
    title: "Technical Analysis",
    description: "Price patterns, moving averages, RSI, MACD, and volume indicators",
    color: "text-emerald-500",
  },
  {
    icon: Newspaper,
    title: "News Sentiment",
    description: "Real-time news monitoring with AI-powered sentiment scoring",
    color: "text-amber-500",
  },
  {
    icon: Users,
    title: "Social Sentiment",
    description: "Community discussions, retail investor sentiment, and trending topics",
    color: "text-purple-500",
  },
  {
    icon: Target,
    title: "Analyst Ratings",
    description: "Wall Street consensus, price targets, and upgrade/downgrade history",
    color: "text-rose-500",
  },
  {
    icon: Shield,
    title: "Risk Assessment",
    description: "Volatility metrics, beta, drawdown analysis, and risk-adjusted returns",
    color: "text-cyan-500",
  },
  {
    icon: PieChart,
    title: "Sector Analysis",
    description: "Industry positioning, peer comparisons, and sector trends",
    color: "text-orange-500",
  },
  {
    icon: TrendingUp,
    title: "Momentum & Trend",
    description: "Short and long-term price momentum and trend strength indicators",
    color: "text-green-500",
  },
  {
    icon: Brain,
    title: "AI Quality Score",
    description: "Composite score synthesizing all dimensions into a 0-100 research rating",
    color: "text-primary",
  },
];

const relatedBlogPosts = [
  {
    slug: "how-to-analyze-stocks-complete-guide",
    title: "How to Analyze Stocks: Complete 2026 Beginner's Guide",
    description: "Master fundamental and technical analysis with this comprehensive guide",
    readTime: 15,
    category: "Education",
  },
  {
    slug: "best-stocks-to-buy-2026",
    title: "Best Stocks to Buy in 2026: AI-Powered Analysis Guide",
    description: "Data-driven strategies and top sectors for smart investing",
    readTime: 10,
    category: "Strategy",
  },
  {
    slug: "ai-stock-screener-comparison-2026",
    title: "Best AI Stock Screeners 2026: Complete Comparison",
    description: "Find the right AI-powered platform for your research needs",
    readTime: 12,
    category: "Tools",
  },
  {
    slug: "hidden-dangers-ai-stock-analysis",
    title: "The Hidden Dangers of AI Stock Analysis",
    description: "Avoid common pitfalls when using AI for investment research",
    readTime: 10,
    category: "Risk",
  },
  {
    slug: "ai-hallucinations-financial-data",
    title: "AI Hallucinations in Financial Data: What Investors Must Know",
    description: "Understanding and mitigating AI reliability issues in finance",
    readTime: 8,
    category: "AI Safety",
  },
  {
    slug: "why-claritx-multi-angle-analysis",
    title: "Why 7 Angles Beat Single-Source Stock Research",
    description: "The case for multi-dimensional analysis in modern investing",
    readTime: 8,
    category: "Methodology",
  },
];

const assetTypes = [
  { icon: BarChart3, label: "Individual Stocks", description: "U.S. equities from NYSE and NASDAQ" },
  { icon: Landmark, label: "ETFs", description: "Exchange-traded funds across all sectors" },
  { icon: Building2, label: "Mutual Funds", description: "Actively managed investment funds" },
];

const faqItems = [
  {
    question: "How accurate is AI stock analysis?",
    answer: "AI stock analysis provides data-driven insights that eliminate emotional bias, but no analysis method can predict the future with certainty. ClaritX uses verified financial data sources and clearly distinguishes between factual data and AI-generated interpretations. All analysis is for educational purposes only and should not be the sole basis for investment decisions.",
  },
  {
    question: "What data sources does ClaritX use for analysis?",
    answer: "ClaritX integrates data from institutional-grade financial data providers for real-time quotes and financial statements, news aggregators for sentiment analysis, and our proprietary AI research engine for synthesizing insights. All data sources are clearly cited to ensure transparency and verifiability.",
  },
  {
    question: "Is ClaritX a stock recommendation service?",
    answer: "No. ClaritX is an educational research platform that provides AI-powered analysis and research scores for informational purposes only. We do not provide personalized investment advice, buy/sell recommendations, or price targets. Always consult a licensed financial advisor before making investment decisions.",
  },
  {
    question: "How is the AI Research Score calculated?",
    answer: "The AI Research Score (0-100) is a composite metric that synthesizes fundamental strength, technical momentum, sentiment analysis, risk factors, and growth metrics. Higher scores indicate stronger research profiles across multiple dimensions. The score is updated regularly as new data becomes available.",
  },
  {
    question: "What asset types can I analyze with ClaritX?",
    answer: "ClaritX provides analysis for individual stocks (U.S. equities), ETFs (exchange-traded funds), and mutual funds. Each asset type has specialized analysis tailored to its characteristics—for example, ETFs include expense ratio analysis.",
  },
];


export default function DeepResearch() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* SEO */}
      <SEOHead
        title="AI Deep Research Guide - Multi-Angle Research Platform | ClaritX"
        description="Comprehensive guide to AI-powered deep research. Learn how ClaritX uses 9 research perspectives to analyze stocks, ETFs, crypto & funds. Free educational research tools."
        keywords="AI deep research, stock research, fundamental analysis, technical analysis, stock screener, AI investing, stock analysis tools, multi-factor analysis, stock ratings"
        canonicalUrl="/deep-research"
      />
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "/" },
          { name: "Deep Research", url: "/deep-research" },
        ]}
      />
      <ArticleSchema
        title="AI Deep Research: Complete Guide to Multi-Angle Research"
        description="Learn how AI-powered deep research works and how ClaritX uses 9 research perspectives to provide comprehensive insights for educational purposes."
        publishedTime="2026-01-01"
        modifiedTime="2026-04-21"
        author="ClaritX Research Team"
        image="/og-image.png"
        url="/deep-research"
        tags={["AI deep research", "stock research", "fundamental analysis", "technical analysis"]}
      />
      <FAQSchema faqs={faqItems} />

      <Header />

      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Breadcrumbs */}
          <Breadcrumbs items={[{ label: "Deep Research" }]} className="mb-8" />

          {/* Hero Section */}
          <section className="max-w-4xl mx-auto text-center mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3 mr-1" />
              Comprehensive Research Guide
            </Badge>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6">
              AI-Powered{" "}
              <span className="bg-gradient-to-r from-primary via-chart-1 to-chart-2 bg-clip-text text-transparent">
                Deep Research
              </span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Discover how ClaritX combines 9 research perspectives with artificial intelligence
              to provide comprehensive, educational analysis of stocks, ETFs, and mutual funds.
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild size="lg" className="gap-2">
                <Link to="/ai-stock-rank">
                  <Zap className="h-5 w-5" />
                  View AI Rankings
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="gap-2">
                <Link to="/ai-stock-analysis">
                  <Search className="h-5 w-5" />
                  Analyze a Stock
                </Link>
              </Button>
            </div>
          </section>

          {/* What is AI Stock Analysis */}
          <section className="max-w-4xl mx-auto mb-20">
            <h2 className="text-3xl font-bold mb-6 text-center">
              What is AI Deep Research?
            </h2>
            <div className="prose prose-lg dark:prose-invert mx-auto">
              <p className="text-muted-foreground text-lg leading-relaxed">
                AI stock analysis leverages machine learning and natural language processing
                to analyze vast quantities of financial data that would be impossible for
                humans to process manually. Modern AI systems can simultaneously evaluate
                fundamental metrics, technical indicators, news sentiment, social media buzz,
                and risk factors—synthesizing these dimensions into actionable research insights.
              </p>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Unlike traditional single-source analysis, AI-powered platforms like ClaritX
                provide <strong>multi-angle perspectives</strong> that help investors understand
                the complete picture. This approach reduces blind spots and provide more
                balanced, data-driven research for educational purposes.
              </p>
            </div>
          </section>

          {/* 9 Analysis Angles */}
          <section className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">
                9 Perspectives of AI Deep Research
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                ClaritX analyzes every asset through 9 distinct research angles,
                providing comprehensive insights that single-metric tools cannot match.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {analysisAngles.map((angle) => (
                <Card key={angle.title} className="glass-card hover:border-primary/30 transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-muted ${angle.color}`}>
                        <angle.icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-lg">{angle.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">
                      {angle.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Asset Types */}
          <section className="mb-20 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center">
              Analyze Any Asset Type
            </h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {assetTypes.map((type) => (
                <div key={type.label} className="flex items-start gap-4 p-5 rounded-xl border bg-card/50">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary">
                    <type.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{type.label}</h3>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* How It Works */}
          <section className="mb-20 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center">
              How ClaritX AI Analysis Works
            </h2>
            <div className="space-y-6">
              {[
                {
                  step: "1",
                  title: "Data Aggregation",
                  description: "ClaritX pulls real-time data from verified financial APIs including price quotes, financial statements, news feeds, and market indicators.",
                },
                {
                  step: "2",
                  title: "Multi-Dimensional Processing",
                  description: "Our AI analyzes data across 9 perspectives simultaneously—fundamentals, technicals, sentiment, risk, and more—to build a complete research picture.",
                },
                {
                  step: "3",
                  title: "AI Synthesis",
                  description: "ClaritX's proprietary AI engine synthesizes all dimensions into coherent insights, generating research summaries, quality scores, and key findings.",
                },
                {
                  step: "4",
                  title: "Quality Validation",
                  description: "Every AI response is validated against source data to minimize hallucinations and ensure factual accuracy in reported metrics.",
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-primary-foreground font-bold">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">{item.title}</h3>
                    <p className="text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Benefits & Limitations */}
          <section className="mb-20 max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Benefits */}
              <Card className="bg-emerald-500/5 border-emerald-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                    Benefits of AI Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    "Process thousands of data points instantly",
                    "Eliminate emotional bias from research",
                    "Analyze multiple dimensions simultaneously",
                    "Consistent, repeatable methodology",
                    "Access institutional-grade insights",
                    "Save hours of manual research time",
                  ].map((benefit) => (
                     <div key={benefit} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{benefit}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Limitations */}
              <Card className="bg-warning/5 border-warning/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-warning">
                    <AlertTriangle className="h-5 w-5" />
                    Limitations to Understand
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    "Cannot predict future market movements",
                    "AI may occasionally produce errors",
                    "Historical data ≠ future performance",
                    "Not a replacement for professional advice",
                    "Should be one input among many",
                    "Market conditions can change rapidly",
                  ].map((limitation) => (
                    <div key={limitation} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{limitation}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Related Blog Posts */}
          <section className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">
                Learn More: Educational Resources
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Deepen your understanding of AI stock analysis with our comprehensive guides
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {relatedBlogPosts.map((post) => (
                <Link key={post.slug} to={`/blog/${post.slug}`} className="group">
                  <Card className="h-full hover:border-primary/30 transition-all group-hover:shadow-lg">
                    <CardHeader>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs">
                          {post.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {post.readTime} min read
                        </span>
                      </div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {post.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{post.description}</CardDescription>
                      <div className="mt-4 flex items-center text-sm text-primary font-medium">
                        Read Article
                        <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            <div className="text-center mt-8">
              <Button asChild variant="outline" size="lg">
                <Link to="/blog" className="gap-2">
                  <BookOpen className="h-5 w-5" />
                  View All Articles
                </Link>
              </Button>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="mb-20 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              {faqItems.map((faq, index) => (
                <div key={index} className="p-6 rounded-xl border bg-card/50">
                  <h3 className="font-semibold text-lg mb-3 text-foreground">
                    {faq.question}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA Section */}
          <section className="max-w-4xl mx-auto text-center">
            <Card className="bg-gradient-to-br from-primary/10 via-chart-1/5 to-chart-2/10 border-primary/20">
              <CardContent className="py-12 px-8">
                <h2 className="text-3xl font-bold mb-4">
                  Ready to Try AI Deep Research?
                </h2>
                <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
                  Explore our AI-powered research tools and discover multi-angle
                  insights for your investment education journey.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Button asChild size="lg" className="gap-2">
                    <Link to="/ai-stock-rank">
                      <Zap className="h-5 w-5" />
                      Explore AI Rankings
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="gap-2">
                    <Link to="/portfolio-simulator">
                      <PieChart className="h-5 w-5" />
                      Build a Portfolio
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Disclaimer */}
          <section className="max-w-3xl mx-auto mt-16">
            <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-warning">Educational Purpose Only:</strong> ClaritX provides
                  AI-powered research tools for educational and informational purposes. This content does
                  not constitute personalized investment advice. ClaritX is not a registered investment
                  advisor. Past performance does not guarantee future results. Always consult a licensed
                  financial advisor before making investment decisions.{" "}
                  <Link to="/disclaimer" className="text-primary hover:underline">
                    Read full disclaimer
                  </Link>
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
