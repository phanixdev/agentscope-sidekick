# AgentScope Sidekick

AgentScope Sidekick is a production-shaped AI agent observability product for Track 1 of the Agents of SigNoz hackathon. It turns correlated OpenTelemetry traces, metrics, and logs into evidence-backed incident explanations for tool failures, retrieval misses, token spikes, and latency regressions.

## Winning Track 1 Story

1. Trigger a realistic bad agent run.
2. Isolate the root cause in a trace-first run explorer.
3. Correlate the failed span with metrics and logs.
4. Save the investigation handoff.
5. Show the matching SigNoz alert guardrail.

The explanation never invents a cause: it cites trace IDs, failed spans, token usage, retrieval scores, status codes, and correlated logs.

## Complete Product

- Supabase email/password authentication, reset flow, and persistent sessions.
- Multi-tenant workspaces with owner/admin/member/viewer roles.
- PostgreSQL schema with RLS on every user-facing table.
- Indexed agent runs, spans, logs, alerts, and investigation notes.
- Transactional onboarding that seeds a judge-ready incident workspace.
- Authenticated demo-run RPC for tool failure, retrieval miss, and token spike scenarios.
- Responsive run explorer, overview, alert management, team view, filters, loading, error, empty, and toast states.
- Local preview mode when Supabase variables are absent.
- Live SigNoz, OpenTelemetry collector, MCP, Terraform alerts, and native dashboard assets.

## Architecture

```text
apps/web          React + Vite product UI and Supabase client
apps/api          Python incident/explanation API for the full local stack
apps/agent        OpenTelemetry-instrumented demo agent
supabase          PostgreSQL migrations, triggers, functions, indexes, and RLS
infra             SigNoz Foundry deployment, dashboard, and alert rules
tests             Track 1 telemetry and infrastructure verification
```

The deployed web product uses Supabase directly under RLS. The local full-stack path adds the Python API and live SigNoz telemetry pipeline.

## Local Product

```powershell
npm install
Copy-Item .env.example .env.local
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm.cmd run dev
```

Without `.env.local`, the same UI opens in browser-local preview mode.

Apply `supabase/migrations` to a Supabase project, then configure these Vercel variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

The publishable Supabase key is intentionally browser-safe; authorization is enforced by RLS and workspace membership policies.

## Full SigNoz Stack

```powershell
cd infra
foundryctl gauge -f casting.yaml
foundryctl cast -f casting.yaml
```

Services:

```text
http://127.0.0.1:5173  AgentScope Sidekick
http://127.0.0.1:8088  Sidekick API
http://127.0.0.1:8080  SigNoz
http://127.0.0.1:8000  SigNoz MCP server
```

Emit all three signals into SigNoz:

```powershell
docker compose -f pours/deployment/compose.yaml --profile demo-once run --rm agentscope-demo-agent
```

The native dashboard is `infra/signoz/dashboards.json`. Four deployed alert rules are defined in `infra/signoz/alerts.tf`, with judge-readable runbooks in `infra/signoz/alerts.json`.

## Verification

```powershell
npm.cmd run check
.\scripts\verify_demo.ps1
```

The test suite covers explanations, dynamic incidents, Foundry artifacts, dashboard schema, alert rules, and all-signal OpenTelemetry evidence. Browser QA covers authenticated sign-in, transactional onboarding, demo-run creation, investigation notes, alerts, desktop, and mobile layouts.

## Security

- No service-role key is shipped to the browser.
- Every product table has RLS enabled.
- Workspace membership scopes all run, span, log, and alert reads.
- Only owners/admins can update alert rules.
- Investigation notes are private to their author.
- Secrets and local environment files are ignored by Git.

## AI Usage Disclosure

This project was planned and implemented with assistance from OpenAI Codex / ChatGPT. Product explanations are grounded in telemetry evidence and have a deterministic fallback when no model key is configured.
