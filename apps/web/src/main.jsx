import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, AlertTriangle, ArrowRight, Bell, Bot, Check, CheckCircle2, ChevronDown,
  ChevronRight, CircleDot, Copy, Database, Download, ExternalLink, FileText,
  Eye, Fingerprint, Gauge, GitCompareArrows, LayoutDashboard, LoaderCircle, LogOut, Menu, Pause,
  Play, RadioTower, RefreshCw, Search, ShieldCheck, Target, Terminal, Users, Wrench, X, XCircle
} from "lucide-react";
import { AuthScreen } from "./components/AuthScreen";
import { evidenceBundle } from "./data";
import { affectedRunsForAlert, runGuardrailState } from "./lib/alertRules";
import { supabase } from "./lib/supabase";
import {
  applyRemediation, createDemoRun, getNote, getWorkspace, listAlerts, listRuns, saveNote, toggleAlert
} from "./lib/runService";
import "./styles.css";

const tone = (value) => ["failed", "error", "critical", "danger"].includes(value)
  ? "danger"
  : ["warn", "warning"].includes(value) ? "warn" : "ok";

const initials = (user) => (user?.user_metadata?.full_name || user?.email || "Track 1 Judge")
  .split(/[\s@]+/)
  .slice(0, 2)
  .map((part) => part[0])
  .join("")
  .toUpperCase();

function evidenceFor(run) {
  const failedSpan = run.spans.find((span) => span.status === "error" && span.service !== "agent") || run.spans.find((span) => span.status === "error");
  const warningSpan = run.spans.find((span) => span.status === "warn");
  const correlatedLog = run.logs.find((log) => ["ERROR", "WARN"].includes(log.level));
  const metric = run.tokens > 12000
    ? { label: "Token metric", value: `${run.tokens.toLocaleString()} tokens`, detail: "Above 12k budget threshold", kind: "warn" }
    : run.retrieval < 0.3
      ? { label: "Retrieval metric", value: run.retrieval.toFixed(2), detail: "Below 0.30 quality threshold", kind: "danger" }
      : { label: "Latency metric", value: `${run.latency.toFixed(2)}s`, detail: run.latency > 10 ? "Above 10s latency threshold" : "Within latency guardrail", kind: run.latency > 10 ? "danger" : "ok" };

  return [
    {
      label: failedSpan ? "Failed span" : warningSpan ? "Warning span" : "Root span",
      value: (failedSpan || warningSpan || run.spans[0])?.name || "agent.run",
      detail: `${(failedSpan || warningSpan || run.spans[0])?.duration?.toFixed(2) || run.latency.toFixed(2)}s · ${(failedSpan || warningSpan || run.spans[0])?.status || run.status}`,
      kind: failedSpan ? "danger" : warningSpan ? "warn" : "ok"
    },
    metric,
    {
      label: "Correlated log",
      value: correlatedLog?.service || "agent",
      detail: correlatedLog?.message || "No warning or error log emitted",
      kind: correlatedLog ? tone(correlatedLog.level.toLowerCase()) : "ok"
    }
  ];
}

function metricProvenance(run) {
  if (run.tokens > 12000) return { name: "agentscope.agent.tokens_per_run.max", query: "max(total_tokens) > 12000" };
  if (run.retrieval < 0.3) return { name: "agentscope.retrieval.score.min", query: "min(retrieval_score) < 0.30" };
  return { name: "agentscope.agent.duration.max", query: "max(duration) > 10s" };
}

function diagnosisProvenance(run) {
  const rules = {
    "Tool failure": "agentscope.tool.error-rate",
    "Retrieval miss": "agentscope.retrieval.quality",
    "Token spike": "agentscope.token.budget"
  };
  return {
    ruleId: run.attributes?.rule_id ?? rules[run.scenario] ?? "agentscope.run.guardrail",
    ruleVersion: run.attributes?.rule_version ?? "track1-rules@1.0.0",
    engine: run.attributes?.diagnosis_engine ?? "Deterministic telemetry rules",
    model: run.attributes?.diagnosis_model ?? "None in decision path",
    promptVersion: run.attributes?.prompt_version ?? "Not applicable"
  };
}

function confidenceBreakdown(run) {
  const evidence = evidenceFor(run);
  const anomalySpan = evidence[0];
  const metric = evidence[1];
  const log = evidence[2];
  const signals = [
    { label: "Anomalous span", detail: anomalySpan.value, matched: anomalySpan.kind !== "ok" },
    { label: "Guardrail breach", detail: metric.detail, matched: metric.kind !== "ok" },
    { label: "Trace-correlated log", detail: log.detail, matched: log.kind !== "ok" && Boolean(run.traceId) }
  ];
  const matched = signals.filter((signal) => signal.matched).length;
  const score = Math.min(0.94, 0.70 + matched * 0.08);
  return { label: matched === 3 ? "High" : matched === 2 ? "Medium" : "Low", matched, score, signals };
}

function confidenceFor(run) {
  return confidenceBreakdown(run).score;
}

function formatCapturedAt(run) {
  if (!run.capturedAt) return "Current workspace session";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(run.capturedAt));
}

