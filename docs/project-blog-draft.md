# From a Failed Tool Call to a Verified Fix: Building Agent Observability with SigNoz

An AI agent can return one answer while hiding a surprising amount of work: retrieval, tool calls, model requests, retries, token growth, and downstream database writes. When that answer is slow or wrong, the final response is not enough to debug the system.

I built AgentScope Sidekick for Track 1 of the Agents of SigNoz hackathon to turn that hidden execution into an evidence-backed incident workflow. The project follows one agent request across its API, orchestrator, retrieval service, tool gateway, LLM gateway, and persistence layer. It sends traces, metrics, and logs to SigNoz, identifies the signal that explains the failure, and verifies whether a remediation actually improved the next run.

This article covers the part that mattered most in practice: preserving the identity of one execution across every signal instead of assembling a convincing-looking dashboard from unrelated data.

## The problem was not generating a trace

Creating spans is straightforward. The harder question is whether the span, metric, log, diagnosis, and screenshot shown to an operator all describe the same run.

The canonical Sidekick failure begins at an HTTP request and keeps one trace ID through this hierarchy:

```text
POST /demo/run
|-- invoke_agent ResearchAgent
|   |-- query knowledge_chunks
|   |-- execute_tool search_docs
|   `-- chat gpt-4o-mini
`-- INSERT agent_runs
```

The failing scenario makes `search_docs` return an HTTP 500. That failure is represented in three ways:

1. The tool span has error status and the failing HTTP status code.
2. The run-duration metric crosses its configured guardrail.
3. The HTTP error log contains the active trace and span IDs.

Sidekick requires those facts to agree before presenting a corroborated root cause. This prevented a subtle but important product mistake: treating a similar screenshot from another run as proof for the run currently selected in the UI.

## Instrumenting the agent with OpenTelemetry

The Python agent configures separate OTLP/HTTP exporters for traces, metrics, and logs. The endpoint can be supplied as one base value:

```powershell
$env:OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
python -m scripts.capture_canonical_trace
```

When an OTLP endpoint is present, the application derives the signal-specific paths and sends the data to the collector. Without one, it uses SDK-native console exporters so the telemetry contract can still be tested in CI.

The spans use standard HTTP, database, and GenAI attributes where they fit, including:

```text
http.request.method
http.route
http.response.status_code
db.system.name
db.operation.name
gen_ai.operation.name
gen_ai.provider.name
gen_ai.request.model
gen_ai.usage.input_tokens
gen_ai.usage.output_tokens
```

I added product-specific attributes only for information that the standard conventions did not express, such as retrieval score, scenario, status, and whether the token budget was exceeded.

One privacy decision was deliberate: prompt and retrieved-document contents are not exported. The traces contain operational metadata needed for debugging without copying user content into the observability backend.

The OpenTelemetry Python documentation explains the SDK and signal support, and its exporter guide recommends sending telemetry through a collector in production:

- https://opentelemetry.io/docs/languages/python/
- https://opentelemetry.io/docs/languages/python/exporters/

## Sending all three signals to SigNoz

I deployed the stack from the repository's Foundry files:

```powershell
cd infra
foundryctl gauge -f casting.yaml
foundryctl cast -f casting.yaml
docker compose -f pours/deployment/compose.yaml --profile demo-once run --rm agentscope-demo-agent
```

The casting and lock files pin the deployment inputs so the stack is reproducible. The deployment includes SigNoz, ClickHouse, the OpenTelemetry pipeline, and the SigNoz MCP server.

The resulting canonical capture contains 14 spans and eight trace-correlated logs. It also includes custom series for duration, token use, tool activity, and retrieval quality. The product derives its cost estimate from token telemetry. The raw OTLP output is committed alongside the query results, so the screenshots are not the only available proof.

