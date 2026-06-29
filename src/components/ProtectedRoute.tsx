import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    children: ReactNode;
    requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
    const { authStatus } = useAuthenticator(context => [context.authStatus]);
    const { isAdmin, loading: roleLoading } = useUserRole();

    // Show nothing or a loader while determining auth state
    if (authStatus === 'configuring' || roleLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // If not logged in at all
    if (authStatus !== 'authenticated') {
        const currentPath = window.location.pathname + window.location.search;
        return <Navigate to={`/auth?redirect=${encodeURIComponent(currentPath)}`} replace />;
    }

    // If route requires admin but user is not admin
    if (requireAdmin && !isAdmin) {
        return <Navigate to="/dashboard" replace />;
    }

    // All checks passed
    return <>{children}</>;
}
