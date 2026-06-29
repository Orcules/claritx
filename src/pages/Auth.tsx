import "@aws-amplify/ui-react/styles.css";
import { useState, useEffect } from "react";
import { signUp, signIn, fetchAuthSession, signInWithRedirect, resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Lock, User, ArrowRight, Briefcase, UserCircle, AlertTriangle } from "lucide-react";
import { useTheme } from "next-themes";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SEOHead } from "@/components/SEOHead";
import { trackSignUpOnce, markOAuthSignupPending, trackOAuthSignupIfPending } from "@/lib/reddit-pixel";

type UserType = 'user' | 'manager';

export default function Auth() {
  const { resolvedTheme } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [userType, setUserType] = useState<UserType>('user');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [authError, setAuthError] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect');

  // Automatically check if user is already logged in and redirect them
  useEffect(() => {
    const checkCurrentSession = async () => {
      try {
        const session = await fetchAuthSession();
        if (session.tokens) {
          // If we got here via a Google OAuth redirect, count it as a SignUp (deduped per browser).
          trackOAuthSignupIfPending();
          // Check for saved redirect in localStorage if query param is missing (e.g. after OAuth)
          const savedRedirect = localStorage.getItem('auth_redirect');
          if (savedRedirect && !redirectTo) {
            console.log(`Found saved redirect in localStorage: ${savedRedirect}`);
            localStorage.removeItem('auth_redirect');
            navigate(savedRedirect);
            return;
          }
          await redirectBasedOnRole();
        }
      } catch (error) {
        // No valid session, stay on Auth page
        console.log("No active session found, stay on login");
      }
    };
    checkCurrentSession();
  }, [redirectTo, navigate]);

  const redirectBasedOnRole = async () => {
    console.log("Starting role-based redirect...");
    if (redirectTo) {
      console.log(`Redirecting to requested URL: ${redirectTo}`);
      navigate(redirectTo);
      return;
    }

    try {
      // Add a timeout to prevent hanging
      const sessionPromise = fetchAuthSession();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Auth session fetch timeout")), 3000)
      );

      const session: any = await Promise.race([sessionPromise, timeoutPromise]);
      const groups = session.tokens?.accessToken?.payload['cognito:groups'] as string[] | undefined;

      console.log("User groups:", groups);

      navigate("/");
    } catch (error) {
      console.error('Error checking role or timeout:', error);
      navigate("/");
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    if (!isLogin && !isForgotPassword && !acceptedTerms) {
      setAuthError("You must accept the Terms of Service and Disclaimer to create an account");
      return;
    }

    setLoading(true);

    try {
      if (isForgotPassword && !isConfirmingReset) {
        await resetPassword({ username: email });
        setIsConfirmingReset(true);
        toast.success("Verification code sent to your email");
        return;
      }
      if (isConfirmingReset) {
        if (!confirmationCode) {
            toast.error("Please enter the verification code");
            return;
        }
        await confirmResetPassword({ username: email, confirmationCode, newPassword: password });
        toast.success("Password reset successfully. Please log in.");
        setIsForgotPassword(false);
        setIsConfirmingReset(false);
        setIsLogin(true);
        setPassword("");
        return;
      }
      if (isLogin) {
        const { isSignedIn, nextStep } = await signIn({ username: email, password });
        if (isSignedIn) {
          toast.success("Logged in successfully!");
          await redirectBasedOnRole();
        } else {
          toast.error(`Login failed. Step: ${nextStep}`);
        }
      } else {
        // Signup
        const signupResult = await signUp({
          username: email,
          password,
          options: {
            userAttributes: {
              email,
              name: fullName,
              // 'custom:role': userType // (Requires custom attribute in Cognito)
            }
          }
        });

        console.log('Signup result:', signupResult);

        // Since we disabled email verification, user is auto-confirmed
        // Attempt immediate sign-in
        if (signupResult.isSignUpComplete) {
          trackSignUpOnce();
          toast.success("Account created! Logging you in...");

          // Auto-login after successful signup
          try {
            const { isSignedIn } = await signIn({ username: email, password });
            if (isSignedIn) {
              toast.success("Welcome to ClaritX!");
              await redirectBasedOnRole();
            }
          } catch (loginError: any) {
            console.error('Auto-login failed:', loginError);
            toast.error("Account created but auto-login failed. Please sign in manually.");
            setIsLogin(true);
          }
        } else {
          setAuthError("Account created. You can now sign in.");
          setIsLogin(true);
        }
      }
    } catch (error: any) {
      console.error(error);
      let errorMsg = error.message || "Authentication error";
      if (errorMsg.toLowerCase().includes("user does not exist") || errorMsg.includes("UserNotFoundException")) {
        errorMsg = "Account not found. Please check your email or sign up.";
      }
      setAuthError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Sign In or Create Account | ClaritX"
        description="Sign in to your ClaritX account or create a new account to access AI-powered stock analysis, portfolio simulation, and personalized investment research tools."
        keywords="login, sign up, create account, stock analysis account, portfolio tracker login"
        canonicalUrl="/auth"
        noindex={true}
      />
      {/* Prominent Disclaimer Banner */}
      <div className="bg-destructive/10 border-b-2 border-destructive/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-start gap-3 justify-center">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="text-center">
              <p className="text-sm font-semibold text-destructive mb-1">
                Important Risk Disclaimer
              </p>
              <p className="text-xs text-muted-foreground max-w-2xl">
                ClaritX is an <strong>educational tool only</strong> and does not provide financial advice.
                All analyses and portfolio suggestions are for informational purposes only.
                Investments involve risk and you may lose money. Always consult a licensed financial advisor.{" "}
                <Link to="/disclaimer" className="text-primary hover:underline font-medium">
                  Read full disclaimer →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-md">
          <div className="glass-card p-8 animate-fade-up">
            <div className="flex items-center justify-center mb-8">
              <Link to="/">
                <div className="overflow-hidden h-12">
                  <img
                    src={resolvedTheme !== 'light' ? '/logo-white.png' : '/logo-black.png'}
                    alt="ClaritX"
                    className="h-24 w-auto -mt-6"
                  />
                </div>
              </Link>
            </div>

            <h2 className="text-2xl font-display font-bold text-center mb-2">
              {isForgotPassword 
                ? (isConfirmingReset ? "Set New Password" : "Reset Password") 
                : (isLogin ? "Welcome Back" : "Create Account")}
            </h2>
            <p className="text-muted-foreground text-center mb-6">
              {isForgotPassword
                ? (isConfirmingReset ? "Enter the verification code and your new password" : "Enter your email to receive a password reset code")
                : (isLogin ? "Sign in to your account" : "Choose your account type")}
            </p>

            {authError && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{authError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && !isForgotPassword && (
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button
                    type="button"
                    onClick={() => setUserType('user')}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all text-left",
                      userType === 'user'
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <UserCircle className={cn(
                      "h-6 w-6 mb-2",
                      userType === 'user' ? "text-primary" : "text-muted-foreground"
                    )} />
                    <p className="font-semibold text-foreground">Investor</p>
                    <p className="text-xs text-muted-foreground">Build my portfolio</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserType('manager')}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all text-left",
                      userType === 'manager'
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Briefcase className={cn(
                      "h-6 w-6 mb-2",
                      userType === 'manager' ? "text-primary" : "text-muted-foreground"
                    )} />
                    <p className="font-semibold text-foreground">Manager</p>
                    <p className="text-xs text-muted-foreground">Manage clients</p>
                  </button>
                </div>
              )}

              {!isLogin && !isForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                      required={!isLogin}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {isConfirmingReset && (
                <div className="space-y-2">
                  <Label htmlFor="confirmationCode">Verification Code</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmationCode"
                      type="text"
                      placeholder="123456"
                      value={confirmationCode}
                      onChange={(e) => setConfirmationCode(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              )}

              {(!isForgotPassword || isConfirmingReset) && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              )}

              {isLogin && !isForgotPassword && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {!isLogin && !isForgotPassword && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50 border border-border">
                    <Checkbox
                      id="terms"
                      checked={acceptedTerms}
                      onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor="terms"
                      className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
                    >
                      I have read and agree to the{" "}
                      <Link to="/terms" target="_blank" className="text-primary hover:underline font-medium">
                        Terms of Service
                      </Link>
                      ,{" "}
                      <Link to="/privacy" target="_blank" className="text-primary hover:underline font-medium">
                        Privacy Policy
                      </Link>
                      , and{" "}
                      <Link to="/disclaimer" target="_blank" className="text-primary hover:underline font-medium">
                        Disclaimer
                      </Link>
                      . I understand that ClaritX provides educational content only and is not financial advice.
                    </label>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || (!isLogin && !isForgotPassword && !acceptedTerms)}
              >
                {loading ? (
                  "Loading..."
                ) : (
                  <>
                    {isForgotPassword 
                      ? (isConfirmingReset ? "Reset Password" : "Send Verification Code")
                      : (isLogin ? "Sign In" : "Sign Up")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground glass-card label">
                    Or continue with
                  </span>
                </div>
              </div>
              
              <div className="mt-6">
                <Button
                  variant="outline"
                  type="button"
                  className="w-full gap-2 text-foreground bg-card hover:bg-muted"
                  onClick={() => {
                    if (redirectTo) {
                      localStorage.setItem('auth_redirect', redirectTo);
                    }
                    markOAuthSignupPending();
                    signInWithRedirect({ provider: 'Google' });
                  }}
                  disabled={loading}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                    <path d="M1 1h22v22H1z" fill="none" />
                  </svg>
                  Google
                </Button>
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setAuthError("");
                  if (isForgotPassword) {
                    setIsForgotPassword(false);
                    setIsConfirmingReset(false);
                    setIsLogin(true);
                  } else {
                    setIsLogin(!isLogin);
                    setAcceptedTerms(false);
                  }
                }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isForgotPassword 
                  ? "Back to login"
                  : (isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}