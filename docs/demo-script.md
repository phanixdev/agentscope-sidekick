# 90-Second Track 1 Demo Script

## 0:00 - 0:10: The Operational Problem

"An agent can return one answer while hiding retrieval, tool calls, LLM work, retries, latency, and cost. AgentScope Sidekick turns that execution into an incident workflow backed by SigNoz and OpenTelemetry."

Show the product run list and select the failed `Tool failure` run.

## 0:10 - 0:25: Show the Telemetry

Show the live SigNoz trace proof, then the dashboard and alert proof.

"One trace crosses the API, agent, retrieval, tool gateway, LLM gateway, and persistence. The failing tool span, latency metric, and HTTP 500 log share correlated trace evidence."

## 0:25 - 0:45: Explain the Failure

Return to **Explain**, then open **Evidence**.

"The diagnosis is deterministic. Three out of three signals corroborate the root cause: the failed `search_docs` span, a run above the ten-second latency guardrail, and the trace-correlated HTTP 500 log. The evidence panel exposes the rule ID, version, metric query, span ID, and confirms that no LLM is in the decision path."

## 0:45 - 0:58: Compare the Run

Open **Compare**.

"Judge mode clearly labels its fixed reference cohort. Authenticated workspaces instead compute tenant-scoped healthy baselines from completed Supabase runs, with a minimum-sample gate and row-level security."

## 0:58 - 1:18: Verify a Fix

Open **Remediate** and choose **Apply and run verification**.

"Sidekick does not stop at a recommendation. It applies the selected action, creates a correlated rerun, and verifies latency, tokens, retrieval quality, cost, and tool guardrails."

Pause on **Remediation verified** and the before/after table.

## 1:18 - 1:30: Wrap Up

Show the architecture flow and finish on the production product.

"This is Track 1 observability as a complete product: OpenTelemetry-native traces, metrics, and logs in SigNoz; evidence-backed diagnosis; secure multi-tenant persistence; and a verified remediation loop."

## Recording Notes

- Record at 1920x1080 and export as MP4.
- Keep the cursor normal and out of the evidence text.
- Use direct cuts between proof screens; avoid zoom effects and decorative transitions.
- Keep production and repository URLs readable in the final frame.
- Do not claim the deterministic judge cohort is live telemetry.
