import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, AlertTriangle, Bell, Bot, Check, CheckCircle2, ChevronDown,
  ChevronRight, CircleDot, Copy, Database, Download, ExternalLink, FileText,
  Fingerprint, Gauge, LayoutDashboard, LoaderCircle, LogOut, Menu, Pause,
  Play, RadioTower, RefreshCw, Search, ShieldCheck, Terminal, Users, X, XCircle
} from "lucide-react";
import { AuthScreen } from "./components/AuthScreen";
import { supabase } from "./lib/supabase";
import {
  createDemoRun, getNote, getWorkspace, listAlerts, listRuns, saveNote, toggleAlert
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

function confidenceFor(run) {
  const signals = evidenceFor(run);
  const anomalies = signals.filter((signal) => signal.kind !== "ok").length;
  const traceBonus = run.traceId ? 0.04 : 0;
  return Math.min(0.96, 0.78 + anomalies * 0.04 + traceBonus);
}

function Sidebar({ view, setView, workspace, open, close, runs, filters, setFilters, alertCount }) {
  const nav = [
    ["overview", LayoutDashboard, "Overview"],
    ["runs", Bot, "Agent runs"],
    ["alerts", Bell, "Alerts"],
    ["team", Users, "Team"]
  ];
  const agents = [...new Set(runs.map((run) => run.agent))];
  const reset = () => setFilters({ status: "all", agent: "all" });

  return <aside className={`sidebar ${open ? "open" : ""}`}>
    <div className="brand"><span><Activity size={18}/></span>AgentScope Sidekick<button aria-label="Close navigation" className="mobile-close icon-button" onClick={close}><X size={18}/></button></div>
    <div className="workspace-picker"><b>{workspace.name.slice(0, 2).toUpperCase()}</b><span><strong>{workspace.name}</strong><small>{workspace.environment}</small></span></div>
    <nav>{nav.map(([id, Icon, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => { setView(id); close(); }}><Icon size={17}/>{label}{id === "alerts" && <b>{alertCount}</b>}</button>)}</nav>
    {view === "runs" && <div className="filters">
      <div><strong>Filters</strong><button onClick={reset} disabled={filters.status === "all" && filters.agent === "all"}>Reset</button></div>
      <label>Status<select aria-label="Filter by status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">All statuses</option><option value="failed">Failed</option><option value="completed">Completed</option></select></label>
      <label>Agent<select aria-label="Filter by agent" value={filters.agent} onChange={(event) => setFilters((current) => ({ ...current, agent: event.target.value }))}><option value="all">All agents</option>{agents.map((agent) => <option value={agent} key={agent}>{agent}</option>)}</select></label>
      <div className="filter-summary"><RadioTower size={14}/><span>Production · last 24 hours</span></div>
    </div>}
  </aside>;
}

function Topbar({ user, preview, workspace, openMenu, query, setQuery, openProof, showRuns }) {
  const [menu, setMenu] = useState(false);
  const signOut = async () => supabase && !preview ? supabase.auth.signOut() : window.location.reload();
  const displayName = preview ? "Track 1 Judge" : user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Demo User";

  return <header className="topbar">
    <button aria-label="Open navigation" className="mobile-menu icon-button" onClick={openMenu}><Menu size={20}/></button>
    <div className="live"><i/>{preview ? "Judge demo data" : "Workspace telemetry"}</div>
    <button className="source" onClick={openProof}><Terminal size={15}/>SigNoz evidence<ExternalLink size={13}/></button>
    <label className="global-search"><Search size={16}/><input aria-label="Search runs" value={query} onFocus={showRuns} onChange={(event) => { setQuery(event.target.value); showRuns(); }} placeholder="Search runs, agents, traces..."/><kbd>/</kbd></label>
    <div className="account"><button aria-expanded={menu} onClick={() => setMenu(!menu)}><b className="avatar">{initials(user)}</b><span><strong>{displayName}</strong><small>{preview ? "read-only demo" : workspace.role}</small></span><ChevronDown size={14}/></button>{menu && <div><button onClick={signOut}><LogOut size={16}/>{preview ? "Exit demo" : "Sign out"}</button></div>}</div>
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
  return <section className="run-list panel"><div className="table-tools"><label><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter runs..."/></label><button aria-label="Refresh runs" className="icon-button" onClick={refresh} disabled={busy}><RefreshCw className={busy ? "spin" : ""} size={17}/></button></div><div className="run-table"><div className="run-row head"><span>Run ID</span><span>Agent</span><span>Status</span><span>Duration</span><span>Started</span><span/></div>{runs.map((run) => <button className={`run-row ${selected?.id === run.id ? "selected" : ""}`} key={run.id} onClick={() => select(run.id)}><span className="run-key"><CircleDot size={14}/>{run.id}<small>{run.scenario}</small></span><span>{run.agent}<small>{run.user}</small></span><span className={`status ${tone(run.status)}`}><i/>{run.status}</span><span>{run.latency.toFixed(2)}s</span><span>{run.startTime}</span><ChevronRight size={15}/></button>)}{!runs.length && <div className="empty"><Search size={20}/>No runs match these filters.</div>}</div></section>;
}

function EvidenceList({ run }) {
  return <div className="evidence-list">{evidenceFor(run).map((item) => <div key={item.label}><span className={`evidence-icon ${item.kind}`}><Fingerprint size={15}/></span><span><small>{item.label}</small><strong>{item.value}</strong><p>{item.detail}</p></span></div>)}</div>;
}

function Explanation({ run, openProof }) {
  const issues = [{ title: run.scenario, copy: run.summary, label: run.scenario === "Tool failure" ? "Root cause" : "Contributing", kind: run.scenario === "Tool failure" ? "danger" : "warn" }];
  if (run.retrieval < 0.3 && run.scenario !== "Retrieval miss") issues.push({ title: "Retrieval miss", copy: `Mean score ${run.retrieval.toFixed(2)} is below the 0.30 quality threshold.`, label: "Contributing", kind: "warn" });
  if (run.tokens > 12000 && run.scenario !== "Token spike") issues.push({ title: "Token spike", copy: `${run.tokens.toLocaleString()} tokens exceeds the 12k run budget.`, label: "Contributing", kind: "warn" });
  return <div className="explanation"><div className="explanation-head"><span>Deterministic telemetry diagnosis</span><span>Confidence <b>{confidenceFor(run).toFixed(2)}</b></span></div>{issues.map((issue) => <div className="finding" key={issue.title}>{issue.kind === "danger" ? <XCircle className="danger" size={18}/> : <AlertTriangle className="warn" size={18}/>}<span><strong>{issue.title}</strong><p>{issue.copy}</p></span><b className={issue.kind}>{issue.label}</b></div>)}<EvidenceList run={run}/><div className="explanation-actions"><details><summary><ChevronRight size={16}/>Recommended actions</summary><ul>{run.nextActions.map((action) => <li key={action}>{action}</li>)}</ul></details><button className="secondary" onClick={openProof}><RadioTower size={15}/>View SigNoz proof</button></div></div>;
}

function Inspector({ run, openNote, openProof, notify }) {
  const [tab, setTab] = useState("explain");
  if (!run) return <section className="panel empty">Select a run to investigate.</section>;
  const detail = [["Trace ID", run.traceId], ["Agent", run.agent], ["Actor", run.user], ["Environment", "Production"], ["Input tokens", run.inputTokens.toLocaleString()], ["Output tokens", run.outputTokens.toLocaleString()], ["Estimated cost", `$${run.cost.toFixed(3)}`], ["Tool calls", run.tools]];
  const copyTrace = async () => { await navigator.clipboard.writeText(run.traceId); notify("Trace ID copied"); };
  return <section className="inspector panel"><div className="inspector-title"><span className={`incident ${tone(run.status)}`}>{run.status === "failed" ? <X size={14}/> : <Check size={14}/>}</span><strong>{run.id}</strong><span>{run.agent}</span><span className={`status ${tone(run.status)}`}><i/>{run.status}</span><time>{run.startTime}</time></div><div className="tabs">{[["explain", "Explain"], ["evidence", "Evidence"], ["details", "Details"], ["metrics", "Metrics"], ["events", "Events"]].map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}<button className="note" onClick={openNote}><FileText size={15}/>Note</button></div>{tab === "explain" && <Explanation run={run} openProof={openProof}/>} {tab === "evidence" && <div className="evidence-tab"><div className="trace-strip"><span><small>Correlated trace</small><code>{run.traceId}</code></span><button aria-label="Copy trace ID" className="icon-button" onClick={copyTrace}><Copy size={15}/></button></div><EvidenceList run={run}/><button className="secondary full-width" onClick={openProof}><RadioTower size={15}/>Inspect captured SigNoz trace, dashboard, and alerts</button></div>} {tab === "details" && <div className="detail-grid">{detail.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>} {tab === "metrics" && <div className="metric-strip">{[["Duration", `${run.latency.toFixed(2)}s`, run.latency > 10 ? "danger" : "ok"], ["Tokens", run.tokens.toLocaleString(), run.tokens > 12000 ? "warn" : "ok"], ["Retrieval", run.retrieval.toFixed(2), run.retrieval < 0.3 ? "danger" : "ok"], ["Cost", `$${run.cost.toFixed(3)}`, "ok"]].map(([label, value, kind]) => <div key={label}><span>{label}</span><strong className={kind}>{value}</strong></div>)}</div>} {tab === "events" && <div className="events">{run.logs.map((log) => <div key={log.id || log.time + log.message}><time>{log.time}</time><b className={tone(log.level.toLowerCase())}>{log.level}</b><span>{log.message}</span></div>)}</div>}</section>;
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
  return <section className="logs panel"><div className="section-bar"><strong>Correlated logs</strong><select aria-label="Filter log level" value={level} onChange={(event) => setLevel(event.target.value)}><option value="all">All levels</option>{[...new Set(run.logs.map((log) => log.level))].map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter log service" value={service} onChange={(event) => setService(event.target.value)}><option value="all">All services</option>{services.map((item) => <option key={item}>{item}</option>)}</select><label><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search logs..."/></label><span className={paused ? "paused" : "streaming"}>{paused ? "Paused" : "Streaming"}<i/></span><button aria-label={paused ? "Resume log stream" : "Pause log stream"} className="icon-button" onClick={() => setPaused(!paused)}>{paused ? <Play size={15}/> : <Pause size={15}/>}</button><button aria-label="Export logs" className="icon-button" onClick={download}><Download size={15}/></button></div><div className="log-row head"><span>Time</span><span>Level</span><span>Service</span><span>Message</span></div>{visible.map((log) => <div className="log-row" key={log.id || log.time + log.message}><time>{log.time}</time><b className={tone(log.level.toLowerCase())}>{log.level}</b><span>{log.service}</span><span>{log.message}</span></div>)}{!visible.length && <div className="empty log-empty">No correlated logs match this filter.</div>}</section>;
}

function RunsView({ runs, setRuns, workspace, notify, preview, query, setQuery, filters, openProof }) {
  const [selectedId, setSelectedId] = useState(runs[0]?.id);
  const [busy, setBusy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const selected = runs.find((run) => run.id === selectedId) || runs[0];
  const filtered = useMemo(() => runs.filter((run) => `${run.id} ${run.traceId} ${run.agent} ${run.scenario} ${run.user}`.toLowerCase().includes(query.toLowerCase()) && (filters.status === "all" || run.status === filters.status) && (filters.agent === "all" || run.agent === filters.agent)), [runs, query, filters]);
  const refresh = async () => { setBusy(true); try { setRuns(await listRuns(workspace.id, preview)); notify("Runs refreshed"); } catch (error) { notify(error.message, "error"); } finally { setBusy(false); } };
  const create = async (scenario) => { setBusy(true); try { const made = await createDemoRun(scenario, preview); const next = supabase && !preview ? await listRuns(workspace.id, false) : [made, ...runs.filter((run) => run.id !== made.id)]; setRuns(next); setSelectedId(supabase && !preview ? next[0].id : made.id); notify("Demo run created and correlated"); } catch (error) { notify(error.message, "error"); } finally { setBusy(false); } };
  const showNote = async () => { try { setNote(await getNote(selected.databaseId || selected.id, preview)); setNoteOpen(true); } catch (error) { notify(error.message, "error"); } };
  const persistNote = async () => { try { await saveNote(selected.databaseId || selected.id, note, preview); setNoteOpen(false); notify("Investigation note saved"); } catch (error) { notify(error.message, "error"); } };
  if (!selected) return <div className="empty">No runs have been recorded yet.</div>;
  return <><div className="page-heading"><div><h1><Play size={21}/>Agent runs</h1><p>Prove root cause across correlated traces, metrics, and logs.</p></div><ScenarioMenu create={create} busy={busy}/></div><div className="workbench"><RunList runs={filtered} selected={selected} select={setSelectedId} query={query} setQuery={setQuery} refresh={refresh} busy={busy}/><Inspector run={selected} openNote={showNote} openProof={openProof} notify={notify}/></div><Timeline run={selected}/><Logs run={selected} notify={notify}/>{noteOpen && <div className="modal-backdrop" onMouseDown={() => setNoteOpen(false)}><div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div><h2>Investigation note</h2><button aria-label="Close note" className="icon-button" onClick={() => setNoteOpen(false)}><X size={18}/></button></div><p>Capture context and handoff details for <b>{selected.id}</b>.</p><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What did you find? What should happen next?" autoFocus/><footer><button className="secondary" onClick={() => setNoteOpen(false)}>Cancel</button><button className="primary" onClick={persistNote}>Save note</button></footer></div></div>}</>;
}

function Overview({ runs, openRuns, openProof }) {
  const failed = runs.filter((run) => run.status === "failed").length;
  const avg = runs.reduce((sum, run) => sum + run.latency, 0) / Math.max(runs.length, 1);
  const tokens = runs.reduce((sum, run) => sum + run.tokens, 0);
  return <><div className="page-heading"><div><h1><LayoutDashboard size={21}/>Overview</h1><p>Operational health across your AI agent fleet.</p></div><div className="heading-actions"><button className="secondary" onClick={openProof}><RadioTower size={15}/>SigNoz proof</button><button className="primary" onClick={openRuns}>Investigate runs<ChevronRight size={16}/></button></div></div><div className="overview-metrics">{[["Runs observed", runs.length, "Last 24 hours", Activity], ["Failed runs", failed, failed ? "Needs attention" : "Healthy", XCircle], ["Average latency", `${avg.toFixed(2)}s`, "Across all agents", Gauge], ["Total tokens", tokens.toLocaleString(), "Estimated usage", Bot]].map(([label, value, detail, Icon]) => <div key={label}><span><Icon size={17}/>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}</div><section className="overview-list panel"><div className="section-bar"><strong>Recent issues</strong><button onClick={openRuns}>View all<ChevronRight size={14}/></button></div>{runs.map((run) => <button key={run.id} onClick={openRuns}><span className={`incident ${tone(run.status)}`}>{run.status === "failed" ? <X size={14}/> : <AlertTriangle size={14}/>}</span><span><strong>{run.scenario}</strong><small>{run.agent} · {run.id}</small></span><span className={`status ${tone(run.status)}`}><i/>{run.status}</span><time>{run.startTime}</time><ChevronRight size={15}/></button>)}</section></>;
}

function AlertsView({ alerts, setAlerts, notify, preview, openProof }) {
  const change = async (alert) => { const enabled = !alert.enabled; setAlerts((items) => items.map((item) => item.id === alert.id ? { ...item, enabled } : item)); try { await toggleAlert(alert.id, enabled, preview); notify(enabled ? "Alert enabled" : "Alert paused"); } catch (error) { notify(error.message, "error"); } };
  return <><div className="page-heading"><div><h1><Bell size={21}/>Alerts</h1><p>Guardrails derived from the same telemetry used during investigation.</p></div><button className="secondary" onClick={openProof}><RadioTower size={15}/>View deployed rules</button></div><section className="alerts-table panel"><div className="alert-row head"><span>Rule</span><span>Metric</span><span>Threshold</span><span>Severity</span><span>State</span><span/></div>{alerts.map((alert) => <div className="alert-row" key={alert.id}><span><strong>{alert.name}</strong><small>Evaluates every minute</small></span><code>{alert.metric}</code><span>{alert.threshold}</span><span className={tone(alert.severity)}>{alert.severity}</span><span>{alert.enabled ? "Active" : "Paused"}</span><button aria-label={`${alert.enabled ? "Pause" : "Enable"} ${alert.name}`} className={`toggle ${alert.enabled ? "on" : ""}`} onClick={() => change(alert)}><i/></button></div>)}</section></>;
}

function TeamView({ user, workspace, preview }) {
  return <><div className="page-heading"><div><h1><Users size={21}/>Team</h1><p>Workspace access and investigation ownership.</p></div></div><section className="team-table panel"><div className="team-row head"><span>Member</span><span>Role</span><span>Access</span></div><div className="team-row"><span><b className="avatar">{initials(user)}</b><span><strong>{preview ? "Track 1 Judge" : user?.user_metadata?.full_name || "Demo User"}</strong><small>{preview ? "judge-demo@agentscope.dev" : user?.email}</small></span></span><span>{preview ? "judge" : workspace.role}</span><span><ShieldCheck size={16}/>{preview ? "Demo workspace" : "Full workspace"}</span></div></section></>;
}

function ProofModal({ close }) {
  const proofs = [
    ["Failing trace", "/evidence/failing-trace-live.png", "A real tool.search_docs error span correlated by trace ID."],
    ["Native dashboard", "/evidence/dashboard-live.png", "Metrics, traces, and logs from the same OTLP pipeline."],
    ["Deployed alerts", "/evidence/alerts-live.png", "Four Terraform-managed SigNoz guardrails."]
  ];
  return <div className="modal-backdrop proof-backdrop" onMouseDown={close}><section className="proof-modal" role="dialog" aria-modal="true" aria-labelledby="proof-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="proof-mark"><RadioTower size={18}/></span><span><h2 id="proof-title">SigNoz execution evidence</h2><p>Captured from the reproducible Foundry stack, not mocked UI.</p></span></div><button aria-label="Close SigNoz evidence" className="icon-button" onClick={close}><X size={18}/></button></header><div className="proof-facts"><span><CheckCircle2 size={15}/>14 spans</span><span><CheckCircle2 size={15}/>8 correlated logs</span><span><CheckCircle2 size={15}/>All custom metrics</span><span><CheckCircle2 size={15}/>4 alert rules</span></div><div className="proof-grid">{proofs.map(([title, src, copy]) => <a href={src} target="_blank" rel="noreferrer" key={title}><img src={src} alt={`${title} in SigNoz`}/><span><strong>{title}</strong><p>{copy}</p><ExternalLink size={14}/></span></a>)}</div><footer><div><Database size={16}/><span><strong>Reproducible deployment</strong><small>Foundry casting, SigNoz MCP, Terraform, and saved query evidence are committed.</small></span></div><a className="primary" href="https://github.com/phanixdev/agentscope-sidekick#full-signoz-stack" target="_blank" rel="noreferrer">Inspect implementation<ExternalLink size={14}/></a></footer></section></div>;
}

function Product({ user, preview }) {
  const [workspace, setWorkspace] = useState({ id: "preview", name: "Track 1 Judge Workspace", environment: "Production", role: "judge" });
  const [runs, setRuns] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [view, setView] = useState("runs");
  const [loading, setLoading] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ status: "all", agent: "all" });
  const [proofOpen, setProofOpen] = useState(false);
  const notify = (message, kind = "success") => { setToast({ message, kind }); window.setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const nextWorkspace = await getWorkspace(preview);
        const [nextRuns, nextAlerts] = await Promise.all([listRuns(nextWorkspace.id, preview), listAlerts(nextWorkspace.id, preview)]);
        if (active) { setWorkspace(nextWorkspace); setRuns(nextRuns); setAlerts(nextAlerts); }
      } catch (error) {
        notify(error.message, "error");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [preview]);

  return <main className="app-shell"><Sidebar view={view} setView={setView} workspace={workspace} open={mobile} close={() => setMobile(false)} runs={runs} filters={filters} setFilters={setFilters} alertCount={alerts.filter((alert) => alert.enabled).length}/>{mobile && <div className="scrim" onClick={() => setMobile(false)}/>}<div className="workspace"><Topbar user={user} preview={preview} workspace={workspace} openMenu={() => setMobile(true)} query={query} setQuery={setQuery} openProof={() => setProofOpen(true)} showRuns={() => setView("runs")}/><div className="content">{loading ? <div className="loading"><LoaderCircle className="spin" size={26}/>Loading workspace telemetry...</div> : view === "overview" ? <Overview runs={runs} openRuns={() => setView("runs")} openProof={() => setProofOpen(true)}/> : view === "alerts" ? <AlertsView alerts={alerts} setAlerts={setAlerts} notify={notify} preview={preview} openProof={() => setProofOpen(true)}/> : view === "team" ? <TeamView user={user} workspace={workspace} preview={preview}/> : <RunsView runs={runs} setRuns={setRuns} workspace={workspace} notify={notify} preview={preview} query={query} setQuery={setQuery} filters={filters} openProof={() => setProofOpen(true)}/>}</div></div>{proofOpen && <ProofModal close={() => setProofOpen(false)}/>} {toast && <div className={`toast ${toast.kind}`}><CheckCircle2 size={17}/>{toast.message}</div>}</main>;
}

function Root() {
  const judgeMode = new URLSearchParams(window.location.search).get("demo") === "1";
  const [session, setSession] = useState(null);
  const [preview, setPreview] = useState(!supabase || judgeMode);
  const [checking, setChecking] = useState(Boolean(supabase));
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);
  if (checking) return <main className="boot"><Activity size={28}/><span>AgentScope Sidekick</span><LoaderCircle className="spin" size={18}/></main>;
  if (!session && !preview) return <AuthScreen onPreview={() => setPreview(true)}/>;
  return <Product user={session?.user} preview={!session || preview}/>;
}

createRoot(document.getElementById("root")).render(<Root/>);
