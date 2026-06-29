import { useState } from 'react';
import { signIn, signInWithRedirect } from 'aws-amplify/auth';
import { markOAuthSignupPending } from '@/lib/reddit-pixel';
import { Link, useLocation } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, ArrowRight, AlertTriangle } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuthModal } from '@/context/AuthModalContext';

export function AuthModal() {
  const { isOpen, closeAuthModal, pendingCallback, dismissCallback, customTitle, customDescription } = useAuthModal();
  const { resolvedTheme } = useTheme();
  const location = useLocation();
  const returnPath = encodeURIComponent(location.pathname + location.search);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);

    try {
      const { isSignedIn } = await signIn({ username: email, password });
      if (isSignedIn) {
        // Reset form
        setEmail('');
        setPassword('');
        closeAuthModal();
        // Small delay so Amplify session propagates before the callback fires
        setTimeout(() => pendingCallback?.(), 100);
      } else {
        setAuthError('Sign in failed. Please try again.');
      }
    } catch (error: any) {
      let errorMsg = error.message || 'Authentication error';
      if (
        errorMsg.toLowerCase().includes('user does not exist') ||
        errorMsg.includes('UserNotFoundException')
      ) {
        errorMsg = 'Account not found. Please check your email or sign up.';
      }
      setAuthError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    // Store callback intention so the page can resume after OAuth redirect
    if (pendingCallback) {
      sessionStorage.setItem('auth_modal_had_callback', '1');
    }
    localStorage.setItem('auth_redirect', location.pathname + location.search);
    markOAuthSignupPending();
    signInWithRedirect({ provider: 'Google' });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      dismissCallback?.();
      closeAuthModal();
      setEmail('');
      setPassword('');
      setAuthError('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex justify-center mb-1">
            <div className="overflow-hidden h-10">
              <img
                src={resolvedTheme !== 'light' ? '/logo-white.png' : '/logo-black.png'}
                alt="ClaritX"
                className="h-20 w-auto -mt-5"
              />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            {customTitle || 'Sign in to continue'}
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            {customDescription || 'Sign in to run AI deep research on this ticker'}
          </DialogDescription>
        </DialogHeader>

        {authError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{authError}</p>
          </div>
        )}

        <form onSubmit={handleSignIn} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="modal-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="modal-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="modal-password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="modal-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
                minLength={6}
                autoComplete="current-password"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              'Signing in...'
            ) : (
              <>
                Sign In <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <Button
          variant="outline"
          type="button"
          className="w-full gap-2"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
          Continue with Google
        </Button>

        <div className="text-center text-xs text-muted-foreground pt-1">
          Don't have an account?{' '}
          <Link to={`/auth?redirect=${returnPath}`} onClick={() => closeAuthModal()} className="text-primary hover:underline font-medium">
            Sign up
          </Link>
          {' · '}
          <Link to={`/auth?redirect=${returnPath}`} onClick={() => closeAuthModal()} className="text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
