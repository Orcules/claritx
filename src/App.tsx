import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense } from "react";
import { DisclaimerProvider } from "./components/OnboardingDisclaimer";
import { CookieConsent } from "./components/CookieConsent";
import { GoogleAnalytics } from "./components/seo";
import { AuthModalProvider, useAuthModal } from "./context/AuthModalContext";
import { AuthModal } from "./components/AuthModal";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ScrollToTop } from "./components/ScrollToTop";

// All pages are lazy-loaded for optimal code splitting.
// The SPA shell renders instantly; each route chunk loads on navigation.
const Index = lazy(() => import("./pages/Index"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const StockPage = lazy(() => import("./pages/StockPage"));
const StocksIndex = lazy(() => import("./pages/StocksIndex"));
const AIStockAnalysis = lazy(() => import("./pages/AIStockAnalysis"));
const DeepResearch = lazy(() => import("./pages/DeepResearch"));
const AIStockRank = lazy(() => import("./pages/AIStockRank"));
const Auth = lazy(() => import("./pages/Auth"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));
const RiskAssessment = lazy(() => import("./pages/RiskAssessment"));
const PortfolioBuilder = lazy(() => import("./pages/PortfolioBuilder"));
const PortfolioAnalysis = lazy(() => import("./pages/PortfolioAnalysis"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const Disclaimer = lazy(() => import("./pages/Disclaimer"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ActivityLogs = lazy(() => import("./pages/ActivityLogs"));
const RankingDashboard = lazy(() => import("./pages/RankingDashboard"));
const BlogGenerator = lazy(() => import("./pages/BlogGenerator"));
const AIStockAnalysisPillar = lazy(() => import("./pages/AIStockAnalysisPillar"));
const BuffettIndicator = lazy(() => import("./pages/BuffettIndicator"));
const BatchAnalysis = lazy(() => import("./pages/BatchAnalysis"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Account = lazy(() => import("./pages/Account"));
const MarketOpportunitiesPage = lazy(() => import("./pages/MarketOpportunitiesPage"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));

const queryClient = new QueryClient();

// Redirect /path/ → /path (trailing slash canonical)
function TrailingSlashRedirect() {
  const { pathname, search, hash } = useLocation();
  if (pathname !== '/' && pathname.endsWith('/')) {
    return <Navigate to={pathname.slice(0, -1) + search + hash} replace />;
  }
  return null;
}

// Google Analytics measurement ID - replace with your actual ID
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-L8FEGNH3RR';

// All routes wrapped in a blur filter when the auth modal is open
function AppShell() {
  const { isOpen } = useAuthModal();
  return (
    <div className={`transition-[filter] duration-200${isOpen ? ' blur-sm pointer-events-none select-none' : ''}`}>
      {GA_MEASUREMENT_ID && <GoogleAnalytics measurementId={GA_MEASUREMENT_ID} />}
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/my-portfolio" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
        {/* Portfolio Simulator (renamed from portfolio-builder) */}
        <Route path="/portfolio-simulator" element={<PortfolioBuilder />} />
        <Route path="/portfolio-builder" element={<Navigate to="/portfolio-simulator" replace />} />
        <Route path="/portfolio-analysis" element={<ProtectedRoute><PortfolioAnalysis /></ProtectedRoute>} />
        {/* Stock Pages - SEO Critical */}
        <Route path="/stocks/:symbol" element={<StockPage />} />
        <Route path="/stocks" element={<StocksIndex />} />
        {/* Blog */}
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        {/* Legal */}
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        {/* Tools */}
        <Route path="/risk-assessment/:token" element={<ProtectedRoute><RiskAssessment /></ProtectedRoute>} />
        <Route path="/activity-logs" element={<ProtectedRoute><ActivityLogs /></ProtectedRoute>} />
        <Route path="/ranking-dashboard" element={<RankingDashboard />} />
        <Route path="/ai-stock-rank" element={<AIStockRank />} />
        <Route path="/ai-stock-analysis" element={<AIStockAnalysis />} />
        <Route path="/deep-research" element={<DeepResearch />} />
        <Route path="/ai-stock-analysis-guide" element={<AIStockAnalysisPillar />} />
        <Route path="/buffett-indicator" element={<BuffettIndicator />} />
        <Route path="/market-opportunities" element={<MarketOpportunitiesPage />} />
        <Route path="/admin/blog-generator" element={<ProtectedRoute requireAdmin={true}><BlogGenerator /></ProtectedRoute>} />
        <Route path="/admin/batch-analysis" element={<ProtectedRoute requireAdmin={true}><BatchAnalysis /></ProtectedRoute>} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <DisclaimerProvider>
          <AuthModalProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <TrailingSlashRedirect />
              <ScrollToTop />
              {/* AuthModal portals to document.body — stays sharp above the blur */}
              <AuthModal />
              <AppShell />
              <CookieConsent />
            </BrowserRouter>
          </AuthModalProvider>
        </DisclaimerProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
