from __future__ import annotations

from apps.api.models import AgentRun, Span


_SEED_RUNS = (
    AgentRun(
        id="run_7f3a1c9d",
        scenario="Tool failure",
        status="failed",
        trace_id="70468b87b41bc6ecbe14d95f30ebcd2c",
        latency_ms=12480,
        tokens=2341,
        retrieval_score=0.62,
        spans=(
            Span("ResearchAgent.run", "agent", 12480, "ok"),
            Span("LLM(gpt-4o-mini)", "llm", 9630, "ok"),
            Span("tool.search_docs", "tool", 2410, "error"),
            Span("tool.get_webpage", "tool", 1120, "ok"),
            Span("tool.summarize", "tool", 3090, "ok"),
        ),
        logs=(
            "ERROR tool.search_docs HTTP 500 Internal Server Error",
            "WARN ResearchAgent Tool call failed: search_docs",
        ),
    ),
    AgentRun(
        id="run_2c8b4e7a",
        scenario="Retrieval miss",
        status="completed",
        trace_id="56c25a68725eee566704bd5045279b36",
        latency_ms=3210,
        tokens=1203,
        retrieval_score=0.18,
        spans=(
            Span("AnalystAgent.run", "agent", 3210, "ok"),
            Span("vector_db.query", "retrieval", 420, "warn"),
            Span("LLM(gpt-4o-mini)", "llm", 1820, "ok"),
        ),
        logs=("WARN retrieval Low retrieval score: mean=0.18, results_used=1/5",),
    ),
    AgentRun(
        id="run_9d7e6b11",
        scenario="Token spike",
        status="completed",
        trace_id="65ebbf7700aad47c72dc3cc4c1df3574",
        latency_ms=6740,
        tokens=18642,
        retrieval_score=0.74,
        spans=(
            Span("PlannerAgent.run", "agent", 6740, "ok"),
            Span("retrieval.expand_context", "retrieval", 1740, "ok"),
            Span("LLM(gpt-4o-mini)", "llm", 3820, "warn"),
        ),
        logs=("WARN llm Token usage exceeded p95 baseline by 3.4x",),
    ),
)

_DYNAMIC_RUNS: list[AgentRun] = []


def list_runs() -> tuple[AgentRun, ...]:
    return tuple(_DYNAMIC_RUNS) + _SEED_RUNS


def get_run(run_id: str) -> AgentRun:
    for run in list_runs():
        if run.id == run_id:
            return run
    raise KeyError(run_id)


def record_demo_run(agent_result: dict[str, object]) -> AgentRun:
    scenario_slug = str(agent_result.get("scenario", "tool_failure"))
    scenario = _scenario_name(scenario_slug)
    trace_id = str(agent_result.get("trace_id", "unknown"))
    tokens = int(agent_result.get("tokens", 0))
    retrieval_score = float(agent_result.get("retrieval_score", 0.0))
    tool_status = str(agent_result.get("tool_status", "ok"))
    run = AgentRun(
        id=f"run_{trace_id[:8]}",
        scenario=scenario,
        status="failed" if tool_status == "error" else "completed",
        trace_id=trace_id,
        latency_ms=_latency_for(scenario_slug),
        tokens=tokens,
        retrieval_score=retrieval_score,
        spans=_spans_for(scenario_slug, tool_status),
        logs=_logs_for(scenario_slug, tool_status, retrieval_score),
    )
    _DYNAMIC_RUNS.insert(0, run)
    del _DYNAMIC_RUNS[5:]
    return run


def reset_demo_runs() -> None:
    _DYNAMIC_RUNS.clear()


def explain_run(run: AgentRun) -> dict[str, object]:
    error_spans = [span for span in run.spans if span.status == "error"]
    warn_spans = [span for span in run.spans if span.status == "warn"]

    if error_spans:
        cause = f"{error_spans[0].name} failed and is the strongest root-cause candidate."
    elif run.retrieval_score < 0.3:
        cause = "Retrieval quality is below the safe threshold, so the answer may be weakly grounded."
    elif run.tokens > 10_000:
        cause = "The run succeeded but exceeded the token budget baseline."
    elif warn_spans:
        cause = f"{warn_spans[0].name} emitted warning telemetry."
    else:
        cause = "No critical anomaly was detected in the captured telemetry."

    return {
        "run_id": run.id,
        "summary": cause,
        "evidence": [
            f"trace_id={run.trace_id}",
            f"latency_ms={run.latency_ms}",
            f"tokens={run.tokens}",
            f"retrieval_score={run.retrieval_score}",
            f"log_events={len(run.logs)}",
        ],
        "next_actions": _next_actions(run),
    }


def _scenario_name(scenario_slug: str) -> str:
    return {
        "tool_failure": "Tool failure",
        "retrieval_miss": "Retrieval miss",
        "token_spike": "Token spike",
    }.get(scenario_slug, "Tool failure")


def _latency_for(scenario_slug: str) -> int:
    return {
        "tool_failure": 12480,
        "retrieval_miss": 3210,
        "token_spike": 6740,
    }.get(scenario_slug, 5000)


def _spans_for(scenario_slug: str, tool_status: str) -> tuple[Span, ...]:
    if scenario_slug == "retrieval_miss":
        return (
            Span("AnalystAgent.run", "agent", 3210, "ok"),
            Span("vector_db.query", "retrieval", 420, "warn"),
            Span("tool.search_docs", "tool", 610, "ok"),
            Span("LLM(gpt-4o-mini)", "llm", 1820, "ok"),
        )
    if scenario_slug == "token_spike":
        return (
            Span("PlannerAgent.run", "agent", 6740, "ok"),
            Span("retrieval.expand_context", "retrieval", 1740, "ok"),
            Span("tool.search_docs", "tool", 720, "ok"),
            Span("LLM(gpt-4o-mini)", "llm", 3820, "warn"),
        )
    return (
        Span("ResearchAgent.run", "agent", 12480, "ok"),
        Span("vector_db.query", "retrieval", 660, "ok"),
        Span("tool.search_docs", "tool", 2410, "error" if tool_status == "error" else "ok"),
        Span("LLM(gpt-4o-mini)", "llm", 9630, "ok"),
    )


def _logs_for(scenario_slug: str, tool_status: str, retrieval_score: float) -> tuple[str, ...]:
    if scenario_slug == "retrieval_miss":
        return (f"WARN retrieval Low retrieval score: mean={retrieval_score}, results_used=1/5",)
    if scenario_slug == "token_spike":
        return ("WARN llm Token usage exceeded p95 baseline by 3.4x",)
    if tool_status == "error":
        return (
            "ERROR tool.search_docs HTTP 500 Internal Server Error",
            "WARN ResearchAgent Tool call failed: search_docs",
        )
    return ("INFO ResearchAgent Tool calls completed",)


def _next_actions(run: AgentRun) -> list[str]:
    if any(span.status == "error" for span in run.spans):
        return [
            "Inspect the failing tool span and upstream service health.",
            "Add a SigNoz alert for tool error rate.",
            "Increase retry telemetry before changing retry policy.",
        ]
    if run.retrieval_score < 0.3:
        return [
            "Tune retrieval filters and chunk selection.",
            "Require minimum source diversity before final response.",
            "Track retrieval hit rate by agent type.",
        ]
    if run.tokens > 10_000:
        return [
            "Add a token budget guardrail.",
            "Summarize context before planner prompts.",
            "Alert on token usage above 2x baseline.",
        ]
    return ["Keep monitoring the run baseline."]
