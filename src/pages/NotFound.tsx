import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Home, Search, BookOpen, TrendingUp, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Page Not Found | 404 Error | ClaritX"
        description="The page you're looking for doesn't exist. Return to ClaritX homepage for AI-powered stock analysis and portfolio tools."
        noindex={true}
      />
      <Header />
      
      <main className="flex-1 flex items-center justify-center px-4 pt-20">
        <div className="text-center max-w-2xl mx-auto">
          {/* 404 Visual */}
          <div className="mb-8">
            <h1 className="text-8xl md:text-9xl font-display font-bold gradient-text mb-4">404</h1>
            <div className="w-24 h-1 bg-gradient-to-r from-primary to-secondary mx-auto rounded-full" />
          </div>
          
          {/* Error Message */}
          <h2 className="text-2xl md:text-3xl font-display font-semibold text-foreground mb-4">
            Page Not Found
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved. 
            Let's get you back on track.
          </p>
          
          {/* Primary Action */}
          <Link to="/">
            <Button size="lg" className="mb-8 gap-2">
              <Home className="h-4 w-4" />
              Return to Homepage
            </Button>
          </Link>
          
          {/* Quick Links */}
          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Popular Pages
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link 
                to="/ai-stock-rank" 
                className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
              >
                <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">AI Stock Rank</p>
                  <p className="text-xs text-muted-foreground">Analyze any stock</p>
                </div>
              </Link>
              
              <Link 
                to="/portfolio-simulator"
                className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
              >
                <Search className="h-4 w-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Portfolio Builder</p>
                  <p className="text-xs text-muted-foreground">Build your portfolio</p>
                </div>
              </Link>
              
              <Link 
                to="/blog" 
                className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
              >
                <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Blog</p>
                  <p className="text-xs text-muted-foreground">Investment guides</p>
                </div>
              </Link>
            </div>
          </div>
          
          {/* Back Button */}
          <button 
            onClick={() => window.history.back()} 
            className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back to previous page
          </button>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default NotFound;