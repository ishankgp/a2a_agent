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

// API Configuration
const API_URLS = {
  triage: "http://127.0.0.1:8001",
  research: "http://127.0.0.1:8002",
  review: "http://127.0.0.1:8003",
  presentation: "http://127.0.0.1:8004"
};

export default function App() {
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
      try {
        const res = await fetch(`${serviceUrl}/tasks/resubscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task_id: taskId })
        });
        const data = await res.json();
        if (data.artifacts?.length) {
          data.artifacts.forEach(artifact => {
            if (artifact.gammaUrl) {
              setArtifacts(prev => [...prev, { title: "Gamma Deck", detail: "Presentation Generated", url: artifact.gammaUrl }]);
            } else if (artifact.summary) {
              setArtifacts(prev => [...prev, { title: "Research Summary", detail: `From ${stageName}`, data: artifact }]);
            } else if (artifact.revisedSummary) {
              setArtifacts(prev => [...prev, { title: "Review Feedback", detail: "Content reviewed", data: artifact }]);
            } else if (artifact.slideOutline) {
              setArtifacts(prev => [...prev, { title: "Slide Outline", detail: "Fallback generation", data: artifact }]);
            } else if (artifact.route) {
              addLog(`Triage Decision`, `Routed to: ${artifact.route}`);
            }
          });
        }
        return data;
      } catch (e) {
        console.error(`Failed to fetch artifacts for ${stageName}:`, e);
        return null;
      }
    };

    try {
      // 1. Triage
      updateStageStatus("triage", "Working");
      addLog("Triage Started", "Analyzing user request...");

      let triageData;
      try {
        const triageRes = await fetch(`${API_URLS.triage}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: { role: "user", content: prompt } })
        });
        if (!triageRes.ok) throw new Error(`Triage service error: ${triageRes.status}`);
        triageData = await triageRes.json();
      } catch (e) {
        updateStageStatus("triage", "Failed");
        addLog("Triage Failed", e.message);
        throw e; // Cannot continue without triage
      }

      setTaskId(triageData.task_id);
      setContextId(triageData.context_id);

      // Subscribe to Triage Stream (short lived)
      await subscribeToStream(API_URLS.triage, triageData.task_id, "triage");

      // Fetch actual route from triage artifacts (not naive string matching)
      const triageArtifacts = await fetchArtifacts(API_URLS.triage, triageData.task_id, "triage");
      const route = triageArtifacts?.artifacts?.[0]?.route ?? "medical_research";
      addLog("Routing Complete", `Selected route: ${route}`);

      if (route === "medical_research") {
        // 2. Research
        updateStageStatus("research", "Working");
        let researchData;
        try {
          const researchRes = await fetch(`${API_URLS.research}/message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              context_id: triageData.context_id,
              message: { role: "user", content: prompt }
            })
          });
          if (!researchRes.ok) throw new Error(`Research service error: ${researchRes.status}`);
          researchData = await researchRes.json();
          await subscribeToStream(API_URLS.research, researchData.task_id, "research");
          await fetchArtifacts(API_URLS.research, researchData.task_id, "research");
        } catch (e) {
          updateStageStatus("research", "Failed");
          addLog("Research Failed", e.message);
          throw e;
        }

        // 3. Review
        updateStageStatus("review", "Working");
        let reviewData;
        try {
          const reviewRes = await fetch(`${API_URLS.review}/message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              context_id: triageData.context_id,
              message: { role: "user", content: researchData.message.content }
            })
          });
          if (!reviewRes.ok) throw new Error(`Review service error: ${reviewRes.status}`);
          reviewData = await reviewRes.json();
          await subscribeToStream(API_URLS.review, reviewData.task_id, "review");
          await fetchArtifacts(API_URLS.review, reviewData.task_id, "review");
        } catch (e) {
          updateStageStatus("review", "Failed");
          addLog("Review Failed", e.message);
          throw e;
        }

        // 4. Presentation
        updateStageStatus("presentation", "Working");
        try {
          const presentRes = await fetch(`${API_URLS.presentation}/message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              context_id: triageData.context_id,
              message: { role: "user", content: reviewData.message.content }
            })
          });
          if (!presentRes.ok) throw new Error(`Presentation service error: ${presentRes.status}`);
          const presentData = await presentRes.json();
          await subscribeToStream(API_URLS.presentation, presentData.task_id, "presentation");
          await fetchArtifacts(API_URLS.presentation, presentData.task_id, "presentation");
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
          const presentRes = await fetch(`${API_URLS.presentation}/message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              context_id: triageData.context_id,
              message: { role: "user", content: prompt }
            })
          });
          if (!presentRes.ok) throw new Error(`Presentation service error: ${presentRes.status}`);
          const presentData = await presentRes.json();
          await subscribeToStream(API_URLS.presentation, presentData.task_id, "presentation");
          await fetchArtifacts(API_URLS.presentation, presentData.task_id, "presentation");
        } catch (e) {
          updateStageStatus("presentation", "Failed");
          addLog("Presentation Failed", e.message);
          throw e;
        }
      }

    } catch (e) {
      console.error(e);
      addLog("Pipeline Error", `Stopped due to: ${e.message}`);
    } finally {
      setIsRunning(false);
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

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-10 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Request</CardTitle>
              <CardDescription>
                Enter your healthcare research topic below.
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
            </CardContent>
            <CardFooter className="flex justify-between items-center">
              <div className="flex gap-2">
                {contextId && <Badge variant="info">Ctx: {contextId.slice(0, 6)}</Badge>}
              </div>
              <Button onClick={runPipeline} disabled={isRunning || !prompt}>
                {isRunning ? "Running Pipeline..." : "Start New Run"}
              </Button>
            </CardFooter>
          </Card>

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
            <CardHeader>
              <CardTitle>Artifacts</CardTitle>
              <CardDescription>Latest outputs ready for review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {artifacts.length === 0 && <p className="text-sm text-text-muted">No artifacts yet.</p>}
              {artifacts.map((artifact, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border bg-muted/30 p-4"
                >
                  <p className="text-sm font-semibold text-text-primary">
                    {artifact.title}
                  </p>
                  <p className="text-sm text-text-muted">{artifact.detail}</p>
                  {artifact.url && (
                    <a href={artifact.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline mt-1 block">
                      Open Presentation
                    </a>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
