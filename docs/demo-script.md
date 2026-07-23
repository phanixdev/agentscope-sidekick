# 3-Minute Demo Script

## 0:00 - 0:20: Frame the problem

"AI agents are not a single request anymore. They retrieve context, call tools, make LLM requests, retry, and format responses. When something goes wrong, teams need to see inside the run, not guess from the final answer."

## 0:20 - 0:40: Establish SigNoz proof

Open SigNoz at http://127.0.0.1:8080. Show the imported AgentScope Sidekick - AI Agent Observability dashboard, then open the agentscope-demo-agent service and one recent trace. Mention that the same Foundry deployment also runs the SigNoz MCP server at port `8000`.

Say:

"Foundry reproduces this entire stack. The agent sends traces, metrics, and logs through OTLP, and its error logs carry the same trace and span IDs as the failing operation."

## 0:40 - 1:10: Show the Sidekick

Open AgentScope Sidekick at `http://127.0.0.1:5173`. Point out the run list, latency, tokens, retrieval score, trace timeline, and correlated logs.

## 1:10 - 1:45: Explain a tool failure

Click `Tool failure`, then `Explain Run`.

Say:

"`search_docs` returns HTTP 500. The Sidekick does not invent a root cause; it cites the error span, trace ID, token count, retrieval score, and correlated log, then gives operational next steps."

Show the red `tool.search_docs` span and the HTTP 500 log. Briefly return to SigNoz and filter by the new trace ID if time permits.

## 1:45 - 2:10: Separate quality from failure

Click `Retrieval miss`.

Say:

"This run completes, but retrieval confidence is below 0.3. Observability identifies weak context as the risk instead of blaming the model or a tool."

Show score below `0.3`, `1 / 5` results used, and the source-diversity action.

## 2:10 - 2:35: Catch invisible cost risk

Click `Token spike`.

Say:

"This run succeeds but uses 18,642 tokens. Success-only monitoring misses it; the token metric and budget alert do not."

Show the token card, GenAI attributes, and the provisioned AgentScope: token budget exceeded alert.

## 2:35 - 2:50: Show reproducibility

Open `infra/casting.yaml` and `infra/pours/deployment/compose.yaml`.

Say:

"The official Foundry casting installs SigNoz and MCP, then adds the Sidekick API, web UI, and demo agent. The generated lock makes the deployment reproducible for judges."

## 2:50 - 3:00: Close with Track 1 fit

"AgentScope Sidekick makes observability the product workflow. Traces explain execution, metrics expose latency and cost, logs correlate failures, and SigNoz dashboards, alerts, and MCP turn that telemetry into action."

