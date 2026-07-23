const API_BASE = import.meta.env.VITE_AGENT_SCOPE_API ?? "http://127.0.0.1:8088";

export async function fetchRuns() {
  const response = await fetch(`${API_BASE}/incidents`);
  if (!response.ok) throw new Error(`GET /incidents failed: ${response.status}`);
  const payload = await response.json();
  return payload.map(normalizeRun);
}

export async function explainRun(runId) {
  const response = await fetch(`${API_BASE}/incidents/${runId}/explain`, { method: "POST" });
  if (!response.ok) throw new Error(`POST /incidents/${runId}/explain failed: ${response.status}`);
  return response.json();
}

export async function triggerDemoRun(scenario) {
  const response = await fetch(`${API_BASE}/demo/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario })
  });
  if (!response.ok) throw new Error(`POST /demo/run failed: ${response.status}`);
  return response.json();
}

function normalizeRun(run) {
  const latency = (run.latency_ms ?? Math.round((run.latency ?? 0) * 1000)) / 1000;
  return {
    id: run.id,
    traceId: run.trace_id ?? run.traceId,
    scenario: run.scenario,
    status: run.status,
    agent: inferAgent(run.scenario),
    user: inferUser(run.scenario),
    startTime: inferStartTime(run.scenario),
    latency,
    tokens: run.tokens,
    inputTokens: Math.round(run.tokens * 0.82),
    outputTokens: Math.round(run.tokens * 0.18),
    cost: Math.round(run.tokens * 0.000009 * 1000) / 1000,
    tools: run.scenario === "Retrieval miss" ? "1/2" : "3/3",
    retrieval: run.retrieval_score ?? run.retrieval,
    summary: summaryFor(run),
    nextActions: nextActionsFor(run),
    spans: normalizeSpans(run.spans ?? [], latency),
    logs: normalizeLogs(run.logs ?? [], run.scenario)
  };
}

function normalizeSpans(spans, totalLatency) {
  let cursor = 0.2;
  return spans.map((span) => {
    const duration = Math.max(0.18, (span.duration_ms ?? Math.round((span.duration ?? 0) * 1000)) / 1000);
    const normalized = {
      name: span.name,
      service: span.service,
      start: cursor,
      duration,
      status: span.status
    };
    cursor = Math.min(totalLatency, cursor + duration * 0.42);
    return normalized;
  });
}

function normalizeLogs(logs, scenario) {
  if (logs.length === 0) return fallbackLogs(scenario);
  return logs.map((line, index) => {
    const [level = "INFO", service = "agent", ...message] = String(line).split(" ");
    return {
      time: `10:24:${String(33 - index).padStart(2, "0")}.${String(512 - index * 15).padStart(3, "0")}`,
      level,
      service,
      message: message.join(" ")
    };
  });
}

function summaryFor(run) {
  if (run.scenario === "Tool failure") return "The run failed because search_docs returned an upstream 500 and the trace isolates the failing tool span.";
  if (run.scenario === "Retrieval miss") return "The run completed, but retrieval confidence was too low to trust the answer without more source diversity.";
  return "The run completed, but context expansion caused abnormal token and cost usage.";
}

function nextActionsFor(run) {
  if (run.scenario === "Tool failure") {
    return ["Inspect search_docs upstream health.", "Add a SigNoz alert for tool error rate.", "Record retry budget as span attributes."];
  }
  if (run.scenario === "Retrieval miss") {
    return ["Tune vector filters and chunking.", "Require minimum source diversity.", "Dashboard retrieval score by agent."];
  }
  return ["Add token budget guardrails.", "Summarize context before planner prompts.", "Alert on tokens per run above 2x baseline."];
}

function fallbackLogs(scenario) {
  return [{ time: "10:24:31.087", level: "INFO", service: "agent", message: `Loaded ${scenario} telemetry` }];
}

function inferAgent(scenario) {
  return scenario === "Token spike" ? "PlannerAgent" : scenario === "Retrieval miss" ? "AnalystAgent" : "ResearchAgent";
}

function inferUser(scenario) {
  return scenario === "Token spike" ? "carol@example.com" : scenario === "Retrieval miss" ? "bob@example.com" : "alice@example.com";
}

function inferStartTime(scenario) {
  return scenario === "Token spike" ? "9:31:44 AM" : scenario === "Retrieval miss" ? "9:58:12 AM" : "10:24:31 AM";
}
