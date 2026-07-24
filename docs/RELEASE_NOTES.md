# Release v1.3.0

This release is the submission-ready Track 1 package.

## Links

- Demo: https://agentscope-sidekick.vercel.app/?demo=1
- App: https://agentscope-sidekick.vercel.app
- Demo guide: https://github.com/phanixdev/agentscope-sidekick/blob/main/docs/JUDGE_GUIDE.md
- Architecture: https://github.com/phanixdev/agentscope-sidekick/blob/main/docs/architecture.md

## Changes

- Corrected production email-confirmation redirects and added a regression test.
- Added an explicit AI-assistance disclosure to the public project materials.
- Added a technical project-blog draft grounded in the captured SigNoz evidence.

- Matching SigNoz evidence now requires trace-ID equality.
- New browser-created runs show the canonical capture as a reference and disclose both trace IDs.
- Filtering clears unrelated inspector, timeline, log, and alert context.
- Reset clears the text, status, and agent filters together.
- The navigation badge counts enabled rules with active breaches.
- Mobile run rows use a stacked layout without horizontal table scrolling.
- The architecture document now covers data planes, evidence identity, trust boundaries, failure behavior, and deployment.
- Added an MIT license and cleaned the public repository documentation.

## Existing Product Features

- Correlated OpenTelemetry traces, metrics, and logs in SigNoz.
- Native dashboard and four Terraform-managed guardrails.
- Evidence-backed diagnosis and baseline comparison.
- Linked remediation verification runs.
- Supabase authentication, tenant-scoped RLS, and persistent workspaces.
- A browser-local demo that does not require credentials.

## Verification

```powershell
npm.cmd run check
```

The release gate builds the production bundle and runs the Node and Python product, security, infrastructure, accessibility, responsive-layout, provenance, and telemetry tests.
