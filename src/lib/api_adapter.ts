import { fetchAuthSession } from 'aws-amplify/auth';

const AWS_API_URL = import.meta.env.VITE_AWS_API_URL || "http://localhost:8000";

export class InsufficientCreditsError extends Error {
    constructor(message?: string) {
        super(message || "You've run out of credits. Upgrade your plan or add credits to continue.");
        this.name = 'InsufficientCreditsError';
    }
}

export const api = {
    /**
     * GET request to AWS backend
     */
    get: async <T = any>(endpoint: string): Promise<T> => {
        try {
            const session = await fetchAuthSession();
            const token = session.tokens?.idToken?.toString();

            if (!token) {
                console.warn('[API Adapter] No authentication token found. User may not be logged in.');
            }

            const response = await fetch(`${AWS_API_URL}${endpoint}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                if (response.status === 401) {
                    console.error('[API Adapter] 401 Unauthorized. Token may be expired or invalid.');
                    throw new Error('AUTH_REDIRECT');
                }
                if (response.status === 402) {
                    throw new InsufficientCreditsError(errorData.detail);
                }
                throw new Error(errorData.detail || `GET ${endpoint} failed`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[API GET] Error fetching ${endpoint}:`, error);
            throw error;
        }
    },

    /**
     * POST request to AWS backend
     */
    post: async <T = any>(endpoint: string, body?: any): Promise<T> => {
        try {
            const session = await fetchAuthSession();
            const token = session.tokens?.idToken?.toString();

            if (!token) {
                console.warn('[API Adapter] No authentication token found. User may not be logged in.');
            }

            const response = await fetch(`${AWS_API_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body: body ? JSON.stringify(body) : undefined,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                if (response.status === 401) {
                    console.error('[API Adapter] 401 Unauthorized. Token may be expired or invalid.');
                    throw new Error('AUTH_REDIRECT');
                }
                if (response.status === 402) {
                    throw new InsufficientCreditsError(errorData.detail);
                }
                throw new Error(errorData.detail || `POST ${endpoint} failed`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[API POST] Error posting to ${endpoint}:`, error);
            throw error;
        }
    },

    /**
     * PATCH request to AWS backend
     */
    patch: async <T = any>(endpoint: string, body?: any): Promise<T> => {
        try {
            const session = await fetchAuthSession();
            const token = session.tokens?.idToken?.toString();

            const response = await fetch(`${AWS_API_URL}${endpoint}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body: body ? JSON.stringify(body) : undefined,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(errorData.detail || `PATCH ${endpoint} failed`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[API PATCH] Error patching ${endpoint}:`, error);
            throw error;
        }
    },

    /**
     * DELETE request to AWS backend
     */
    delete: async <T = any>(endpoint: string): Promise<T> => {
        try {
            const session = await fetchAuthSession();
            const token = session.tokens?.idToken?.toString();

            if (!token) {
                console.warn('[API Adapter] No authentication token found. User may not be logged in.');
            }

            const response = await fetch(`${AWS_API_URL}${endpoint}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                if (response.status === 401) {
                    console.error('[API Adapter] 401 Unauthorized. Token may be expired or invalid.');
                    throw new Error('AUTH_REDIRECT');
                }
                throw new Error(errorData.detail || `DELETE ${endpoint} failed`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[API DELETE] Error deleting at ${endpoint}:`, error);
            throw error;
        }
    },

    functions: {
        /**
         * Drop-in replacement for supabase.functions.invoke
         * Routes requests to the Python AWS Backend
         */
        invoke: async (functionName: string, options: { body?: any, method?: string } = {}) => {
            try {
                console.log(`[API Adapter] Calling ${functionName} via Python Backend at ${AWS_API_URL}`);

                // 1. Get the current user's session token to pass to AWS (Cognito)
                const session = await fetchAuthSession();
                const token = session.tokens?.idToken?.toString();

                // 2. Make standard fetch call to AWS/FastAPI
                // Note: We use the functionName as the route path
                const method = options.method || 'POST';
                const fetchOptions: RequestInit = {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : '',
                    },
                };

                if (method !== 'GET' && options.body) {
                    fetchOptions.body = JSON.stringify(options.body);
                }

                const response = await fetch(`${AWS_API_URL}/${functionName}`, fetchOptions);

                // 3. Handle errors
                if (!response.ok) {
                    if (response.status === 401) {
                        console.error('[API Adapter] 401 Unauthorized in functions.invoke.');
                        return { data: null, error: 'Authentication required' };
                    }
                    const errorText = await response.text();
                    let errorMessage;
                    try {
                        errorMessage = JSON.parse(errorText);
                    } catch {
                        errorMessage = errorText;
                    }
                    console.error(`[API Adapter] Error from ${functionName}:`, errorMessage);
                    return { data: null, error: errorMessage };
                }

                // 4. Return data in Supabase format { data, error }
                const data = await response.json();
                return { data, error: null };

            } catch (error) {
                console.error(`[API Adapter] Network error calling ${functionName}:`, error);
                return { data: null, error };
            }
        }
    }
};
