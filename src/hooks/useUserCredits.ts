import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiAdapter';
import { useAuthenticator } from '@aws-amplify/ui-react';

export interface UserCredits {
    monthly_credits: number;
    bonus_credits: number;
    credits_used_this_period: number;
    subscription_tier: 'free' | 'pro';
    remaining: number;
    subscription_status: 'none' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
    trial_end: string | null;
    cancel_at_period_end: boolean;
    period_end: string | null;
}

const CREDITS_CACHE_KEY = 'claritx_credits_cache';

function loadCachedCredits(): UserCredits | null {
    try {
        const raw = localStorage.getItem(CREDITS_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function useUserCredits() {
    const { authStatus } = useAuthenticator(context => [context.authStatus]);
    const [credits, setCredits] = useState<UserCredits | null>(() => loadCachedCredits());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCredits = useCallback(async () => {
        if (authStatus !== 'authenticated') {
            setLoading(false);
            return;
        }

        try {
            const data = await api.get('/check-credits');
            const parsed: UserCredits = {
                monthly_credits: data.monthly_credits || 0,
                bonus_credits: data.bonus_credits || 0,
                credits_used_this_period: data.credits_used_this_period || 0,
                subscription_tier: data.subscription_tier || 'free',
                remaining: data.remaining || 0,
                subscription_status: data.subscription_status || 'none',
                trial_end: data.trial_end || null,
                cancel_at_period_end: data.cancel_at_period_end || false,
                period_end: data.period_end || null,
            };
            setCredits(parsed);
            localStorage.setItem(CREDITS_CACHE_KEY, JSON.stringify(parsed));
            setError(null);
        } catch (err: any) {
            console.error('[useUserCredits] Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [authStatus]);

    useEffect(() => {
        fetchCredits();
    }, [fetchCredits]);

    return {
        credits,
        remaining: credits?.remaining || 0,
        loading,
        error,
        refetch: fetchCredits,
        isTrialing: credits?.subscription_status === 'trialing',
        isCanceling: credits?.cancel_at_period_end || false,
        isPastDue: credits?.subscription_status === 'past_due',
    };
}
