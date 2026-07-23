# AgentScope Sidekick Judge Guide

## Open first

- Judge demo: https://agentscope-sidekick.vercel.app/?demo=1
- Authenticated product: https://agentscope-sidekick.vercel.app
- Source: https://github.com/phanixdev/agentscope-sidekick
- Release: https://github.com/phanixdev/agentscope-sidekick/releases/tag/v1.0.0-hackathon

Judge mode is a deterministic, zero-credential dataset. It is labeled as reference data in the product. Authenticated workspaces use Supabase persistence and tenant-scoped RLS.

## 90-second path

1. Open the failed **Tool failure** run. In **Explain**, verify `3/3 signals corroborated` and the explicit facts-to-rule boundary.
2. Open **Evidence**. Check the trace/span IDs, capture time, metric query, rule ID/version, decision engine, and LLM involvement.
3. Open **Compare**. Confirm the comparison says **deterministic reference** in judge mode and exposes its source and cohort.
4. Open **Remediate**, select an action, and choose **Apply and run verification**. Inspect the new correlated run and four-signal before/after result.
5. Open **Alerts**, then **Investigate** a breached rule. Confirm the alert context deep-links to the affected run.
6. Open **SigNoz evidence**. Inspect the full-resolution trace, dashboard, alert screenshots, and raw MCP/API/Terraform artifacts.

## Track 1 proof matrix

| Requirement | Product proof | Repository proof |
| --- | --- | --- |
| Agent trace visibility | Span timeline and first divergent span | `docs/telemetry-contract.md`, `output/telemetry/otel-all-signals.txt` |
| GenAI telemetry | Model, tokens, provider, tool and retrieval attributes | `apps/agent/demo_agent.py` |
| Cross-signal correlation | Trace-matched span, metric, and log evidence | `output/telemetry/mcp-failing-trace.json` |
| SigNoz dashboards | In-product proof gallery | `infra/signoz/dashboards.json` |
| Actionable alerts | Alert-to-investigation deep link | `infra/signoz/alerts.tf` |
| Root-cause workflow | Versioned deterministic rules and provenance | `apps/web/src/main.jsx` |
| Closed-loop remediation | Before/after verification rerun | `supabase/migrations/202607230004_closed_loop_remediation.sql` |
| Multi-tenant product | Authenticated workspace and recovery flows | `docs/security.md`, `supabase/tests/rls_isolation.sql` |
| Reproducibility | Foundry lock, CI, and canonical capture | `infra/casting.yaml.lock`, `.github/workflows/verify.yml` |

## Data disclosure

- **Judge mode:** versioned deterministic incident and reference cohorts; no claim of live peer aggregation.
- **Authenticated mode:** workspace runs are persisted under Supabase RLS. A healthy baseline appears only after at least five healthy runs in the selected 24-hour window; otherwise the UI explicitly falls back to the deterministic reference.
- **SigNoz proof:** captured from the reproducible Foundry deployment. Screenshots are paired with raw MCP, API, ClickHouse, OTLP, and Terraform evidence.

## Verification

```powershell
npm.cmd run check
python -m scripts.capture_canonical_trace
```

Database policy proof:

```bash
npx supabase start
npx supabase db reset
npx supabase test db supabase/tests/rls_isolation.sql
```

## Known presentation boundary

The hosted judge mode intentionally avoids requiring credentials or a public SigNoz deployment. The repository includes full-resolution proof and raw query artifacts. A concise real-SigNoz walkthrough video is the final submission asset and should be recorded only after the production release is frozen.