import { lazy, Suspense } from "react";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
const Footer = lazy(() => import("@/components/Footer").then(m => ({ default: m.Footer })));
const MarketOpportunities = lazy(() => import("@/components/MarketOpportunities").then(m => ({ default: m.MarketOpportunities })));

const MarketOpportunitiesPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="AI Market Opportunities - News-Driven Stock Catalysts | ClaritX"
        description="AI-scanned financial news identifying stocks with potential positive catalysts. Updated every 12 hours. For educational research only."
        keywords="market opportunities, stock catalysts, AI news scanner, stock news analysis, investment research"
        canonicalUrl="/market-opportunities"
      />
      <Header />
      <main className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 sm:pb-16" role="main">
        <div className="max-w-7xl mx-auto">
          <Suspense fallback={null}>
            <MarketOpportunities />
          </Suspense>
        </div>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
};

export default MarketOpportunitiesPage;
