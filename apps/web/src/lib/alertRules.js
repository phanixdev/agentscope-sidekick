const ruleEvaluators = {
  "agentscope.tool.calls": (run) => {
    const toolSpans = run.spans.filter((span) => span.service === "tool");
    const failures = toolSpans.filter((span) => span.status === "error").length;
    const rate = toolSpans.length ? failures / toolSpans.length * 100 : 0;
    return { breached: rate > 5, value: rate, displayValue: `${rate.toFixed(0)}% (${failures}/${toolSpans.length} tool spans)` };
  },
  "agentscope.agent.tokens_per_run.max": (run) => ({
    breached: run.tokens > 12000,
    value: run.tokens,
    displayValue: `${run.tokens.toLocaleString()} tokens`
  }),
  "agentscope.retrieval.score.min": (run) => ({
    breached: run.retrieval < 0.30,
    value: run.retrieval,
    displayValue: `${run.retrieval.toFixed(2)} score`
  }),
  "agentscope.agent.duration.max": (run) => ({
    breached: run.latency > 10,
    value: run.latency,
    displayValue: `${run.latency.toFixed(2)}s`
  })
};

export function evaluateAlert(alert, run) {
  const evaluate = ruleEvaluators[alert.metric];
  return evaluate ? evaluate(run) : { breached: false, value: null, displayValue: "No evaluator" };
}

export function affectedRunsForAlert(alert, runs) {
  return runs
    .map((run, index) => ({ run, index, evaluation: evaluateAlert(alert, run) }))
    .filter(({ evaluation }) => evaluation.breached)
    .sort((left, right) => {
      const leftTime = Date.parse(left.run.startedAt ?? left.run.capturedAt ?? "");
      const rightTime = Date.parse(right.run.startedAt ?? right.run.capturedAt ?? "");
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return rightTime - leftTime;
      return left.index - right.index;
    });
}

export function runGuardrailState(run, alerts) {
  if (run.remediation?.role === "after") return "resolved";
  return alerts.some((alert) => alert.enabled && evaluateAlert(alert, run).breached) ? "active" : "healthy";
}
