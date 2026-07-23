import assert from "node:assert/strict";
import test from "node:test";

import { affectedRunsForAlert, evaluateAlert, runGuardrailState } from "../../apps/web/src/lib/alertRules.js";

const healthy = {
  id: "run_healthy",
  latency: 4.2,
  tokens: 2200,
  retrieval: 0.72,
  spans: [{ service: "tool", status: "ok" }]
};

test("unknown metrics fail closed instead of inventing a breach", () => {
  const evaluation = evaluateAlert({ metric: "agentscope.unknown" }, healthy);
  assert.deepEqual(evaluation, { breached: false, value: null, displayValue: "No evaluator" });
});

test("disabled rules do not mark a healthy run as operationally active", () => {
  const latencyAlert = { metric: "agentscope.agent.duration.max", enabled: false };
  assert.equal(runGuardrailState({ ...healthy, latency: 14 }, [latencyAlert]), "healthy");
});

test("safe values produce no affected runs", () => {
  const alerts = [
    { metric: "agentscope.tool.calls" },
    { metric: "agentscope.agent.tokens_per_run.max" },
    { metric: "agentscope.retrieval.score.min" },
    { metric: "agentscope.agent.duration.max" }
  ];
  for (const alert of alerts) assert.equal(affectedRunsForAlert(alert, [healthy]).length, 0);
});
