# AgentScope Sidekick Architecture

## System Flow

```mermaid
flowchart LR
    Judge["Judge or operator"]

    subgraph Hosted["Hosted product"]
        Web["React + Vite UI<br/>Vercel"]
        Demo["One-click judge data<br/>browser-local"]
        Auth["Supabase Auth"]
        DB[("PostgreSQL<br/>RLS + indexes")]
    end

    subgraph Foundry["Reproducible Foundry deployment"]
        Agent["Instrumented AI agent"]
        API["Python incident API"]
        OTel["OpenTelemetry SDK"]
        Collector["SigNoz OTLP ingester"]
        Store[("SigNoz / ClickHouse")]
        Dashboard["Native dashboard"]
        Alerts["Terraform alert rules"]
        MCP["SigNoz MCP server"]
    end

    Judge --> Web
    Web -->|"judge mode"| Demo
    Web -->|"authenticated mode"| Auth
    Auth --> DB
    Web <-->|"runs, spans, logs,<br/>alerts, notes"| DB

    Agent --> OTel
    API --> OTel
    OTel -->|"OTLP traces, metrics, logs"| Collector
    Collector --> Store
    Store --> Dashboard
    Store --> Alerts
    Store <--> MCP
    API -->|"incident and explanation API"| Web
    MCP -->|"trace queries and<br/>dashboard updates"| Dashboard

    Store -. "captured execution evidence" .-> Web
```

## Investigation Lifecycle

```mermaid
sequenceDiagram
    participant J as Judge / operator
    participant W as Sidekick UI
    participant A as Demo agent
    participant O as OpenTelemetry
    participant S as SigNoz
    participant M as SigNoz MCP

    J->>W: Trigger tool failure, retrieval miss, or token spike
    W->>A: Start scenario
    A->>O: Emit parent and child spans
    A->>O: Emit custom metrics
    A->>O: Emit trace-correlated logs
    O->>S: Export all signals through OTLP
    S->>S: Store, dashboard, and evaluate alerts
    M->>S: Query failing trace and update dashboard
    W->>W: Correlate span, threshold, and log evidence
    W-->>J: Explain root cause with computed confidence
    J->>W: Save investigation note
    J->>W: Inspect matching SigNoz proof and guardrail
```

## Trust Boundaries

- The browser receives only the Supabase publishable key; authorization is enforced by workspace membership and PostgreSQL RLS.
- Authenticated writes use scoped RPCs or RLS-protected tables. No service-role key is shipped to the client.
- Judge mode is deterministic and browser-local, so reviewers do not need credentials.
- The Foundry lockfile reproduces SigNoz and MCP versions, while Terraform keeps alert rules reviewable.
- Explanations are deterministic: confidence is derived from available anomaly signals, and every conclusion exposes its trace, span, metric, and log evidence.

## Repository Ownership

| Component | Responsibility |
| --- | --- |
| `apps/web` | Product UI, investigation workflow, Supabase client, and evidence viewer |
| `apps/api` | Incident API and deterministic telemetry explanation |
| `apps/agent` | Instrumented scenarios and OpenTelemetry emission |
| `supabase` | Auth-linked schema, onboarding, RLS, indexes, RPCs, and persistence |
| `infra` | Foundry casting, SigNoz dashboard, Terraform alerts, and deployment assets |
| `output/telemetry` | Saved MCP, API, ClickHouse, OTLP, and Terraform verification evidence |
| `tests` | Architecture, signal, dashboard, alert, and incident verification |
