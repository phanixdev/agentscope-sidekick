from __future__ import annotations

import logging
import os
import random
import time
from contextlib import contextmanager
from uuid import uuid4

try:
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
    from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
    from opentelemetry.sdk._logs.export import BatchLogRecordProcessor, ConsoleLogRecordExporter
    from opentelemetry.sdk.metrics import MeterProvider
    from opentelemetry.sdk.metrics.export import ConsoleMetricExporter, PeriodicExportingMetricReader
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
    from opentelemetry.trace import SpanKind, Status, StatusCode
except Exception:  # pragma: no cover - fallback supports minimal Python environments
    trace = None
    OTLPLogExporter = None
    OTLPMetricExporter = None
    OTLPSpanExporter = None
    LoggerProvider = None
    LoggingHandler = None
    BatchLogRecordProcessor = None
    ConsoleLogRecordExporter = None
    MeterProvider = None
    ConsoleMetricExporter = None
    PeriodicExportingMetricReader = None
    Resource = None
    TracerProvider = None
    BatchSpanProcessor = None
    ConsoleSpanExporter = None
    SpanKind = None
    Status = None
    StatusCode = None


RESOURCE_ATTRIBUTES = {
    "service.name": "agentscope-demo-agent",
    "service.namespace": "agentscope-sidekick",
    "deployment.environment": os.getenv("AGENTSCOPE_ENV", "local-demo"),
    "hackathon.track": "ai-agent-observability",
}


def _signal_endpoint(signal: str) -> str | None:
    explicit = os.getenv(f"OTEL_EXPORTER_OTLP_{signal.upper()}_ENDPOINT")
    if explicit:
        return explicit
    base = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if base:
        return f"{base.rstrip('/')}/v1/{signal}"
    trace_endpoint = os.getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT")
    if trace_endpoint:
        return trace_endpoint.removesuffix("/v1/traces") + f"/v1/{signal}"
    return None


def _configure_telemetry() -> dict[str, object]:
    if trace is None:
        return {}

    resource = Resource.create(RESOURCE_ATTRIBUTES)

    tracer_provider = TracerProvider(resource=resource)
    trace_endpoint = _signal_endpoint("traces")
    span_exporter = OTLPSpanExporter(endpoint=trace_endpoint) if trace_endpoint else ConsoleSpanExporter()
    tracer_provider.add_span_processor(BatchSpanProcessor(span_exporter))
    trace.set_tracer_provider(tracer_provider)

    metric_endpoint = _signal_endpoint("metrics")
    metric_exporter = OTLPMetricExporter(endpoint=metric_endpoint) if metric_endpoint else ConsoleMetricExporter()
    metric_reader = PeriodicExportingMetricReader(metric_exporter, export_interval_millis=60_000)
    meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
    meter = meter_provider.get_meter("agentscope.demo_agent")

    log_endpoint = _signal_endpoint("logs")
    log_exporter = OTLPLogExporter(endpoint=log_endpoint) if log_endpoint else ConsoleLogRecordExporter()
    logger_provider = LoggerProvider(resource=resource)
    logger_provider.add_log_record_processor(BatchLogRecordProcessor(log_exporter))
    handler = LoggingHandler(level=logging.INFO, logger_provider=logger_provider)
    telemetry_logger = logging.getLogger("agentscope.telemetry")
    telemetry_logger.handlers.clear()
    telemetry_logger.addHandler(handler)
    telemetry_logger.setLevel(logging.INFO)
    telemetry_logger.propagate = False

    return {
        "tracer_provider": tracer_provider,
        "tracer": tracer_provider.get_tracer("agentscope.demo_agent"),
        "meter_provider": meter_provider,
        "logger_provider": logger_provider,
        "logger": telemetry_logger,
        "runs": meter.create_counter("agentscope.agent.runs", unit="{run}"),
        "tokens": meter.create_counter("agentscope.agent.tokens", unit="{token}"),
        "tokens_per_run": meter.create_histogram("agentscope.agent.tokens_per_run", unit="{token}"),
        "duration": meter.create_histogram("agentscope.agent.duration", unit="ms"),
        "retrieval": meter.create_histogram("agentscope.retrieval.score", unit="1"),
        "tools": meter.create_counter("agentscope.tool.calls", unit="{call}"),
    }


