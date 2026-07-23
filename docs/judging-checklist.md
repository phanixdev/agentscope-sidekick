# Track 1 Judging Checklist

## Potential impact

- Helps teams debug AI-agent failures, quality issues, and cost spikes.
- Converts hidden agent internals into operational evidence.
- Supports production-style workflows: incident review, trace inspection, logs, dashboards, and alerts.

## Creativity and innovation

- Treats AI-agent runs as observable trace trees rather than generic API calls.
- Separates tool failures, retrieval misses, and token spikes as different failure classes.
- Uses telemetry-grounded explanations instead of unconstrained AI summaries.

## Technical excellence

- React dashboard builds successfully with Vite.
- Python API exposes incidents, explanations, and demo triggers.
- Demo agent emits OpenTelemetry SDK spans when dependencies are installed.
- Verification script checks artifacts, tests, build, API, demo scenarios, and telemetry evidence.

## Best use of SigNoz

- Official Foundry v0.2.16 casting and generated lock are present and forge successfully.
- The demo agent emits real OTLP traces, metrics, and correlated logs to the Foundry SigNoz ingester.
- Dashboard specs cover latency, tokens, tool reliability, and retrieval quality.
- Alert specs cover failure rate, latency, token budget, and retrieval score.

## User experience

- Dashboard is dense, scannable, and operational rather than marketing-heavy.
- Main workflow is visible: select run, inspect spans/logs, explain run, trigger scenarios.
- Seed-data fallback keeps the demo usable even without API or Docker.

## Presentation quality

- README has setup, live demo flow, telemetry path, API endpoints, and verification steps.
- Submission copy and 3-minute demo script are ready in `docs/`.
- Desktop and mobile screenshots are saved in `output/playwright/`.

## Live verification

- Docker Desktop 4.83.0 runs the complete Foundry deployment locally.
- SigNoz v0.134.0 ingested 14 spans, eight correlated logs, and all custom metric series from the three demo scenarios.
- The native dashboard shows 3 runs, 23,324 tokens, one failed tool call, per-scenario token peaks, root-span latency, and correlated WARN/ERROR volume.
- Terraform applied four typed alert rules and a second apply updated them in place.
- The authenticated SigNoz MCP server read the failing trace and updated the existing dashboard.
- Live screenshots are saved in `output/signoz/`; query and apply evidence is saved in `output/telemetry/`.


