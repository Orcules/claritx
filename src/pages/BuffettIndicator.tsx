import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SEOHead, BreadcrumbSchema, FAQSchema } from '@/components/SEOHead';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { TrendingUp, Calculator, Gauge, History, AlertTriangle, ArrowRight, BarChart3, Brain } from 'lucide-react';

// NOTE: the current reading is stated with an explicit "as of" date and named
// sources — the standard, honest way financial data is presented. It is not a
// live computed value (we don't fabricate an untested figure on a YMYL page);
// refresh the dated figure here when a newer authoritative reading is published.
const AS_OF = 'Q2 2026';
const CURRENT_RANGE = '~200–235% of GDP';

const faqs = [
  {
    question: "What is the Buffett Indicator right now (2026)?",
    answer: `As of ${AS_OF}, the U.S. Buffett Indicator stood near record highs — roughly ${CURRENT_RANGE} (total U.S. stock market capitalization divided by GDP), according to GuruFocus and Federal Reserve (FRED) data. Readings this far above the long-term average of ~85–100% have historically signaled an expensive market.`
  },
  {
    question: "How is the Buffett Indicator calculated?",
    answer: "The Buffett Indicator = Total U.S. stock market capitalization ÷ U.S. Gross Domestic Product (GDP), expressed as a percentage. Market cap is usually proxied by the Wilshire 5000 index; GDP is the latest annualized figure from the Bureau of Economic Analysis. A reading of 100% means the stock market is worth exactly one year of economic output."
  },
  {
    question: "What is considered a high or overvalued Buffett Indicator?",
    answer: "Commonly cited ranges: below ~90% is modestly undervalued, ~90–115% is fair value, ~115–135% is modestly overvalued, and above ~135% is significantly overvalued. The 2026 reading near 200%+ is among the highest in history, well into 'significantly overvalued' territory by this framework."
  },
  {
    question: "Did Warren Buffett actually create the Buffett Indicator?",
    answer: "Warren Buffett popularized it — in a 2001 Fortune interview he called market-cap-to-GDP 'probably the best single measure of where valuations stand at any given moment.' He didn't invent the math, but his endorsement gave it the name."
  },
  {
    question: "Does a high Buffett Indicator mean a crash is coming?",
    answer: "Not necessarily, and not on any specific timeline. A high reading signals elevated valuation risk and historically lower forward 10-year returns — but markets can stay 'expensive' for years. It's a long-term valuation gauge, not a timing tool. Use it for context, not for predicting short-term moves."
  },
  {
    question: "What are the limitations of the Buffett Indicator?",
    answer: "It ignores interest rates (low rates justify higher valuations), corporate profits earned abroad (which inflate market cap relative to domestic GDP), and the changing mix of the economy. That's why it's best used alongside other measures like the Shiller PE (CAPE) ratio rather than on its own."
  }
];

