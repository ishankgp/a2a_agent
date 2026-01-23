import { useState, useEffect, useRef } from "react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "./components/ui/card";
import ArchitectureFlow from "./components/ArchitectureFlow";
import A2AMessageLog from "./components/A2AMessageLog";
import ApprovalModal from "./components/ApprovalModal";
import { saveSession, getSessions, getSessionById, findMatchingSession, deleteSession } from "./lib/SessionManager";
import { History, Layout, Cpu, Trash2, Radio } from "lucide-react";

// API Configuration - use localhost to match frontend origin
// API Configuration - Unified Backend
const API_URLS = {
  triage: "http://localhost:8000/triage",
  research: "http://localhost:8000/research",
  review: "http://localhost:8000/review",
  presentation: "http://localhost:8000/presentation"
};

export default function App() {
  // A2A Demo App - Force Refresh
  const [prompt, setPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [pipelineState, setPipelineState] = useState({
    triage: "Queued",
    research: "Queued",
    review: "Queued",
    presentation: "Queued"
  });
  const [logs, setLogs] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [taskId, setTaskId] = useState(null);
  const [contextId, setContextId] = useState(null);

  // Debug Helper
  const [debugMode, setDebugMode] = useState(false);
  const [rawLogs, setRawLogs] = useState([]);
  const [selectedArtifact, setSelectedArtifact] = useState(null);

  // New: Tab and Session state
  const [activeTab, setActiveTab] = useState("workspace"); // 'workspace' | 'architecture'
  const [sessions, setSessions] = useState([]);
  const [isReplaying, setIsReplaying] = useState(false);

  // Load sessions on mount
  useEffect(() => {
    setSessions(getSessions());
  }, []);

  // Track pipeline completion for session saving
  const pipelineResultRef = useRef(null);

  // A2A Protocol Log state
  const [a2aMessages, setA2aMessages] = useState([]);

  // Human-in-the-Loop Approval state
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [approvalContent, setApprovalContent] = useState("");
  const approvalResolveRef = useRef(null);

  // Helper to log A2A messages
  const logA2AMessage = (type, agent, data, preview) => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    setA2aMessages(prev => [{ type, agent, data, preview, timestamp }, ...prev]);
  };

  const addDebugLog = (msg) => {
    console.log(`[DEBUG] ${msg}`);
    const time = new Date().toLocaleTimeString();
    setRawLogs(prev => [`[${time}] ${msg}`, ...prev]);
  };

  // Safe UUID generator
  const generateUUID = () => {
    // Simple fallback implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const addLog = (title, description) => {
    setLogs((prev) => [
      {
        time: new Date().toLocaleTimeString([], { hour12: false }),
        title,
        description
      },
      ...prev
    ]);
  };

  // Replay a saved session
  const replaySession = async (sessionId) => {
    const session = getSessionById(sessionId);
    if (!session) return;

    setIsReplaying(true);
    setPrompt(session.prompt);
    setLogs([]);
    setArtifacts([]);
    setPipelineState({ triage: "Queued", research: "Queued", review: "Queued", presentation: "Queued" });
    setActiveTab("workspace");

    // Animate through the saved states
    const stages = ["triage", "research", "review", "presentation"];
    for (const stage of stages) {
      if (session.pipelineState[stage] === "Skipped") {
        setPipelineState(prev => ({ ...prev, [stage]: "Skipped" }));
      } else {
        setPipelineState(prev => ({ ...prev, [stage]: "Working" }));
        await new Promise(r => setTimeout(r, 800));
        setPipelineState(prev => ({ ...prev, [stage]: "Completed" }));
      }
    }

    // Restore logs and artifacts
    setLogs(session.logs || []);
    setArtifacts(session.artifacts || []);
    setIsReplaying(false);
    addLog("Session Replayed", `Restored from: ${new Date(session.timestamp).toLocaleString()}`);
  };

  const updateStageStatus = (stage, status) => {
    setPipelineState((prev) => ({ ...prev, [stage]: status }));
  };

  const subscribeToStream = (serviceUrl, taskId, stageName) => {
    return new Promise((resolve) => {
      const eventSource = new EventSource(`${serviceUrl}/message/stream?task_id=${taskId}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === "task-status") {
          // Mapping backend state to UI status
          let status = "Working";
          if (data.state === "completed") status = "Completed";
          if (data.state === "failed") status = "Failed";

          updateStageStatus(stageName, status);
          if (data.detail) addLog(`${stageName}: ${status}`, data.detail);

          // Log streaming event to A2A log
          logA2AMessage("stream", stageName, data, `state: ${data.state}${data.detail ? `, detail: ${data.detail.slice(0, 50)}...` : ""}`);

          if (data.state === "completed" || data.state === "failed") {
            eventSource.close();
            resolve(data.state);
          }
        } else if (data.event === "task-artifact") {
          // Handle artifacts
          if (data.artifact.gammaUrl) {
            setArtifacts((prev) => [...prev, { title: "Gamma Deck", detail: "Presentation Generated", url: data.artifact.gammaUrl }]);
          } else if (data.artifact.summary) {
            setArtifacts((prev) => [...prev, { title: "Research Summary", detail: "Summary generated", data: data.artifact }]);
          } else if (data.artifact.slideOutline) {
            setArtifacts((prev) => [...prev, { title: "Slide Outline", detail: "Fallback generation", data: data.artifact }]);
          } else if (data.artifact.revisedSummary) {
            setArtifacts((prev) => [...prev, { title: "Review Feedback", detail: "Content reviewed", data: data.artifact }]);
          } else if (data.artifact.progress) {
            addLog(`${stageName} Progress`, data.artifact.progress);
          }
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        resolve("failed");
      };
    });
  };

  const runPipeline = async () => {
    if (!prompt) return;

    setIsRunning(true);
    setLogs([]);
    setArtifacts([]);
    setPipelineState({
      triage: "Queued",
      research: "Queued",
      review: "Queued",
      presentation: "Queued"
    });

    // Helper to fetch artifacts from an agent
    const fetchArtifacts = async (serviceUrl, taskId, stageName) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      try {
        addDebugLog(`[FetchArtifacts] Starting for ${stageName} (Task: ${taskId})`);

        const res = await fetch(`${serviceUrl}/tasks/resubscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task_id: taskId }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        addDebugLog(`[FetchArtifacts] Response status: ${res.status}`);

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const data = await res.json();
        addDebugLog(`[FetchArtifacts] Data received: ${JSON.stringify(data.artifacts?.length || 0)} artifacts`);

        if (data.artifacts?.length) {
          data.artifacts.forEach(artifact => {
            addDebugLog(`[FetchArtifacts] Artifact keys: ${Object.keys(artifact).join(', ')}`);

            if (artifact.gammaUrl) {
              setArtifacts(prev => [...prev, { title: "Gamma Deck", detail: "Presentation Generated", url: artifact.gammaUrl, data: artifact }]);
            } else if (artifact.summary) {
              setArtifacts(prev => [...prev, { title: "Research Summary", detail: `From ${stageName}`, data: artifact }]);
            } else if (artifact.revisedSummary) {
              setArtifacts(prev => [...prev, { title: "Review Feedback", detail: "Content reviewed", data: artifact }]);
            } else if (artifact.slideOutline) {
              setArtifacts(prev => [...prev, { title: "Slide Outline", detail: "Fallback generation", data: artifact }]);
            } else if (artifact.route) {
              addLog(`Triage Decision`, `Routed to: ${artifact.route}`);
            } else if (artifact.error) {
              addLog(`${stageName} Error`, artifact.error);
            } else {
              // Catch-all for any unrecognized artifacts
              setArtifacts(prev => [...prev, { title: `${stageName} Output`, detail: "Unknown format", data: artifact }]);
            }
          });
        }
        return data;
      } catch (e) {
        clearTimeout(timeoutId);
        console.error(`Failed to fetch artifacts for ${stageName}:`, e);
        addDebugLog(`[FetchArtifacts] FAILED for ${stageName}: ${e.message}`);
        // Return null but don't crash pipeline
        return { artifacts: [] };
      }
    };

    try {
      // 1. Triage
      updateStageStatus("triage", "Working");
      addLog("Triage Started", "Analyzing user request...");

      let triageData;
      try {
        // GENERATE ID CLIENT SIDE
        const triageTaskId = crypto.randomUUID();

        // Start streaming concurrently
        const streamPromise = subscribeToStream(API_URLS.triage, triageTaskId, "triage");

        // Log A2A request
        const triageRequestBody = {
          task_id: triageTaskId,
          message: { role: "user", content: prompt }
        };
        logA2AMessage("request", "triage", triageRequestBody, `task_id: ${triageTaskId.slice(0, 8)}..., content: "${prompt.slice(0, 40)}..."`);

        const triageRes = await fetch(`${API_URLS.triage}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(triageRequestBody)
        });

        if (!triageRes.ok) throw new Error(`Triage service error: ${triageRes.status}`);
        triageData = await triageRes.json();

        // Log A2A response
        logA2AMessage("response", "triage", triageData, `context_id: ${triageData.context_id?.slice(0, 8)}...`);

        // Wait for stream to finish (optional, but good for UI sync)
        await streamPromise;

      } catch (e) {
        updateStageStatus("triage", "Failed");
        addLog("Triage Failed", e.message);
        throw e;
      }

      setTaskId(triageData.task_id);
      setContextId(triageData.context_id);

      // Fetch actual route from triage artifacts
      const triageArtifacts = await fetchArtifacts(API_URLS.triage, triageData.task_id, "triage");
      updateStageStatus("triage", "Completed");
      const route = triageArtifacts?.artifacts?.[0]?.route ?? "medical_research";
      addLog("Routing Complete", `Selected route: ${route}`);

      if (route === "medical_research") {
        // 2. Research
        addDebugLog("Starting Research Stage");
        updateStageStatus("research", "Working");
        let researchData;
        try {
          const researchTaskId = generateUUID();
          addDebugLog(`Generated Research TaskID: ${researchTaskId}`);

          const streamPromise = subscribeToStream(API_URLS.research, researchTaskId, "research");
          addDebugLog("Subscribed to Research Stream");

          addDebugLog("Sending Research Request...");
          const researchRequestBody = {
            task_id: researchTaskId,
            context_id: triageData.context_id,
            message: { role: "user", content: prompt }
          };
          logA2AMessage("request", "research", researchRequestBody, `task_id: ${researchTaskId.slice(0, 8)}..., prompt: "${prompt.slice(0, 30)}..."`);

          const researchRes = await fetch(`${API_URLS.research}/message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(researchRequestBody)
          });

          addDebugLog(`Research Request Status: ${researchRes.status}`);
          if (!researchRes.ok) throw new Error(`Research service error: ${researchRes.status}`);
          researchData = await researchRes.json();
          logA2AMessage("response", "research", researchData, `context_id: ${researchData.context_id?.slice(0, 8)}...`);
          addDebugLog("Research Response Parsed");

          await streamPromise;
          addDebugLog("Research Stream Completed");
          await fetchArtifacts(API_URLS.research, researchData.task_id, "research");
          updateStageStatus("research", "Completed");
        } catch (e) {
          updateStageStatus("research", "Failed");
          addLog("Research Failed", e.message);
          addDebugLog(`Research Exception: ${e.message}`);
          throw e;
        }

        // 3. Review
        updateStageStatus("review", "Working");
        let reviewData;
        try {
          const reviewTaskId = crypto.randomUUID();

          const streamPromise = subscribeToStream(API_URLS.review, reviewTaskId, "review");

          const reviewRequestBody = {
            task_id: reviewTaskId,
            context_id: triageData.context_id,
            message: { role: "user", content: researchData.message.content }
          };
          logA2AMessage("request", "review", reviewRequestBody, `task_id: ${reviewTaskId.slice(0, 8)}..., research: "${researchData.message.content.slice(0, 30)}..."`);

          const reviewRes = await fetch(`${API_URLS.review}/message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reviewRequestBody)
          });

          if (!reviewRes.ok) throw new Error(`Review service error: ${reviewRes.status}`);
          reviewData = await reviewRes.json();
          logA2AMessage("response", "review", reviewData, `context_id: ${reviewData.context_id?.slice(0, 8)}...`);

          await streamPromise;
          await fetchArtifacts(API_URLS.review, reviewData.task_id, "review");
          updateStageStatus("review", "Completed");


          // --- HUMAN IN THE LOOP CHECKPOINT ---
          // Pause execution and wait for user approval
          updateStageStatus("presentation", "Awaiting Input"); // Visual indicator
          addLog("Human-in-the-Loop", "Waiting for user approval...");

          setApprovalContent(reviewData.message.content);
          setAwaitingApproval(true);

          // Wait for user decision promise
          const approvedContent = await new Promise((resolve, reject) => {
            approvalResolveRef.current = { resolve, reject };
          });

          setAwaitingApproval(false); // Hide modal
          addLog("Approval Granted", "User approved content for presentation.");

          // Use approved/edited content for presentation
          reviewData.message.content = approvedContent;

        } catch (e) {
          updateStageStatus("review", "Failed");
          addLog("Review Failed", e.message);
          throw e;
        }

        // 4. Presentation
        updateStageStatus("presentation", "Working");
        try {
          const presentTaskId = crypto.randomUUID();

          const streamPromise = subscribeToStream(API_URLS.presentation, presentTaskId, "presentation");

          const presentRequestBody = {
            task_id: presentTaskId,
            context_id: triageData.context_id,
            message: { role: "user", content: reviewData.message.content }
          };
          logA2AMessage("request", "presentation", presentRequestBody, `task_id: ${presentTaskId.slice(0, 8)}..., content: "${reviewData.message.content.slice(0, 30)}..."`);

          const presentRes = await fetch(`${API_URLS.presentation}/message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(presentRequestBody)
          });

          if (!presentRes.ok) throw new Error(`Presentation service error: ${presentRes.status}`);
          const presentData = await presentRes.json();
          logA2AMessage("response", "presentation", presentData, `context_id: ${presentData.context_id?.slice(0, 8)}...`);

          await streamPromise;
          await fetchArtifacts(API_URLS.presentation, presentData.task_id, "presentation");
          updateStageStatus("presentation", "Completed");

          // Mark pipeline as successful for session saving
          addLog("Pipeline Complete", "All stages completed successfully");
          pipelineResultRef.current = {
            logs: logs,
            artifacts: artifacts,
            pipelineState: { triage: "Completed", research: "Completed", review: "Completed", presentation: "Completed" }
          };
        } catch (e) {
          updateStageStatus("presentation", "Failed");
          addLog("Presentation Failed", e.message);
          throw e;
        }

      } else {
        // Direct to Presentation
        updateStageStatus("research", "Skipped");
        updateStageStatus("review", "Skipped");
        updateStageStatus("presentation", "Working");
        try {
          const presentTaskId = crypto.randomUUID();

          const streamPromise = subscribeToStream(API_URLS.presentation, presentTaskId, "presentation");

          const presentRes = await fetch(`${API_URLS.presentation}/message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              task_id: presentTaskId,
              context_id: triageData.context_id,
              message: { role: "user", content: prompt }
            })
          });

          if (!presentRes.ok) throw new Error(`Presentation service error: ${presentRes.status}`);
          const presentData = await presentRes.json();

          await streamPromise;
          await fetchArtifacts(API_URLS.presentation, presentData.task_id, "presentation");
          updateStageStatus("presentation", "Completed");

          // Mark pipeline as successful for session saving
          addLog("Pipeline Complete", "Direct presentation completed");
          pipelineResultRef.current = {
            logs: logs,
            artifacts: artifacts,
            pipelineState: { triage: "Completed", research: "Skipped", review: "Skipped", presentation: "Completed" }
          };
        } catch (e) {
          updateStageStatus("presentation", "Failed");
          addLog("Presentation Failed", e.message);
          throw e;
        }
      }

    } catch (e) {
      console.error(e);
      addLog("Pipeline Error", `Stopped due to: ${e.message}`);
      pipelineResultRef.current = null; // Mark as failed
    } finally {
      setIsRunning(false);

      // Save successful run only if we have valid result
      if (pipelineResultRef.current) {
        const result = pipelineResultRef.current;
        saveSession(prompt, result);
        setSessions(getSessions());
        addLog("Session Saved", "Run saved to history for replay");
      }
      pipelineResultRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.3em] text-text-muted">
              A2A Healthcare Demo
            </p>
            <h1 className="text-2xl font-semibold text-text-primary">
              Agent-to-Agent Research Workspace
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => window.location.reload()}
              variant="outline"
            >
              Reset
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="mx-auto max-w-6xl px-6 pt-4">
        <div className="flex items-center gap-4 border-b border-border pb-2">
          <button
            onClick={() => setActiveTab("workspace")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === "workspace" ? "bg-surface text-white border-b-2 border-blue-500" : "text-gray-400 hover:text-white"
              }`}
          >
            <Layout size={16} />
            Workspace
          </button>
          <button
            onClick={() => setActiveTab("architecture")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === "architecture" ? "bg-surface text-white border-b-2 border-purple-500" : "text-gray-400 hover:text-white"
              }`}
          >
            <Cpu size={16} />
            Architecture
          </button>

          {/* Session History Dropdown */}
          {sessions.length > 0 && (
            <div className="ml-auto relative group">
              <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white">
                <History size={16} />
                History ({sessions.length})
              </button>
              <div className="absolute right-0 top-full mt-1 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
                  >
                    <button
                      onClick={() => replaySession(s.id)}
                      className="flex-1 text-left text-sm text-gray-300 truncate"
                    >
                      {s.prompt.slice(0, 35)}...
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(s.id);
                        setSessions(getSessions());
                      }}
                      className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                      title="Delete session"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conditional Main Content */}
      {
        activeTab === "architecture" ? (
          <main className="mx-auto max-w-6xl px-6 py-10">
            <ArchitectureFlow pipelineState={pipelineState} a2aMessages={a2aMessages} />
          </main>

        ) : (

          <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-10 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Request</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    Enter your healthcare research topic below.
                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-900/50 text-purple-300 border border-purple-700">GPT-5.2 • 300 words</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <textarea
                    className="w-full rounded-md border border-border bg-background p-3 text-sm"
                    rows={3}
                    placeholder="e.g. Create a patient-friendly presentation on diabetes management..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={isRunning}
                  />

                  {/* A2A Message Log Panel */}
                </CardContent>
                <CardFooter className="flex justify-between items-center">
                  <div className="flex gap-2">
                    {contextId && <Badge variant="info">Ctx: {contextId.slice(0, 6)}</Badge>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDebugMode(!debugMode)}>
                      {debugMode ? "Hide Debug" : "Show Debug"}
                    </Button>
                    <Button onClick={runPipeline} disabled={isRunning || !prompt}>
                      {isRunning ? "Running Pipeline..." : "Start New Run"}
                    </Button>
                  </div>
                </CardFooter>
              </Card>

              {/* Debug View */}
              {debugMode && (
                <Card className="border-red-900 bg-black">
                  <CardHeader><CardTitle className="text-red-500 text-sm">System Debug Log</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-48 overflow-y-auto font-mono text-xs text-green-400 p-2 bg-slate-900 rounded">
                      {rawLogs.map((l, i) => <div key={i}>{l}</div>)}
                      {rawLogs.length === 0 && <div>No debug logs yet...</div>}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Streaming Output</CardTitle>
                  <CardDescription>Live responses from the agent swarm.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 max-h-[400px] overflow-y-auto">
                  {logs.length === 0 && <p className="text-sm text-text-muted">No activity yet.</p>}
                  {logs.map((item, i) => (
                    <div
                      key={i}
                      className="flex gap-4 rounded-2xl border border-border bg-muted/30 p-4"
                    >
                      <div className="text-xs text-text-muted whitespace-nowrap">{item.time}</div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">{item.title}</p>
                        <p className="text-sm text-text-muted">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Agent Handoffs</CardTitle>
                  <CardDescription>Pipeline status with live task state.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {["triage", "research", "review", "presentation"].map((stage) => {
                    let variant = "default";
                    if (pipelineState[stage] === "Working") variant = "info";
                    if (pipelineState[stage] === "Completed") variant = "success";
                    if (pipelineState[stage] === "Failed") variant = "destructive";

                    return (
                      <div
                        key={stage}
                        className="rounded-2xl border border-border bg-muted/30 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-text-primary capitalize">{stage}</p>
                          <Badge variant={variant}>{pipelineState[stage]}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </section>

            <section className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Task Monitor</CardTitle>
                  <CardDescription>Real-time agent status.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {["triage", "research", "review", "presentation"].map((stage) => {
                    let variant = "default";
                    if (pipelineState[stage] === "Working") variant = "info";
                    if (pipelineState[stage] === "Completed") variant = "success";
                    if (pipelineState[stage] === "Failed") variant = "destructive";

                    return (
                      <div key={stage} className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-4">
                        <div>
                          <p className="text-sm font-semibold capitalize">{stage}</p>
                        </div>
                        <Badge variant={variant}>{pipelineState[stage]}</Badge>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Generated Artifacts</CardTitle><CardDescription>Click to view details</CardDescription></CardHeader>
                <CardContent>
                  {artifacts.length === 0 ? <div className="text-sm text-gray-500">No artifacts generated yet.</div> : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {artifacts.map((a, i) => (
                        <div key={i} className="p-3 bg-slate-800 rounded border border-slate-700 cursor-pointer hover:bg-slate-700 transition-colors" onClick={() => setSelectedArtifact(a)}>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-semibold text-blue-400">{a.title}</div>
                              <div className="text-xs text-gray-400">{a.detail}</div>
                            </div>
                            {a.url && <Badge variant="outline" className="text-xs">Link</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Artifact Detail Modal */}
            {selectedArtifact && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-slate-900 border-slate-700">
                  <CardHeader className="flex flex-row justify-between items-center border-b border-slate-800 pb-4">
                    <div>
                      <CardTitle className="text-xl text-blue-400">{selectedArtifact.title}</CardTitle>
                      <CardDescription>{selectedArtifact.detail}</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedArtifact(null)}>✕</Button>
                  </CardHeader>
                  <CardContent className="overflow-y-auto p-6 space-y-4">
                    {selectedArtifact.url && (
                      <div className="p-4 bg-blue-900/20 border border-blue-900 rounded mb-4">
                        <p className="text-sm text-blue-300 mb-2">Presentation Link:</p>
                        <a href={selectedArtifact.url} target="_blank" rel="noreferrer" className="text-blue-400 underline break-all">{selectedArtifact.url}</a>
                      </div>
                    )}

                    <div className="bg-slate-950 p-4 rounded border border-slate-800 overflow-x-auto">
                      <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">
                        {typeof selectedArtifact.data === 'string' ? selectedArtifact.data : JSON.stringify(selectedArtifact.data || {}, null, 2)}
                      </pre>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-slate-800 pt-4 flex justify-end">
                    <Button onClick={() => setSelectedArtifact(null)}>Close</Button>
                  </CardFooter>
                </Card>
              </div>
            )}

          </main>
        )
      }
      {/* Human-in-the-Loop Modal */}
      {
        awaitingApproval && (
          <ApprovalModal
            content={approvalContent}
            onApprove={() => approvalResolveRef.current?.resolve(approvalContent)}
            onEdit={(newContent) => {
              setApprovalContent(newContent);
              approvalResolveRef.current?.resolve(newContent);
            }}
            onReject={() => approvalResolveRef.current?.reject(new Error("User rejected the content"))}
          />
        )
      }
    </div >
  );
}
