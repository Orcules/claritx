import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useActivityLogger, LogEntry, LogCategory } from "@/hooks/useActivityLogger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Trash2, 
  Search, 
  RefreshCw, 
  Activity, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  Globe,
  Clock,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Send,
  FileText,
  Radio,
  Monitor,
  Server,
  MousePointer,
  Navigation,
  Database,
  Wallet,
  BarChart3,
  TrendingUp,
  MessageSquare,
  Lock,
  HardDrive,
  Zap,
  Filter
} from "lucide-react";

// Category groups for filtering
const CATEGORY_GROUPS = {
  'All': [],
  'Frontend': ['Navigation', 'User Action', 'Form Submit', 'Button Click', 'Search', 'Filter', 'Modal', 'Tab Change'],
  'API': ['API Request', 'API Response', 'API Error', 'Supabase Query', 'Supabase Mutation', 'Edge Function'],
  'AI': ['AI Request', 'AI Response', 'AI Error', 'AI Analysis', 'AI Chat'],
  'Gemini': ['Gemini Request', 'Gemini Response', 'Gemini Error'],
  'Backend': ['FMP Request', 'FMP Response', 'FMP Error', 'FMP Summary', 'Yahoo Request', 'Yahoo Response', 'Yahoo Error', 'Ticker Screener', 'Portfolio Analysis', 'Stock Analysis'],
  'External': ['Plaid Request', 'Plaid Response'],
  'System': ['Console Error', 'Console Warning', 'Performance', 'Cache', 'Auth', 'Storage'],
};

const getCategoryIcon = (category: LogCategory) => {
  switch (category) {
    case 'Navigation':
      return <Navigation className="w-4 h-4 text-indigo-500" />;
    case 'User Action':
    case 'Button Click':
      return <MousePointer className="w-4 h-4 text-cyan-500" />;
    case 'Form Submit':
      return <Send className="w-4 h-4 text-green-500" />;
    case 'Search':
      return <Search className="w-4 h-4 text-blue-500" />;
    case 'Filter':
      return <Filter className="w-4 h-4 text-orange-500" />;
    case 'Modal':
    case 'Tab Change':
      return <Activity className="w-4 h-4 text-purple-500" />;
    case 'Supabase Query':
    case 'Supabase Mutation':
      return <Database className="w-4 h-4 text-emerald-500" />;
    case 'AI Request':
    case 'AI Response':
    case 'AI Analysis':
    case 'AI Chat':
      return <Sparkles className="w-4 h-4 text-purple-500" />;
    case 'Gemini Request':
    case 'Gemini Response':
      return <Sparkles className="w-4 h-4 text-blue-400" />;
    case 'Gemini Error':
    case 'AI Error':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'FMP Request':
    case 'FMP Response':
    case 'FMP Summary':
    case 'Yahoo Request':
    case 'Yahoo Response':
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    case 'FMP Error':
    case 'Yahoo Error':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'Plaid Request':
    case 'Plaid Response':
      return <Wallet className="w-4 h-4 text-blue-600" />;
    case 'Ticker Screener':
      return <BarChart3 className="w-4 h-4 text-amber-500" />;
    case 'Portfolio Analysis':
    case 'Stock Analysis':
      return <TrendingUp className="w-4 h-4 text-cyan-500" />;
    case 'Edge Function':
      return <Zap className="w-4 h-4 text-yellow-500" />;
    case 'Auth':
      return <Lock className="w-4 h-4 text-rose-500" />;
    case 'Storage':
      return <HardDrive className="w-4 h-4 text-slate-500" />;
    case 'Console Error':
    case 'API Error':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'Console Warning':
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    default:
      return <Globe className="w-4 h-4 text-blue-500" />;
  }
};

const LogTypeIcon = ({ type, category }: { type: LogEntry['type']; category: LogCategory }) => {
  // Use category-specific icon if available
  return getCategoryIcon(category);
};

