# AgentScope Sidekick Architecture

## System flow

```mermaid
flowchart LR
    Judge["Judge or operator"]

    subgraph Hosted["Hosted product"]
        Web["React + Vite UI<br/>Vercel"]
        Demo["Deterministic judge dataset<br/>explicitly labeled"]
        Auth["Supabase Auth"]
        DB[("PostgreSQL<br/>RLS + indexes")]
        Base["Healthy baseline RPC<br/>minimum 5 samples"]
        Fix["Remediation + verified rerun"]
    end

    subgraph Telemetry["Reproducible Foundry deployment"]
        API["HTTP incident API"]
        Agent["Agent orchestration"]
        Retrieval["Retrieval service"]
        Tool["Tool gateway"]
        LLM["LLM gateway"]
        OTel["OpenTelemetry SDK"]
        Store[("SigNoz / ClickHouse")]
        Dashboard["Native dashboard"]
        Alerts["Terraform alert rules"]
        MCP["SigNoz MCP server"]
    end

    Judge --> Web
    Web -->|"judge mode"| Demo
    Web -->|"authenticated mode"| Auth
    Auth --> DB
    Web <-->|"RLS-protected data"| DB
    DB --> Base
    DB --> Fix
    Fix --> DB

    API --> Agent
    Agent --> Retrieval
    Agent --> Tool
    Agent --> LLM
    API --> OTel
    Agent --> OTel
    Retrieval --> OTel
    Tool --> OTel
    LLM --> OTel
    OTel -->|"OTLP traces, metrics, logs"| Store
    Store --> Dashboard
    Store --> Alerts
    Store <--> MCP
    Store -. "captured execution evidence" .-> Web
```

## Investigation lifecycle

```mermaid
sequenceDiagram
    participant J as Judge / operator
    participant W as Sidekick UI
    participant DB as Supabase / RLS
    participant A as Instrumented agent
    participant S as SigNoz

    J->>W: Open an incident or breached alert
    W->>DB: Load tenant-scoped run and baseline
    DB-->>W: Observed baseline or explicit reference fallback
    W-->>J: Separate observed facts from rule interpretation
    J->>W: Inspect trace, metric, log, and rule provenance
    J->>W: Apply remediation
    W->>DB: Persist action and create verification rerun
    DB-->>W: Before/after guardrail result and lineage
    W-->>J: Resolved, improved, or monitor result
    A->>S: Export one HTTP-to-agent-to-persistence trace
    S-->>W: Captured trace, dashboard, alert, and query proof
```

## Canonical trace hierarchy

```text
POST /demo/run                         agentscope-api
├── invoke_agent ResearchAgent        agentscope-demo-agent
│   ├── query knowledge_chunks        agentscope-retrieval
│   ├── execute_tool search_docs      agentscope-tool-gateway
│   └── chat gpt-4o-mini              agentscope-llm-gateway
└── INSERT agent_runs                 agentscope-api
```

The hierarchy preserves one trace ID across five services. See `docs/telemetry-contract.md` for semantic attributes and the reproducible capture command.

## Trust boundaries

- The browser receives only the Supabase publishable key; authorization is enforced by workspace membership and PostgreSQL RLS.
- Sensitive RPC execution is revoked from `PUBLIC` and `anon`, then granted to `authenticated` only.
- Authenticated writes use scoped RPCs or RLS-protected tables. No service-role key is shipped to the client.
- Judge mode is deterministic and browser-local. Reference cohorts are visibly distinguished from observed workspace telemetry.
- Observed baselines require at least five healthy tenant-scoped runs. Insufficient data falls back to a disclosed versioned reference.
- The Foundry lockfile reproduces SigNoz and MCP versions, while Terraform keeps alert rules reviewable.
- Diagnosis uses versioned deterministic rules. The UI exposes the rule, query, trace/span IDs, source, and explicit LLM involvement.

## Repository ownership

| Component | Responsibility |
| --- | --- |
| `apps/web` | Investigation, provenance, remediation, recovery states, Supabase client, and proof viewer |
| `apps/api` | HTTP trace root, incident persistence, and deterministic explanation API |
| `apps/agent` | Cross-service agent, retrieval, tool, model, metric, and log instrumentation |
| `supabase` | Auth-linked schema, RLS, baseline RPC, remediation history, and pgTAP proof |
| `infra` | Foundry casting, SigNoz dashboard, Terraform alerts, and deployment assets |
| `output/telemetry` | Canonical OTLP plus saved MCP, API, ClickHouse, and Terraform evidence |
| `tests` | Product, security, provenance, trace hierarchy, and evidence contracts |