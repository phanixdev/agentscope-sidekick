import { agentRuns } from "../data";
import { supabase } from "./supabase";

const localNotesKey = "agentscope-investigation-notes";

const healthyBaselines = {
  "Tool failure": { id: "baseline_research_24h", sampleSize: 42, latency: 4.18, tokens: 2190, retrieval: 0.67, cost: 0.019, toolErrors: 0 },
  "Retrieval miss": { id: "baseline_analyst_24h", sampleSize: 36, latency: 2.94, tokens: 1310, retrieval: 0.71, cost: 0.012, toolErrors: 0 },
  "Token spike": { id: "baseline_planner_24h", sampleSize: 28, latency: 4.92, tokens: 5480, retrieval: 0.72, cost: 0.054, toolErrors: 0 }
};

function fromDatabase(run) {
  return {
    id: run.run_key,
    databaseId: run.id,
    traceId: run.trace_id,
    capturedAt: run.started_at,
    baseline: healthyBaselines[run.scenario],
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
  const { data, error } = await supabase
    .from("agent_runs")
    .select("*, run_spans(*), run_logs(*)")
    .eq("workspace_id", workspaceId)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data.map(fromDatabase);
}

export async function createDemoRun(scenario, preview = false) {
  if (!supabase || preview) {
    const template = agentRuns.find((run) => run.scenario.toLowerCase().replace(" ", "_") === scenario) ?? agentRuns[0];
    return { ...template, id: `run_${crypto.randomUUID().slice(0, 8)}`, startTime: "just now" };
  }
  const { data, error } = await supabase.rpc("create_demo_run", { scenario_key: scenario });
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
