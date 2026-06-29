import { useCallback } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useAuthModal } from '@/context/AuthModalContext';

/**
 * Hook that provides an auth-gating function for actions that require authentication.
 * Call `requireAuth(onSuccess?)` before any action that should be restricted to logged-in users.
 * Returns `true` if the user is authenticated, `false` otherwise (opens the auth modal).
 */
export function useAuthGate() {
  const { authStatus } = useAuthenticator(context => [context.authStatus]);
  const isAuthenticated = authStatus === 'authenticated';
  const { openAuthModal } = useAuthModal();

  const requireAuth = useCallback((onSuccess?: () => void): boolean => {
    if (isAuthenticated) return true;
    openAuthModal({ onSuccess });
    return false;
  }, [isAuthenticated, openAuthModal]);

  return { isAuthenticated, requireAuth };
}
