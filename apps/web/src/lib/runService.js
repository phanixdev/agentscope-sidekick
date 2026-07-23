import { agentRuns } from "../data";
import { supabase } from "./supabase";

const localNotesKey = "agentscope-investigation-notes";

const referenceBaselines = {
  "Tool failure": { id: "reference_research_v1", sampleSize: 42, latency: 4.18, tokens: 2190, retrieval: 0.67, cost: 0.019, toolErrors: 0 },
  "Retrieval miss": { id: "reference_analyst_v1", sampleSize: 36, latency: 2.94, tokens: 1310, retrieval: 0.71, cost: 0.012, toolErrors: 0 },
  "Token spike": { id: "reference_planner_v1", sampleSize: 28, latency: 4.92, tokens: 5480, retrieval: 0.72, cost: 0.054, toolErrors: 0 }
};

function referenceBaselineFor(scenario, reason = "Fewer than 5 healthy workspace runs were available in the selected window.") {
  const baseline = referenceBaselines[scenario];
  return baseline ? {
    ...baseline,
    kind: "reference",
    source: "Versioned judge fixture",
    windowLabel: "Fixed reference cohort",
    fallbackReason: reason
  } : null;
}

function observedBaselineFrom(row) {
  return {
    id: `observed_${row.scenario.toLowerCase().replaceAll(" ", "_")}_${row.window_hours}h`,
    kind: "observed",
    source: "Supabase workspace runs",
    windowLabel: `Last ${row.window_hours} hours`,
    sampleSize: Number(row.sample_size),
    latency: Number(row.latency),
    tokens: Number(row.tokens),
    retrieval: Number(row.retrieval),
    cost: Number(row.cost),
    toolErrors: Number(row.tool_errors),
    computedAt: row.computed_at
  };
}

function fromDatabase(run, observedBaselines = {}, remediations = {}) {
  return {
    id: run.run_key,
    databaseId: run.id,
    traceId: run.trace_id,
    capturedAt: run.started_at,
    baseline: observedBaselines[run.scenario] ?? referenceBaselineFor(run.scenario),
    remediation: remediations[run.id] ?? null,
    attributes: run.attributes ?? {},
    scenario: run.scenario,
    status: run.status,
    agent: run.agent_name,
    user: run.actor_email,
    startTime: new Date(run.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    startedAt: run.started_at,
    latency: run.duration_ms / 1000,
    tokens: run.total_tokens,
    inputTokens: run.input_tokens,
    outputTokens: run.output_tokens,
    cost: Number(run.estimated_cost),
    tools: run.tool_summary,
    retrieval: Number(run.retrieval_score),
    summary: run.summary,
    nextActions: run.next_actions ?? [],
    spans: (run.run_spans ?? []).map((span) => ({
      id: span.id,
      name: span.span_name,
      service: span.service_name,
      start: span.started_offset_ms / 1000,
      duration: span.duration_ms / 1000,
      status: span.status
    })),
    logs: (run.run_logs ?? []).map((log) => ({
      id: log.id,
      time: new Date(log.occurred_at).toLocaleTimeString([], { hour12: false }),
      level: log.level,
      service: log.service_name,
      message: log.message
    }))
  };
}

export async function getWorkspace(preview = false) {
  if (!supabase || preview) return { id: "preview", name: "Track 1 Judge Workspace", environment: "Production", role: "judge" };
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, environment)")
    .order("created_at")
    .limit(1)
    .single();
  if (error) throw error;
  return { ...data.workspaces, role: data.role };
}

export async function listRuns(workspaceId, preview = false) {
  if (!supabase || preview) return agentRuns;
  const [runsResult, baselineResult, remediationResult] = await Promise.all([
    supabase
      .from("agent_runs")
      .select("*, run_spans(*), run_logs(*)")
      .eq("workspace_id", workspaceId)
      .order("started_at", { ascending: false }),
    supabase.rpc("get_healthy_baselines", {
      target_workspace_id: workspaceId,
      lookback_hours: 24,
      required_samples: 5
    }),
    supabase
      .from("remediations")
      .select("id, run_id, after_run_id, action, status, before_snapshot, applied_at, verified_at")
      .eq("workspace_id", workspaceId)
  ]);
  const { data, error } = runsResult;
  if (error) throw error;
  const observedBaselines = baselineResult.error
    ? {}
    : Object.fromEntries((baselineResult.data ?? []).map((row) => [row.scenario, observedBaselineFrom(row)]));
  const remediations = {};
  if (!remediationResult.error) {
    for (const item of remediationResult.data ?? []) {
      remediations[item.run_id] = { ...item, role: "before" };
      if (item.after_run_id) remediations[item.after_run_id] = { ...item, role: "after" };
    }
  }
  return data.map((run) => fromDatabase(run, observedBaselines, remediations));
}

