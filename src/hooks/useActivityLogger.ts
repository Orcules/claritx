import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/apiAdapter';
// import { RealtimeChannel } from '@supabase/supabase-js'; // Realtime disabled

// Define original console methods globally for use in logger
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;


export type LogCategory =
  // Frontend Categories
  | 'Navigation'
  | 'User Action'
  | 'Form Submit'
  | 'Button Click'
  | 'Search'
  | 'Filter'
  | 'Modal'
  | 'Tab Change'
  // API Categories
  | 'API Request'
  | 'API Response'
  | 'API Error'
  | 'Supabase Query'
  | 'Supabase Mutation'
  // AI Categories
  | 'AI Request'
  | 'AI Response'
  | 'AI Error'
  | 'AI Analysis'
  | 'AI Chat'
  // Gemini-specific Categories (from Backend)
  | 'Gemini Request'
  | 'Gemini Response'
  | 'Gemini Error'
  // Backend Categories (from Edge Functions)
  | 'FMP Request'
  | 'FMP Response'
  | 'FMP Error'
  | 'FMP Summary'
  | 'Yahoo Request'
  | 'Yahoo Response'
  | 'Yahoo Error'
  | 'Ticker Screener'
  | 'Portfolio Analysis'
  | 'Stock Analysis'
  | 'Edge Function'
  // System Categories
  | 'Console Error'
  | 'Console Warning'
  | 'Performance'
  | 'Cache'
  | 'Auth'
  | 'Storage'
  // Generic
  | string;

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'api' | 'error' | 'info' | 'warning' | 'navigation' | 'ai' | 'action' | 'backend';
  category: LogCategory;
  message: string;
  details?: unknown;
  duration?: number;
  status?: number;
  requestBody?: unknown;
  responsePreview?: string;
  sessionId?: string;
  source?: 'frontend' | 'backend';
  correlationId?: string;
}

// Generate a unique session ID for this browser tab
const SESSION_ID = crypto.randomUUID();

// Local log storage for immediate display
const localLogStore: LogEntry[] = [];
const MAX_LOCAL_LOGS = 100;
const listeners: Set<() => void> = new Set();

// Debounce for database inserts
let insertQueue: LogEntry[] = [];
let insertTimeout: ReturnType<typeof setTimeout> | null = null;

const flushInsertQueue = async () => {
  if (insertQueue.length === 0) return;

  // Check if user is authenticated before sending logs
  try {
    const { fetchAuthSession } = await import('aws-amplify/auth');
    const session = await fetchAuthSession();
    if (!session.tokens?.idToken) {
      // User not logged in - keep logs in queue or discard if too many?
      // For now, let's discard if queue gets too big to prevent memory leaks
      if (insertQueue.length > 500) {
        insertQueue = insertQueue.slice(-100);
      }
      return;
    }
  } catch (e) {
    // Auth check failed, likely not initialized or network error
    return;
  }

  const logsToInsert = [...insertQueue];
  insertQueue = [];

  try {
    // Transform to snake_case for backend
    const transformedLogs = logsToInsert.map(log => ({
      session_id: log.sessionId,
      type: log.type,
      category: log.category,
      message: log.message,
      details: log.details,
      duration: log.duration,
      status: log.status,
      request_body: log.requestBody,
      response_preview: log.responsePreview,
      correlation_id: log.correlationId,
    }));

    // PERSISTENCE DISABLED per user request: lets not write to logs from ui
    // await api.post('/activity-logs', transformedLogs);
    console.log(`[ActivityLogger] UI Logging to backend disabled. Suppressed ${transformedLogs.length} logs.`);
  } catch (err) {
    // Use original console error to avoid infinite loop of logging logging errors
    const originalConsole = console.error === originalConsoleError ? console.error : originalConsoleError;
    originalConsole('Error suppressing activity logs:', err);
  }
};

const queueInsert = (entry: LogEntry) => {
  // Re-enabled: Queueing logs up
  insertQueue.push(entry);

  if (insertTimeout) {
    clearTimeout(insertTimeout);
  }

  // Batch inserts every 5s for performance
  insertTimeout = setTimeout(flushInsertQueue, 5000); 
};

const addLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
  const newEntry: LogEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date(),
    sessionId: SESSION_ID,
    source: 'frontend',
  };

  localLogStore.unshift(newEntry);

  // Keep only last MAX_LOCAL_LOGS entries locally
  if (localLogStore.length > MAX_LOCAL_LOGS) {
    localLogStore.pop();
  }

  // Notify all local listeners
  listeners.forEach(listener => listener());

  // Queue for database insert (use newEntry to include sessionId)
  queueInsert(newEntry);
};

// Helper to safely parse request body
const safeParseBody = (body: BodyInit | null | undefined): unknown => {
  if (!body) return undefined;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return body;
};

// Categorize API calls
const categorizeApiCall = (url: string, method: string): { type: LogEntry['type']; category: LogCategory } => {
  const urlLower = url.toLowerCase();

  // AI calls
  if (urlLower.includes('stock-analysis') ||
    urlLower.includes('section-chat') ||
    urlLower.includes('ai-rank-stocks') ||
    urlLower.includes('portfolio-analysis') ||
    urlLower.includes('ai.gateway.lovable') ||
    urlLower.includes('openai.com') ||
    urlLower.includes('generativelanguage.googleapis.com')) {
    return { type: 'ai', category: 'AI Request' };
  }


  // Ticker/Stock calls
  if (urlLower.includes('ticker') || urlLower.includes('stock')) {
    return { type: 'api', category: 'Stock Analysis' };
  }

  // Portfolio calls
  if (urlLower.includes('portfolio')) {
    return { type: 'api', category: 'Portfolio Analysis' };
  }

  // Supabase database calls
  if (urlLower.includes('supabase') && urlLower.includes('rest')) {
    return {
      type: 'api',
      category: method === 'GET' || method === 'HEAD' ? 'Supabase Query' : 'Supabase Mutation'
    };
  }

  // Edge functions
  if (urlLower.includes('functions/v1')) {
    return { type: 'api', category: 'Edge Function' };
  }

  // Auth calls
  if (urlLower.includes('auth')) {
    return { type: 'api', category: 'Auth' };
  }

  // Storage calls
  if (urlLower.includes('storage')) {
    return { type: 'api', category: 'Storage' };
  }

  return { type: 'api', category: 'API Request' };
};

// Skip logging for activity_logs table operations to prevent infinite loops
const isActivityLogsCall = (url: string): boolean => {
  return url.includes('activity_logs') || url.includes('activity-logs');
};

// Extract clean endpoint name
const getEndpointName = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    // For supabase rest calls, get table name
    if (url.includes('rest/v1/')) {
      const tableIndex = pathParts.indexOf('v1') + 1;
      return pathParts[tableIndex] || pathParts.slice(-1)[0];
    }

    // For edge functions, get function name
    if (url.includes('functions/v1/')) {
      const funcIndex = pathParts.indexOf('v1') + 1;
      return pathParts[funcIndex] || pathParts.slice(-1)[0];
    }

    return pathParts.slice(-2).join('/');
  } catch {
    const parts = url.split('?')[0].split('/');
    return parts.slice(-2).join('/');
  }
};