function percentDelta(current, baseline) {
  if (!baseline) return "n/a";
  const delta = (current - baseline) / baseline * 100;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%`;
}

function Sidebar({ view, setView, workspace, open, close, runs, filters, setFilters, setQuery, query, alertCount, preview }) {
  const nav = [
    ["overview", LayoutDashboard, "Overview"],
    ["runs", Bot, "Agent runs"],
    ["alerts", Bell, "Alerts"],
    ["team", Users, "Team"]
  ];
  const agents = [...new Set(runs.map((run) => run.agent))];
  const reset = () => { setFilters({ status: "all", agent: "all" }); setQuery(""); };

  return <aside className={`sidebar ${open ? "open" : ""}`}>
    <div className="brand"><span><Activity size={18}/></span>AgentScope Sidekick<button aria-label="Close navigation" className="mobile-close icon-button" onClick={close}><X size={18}/></button></div>
    <div className="workspace-picker"><b>{workspace.name.slice(0, 2).toUpperCase()}</b><span><strong>{workspace.name}</strong><small>{workspace.environment}</small></span></div>
    <nav>{nav.map(([id, Icon, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => { setView(id); close(); }}><Icon size={17}/>{label}{id === "alerts" && <b aria-label={`${alertCount} active breached guardrails`} title={`${alertCount} active breached guardrails`}>{alertCount}</b>}</button>)}</nav>
    {view === "runs" && <div className="filters">
      <div><strong>Filters</strong><button onClick={reset} disabled={filters.status === "all" && filters.agent === "all" && !query}>Reset</button></div>
      <label>Status<select aria-label="Filter by status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">All statuses</option><option value="failed">Failed</option><option value="completed">Completed</option></select></label>
      <label>Agent<select aria-label="Filter by agent" value={filters.agent} onChange={(event) => setFilters((current) => ({ ...current, agent: event.target.value }))}><option value="all">All agents</option>{agents.map((agent) => <option value={agent} key={agent}>{agent}</option>)}</select></label>
      <div className="filter-summary"><RadioTower size={14}/><span>{preview ? "Deterministic judge dataset · resets on refresh" : "Workspace telemetry · last 24 hours"}</span></div>
    </div>}
  </aside>;
}

function Topbar({ user, preview, workspace, openMenu, menuOpen, query, setQuery, openProof, showRuns }) {
  const [menu, setMenu] = useState(false);
  const signOut = async () => supabase && !preview ? supabase.auth.signOut() : window.location.reload();
  const displayName = preview ? "Track 1 Judge" : user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Demo User";

  return <header className="topbar">
    <button aria-label="Open navigation" aria-expanded={menuOpen} className="mobile-menu icon-button" onClick={openMenu}><Menu size={20}/></button>
    <div className="live"><i/>{preview ? "Judge demo data" : "Workspace telemetry"}</div>
    <button className="source" onClick={openProof}><Terminal size={15}/>SigNoz evidence<ExternalLink size={13}/></button>
    <label className="global-search"><Search size={16}/><input aria-label="Search runs" value={query} onFocus={showRuns} onChange={(event) => { setQuery(event.target.value); showRuns(); }} placeholder="Search runs, agents, traces..."/><kbd>/</kbd></label>
    <div className="account"><button aria-expanded={menu} onClick={() => setMenu(!menu)}><b className="avatar">{initials(user)}</b><span><strong>{displayName}</strong><small>{preview ? "ephemeral demo" : workspace.role}</small></span><ChevronDown size={14}/></button>{menu && <div><button onClick={signOut}><LogOut size={16}/>{preview ? "Exit demo" : "Sign out"}</button></div>}</div>
  </header>;
}

function ScenarioMenu({ create, busy }) {
  const [open, setOpen] = useState(false);
  const items = [
    ["tool_failure", XCircle, "Tool failure", "Upstream search returns HTTP 500"],
    ["retrieval_miss", Search, "Retrieval miss", "Low confidence and source diversity"],
    ["token_spike", Gauge, "Token spike", "Context expansion exceeds baseline"]
  ];
  return <div className="scenario"><button className="primary" disabled={busy} onClick={() => setOpen(!open)}>{busy ? <LoaderCircle className="spin" size={16}/> : <Play size={16}/>}Create demo run<ChevronDown size={14}/></button>{open && <div className="scenario-popover">{items.map(([id, Icon, title, copy]) => <button key={id} onClick={() => { create(id); setOpen(false); }}><Icon size={17}/><span><strong>{title}</strong><small>{copy}</small></span></button>)}</div>}</div>;
}

function RunList({ runs, selected, select, query, setQuery, refresh, busy }) {
  return <section className="run-list panel"><div className="table-tools"><label><Search size={15}/><input aria-label="Filter agent runs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter runs..."/></label><button aria-label="Refresh runs" className="icon-button" onClick={refresh} disabled={busy}><RefreshCw className={busy ? "spin" : ""} size={17}/></button></div><div className="run-table"><div className="run-row head"><span>Run ID</span><span>Agent</span><span>Status</span><span>Duration</span><span>Started</span><span/></div>{runs.map((run) => <button className={`run-row ${selected?.id === run.id ? "selected" : ""}`} key={run.id} onClick={() => select(run.id)}><span className="run-key"><CircleDot size={14}/>{run.id}<small>{run.scenario}</small></span><span>{run.agent}<small>{run.user}</small></span><span className={`status ${tone(run.status)}`}><i/>{run.status}</span><span>{run.latency.toFixed(2)}s</span><span>{run.startTime}</span><ChevronRight size={15}/></button>)}{!runs.length && <div className="empty"><Search size={20}/>No runs match these filters.</div>}</div></section>;
}

function EvidenceList({ run }) {
  return <div className="evidence-list">{evidenceFor(run).map((item) => <div key={item.label}><span className={`evidence-icon ${item.kind}`}><Fingerprint size={15}/></span><span><small>{item.label}</small><strong>{item.value}</strong><p>{item.detail}</p></span></div>)}</div>;
}

function ConfidenceProvenance({ run }) {
  const confidence = confidenceBreakdown(run);
  return <section className="confidence-provenance" aria-label="Diagnosis confidence provenance">
    <div><span><ShieldCheck size={17}/><strong>{confidence.label} confidence</strong></span><span><b>{confidence.matched}/3 signals corroborated</b><small className="confidence-score">heuristic {confidence.score.toFixed(2)}</small></span></div>
    <div className="confidence-signals">{confidence.signals.map((signal) => <span className={signal.matched ? "matched" : ""} key={signal.label}>{signal.matched ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}<span><strong>{signal.label}</strong><small>{signal.detail}</small></span></span>)}</div>
    <small className="confidence-formula">Heuristic evidence indicator, not a statistical probability.</small>
  </section>;
}

function Explanation({ run, openProof }) {
  const issues = run.remediation?.role === "after" ? [] : [{ title: run.scenario, copy: run.summary, label: run.scenario === "Tool failure" ? "Root cause" : "Contributing", kind: run.scenario === "Tool failure" ? "danger" : "warn" }];
  if (run.retrieval < 0.3 && run.scenario !== "Retrieval miss") issues.push({ title: "Retrieval miss", copy: `Mean score ${run.retrieval.toFixed(2)} is below the 0.30 quality threshold.`, label: "Contributing", kind: "warn" });
  if (run.tokens > 12000 && run.scenario !== "Token spike") issues.push({ title: "Token spike", copy: `${run.tokens.toLocaleString()} tokens exceeds the 12k run budget.`, label: "Contributing", kind: "warn" });
  return <div className="explanation"><div className="explanation-head"><span>Deterministic telemetry diagnosis</span><span>Auditable evidence</span></div><ConfidenceProvenance run={run}/><div className="evidence-boundary"><span><Database size={14}/><strong>Observed facts</strong><small>Trace, metric, and correlated log</small></span><ArrowRight size={14}/><span><ShieldCheck size={14}/><strong>Rule interpretation</strong><small>No LLM in the decision path</small></span></div><EvidenceList run={run}/>{issues.map((issue) => <div className="finding" key={issue.title}>{issue.kind === "danger" ? <XCircle className="danger" size={18}/> : <AlertTriangle className="warn" size={18}/>}<span><strong>{issue.title}</strong><p>{issue.copy}</p></span><b className={issue.kind}>{issue.label}</b></div>)}<div className="explanation-actions"><details><summary><ChevronRight size={16}/>Recommended actions</summary><ul>{run.nextActions.map((action) => <li key={action}>{action}</li>)}</ul></details><button className="secondary" onClick={openProof}><RadioTower size={15}/>View SigNoz proof</button></div></div>;
}

function Comparison({ run }) {
  const baseline = run.baseline;
  if (!baseline) return <div className="comparison-empty"><GitCompareArrows size={22}/><strong>No healthy baseline available</strong><p>Record a successful peer run to unlock regression comparison.</p></div>;
  const rows = [
    ["Latency", `${run.latency.toFixed(2)}s`, `${baseline.latency.toFixed(2)}s`, percentDelta(run.latency, baseline.latency), run.latency > baseline.latency * 1.5 ? "danger" : "ok"],
    ["Tokens", run.tokens.toLocaleString(), baseline.tokens.toLocaleString(), percentDelta(run.tokens, baseline.tokens), run.tokens > baseline.tokens * 2 ? "warn" : "ok"],
    ["Retrieval", run.retrieval.toFixed(2), baseline.retrieval.toFixed(2), percentDelta(run.retrieval, baseline.retrieval), run.retrieval < baseline.retrieval * 0.6 ? "danger" : "ok"],
    ["Estimated cost", `${run.cost.toFixed(3)}`, `${baseline.cost.toFixed(3)}`, percentDelta(run.cost, baseline.cost), run.cost > baseline.cost * 2 ? "warn" : "ok"]
  ];
  const divergentSpan = run.spans.find((span) => ["error", "warn"].includes(span.status));
  const observed = baseline.kind === "observed";
  return <div className="comparison"><header><span><GitCompareArrows size={16}/><strong>Current run vs {observed ? "observed healthy baseline" : "deterministic reference"}</strong></span><small>{baseline.sampleSize} {observed ? "healthy workspace runs" : "versioned reference samples"} · {baseline.windowLabel}</small></header><div className={`baseline-provenance ${observed ? "observed" : "reference"}`}><span><Database size={14}/><strong>{observed ? "Observed telemetry" : "Reference data"}</strong></span><span>Source: {baseline.source}</span>{baseline.fallbackReason && <small>{baseline.fallbackReason}</small>}</div><div className="comparison-row head"><span>Signal</span><span>Current</span><span>Baseline</span><span>Delta</span></div>{rows.map(([label, current, reference, delta, kind]) => <div className="comparison-row" key={label}><strong>{label}</strong><span>{current}</span><span>{reference}</span><b className={kind}>{delta}</b></div>)}{divergentSpan && <div className="divergence"><Target size={16}/><span><strong>First divergent span</strong><code>{divergentSpan.name}</code><small>{divergentSpan.status} / {divergentSpan.duration.toFixed(2)}s / {divergentSpan.id || "span ID in SigNoz"}</small></span></div>}</div>;
}

function Remediation({ run, onApply, busy, error }) {
  const [action, setAction] = useState(run.nextActions[0] ?? "Apply the recommended telemetry remediation.");
  useEffect(() => { setAction(run.nextActions[0] ?? "Apply the recommended telemetry remediation."); }, [run.id]);
  const record = run.remediation;
  if (record?.role === "after") {
    const before = record.before_snapshot;
    const rows = [
      ["Latency", `${Number(before.latency).toFixed(2)}s`, `${run.latency.toFixed(2)}s`, run.latency < Number(before.latency)],
      ["Tokens", Number(before.tokens).toLocaleString(), run.tokens.toLocaleString(), run.tokens < Number(before.tokens)],
      ["Retrieval", Number(before.retrieval).toFixed(2), run.retrieval.toFixed(2), run.retrieval >= Number(before.retrieval)],
      ["Cost", `$${Number(before.cost).toFixed(3)}`, `$${run.cost.toFixed(3)}`, run.cost <= Number(before.cost)]
    ];
    return <div className="remediation"><div className="remediation-status"><CheckCircle2 size={20}/><span><strong>Remediation verified</strong><small>{record.action}</small></span><b>Guardrails passed</b></div><div className="verification-grid"><div className="head"><span>Signal</span><span>Before</span><span>After</span><span>Result</span></div>{rows.map(([label, beforeValue, afterValue, improved]) => <div key={label}><strong>{label}</strong><span>{beforeValue}</span><span>{afterValue}</span><b className={improved ? "ok" : "warn"}>{improved ? "Improved" : "Monitor"}</b></div>)}</div><div className="remediation-lineage"><Fingerprint size={14}/><span>Verified rerun of <code>{record.run_id}</code></span><small>{record.verified_at ? new Date(record.verified_at).toLocaleString() : "Verified now"}</small></div></div>;
  }
  if (record?.role === "before" && record.after_run_id) {
    return <div className="remediation remediation-complete"><CheckCircle2 size={23}/><strong>Remediation verified in a follow-up run</strong><p>{record.action}</p><small>Verification run: {record.after_run_id}</small></div>;
  }
  return <div className="remediation"><div className="remediation-intro"><Wrench size={20}/><span><strong>Close the investigation loop</strong><p>Apply one recommended action and create a correlated verification rerun.</p></span></div><label>Remediation action<select value={action} onChange={(event) => setAction(event.target.value)}>{run.nextActions.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><div className="remediation-preview"><span><small>Before</small><strong>{run.status}</strong></span><ArrowRight size={16}/><span><small>Verification target</small><strong>All guardrails pass</strong></span></div>{error && <div className="inline-error" role="alert"><AlertTriangle size={14}/><span><strong>Verification failed</strong><small>{error}</small></span></div>}<button className="primary" disabled={busy} onClick={() => onApply(action)}>{busy ? <LoaderCircle className="spin" size={16}/> : <Play size={16}/>}Apply and run verification</button></div>;
}
function Inspector({ run, openNote, openProof, notify, alertContext, onRemediate, remediationBusy, remediationError }) {
  const [tab, setTab] = useState(alertContext ? "evidence" : "explain");
  useEffect(() => { if (alertContext) setTab("evidence"); }, [alertContext]);
  if (!run) return <section className="panel empty">Select a run to investigate.</section>;
  const detail = [["Trace ID", run.traceId], ["Agent", run.agent], ["Actor", run.user], ["Environment", "Production"], ["Input tokens", run.inputTokens.toLocaleString()], ["Output tokens", run.outputTokens.toLocaleString()], ["Estimated cost", `${run.cost.toFixed(3)}`], ["Tool calls", run.tools]];
  const anomalySpan = run.spans.find((span) => ["error", "warn"].includes(span.status));
  const metric = metricProvenance(run);
  const provenance = diagnosisProvenance(run);
  const copyTrace = async () => { await navigator.clipboard.writeText(run.traceId); notify("Trace ID copied"); };
  const proofMatchesRun = run.traceId === evidenceBundle.traceId;
  const openRunProof = () => openProof(run);
  return <section className="inspector panel">{alertContext && <><div className="alert-context"><Bell size={14}/><span>Opened from <strong>{alertContext.name}</strong><small>{alertContext.metric} {alertContext.threshold} · observed {alertContext.observed}</small></span></div><div className="investigation-lineage" aria-label="Investigation lineage"><span><small>1 · Alert</small><strong>{alertContext.name}</strong></span><ArrowRight size={13}/><span><small>2 · Breach</small><strong>{alertContext.observed}</strong></span><ArrowRight size={13}/><span><small>3 · Trace</small><code>{run.traceId}</code></span><ArrowRight size={13}/><span><small>4 · Decision</small><strong>{run.scenario}</strong></span></div></>}<div className="inspector-title"><span className={`incident ${tone(run.status)}`}>{run.status === "failed" ? <X size={14}/> : <Check size={14}/>}</span><strong>{run.id}</strong><span>{run.agent}</span><span className={`status ${tone(run.status)}`}><i/>{run.status}</span><time>{run.startTime}</time></div><div className="tabs">{[["explain", "Explain"], ["evidence", "Evidence"], ["compare", "Compare"], ["remediate", "Remediate"], ["details", "Details"], ["metrics", "Metrics"], ["events", "Events"]].map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}<button className="note" onClick={openNote}><FileText size={15}/>Note</button></div>{tab === "explain" && <Explanation run={run} openProof={openRunProof}/>} {tab === "evidence" && <div className="evidence-tab"><div className="trace-strip"><span><small>Correlated trace</small><code>{run.traceId}</code></span><button aria-label="Copy trace ID" className="icon-button" onClick={copyTrace}><Copy size={15}/></button></div><div className="provenance-grid"><span><small>Source</small><strong>{run.attributes?.evidence_source ?? "SigNoz / OpenTelemetry"}</strong></span><span><small>Captured</small><strong>{formatCapturedAt(run)}</strong></span><span><small>Span ID</small><code>{anomalySpan?.id || "Available in trace query"}</code></span><span><small>Metric query</small><code>{metric.query}</code></span><span><small>Rule ID</small><code>{provenance.ruleId}</code></span><span><small>Rule version</small><code>{provenance.ruleVersion}</code></span><span><small>Decision engine</small><strong>{provenance.engine}</strong></span><span><small>LLM involvement</small><strong>{provenance.model}</strong></span><span><small>Prompt version</small><strong>{provenance.promptVersion}</strong></span><span><small>Evidence contract</small><code>trace + metric + log</code></span></div><EvidenceList run={run}/><button className="secondary full-width" onClick={openRunProof}><RadioTower size={15}/>{proofMatchesRun ? "Inspect matching SigNoz execution" : "Inspect canonical SigNoz reference capture"}</button></div>} {tab === "compare" && <Comparison run={run}/>} {tab === "remediate" && <Remediation run={run} onApply={onRemediate} busy={remediationBusy} error={remediationError}/>} {tab === "details" && <div className="detail-grid">{detail.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>} {tab === "metrics" && <div className="metric-strip">{[["Duration", `${run.latency.toFixed(2)}s`, run.latency > 10 ? "danger" : "ok"], ["Tokens", run.tokens.toLocaleString(), run.tokens > 12000 ? "warn" : "ok"], ["Retrieval", run.retrieval.toFixed(2), run.retrieval < 0.3 ? "danger" : "ok"], ["Cost", `${run.cost.toFixed(3)}`, "ok"]].map(([label, value, kind]) => <div key={label}><span>{label}</span><strong className={kind}>{value}</strong></div>)}</div>} {tab === "events" && <div className="events">{run.logs.map((log) => <div key={log.id || log.time + log.message}><time>{log.time}</time><b className={tone(log.level.toLowerCase())}>{log.level}</b><span>{log.message}</span></div>)}</div>}</section>;
}

function Timeline({ run }) {
  const max = Math.max(...run.spans.map((span) => span.start + span.duration), run.latency, 1);
  return <section className="timeline panel"><div className="section-bar"><strong>Span timeline</strong><span>Total duration <b>{run.latency.toFixed(2)}s</b></span></div><div className="axis"><span/><span>0s</span><span>{(max * 0.25).toFixed(1)}s</span><span>{(max * 0.5).toFixed(1)}s</span><span>{(max * 0.75).toFixed(1)}s</span><span>{max.toFixed(1)}s</span></div>{run.spans.map((span) => <div className="span-row" key={span.id || span.name}><span><ChevronRight size={13}/>{span.name}<small>{span.service}</small></span><div className="track"><i className={tone(span.status)} style={{ left: `${span.start / max * 100}%`, width: `${Math.max(span.duration / max * 100, 2)}%` }}><em>{span.duration.toFixed(2)}s</em></i></div></div>)}</section>;
}

function Logs({ run, notify }) {
  const [level, setLevel] = useState("all");
  const [service, setService] = useState("all");
  const [query, setQuery] = useState("");
  const [paused, setPaused] = useState(false);
  const services = [...new Set(run.logs.map((log) => log.service))];
  const visible = run.logs.filter((log) => (level === "all" || log.level === level) && (service === "all" || log.service === service) && `${log.service} ${log.message}`.toLowerCase().includes(query.toLowerCase()));
  const download = () => {
    const text = visible.map((log) => `${log.time} ${log.level} ${log.service} ${log.message}`).join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${run.id}-correlated-logs.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Correlated logs exported");
  };
  return <section className="logs panel"><div className="section-bar"><strong>Correlated logs</strong><select aria-label="Filter log level" value={level} onChange={(event) => setLevel(event.target.value)}><option value="all">All levels</option>{[...new Set(run.logs.map((log) => log.level))].map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter log service" value={service} onChange={(event) => setService(event.target.value)}><option value="all">All services</option>{services.map((item) => <option key={item}>{item}</option>)}</select><label><Search size={14}/><input aria-label="Search correlated logs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search logs..."/></label><span className={paused ? "paused" : "streaming"}>{paused ? "Paused" : "Streaming"}<i/></span><button aria-label={paused ? "Resume log stream" : "Pause log stream"} className="icon-button" onClick={() => setPaused(!paused)}>{paused ? <Play size={15}/> : <Pause size={15}/>}</button><button aria-label="Export logs" className="icon-button" onClick={download}><Download size={15}/></button></div><div className="log-row head"><span>Time</span><span>Level</span><span>Service</span><span>Message</span></div>{visible.map((log) => <div className="log-row" key={log.id || log.time + log.message}><time>{log.time}</time><b className={tone(log.level.toLowerCase())}>{log.level}</b><span>{log.service}</span><span>{log.message}</span></div>)}{!visible.length && <div className="empty log-empty">No correlated logs match this filter.</div>}</section>;
}

function RunsView({ runs, setRuns, workspace, notify, preview, query, setQuery, filters, openProof, targetRunId, alertContext }) {
  const [selectedId, setSelectedId] = useState(runs[0]?.id);
  const [busy, setBusy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [remediationError, setRemediationError] = useState(null);
  const filtered = useMemo(() => runs.filter((run) => `${run.id} ${run.traceId} ${run.agent} ${run.scenario} ${run.user}`.toLowerCase().includes(query.toLowerCase()) && (filters.status === "all" || run.status === filters.status) && (filters.agent === "all" || run.agent === filters.agent)), [runs, query, filters]);
  const selected = filtered.find((run) => run.id === selectedId) || filtered[0] || null;
  useEffect(() => { if (targetRunId) setSelectedId(targetRunId); }, [targetRunId]);
  useEffect(() => { if (selected && selected.id !== selectedId) setSelectedId(selected.id); }, [selected, selectedId]);
  useEffect(() => {
    if (!noteOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") setNoteOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [noteOpen]);
  const refresh = async () => { setBusy(true); try { setRuns(await listRuns(workspace.id, preview)); notify("Runs refreshed"); } catch (error) { notify(error.message, "error"); } finally { setBusy(false); } };
  const create = async (scenario) => { setBusy(true); try { const made = await createDemoRun(scenario, preview); const next = supabase && !preview ? await listRuns(workspace.id, false) : [made, ...runs.filter((run) => run.id !== made.id)]; setRuns(next); setSelectedId(supabase && !preview ? next[0].id : made.id); notify("Demo run created and correlated"); } catch (error) { notify(error.message, "error"); } finally { setBusy(false); } };
  const showNote = async () => { try { setNote(await getNote(selected.databaseId || selected.id, preview)); setNoteOpen(true); } catch (error) { notify(error.message, "error"); } };
  const persistNote = async () => { try { await saveNote(selected.databaseId || selected.id, note, preview); setNoteOpen(false); notify("Investigation note saved"); } catch (error) { notify(error.message, "error"); } };
  const remediate = async (action) => {
    setBusy(true);
    setRemediationError(null);
    try {
      const result = await applyRemediation(selected, action, preview);
      if (supabase && !preview) {
        const next = await listRuns(workspace.id, false);
        setRuns(next);
        setSelectedId(next.find((run) => run.databaseId === result)?.id ?? next[0]?.id);
      } else {
        const before = { ...selected, remediation: { ...result.remediation, role: "before", after_run_id: result.id } };
        setRuns([result, ...runs.filter((run) => run.id !== selected.id).concat(before)]);
        setSelectedId(result.id);
      }
      notify("Remediation applied and verification rerun passed");
    } catch (error) {
      setRemediationError(error.message || "Verification rerun failed.");
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  };
  if (!runs.length) return <><div className="page-heading"><div><h1><Play size={21}/>Agent runs</h1><p>No telemetry has reached this workspace yet.</p></div><ScenarioMenu create={create} busy={busy}/></div><section className="panel recover-state"><Database size={26}/><strong>No runs recorded</strong><p>Create a demo run to verify ingestion, or retry after your OpenTelemetry pipeline has exported data.</p><button className="secondary" onClick={refresh} disabled={busy}><RefreshCw className={busy ? "spin" : ""} size={16}/>Retry ingestion</button></section></>;
  return <><div className="page-heading"><div><h1><Play size={21}/>Agent runs</h1><p>Prove root cause across correlated traces, metrics, and logs.</p></div><ScenarioMenu create={create} busy={busy}/></div><div className="workbench"><RunList runs={filtered} selected={selected} select={setSelectedId} query={query} setQuery={setQuery} refresh={refresh} busy={busy}/><Inspector run={selected} openNote={showNote} openProof={openProof} notify={notify} alertContext={selected?.id === targetRunId ? alertContext : null} onRemediate={remediate} remediationBusy={busy} remediationError={remediationError}/></div>{selected && <><Timeline run={selected}/><Logs run={selected} notify={notify}/></>}{noteOpen && <div className="modal-backdrop" onMouseDown={() => setNoteOpen(false)}><div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div><h2>Investigation note</h2><button aria-label="Close note" className="icon-button" onClick={() => setNoteOpen(false)}><X size={18}/></button></div><p>Capture context and handoff details for <b>{selected.id}</b>.</p><textarea aria-label="Investigation note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="What did you find? What should happen next?" autoFocus/><footer><button className="secondary" onClick={() => setNoteOpen(false)}>Cancel</button><button className="primary" onClick={persistNote}>Save note</button></footer></div></div>}</>;
}

function Overview({ runs, alerts, openRuns, openRun, openProof, preview }) {
  const successRate = runs.filter((run) => run.status === "completed").length / Math.max(runs.length, 1) * 100;
  const sortedLatency = [...runs].map((run) => run.latency).sort((a, b) => a - b);
  const p95 = sortedLatency[Math.max(0, Math.ceil(sortedLatency.length * 0.95) - 1)] || 0;
  const toolReliability = runs.filter((run) => !run.spans.some((span) => span.status === "error")).length / Math.max(runs.length, 1) * 100;
  const tokenCompliance = runs.filter((run) => run.tokens <= 12000).length / Math.max(runs.length, 1) * 100;
  const retrievalCompliance = runs.filter((run) => run.retrieval >= 0.3).length / Math.max(runs.length, 1) * 100;
  const activeIssues = runs.filter((run) => runGuardrailState(run, alerts) === "active");
  const resolvedRuns = runs.filter((run) => runGuardrailState(run, alerts) === "resolved");
  const slos = [
    ["Run success", `${successRate.toFixed(0)}%`, "Target >= 99%", successRate >= 99 ? "ok" : "danger"],
    ["p95 latency", `${p95.toFixed(2)}s`, "Target < 10s", p95 < 10 ? "ok" : "danger"],
    ["Tool reliability", `${toolReliability.toFixed(0)}%`, "Target >= 99.5%", toolReliability >= 99.5 ? "ok" : "danger"],
    ["Token compliance", `${tokenCompliance.toFixed(0)}%`, "Budget <= 12k", tokenCompliance === 100 ? "ok" : "warn"],
    ["Retrieval quality", `${retrievalCompliance.toFixed(0)}%`, "Score >= 0.30", retrievalCompliance === 100 ? "ok" : "warn"]
  ];
  const rows = (items, resolved = false) => items.map((run) => <button key={run.id} onClick={() => openRun(run)}><span className={`incident ${resolved ? "ok" : "warn"}`}>{resolved ? <Check size={14}/> : <AlertTriangle size={14}/>}</span><span><strong>{run.scenario}</strong><small>{run.agent} / {run.id}</small></span><span className={`status ${resolved ? "ok" : "warn"}`}><i/>{resolved ? "verified" : "breached"}</span><time>{run.startTime}</time><ChevronRight size={15}/></button>);
  return <><div className="page-heading"><div><h1><LayoutDashboard size={21}/>Operational SLOs</h1><p>Guardrail health across the same traces, metrics, and logs used in investigations.</p></div><div className="heading-actions"><button className="secondary" onClick={openProof}><RadioTower size={15}/>SigNoz proof</button><button className="primary" onClick={openRuns}>Investigate runs<ChevronRight size={16}/></button></div></div><section className="slo-band panel"><div className="section-bar"><strong>{preview ? "Deterministic judge dataset" : "Last 24 hours"}</strong><span><RadioTower size={13}/>{preview ? "Ephemeral reference telemetry · resets on refresh" : "OpenTelemetry-derived workspace data"}</span></div><div className="slo-grid">{slos.map(([label, value, target, kind]) => <div key={label}><span><i className={kind}/>{label}</span><strong className={kind}>{value}</strong><small>{target}</small></div>)}</div></section><section className="overview-list panel"><div className="section-bar"><strong>Active guardrail breaches</strong><span>{activeIssues.length} affected run{activeIssues.length === 1 ? "" : "s"}</span><button onClick={openRuns}>View all<ChevronRight size={14}/></button></div>{activeIssues.length ? rows(activeIssues) : <div className="empty"><CheckCircle2 size={20}/>No active guardrail breaches.</div>}</section>{resolvedRuns.length > 0 && <section className="overview-list panel resolved-list"><div className="section-bar"><strong>Resolved by verification</strong><span>{resolvedRuns.length} verified rerun{resolvedRuns.length === 1 ? "" : "s"}</span></div>{rows(resolvedRuns, true)}</section>}</>;
}
function AlertsView({ alerts, setAlerts, notify, preview, openProof, onInvestigate, runs }) {
  const change = async (alert) => { const enabled = !alert.enabled; setAlerts((items) => items.map((item) => item.id === alert.id ? { ...item, enabled } : item)); try { await toggleAlert(alert.id, enabled, preview); notify(enabled ? "Alert enabled" : "Alert paused"); } catch (error) { notify(error.message, "error"); } };
  return <><div className="page-heading"><div><h1><Bell size={21}/>Alerts</h1><p>Guardrails derived from the same telemetry used during investigation.</p></div><button className="secondary" onClick={openProof}><RadioTower size={15}/>View deployed rules</button></div><section className="alerts-table panel"><div className="alert-row head"><span>Rule</span><span>Metric</span><span>Threshold</span><span>Severity</span><span>State</span><span>Affected</span><span/></div>{alerts.map((alert) => { const affected = affectedRunsForAlert(alert, runs); const strongest = affected[0]; return <div className="alert-row" key={alert.id}><span><strong>{alert.name}</strong><small>Evaluates every minute</small></span><code>{alert.metric}</code><span className="alert-threshold"><strong>{alert.threshold}</strong><small>{strongest?.evaluation.displayValue ?? "No breach"}</small></span><span className={tone(alert.severity)}>{alert.severity}</span><span>{alert.enabled ? "Enabled" : "Paused"}</span><span>{affected.length} run{affected.length === 1 ? "" : "s"}</span><span className="alert-actions"><button className="alert-investigate" disabled={!affected.length} onClick={() => onInvestigate({ ...alert, observed: strongest.evaluation.displayValue }, strongest.run)}>Investigate<ArrowRight size={13}/></button><button aria-label={`${alert.enabled ? "Pause" : "Enable"} ${alert.name}`} className={`toggle ${alert.enabled ? "on" : ""}`} onClick={() => change(alert)}><i/></button></span></div>; })}</section></>;
}

function TeamView({ user, workspace, preview }) {
  return <><div className="page-heading"><div><h1><Users size={21}/>Team</h1><p>Workspace access and investigation ownership.</p></div></div><section className="team-table panel"><div className="team-row head"><span>Member</span><span>Role</span><span>Access</span></div><div className="team-row"><span><b className="avatar">{initials(user)}</b><span><strong>{preview ? "Track 1 Judge" : user?.user_metadata?.full_name || "Demo User"}</strong><small>{preview ? "judge-demo@agentscope.dev" : user?.email}</small></span></span><span>{preview ? "judge" : workspace.role}</span><span><ShieldCheck size={16}/>{preview ? "Demo workspace" : "Full workspace"}</span></div></section></>;
}

function ProofModal({ close, run }) {
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);
  const matchesRun = !run || run.traceId === evidenceBundle.traceId;
  const proofTitle = run ? (matchesRun ? "Matching SigNoz execution evidence" : "Canonical SigNoz reference evidence") : "SigNoz execution evidence";
  const proofSubtitle = run && !matchesRun ? "This capture is a reference artifact and does not claim to match the selected ephemeral run." : "Captured from the reproducible Foundry stack, not mocked UI.";
  const proofs = [
    ["Failing trace", "/evidence/failing-trace-live.png", `Real tool.search_docs error on trace ${evidenceBundle.traceId}.`],
    ["Native dashboard", "/evidence/dashboard-live.png", "Metrics, traces, and logs from the same OTLP pipeline."],
    ["Deployed alerts", "/evidence/alerts-live.png", "Four Terraform-managed SigNoz guardrails."]
  ];
  return <div className="modal-backdrop proof-backdrop" onMouseDown={close}><section className="proof-modal" role="dialog" aria-modal="true" aria-labelledby="proof-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="proof-mark"><RadioTower size={18}/></span><span><h2 id="proof-title">{proofTitle}</h2><p>{proofSubtitle}</p></span></div><button aria-label="Close SigNoz evidence" className="icon-button" autoFocus onClick={close}><X size={18}/></button></header>{run && <div className={`proof-context ${matchesRun ? "match" : "reference"}`}><span><small>Selected run</small><code>{run.traceId}</code></span><ArrowRight size={14}/><span><small>{matchesRun ? "Matching capture" : "Canonical reference"}</small><code>{evidenceBundle.traceId}</code></span><strong>{matchesRun ? "Trace identity verified" : "Trace IDs differ"}</strong></div>}<div className="proof-facts"><span><CheckCircle2 size={15}/>14 spans</span><span><CheckCircle2 size={15}/>8 correlated logs</span><span><CheckCircle2 size={15}/>All custom metrics</span><span><CheckCircle2 size={15}/>4 alert rules</span><span><CheckCircle2 size={15}/>MCP verified</span><span><CheckCircle2 size={15}/>Foundry locked</span></div><div className="proof-provenance"><span><small>Captured</small><strong>{formatCapturedAt({ capturedAt: evidenceBundle.capturedAt })}</strong></span><span><small>Evidence trace</small><code>{evidenceBundle.traceId}</code></span><span><small>Revision</small><code>{evidenceBundle.revision}</code></span><span><small>Scope</small><strong>{evidenceBundle.contract}</strong></span></div><div className="proof-grid">{proofs.map(([title, src, copy]) => <a href={src} target="_blank" rel="noreferrer" key={title}><img src={src} alt={`${title} in SigNoz`}/><span><strong>{title}</strong><p>{copy}</p><ExternalLink size={14}/></span></a>)}</div><div className="proof-links"><a href="https://github.com/phanixdev/agentscope-sidekick/blob/main/output/telemetry/mcp-failing-trace.json" target="_blank" rel="noreferrer"><Fingerprint size={15}/><span><strong>Raw trace query</strong><small>SigNoz MCP response</small></span><ExternalLink size={13}/></a><a href="https://github.com/phanixdev/agentscope-sidekick/blob/main/output/telemetry/signoz-api-metric-proof.json" target="_blank" rel="noreferrer"><Gauge size={15}/><span><strong>Metric query</strong><small>SigNoz API response</small></span><ExternalLink size={13}/></a><a href="https://github.com/phanixdev/agentscope-sidekick/blob/main/output/telemetry/terraform-alerts-apply.txt" target="_blank" rel="noreferrer"><FileText size={15}/><span><strong>Alert deployment</strong><small>Terraform apply output</small></span><ExternalLink size={13}/></a></div><footer><div><Database size={16}/><span><strong>Reproducible deployment</strong><small>Foundry casting, SigNoz MCP, Terraform, and saved query evidence are committed.</small></span></div><a className="primary" href="https://github.com/phanixdev/agentscope-sidekick#full-signoz-stack" target="_blank" rel="noreferrer">Inspect implementation<ExternalLink size={14}/></a></footer></section></div>;
}

function WorkspaceFailure({ error, retry, preview }) {
  const offline = !navigator.onLine;
  return <section className="panel recover-state workspace-failure" role="alert"><AlertTriangle size={27}/><strong>{offline ? "Network unavailable" : "Workspace telemetry unavailable"}</strong><p>{offline ? "Reconnect to the network, then retry this workspace." : "The data source did not respond. Your session and existing telemetry were not modified."}</p><code>{error || "Unknown workspace error"}</code><div><button className="primary" onClick={retry}><RefreshCw size={16}/>Retry</button>{!preview && <button className="secondary" onClick={() => window.location.assign("/?demo=1")}><Eye size={16}/>Open judge demo</button>}</div></section>;
}
function Product({ user, preview }) {
  const [workspace, setWorkspace] = useState({ id: "preview", name: "Track 1 Judge Workspace", environment: "Production", role: "judge" });
  const [runs, setRuns] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [view, setView] = useState("runs");
  const [loading, setLoading] = useState(true);
  const [loadSlow, setLoadSlow] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ status: "all", agent: "all" });
  const [proofContext, setProofContext] = useState(null);
  const [investigation, setInvestigation] = useState(null);
  const notify = (message, kind = "success") => { setToast({ message, kind }); window.setTimeout(() => setToast(null), 3200); };
  const openProof = (run = null) => setProofContext({ run });
  const changeView = (next) => { setView(next); if (next !== "runs") setInvestigation(null); };
  const openAlertInvestigation = (alert, run) => {
    if (!run) return;
    setInvestigation({ runId: run.id, alert });
    setQuery("");
    setFilters({ status: "all", agent: "all" });
    setView("runs");
    notify(`Opened ${run.id} from ${alert.name}`);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadSlow(false);
    setLoadError(null);
    const slowTimer = window.setTimeout(() => { if (active) setLoadSlow(true); }, 2000);
    (async () => {
      try {
        const nextWorkspace = await getWorkspace(preview);
        const [nextRuns, nextAlerts] = await Promise.all([listRuns(nextWorkspace.id, preview), listAlerts(nextWorkspace.id, preview)]);
        if (active) { setWorkspace(nextWorkspace); setRuns(nextRuns); setAlerts(nextAlerts); }
      } catch (error) {
        if (active) setLoadError(error.message || "Unable to load workspace telemetry.");
      } finally {
        window.clearTimeout(slowTimer);
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; window.clearTimeout(slowTimer); };
  }, [preview, reloadToken]);

  const activeAlertCount = alerts.filter((alert) => alert.enabled && affectedRunsForAlert(alert, runs).length > 0).length;

  return <main className="app-shell"><Sidebar view={view} setView={changeView} workspace={workspace} open={mobile} close={() => setMobile(false)} runs={runs} filters={filters} setFilters={setFilters} setQuery={setQuery} query={query} alertCount={activeAlertCount} preview={preview}/>{mobile && <div className="scrim" onClick={() => setMobile(false)}/>}<div className="workspace"><Topbar user={user} preview={preview} workspace={workspace} openMenu={() => setMobile(true)} menuOpen={mobile} query={query} setQuery={setQuery} openProof={() => openProof()} showRuns={() => { setView("runs"); setInvestigation(null); }}/><div className="content">{loading ? <div className="loading" role="status"><LoaderCircle className="spin" size={26}/><span>{loadSlow ? "Telemetry is taking longer than expected..." : "Loading workspace telemetry..."}</span></div> : loadError ? <WorkspaceFailure error={loadError} preview={preview} retry={() => setReloadToken((value) => value + 1)}/> : view === "overview" ? <Overview runs={runs} alerts={alerts} openRuns={() => { setView("runs"); setInvestigation(null); }} openRun={(run) => { setView("runs"); setInvestigation({ runId: run.id, alert: null }); }} openProof={() => openProof()} preview={preview}/> : view === "alerts" ? <AlertsView alerts={alerts} setAlerts={setAlerts} notify={notify} preview={preview} openProof={() => openProof()} onInvestigate={openAlertInvestigation} runs={runs}/> : view === "team" ? <TeamView user={user} workspace={workspace} preview={preview}/> : <RunsView runs={runs} setRuns={setRuns} workspace={workspace} notify={notify} preview={preview} query={query} setQuery={setQuery} filters={filters} openProof={openProof} targetRunId={investigation?.runId} alertContext={investigation?.alert}/>}</div></div>{proofContext && <ProofModal run={proofContext.run} close={() => setProofContext(null)}/>} {toast && <div className={`toast ${toast.kind}`} role="status"><CheckCircle2 size={17}/>{toast.message}</div>}</main>;
}

function Root() {
  const judgeMode = new URLSearchParams(window.location.search).get("demo") === "1";
  const [session, setSession] = useState(null);
  const [preview, setPreview] = useState(!supabase || judgeMode);
  const [checking, setChecking] = useState(Boolean(supabase && !judgeMode));
  useEffect(() => {
    if (!supabase || judgeMode) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [judgeMode]);
  if (checking) return <main className="boot"><Activity size={28}/><span>AgentScope Sidekick</span><LoaderCircle className="spin" size={18}/></main>;
  if (!session && !preview) return <AuthScreen onPreview={() => setPreview(true)}/>;
  return <Product user={session?.user} preview={!session || preview}/>;
}

createRoot(document.getElementById("root")).render(<Root/>);
