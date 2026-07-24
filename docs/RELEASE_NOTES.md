# AgentScope Sidekick v1.2.0 - Track 1 Final

Production release focused on proof integrity, judge ergonomics, and architectural clarity.

## Judge entry points

- Judge demo: https://agentscope-sidekick.vercel.app/?demo=1
- Authenticated product: https://agentscope-sidekick.vercel.app
- Judge guide: https://github.com/phanixdev/agentscope-sidekick/blob/main/docs/JUDGE_GUIDE.md
- Architecture: https://github.com/phanixdev/agentscope-sidekick/blob/main/docs/architecture.md

## Score-critical improvements

- Proof is resolved by trace identity: matching canonical runs are verified, while dynamic runs show a disclosed canonical reference with both trace IDs.
- Filtering cannot leave an unrelated hidden run in the inspector, timeline, or logs.
- Reset clears status, agent, and text filters together.
- The sidebar badge counts enabled guardrails with active breaches, not configured rules.
- Mobile run exploration uses a compact stacked layout without a table-width scroll trap.
- Architecture documents execution planes, trust boundaries, proof resolution, failure behavior, and reproducible deployment.
- MIT licensing removes repository reuse ambiguity.

## Product foundation

- Correlated OpenTelemetry traces, metrics, and logs with native SigNoz dashboard and four Terraform-managed guardrails.
- Deterministic, evidence-backed diagnosis with observed or explicitly labeled reference baselines.
- Closed-loop remediation with lineage-linked verification runs and four-signal before/after evidence.
- Supabase authentication, tenant-scoped RLS, persistent notes, and authenticated workspaces.
- Zero-credential judge mode with explicit ephemeral-data labeling.

## Verification

```powershell
npm.cmd run check
```

The release gate builds the production bundle and runs the Node rule-engine tests plus the complete Python product, security, infrastructure, accessibility, responsive, provenance, and telemetry suite.
