# AgentScope Sidekick

**Live judge demo:** https://agentscope-sidekick.vercel.app/?demo=1
**Authenticated product:** https://agentscope-sidekick.vercel.app
**Source:** https://github.com/phanixdev/agentscope-sidekick

AgentScope Sidekick is a production-shaped AI agent observability product for Track 1 of the Agents of SigNoz hackathon. It turns correlated OpenTelemetry traces, metrics, and logs into evidence-backed incident explanations for tool failures, retrieval misses, token spikes, and latency regressions.

## Judge It in 90 Seconds

1. Open the [one-click judge demo](https://agentscope-sidekick.vercel.app/?demo=1). No account or email confirmation is required.
2. Select the failed `Tool failure` run and open **Evidence**.
3. Inspect the failed span, threshold breach, correlated log, trace ID, and computed confidence.
4. Choose **View SigNoz proof** to see the captured failing trace, native dashboard, and deployed alert rules.
5. Create a `Retrieval miss` or `Token spike` run to verify that the diagnosis and evidence change with telemetry.
The hosted judge workspace is deliberately zero-friction and uses deterministic demo data. Authenticated production workspaces persist under Supabase RLS. The reproducible Foundry stack emits and queries the real traces, metrics, and logs shown below.

## Live SigNoz Proof

### Correlated failing trace

![AgentScope failing tool trace in SigNoz](output/signoz/failing-trace-live.png)

### Native all-signals dashboard

![AgentScope native SigNoz dashboard](output/signoz/dashboard-live.png)

### Terraform-managed alert guardrails

![AgentScope alert rules in SigNoz](output/signoz/alerts-live.png)

The verified stack ingested **14 spans**, **8 trace-correlated logs**, every custom agent metric series, and **4 Terraform-managed alert rules**. SigNoz MCP read the failing trace and updated the native dashboard; raw query and apply evidence is committed under `output/telemetry/`.

## Winning Track 1 Story

1. Trigger a realistic bad agent run.
2. Isolate the root cause in a trace-first run explorer.
3. Correlate the failed span with metrics and logs.
4. Save the investigation handoff.
5. Show the matching SigNoz alert guardrail.

The diagnosis is deterministic and never invents a cause. Its confidence score is derived from the available anomaly signals, and every conclusion exposes the trace ID, failed or warning span, threshold comparison, and correlated log used as evidence.

## Complete Product

- Supabase email/password authentication, reset flow, and persistent sessions.
- Multi-tenant workspaces with owner/admin/member/viewer roles.
- PostgreSQL schema with RLS on every user-facing table.
- Indexed agent runs, spans, logs, alerts, and investigation notes.
- Transactional onboarding that seeds a judge-ready incident workspace.
- Authenticated demo-run RPC for tool failure, retrieval miss, and token spike scenarios.
- Responsive run explorer, overview, alert management, team view, working run/log filters, loading, error, empty, and toast states.
- One-click judge demo in every environment, plus local preview mode when Supabase variables are absent.
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

The hosted authenticated product uses Supabase directly under RLS; its judge mode is deterministic and requires no account. The full Foundry path adds the Python API and live SigNoz telemetry pipeline. The UI links each investigation to committed SigNoz execution evidence so the data source is explicit.

## Local Product

```powershell
npm install
Copy-Item .env.example .env.local
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm.cmd run dev
```

Without `.env.local`, the same UI opens in browser-local preview mode. With Supabase configured, unauthenticated visitors can still choose **Explore judge demo** without creating an account.

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
