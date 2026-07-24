# Demo Guide

## Links

- Demo workspace: https://agentscope-sidekick.vercel.app/?demo=1
- Authenticated app: https://agentscope-sidekick.vercel.app
- Source: https://github.com/phanixdev/agentscope-sidekick
- Latest release: https://github.com/phanixdev/agentscope-sidekick/releases/latest
- Architecture: [architecture.md](architecture.md)

Demo mode is browser-local and resets on refresh. Authenticated workspaces use Supabase persistence and tenant-scoped RLS.

## Walkthrough

1. Open the failed **Tool failure** run.
2. Under **Explain**, check the failed span, breached latency threshold, correlated HTTP 500 log, and `3/3 signals corroborated` label.
3. Under **Evidence**, inspect the trace and span IDs, metric query, rule ID, rule version, and decision engine.
4. Under **Compare**, confirm that demo mode identifies its baseline as a deterministic reference.
5. Under **Remediate**, apply an action and inspect the linked verification run and before-and-after table.
6. Open **Alerts**, then investigate one of the breached rules.
7. Open the SigNoz evidence viewer from the canonical failure. It should say **Trace identity verified**.
8. Create another demo run and open its evidence. It should show **Canonical reference**, both trace IDs, and **Trace IDs differ**.

## Evidence Map

| Capability | Product | Repository |
| --- | --- | --- |
| Agent trace | Span timeline and divergent-span view | `docs/telemetry-contract.md`, `output/telemetry/otel-all-signals.txt` |
| GenAI attributes | Model, token, provider, tool, and retrieval fields | `apps/agent/demo_agent.py` |
| Signal correlation | Trace-matched span, metric, and log | `output/telemetry/mcp-failing-trace.json` |
| Dashboard | Evidence gallery | `infra/signoz/dashboards.json` |
| Alerts | Alert-to-run investigation | `infra/signoz/alerts.tf` |
| Diagnosis | Versioned rules and provenance | `apps/web/src/main.jsx` |
| Remediation | Linked verification run | `supabase/migrations/202607230004_closed_loop_remediation.sql` |
| Authentication | Tenant-scoped workspace | `docs/security.md`, `supabase/tests/rls_isolation.sql` |
| Reproducibility | Foundry lock and CI | `infra/casting.yaml.lock`, `.github/workflows/verify.yml` |

## Data Sources

- **Demo workspace:** deterministic incidents and reference cohorts stored in the browser.
- **Authenticated workspace:** tenant-scoped runs stored in Supabase. An observed baseline requires at least five healthy runs in the selected window.
- **SigNoz evidence:** a captured Foundry deployment. The canonical incident uses trace `70468b87b41bc6ecbe14d95f30ebcd2c` from revision `c83b4f7`.

The product only calls a proof a matching execution when the selected trace ID equals the evidence trace ID.

## Verification

```powershell
npm.cmd run check
python -m scripts.capture_canonical_trace
```

Database policy tests:

```bash
npx supabase start
npx supabase db reset
npx supabase test db supabase/tests/rls_isolation.sql
```

The hosted demo does not require a public SigNoz instance. Full-resolution screenshots and the raw query responses are stored in the repository so the capture can be inspected independently.
