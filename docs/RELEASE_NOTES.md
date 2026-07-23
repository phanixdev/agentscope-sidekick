# AgentScope Sidekick v1.1.0 - Track 1 Final

Production release aligned with the current judge workflow and evidence bundle.

## Judge entry points

- Judge demo: https://agentscope-sidekick.vercel.app/?demo=1
- Authenticated product: https://agentscope-sidekick.vercel.app
- Judge guide: https://github.com/phanixdev/agentscope-sidekick/blob/main/docs/JUDGE_GUIDE.md

## Highlights

- One canonical 32-character OpenTelemetry trace ID connects the failed judge run to the real SigNoz trace and MCP response.
- The proof viewer exposes capture time, trace ID, evidence revision, and capture scope.
- Alert counts and deep links evaluate actual tool, latency, token, and retrieval breaches.
- Successful remediation reruns are excluded from active alert counts.
- Alerts show the observed value beside the configured threshold.
- Overview separates active guardrail breaches from verified remediation runs.
- The judge dataset is explicitly ephemeral and resets on refresh.
- Supabase authentication, tenant-scoped RLS, persistent notes, and closed-loop remediation remain available in authenticated workspaces.

## Verification

```powershell
npm.cmd run check
```

The release gate builds the production bundle, runs the Node rule-engine tests, and runs the complete Python product, security, infrastructure, provenance, and telemetry suite.
