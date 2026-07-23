# AgentScope Sidekick Submission Copy

## One-line pitch

AgentScope Sidekick makes AI agents debuggable by turning OpenTelemetry/SigNoz traces, logs, token usage, retrieval quality, and tool failures into evidence-backed incident explanations.

## Track

Track 1: AI & Agent Observability

## Problem

AI agents fail in ways traditional monitoring does not explain well. A single response can hide many moving parts: retrieval, tool calls, LLM requests, retries, context packing, and final formatting. When cost spikes, latency grows, retrieval misses, or a tool fails, teams need trace-level evidence instead of a vague chatbot answer.

## Solution

AgentScope Sidekick instruments AI agent runs as trace trees and presents them as an operations dashboard. Each agent run has parent spans for the run and child spans for retrieval, tool execution, LLM calls, and response formatting. The sidekick explains failures using telemetry evidence: trace IDs, failed spans, token counts, retrieval scores, HTTP status codes, and correlated logs.

## What we built

- A polished React dashboard for AI-agent operations.
- A Python API for incidents, demo-run triggering, and evidence-backed explanations.
- An instrumented demo agent that emits OpenTelemetry SDK spans.
- Three Track 1 scenarios: tool failure, retrieval miss, and token spike.
- An official Foundry v0.2.16 deployment that installs SigNoz + MCP and patches in the Sidekick API, web UI, and demo agent.
- Real correlated OpenTelemetry traces, metrics, and logs, plus a repeatable verifier that proves the complete local workflow.

## SigNoz / OpenTelemetry usage

- Complete agent runs are modeled as parent traces.
- `vector_db.query` spans include retrieval score and result count.
- `tool.search_docs` spans include tool name, HTTP status, and error status.
- `LLM(gpt-4o-mini)` spans include model name, input tokens, output tokens, and budget-exceeded attributes.
- A native SigNoz v5 dashboard combines metrics, traces, and logs for latency, token usage, tool reliability, and correlated errors.
- Four reviewable Terraform alert rules cover tool failures, peak latency, token budget overflow, and retrieval quality drop.

## Demo scenarios

1. Tool failure: `search_docs` returns HTTP 500 and produces an error span.
2. Retrieval miss: retrieval score drops below 0.3 with weak source coverage.
3. Token spike: the planner succeeds but exceeds the token budget threshold.

## Verification

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify_demo.ps1
```

The verifier checks the current Foundry schema and generated deployment, required artifacts, OpenTelemetry SDK availability, Python tests, frontend build, API smoke tests, demo-run triggering, and saved correlated trace, metric, and log evidence.

## AI usage disclosure

This project was planned and implemented with assistance from OpenAI Codex / ChatGPT. The product's explanation feature is telemetry-grounded and has a deterministic fallback.



## Production Product Layer

The submission now includes Supabase authentication, workspace-scoped PostgreSQL persistence, row-level security, transactional onboarding, persisted investigation notes, authenticated demo-run generation, responsive product views, and Vercel deployment configuration. The production UI offers a one-click judge demo in every environment, while authenticated mode was verified against a live Supabase project from account creation through RLS-protected writes. The hosted UI labels its Supabase and captured SigNoz sources explicitly.
