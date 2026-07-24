# Submission Copy

This document mirrors the live Agents of SigNoz submission form. Personal fields
and unpublished links are intentionally left as placeholders.

## Email

`[SUBMITTER EMAIL]`

## Team Name

`[TEAM NAME, OR SUBMITTER NAME IF PARTICIPATING SOLO]`

## Person Submitting

`[FULL NAME]`

## Track

**Track 1: AI & Agent Observability**

## Project Description

AgentScope Sidekick is an incident-investigation workspace for AI agents. An
agent may return one final answer while hiding the retrieval hops, tool calls,
model work, latency, token usage, and downstream failures that produced it.
Sidekick turns those signals into an explainable operational workflow.

The project instruments a Python agent and its API, retrieval, tool, LLM, and
persistence components with OpenTelemetry. It exports traces, custom metrics,
and trace-correlated logs to a reproducible SigNoz deployment. The product then
connects a failed run to the exact span, measured threshold, correlated log,
versioned diagnosis rule, recommended action, and verification rerun.

The SigNoz layer includes a native multi-signal dashboard, four
Terraform-managed alert rules, Query Builder and API evidence, ClickHouse
verification, and authenticated SigNoz MCP investigations. The React product
adds a no-login judge workspace plus authenticated, tenant-scoped Supabase
workspaces with row-level security.

Unlike a generic dashboard, Sidekick preserves evidence identity: it only calls
a captured SigNoz execution a match when the selected trace ID is identical.
Fresh browser runs are clearly labeled as references instead of being presented
as telemetry they did not generate.

AI assistance disclosure: I used OpenAI Codex and ChatGPT during planning,
implementation, testing, and editing. Runtime diagnoses do not depend on
unconstrained generated output; they use versioned rules and observable
telemetry evidence.

## GitHub Link

https://github.com/phanixdev/agentscope-sidekick

## Deployed Link

https://agentscope-sidekick.vercel.app/?demo=1

## YouTube Demo Link

`[PUBLIC YOUTUBE LINK - MAXIMUM 3 MINUTES]`

## How SigNoz Is Used

SigNoz is the observability backend and investigation surface for AgentScope
Sidekick, not a decorative integration. I deploy SigNoz and its MCP server from
the versioned Foundry files in `infra/casting.yaml` and
`infra/casting.yaml.lock`, so judges can reproduce the same stack.

The Python services use the OpenTelemetry SDK and OTLP/HTTP exporters for all
three signals. One trace ID is propagated from `POST /demo/run` through agent
orchestration, retrieval, tool execution, the LLM gateway, and persistence.
Spans carry HTTP, database, GenAI, retrieval, tool, and product guardrail
attributes. Custom metrics measure run duration, token use, tool calls, and
retrieval quality. The product derives a cost estimate from token telemetry.
WARN and ERROR logs inherit the active trace and
span context, allowing a failed tool span, breached metric threshold, and HTTP
500 log to be investigated as one incident.

Inside SigNoz, a native dashboard combines the agent latency, token, tool,
retrieval, trace, and log views. Four Terraform-managed alerts cover tool
failures, peak latency, token-budget breaches, and weak retrieval. I also use
the SigNoz MCP server to query the failing trace and update dashboard state,
with the raw MCP responses committed as evidence. Query Builder/API responses,
ClickHouse results, OTLP output, Terraform apply output, and full-resolution
SigNoz screenshots are preserved in the repository.

The canonical capture contains 14 spans and eight trace-correlated logs. The
hosted product compares selected runs with this evidence bundle and exposes the
trace ID, span ID, metric query, alert threshold, rule version, and evidence
source behind every diagnosis.

## Project Blog Link

`[PUBLISHED DEV.TO, MEDIUM, OR SUBSTACK LINK]`

Draft: [project-blog-draft.md](project-blog-draft.md)

## Hackathon Experience

This hackathon changed how I think about agent failures. I started with the
idea of showing agent traces, but the difficult part was proving that every
diagnosis came from the same execution. A trace screenshot, a metric, and an
error log can look convincing while referring to different runs. Preserving
context across the API, retrieval, tool, LLM, and persistence boundaries made
trace identity the foundation of the product.

Building with SigNoz also pushed the project beyond a frontend demonstration.
I worked with OpenTelemetry traces, metrics, and logs, Query Builder results,
ClickHouse queries, MCP investigations, dashboards, Terraform alerts, and a
reproducible Foundry deployment. The biggest lesson was that observability is
most useful when it leads to a decision: identify the failed span, explain the
threshold breach, apply a remediation, and verify the next run against the same
guardrails.

I used OpenAI Codex and ChatGPT during planning, implementation, testing, and
editing. I reviewed and verified the resulting code and claims against the
running product, raw telemetry artifacts, and automated tests.

## Final Form Checklist

- [ ] Personal email, team name, and submitter name are correct.
- [x] Track 1 is the only selected track.
- [x] GitHub repository is public.
- [x] Judge demo opens without authentication.
- [x] AI assistance is explicitly disclosed in the form copy.
- [x] `casting.yaml` and `casting.yaml.lock` are committed.
- [ ] Public YouTube demo is no longer than three minutes.
- [ ] New project blog is published on a supported blogging platform.
- [ ] Every submitted link is tested in a signed-out browser.
- [ ] The emailed copy of the final response is received.
