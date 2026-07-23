import assert from "node:assert/strict";
import test from "node:test";

import { affectedRunsForAlert, evaluateAlert, runGuardrailState } from "../../apps/web/src/lib/alertRules.js";

const toolAlert = { metric: "agentscope.tool.calls", enabled: true };
const tokenAlert = { metric: "agentscope.agent.tokens_per_run.max", enabled: true };
const retrievalAlert = { metric: "agentscope.retrieval.score.min", enabled: true };
const latencyAlert = { metric: "agentscope.agent.duration.max", enabled: true };

const failed = {
  id: "run_failed",
  capturedAt: "2026-07-22T16:22:35Z",
  latency: 12.48,
  tokens: 2341,
  retrieval: 0.62,
  spans: [{ service: "tool", status: "error" }]
};
const verified = {
  ...failed,
  id: "run_verified",
  capturedAt: "2026-07-23T12:00:00Z",
  latency: 4.18,
  spans: [{ service: "tool", status: "ok" }],
  remediation: { role: "after" }
};

test("tool alert excludes successful verification reruns", () => {
  const affected = affectedRunsForAlert(toolAlert, [verified, failed]);
  assert.deepEqual(affected.map(({ run }) => run.id), ["run_failed"]);
  assert.equal(runGuardrailState(verified, [toolAlert]), "resolved");
});

test("each Track 1 guardrail evaluates its measured value", () => {
  assert.equal(evaluateAlert(toolAlert, failed).breached, true);
  assert.equal(evaluateAlert(tokenAlert, { ...verified, tokens: 18642 }).breached, true);
  assert.equal(evaluateAlert(retrievalAlert, { ...verified, retrieval: 0.18 }).breached, true);
  assert.equal(evaluateAlert(latencyAlert, failed).breached, true);
});

test("newest actual breach is selected first", () => {
  const newerFailure = { ...failed, id: "run_newer", capturedAt: "2026-07-23T13:00:00Z" };
  const affected = affectedRunsForAlert(toolAlert, [failed, verified, newerFailure]);
  assert.equal(affected[0].run.id, "run_newer");
});
