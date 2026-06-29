import { Menu, X, LogIn, Users, Sparkles, User, LogOut, PieChart, BookOpen, Trophy, BarChart3, LineChart, Database, Newspaper, Crown, Zap, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { CreditBalance } from "./CreditBalance";
import { useUserCredits } from "@/hooks/useUserCredits";
import { fetchAuthSession, getCurrentUser, signOut } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { useTheme } from "next-themes";

function AccountButton({ userRole }: { userRole: string | null }) {
  const { credits } = useUserCredits();
  const isPro = credits?.subscription_tier === 'pro';
  return (
    <Button variant="ghost" size="sm">
      {isPro
        ? <Crown className="h-4 w-4 mr-2 text-yellow-500" />
        : <Zap className="h-4 w-4 mr-2 text-muted-foreground" />
      }
      Account
    </Button>
  );
}

function MobileAccountLink() {
  const { credits } = useUserCredits();
  const isPro = credits?.subscription_tier === 'pro';
  return (
    <Link to="/account" className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
      {isPro
        ? <Crown className="h-4 w-4 text-yellow-500" />
        : <Zap className="h-4 w-4" />
      }
      {isPro ? 'Account & Subscription' : 'Account — Upgrade to Pro'}
    </Link>
  );
}
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

interface CognitoUser {
  username: string;
  userId: string;
  signInDetails?: any;
}

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<CognitoUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    checkUser();

    const hubListenerCancelToken = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          checkUser();
          break;
        case 'signedOut':
          setUser(null);
          setUserRole(null);
          break;
      }
    });

    return () => hubListenerCancelToken();
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      const session = await fetchAuthSession();
      const groups = session.tokens?.accessToken?.payload['cognito:groups'] as string[] | undefined;
      setUserRole(groups && groups.includes('Admins') ? 'admin' : 'user');
    } catch (err) {
      setUser(null);
      setUserRole(null);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-card border-t-0 rounded-t-none">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to={{ pathname: "/", search: "" }} className="flex items-center group">
            <div className="overflow-hidden h-12">
              <img
                src={resolvedTheme === 'light' ? '/logo-black.png' : '/logo-white.png'}
                alt="ClaritX - AI Deep Research & Portfolio Research Platform"
                width={96}
                height={48}
                className="h-24 w-auto transition-transform duration-300 group-hover:scale-105 -mt-6"
              />
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            <ThemeToggle />
            <CreditBalance />

            {/* Research Tools Dropdown */}
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent h-9">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Research
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[300px] gap-2 p-4">
                      <li>
                        <NavigationMenuLink asChild>
                          <Link
                            to="/deep-research"
                            className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                          >
                            <div className="flex items-center gap-2 text-sm font-medium leading-none">
                              <LineChart className="h-4 w-4 text-primary" />
                              Deep Research
                            </div>
                            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground mt-1">
                              Deep AI-powered analysis from 9 angles
                            </p>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <Link
                            to="/ai-stock-rank"
                            className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                          >
                            <div className="flex items-center gap-2 text-sm font-medium leading-none">
                              <Trophy className="h-4 w-4 text-yellow-500" />
                              AI Stock Rank
                            </div>
                            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground mt-1">
                              Top-ranked stocks by AI quality score
                            </p>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <Link
                            to="/stocks"
                            className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                          >
                            <div className="flex items-center gap-2 text-sm font-medium leading-none">
                              <BarChart3 className="h-4 w-4 text-blue-500" />
                              Browse Stocks
                            </div>
                            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground mt-1">
                              Explore all stocks by sector
                            </p>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <Link
                            to="/market-opportunities"
                            className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                          >
                            <div className="flex items-center gap-2 text-sm font-medium leading-none">
                              <Newspaper className="h-4 w-4 text-green-500" />
                              Market Opportunities
                            </div>
                            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground mt-1">
                              AI-scanned news catalysts
                            </p>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            <Link to="/ai-stock-rank">
              <Button
                size="sm"
                className="relative bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 hover:from-yellow-400 hover:via-amber-400 hover:to-orange-400 text-black font-bold shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 transition-all hover:scale-105 border-0"
              >
                <Trophy className="h-4 w-4 mr-2 animate-pulse" />
                AI Rank
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-400"></span>
                </span>
              </Button>
            </Link>
            <Link to="/portfolio-simulator">
              <Button variant="outline" size="sm">
                <Sparkles className="h-4 w-4 mr-2" />
                Simulator
              </Button>
            </Link>

            {user ? (
              <>
                <Link to="/my-portfolio">
                  <Button variant="ghost" size="sm">
                    <PieChart className="h-4 w-4 mr-2" />
                    My Portfolio
                  </Button>
                </Link>
                <Link to="/pricing">
                  <Button variant="ghost" size="sm">
                    Pricing
                  </Button>
                </Link>
                <Link to="/blog">
                  <Button variant="ghost" size="sm">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Blog
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button variant="ghost" size="sm">
                    <Mail className="h-4 w-4 mr-2" />
                    Contact
                  </Button>
                </Link>
                {userRole === 'admin' && (
                  <>
                    <Link to="/dashboard">
                      <Button variant="ghost" size="sm">
                        <Users className="h-4 w-4 mr-2" />
                        Dashboard
                      </Button>
                    </Link>
                    <Link to="/admin/batch-analysis">
                      <Button variant="ghost" size="sm">
                        <Database className="h-4 w-4 mr-2" />
                        Batch Job
                      </Button>
                    </Link>
                    <Link to="/admin/blog-generator">
                      <Button variant="ghost" size="sm">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Blog Generator
                      </Button>
                    </Link>
                  </>
                )}
                <Link to="/account">
                  <AccountButton userRole={userRole} />
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link to="/blog">
                  <Button variant="ghost" size="sm">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Blog
                  </Button>
                </Link>
                <Link to="/pricing">
                  <Button variant="ghost" size="sm">
                    Pricing
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button variant="ghost" size="sm">
                    <Mail className="h-4 w-4 mr-2" />
                    Contact
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="sm">
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <CreditBalance />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden border-t border-border">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-3">
            <Link to="/deep-research" className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
              <LineChart className="h-4 w-4" />
              Deep Research
            </Link>
            <Link to="/ai-stock-rank" className="text-sm py-2 text-primary font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              AI Stock Rank
            </Link>
            <Link to="/market-opportunities" className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
              <Newspaper className="h-4 w-4" />
              Market Opportunities
            </Link>
            <Link to="/stocks" className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              Browse Stocks
            </Link>
            <Link to="/portfolio-simulator" className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Portfolio Simulator
            </Link>
            {user ? (
              <>
                <Link to="/my-portfolio" className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  My Portfolio
                </Link>
                <Link to="/pricing" className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors">
                  Pricing
                </Link>
                <Link to="/blog" className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Blog
                </Link>
                <Link to="/contact" className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Contact
                </Link>
                {userRole === 'admin' && (
                  <>
                    <Link to="/dashboard" className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Dashboard
                    </Link>
                    <Link to="/admin/batch-analysis" className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Batch Analysis
                    </Link>
                    <Link to="/admin/blog-generator" className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Blog Generator
                    </Link>
                  </>
                )}
                <MobileAccountLink />
                <button onClick={handleLogout} className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors text-left flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/blog" className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors">
                  Blog
                </Link>
                <Link to="/pricing" className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors">
                  Pricing
                </Link>
                <Link to="/contact" className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Contact
                </Link>
                <Link to="/auth" className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors">
                  Sign In
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