// Intercept fetch for API logging
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const [url, options] = args;
  const urlString = typeof url === 'string' ? url : url.toString();
  const method = (options?.method || 'GET').toUpperCase();
  const startTime = performance.now();

  // Skip logging for activity_logs operations
  if (isActivityLogsCall(urlString)) {
    return originalFetch(...args);
  }

  // Check if this is an API call worth logging
  const isApiCall = urlString.includes('supabase') ||
    urlString.includes('functions/v1') ||
    urlString.includes('/api/') ||
    urlString.includes('financialmodelingprep') ||
    urlString.includes('yahoo') ||
    urlString.includes('openai') ||
    urlString.includes('lovable') ||
    urlString.includes('execute-api') ||
    urlString.includes('localhost:8000');

  if (!isApiCall) {
    return originalFetch(...args);
  }

  const { type, category } = categorizeApiCall(urlString, method);
  const parsedBody = safeParseBody(options?.body as BodyInit);
  const endpointName = getEndpointName(urlString);

  // Log request start
  addLog({
    type,
    category,
    message: `${method} ${endpointName}`,
    details: {
      url: urlString.replace(/apikey=[^&]+/g, 'apikey=XXX'),
      method,
      headers: options?.headers,
    },
    requestBody: parsedBody,
  });

  try {
    const response = await originalFetch(...args);
    const duration = Math.round(performance.now() - startTime);

    // Clone response to read body without consuming it
    const clonedResponse = response.clone();
    let responsePreview = '';

    try {
      const text = await clonedResponse.text();
      responsePreview = text.length > 2000 ? text.slice(0, 2000) + '...[truncated]' : text;
    } catch {
      responsePreview = '[Could not read response]';
    }

    // Determine response category
    const responseCategory = response.ok
      ? (type === 'ai' ? 'AI Response' : category.replace('Request', 'Response').replace('Query', 'Response').replace('Mutation', 'Response'))
      : (type === 'ai' ? 'AI Error' : 'API Error');

    addLog({
      type: response.ok ? (type === 'ai' ? 'ai' : 'info') : 'error',
      category: responseCategory as LogCategory,
      message: `${method} ${endpointName} - ${response.status} ${response.statusText}`,
      details: {
        url: urlString.replace(/apikey=[^&]+/g, 'apikey=XXX'),
        status: response.status,
        statusText: response.statusText,
      },
      duration,
      status: response.status,
      requestBody: parsedBody,
      responsePreview,
    });

    return response;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);

    addLog({
      type: 'error',
      category: type === 'ai' ? 'AI Error' : 'API Error',
      message: `${method} ${endpointName} - Failed`,
      details: {
        url: urlString.replace(/apikey=[^&]+/g, 'apikey=XXX'),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      duration,
      requestBody: parsedBody,
    });

    throw error;
  }
};

// Intercept console for logging (filter out React warnings)
console.error = (...args) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  // Filter out React dev warnings and activity log errors to prevent loops
  if (!message.includes('React.forwardRef') &&
    !message.includes('validateDOMNesting') &&
    !message.includes('Warning:') &&
    !message.includes('activity_logs') &&
    !message.includes('activity-logs')) {
    addLog({
      type: 'error',
      category: 'Console Error',
      message: message.slice(0, 200),
      details: { args: args },
    });
  }
  originalConsoleError(...args);
};

console.warn = (...args) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  // Filter out React Router warnings and activity log warnings to prevent loops
  if (!message.includes('React Router Future Flag') &&
    !message.includes('Warning:') &&
    !message.includes('activity_logs') &&
    !message.includes('activity-logs')) {
    addLog({
      type: 'warning',
      category: 'Console Warning',
      message: message.slice(0, 200),
      details: { args: args },
    });
  }
  originalConsoleWarn(...args);
};

// Navigation logging
if (typeof window !== 'undefined') {
  // Log initial page load
  addLog({
    type: 'navigation',
    category: 'Navigation',
    message: `Page Load: ${window.location.pathname}`,
    details: {
      pathname: window.location.pathname,
      search: window.location.search,
      referrer: document.referrer,
    },
  });

  // Listen for route changes (popstate)
  window.addEventListener('popstate', () => {
    addLog({
      type: 'navigation',
      category: 'Navigation',
      message: `Navigate: ${window.location.pathname}`,
      details: {
        pathname: window.location.pathname,
        search: window.location.search,
      },
    });
  });

  // Intercept pushState and replaceState
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    addLog({
      type: 'navigation',
      category: 'Navigation',
      message: `Navigate: ${window.location.pathname}`,
      details: {
        pathname: window.location.pathname,
        search: window.location.search,
        state: args[0],
      },
    });
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    addLog({
      type: 'navigation',
      category: 'Navigation',
      message: `Route Replace: ${window.location.pathname}`,
      details: {
        pathname: window.location.pathname,
        search: window.location.search,
        state: args[0],
      },
    });
  };
}