![Failing tool trace in SigNoz](https://raw.githubusercontent.com/phanixdev/agentscope-sidekick/main/output/signoz/failing-trace-live.png)

*The canonical trace preserves one identity from the HTTP request through the failed tool span and persistence.*

SigNoz's current Python instrumentation guide documents the same core setup: provide resource attributes, configure the OTLP endpoint and protocol, then confirm the service and traces inside SigNoz:

- https://signoz.io/docs/instrumentation/opentelemetry-python/

## Turning telemetry into an investigation

I did not want the product to stop at a wall of charts. An operator needs a short path from an alert to a defensible action.

For each failed run, the Sidekick interface exposes:

- the complete span timeline;
- the divergent or failed span;
- the observed metric value and threshold;
- the correlated log entry;
- the diagnosis rule ID and version;
- the evidence source and trace identity;
- a healthy baseline comparison;
- a recommended remediation;
- a linked verification run.

The diagnosis engine is deterministic. For the tool-failure scenario, it checks the failed tool span, the latency breach, and the matching error log. The UI shows how many signals corroborated the conclusion rather than asking an LLM to invent an explanation.

This separation mattered because the project uses AI assistance during development, but the production diagnosis path should remain inspectable. A judge or operator can see exactly which rule evaluated which fields.

## Dashboards, alerts, and MCP

The SigNoz dashboard combines run latency, input and output tokens, tool reliability, retrieval quality, trace search, and correlated logs.

![Agent operations dashboard in SigNoz](https://raw.githubusercontent.com/phanixdev/agentscope-sidekick/main/output/signoz/dashboard-live.png)

*The dashboard places the custom agent metrics beside trace and log investigation.*

Four Terraform-managed alert rules cover tool failures, peak latency, token budget, and weak retrieval. The product can open an investigation from the affected alert instead of forcing the operator to repeat the search manually.

![Terraform-managed SigNoz alerts](https://raw.githubusercontent.com/phanixdev/agentscope-sidekick/main/output/signoz/alerts-live.png)

*The alert rules turn the same telemetry into operational guardrails.*

I also used the SigNoz MCP server to query the failing trace and update dashboard state. The repository keeps both the request results and the dashboard-before/update responses. This demonstrated that an assistant could investigate through the same observability backend without making SigNoz a passive screenshot source.

SigNoz documents its OpenTelemetry-first model, Query Builder alerts, and MCP integration here:

- https://signoz.io/docs/what-is-signoz/
- https://signoz.io/docs/ai/signoz-mcp-server/

## The evidence-identity bug I did not expect

The most important issue I found was not an exporter bug. Browser-created demo runs receive fresh trace IDs, while the repository contains a canonical SigNoz capture from a known revision.

An early interface could have made those fresh runs look as though they were the captured execution. The data looked similar because the scenario was similar, but the identity was different.

The final product now compares the selected trace ID with the evidence-bundle trace ID. When they match, it shows "Trace identity verified." When they do not, it shows both IDs and labels the capture as a canonical reference. The UI never rewrites the selected run's identity.

That distinction made the demo more honest and the architecture stronger. Observability evidence is only useful when its provenance survives the path from storage to presentation.

## Closing the loop with a verification run

Sidekick does not treat a recommendation as proof of a fix. After selecting a remediation, it creates a linked verification run and evaluates the same latency, token, retrieval, cost, and tool guardrails.

The before-and-after view answers a more useful question than "Did the button work?": did the measured behavior improve without creating another regression?

Authenticated workspaces persist runs, notes, alert state, and remediation history in Supabase. PostgreSQL row-level security limits each workspace to its members. The no-login judge mode uses deterministic browser-local data and is clearly labeled so it is not confused with live tenant telemetry.

## What I learned

Three lessons changed the direction of this project:

1. Trace propagation is a product requirement, not just an instrumentation detail. If identity breaks at a service boundary, every later explanation becomes weaker.
2. Cross-signal correlation is more valuable than adding another chart. The failed span, threshold evaluation, and log should meet in one workflow.
3. A remediation needs a measured verification run. Otherwise the product is recommending changes without observing their effect.

If I extend Sidekick after the hackathon, the next step will be a secure public ingestion bridge and integration packages for external Python and TypeScript agent frameworks. The current repository proves the complete workflow with an instrumented agent and a reproducible SigNoz stack; the next version can make that onboarding plug-and-play.

AgentScope Sidekick is available here:

- Product: https://agentscope-sidekick.vercel.app/?demo=1
- Source: https://github.com/phanixdev/agentscope-sidekick

AI assistance disclosure: I used OpenAI Codex and ChatGPT during planning, implementation, testing, and editing. I reviewed the code, ran the verification suite, and checked the technical claims against the telemetry artifacts and official OpenTelemetry and SigNoz documentation.
