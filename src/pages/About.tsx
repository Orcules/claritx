import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead, BreadcrumbSchema } from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Shield, BarChart3, Brain, Users, Target, BookOpen } from "lucide-react";

export default function About() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="About ClaritX | AI Deep Research Platform"
        description="ClaritX is a free AI-powered deep research platform that evaluates stocks from 9 research perspectives. Built for educational purposes — learn how we work."
        canonicalUrl="/about"
      />
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "/" },
          { name: "About", url: "/about" },
        ]}
      />
      <Header />
      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Hero */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight mb-4">About ClaritX</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Free AI-powered stock market research from 9 analytical perspectives.
              Built for individual investors who want data-driven insights — not opinions.
            </p>
          </div>

          {/* Mission */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">What Is ClaritX?</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              ClaritX is an AI-powered stock analysis platform that evaluates any publicly traded stock, ETF, or fund from 9 distinct research perspectives: news sentiment, technical indicators, social media buzz, financial fundamentals, analyst consensus, peer comparison, insider activity, dividend health, and an AI synthesis verdict. The platform serves over 1,000 ranked assets and generates educational research content daily.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Founded in 2025, ClaritX was created to democratize the kind of multi-angle research that institutional investors take for granted. Every analysis is for <strong className="text-foreground">educational and informational purposes only</strong> — ClaritX is not a financial advisor, does not provide personalized investment recommendations, and is not registered with the SEC, FINRA, FCA, or any financial regulatory body.
            </p>
          </section>

          {/* How It Works */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6">How Does ClaritX Analyze Stocks?</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { icon: BarChart3, title: "Data Collection", desc: "Real-time market data from institutional-grade financial data providers, regulatory filings, and major financial news sources." },
                { icon: Brain, title: "AI Analysis", desc: "ClaritX's proprietary AI research engine analyzes each stock from 9 perspectives, citing real sources inline." },
                { icon: Target, title: "Quality Scoring", desc: "Each stock receives a 0-100 AI quality score based on fundamentals, momentum, and risk-adjusted metrics." },
              ].map((item) => (
                <Card key={item.title} className="border-border/50">
                  <CardContent className="pt-6">
                    <item.icon className="h-8 w-8 text-primary mb-3" />
                    <h3 className="font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Data Sources */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">What Data Sources Does ClaritX Use?</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Transparency about data provenance is critical for financial research tools. ClaritX sources data from:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              {[
                "Institutional-grade market data providers — real-time quotes, financial statements, analyst ratings, and insider transactions",
                "Official regulatory databases — public filings including earnings reports, insider ownership disclosures, and corporate actions",
                "AI-powered news search with verifiable source citations — news sentiment analysis grounded in real, citable sources",
                "Supplementary financial data feeds — historical price series and additional market metrics",
              ].map((source) => (
                <li key={source} className="flex gap-2">
                  <span className="text-primary mt-1 shrink-0">-</span>
                  <span>{source}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-4 text-sm italic">
              ClaritX does not have access to proprietary trading data, order flow, or non-public information. All data used is publicly available.
            </p>
          </section>

          {/* Who Is ClaritX For */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Who Is ClaritX Built For?</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              ClaritX is designed for individual retail investors who want to research stocks independently — without paying for institutional-grade terminals or relying on single-source opinions. It is useful for:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              {[
                "Self-directed investors who want to evaluate a stock before making a decision",
                "Students and learners building financial literacy through hands-on research tools",
                "Professionals who want a quick multi-angle overview of an unfamiliar company",
                "Anyone who wants to understand what is driving a stock's movement in the news",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-primary mt-1 shrink-0">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              ClaritX does not replace a licensed financial advisor. It is a research starting point, not an endpoint. Every analysis comes with an explicit reminder that it is educational only.
            </p>
          </section>

          {/* Editorial Standards */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Editorial Standards & Content Policy</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The <Link to="/blog" className="text-primary hover:underline">ClaritX blog</Link> publishes educational articles about stock analysis, investing strategies, and market research. Blog content is generated using ClaritX's AI research engine with real-time search grounding, ensuring that statistics, figures, and market data reference verifiable public sources.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              All published articles are reviewed against their cited data sources before publication. If an article contains an error or outdated information, corrections are applied and the article's update date is revised. To report a factual error, contact us at{" "}
              <a href="mailto:info@claritx.ai" className="text-primary hover:underline">info@claritx.ai</a>.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {["AI-Generated", "Search-Grounded Sources", "Educational Only", "Not Investment Advice"].map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          </section>

          {/* Trust & Safety */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Trust and Safety</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { icon: Shield, title: "Not Investment Advice", desc: "ClaritX is an educational research tool. Always consult a licensed financial professional before making investment decisions." },
                { icon: Users, title: "No Personalized Recommendations", desc: "ClaritX does not know your financial situation, risk tolerance, or investment goals. Analysis is general, not tailored." },
                { icon: BookOpen, title: "Full Transparency", desc: "Every AI analysis shows which data sources were used and which were unavailable. No black-box predictions." },
                { icon: Shield, title: "Regulatory Status", desc: "ClaritX is not registered with the SEC, FINRA, FCA, ESMA, or any financial regulatory authority. Read our full disclaimer." },
              ].map((item) => (
                <Card key={item.title} className="border-border/50">
                  <CardContent className="pt-6">
                    <item.icon className="h-6 w-6 text-primary mb-2" />
                    <h3 className="font-semibold mb-1 text-sm">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Founders */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Who Built ClaritX?</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              ClaritX was founded in 2025 by a team of three with deep experience in capital markets and financial technology. The founding team identified a persistent gap: retail investors making decisions based on single-source opinions that rarely held up under scrutiny, while institutional fund managers relied on multi-angle research frameworks that were simply inaccessible to individuals. ClaritX was built to crack that formula — combining real-time market data, AI synthesis, and 9-perspective scoring into a single research dashboard available to anyone.
            </p>
          </section>

          {/* Try the Tools */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Try the Tools</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { title: "Deep Research", desc: "9-perspective deep dive on any ticker", href: "/ai-stock-analysis" },
                { title: "AI Stock Rankings", desc: "Ranked scores for 1,000+ assets", href: "/ai-stock-rank" },
                { title: "Portfolio Simulator", desc: "Risk-profile based portfolio builder", href: "/portfolio-simulator" },
              ].map((tool) => (
                <Link key={tool.href} to={tool.href} className="block border border-border/50 rounded-lg p-4 hover:border-primary/50 transition-colors">
                  <p className="font-semibold text-foreground text-sm">{tool.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{tool.desc}</p>
                </Link>
              ))}
            </div>
          </section>

          {/* Contact */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Contact</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              For general questions and feedback, reach out via{" "}
              <a href="https://x.com/Clarit_X" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                @Clarit_X on X (Twitter)
              </a>{" "}or email{" "}
              <a href="mailto:info@claritx.ai" className="text-primary hover:underline">info@claritx.ai</a>.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              For business inquiries, partnerships, and press:{" "}
              <a href="mailto:business@claritx.ai" className="text-primary hover:underline">business@claritx.ai</a>.
            </p>
            <p className="text-muted-foreground mt-4">
              <Link to="/disclaimer" className="text-primary hover:underline">Disclaimer</Link>
              {" | "}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
              {" | "}
              <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
            </p>
          </section>

          <p className="text-xs text-muted-foreground border-t border-border/50 pt-6">
            Last updated: April 20, 2026
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
