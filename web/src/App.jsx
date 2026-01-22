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

const pipeline = [
  { name: "Triage", status: "Completed", variant: "success" },
  { name: "Research", status: "Streaming", variant: "info" },
  { name: "Review", status: "Queued", variant: "default" },
  { name: "Presentation", status: "Queued", variant: "default" }
];

const activity = [
  {
    time: "12:42",
    title: "Research agent connected",
    description: "Collecting evidence-based sources for diabetes care."
  },
  {
    time: "12:43",
    title: "Drafting patient-friendly summary",
    description: "Emphasizing lifestyle, monitoring, and care team support."
  },
  {
    time: "12:44",
    title: "Artifacts ready",
    description: "Key points and citations are being assembled."
  }
];

const artifacts = [
  {
    title: "Summary",
    detail: "Balanced overview of diabetes management for adults in the US."
  },
  {
    title: "Key Points",
    detail: "Monitoring, nutrition, physical activity, and medication adherence."
  },
  {
    title: "Gamma Deck",
    detail: "Presentation link will appear once review completes."
  }
];

export default function App() {
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
            <Button variant="ghost" size="sm">
              View Agent Cards
            </Button>
            <Button size="sm">Start New Run</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-10 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Request</CardTitle>
              <CardDescription>
                Patient-friendly diabetes management presentation with citations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-border bg-muted/40 p-5 text-sm text-text-primary">
                Create a patient-friendly presentation on diabetes management for adults
                in the US. Include lifestyle guidance, monitoring, and common questions.
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap items-center gap-3">
              <Badge variant="info">Context ID • 7f12</Badge>
              <Badge variant="default">Task ID • 91b7</Badge>
              <Badge variant="success">Streaming</Badge>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Streaming Output</CardTitle>
              <CardDescription>Live responses from the research agent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activity.map((item) => (
                <div
                  key={item.title}
                  className="flex gap-4 rounded-2xl border border-border bg-muted/30 p-4"
                >
                  <div className="text-xs text-text-muted">{item.time}</div>
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
              {pipeline.map((stage) => (
                <div
                  key={stage.name}
                  className="rounded-2xl border border-border bg-muted/30 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-text-primary">{stage.name}</p>
                    <Badge variant={stage.variant}>{stage.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-text-muted">
                    Route: {stage.name === "Research" ? "Gemini" : "OpenAI"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Task Monitor</CardTitle>
              <CardDescription>Health checks and agent status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-semibold">Triage</p>
                  <p className="text-xs text-text-muted">openai · classify_and_route</p>
                </div>
                <Badge variant="success">Completed</Badge>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-semibold">Research</p>
                  <p className="text-xs text-text-muted">gemini · summarize_medical_research</p>
                </div>
                <Badge variant="info">Working</Badge>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-semibold">Review</p>
                  <p className="text-xs text-text-muted">openai · review_medical_summary</p>
                </div>
                <Badge variant="default">Queued</Badge>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-semibold">Presentation</p>
                  <p className="text-xs text-text-muted">gamma · create_presentation</p>
                </div>
                <Badge variant="default">Queued</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Artifacts</CardTitle>
              <CardDescription>Latest outputs ready for review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {artifacts.map((artifact) => (
                <div
                  key={artifact.title}
                  className="rounded-2xl border border-border bg-muted/30 p-4"
                >
                  <p className="text-sm font-semibold text-text-primary">
                    {artifact.title}
                  </p>
                  <p className="text-sm text-text-muted">{artifact.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
