import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthGate } from "@/hooks/useAuthGate";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, RefreshCw, Sparkles, Copy, Check, Download, FileText, Terminal, Edit, Send, X, Eye, Globe, ExternalLink, Search, BookOpen, CheckCircle2, Target, Zap, TrendingUp, Lightbulb, Flame, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/apiAdapter";
import { fetchAuthSession, signOut } from "aws-amplify/auth";
import { blogPosts as existingBlogPosts, BlogPost } from "@/data/blogPosts";
import { TopicSuggestions } from "@/components/blog/TopicSuggestions";
import { AutoPublishControl } from "@/components/blog/AutoPublishControl";

const BACKEND_URL = import.meta.env.VITE_AWS_API_URL || "http://localhost:8000";

interface GroundingSource {
  uri: string;
  title: string;
}

interface ResearchGoal {
  id: string;
  type: "RESEARCH" | "DELIVERABLE";
  description: string;
  status: "pending" | "approved" | "modified" | "new";
}

interface DiscoveredTopic {
  topic: string;
  reason: string;
  relevanceScore: number;
  timeliness: "trending_now" | "emerging" | "evergreen";
  claritxConnection: string;
  suggestedAngle: string;
  isBreakingNews?: boolean;
}

interface ResearchPlan {
  topic: string;
  goals: ResearchGoal[];
  suggestedOutline: string[];
}

interface GeneratedBlog {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
  metaDescription: string;
  readTime: number;
  imagePrompt: string;
  image_url?: string;
  sources?: GroundingSource[];
}

interface LogEntry {
  timestamp: Date;
  type: "info" | "success" | "error" | "warning" | "ai";
  message: string;
}

type GenerationMode = "standard" | "grounded" | "deep-search";