TELEMETRY = _configure_telemetry()
TRACER = TELEMETRY.get("tracer")
COMPONENT_PROVIDERS: list[object] = []


def create_component_tracer(service_name: str, scope_name: str):
    if trace is None:
        return None
    resource = Resource.create({**RESOURCE_ATTRIBUTES, "service.name": service_name})
    provider = TracerProvider(resource=resource)
    trace_endpoint = _signal_endpoint("traces")
    exporter = OTLPSpanExporter(endpoint=trace_endpoint) if trace_endpoint else ConsoleSpanExporter()
    provider.add_span_processor(BatchSpanProcessor(exporter))
    COMPONENT_PROVIDERS.append(provider)
    return provider.get_tracer(scope_name)


RETRIEVAL_TRACER = create_component_tracer("agentscope-retrieval", "agentscope.retrieval")
TOOL_TRACER = create_component_tracer("agentscope-tool-gateway", "agentscope.tools")
LLM_TRACER = create_component_tracer("agentscope-llm-gateway", "agentscope.llm")


@contextmanager
def span(name: str, **attributes: object):
    start = time.perf_counter()
    status = str(attributes.pop("agentscope_status_override", "ok"))
    tracer_override = attributes.pop("tracer_override", TRACER)
    kind_name = str(attributes.pop("span_kind", "internal")).upper()
    span_kind = getattr(SpanKind, kind_name, SpanKind.INTERNAL) if SpanKind else None
    active_span = None
    context = tracer_override.start_as_current_span(name, kind=span_kind) if tracer_override else None
    try:
        if context:
            active_span = context.__enter__()
            for key, value in attributes.items():
                active_span.set_attribute(key, value)
        yield active_span
    except Exception as exc:
        status = "error"
        if active_span:
            active_span.record_exception(exc)
            active_span.set_attribute("agentscope.error", True)
        raise
    finally:
        duration_ms = int((time.perf_counter() - start) * 1000)
        if active_span:
            active_span.set_attribute("agentscope.duration_ms", duration_ms)
            active_span.set_attribute("agentscope.status", status)
            if Status is not None and StatusCode is not None and status == "error":
                active_span.set_status(Status(StatusCode.ERROR, "AgentScope scenario error"))
            context.__exit__(None, None, None)
        else:
            print({"span": name, "status": status, "duration_ms": duration_ms, "attributes": attributes})


def run_demo_agent(scenario: str = "tool_failure") -> dict[str, object]:
    started = time.perf_counter()
    fallback_trace_id = uuid4().hex
    with span(
        "invoke_agent ResearchAgent",
        agentscope_status_override="error" if scenario == "tool_failure" else "warn" if scenario in {"retrieval_miss", "token_spike"} else "ok",
        **{
            "gen_ai.operation.name": "invoke_agent",
            "gen_ai.agent.name": "ResearchAgent",
            "gen_ai.agent.id": "research-agent-v1",
            "gen_ai.workflow.name": "agentscope-investigation",
            "agentscope.scenario": scenario,
        },
    ) as root_span:
        trace_id = fallback_trace_id
        if root_span and root_span.get_span_context().is_valid:
            trace_id = format(root_span.get_span_context().trace_id, "032x")
            root_span.set_attribute("agentscope.trace_id", trace_id)

        retrieval_score = _retrieve(scenario)
        tool_status = _call_tools(scenario)
        token_count = _call_llm(scenario)
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        attributes = {"scenario": scenario, "agent_name": "ResearchAgent"}

        _record_metric("runs", 1, attributes)
        _record_metric("tokens", token_count, attributes)
        _record_metric("tokens_per_run", token_count, attributes)
        _record_metric("duration", duration_ms, attributes)
        _record_metric("retrieval", retrieval_score, attributes)
        _emit_log(
            logging.ERROR if tool_status == "error" else logging.INFO,
            "agent run completed",
            scenario=scenario,
            trace_id=trace_id,
            tool_status=tool_status,
            token_count=token_count,
            retrieval_score=retrieval_score,
        )
        return {
            "trace_id": trace_id,
            "scenario": scenario,
            "retrieval_score": retrieval_score,
            "tool_status": tool_status,
            "tokens": token_count,
        }


