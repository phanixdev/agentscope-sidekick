# Submission Notes

## Project

**AgentScope Sidekick**

Track 1: AI and Agent Observability

AgentScope Sidekick turns OpenTelemetry and SigNoz data into an investigation workflow for AI-agent failures.

## Problem

An agent response can hide retrieval, tool calls, model requests, retries, context growth, and formatting work. When a run becomes slow, expensive, or incorrect, a final error message is not enough. Operators need the trace, metric threshold, and correlated log that explain what happened.

## Approach

I modeled each agent run as a trace tree and built an operations interface around it. The interface links a failed run to its anomalous span, measured value, alert threshold, and correlated log. It also supports comparison, notes, alert drill-down, remediation, and a verification rerun.

## Components

- React and Vite product interface.
- Python incident API.
- Instrumented demo agent using the OpenTelemetry SDK.
- Supabase authentication and tenant-scoped persistence.
- Foundry deployment for SigNoz and MCP.
- Native SigNoz dashboard.
- Four Terraform-managed alert rules.
- Saved raw evidence and an automated verification suite.

## Demo Scenarios

1. **Tool failure:** `search_docs` returns HTTP 500 and produces an error span.
2. **Retrieval miss:** retrieval quality falls below 0.30 with weak source coverage.
3. **Token spike:** the run completes but exceeds the token budget.

## SigNoz and OpenTelemetry

- Parent traces represent complete agent runs.
- Retrieval spans include score and result count.
- Tool spans include tool name, status code, and error status.
- Model spans include provider, model, input tokens, and output tokens.
- WARN and ERROR logs carry matching trace and span IDs.
- The dashboard combines latency, tokens, tool reliability, retrieval quality, traces, and logs.
- Alert rules cover tool failures, peak latency, token budget, and retrieval quality.

## Product Layer

The hosted app includes Supabase Auth, workspace-scoped PostgreSQL data, RLS, onboarding, persistent notes, alert management, and remediation history. A no-login demo is available for reviewing the workflow without configuring credentials.

## Verification

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify_demo.ps1
```

The verifier checks the Foundry files, required artifacts, OpenTelemetry dependencies, Python tests, frontend build, API smoke tests, demo scenarios, and saved trace, metric, and log evidence.

## AI Assistance

I used OpenAI Codex and ChatGPT during planning and implementation. Product diagnoses are grounded in telemetry and versioned rules rather than unconstrained generated explanations.
