/**
 * Supabase client compatibility layer
 * This bridges the frontend to the AWS/Python backend.
 */
import { api } from '@/lib/apiAdapter';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';

/**
 * A helper to create a chainable mock object that eventually returns a promise
 */
const createChainable = (finalValue: any) => {
  const handler: ProxyHandler<any> = {
    get: (target, prop) => {
      if (prop === 'then') return (resolve: any) => resolve(finalValue);
      if (prop === 'catch') return (reject: any) => { };
      return () => new Proxy({}, handler);
    }
  };
  return new Proxy({}, handler);
};

export const supabase = {
    from: (table: string) => {
        console.warn(`Supabase compatibility: Table '${table}' access.`);
        
        return {
            select: (columns: string = '*') => {
                const chain = {
                    eq: (col: string, val: any) => chain,
                    in: (col: string, vals: any[]) => chain,
                    order: (col: string, options?: any) => chain,
                    limit: (n: number) => chain,
                    single: () => {
                      // Handle specific known cases
                      if (table === 'deep_search_jobs') {
                        // This is usually handled via status polling
                        return Promise.resolve({ data: null, error: null });
                      }
                      return Promise.resolve({ data: null, error: null });
                    },
                    // Termination for limit/order chains
                    then: (resolve: any) => {
                        if (table === 'activity_logs') {
                            return api.get('/activity-logs').then(data => resolve({ data, error: null }));
                        }
                        if (table === 'published_blogs') {
                            return api.get('/blogs').then(data => resolve({ data, error: null }));
                        }
                        return resolve({ data: [], error: null });
                    }
                };
                return chain;
            },
            insert: (data: any) => {
                if (table === 'activity_logs') {
                    // Writing to logs from UI disabled per user request
                    return Promise.resolve({ data: data, error: null });
                }
                return {
                    select: () => Promise.resolve({ data, error: null })
                };
            },
            upsert: (data: any) => Promise.resolve({ data, error: null }),
            update: (data: any) => ({
                eq: (col: string, val: any) => Promise.resolve({ data, error: null })
            }),
            delete: () => ({
                eq: (col: string, val: any) => Promise.resolve({ data: null, error: null })
            })
        };
    },
    auth: {
        getSession: async () => {
            try {
                const session = await fetchAuthSession();
                if (session.tokens) {
                    return { 
                        data: { 
                            session: { 
                                access_token: session.tokens.idToken?.toString(),
                                user: null // Will be handled by getUser if needed
                            } 
                        }, 
                        error: null 
                    };
                }
                return { data: { session: null }, error: null };
            } catch (e) {
                return { data: { session: null }, error: e };
            }
        },
        onAuthStateChange: (callback?: any) => ({ data: { subscription: { unsubscribe: () => { } } } }),
        signOut: () => Promise.resolve({ error: null }),
        getUser: async (token?: string) => {
             try {
                 const user = await getCurrentUser();
                 return { data: { user: { id: user.userId, email: user.username } }, error: null };
             } catch (e) {
                 return { data: { user: null }, error: e };
             }
        },
    },
    functions: {
        invoke: async (functionName: string, options?: any) => {
            return await api.functions.invoke(functionName, options);
        }
    },
    rpc: async (functionName: string, params?: any) => {
        console.warn(`Supabase compatibility: RPC '${functionName}' called.`);
        return { data: null, error: { message: 'RPC not implemented' } };
    },
    channel: () => ({
        on: () => ({ subscribe: () => ({ unsubscribe: () => { } }) }),
        subscribe: () => ({ unsubscribe: () => { } }),
        unsubscribe: () => { },
    })
};