// Export function to manually add logs from components
export const logActivity = (
  type: LogEntry['type'],
  category: LogCategory,
  message: string,
  details?: unknown
) => {
  addLog({ type, category, message, details });
};

// Helper functions for common logging patterns
export const logButtonClick = (buttonName: string, context?: unknown) => {
  addLog({
    type: 'action',
    category: 'Button Click',
    message: `Clicked: ${buttonName}`,
    details: context,
  });
};

export const logFormSubmit = (formName: string, data?: unknown) => {
  addLog({
    type: 'action',
    category: 'Form Submit',
    message: `Submit: ${formName}`,
    details: data,
  });
};

export const logSearch = (query: string, results?: number) => {
  addLog({
    type: 'action',
    category: 'Search',
    message: `Search: "${query}"${results !== undefined ? ` (${results} results)` : ''}`,
    details: { query, results },
  });
};

export const logFilter = (filterName: string, value: unknown) => {
  addLog({
    type: 'action',
    category: 'Filter',
    message: `Filter: ${filterName}`,
    details: { filterName, value },
  });
};

export const logModal = (action: 'open' | 'close', modalName: string) => {
  addLog({
    type: 'action',
    category: 'Modal',
    message: `Modal ${action}: ${modalName}`,
    details: { action, modalName },
  });
};

export const logTabChange = (tabName: string, context?: unknown) => {
  addLog({
    type: 'action',
    category: 'Tab Change',
    message: `Tab: ${tabName}`,
    details: context,
  });
};

export const logUserAction = (action: string, details?: unknown) => {
  addLog({
    type: 'action',
    category: 'User Action',
    message: action,
    details,
  });
};

export const useActivityLogger = () => {
  const [logs, setLogs] = useState<LogEntry[]>([...localLogStore]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<any | null>(null);

  // Fetch all logs from database on mount
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await api.get<any[]>('/activity-logs');

        if (data) {
          const dbLogs: LogEntry[] = data.map((row: any) => ({
            id: row.id,
            timestamp: new Date(row.created_at),
            type: row.type as LogEntry['type'],
            category: row.category as LogCategory,
            message: row.message,
            details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
            duration: row.duration ?? undefined,
            status: row.status ?? undefined,
            requestBody: typeof row.request_body === 'string' ? JSON.parse(row.request_body) : row.request_body,
            responsePreview: row.response_preview ?? undefined,
            sessionId: row.session_id,
            source: row.session_id?.startsWith('backend-') ? 'backend' : 'frontend',
            correlationId: row.correlation_id ?? undefined,
          }));

          setLogs(dbLogs);
        }
      } catch (err) {
        console.error('Error fetching activity logs:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    // Realtime disabled for AWS Lambda migration
    /*
    channelRef.current = supabase...
    */
    return () => {
      /*
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      */
    };
  }, []);

  // Also listen to local changes for immediate feedback
  useEffect(() => {
    const updateLogs = () => {
      // Merge local logs with state (for immediate display before DB sync)
      setLogs(prev => {
        const existingIds = new Set(prev.map(l => l.id));
        const newLocal = localLogStore.filter(l => !existingIds.has(l.id));
        return [...newLocal, ...prev].slice(0, 500);
      });
    };
    listeners.add(updateLogs);
    return () => {
      listeners.delete(updateLogs);
    };
  }, []);

  const clearLogs = useCallback(async () => {
    try {
      // Clear local store
      localLogStore.length = 0;
      listeners.forEach(listener => listener());

      // Clear function disabled for now
      /*
      const { error } = await supabase
        .from('activity_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (error) { ... }
      */

      setLogs([]);
    } catch (err) {
      console.error('Error clearing activity logs:', err);
    }
  }, []);

  return { logs, clearLogs, logActivity, isLoading, sessionId: SESSION_ID };
};
