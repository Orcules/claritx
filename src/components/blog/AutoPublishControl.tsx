import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, Calendar, Power, Play, Zap, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/apiAdapter";

type LogType = "info" | "success" | "error" | "warning" | "ai";

interface AutoPublishControlProps {
  onLog?: (type: LogType, message: string) => void;
}

interface AutoPublishSettings {
  enabled: boolean;
  hourET: number; // Eastern Time hour (0-23)
  blogsPerDay: number;
}

interface LastRun {
  timestamp: string;
  success: boolean;
  blogTitle?: string;
  error?: string;
}

// Default: 7 AM ET (optimal for US morning readers before market open)
// 7 AM ET = 12:00 UTC
const DEFAULT_HOUR_ET = 7;

// Convert ET hour to UTC hour (ET is UTC-5 standard, UTC-4 daylight)
const etToUtc = (etHour: number): number => ((etHour + 5) % 24);
const utcToEt = (utcHour: number): number => ((utcHour - 5 + 24) % 24);

export function AutoPublishControl({ onLog }: AutoPublishControlProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AutoPublishSettings>({
    enabled: true,
    hourET: DEFAULT_HOUR_ET,
    blogsPerDay: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunningNow, setIsRunningNow] = useState(false);
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  
  const addLog = (type: LogType, message: string) => {
    onLog?.(type, message);
  };

  // Load current cron status and last run
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const logsData = await api.get('/activity-logs?category=blog&limit=1');
      const logs = logsData?.logs || logsData || [];

      if (logs && logs.length > 0) {
        const log = logs[0];
        const details = log.details as Record<string, unknown> | null;
        setLastRun({
          timestamp: log.created_at,
          success: log.type === "auto_publish",
          blogTitle: details?.blogSlug as string | undefined,
          error: log.type === "auto_publish_error" ? log.message : undefined,
        });
      }

      // Current cron is at 12 UTC = 7 AM ET
      setSettings({
        enabled: true,
        hourET: utcToEt(12),
        blogsPerDay: 1,
      });
    } catch (error) {
      console.error("Failed to load auto-publish status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const utcHour = etToUtc(settings.hourET);
      
      toast({
        title: settings.enabled ? "Auto-Publish Enabled" : "Auto-Publish Disabled",
        description: settings.enabled 
          ? `Will publish ${settings.blogsPerDay} blog(s) daily at ${settings.hourET}:00 AM ET (${utcHour}:00 UTC)`
          : "Automatic blog publishing has been disabled",
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({
        title: "Settings Saved Locally",
        description: "Schedule changes require database access to apply",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunNow = async () => {
    setIsRunningNow(true);
    addLog("info", "🤖 AUTO-PUBLISH DAILY BLOG - Deep Search Mode (Async)");
    addLog("info", "=".repeat(50));
    addLog("ai", "📡 Step 1: Discovering hot topics from financial news...");
    addLog("info", "Scanning: Bloomberg, Reuters, CNBC, Yahoo Finance, MarketWatch, WSJ...");
    
    try {
      toast({
        title: "Starting Deep Search Auto-Publish...",
        description: "This uses the full research pipeline (may take 5-10 minutes)",
      });

      const data = await api.post('/auto-publish-daily-blog', {});
      if (!data?.success) throw new Error(data?.error || "Auto-publish failed");

      const jobId = data.jobId;
      
      // Log topic info
      if (data.topic) {
        const timelinessIcon = data.topic.timeliness === "trending_now" ? "🔥" : data.topic.timeliness === "emerging" ? "📈" : "♻️";
        addLog("success", `${timelinessIcon} Topic selected: "${data.topic.title}" (score: ${data.topic.relevanceScore}/10)`);
      }
      
      addLog("ai", "📋 Step 2: Generating research plan...");
      addLog("success", "✅ Plan generated - background research started");
      addLog("ai", `🔬 Step 3: Background job queued: ${jobId}`);
      addLog("info", "⏳ Polling for progress (worker will auto-publish when complete)...");

      // Poll job status until completion
      const maxPollTime = 10 * 60 * 1000; // 10 minutes
      const pollInterval = 5000; // 5 seconds
      const startTime = Date.now();
      let lastProgress = 0;

      while (Date.now() - startTime < maxPollTime) {
        await new Promise(r => setTimeout(r, pollInterval));
        
        const jobData = await api.post('/deep-search-job-status', { jobId }).catch(() => null);

        if (!jobData) {
          addLog("warning", `⚠️ Failed to fetch job status`);
          continue;
        }

        // Log new progress
        if (jobData.progress_pct > lastProgress) {
          const logs = jobData.progress_logs || [];
          // Show only new logs
          for (let i = Math.floor(lastProgress / 10); i < logs.length && i < Math.floor(jobData.progress_pct / 10) + 1; i++) {
            if (logs[i]) addLog("info", logs[i]);
          }
          lastProgress = jobData.progress_pct;
          addLog("info", `   Progress: ${jobData.progress_pct}%`);
        }

        if (jobData.status === "completed") {
          const result = jobData.result as Record<string, unknown> | null;
          const blog = result?.blog as Record<string, unknown> | null;
          const published = result?.published as boolean | undefined;
          
          if (published && blog) {
            addLog("success", "🎨 Images generated and uploaded");
            addLog("success", "🚀 Published to database!");
            addLog("info", "=".repeat(50));
            addLog("success", `✅ AUTO-PUBLISH COMPLETE! Blog: "${blog.title}"`);
            
            setLastRun({
              timestamp: new Date().toISOString(),
              success: true,
              blogTitle: blog.slug as string,
            });

            toast({
              title: "Blog Published! 🎉",
              description: `"${blog.title}" published with Deep Search + images`,
            });
          } else {
            // Job completed but publish failed or was manual mode
            const publishError = result?.publishError as string | undefined;
            addLog("warning", `⚠️ Job completed but publish ${publishError ? `failed: ${publishError}` : "was skipped"}`);
          }
          break;
        }

        if (jobData.status === "failed") {
          throw new Error(jobData.error_message || "Job failed");
        }
      }

      if (Date.now() - startTime >= maxPollTime) {
        addLog("warning", "⏰ Polling timeout - job may still be running in background");
        toast({
          title: "Polling Timeout",
          description: "The job may still be completing in the background. Check back later.",
        });
      }

    } catch (error) {
      console.error("Manual auto-publish failed:", error);
      addLog("error", `❌ Auto-publish failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      
      setLastRun({
        timestamp: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      toast({
        title: "Auto-Publish Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRunningNow(false);
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/New_York",
    });
  };

  // Generate time options with AM/PM format
  const getTimeLabel = (hour: number): string => {
    if (hour === 0) return "12:00 AM";
    if (hour === 12) return "12:00 PM";
    if (hour < 12) return `${hour}:00 AM`;
    return `${hour - 12}:00 PM`;
  };

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-primary" />
            Auto-Publish System
          </CardTitle>
          <Badge variant={settings.enabled ? "default" : "secondary"}>
            {settings.enabled ? "Active" : "Disabled"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <Power className={`h-5 w-5 ${settings.enabled ? "text-primary" : "text-muted-foreground"}`} />
            <div>
              <Label htmlFor="auto-enabled" className="font-medium">
                Daily Auto-Publish
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically discover and publish trending topics
              </p>
            </div>
          </div>
          <Switch
            id="auto-enabled"
            checked={settings.enabled}
            onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
          />
        </div>

        {settings.enabled && (
          <>
            {/* Schedule Settings */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Time Selection - US Eastern Time */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Publish Time (US Eastern)
                </Label>
                <Select
                  value={settings.hourET.toString()}
                  onValueChange={(v) => setSettings({ ...settings, hourET: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Prioritize morning hours (5 AM - 10 AM ET) for finance blogs */}
                    {[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4].map((hour) => (
                      <SelectItem key={hour} value={hour.toString()}>
                        {getTimeLabel(hour)} ET
                        {hour === 7 && (
                          <span className="ml-2 text-xs text-primary">(Recommended)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  7 AM ET is optimal for US morning readers
                </p>
              </div>

              {/* Blogs per Day */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Blogs per Day
                </Label>
                <Select
                  value={settings.blogsPerDay.toString()}
                  onValueChange={(v) => setSettings({ ...settings, blogsPerDay: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 blog/day</SelectItem>
                    <SelectItem value="2">2 blogs/day</SelectItem>
                    <SelectItem value="3">3 blogs/day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveSettings}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Save Schedule
              </Button>
              <Button
                size="sm"
                onClick={handleRunNow}
                disabled={isRunningNow}
              >
                {isRunningNow ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Run Now
              </Button>
            </div>
          </>
        )}

        {/* Last Run Status */}
        {lastRun && (
          <div className={`rounded-lg border p-3 ${lastRun.success ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {lastRun.success ? "✅ Last publish successful" : "❌ Last publish failed"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatTime(lastRun.timestamp)} ET
                  {lastRun.blogTitle && ` • ${lastRun.blogTitle}`}
                </p>
                {lastRun.error && (
                  <p className="mt-1 text-xs text-destructive">{lastRun.error}</p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={loadStatus}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
