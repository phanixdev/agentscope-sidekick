from dataclasses import dataclass


@dataclass(frozen=True)
class Span:
    name: str
    service: str
    duration_ms: int
    status: str


@dataclass(frozen=True)
class AgentRun:
    id: str
    scenario: str
    status: str
    trace_id: str
    latency_ms: int
    tokens: int
    retrieval_score: float
    spans: tuple[Span, ...]
    logs: tuple[str, ...]
