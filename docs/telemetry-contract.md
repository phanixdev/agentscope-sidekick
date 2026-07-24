# End-to-End Telemetry Contract

The canonical Track 1 trace follows one request through every decision-bearing component:

```text
POST /demo/run                         service: agentscope-api
└── invoke_agent ResearchAgent        service: agentscope-demo-agent
    ├── query knowledge_chunks        service: agentscope-retrieval
    ├── execute_tool search_docs      service: agentscope-tool-gateway
    └── chat gpt-4o-mini              service: agentscope-llm-gateway
└── INSERT agent_runs                 service: agentscope-api
```

All child spans preserve the HTTP trace ID. Logs emitted during retrieval, tool execution, and completion inherit the active trace/span context. Metrics use the same scenario and agent dimensions.

## Semantic Conventions

- HTTP: `http.request.method`, `http.route`, `http.response.status_code`, and `server.address`.
- Database: `db.system.name`, `db.operation.name`, and `db.collection.name`.
- GenAI: `gen_ai.operation.name`, `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, agent identity, workflow, retrieval, and tool attributes.
- Product guardrails: `agentscope.scenario`, `agentscope.retrieval.score`, `agentscope.token_budget_exceeded`, `agentscope.status`, and `agentscope.trace_id`.

Prompt or retrieved-document contents are deliberately excluded. The trace records operational metadata without exporting user content.

## Reproduce

```bash
python -m scripts.capture_canonical_trace > output/telemetry/canonical-trace.txt
```

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to send the same hierarchy to SigNoz over OTLP/HTTP. Without an endpoint, the script emits SDK-native console JSON suitable for CI verification.