export default function BlogGenerator() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { requireAuth } = useAuthGate();
  const [blogCount, setBlogCount] = useState(1);
  const [userPrompt, setUserPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBlogs, setGeneratedBlogs] = useState<GeneratedBlog[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("deep-search");
  
  // Deep Search state
  const [researchPlan, setResearchPlan] = useState<ResearchPlan | null>(null);
  const [isPlanningPhase, setIsPlanningPhase] = useState(false);
  const [isExecutingResearch, setIsExecutingResearch] = useState(false);
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [lastProgressUpdate, setLastProgressUpdate] = useState<number>(Date.now());
  const [isJobStuck, setIsJobStuck] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  
  // Edit dialog state
  const [editingBlog, setEditingBlog] = useState<GeneratedBlog | null>(null);
  const [editedBlog, setEditedBlog] = useState<GeneratedBlog | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Preview dialog state
  const [previewBlog, setPreviewBlog] = useState<GeneratedBlog | null>(null);
  
  // Topic discovery state
  const [isDiscoveringTopics, setIsDiscoveringTopics] = useState(false);
  const [discoveredTopics, setDiscoveredTopics] = useState<DiscoveredTopic[]>([]);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"settings" | "history">("settings");
  const [historyJobs, setHistoryJobs] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (type: LogEntry["type"], message: string) => {
    setLogs((prev) => [...prev, { timestamp: new Date(), type, message }]);
  };

  const fetchHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const blogData = await api.get('/blog-jobs');
      const searchData = await api.get('/deep-search-jobs');
      
      const allJobs = [
        ...(blogData?.jobs || []).map((j: any) => ({ ...j, type: 'standard' })),
        ...(searchData?.jobs || []).map((j: any) => ({ ...j, type: 'deep-search' }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setHistoryJobs(allJobs);
    } catch (e) {
      console.error("Failed to load history:", e);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab]);

  const getImgSrc = (src?: string) => {
    if (!src) return "";
    // 1. Already a proxied backend path — prepend API base
    if (src.startsWith("/blogs/images/")) return `${BACKEND_URL}${src}`;
    // 2. Full GCS URL — strip bucket prefix and route through proxy
    const GCS_PREFIX = `https://storage.googleapis.com/${import.meta.env.VITE_GCS_BUCKET_NAME || "your-gcs-bucket"}/`;
    if (src.startsWith(GCS_PREFIX)) {
      return `${BACKEND_URL}/blogs/images/${src.replace(GCS_PREFIX, "")}`;
    }
    // 3. Bare GCS-relative path returned by generate_image_with_vertex
    //    e.g. "images/blog/slug-1234.jpg" (no scheme, no leading slash)
    if (src.startsWith("images/blog/") || src.startsWith("images/")) {
      return `${BACKEND_URL}/blogs/images/${src}`;
    }
    // 4. Absolute URL or data URI — pass through as-is
    return src;
  };

  const loadJobResult = async (jobId: string, type: string) => {
    setIsGenerating(true);
    addLog("info", `Loading results for ${type} job: ${jobId.slice(0, 8)}...`);
    try {
      const endpoint = type === 'deep-search' ? 'deep-search-job-status' : 'blog-job-status';
      const data = await api.post(`/${endpoint}`, { jobId });
      if (!data?.success) throw new Error("Failed to load result");
      
      const job = data.job;
      if (job.status !== 'completed') {
        toast({ title: "Job Not Ready", description: `This job is currently ${job.status}` });
        return;
      }
      
      if (type === 'deep-search') {
        setGeneratedBlogs([job.result.blog]);
      } else {
        setGeneratedBlogs(job.result.blogs || []);
      }
      
      setActiveTab("settings");
      toast({ title: "Loaded!", description: "Generation results reloaded into editor" });
      addLog("success", "Results loaded successfully. You can now preview or publish.");
    } catch (e) {
      console.error(e);
      toast({ title: "Load Failed", description: "Could not load the results for this job", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  // Discover trending topics — async job pattern (Vertex AI runs in background worker)
  const handleDiscoverTopics = async () => {
    setIsDiscoveringTopics(true);
    setDiscoveredTopics([]);
    setLogs([]);

    addLog("info", "🔍 Scanning web for trending finance topics...");
    addLog("ai", "Looking for topics that are: hot, relevant to investors, evergreen, and ClaritX-connected");

    try {
      // Step 1: kick off the job (returns immediately)
      const startData = await api.post('/discover-blog-topics', {});
      if (!startData?.success || !startData?.jobId) {
        throw new Error(startData?.error || "Failed to start topic discovery");
      }

      const jobId: string = startData.jobId;
      addLog("info", `📌 Discovery job started (${jobId.slice(0, 8)}...) — researching with Vertex AI...`);

      // Step 2: poll until completed (Vertex AI usually takes 15-40s)
      const pollInterval = 3000;
      const maxWait = 90_000;
      const startTime = Date.now();

      const poll = async (): Promise<void> => {
        if (Date.now() - startTime > maxWait) {
          throw new Error("Topic discovery timed out after 90 seconds");
        }

        const statusData = await api.get(`/discover-topics-status?jobId=${jobId}`);

        if (!statusData?.success) {
          throw new Error(statusData?.error || "Failed to poll discovery status");
        }

        if (statusData.status === "failed") {
          throw new Error(statusData.error || "Topic discovery failed on server");
        }

        if (statusData.status === "completed") {
          const topics: DiscoveredTopic[] = statusData.topics || [];
          setDiscoveredTopics(topics);
          addLog("success", `✅ Found ${topics.length} trending topics!`);
          topics.forEach((t, i) => {
            const icon = t.timeliness === "trending_now" ? "🔥" : t.timeliness === "emerging" ? "📈" : "♻️";
            addLog("info", `  ${i + 1}. ${icon} ${t.topic} (score: ${t.relevanceScore}/10)`);
          });
          addLog("info", "👆 Click a topic to select it for Deep Search");
          toast({ title: "Topics Discovered!", description: `Found ${topics.length} trending topics` });
          return;
        }

        // still pending/running — wait and poll again
        await new Promise(r => setTimeout(r, pollInterval));
        return poll();
      };

      await poll();
    } catch (error) {
      console.error("Topic discovery error:", error);
      addLog("error", `Discovery failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      toast({ title: "Discovery Failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsDiscoveringTopics(false);
    }
  };


  // Deep Search: Generate Plan (Phase 1)
  const handleGeneratePlan = async () => {
    if (!requireAuth()) return;
    if (!userPrompt.trim()) {
      toast({ title: "Topic Required", description: "Please enter a topic for Deep Search mode", variant: "destructive" });
      return;
    }

    setIsPlanningPhase(true);
    setLogs([]);
    setResearchPlan(null);

    addLog("info", `🎯 Starting Deep Search for: "${userPrompt}"`);
    addLog("ai", "📋 Phase 1: Generating research plan...");

    try {
      const data = await api.post('/deep-search-plan', { topic: userPrompt.trim() });

      if (!data?.success || !data?.jobId) {
        throw new Error(data?.error || "Failed to start plan generation");
      }

      const jobId = data.jobId;
      addLog("info", `📌 Plan job started: ${jobId.slice(0, 8)}...`);

      // Poll for plan status
      const pollInterval = 2000;
      const startTime = Date.now();
      const maxWait = 60000; // 1 minute

      const pollPlan = async (): Promise<void> => {
        if (Date.now() - startTime > maxWait) {
          throw new Error("Plan generation timed out");
        }

        const statusData = await api.post('/deep-search-job-status', { jobId,
        });

        if (!statusData?.success) {
          throw new Error(statusData?.error || "Failed to get plan status");
        }

        const job = statusData.job;
        
        // Append new logs if any
        if (job.progress_logs && job.progress_logs.length > 0) {
          // Just add the last one for brevity in planning phase
          const lastLog = job.progress_logs[job.progress_logs.length - 1];
          if (!logs.includes(lastLog)) {
             addLog("ai", lastLog);
          }
        }

        if (job.status === "pending_approval") {
          setResearchPlan({
            topic: job.topic,
            goals: job.goals,
            suggestedOutline: job.outline
          });
          addLog("success", `✅ Plan generated with ${job.goals?.length || 0} research goals`);
          toast({ title: "Research Plan Ready", description: "Review the plan and approve to start research" });
          return;
        }

        if (job.status === "failed") {
          throw new Error(job.error_message || "Plan generation failed");
        }

        await new Promise(r => setTimeout(r, pollInterval));
        return pollPlan();
      };

      await pollPlan();
    } catch (error) {
      console.error("Plan generation error:", error);
      addLog("error", `Plan generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      toast({ title: "Plan Generation Failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsPlanningPhase(false);
    }
  };

  // Deep Search: Execute Research (Phase 2) — Background Job with Polling
  const handleExecuteResearch = async () => {
    if (!requireAuth()) return;
    if (!researchPlan) return;

    const approvedGoals = researchPlan.goals.filter(g => g.status !== "pending" || true);
    if (approvedGoals.length === 0) {
      toast({ title: "No Goals Selected", description: "Please approve at least one research goal", variant: "destructive" });
      return;
    }

    setIsExecutingResearch(true);
    setJobProgress(0);
    setCurrentJobId(null);
    addLog("ai", "🔬 Phase 2: Starting background research job...");
    addLog("info", `Researching ${approvedGoals.length} goals with critique loop...`);

    try {
      // Start the job (returns immediately with jobId)
      const data = await api.post('/deep-search-execute', {
        topic: researchPlan.topic,
        goals: approvedGoals,
        outline: researchPlan.suggestedOutline,
      });

      if (!data?.success || !data?.jobId) {
        throw new Error(data?.error || "Failed to start research job");
      }

      const jobId = data.jobId;
      setCurrentJobId(jobId);
      addLog("info", `📌 Job started: ${jobId.slice(0, 8)}...`);

      // Poll for status
      const pollInterval = 3000;
      const maxPollTime = 10 * 60 * 1000; // 10 minutes
      const startTime = Date.now();
      let lastLogCount = 0;

      const poll = async (): Promise<void> => {
        if (Date.now() - startTime > maxPollTime) {
          throw new Error("Research timed out after 10 minutes");
        }

        const statusData = await api.post('/deep-search-job-status', { jobId,
        });

        if (!statusData?.success) {
          throw new Error(statusData?.error || "Failed to get job status");
        }

        const job = statusData.job;
        const newProgress = job.progress_pct || 0;
        
        // Track progress updates for stuck detection
        if (newProgress !== jobProgress) {
          setLastProgressUpdate(Date.now());
          setIsJobStuck(false);
        } else {
          // Check if stuck (no progress for 2+ minutes)
          const timeSinceUpdate = Date.now() - lastProgressUpdate;
          if (timeSinceUpdate > 2 * 60 * 1000 && job.status === "running") {
            setIsJobStuck(true);
          }
        }
        
        setJobProgress(newProgress);

        // Append new logs
        const jobLogs: string[] = job.progress_logs || [];
        if (jobLogs.length > lastLogCount) {
          for (let i = lastLogCount; i < jobLogs.length; i++) {
            const logLine = jobLogs[i];
            // Determine log type
            let logType: LogEntry["type"] = "info";
            if (logLine.includes("ERROR")) logType = "error";
            else if (logLine.includes("✅") || logLine.includes("complete")) logType = "success";
            else if (logLine.includes("🔍") || logLine.includes("🎯") || logLine.includes("📋")) logType = "ai";
            addLog(logType, logLine);
          }
          lastLogCount = jobLogs.length;
        }

        if (job.status === "completed") {
          const result = job.result;
          addLog("success", `📊 Stats: ${result.researchStats.totalSources} sources, Quality: ${result.researchStats.averageQuality.toFixed(1)}/10`);
          addLog("success", `📝 Blog: "${result.blog.title}"`);
          setGeneratedBlogs([result.blog]);
          setResearchPlan(null);
          setCurrentJobId(null);
          toast({ title: "Deep Search Complete! 🎉", description: `Generated "${result.blog.title}" with ${result.blog.sources?.length || 0} sources` });
          return;
        }

        if (job.status === "failed") {
          throw new Error(job.error_message || "Research failed");
        }

        // Continue polling
        await new Promise((r) => setTimeout(r, pollInterval));
        return poll();
      };

      await poll();
    } catch (error) {
      console.error("Research execution error:", error);
      addLog("error", `Research failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      toast({ title: "Research Failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsExecutingResearch(false);
      setCurrentJobId(null);
    }
  };

  // Standard/Grounded mode generation
  const handleGenerate = async () => {
    if (generationMode === "deep-search") {
      return handleGeneratePlan();
    }

    setIsGenerating(true);
    setGeneratedBlogs([]);
    setLogs([]);

    const isGrounded = generationMode === "grounded";
    addLog("info", `Starting generation of ${blogCount} blog(s)...`);
    addLog("info", `Mode: ${isGrounded ? "🌐 Grounded (real-time web search)" : "📚 Standard (training data)"}`);
    if (userPrompt) {
      addLog("info", `User prompt: "${userPrompt.substring(0, 100)}${userPrompt.length > 100 ? '...' : ''}"`);
    } else {
      addLog("info", "No user prompt provided - AI will pick trending topics");
    }

    try {
      addLog("info", "Connecting to AI gateway...");
      addLog("ai", isGrounded 
        ? "🤖 Initializing Vertex AI with Google Search grounding..." 
        : "🤖 Initializing Gemini 2.5 Pro...");
      
      const startTime = Date.now();
      const functionName = isGrounded ? "generate-blog-grounded" : "generate-blog";
      
      const data = await api.post(`/${functionName}`, {
        count: blogCount,
        userPrompt: userPrompt.trim() || undefined,
      });

      // If Grounded, we now get a jobId instead of direct blogs
      if (isGrounded && data?.jobId) {
        const jobId = data.jobId;
        addLog("info", `📌 Job started: ${jobId.slice(0, 8)}...`);
        
        let lastLogCount = 0;
        const pollInterval = 3000;
        const maxPollTime = 5 * 60 * 1000; // 5 minutes
        
        const pollJob = async (): Promise<void> => {
          if (Date.now() - startTime > maxPollTime) {
            throw new Error("Generation timed out after 5 minutes");
          }

          const statusData = await api.post('/blog-job-status', { jobId });

          if (!statusData?.success) {
            throw new Error("Failed to get job status");
          }

          const job = statusData.job;
          
          // Show progress logs
          const jobLogs: string[] = job.progress_logs || [];
          if (jobLogs.length > lastLogCount) {
             for (let i = lastLogCount; i < jobLogs.length; i++) {
                const logLine = jobLogs[i];
                let logType: "info" | "success" | "error" | "ai" = "info";
                if (logLine.includes("❌")) logType = "error";
                else if (logLine.includes("✅")) logType = "success";
                else if (logLine.includes("🔍") || logLine.includes("🤖")) logType = "ai";
                addLog(logType, logLine);
             }
             lastLogCount = jobLogs.length;
          }

          if (job.status === "completed") {
            const result = job.result;
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            addLog("success", `✅ Generation complete in ${duration}s`);
            
            result.blogs.forEach((blog: GeneratedBlog, i: number) => {
              addLog("success", `📝 Blog ${i + 1}: "${blog.title}"`);
            });

            setGeneratedBlogs(result.blogs);
            toast({
              title: "Blogs Generated!",
              description: `Successfully created ${result.blogs.length} blog post(s).`,
            });
            return;
          }

          if (job.status === "failed") {
            throw new Error(job.error_message || "Generation failed on server");
          }

          await new Promise(r => setTimeout(r, pollInterval));
          return pollJob();
        };

        await pollJob();
        return;
      }

      // Standard mode (direct response)
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (!data?.success || !data?.blogs) {
        addLog("error", `Generation failed: ${data?.error || "Unknown error"}`);
        throw new Error(data?.error || "Failed to generate blogs");
      }

      addLog("success", `✅ Generation complete in ${duration}s`);
      
      // Log each generated blog
      data.blogs.forEach((blog: GeneratedBlog, i: number) => {
        addLog("success", `📝 Blog ${i + 1}: "${blog.title}"`);
        addLog("info", `   └─ Slug: ${blog.slug}`);
        addLog("info", `   └─ Words: ${blog.content.split(/\s+/).length}`);
        addLog("info", `   └─ Tags: ${blog.tags.join(", ")}`);
        if (blog.sources && blog.sources.length > 0) {
          addLog("info", `   └─ Sources: ${blog.sources.length} citations`);
        }
      });

      setGeneratedBlogs(data.blogs);
      toast({
        title: "Blogs Generated!",
        description: `Successfully created ${data.blogs.length} blog post(s).`,
      });
    } catch (error) {
      console.error("Generation error:", error);
      addLog("error", `Fatal error: ${error instanceof Error ? error.message : "Unknown error"}`);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate blogs",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyBlogCode = async (blog: GeneratedBlog, index: number) => {
    const today = new Date().toISOString().split("T")[0];
    const code = `{
  slug: "${blog.slug}",
  title: "${blog.title.replace(/"/g, '\\"')}",
  excerpt: "${blog.excerpt.replace(/"/g, '\\"')}",
  content: \`
${blog.content}
  \`,
  author: "ClaritX Research Team",
  publishedAt: "${today}",
  readTime: ${blog.readTime},
  tags: ${JSON.stringify(blog.tags)},
  image: "${blog.slug}",
  metaDescription: "${blog.metaDescription.replace(/"/g, '\\"')}"
},`;

    await navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    addLog("success", `Copied blog "${blog.title}" to clipboard`);
    toast({ title: "Copied!", description: "Blog code copied to clipboard" });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const downloadAllBlogs = () => {
    const today = new Date().toISOString().split("T")[0];
    let allCode = "// Add these to src/data/blogPosts.ts\n\n";
    
    generatedBlogs.forEach((blog) => {
      allCode += `{
  slug: "${blog.slug}",
  title: "${blog.title.replace(/"/g, '\\"')}",
  excerpt: "${blog.excerpt.replace(/"/g, '\\"')}",
  content: \`
${blog.content}
  \`,
  author: "ClaritX Research Team",
  publishedAt: "${today}",
  readTime: ${blog.readTime},
  tags: ${JSON.stringify(blog.tags)},
  image: "${blog.slug}",
  metaDescription: "${blog.metaDescription.replace(/"/g, '\\"')}"
},

`;
    });

    allCode += "\n// Image prompts for generation:\n";
    generatedBlogs.forEach((blog) => {
      allCode += `// ${blog.slug}: ${blog.imagePrompt}\n`;
    });

    const blob = new Blob([allCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `generated-blogs-${today}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addLog("success", "Downloaded all blogs as text file");
  };

  const openEditDialog = (blog: GeneratedBlog) => {
    setEditingBlog(blog);
    setEditedBlog({ ...blog });
    setIsEditDialogOpen(true);
  };

  const saveEditedBlog = () => {
    if (!editedBlog || !editingBlog) return;
    
    setGeneratedBlogs((prev) =>
      prev.map((b) => (b.slug === editingBlog.slug ? editedBlog : b))
    );
    
    addLog("success", `Updated blog: "${editedBlog.title}"`);
    toast({ title: "Blog Updated", description: "Your changes have been saved" });
    setIsEditDialogOpen(false);
    setEditingBlog(null);
    setEditedBlog(null);
  };

  const openPreviewDialog = (blog: GeneratedBlog) => {
    setPreviewBlog(blog);
    setIsPreviewDialogOpen(true);
  };

  const [isPublishing, setIsPublishing] = useState(false);

  const publishBlog = async (blog: GeneratedBlog) => {
    // Check if slug already exists in static posts
    const existsInStatic = existingBlogPosts.some((p) => p.slug === blog.slug);
    if (existsInStatic) {
      toast({
        title: "Slug Already Exists",
        description: `A blog with slug "${blog.slug}" already exists in static posts. Please edit the slug first.`,
        variant: "destructive",
      });
      return;
    }

    setIsPublishing(true);
    addLog("info", `🚀 Starting publish process for "${blog.title}"...`);
    addLog("ai", "🎨 Generating featured image with AI...");

    try {
      const startTime = Date.now();

      const redirectToAuth = () => {
        navigate("/auth?redirect=/admin/blog-generator");
      };

      const amplifySession = await fetchAuthSession().catch(() => null);
      const session = amplifySession?.tokens?.idToken ? { access_token: amplifySession.tokens.idToken.toString() } : null;
      if (!session?.access_token) {
        addLog("error", "Publish requires sign-in. Please sign in and try again.");
        toast({
          title: "Sign In Required",
          description: "Please sign in to publish blogs.",
          variant: "destructive",
        });
        redirectToAuth();
        return;
      }

      // Validate the token before calling the privileged backend function.
      const user = amplifySession?.tokens ? { id: 'valid' } : null;
      if (!user) {
        console.error("Invalid session token; signing out");
        await signOut();
        addLog("error", "Your session expired. Please sign in again.");
        toast({
          title: "Session Expired",
          description: "Please sign in again to publish blogs.",
          variant: "destructive",
        });
        redirectToAuth();
        return;
      }

      const response = { data: await api.post('/publish-blog', { blog }), error: null };

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      // Handle 409 conflict (duplicate slug)
      if (response.error?.message?.includes("409") || response.data?.error?.includes("already exists")) {
        addLog("warning", `⚠️ Blog with slug "${blog.slug}" already exists in database`);
        toast({
          title: "Blog Already Exists",
          description: (
            <div className="space-y-2">
              <p>A blog with this slug already exists.</p>
              <p className="text-sm text-muted-foreground">
                Edit the slug to create a new version, or view the existing post.
              </p>
              <a 
                href={`/blog/${blog.slug}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary underline text-sm"
              >
                View existing post →
              </a>
            </div>
          ),
          variant: "destructive",
        });
        return;
      }

      if (response.error) {
        addLog("error", `Publish failed: ${response.error.message}`);
        throw new Error(response.error.message);
      }

      if (!response.data?.success) {
        addLog("error", `Publish failed: ${response.data?.error || "Unknown error"}`);
        throw new Error(response.data?.error || "Failed to publish blog");
      }

      addLog("success", `✅ Blog published in ${duration}s!`);
      addLog("success", `📍 URL: /blog/${blog.slug}`);
      if (response.data.blog?.image_url) {
        addLog("success", `🖼️ Image: ${response.data.blog.image_url}`);
      }

      // Remove from generated list
      setGeneratedBlogs((prev) => prev.filter((b) => b.slug !== blog.slug));

      toast({
        title: "Blog Published! 🎉",
        description: (
          <div className="space-y-2">
            <p>"{blog.title}" is now live!</p>
            <a 
              href={`/blog/${blog.slug}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary underline text-sm"
            >
              View blog post →
            </a>
          </div>
        ),
      });
    } catch (error) {
      console.error("Publish error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to publish blog";
      // Additional check for 409 in catch block
      if (errorMessage.includes("already exists")) {
        toast({
          title: "Blog Already Exists",
          description: `Please edit the slug "${blog.slug}" before publishing.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Publish Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return "✅";
      case "error": return "❌";
      case "warning": return "⚠️";
      case "ai": return "🤖";
      default: return "ℹ️";
    }
  };

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return "text-emerald-500";
      case "error": return "text-destructive";
      case "warning": return "text-amber-500";
      case "ai": return "text-primary";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="pt-24 pb-16 flex-1">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <div className="text-center mb-8">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
              Admin Tool
            </Badge>
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-4">
              <span className="text-foreground">AI Blog</span>{" "}
              <span className="text-primary">Generator</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Generate SEO-optimized, deep-content blog posts using AI.
            </p>
          </div>

          {/* Auto-Publish Control Panel */}
          <div className="mb-6">
            <AutoPublishControl onLog={addLog} />
          </div>

          <div className="flex justify-center mb-8">
            <div className="inline-flex p-1 bg-muted rounded-xl gap-1 border border-border/10 shadow-inner">
              <Button 
                variant={activeTab === "settings" ? "default" : "ghost"} 
                size="sm" 
                onClick={() => setActiveTab("settings")}
                className="h-8 rounded-lg px-6"
              >
                Create
              </Button>
              <Button 
                variant={activeTab === "history" ? "default" : "ghost"} 
                size="sm" 
                onClick={() => setActiveTab("history")}
                className="h-8 rounded-lg px-6"
              >
                Drafts & History
              </Button>
            </div>
          </div>

          {activeTab === "history" ? (
            <div className="space-y-6 animate-fade-in">
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <BookOpen className="h-5 w-5 text-primary" />
                      Generation History
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={fetchHistory} disabled={isHistoryLoading}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${isHistoryLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-4">
                    Review and publish articles generated in previous sessions.
                  </div>
                  
                  {isHistoryLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p>Loading your generations...</p>
                    </div>
                  ) : historyJobs.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No generations found yet. Go to the "Create" tab to start one!
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-border/50 text-xs font-medium uppercase text-muted-foreground">
                            <th className="px-4 py-3">Topic / Task</th>
                            <th className="px-4 py-3">Mode</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {historyJobs.map((job) => (
                            <tr key={job.id} className="group hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-4 max-w-md truncate">
                                <p className="font-medium text-foreground truncate">{job.topic}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{job.id.slice(0, 8)}</p>
                              </td>
                              <td className="px-4 py-4">
                                <Badge variant="outline" className={job.type === 'deep-search' ? 'bg-primary/5 text-primary border-primary/20' : ''}>
                                  {job.type === 'deep-search' ? 'Deep Search' : 'Standard'}
                                </Badge>
                              </td>
                              <td className="px-4 py-4">
                                <Badge 
                                  variant="secondary" 
                                  className={
                                    job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                                    job.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                                    'bg-amber-500/10 text-amber-500'
                                  }
                                >
                                  {job.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-4 text-xs text-muted-foreground">
                                {new Date(job.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-4 text-right">
                                {job.status === 'completed' ? (
                                  <Button size="sm" variant="ghost" className="hover:text-primary" onClick={() => loadJobResult(job.id, job.type)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Review
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="ghost" disabled>
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-3 animate-fade-in">

            {/* Input Section */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm lg:col-span-1">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Blog Count */}
                <div className="space-y-2">
                  <Label htmlFor="blogCount">Number of Blogs</Label>
                  <Input
                    id="blogCount"
                    type="number"
                    min={1}
                    max={5}
                    value={blogCount}
                    onChange={(e) => setBlogCount(Math.min(5, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="bg-background"
                  />
                </div>

                {/* Generation Mode Selector */}
                <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <Label className="text-sm font-medium">Generation Mode</Label>
                  
                  <div 
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${generationMode === "deep-search" ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"}`}
                    onClick={() => setGenerationMode("deep-search")}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${generationMode === "deep-search" ? "border-primary" : "border-muted-foreground"}`}>
                      {generationMode === "deep-search" && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Deep Search</span>
                        <Badge variant="secondary" className="text-xs">Recommended</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Multi-step research with critique loop</p>
                    </div>
                  </div>

                  <div 
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${generationMode === "grounded" ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"}`}
                    onClick={() => setGenerationMode("grounded")}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${generationMode === "grounded" ? "border-primary" : "border-muted-foreground"}`}>
                      {generationMode === "grounded" && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">Grounded</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Single-pass web search</p>
                    </div>
                  </div>

                  <div 
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${generationMode === "standard" ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"}`}
                    onClick={() => setGenerationMode("standard")}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${generationMode === "standard" ? "border-primary" : "border-muted-foreground"}`}>
                      {generationMode === "standard" && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Standard</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Training data only</p>
                    </div>
                  </div>
                </div>

                {/* User Prompt */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="userPrompt">
                      {generationMode === "deep-search" ? "Research Topic (required)" : "Topic / Instructions"}
                    </Label>
                    {generationMode === "deep-search" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDiscoverTopics}
                        disabled={isDiscoveringTopics || isPlanningPhase || isExecutingResearch}
                        className="text-xs h-7 gap-1.5"
                      >
                        {isDiscoveringTopics ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Discovering...
                          </>
                        ) : (
                          <>
                            <Flame className="h-3 w-3 text-orange-500" />
                            Discover Hot Topic
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  
                  {/* Discovered Topics Panel */}
                  {discoveredTopics.length > 0 && generationMode === "deep-search" && (
                    <div className="p-3 rounded-lg border border-orange-500/30 bg-orange-500/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                          <TrendingUp className="h-3 w-3" />
                          Trending Topics Found
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDiscoveredTopics([])}
                          className="h-5 w-5 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        {discoveredTopics.map((topic, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setUserPrompt(topic.topic);
                              setDiscoveredTopics([]);
                              addLog("success", `Selected: "${topic.topic}"`);
                              toast({ title: "Topic Selected", description: topic.topic });
                            }}
                            className={`p-2 rounded-md bg-background/80 hover:bg-primary/10 cursor-pointer transition-colors border group ${topic.isBreakingNews ? "border-red-500/50 bg-red-500/5" : "border-border/50"}`}
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-shrink-0 mt-0.5">
                                {topic.isBreakingNews ? (
                                  <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
                                ) : topic.timeliness === "trending_now" ? (
                                  <Flame className="h-4 w-4 text-red-500" />
                                ) : topic.timeliness === "emerging" ? (
                                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <Lightbulb className="h-4 w-4 text-amber-500" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-1">
                                  {topic.topic}
                                </p>
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                  {topic.reason}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant={topic.isBreakingNews ? "destructive" : "outline"} className="text-[10px] h-4 px-1">
                                    {topic.isBreakingNews ? "🚨 Breaking" : topic.timeliness === "trending_now" ? "🔥 Hot Now" : topic.timeliness === "emerging" ? "📈 Emerging" : "♻️ Evergreen"}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    Score: {topic.relevanceScore}/10
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {generationMode === "deep-search" ? (
                    <TopicSuggestions
                      value={userPrompt}
                      onChange={setUserPrompt}
                      placeholder="Select a topic or type your own..."
                    />
                  ) : (
                    <Textarea
                      id="userPrompt"
                      placeholder="Enter topic or leave empty for AI to pick..."
                      value={userPrompt}
                      onChange={(e) => setUserPrompt(e.target.value)}
                      className="min-h-[100px] bg-background text-sm"
                    />
                  )}
                </div>

                {/* Generate Button */}
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || isPlanningPhase || isExecutingResearch}
                  className="w-full"
                >
                  {(isGenerating || isPlanningPhase) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isPlanningPhase ? "Generating Plan..." : "Generating..."}
                    </>
                  ) : (
                    <>
                      {generationMode === "deep-search" ? <Search className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      {generationMode === "deep-search" ? "Generate Research Plan" : "Generate"}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Research Plan Panel (Deep Search) */}
            {researchPlan && (
              <Card className="border-primary/30 bg-primary/5 backdrop-blur-sm lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="h-5 w-5 text-primary" />
                    Research Plan: {researchPlan.topic}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Goals */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Research Goals</Label>
                    {researchPlan.goals.map((goal, idx) => (
                      <div key={goal.id} className="flex items-start gap-3 p-2 rounded-md bg-background/50 border border-border/50">
                        <CheckCircle2 className={`h-4 w-4 mt-0.5 ${goal.type === "RESEARCH" ? "text-blue-500" : "text-green-500"}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {goal.type}
                            </Badge>
                          </div>
                          <p className="text-sm mt-1">{goal.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Outline */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Suggested Outline</Label>
                    <div className="p-3 rounded-md bg-background/50 border border-border/50">
                      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                        {researchPlan.suggestedOutline.map((section, idx) => (
                          <li key={idx}>{section}</li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  {/* Progress Bar (during research) */}
                  {isExecutingResearch && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Research Progress</span>
                        <span>{jobProgress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${jobProgress}%` }}
                        />
                      </div>
                      {currentJobId && (
                        <p className="text-xs text-muted-foreground">
                          Job ID: {currentJobId.slice(0, 8)}...
                        </p>
                      )}
                      {isJobStuck && (
                        <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs">
                          ⚠️ Job appears stuck (no progress for 2+ min). You can resume or cancel it.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stuck Job Actions */}
                  {isJobStuck && currentJobId && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          addLog("info", "🔄 Resuming stuck job...");
                          setIsJobStuck(false);
                          setLastProgressUpdate(Date.now());
                          try {
                            await api.post('/deep-search-worker', { jobId: currentJobId });
                            toast({ title: "Resume triggered", description: "Worker has been re-triggered" });
                          } catch (e) {
                            addLog("error", `Resume failed: ${e instanceof Error ? e.message : "Unknown"}`);
                          }
                        }}
                        className="flex-1"
                      >
                        🔄 Resume Job
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          addLog("warning", "❌ Cancelling stuck job...");
                          try {
                            // Mark job as failed in DB
                            await api.post('/cancel-deep-search-job', { jobId: currentJobId });
                            setIsExecutingResearch(false);
                            setCurrentJobId(null);
                            setIsJobStuck(false);
                            toast({ title: "Job cancelled", description: "You can start a new search" });
                          } catch (e) {
                            addLog("error", `Cancel failed: ${e instanceof Error ? e.message : "Unknown"}`);
                          }
                        }}
                        className="flex-1"
                      >
                        ❌ Cancel & Retry
                      </Button>
                    </div>
                  )}

                  {/* Approve Button */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleExecuteResearch}
                      disabled={isExecutingResearch}
                      className="flex-1"
                    >
                      {isExecutingResearch ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Researching... {jobProgress}%
                        </>
                      ) : (
                        <>
                          <Zap className="mr-2 h-4 w-4" />
                          Approve & Start Research
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setResearchPlan(null)}
                      disabled={isExecutingResearch}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Live Logs Panel */}
            <Card className={`border-border/50 bg-card/50 backdrop-blur-sm ${researchPlan ? "lg:col-span-3" : "lg:col-span-2"}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Terminal className="h-5 w-5 text-primary" />
                  Live Generation Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-background border border-border rounded-lg p-4 h-[280px] overflow-y-auto font-mono text-xs">
                  {logs.length === 0 ? (
                    <div className="text-muted-foreground flex items-center gap-2">
                      <span className="animate-pulse">●</span>
                      Waiting for generation to start...
                    </div>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className="flex gap-2 mb-1">
                        <span className="text-muted-foreground/60 shrink-0">
                          [{log.timestamp.toLocaleTimeString()}]
                        </span>
                        <span>{getLogIcon(log.type)}</span>
                        <span className={getLogColor(log.type)}>{log.message}</span>
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Generated Blogs Section */}
          <div className="mt-8">
            {generatedBlogs.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  Generated Blogs ({generatedBlogs.length})
                </h2>
                <Button variant="outline" size="sm" onClick={downloadAllBlogs}>
                  <Download className="mr-2 h-4 w-4" />
                  Download All
                </Button>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {generatedBlogs.map((blog, index) => (
                <Card key={index} className="border-border/50 bg-card/50 overflow-hidden group">
                  {blog.image_url && (
                    <div className="relative aspect-video overflow-hidden border-b border-border/50">
                      <img 
                        src={getImgSrc(blog.image_url)} 
                        alt="AI Generated" 
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">AI Image</Badge>
                      </div>
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-tight line-clamp-2">
                        {blog.title}
                      </CardTitle>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {blog.excerpt}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                      {blog.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {blog.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{blog.tags.length - 3}
                        </Badge>
                      )}
                    </div>

                    {/* Meta Info */}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{blog.readTime} min read</span>
                      <span>{blog.content.split(/\s+/).length} words</span>
                      {blog.sources && blog.sources.length > 0 && (
                        <span className="flex items-center gap-1 text-primary">
                          <Globe className="h-3 w-3" />
                          {blog.sources.length} sources
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPreviewDialog(blog)}
                        className="flex-1"
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(blog)}
                        className="flex-1"
                      >
                        <Edit className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => publishBlog(blog)}
                        className="flex-1"
                        disabled={isPublishing}
                      >
                        {isPublishing ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="mr-1 h-3 w-3" />
                        )}
                        {isPublishing ? "Publishing..." : "Publish"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyBlogCode(blog, index)}
                      >
                        {copiedIndex === index ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {!isGenerating && generatedBlogs.length === 0 && (
              <Card className="border-border/50 bg-card/50 border-dashed">
                <CardContent className="p-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    Generated blogs will appear here
                  </p>
                </CardContent>
              </Card>
            )}
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Blog Post</DialogTitle>
          </DialogHeader>
          {editedBlog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={editedBlog.slug}
                    onChange={(e) => setEditedBlog({ ...editedBlog, slug: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Read Time (minutes)</Label>
                  <Input
                    type="number"
                    value={editedBlog.readTime}
                    onChange={(e) => setEditedBlog({ ...editedBlog, readTime: parseInt(e.target.value) || 5 })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editedBlog.title}
                  onChange={(e) => setEditedBlog({ ...editedBlog, title: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Excerpt</Label>
                <Textarea
                  value={editedBlog.excerpt}
                  onChange={(e) => setEditedBlog({ ...editedBlog, excerpt: e.target.value })}
                  className="min-h-[60px]"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Meta Description</Label>
                <Textarea
                  value={editedBlog.metaDescription}
                  onChange={(e) => setEditedBlog({ ...editedBlog, metaDescription: e.target.value })}
                  className="min-h-[60px]"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={editedBlog.tags.join(", ")}
                  onChange={(e) => setEditedBlog({ ...editedBlog, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Image Prompt</Label>
                <Textarea
                  value={editedBlog.imagePrompt}
                  onChange={(e) => setEditedBlog({ ...editedBlog, imagePrompt: e.target.value })}
                  className="min-h-[60px]"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Content (Markdown)</Label>
                <Textarea
                  value={editedBlog.content}
                  onChange={(e) => setEditedBlog({ ...editedBlog, content: e.target.value })}
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEditedBlog}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Blog Preview</DialogTitle>
          </DialogHeader>
          {previewBlog && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">{previewBlog.title}</h2>
                <p className="text-muted-foreground">{previewBlog.excerpt}</p>
                <div className="flex gap-2">
                  {previewBlog.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </div>

              {previewBlog.image_url && (
                <div className="mb-6 rounded-xl overflow-hidden shadow-lg border border-border">
                   <img 
                     src={getImgSrc(previewBlog.image_url)} 
                     alt={previewBlog.title} 
                     className="w-full h-auto object-cover"
                   />
                </div>
              )}

              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap bg-muted/50 p-4 rounded-lg text-sm">
                  {previewBlog.content}
                </pre>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <strong>Image Prompt:</strong> {previewBlog.imagePrompt}
              </div>
              
              {/* Sources Section */}
              {previewBlog.sources && previewBlog.sources.length > 0 && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
                    <Globe className="h-4 w-4 text-primary" />
                    Grounding Sources ({previewBlog.sources.length})
                  </h3>
                  <ul className="space-y-2">
                    {previewBlog.sources.map((source, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <ExternalLink className="h-3 w-3 mt-1 text-muted-foreground shrink-0" />
                        <a
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline line-clamp-1"
                        >
                          {source.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              if (previewBlog) {
                publishBlog(previewBlog);
                setIsPreviewDialogOpen(false);
              }
            }}>
              <Send className="mr-2 h-4 w-4" />
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