export async function createDemoRun(scenario, preview = false) {
  if (!supabase || preview) {
    const template = agentRuns.find((run) => run.scenario.toLowerCase().replace(" ", "_") === scenario) ?? agentRuns[0];
    const traceId = crypto.randomUUID().replaceAll("-", "");
    const capturedAt = new Date().toISOString();
    return {
      ...template,
      id: `run_${traceId.slice(0, 8)}`,
      traceId,
      capturedAt,
      startedAt: capturedAt,
      startTime: "just now",
      attributes: { ...template.attributes, evidence_source: "Ephemeral judge dataset" },
      spans: template.spans.map((span) => ({ ...span, id: crypto.randomUUID().replaceAll("-", "").slice(0, 16) }))
    };
  }
  const { data, error } = await supabase.rpc("create_demo_run", { scenario_key: scenario });
  if (error) throw error;
  return data;
}

function previewRemediationRun(run, action) {
  const baseline = run.baseline ?? referenceBaselineFor(run.scenario);
  const latency = Math.min(baseline?.latency ?? run.latency * 0.6, 9.2);
  const tokens = Math.round(Math.min(baseline?.tokens ?? run.tokens * 0.55, 11000));
  const retrieval = Math.max(baseline?.retrieval ?? run.retrieval, 0.65);
  const cost = Number(Math.min(baseline?.cost ?? run.cost * 0.6, run.cost).toFixed(3));
  const inputTokens = Math.round(tokens * 0.82);
  const createdAt = new Date().toISOString();
  return {
    ...run,
    id: `run_fix_${crypto.randomUUID().slice(0, 6)}`,
    databaseId: null,
    traceId: crypto.randomUUID().replaceAll("-", ""),
    capturedAt: createdAt,
    startedAt: createdAt,
    startTime: "just now",
    status: "completed",
    latency,
    tokens,
    inputTokens,
    outputTokens: tokens - inputTokens,
    retrieval,
    cost,
    tools: run.scenario === "Retrieval miss" ? "2/2" : run.tools,
    summary: "The remediation rerun completed within all configured telemetry guardrails.",
    nextActions: ["Monitor the repaired path for regression."],
    scenario: "Remediation verification",
    sourceScenario: run.sourceScenario ?? run.scenario,
    attributes: { ...run.attributes, evidence_source: "Ephemeral verification rerun" },
    spans: run.spans.map((span, index) => ({ ...span, id: crypto.randomUUID().replaceAll("-", "").slice(0, 16), status: "ok", start: span.start / Math.max(run.latency, 1) * latency, duration: Math.min(span.duration, latency * (index === 0 ? 1 : 0.35)) })),
    logs: [
      { time: "now", level: "INFO", service: "remediation", message: `Applied: ${action}` },
      { time: "now", level: "INFO", service: "agent", message: "Verification rerun passed latency, token, retrieval, and tool guardrails" }
    ],
    remediation: {
      role: "after",
      action,
      status: "verified",
      run_id: run.databaseId ?? run.id,
      applied_at: createdAt,
      verified_at: createdAt,
      before_snapshot: { latency: run.latency, tokens: run.tokens, retrieval: run.retrieval, cost: run.cost, status: run.status }
    }
  };
}

export async function applyRemediation(run, action, preview = false) {
  if (!action?.trim()) throw new Error("Choose a remediation action before verification.");
  if (!supabase || preview) return previewRemediationRun(run, action.trim());
  const { data, error } = await supabase.rpc("run_remediation", {
    target_run_id: run.databaseId,
    action_text: action.trim()
  });
  if (error) throw error;
  return data;
}
export async function listAlerts(workspaceId, preview = false) {
  if (!supabase || preview) {
    return [
      { id: "tool-errors", name: "Tool error rate", metric: "agentscope.tool.calls", threshold: "> 5%", enabled: true, severity: "critical" },
      { id: "token-budget", name: "Token budget exceeded", metric: "agentscope.agent.tokens_per_run.max", threshold: "> 12k", enabled: true, severity: "warning" },
      { id: "retrieval-quality", name: "Retrieval quality", metric: "agentscope.retrieval.score.min", threshold: "< 0.30", enabled: true, severity: "warning" },
      { id: "run-latency", name: "Agent run latency", metric: "agentscope.agent.duration.max", threshold: "> 10s", enabled: true, severity: "critical" }
    ];
  }
  const { data, error } = await supabase.from("alert_rules").select("*").eq("workspace_id", workspaceId).order("created_at");
  if (error) throw error;
  return data;
}

export async function toggleAlert(id, enabled, preview = false) {
  if (!supabase || preview) return;
  const { error } = await supabase.from("alert_rules").update({ enabled }).eq("id", id);
  if (error) throw error;
}

export async function getNote(runId, preview = false) {
  if (!supabase || preview) {
    const notes = JSON.parse(localStorage.getItem(localNotesKey) ?? "{}");
    return notes[runId] ?? "";
  }
  const { data, error } = await supabase.from("investigation_notes").select("body").eq("run_id", runId).maybeSingle();
  if (error) throw error;
  return data?.body ?? "";
}

export async function saveNote(runId, body, preview = false) {
  if (!supabase || preview) {
    const notes = JSON.parse(localStorage.getItem(localNotesKey) ?? "{}");
    notes[runId] = body;
    localStorage.setItem(localNotesKey, JSON.stringify(notes));
    return;
  }
  const { error } = await supabase.from("investigation_notes").upsert(
    { run_id: runId, body },
    { onConflict: "run_id,user_id" }
  );
  if (error) throw error;
}
