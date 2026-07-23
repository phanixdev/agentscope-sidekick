import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, AlertTriangle, Bell, Bot, Check, CheckCircle2, ChevronDown, ChevronRight, CircleDot, Columns3, Download, FileText, Gauge, LayoutDashboard, LoaderCircle, LogOut, Menu, MoreVertical, Pause, Play, Plus, RefreshCw, Search, Settings, ShieldCheck, Terminal, Users, X, XCircle } from "lucide-react";
import { AuthScreen } from "./components/AuthScreen";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { createDemoRun, getNote, getWorkspace, listAlerts, listRuns, saveNote, toggleAlert } from "./lib/runService";
import "./styles.css";

const tone = (value) => ["failed", "error", "critical", "danger"].includes(value) ? "danger" : ["warn", "warning"].includes(value) ? "warn" : "ok";
const initials = (user) => (user?.user_metadata?.full_name || user?.email || "Demo User").split(/[\s@]+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

function Sidebar({ view, setView, workspace, open, close }) {
  const nav = [["overview", LayoutDashboard, "Overview"], ["runs", Bot, "Agent runs"], ["alerts", Bell, "Alerts"], ["team", Users, "Team"]];
  return <aside className={`sidebar ${open ? "open" : ""}`}>
    <div className="brand"><span><Activity size={18}/></span>AgentScope Sidekick<button className="mobile-close icon-button" onClick={close}><X size={18}/></button></div>
    <button className="workspace-picker"><b>{workspace.name.slice(0, 2).toUpperCase()}</b><span><strong>{workspace.name}</strong><small>{workspace.environment}</small></span><ChevronDown size={15}/></button>
    <nav>{nav.map(([id, Icon, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => { setView(id); close(); }}><Icon size={17}/>{label}{id === "alerts" && <b>4</b>}</button>)}</nav>
    {view === "runs" && <div className="filters"><div><strong>Filters</strong><button>Reset</button></div>{[["Time range", "Last 24 hours"], ["Status", "All statuses"], ["Agent", "All agents"], ["Environment", "Production"]].map(([label, value]) => <label key={label}>{label}<select defaultValue={value}><option>{value}</option></select></label>)}</div>}
    <button className="settings-link"><Settings size={17}/>Workspace settings</button>
  </aside>;
}

function Topbar({ user, preview, workspace, openMenu }) {
  const [menu, setMenu] = useState(false);
  const signOut = async () => supabase ? supabase.auth.signOut() : window.location.reload();
  return <header className="topbar">
    <button className="mobile-menu icon-button" onClick={openMenu}><Menu size={20}/></button>
    <div className="live"><i/>{preview ? "Preview data" : "Live telemetry"}</div>
    <button className="source"><Terminal size={15}/>{preview ? "Browser workspace" : "Supabase + SigNoz"}<ChevronDown size={14}/></button>
    <label className="global-search"><Search size={16}/><input placeholder="Search runs, traces, users..."/><kbd>/</kbd></label>
    <button className="icon-button notification"><Bell size={18}/><i/></button>
    <div className="account"><button onClick={() => setMenu(!menu)}><b className="avatar">{initials(user)}</b><span><strong>{user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Demo User"}</strong><small>{workspace.role}</small></span><ChevronDown size={14}/></button>{menu && <div><button onClick={signOut}><LogOut size={16}/>{preview ? "Exit preview" : "Sign out"}</button></div>}</div>
  </header>;
}

function ScenarioMenu({ create, busy }) {
  const [open, setOpen] = useState(false);
  const items = [["tool_failure", XCircle, "Tool failure", "Upstream search returns HTTP 500"], ["retrieval_miss", Search, "Retrieval miss", "Low confidence and source diversity"], ["token_spike", Gauge, "Token spike", "Context expansion exceeds baseline"]];
  return <div className="scenario"><button className="primary" disabled={busy} onClick={() => setOpen(!open)}>{busy ? <LoaderCircle className="spin" size={16}/> : <Play size={16}/>}Create demo run<ChevronDown size={14}/></button>{open && <div className="scenario-popover">{items.map(([id, Icon, title, copy]) => <button key={id} onClick={() => { create(id); setOpen(false); }}><Icon size={17}/><span><strong>{title}</strong><small>{copy}</small></span></button>)}</div>}</div>;
}

function RunList({ runs, selected, select, query, setQuery, refresh }) {
  return <section className="run-list panel"><div className="table-tools"><label><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter runs..."/></label><button className="icon-button"><Columns3 size={17}/></button><button className="icon-button" onClick={refresh}><RefreshCw size={17}/></button></div><div className="run-table"><div className="run-row head"><span>Run ID</span><span>Agent</span><span>Status</span><span>Duration</span><span>Started</span><span/></div>{runs.map((run) => <button className={`run-row ${selected?.id === run.id ? "selected" : ""}`} key={run.id} onClick={() => select(run.id)}><span className="run-key"><CircleDot size={14}/>{run.id}<small>{run.scenario}</small></span><span>{run.agent}<small>{run.user}</small></span><span className={`status ${tone(run.status)}`}><i/>{run.status}</span><span>{run.latency.toFixed(2)}s</span><span>{run.startTime}</span><ChevronRight size={15}/></button>)}{!runs.length && <div className="empty"><Search size={20}/>No runs match this filter.</div>}</div></section>;
}

function Explanation({ run }) {
  const issues = [{ title: run.scenario, copy: run.summary, label: run.scenario === "Tool failure" ? "Root cause" : "Contributing", kind: run.scenario === "Tool failure" ? "danger" : "warn" }];
  if (run.retrieval < .3 && run.scenario !== "Retrieval miss") issues.push({ title: "Retrieval miss", copy: `Mean score ${run.retrieval.toFixed(2)} is below the 0.30 quality threshold.`, label: "Contributing", kind: "warn" });
  if (run.tokens > 12000 && run.scenario !== "Token spike") issues.push({ title: "Token spike", copy: `${run.tokens.toLocaleString()} tokens exceeds the 12k run budget.`, label: "Contributing", kind: "warn" });
  return <div className="explanation"><div className="explanation-head"><span>Telemetry-backed explanation</span><span>Confidence <b>0.92</b></span></div>{issues.map((issue) => <div className="finding" key={issue.title}>{issue.kind === "danger" ? <XCircle className="danger" size={18}/> : <AlertTriangle className="warn" size={18}/>}<span><strong>{issue.title}</strong><p>{issue.copy}</p></span><b className={issue.kind}>{issue.label}</b></div>)}<details><summary><ChevronRight size={16}/>Recommended actions</summary><ul>{run.nextActions.map((action) => <li key={action}>{action}</li>)}</ul></details></div>;
}

function Inspector({ run, openNote }) {
  const [tab, setTab] = useState("explain");
  if (!run) return <section className="panel empty">Select a run to investigate.</section>;
  const detail = [["Trace ID", run.traceId], ["Agent", run.agent], ["Actor", run.user], ["Environment", "Production"], ["Input tokens", run.inputTokens.toLocaleString()], ["Output tokens", run.outputTokens.toLocaleString()], ["Estimated cost", `$${run.cost.toFixed(3)}`], ["Tool calls", run.tools]];
  return <section className="inspector panel"><div className="inspector-title"><span className={`incident ${tone(run.status)}`}>{run.status === "failed" ? <X size={14}/> : <Check size={14}/>}</span><strong>{run.id}</strong><span>{run.agent}</span><span className={`status ${tone(run.status)}`}><i/>{run.status}</span><time>{run.startTime}</time><button className="icon-button"><MoreVertical size={18}/></button></div><div className="tabs">{[["explain", "Explain run"], ["details", "Details"], ["metrics", "Metrics"], ["events", "Events"]].map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}<button className="note" onClick={openNote}><FileText size={15}/>Investigation note</button></div>{tab === "explain" && <Explanation run={run}/>} {tab === "details" && <div className="detail-grid">{detail.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>} {tab === "metrics" && <div className="metric-strip">{[["Duration", `${run.latency.toFixed(2)}s`, run.latency > 10 ? "danger" : "ok"], ["Tokens", run.tokens.toLocaleString(), run.tokens > 12000 ? "warn" : "ok"], ["Retrieval", run.retrieval.toFixed(2), run.retrieval < .3 ? "danger" : "ok"], ["Cost", `$${run.cost.toFixed(3)}`, "ok"]].map(([label, value, kind]) => <div key={label}><span>{label}</span><strong className={kind}>{value}</strong></div>)}</div>} {tab === "events" && <div className="events">{run.logs.map((log) => <div key={log.id || log.time + log.message}><time>{log.time}</time><b className={tone(log.level.toLowerCase())}>{log.level}</b><span>{log.message}</span></div>)}</div>}</section>;
}

function Timeline({ run }) {
  const max = Math.max(...run.spans.map((span) => span.start + span.duration), run.latency, 1);
  return <section className="timeline panel"><div className="section-bar"><strong>Span timeline</strong><span>Total duration <b>{run.latency.toFixed(2)}s</b></span><button className="icon-button"><Search size={16}/></button></div><div className="axis"><span/><span>0s</span><span>{(max * .25).toFixed(1)}s</span><span>{(max * .5).toFixed(1)}s</span><span>{(max * .75).toFixed(1)}s</span><span>{max.toFixed(1)}s</span></div>{run.spans.map((span) => <div className="span-row" key={span.id || span.name}><span><ChevronRight size={13}/>{span.name}<small>{span.service}</small></span><div className="track"><i className={tone(span.status)} style={{ left: `${span.start / max * 100}%`, width: `${Math.max(span.duration / max * 100, 2)}%` }}><em>{span.duration.toFixed(2)}s</em></i></div></div>)}</section>;
}

function Logs({ run }) {
  return <section className="logs panel"><div className="section-bar"><strong>Correlated logs</strong><button>All levels<ChevronDown size={13}/></button><button>All services<ChevronDown size={13}/></button><label><Search size={14}/><input placeholder="Search logs..."/></label><span className="streaming">Streaming <i/></span><button className="icon-button"><Pause size={15}/></button><button className="icon-button"><Download size={15}/></button></div><div className="log-row head"><span>Time</span><span>Level</span><span>Service</span><span>Message</span></div>{run.logs.map((log) => <div className="log-row" key={log.id || log.time + log.message}><time>{log.time}</time><b className={tone(log.level.toLowerCase())}>{log.level}</b><span>{log.service}</span><span>{log.message}</span></div>)}</section>;
}

function RunsView({ runs, setRuns, workspace, notify }) {
  const [selectedId, setSelectedId] = useState(runs[0]?.id), [query, setQuery] = useState(""), [busy, setBusy] = useState(false), [noteOpen, setNoteOpen] = useState(false), [note, setNote] = useState("");
  const selected = runs.find((run) => run.id === selectedId) || runs[0];
  const filtered = useMemo(() => runs.filter((run) => `${run.id} ${run.agent} ${run.scenario} ${run.user}`.toLowerCase().includes(query.toLowerCase())), [runs, query]);
  const refresh = async () => { setBusy(true); try { setRuns(await listRuns(workspace.id)); notify("Runs refreshed"); } catch (e) { notify(e.message, "error"); } finally { setBusy(false); } };
  const create = async (scenario) => { setBusy(true); try { const made = await createDemoRun(scenario); const next = supabase ? await listRuns(workspace.id) : [made, ...runs.filter((r) => r.id !== made.id)]; setRuns(next); setSelectedId(supabase ? next[0].id : made.id); notify("Demo run created"); } catch (e) { notify(e.message, "error"); } finally { setBusy(false); } };
  const showNote = async () => { try { setNote(await getNote(selected.databaseId || selected.id)); setNoteOpen(true); } catch (e) { notify(e.message, "error"); } };
  const persistNote = async () => { try { await saveNote(selected.databaseId || selected.id, note); setNoteOpen(false); notify("Investigation note saved"); } catch (e) { notify(e.message, "error"); } };
  if (!selected) return <div className="empty">No runs have been recorded yet.</div>;
  return <><div className="page-heading"><div><h1><Play size={21}/>Agent runs</h1><p>Investigate agent behavior across traces, metrics, and logs.</p></div><ScenarioMenu create={create} busy={busy}/></div><div className="workbench"><RunList runs={filtered} selected={selected} select={setSelectedId} query={query} setQuery={setQuery} refresh={refresh}/><Inspector run={selected} openNote={showNote}/></div><Timeline run={selected}/><Logs run={selected}/>{noteOpen && <div className="modal-backdrop" onMouseDown={() => setNoteOpen(false)}><div className="modal" onMouseDown={(e) => e.stopPropagation()}><div><h2>Investigation note</h2><button className="icon-button" onClick={() => setNoteOpen(false)}><X size={18}/></button></div><p>Capture context and handoff details for <b>{selected.id}</b>.</p><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you find? What should happen next?" autoFocus/><footer><button className="secondary" onClick={() => setNoteOpen(false)}>Cancel</button><button className="primary" onClick={persistNote}>Save note</button></footer></div></div>}</>;
}

function Overview({ runs, openRuns }) {
  const failed = runs.filter((r) => r.status === "failed").length, avg = runs.reduce((s, r) => s + r.latency, 0) / Math.max(runs.length, 1), tokens = runs.reduce((s, r) => s + r.tokens, 0);
  return <><div className="page-heading"><div><h1><LayoutDashboard size={21}/>Overview</h1><p>Operational health across your AI agent fleet.</p></div><button className="primary" onClick={openRuns}>Investigate runs<ChevronRight size={16}/></button></div><div className="overview-metrics">{[["Runs observed", runs.length, "Last 24 hours", Activity], ["Failed runs", failed, failed ? "Needs attention" : "Healthy", XCircle], ["Average latency", `${avg.toFixed(2)}s`, "Across all agents", Gauge], ["Total tokens", tokens.toLocaleString(), "Estimated usage", Bot]].map(([label, value, detail, Icon]) => <div key={label}><span><Icon size={17}/>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}</div><section className="overview-list panel"><div className="section-bar"><strong>Recent issues</strong><button onClick={openRuns}>View all<ChevronRight size={14}/></button></div>{runs.map((run) => <button key={run.id} onClick={openRuns}><span className={`incident ${tone(run.status)}`}>{run.status === "failed" ? <X size={14}/> : <AlertTriangle size={14}/>}</span><span><strong>{run.scenario}</strong><small>{run.agent} · {run.id}</small></span><span className={`status ${tone(run.status)}`}><i/>{run.status}</span><time>{run.startTime}</time><ChevronRight size={15}/></button>)}</section></>;
}

function AlertsView({ alerts, setAlerts, notify }) {
  const change = async (alert) => { const enabled = !alert.enabled; setAlerts((items) => items.map((item) => item.id === alert.id ? { ...item, enabled } : item)); try { await toggleAlert(alert.id, enabled); notify(enabled ? "Alert enabled" : "Alert paused"); } catch (e) { notify(e.message, "error"); } };
  return <><div className="page-heading"><div><h1><Bell size={21}/>Alerts</h1><p>Guardrails derived from the same telemetry used during investigation.</p></div><button className="primary"><Plus size={16}/>New alert</button></div><section className="alerts-table panel"><div className="alert-row head"><span>Rule</span><span>Metric</span><span>Threshold</span><span>Severity</span><span>State</span><span/></div>{alerts.map((alert) => <div className="alert-row" key={alert.id}><span><strong>{alert.name}</strong><small>Evaluates every minute</small></span><code>{alert.metric}</code><span>{alert.threshold}</span><span className={tone(alert.severity)}>{alert.severity}</span><span>{alert.enabled ? "Active" : "Paused"}</span><button className={`toggle ${alert.enabled ? "on" : ""}`} onClick={() => change(alert)}><i/></button></div>)}</section></>;
}

function TeamView({ user, workspace }) {
  return <><div className="page-heading"><div><h1><Users size={21}/>Team</h1><p>Manage access to {workspace.name}.</p></div><button className="primary"><Plus size={16}/>Invite member</button></div><section className="team-table panel"><div className="team-row head"><span>Member</span><span>Role</span><span>Access</span><span/></div><div className="team-row"><span><b className="avatar">{initials(user)}</b><span><strong>{user?.user_metadata?.full_name || "Demo User"}</strong><small>{user?.email || "preview@agentscope.dev"}</small></span></span><span>{workspace.role}</span><span><ShieldCheck size={16}/>Full workspace</span><button className="icon-button"><MoreVertical size={17}/></button></div></section></>;
}

function Product({ user, preview }) {
  const [workspace, setWorkspace] = useState({ id: "preview", name: "My AI Workspace", environment: "Production", role: "owner" }), [runs, setRuns] = useState([]), [alerts, setAlerts] = useState([]), [view, setView] = useState("runs"), [loading, setLoading] = useState(true), [mobile, setMobile] = useState(false), [toast, setToast] = useState(null);
  const notify = (message, kind = "success") => { setToast({ message, kind }); setTimeout(() => setToast(null), 3200); };
  useEffect(() => { let active = true; (async () => { try { const ws = await getWorkspace(); const [nextRuns, nextAlerts] = await Promise.all([listRuns(ws.id), listAlerts(ws.id)]); if (active) { setWorkspace(ws); setRuns(nextRuns); setAlerts(nextAlerts); } } catch (e) { notify(e.message, "error"); } finally { if (active) setLoading(false); } })(); return () => { active = false; }; }, []);
  return <main className="app-shell"><Sidebar view={view} setView={setView} workspace={workspace} open={mobile} close={() => setMobile(false)}/>{mobile && <div className="scrim" onClick={() => setMobile(false)}/>}<div className="workspace"><Topbar user={user} preview={preview} workspace={workspace} openMenu={() => setMobile(true)}/><div className="content">{loading ? <div className="loading"><LoaderCircle className="spin" size={26}/>Loading workspace telemetry...</div> : view === "overview" ? <Overview runs={runs} openRuns={() => setView("runs")}/> : view === "alerts" ? <AlertsView alerts={alerts} setAlerts={setAlerts} notify={notify}/> : view === "team" ? <TeamView user={user} workspace={workspace}/> : <RunsView runs={runs} setRuns={setRuns} workspace={workspace} notify={notify}/>}</div></div>{toast && <div className={`toast ${toast.kind}`}><CheckCircle2 size={17}/>{toast.message}</div>}</main>;
}

function Root() {
  const [session, setSession] = useState(null), [preview, setPreview] = useState(!isSupabaseConfigured), [checking, setChecking] = useState(isSupabaseConfigured);
  useEffect(() => { if (!supabase) return; supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); }); const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next)); return () => data.subscription.unsubscribe(); }, []);
  if (checking) return <main className="boot"><Activity size={28}/><span>AgentScope Sidekick</span><LoaderCircle className="spin" size={18}/></main>;
  if (!session && !preview) return <AuthScreen onPreview={() => setPreview(true)}/>;
  return <Product user={session?.user} preview={!session}/>;
}

createRoot(document.getElementById("root")).render(<Root/>);