const LogTypeBadge = ({ type, status, source }: { type: LogEntry['type']; status?: number; source?: 'frontend' | 'backend' }) => {
  const getVariant = () => {
    if (status && status >= 400) return 'destructive';
    switch (type) {
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      case 'api': return 'default';
      case 'ai': return 'default';
      case 'backend': return 'default';
      default: return 'outline';
    }
  };
  
  const getClassName = () => {
    if (type === 'ai') return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    if (type === 'backend' || source === 'backend') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (type === 'action') return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    if (type === 'navigation') return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
    return '';
  };
  
  return (
    <Badge variant={getVariant()} className={`text-xs uppercase ${getClassName()}`}>
      {status ? `${status}` : type}
    </Badge>
  );
};

const SourceBadge = ({ source, sessionId }: { source?: 'frontend' | 'backend'; sessionId?: string }) => {
  const isBackend = source === 'backend' || sessionId?.startsWith('backend-');
  
  return (
    <Badge 
      variant="outline" 
      className={`text-xs ${isBackend ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}
    >
      {isBackend ? (
        <>
          <Server className="w-3 h-3 mr-1" />
          Backend
        </>
      ) : (
        <>
          <Monitor className="w-3 h-3 mr-1" />
          Frontend
        </>
      )}
    </Badge>
  );
};

// Helper to check if this is a Gemini log with prompts
const isGeminiLog = (log: LogEntry) => 
  log.category === 'Gemini Request' || log.category === 'Gemini Response' || log.category === 'Gemini Error';

// Extract prompts from Gemini request body
const extractGeminiPrompts = (requestBody: any) => {
  if (!requestBody) return null;
  // Handle stringified JSON
  let body = requestBody;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return null; }
  }
  const systemPrompt = body.systemPrompt || body.messages?.find((m: any) => m.role === 'system')?.content;
  const userPrompt = body.userPrompt || body.messages?.find((m: any) => m.role === 'user')?.content;
  return { systemPrompt, userPrompt };
};

// Group Gemini logs by correlation ID for paired display
interface GeminiLogPair {
  correlationId: string;
  request?: LogEntry;
  response?: LogEntry;
  error?: LogEntry;
}

const groupGeminiLogsByCorrelation = (logs: LogEntry[]): GeminiLogPair[] => {
  const geminiLogs = logs.filter(isGeminiLog);
  const pairs: Map<string, GeminiLogPair> = new Map();
  const unpaired: LogEntry[] = [];
  
  geminiLogs.forEach(log => {
    if (log.correlationId) {
      const existing = pairs.get(log.correlationId) || { correlationId: log.correlationId };
      if (log.category === 'Gemini Request') {
        existing.request = log;
      } else if (log.category === 'Gemini Response') {
        existing.response = log;
      } else if (log.category === 'Gemini Error') {
        existing.error = log;
      }
      pairs.set(log.correlationId, existing);
    } else {
      // No correlation ID - show as unpaired
      unpaired.push(log);
    }
  });
  
  // Convert to array and sort by timestamp (most recent first)
  const pairedArray = Array.from(pairs.values()).sort((a, b) => {
    const aTime = (a.request?.timestamp || a.response?.timestamp || new Date(0)).getTime();
    const bTime = (b.request?.timestamp || b.response?.timestamp || new Date(0)).getTime();
    return bTime - aTime;
  });
  
  // Add unpaired logs as individual pairs
  unpaired.forEach(log => {
    pairedArray.push({
      correlationId: log.id,
      request: log.category === 'Gemini Request' ? log : undefined,
      response: log.category === 'Gemini Response' ? log : undefined,
      error: log.category === 'Gemini Error' ? log : undefined,
    });
  });
  
  return pairedArray;
};

const LogEntryRow = ({ log, currentSessionId }: { log: LogEntry; currentSessionId?: string }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('details');
  
  const hasRequestBody = log.requestBody !== undefined && log.requestBody !== null;
  const hasResponse = log.responsePreview !== undefined && log.responsePreview !== null && log.responsePreview !== '';
  const isCurrentSession = log.sessionId === currentSessionId;
  const isBackend = log.source === 'backend' || log.sessionId?.startsWith('backend-');
  const isGemini = isGeminiLog(log);
  const geminiPrompts = isGemini && hasRequestBody ? extractGeminiPrompts(log.requestBody) : null;
  
  return (
    <div className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${isCurrentSession ? 'bg-accent/5' : ''}`}>
      <div 
        className="flex items-start sm:items-center gap-2 sm:gap-3 p-2 sm:p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="text-muted-foreground mt-1 sm:mt-0 flex-shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        
        <div className="flex-shrink-0">
          <LogTypeIcon type={log.type} category={log.category} />
        </div>
        
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <LogTypeBadge type={log.type} status={log.status} source={log.source} />
            <Badge variant="outline" className="text-[10px] sm:text-xs font-normal truncate max-w-[80px] sm:max-w-none">
              {log.category}
            </Badge>
            <SourceBadge source={log.source} sessionId={log.sessionId} />
            {isCurrentSession && (
              <Badge variant="outline" className="text-[10px] sm:text-xs bg-accent/20 border-accent/30 hidden sm:inline-flex">
                This Session
              </Badge>
            )}
            {isGemini && geminiPrompts && (
              <Badge variant="outline" className="text-[10px] sm:text-xs bg-blue-500/10 border-blue-500/30 text-blue-400 hidden sm:inline-flex">
                <MessageSquare className="w-3 h-3 mr-1" />
                Prompts
              </Badge>
            )}
            {hasRequestBody && !isGemini && (
              <Badge variant="outline" className="text-[10px] sm:text-xs hidden sm:inline-flex">
                <Send className="w-3 h-3 mr-1" />
                Body
              </Badge>
            )}
            {hasResponse && (
              <Badge variant="outline" className="text-[10px] sm:text-xs hidden sm:inline-flex">
                <FileText className="w-3 h-3 mr-1" />
                Response
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm truncate mt-1 text-foreground">{log.message}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground shrink-0">
          {log.duration !== undefined && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {log.duration}ms
            </span>
          )}
          <span className="whitespace-nowrap">{log.timestamp.toLocaleTimeString()}</span>
        </div>
      </div>
      
      {expanded && (
        <div className="px-4 sm:px-12 pb-3 overflow-x-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-2 flex-wrap">
              <TabsTrigger value="details" className="text-xs sm:text-sm">Details</TabsTrigger>
              {isGemini && geminiPrompts?.systemPrompt && (
                <TabsTrigger value="system-prompt" className="text-xs sm:text-sm">
                  <Sparkles className="w-3 h-3 mr-1" />
                  System Prompt
                </TabsTrigger>
              )}
              {isGemini && geminiPrompts?.userPrompt && (
                <TabsTrigger value="user-prompt" className="text-xs sm:text-sm">
                  <MessageSquare className="w-3 h-3 mr-1" />
                  User Prompt
                </TabsTrigger>
              )}
              {hasRequestBody && !isGemini && <TabsTrigger value="request" className="text-xs sm:text-sm">Request Body</TabsTrigger>}
              {hasResponse && (
                <TabsTrigger value="response" className="text-xs sm:text-sm">
                  <FileText className="w-3 h-3 mr-1" />
                  AI Response
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="details">
              <ScrollArea className="w-full">
                <pre className="text-[10px] sm:text-xs bg-muted/50 p-3 rounded-lg overflow-x-auto max-h-64 whitespace-pre-wrap break-all">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              </ScrollArea>
            </TabsContent>
            
            {isGemini && geminiPrompts?.systemPrompt && (
              <TabsContent value="system-prompt">
                <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2 text-purple-400 text-xs font-medium">
                    <Sparkles className="w-4 h-4" />
                    System Prompt
                  </div>
                  <ScrollArea className="w-full max-h-96">
                    <pre className="text-[11px] sm:text-xs whitespace-pre-wrap break-words text-foreground/90 leading-relaxed">
                      {geminiPrompts.systemPrompt}
                    </pre>
                  </ScrollArea>
                </div>
              </TabsContent>
            )}
            
            {isGemini && geminiPrompts?.userPrompt && (
              <TabsContent value="user-prompt">
                <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2 text-blue-400 text-xs font-medium">
                    <MessageSquare className="w-4 h-4" />
                    User Prompt (Input to AI)
                  </div>
                  <ScrollArea className="w-full max-h-96">
                    <pre className="text-[11px] sm:text-xs whitespace-pre-wrap break-words text-foreground/90 leading-relaxed">
                      {geminiPrompts.userPrompt}
                    </pre>
                  </ScrollArea>
                </div>
              </TabsContent>
            )}
            
            {hasRequestBody && !isGemini && (
              <TabsContent value="request">
                <ScrollArea className="w-full">
                  <pre className="text-[10px] sm:text-xs bg-muted/50 p-3 rounded-lg overflow-x-auto max-h-96 whitespace-pre-wrap break-all">
                    {JSON.stringify(log.requestBody, null, 2)}
                  </pre>
                </ScrollArea>
              </TabsContent>
            )}
            
            {hasResponse && (
              <TabsContent value="response">
                <div className={`${isGemini ? 'bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20' : 'bg-muted/50'} rounded-lg p-4`}>
                  {isGemini && (
                    <div className="flex items-center gap-2 mb-2 text-emerald-400 text-xs font-medium">
                      <Sparkles className="w-4 h-4" />
                      AI Response (Output)
                    </div>
                  )}
                  <ScrollArea className="w-full max-h-96">
                    <pre className="text-[11px] sm:text-xs whitespace-pre-wrap break-words text-foreground/90 leading-relaxed">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(log.responsePreview || ''), null, 2);
                        } catch {
                          return log.responsePreview;
                        }
                      })()}
                    </pre>
                  </ScrollArea>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}
    </div>
  );
};

// Component for paired Gemini request/response display
const GeminiLogPairRow = ({ pair, currentSessionId }: { pair: GeminiLogPair; currentSessionId?: string }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('system-prompt');
  
  const request = pair.request;
  const response = pair.response || pair.error;
  const geminiPrompts = request?.requestBody ? extractGeminiPrompts(request.requestBody) : null;
  const hasError = !!pair.error;
  const duration = response?.duration;
  const timestamp = request?.timestamp || response?.timestamp;
  
  // Extract context from request message
  const contextMatch = request?.message?.match(/\(([^)]+)\)/);
  const context = contextMatch ? contextMatch[1] : 'Unknown Context';
  
  return (
    <div className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${hasError ? 'bg-red-500/5' : ''}`}>
      <div 
        className="flex items-start sm:items-center gap-2 sm:gap-3 p-2 sm:p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="text-muted-foreground mt-1 sm:mt-0 flex-shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        
        <div className="flex-shrink-0">
          <Sparkles className={`w-4 h-4 ${hasError ? 'text-red-500' : 'text-blue-400'}`} />
        </div>
        
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <Badge variant={hasError ? "destructive" : "default"} className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
              Gemini
            </Badge>
            {request && response && (
              <Badge variant="outline" className="text-[10px] sm:text-xs bg-green-500/10 border-green-500/30 text-green-400">
                ✓ Paired
              </Badge>
            )}
            {!response && (
              <Badge variant="outline" className="text-[10px] sm:text-xs bg-yellow-500/10 border-yellow-500/30 text-yellow-400">
                Pending Response
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] sm:text-xs font-normal">
              {context}
            </Badge>
            <SourceBadge source="backend" sessionId={request?.sessionId || response?.sessionId} />
          </div>
          <p className="text-xs sm:text-sm truncate mt-1 text-foreground">
            {context}
            {hasError && <span className="text-red-400 ml-2">Error</span>}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground shrink-0">
          {duration !== undefined && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {duration}ms
            </span>
          )}
          {timestamp && (
            <span className="whitespace-nowrap">{timestamp.toLocaleTimeString()}</span>
          )}
        </div>
      </div>
      
      {expanded && (
        <div className="px-4 sm:px-12 pb-3 overflow-x-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-2 flex-wrap">
              {geminiPrompts?.systemPrompt && (
                <TabsTrigger value="system-prompt" className="text-xs sm:text-sm">
                  <Sparkles className="w-3 h-3 mr-1" />
                  System Prompt
                </TabsTrigger>
              )}
              {geminiPrompts?.userPrompt && (
                <TabsTrigger value="user-prompt" className="text-xs sm:text-sm">
                  <MessageSquare className="w-3 h-3 mr-1" />
                  User Prompt
                </TabsTrigger>
              )}
              {(response?.responsePreview || pair.error) && (
                <TabsTrigger value="response" className="text-xs sm:text-sm">
                  <FileText className="w-3 h-3 mr-1" />
                  {hasError ? 'Error' : 'AI Response'}
                </TabsTrigger>
              )}
              <TabsTrigger value="details" className="text-xs sm:text-sm">
                Details
              </TabsTrigger>
            </TabsList>
            
            {geminiPrompts?.systemPrompt && (
              <TabsContent value="system-prompt">
                <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2 text-purple-400 text-xs font-medium">
                    <Sparkles className="w-4 h-4" />
                    System Prompt
                  </div>
                  <ScrollArea className="w-full max-h-96">
                    <pre className="text-[11px] sm:text-xs whitespace-pre-wrap break-words text-foreground/90 leading-relaxed">
                      {geminiPrompts.systemPrompt}
                    </pre>
                  </ScrollArea>
                </div>
              </TabsContent>
            )}
            
            {geminiPrompts?.userPrompt && (
              <TabsContent value="user-prompt">
                <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2 text-blue-400 text-xs font-medium">
                    <MessageSquare className="w-4 h-4" />
                    User Prompt (Input to AI)
                  </div>
                  <ScrollArea className="w-full max-h-96">
                    <pre className="text-[11px] sm:text-xs whitespace-pre-wrap break-words text-foreground/90 leading-relaxed">
                      {geminiPrompts.userPrompt}
                    </pre>
                  </ScrollArea>
                </div>
              </TabsContent>
            )}
            
            {(response?.responsePreview || pair.error) && (
              <TabsContent value="response">
                <div className={`${hasError ? 'bg-gradient-to-r from-red-500/10 to-rose-500/10 border border-red-500/20' : 'bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20'} rounded-lg p-4`}>
                  <div className={`flex items-center gap-2 mb-2 ${hasError ? 'text-red-400' : 'text-emerald-400'} text-xs font-medium`}>
                    {hasError ? <AlertCircle className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    {hasError ? 'Error Response' : 'AI Response (Output)'}
                  </div>
                  <ScrollArea className="w-full max-h-96">
                    <pre className="text-[11px] sm:text-xs whitespace-pre-wrap break-words text-foreground/90 leading-relaxed">
                      {(() => {
                        const preview = response?.responsePreview || '';
                        try {
                          return JSON.stringify(JSON.parse(preview), null, 2);
                        } catch {
                          return preview;
                        }
                      })()}
                    </pre>
                  </ScrollArea>
                </div>
              </TabsContent>
            )}
            
            <TabsContent value="details">
              <ScrollArea className="w-full">
                <pre className="text-[10px] sm:text-xs bg-muted/50 p-3 rounded-lg overflow-x-auto max-h-64 whitespace-pre-wrap break-all">
                  {JSON.stringify({
                    correlationId: pair.correlationId,
                    request: request ? {
                      id: request.id,
                      timestamp: request.timestamp,
                      details: request.details,
                    } : null,
                    response: response ? {
                      id: response.id,
                      timestamp: response.timestamp,
                      duration: response.duration,
                      status: response.status,
                      details: response.details,
                    } : null,
                  }, null, 2)}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

const ActivityLogs = () => {
  const { logs, clearLogs, isLoading, sessionId } = useActivityLogger();
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<LogEntry['type'] | 'all'>('all');
  const [sessionFilter, setSessionFilter] = useState<string | 'all'>('all');
  const [categoryGroupFilter, setCategoryGroupFilter] = useState<keyof typeof CATEGORY_GROUPS>('All');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'frontend' | 'backend'>('all');
  const [geminiOnlyMode, setGeminiOnlyMode] = useState(false);
  
  // Get unique session IDs
  const sessionIds = useMemo(() => {
    const ids = new Set(logs.map(l => l.sessionId).filter(Boolean));
    return Array.from(ids) as string[];
  }, [logs]);
  
  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(logs.map(l => l.category));
    return Array.from(cats).sort();
  }, [logs]);
  
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Gemini only mode - show only Gemini requests/responses
      if (geminiOnlyMode) {
        return isGeminiLog(log) && (filter === '' || 
          log.message.toLowerCase().includes(filter.toLowerCase()));
      }
      
      const matchesSearch = filter === '' || 
        log.message.toLowerCase().includes(filter.toLowerCase()) ||
        log.category.toLowerCase().includes(filter.toLowerCase());
      const matchesType = typeFilter === 'all' || log.type === typeFilter;
      const matchesSession = sessionFilter === 'all' || log.sessionId === sessionFilter;
      
      // Category group filter
      const categoryGroupCategories = CATEGORY_GROUPS[categoryGroupFilter];
      const matchesCategoryGroup = categoryGroupFilter === 'All' || 
        categoryGroupCategories.includes(log.category);
      
      // Source filter
      const isBackend = log.source === 'backend' || log.sessionId?.startsWith('backend-');
      const matchesSource = sourceFilter === 'all' || 
        (sourceFilter === 'backend' && isBackend) ||
        (sourceFilter === 'frontend' && !isBackend);
      
      return matchesSearch && matchesType && matchesSession && matchesCategoryGroup && matchesSource;
    });
  }, [logs, filter, typeFilter, sessionFilter, categoryGroupFilter, sourceFilter, geminiOnlyMode]);
  
  // Group Gemini logs by correlation ID for paired view
  const geminiLogPairs = useMemo(() => {
    if (!geminiOnlyMode) return [];
    const geminiLogs = logs.filter(log => 
      isGeminiLog(log) && (filter === '' || log.message.toLowerCase().includes(filter.toLowerCase()))
    );
    return groupGeminiLogsByCorrelation(geminiLogs);
  }, [logs, filter, geminiOnlyMode]);
  
  // Count Gemini logs (paired)
  const geminiPairsCount = useMemo(() => groupGeminiLogsByCorrelation(logs.filter(isGeminiLog)).length, [logs]);
  
  // Count Gemini logs
  const geminiLogsCount = useMemo(() => logs.filter(isGeminiLog).length, [logs]);
  
  const stats = useMemo(() => {
    const backendLogs = logs.filter(l => l.source === 'backend' || l.sessionId?.startsWith('backend-'));
    const frontendLogs = logs.filter(l => !(l.source === 'backend' || l.sessionId?.startsWith('backend-')));
    
    return {
      total: logs.length,
      frontend: frontendLogs.length,
      backend: backendLogs.length,
      ai: logs.filter(l => l.type === 'ai').length,
      api: logs.filter(l => l.type === 'api').length,
      errors: logs.filter(l => l.type === 'error').length,
      actions: logs.filter(l => l.type === 'action').length,
      navigation: logs.filter(l => l.type === 'navigation').length,
    };
  }, [logs]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 container max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="w-6 h-6 text-primary" />
                Activity Logs
              </h1>
              <p className="text-muted-foreground text-sm mt-1">Loading logs...</p>
            </div>
          </div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 container max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              Activity Logs
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1 hidden sm:block">
              Monitor all API calls, user actions, and backend processes in real-time
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
              <Radio className="w-3 h-3 text-green-500 animate-pulse" />
              Live
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="h-8">
              <RefreshCw className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="destructive" size="sm" onClick={clearLogs} className="h-8">
              <Trash2 className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Clear All</span>
            </Button>
          </div>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="bg-card border rounded-lg p-2 sm:p-3">
            <div className="text-lg sm:text-xl font-bold">{stats.total}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Total</div>
          </div>
          <div className="bg-card border rounded-lg p-2 sm:p-3">
            <div className="text-lg sm:text-xl font-bold text-blue-500">{stats.frontend}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Front</div>
          </div>
          <div className="bg-card border rounded-lg p-2 sm:p-3">
            <div className="text-lg sm:text-xl font-bold text-emerald-500">{stats.backend}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Back</div>
          </div>
          <div className="bg-card border rounded-lg p-2 sm:p-3">
            <div className="text-lg sm:text-xl font-bold text-purple-500">{stats.ai}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">AI</div>
          </div>
          <div className="bg-card border rounded-lg p-2 sm:p-3 hidden sm:block">
            <div className="text-lg sm:text-xl font-bold text-cyan-500">{stats.api}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">API</div>
          </div>
          <div className="bg-card border rounded-lg p-2 sm:p-3 hidden lg:block">
            <div className="text-lg sm:text-xl font-bold text-indigo-500">{stats.navigation}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Nav</div>
          </div>
          <div className="bg-card border rounded-lg p-2 sm:p-3 hidden lg:block">
            <div className="text-lg sm:text-xl font-bold text-amber-500">{stats.actions}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Actions</div>
          </div>
          <div className="bg-card border rounded-lg p-2 sm:p-3 hidden sm:block">
            <div className="text-lg sm:text-xl font-bold text-red-500">{stats.errors}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Errors</div>
          </div>
        </div>
        
        {/* Gemini Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant={geminiOnlyMode ? "default" : "outline"}
            size="sm"
            onClick={() => setGeminiOnlyMode(!geminiOnlyMode)}
            className={geminiOnlyMode ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Gemini Prompts Only
            {geminiPairsCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {geminiPairsCount} pairs
              </Badge>
            )}
          </Button>
          {geminiOnlyMode && (
            <span className="text-xs text-muted-foreground">
              Showing paired request/response entries with full prompts
            </span>
          )}
        </div>
        
        {/* Filters */}
        <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mb-4 ${geminiOnlyMode ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-10 h-9 sm:h-10 text-sm"
            />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}>
              <SelectTrigger className="w-[100px] sm:w-[140px] h-9 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="frontend">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4" />
                    <span className="hidden sm:inline">Frontend</span>
                    <span className="sm:hidden">Front</span>
                  </div>
                </SelectItem>
                <SelectItem value="backend">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4" />
                    <span className="hidden sm:inline">Backend</span>
                    <span className="sm:hidden">Back</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={categoryGroupFilter} onValueChange={(v) => setCategoryGroupFilter(v as keyof typeof CATEGORY_GROUPS)}>
              <SelectTrigger className="w-[100px] sm:w-[140px] h-9 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(CATEGORY_GROUPS).map((group) => (
                  <SelectItem key={group} value={group}>{group}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {(['all', 'ai', 'api', 'error'] as const).map((type) => (
              <Button
                key={type}
                variant={typeFilter === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTypeFilter(type)}
                className={`h-8 text-xs sm:text-sm px-2 sm:px-3 ${
                  type === 'ai' && typeFilter === type ? 'bg-purple-500 hover:bg-purple-600' :
                  type === 'api' && typeFilter === type ? 'bg-cyan-500 hover:bg-cyan-600' :
                  ''
                }`}
              >
                {type === 'all' ? 'All' : type.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Logs List */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-4 py-2 border-b flex items-center justify-between">
            <span className="text-sm font-medium">
              {geminiOnlyMode 
                ? `${geminiLogPairs.length} paired ${geminiLogPairs.length === 1 ? 'request' : 'requests'}`
                : `${filteredLogs.length} ${filteredLogs.length === 1 ? 'entry' : 'entries'}`
              }
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Radio className="w-3 h-3 text-green-500 animate-pulse" />
              Real-time sync enabled
            </span>
          </div>
          
          <ScrollArea className="h-[600px]">
            {geminiOnlyMode ? (
              // Paired Gemini view
              geminiLogPairs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Sparkles className="w-12 h-12 mb-4 opacity-50" />
                  <p>No Gemini logs to display</p>
                  <p className="text-sm">Run a stock analysis to see AI prompts and responses</p>
                </div>
              ) : (
                geminiLogPairs.map((pair) => (
                  <GeminiLogPairRow key={pair.correlationId} pair={pair} currentSessionId={sessionId} />
                ))
              )
            ) : (
              // Regular logs view
              filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Activity className="w-12 h-12 mb-4 opacity-50" />
                  <p>No logs to display</p>
                  <p className="text-sm">Logs will appear here as you use the app</p>
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <LogEntryRow key={log.id} log={log} currentSessionId={sessionId} />
                ))
              )
            )}
          </ScrollArea>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ActivityLogs;
