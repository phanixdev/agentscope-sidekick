export const agentRuns = [
  {
    id: "run_7f3a1c9d",
    traceId: "70468b87b41bc6ecbe14d95f30ebcd2c",
    capturedAt: "2026-07-22T21:52:35+05:30",
    scenario: "Tool failure",
    status: "failed",
    agent: "ResearchAgent",
    user: "alice@example.com",
    startTime: "10:24:31 AM",
    latency: 12.48,
    tokens: 2341,
    inputTokens: 1921,
    outputTokens: 420,
    cost: 0.021,
    tools: "3/3",
    retrieval: 0.62,
    baseline: { id: "reference_research_v1", kind: "reference", source: "Versioned judge fixture", windowLabel: "Fixed reference cohort", fallbackReason: "Judge mode uses a deterministic comparison cohort.", sampleSize: 42, latency: 4.18, tokens: 2190, retrieval: 0.67, cost: 0.019, toolErrors: 0 },
    summary: "The run failed because the search_docs tool returned HTTP 500 after one attempt.",
    nextActions: [
      "Check upstream availability for the document search service.",
      "Add retry budget and circuit-breaker telemetry for search_docs.",
      "Create an alert on tool.search_docs error rate over 5%."
    ],
    spans: [
      { name: "ResearchAgent.run", service: "agent", start: 0.2, duration: 12.48, status: "ok" },
      { name: "LLM(gpt-4o-mini)", service: "llm", start: 0.6, duration: 9.63, status: "ok" },
      { id: "883a2e422369d0b9", name: "tool.search_docs", service: "tool", start: 1.2, duration: 2.41, status: "error" },
      { name: "tool.get_webpage", service: "tool", start: 3.8, duration: 1.12, status: "ok" },
      { name: "tool.summarize", service: "tool", start: 5.2, duration: 3.09, status: "ok" },
      { name: "vector_db.query", service: "retrieval", start: 3.4, duration: 0.66, status: "ok" },
      { name: "response.format", service: "agent", start: 8.7, duration: 0.41, status: "ok" }
    ],
    logs: [
      { time: "10:24:33.512", level: "ERROR", service: "tool.search_docs", message: "HTTP 500 Internal Server Error: upstream service unavailable" },
      { time: "10:24:33.497", level: "WARN", service: "ResearchAgent", message: "Tool call failed: search_docs (attempt 1/1)" },
      { time: "10:24:31.102", level: "INFO", service: "ResearchAgent", message: "Starting run for query: key findings in Q1 earnings reports" },
      { time: "10:24:31.087", level: "INFO", service: "gateway", message: "POST /v1/runs" }
    ]
  },
  {
    id: "run_2c8b4e7a",
    traceId: "56c25a68725eee566704bd5045279b36",
    capturedAt: "2026-07-23T09:58:18+05:30",
    scenario: "Retrieval miss",
    status: "completed",
    agent: "AnalystAgent",
    user: "bob@example.com",
    startTime: "9:58:12 AM",
    latency: 3.21,
    tokens: 1203,
    inputTokens: 884,
    outputTokens: 319,
    cost: 0.011,
    tools: "1/2",
    retrieval: 0.18,
    baseline: { id: "reference_analyst_v1", kind: "reference", source: "Versioned judge fixture", windowLabel: "Fixed reference cohort", fallbackReason: "Judge mode uses a deterministic comparison cohort.", sampleSize: 36, latency: 2.94, tokens: 1310, retrieval: 0.71, cost: 0.012, toolErrors: 0 },
    summary: "The agent completed, but retrieval confidence was low and only one source was used.",
    nextActions: [
      "Tune embedding filters for the finance corpus.",
      "Require minimum source diversity before final response.",
      "Dashboard retrieval hit rate by agent and query type."
    ],
    spans: [
      { name: "AnalystAgent.run", service: "agent", start: 0.1, duration: 3.21, status: "ok" },
      { id: "8e34cfe86f37d921", name: "vector_db.query", service: "retrieval", start: 0.4, duration: 0.42, status: "warn" },
      { name: "LLM(gpt-4o-mini)", service: "llm", start: 0.9, duration: 1.82, status: "ok" },
      { name: "response.format", service: "agent", start: 2.8, duration: 0.22, status: "ok" }
    ],
    logs: [
      { time: "09:58:13.231", level: "WARN", service: "retrieval", message: "Low retrieval score: mean=0.18, results_used=1/5" },
      { time: "09:58:12.601", level: "INFO", service: "AnalystAgent", message: "Retrieved 1 usable document from vector store" }
    ]
  },
  {
    id: "run_9d7e6b11",
    traceId: "65ebbf7700aad47c72dc3cc4c1df3574",
    capturedAt: "2026-07-23T09:31:52+05:30",
    scenario: "Token spike",
    status: "completed",
    agent: "PlannerAgent",
    user: "carol@example.com",
    startTime: "9:31:44 AM",
    latency: 6.74,
    tokens: 18642,
    inputTokens: 17184,
    outputTokens: 1458,
    cost: 0.182,
    tools: "2/2",
    retrieval: 0.74,
    baseline: { id: "reference_planner_v1", kind: "reference", source: "Versioned judge fixture", windowLabel: "Fixed reference cohort", fallbackReason: "Judge mode uses a deterministic comparison cohort.", sampleSize: 28, latency: 4.92, tokens: 5480, retrieval: 0.72, cost: 0.054, toolErrors: 0 },
    summary: "The run succeeded, but context packing caused an abnormal token and cost spike.",
    nextActions: [
      "Summarize retrieved context before the planner prompt.",
      "Add a token budget guardrail span event.",
      "Alert when p95 tokens per run exceeds the baseline by 2x."
    ],
    spans: [
      { name: "PlannerAgent.run", service: "agent", start: 0.1, duration: 6.74, status: "ok" },
      { name: "retrieval.expand_context", service: "retrieval", start: 0.6, duration: 1.74, status: "ok" },
      { id: "6f2d5b73129ae4c8", name: "LLM(gpt-4o-mini)", service: "llm", start: 2.4, duration: 3.82, status: "warn" },
      { name: "response.format", service: "agent", start: 6.2, duration: 0.32, status: "ok" }
    ],
    logs: [
      { time: "09:31:48.218", level: "WARN", service: "llm", message: "Token usage exceeded p95 baseline by 3.4x" },
      { time: "09:31:45.002", level: "INFO", service: "retrieval", message: "Context expansion included 18 chunks" }
    ]
  }
];

export const evidenceBundle = {
  traceId: "70468b87b41bc6ecbe14d95f30ebcd2c",
  capturedAt: "2026-07-22T21:52:35+05:30",
  revision: "c83b4f7",
  contract: "Captured agent execution; extended API contract is verified separately"
};

export const dashboards = [
  { label: "LLM latency p95", value: "12.48s", delta: "+23%", tone: "danger" },
  { label: "Total tokens", value: "2,341", delta: "vs p50", tone: "ok" },
  { label: "Tool calls", value: "3 / 3", delta: "1 failed", tone: "danger" },
  { label: "Retrieval score", value: "0.62", delta: "moderate", tone: "warn" }
];