export default function BuffettIndicator() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Buffett Indicator 2026: Current Level & What It Means"
        description={`The Buffett Indicator (market cap to GDP) is near record highs in 2026 — roughly ${CURRENT_RANGE}. See the current level, how it's calculated, historical context, and what it means for investors.`}
        keywords="buffett indicator, buffett indicator 2026, buffett indicator current value, market cap to gdp, wilshire 5000 to gdp, is the stock market overvalued 2026"
        canonicalUrl="/buffett-indicator"
        noBrandSuffix
      />
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "/" },
          { name: "Buffett Indicator 2026", url: "/buffett-indicator" }
        ]}
      />
      <FAQSchema faqs={faqs} />

      <Header />

      <main className="container mx-auto px-4 pt-24 pb-16 flex-1">
        <article className="max-w-4xl mx-auto">
          <Breadcrumbs items={[{ label: "Buffett Indicator 2026" }]} className="mb-6" />

          <header className="mb-10">
            <Badge className="mb-4 bg-primary/10 text-primary">Market Valuation · Updated {AS_OF}</Badge>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
              Buffett Indicator 2026: Current Level &amp; What It Means
            </h1>
            {/* Answer-first block — the passage AI engines and the snippet quote */}
            <p className="text-xl text-muted-foreground">
              As of {AS_OF}, the U.S. Buffett Indicator — total stock market capitalization divided by GDP —
              sits near record highs at roughly <strong className="text-foreground">{CURRENT_RANGE}</strong>,
              per GuruFocus and Federal Reserve (FRED) data. That is well above the long-term average of
              ~85–100%, placing the market deep in historically &ldquo;overvalued&rdquo; territory.
            </p>
          </header>

          {/* Current reading card */}
          <Card className="mb-10 border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" /> Current Reading ({AS_OF})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-3xl font-bold text-foreground">{CURRENT_RANGE}</p>
              <p className="text-sm text-muted-foreground">
                Total U.S. market cap ÷ GDP. Sources: GuruFocus, Federal Reserve (FRED), Bureau of Economic Analysis.
                The Buffett Indicator updates as market prices move daily and GDP is revised quarterly — always
                cross-check the latest figure before acting.
              </p>
            </CardContent>
          </Card>

          {/* Key takeaways */}
          <h2 className="text-2xl font-display font-bold mb-3">Key Takeaways</h2>
          <ul className="list-disc pl-6 mb-10 space-y-1 text-muted-foreground">
            <li>The Buffett Indicator = total U.S. market cap ÷ GDP, expressed as a percentage.</li>
            <li>As of {AS_OF} it is near record highs ({CURRENT_RANGE}) — historically &ldquo;significantly overvalued.&rdquo;</li>
            <li>High readings correlate with lower forward 10-year returns, but are <em>not</em> a short-term timing signal.</li>
            <li>Best used alongside the Shiller PE (CAPE) ratio; it ignores interest rates and foreign profits.</li>
          </ul>

          <h2 id="how" className="text-2xl font-display font-bold mb-3 flex items-center gap-2">
            <Calculator className="h-5 w-5" /> How the Buffett Indicator Is Calculated
          </h2>
          <p className="text-muted-foreground mb-6">
            The formula is simple: divide the total market value of all publicly traded U.S. stocks
            (commonly proxied by the Wilshire 5000 index) by the country&rsquo;s annualized GDP, then multiply by 100.
            A reading of 100% means U.S. equities are collectively worth exactly one year of economic output.
            Warren Buffett called this ratio &ldquo;probably the best single measure of where valuations stand&rdquo;
            in a 2001 Fortune interview — which is how it earned his name.
          </p>

          <h2 id="interpret" className="text-2xl font-display font-bold mb-3 flex items-center gap-2">
            <Gauge className="h-5 w-5" /> How to Interpret the Reading
          </h2>
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-semibold">Buffett Indicator</th>
                  <th className="py-2 font-semibold">Commonly cited valuation</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50"><td className="py-2 pr-4">Below ~75%</td><td>Significantly undervalued</td></tr>
                <tr className="border-b border-border/50"><td className="py-2 pr-4">~75–90%</td><td>Modestly undervalued</td></tr>
                <tr className="border-b border-border/50"><td className="py-2 pr-4">~90–115%</td><td>Fair value</td></tr>
                <tr className="border-b border-border/50"><td className="py-2 pr-4">~115–135%</td><td>Modestly overvalued</td></tr>
                <tr className="border-b border-border/50"><td className="py-2 pr-4">Above ~135%</td><td>Significantly overvalued</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-foreground">{AS_OF}: {CURRENT_RANGE}</td><td className="font-medium text-foreground">Near record highs</td></tr>
              </tbody>
            </table>
          </div>

          <h2 id="history" className="text-2xl font-display font-bold mb-3 flex items-center gap-2">
            <History className="h-5 w-5" /> Historical Context
          </h2>
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-semibold">Period</th>
                  <th className="py-2 pr-4 font-semibold">Approx. reading</th>
                  <th className="py-2 font-semibold">What happened next</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50"><td className="py-2 pr-4">Long-term average</td><td className="py-2 pr-4">~85–100%</td><td>Baseline</td></tr>
                <tr className="border-b border-border/50"><td className="py-2 pr-4">Dot-com peak (2000)</td><td className="py-2 pr-4">~140–150%</td><td>2000–2002 bear market</td></tr>
                <tr className="border-b border-border/50"><td className="py-2 pr-4">Pre-2008</td><td className="py-2 pr-4">~105%</td><td>Global financial crisis</td></tr>
                <tr className="border-b border-border/50"><td className="py-2 pr-4">2021 peak</td><td className="py-2 pr-4">~200%+</td><td>2022 correction</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-foreground">{AS_OF}</td><td className="py-2 pr-4 font-medium text-foreground">{CURRENT_RANGE}</td><td className="font-medium text-foreground">Among the highest on record</td></tr>
              </tbody>
            </table>
          </div>

          <h2 id="meaning" className="text-2xl font-display font-bold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> What a Record-High Reading Means for Investors
          </h2>
          <p className="text-muted-foreground mb-6">
            A Buffett Indicator near 200%+ signals that valuations are stretched relative to the real economy,
            which historically has meant <strong className="text-foreground">lower expected returns over the next decade</strong> —
            not an imminent crash. Markets can stay expensive for years, especially when interest rates are low or
            earnings keep growing. The practical takeaway is risk management, not panic: favor quality and valuation
            discipline, keep diversifying, and judge individual stocks on their own fundamentals rather than the
            index average.
          </p>

          {/* Internal links to tools (crawl equity + conversion) */}
          <Card className="mb-10 bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="h-5 w-5 text-primary" /> Check valuations yourself — free
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">
                The Buffett Indicator is a market-wide gauge. To see how an individual stock is valued today,
                run it through ClaritX&rsquo;s free 9-perspective AI research:
              </p>
              <div className="flex flex-col gap-2">
                <Link to="/ai-stock-analysis" className="text-primary hover:underline flex items-center gap-1">
                  <ArrowRight className="h-4 w-4" /> Run a free 9-perspective AI analysis on any stock
                </Link>
                <Link to="/ai-stock-rank" className="text-primary hover:underline flex items-center gap-1">
                  <ArrowRight className="h-4 w-4" /> See AI Stock Rankings for 1,000+ stocks &amp; ETFs
                </Link>
                <Link to="/portfolio-simulator" className="text-primary hover:underline flex items-center gap-1">
                  <ArrowRight className="h-4 w-4" /> Build a portfolio with the free AI simulator
                </Link>
                <Link to="/blog/buffett-indicator-flashes-red-2026-market-valuations" className="text-primary hover:underline flex items-center gap-1">
                  <ArrowRight className="h-4 w-4" /> Deep dive: why the Buffett Indicator flashed red in 2026
                </Link>
              </div>
            </CardContent>
          </Card>

          <h2 className="text-2xl font-display font-bold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Frequently Asked Questions
          </h2>
          <div className="space-y-5 mb-10">
            {faqs.map((f) => (
              <div key={f.question}>
                <h3 className="font-semibold text-foreground mb-1">{f.question}</h3>
                <p className="text-muted-foreground text-sm">{f.answer}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground italic border-t border-border pt-6">
            For educational and informational purposes only — not investment advice. Figures are approximate,
            stated as of {AS_OF}, and sourced from GuruFocus, the Federal Reserve (FRED), and the Bureau of
            Economic Analysis. Always verify the latest reading and consult a licensed financial professional
            before making investment decisions.
          </p>
        </article>
      </main>

      <Footer />
    </div>
  );
}