def _record_metric(name: str, value: int | float, attributes: dict[str, str]) -> None:
    if TRACER is None:
        return
    instrument = TELEMETRY.get(name)
    if instrument is None:
        return
    if name in {"duration", "retrieval", "tokens_per_run"}:
        instrument.record(value, attributes)
    else:
        instrument.add(value, attributes)


def _emit_log(level: int, message: str, **attributes: object) -> None:
    logger = TELEMETRY.get("logger") if TRACER else None
    if logger:
        logger.log(level, message, extra={str(key): value for key, value in attributes.items()})
    else:
        print({"log": message, "level": logging.getLevelName(level), "attributes": attributes})


def _retrieve(scenario: str) -> float:
    score = 0.18 if scenario == "retrieval_miss" else 0.62 + random.random() * 0.2
    score = round(score, 2)
    with span(
        "query knowledge_chunks",
        span_kind="client",
        tracer_override=RETRIEVAL_TRACER,
        **{
            "db.system.name": "qdrant",
            "db.operation.name": "query",
            "db.collection.name": "knowledge_chunks",
            "server.address": "vector-db",
            "gen_ai.operation.name": "retrieval",
            "agentscope.retrieval.score": score,
            "agentscope.retrieval.results_used": 1 if score < 0.3 else 3,
            "otel.signal": "trace",
        },
    ):
        _emit_log(logging.WARNING if score < 0.3 else logging.INFO, "retrieval completed", retrieval_score=score)
        return score


def _call_tools(scenario: str) -> str:
    status = "error" if scenario == "tool_failure" else "ok"
    with span(
        "execute_tool search_docs",
        span_kind="client",
        tracer_override=TOOL_TRACER,
        agentscope_status_override=status,
        **{
            "gen_ai.operation.name": "execute_tool",
            "gen_ai.tool.name": "search_docs",
            "gen_ai.tool.type": "function",
            "server.address": "document-search",
            "otel.signal": "trace",
        },
    ) as active_span:
        _record_metric("tools", 1, {"tool_name": "search_docs", "status": status})
        if scenario == "tool_failure":
            if active_span:
                active_span.set_attribute("http.response.status_code", 500)
                active_span.set_attribute("error.type", "upstream_unavailable")
            _emit_log(logging.ERROR, "search_docs returned HTTP 500", tool_name="search_docs", http_status_code=500)
            return "error"
    with span("execute_tool summarize", tracer_override=TOOL_TRACER, **{"gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "summarize", "gen_ai.tool.type": "function", "otel.signal": "trace"}):
        _record_metric("tools", 1, {"tool_name": "summarize", "status": "ok"})
        return "ok"


def _call_llm(scenario: str) -> int:
    tokens = 18_642 if scenario == "token_spike" else 2_341
    with span(
        "chat gpt-4o-mini",
        span_kind="client",
        tracer_override=LLM_TRACER,
        **{
            "gen_ai.operation.name": "chat",
            "gen_ai.provider.name": "openai",
            "gen_ai.request.model": "gpt-4o-mini",
            "gen_ai.usage.input_tokens": int(tokens * 0.82),
            "gen_ai.usage.output_tokens": int(tokens * 0.18),
            "server.address": "api.openai.com",
            "agentscope.token_budget_exceeded": tokens > 10_000,
            "otel.signal": "trace",
        },
    ):
        if tokens > 10_000:
            _emit_log(logging.WARNING, "token budget exceeded", token_count=tokens, model="gpt-4o-mini")
        return tokens


def flush_telemetry() -> None:
    for provider_name in ("tracer_provider", "meter_provider", "logger_provider"):
        provider = TELEMETRY.get(provider_name)
        if provider:
            provider.force_flush(timeout_millis=10_000)
    for provider in COMPONENT_PROVIDERS:
        provider.force_flush(timeout_millis=10_000)


if __name__ == "__main__":
    for scenario_name in ("tool_failure", "retrieval_miss", "token_spike"):
        print(run_demo_agent(scenario_name))
    flush_telemetry()


