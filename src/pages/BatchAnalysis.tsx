import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { api } from "@/lib/api_adapter";
import { Loader2, Play, CheckCircle2, AlertCircle, Database, Brain, FileText } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

const BatchAnalysis = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Config State
    const [limit, setLimit] = useState<number>(50);
    const [assetType, setAssetType] = useState<'stock' | 'etf'>('stock');
    const [provider, setProvider] = useState<'google_batch' | 'kie_direct'>('kie_direct');

    // Process State
    const [activeTab, setActiveTab] = useState<'start' | 'process'>('start');
    const [processBatchId, setProcessBatchId] = useState('');
    const [processResult, setProcessResult] = useState<any>(null);
    const [recentJobs, setRecentJobs] = useState<any[]>([]);

    const { isAdmin } = useUserRole();

    // Fetch recent jobs when switching to process tab
    const fetchRecentJobs = async () => {
        try {
            const response = await api.get('/batch-jobs');
            if (Array.isArray(response)) {
                setRecentJobs(response);
            } else {
                setRecentJobs([]);
            }
        } catch (err) {
            console.error("Failed to fetch recent jobs", err);
            setRecentJobs([]);
        }
    };

    // Use effect to fetch when tab changes
    useEffect(() => {
        if (activeTab === 'process') {
            fetchRecentJobs();
            // Poll every 10 seconds while on this tab
            const interval = setInterval(fetchRecentJobs, 10000);
            return () => clearInterval(interval);
        }
    }, [activeTab]);

    const startBatchJob = async () => {
        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await api.post('/batch-job', {
                limit: limit,
                asset_type: assetType,
                provider: provider
            });
            setResult(response);
        } catch (err: any) {
            setError(err.message || "Failed to start batch job");
        } finally {
            setIsLoading(false);
        }
    };

    const processBatchResults = async () => {
        if (!processBatchId) return;
        setIsLoading(true);
        setError(null);
        setProcessResult(null);
        try {
            const response = await api.post('/batch-job/process', {
                batch_id: processBatchId
            });
            setProcessResult(response);
        } catch (err: any) {
            setError(err.message || "Failed to process batch results");
        } finally {
            setIsLoading(false);
        }
    };

    const emergencySubmitToVertexAI = async (batchId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.post('/batch-job/submit-google-batch', {
                batch_id: batchId
            });
            setProcessResult({
                message: "Emergency Override Successful: " + response.message,
                batch_id: response.batch_id
            });
            fetchRecentJobs();
        } catch (err: any) {
            setError(err.message || "Failed to manually submit to Vertex AI");
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />

            <main className="flex-1 container max-w-4xl mx-auto px-4 py-12">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold font-display">Batch Analysis Job</h1>
                    <p className="text-muted-foreground mt-2">
                        Trigger large-scale AI analysis or process completed batch results.
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6">
                    <Button
                        variant={activeTab === 'start' ? 'default' : 'secondary'}
                        onClick={() => setActiveTab('start')}
                        className="gap-2"
                    >
                        <Play className="w-4 h-4" /> Start New Job
                    </Button>
                    <Button
                        variant={activeTab === 'process' ? 'default' : 'secondary'}
                        onClick={() => setActiveTab('process')}
                        className="gap-2"
                    >
                        <Database className="w-4 h-4" /> Process Results
                    </Button>
                </div>

                <div className="grid gap-6">
                    {/* START JOB TAB */}
                    {activeTab === 'start' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Job Configuration</CardTitle>
                                <CardDescription>
                                    Initiate the batch processing workflow.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-2">
                                        <h3 className="font-semibold flex items-center gap-2">
                                            <Brain className="w-4 h-4 text-purple-500" /> Workflow Steps:
                                        </h3>
                                        <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-1">
                                            <li>Fetch <strong>all active {assetType === 'stock' ? 'stocks' : 'ETFs'}</strong> from FMP</li>
                                            <li>Use <strong>{provider === 'kie_direct' ? 'Kie.ai' : 'Gemini 3 Flash'}</strong> to select the <strong>Top {limit}</strong> candidates</li>
                                            <li>Fetch detailed financial data for selected assets</li>
                                            <li>Submit <strong>{provider === 'kie_direct' ? 'Kie.ai Parallel Batch' : 'Gemini Batch Job'}</strong> with <strong>Google Search</strong> enabled</li>
                                        </ol>
                                    </div>

                                    <div className="grid gap-6 md:grid-cols-2">
                                        <div className="space-y-3">
                                            <label className="text-sm font-medium">Batch Provider</label>
                                            <div className="flex gap-2 p-1 bg-muted rounded-lg w-full">
                                                <button
                                                    onClick={() => setProvider('google_batch')}
                                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${provider === 'google_batch'
                                                        ? 'bg-background shadow text-foreground'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                        }`}
                                                >
                                                    Google Batch
                                                </button>
                                                <button
                                                    onClick={() => setProvider('kie_direct')}
                                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${provider === 'kie_direct'
                                                        ? 'bg-background shadow text-foreground border-primary/50 border'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                        }`}
                                                >
                                                    Kie.ai Direct
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-sm font-medium">Asset Type</label>
                                            <div className="flex gap-2 p-1 bg-muted rounded-lg w-full">
                                                <button
                                                    onClick={() => setAssetType('stock')}
                                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${assetType === 'stock'
                                                        ? 'bg-background shadow text-foreground'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                        }`}
                                                >
                                                    Stocks
                                                </button>
                                                <button
                                                    onClick={() => setAssetType('etf')}
                                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${assetType === 'etf'
                                                        ? 'bg-background shadow text-foreground'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                        }`}
                                                >
                                                    ETFs
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-sm font-medium">Selection Limit</label>
                                            <div className="flex bg-background border rounded-md">
                                                <input
                                                    type="number"
                                                    min="10"
                                                    max="2000"
                                                    value={limit}
                                                    onChange={(e) => setLimit(Number(e.target.value))}
                                                    className="flex-1 px-3 py-2 bg-transparent outline-none text-sm"
                                                />
                                                <div className="px-3 py-2 text-xs text-muted-foreground border-l flex items-center bg-muted/30">
                                                    max 2000
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={startBatchJob}
                                        disabled={isLoading}
                                        size="lg"
                                        className="w-full"
                                    >
                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                                        {isLoading ? "Starting Job..." : `Start ${assetType === 'stock' ? 'Stock' : 'ETF'} Batch Analysis`}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* PROCESS RESULTS TAB */}
                    {activeTab === 'process' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Retrieve Batch Results</CardTitle>
                                <CardDescription>
                                    Enter a completed Batch ID to download results and save them to the database.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <label className="text-sm font-medium">Batch Job ID</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={processBatchId}
                                                onChange={(e) => setProcessBatchId(e.target.value)}
                                                placeholder="e.g., batch-12345678-abcd-..."
                                                className="flex-1 bg-background border border-input rounded-lg px-4 py-3 text-sm focus:border-primary outline-none"
                                            />
                                            <Button
                                                onClick={processBatchResults}
                                                disabled={isLoading || !processBatchId}
                                                className="shrink-0"
                                            >
                                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                                                {isLoading ? "Processing..." : "Retrieve"}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Recent Jobs List */}
                                    <div className="mt-8">
                                        <h3 className="text-sm font-medium mb-3">Recent Batch Jobs</h3>
                                        <div className="rounded-md border">
                                            <div className="relative w-full overflow-auto">
                                                <table className="w-full caption-bottom text-sm text-left">
                                                    <thead className="[&_tr]:border-b">
                                                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                                            <th className="h-10 px-4 align-middle font-medium text-muted-foreground w-[100px]">Status</th>
                                                            <th className="h-10 px-4 align-middle font-medium text-muted-foreground">Batch ID</th>
                                                            <th className="h-10 px-4 align-middle font-medium text-muted-foreground">Type</th>
                                                            <th className="h-10 px-4 align-middle font-medium text-muted-foreground">Date</th>
                                                            <th className="h-10 px-4 align-middle font-medium text-muted-foreground text-right">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="[&_tr:last-child]:border-0">
                                                        {(recentJobs || []).length === 0 ? (
                                                            <tr className="border-b transition-colors hover:bg-muted/50">
                                                                <td colSpan={5} className="p-4 align-middle text-center text-muted-foreground">
                                                                    No recent jobs found. Start one!
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            (recentJobs || []).map((job: any) => (
                                                                <tr key={job.batch_id} className="border-b transition-colors hover:bg-muted/50">
                                                                    <td className="p-4 align-middle">
                                                                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${(job.status === 'COMPLETED' || job.status === 'processed' || job.status === 'JOB_STATE_SUCCEEDED') ? 'bg-green-400/10 text-green-400 ring-green-400/20' :
                                                                            job.status === 'FAILED' || job.status === 'JOB_STATE_FAILED' || job.status === 'error' ? 'bg-red-400/10 text-red-400 ring-red-400/20' :
                                                                                'bg-yellow-400/10 text-yellow-400 ring-yellow-400/20'
                                                                            }`}>
                                                                            {job.status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-4 align-middle font-mono text-xs">{job.batch_id}</td>
                                                                    <td className="p-4 align-middle capitalize">{job.asset_type} ({job.item_count})</td>
                                                                    <td className="p-4 align-middle text-muted-foreground">
                                                                        {new Date(job.created_at).toLocaleDateString()}
                                                                    </td>
                                                                    <td className="p-4 align-middle text-right">
                                                                        <div className="flex justify-end gap-2">
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => {
                                                                                    setProcessBatchId(job.batch_id);
                                                                                    // Small delay to allow state update before processing
                                                                                    setTimeout(processBatchResults, 100);
                                                                                }}
                                                                                disabled={isLoading}
                                                                            >
                                                                                {isLoading && processBatchId === job.batch_id ? (
                                                                                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                                                                ) : (
                                                                                    <FileText className="w-3 h-3 mr-1" />
                                                                                )}
                                                                                Check Status
                                                                            </Button>

                                                                            {isAdmin && (
                                                                                <Button
                                                                                    variant="secondary"
                                                                                    size="sm"
                                                                                    onClick={() => emergencySubmitToVertexAI(job.batch_id)}
                                                                                    disabled={isLoading}
                                                                                    title="Emergency submit staged prompts to Vertex AI (Use if Lambda failed to trigger job)"
                                                                                >
                                                                                    <Database className="w-3 h-3 mr-1" />
                                                                                    Force Vertex Submit
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>

                                    {processResult && (
                                        <div className="mt-4 p-4 rounded-lg bg-muted border font-mono text-xs overflow-auto max-h-60">
                                            <pre>{JSON.stringify(processResult, null, 2)}</pre>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Global Error/Success Feedback */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {result && activeTab === 'start' && (
                        <Alert className="border-green-500/50 bg-green-500/10">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <AlertTitle className="text-green-500">Success</AlertTitle>
                            <AlertDescription className="mt-2">
                                <p className="font-medium">{result.message}</p>
                                {result.batch_job && (
                                    <div className="mt-2 p-2 bg-background/50 rounded font-mono text-xs">
                                        Batch ID: <span className="select-all font-bold text-primary">{result.batch_job.batch_id}</span>
                                        <p className="text-muted-foreground mt-1 text-[10px]">Copy this ID to process results later.</p>
                                    </div>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default BatchAnalysis;
