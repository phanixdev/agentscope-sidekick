from __future__ import annotations

import json
import os
from dataclasses import asdict
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

from apps.agent.demo_agent import create_component_tracer, flush_telemetry, run_demo_agent, span
from apps.api.incidents import explain_run, get_run, list_runs, record_demo_run


API_TRACER = create_component_tracer("agentscope-api", "agentscope.api")


def execute_demo_run(scenario: str, server_address: str = "agentscope-api"):
    with span(
        "POST /demo/run",
        span_kind="server",
        tracer_override=API_TRACER,
        **{
            "http.request.method": "POST",
            "http.route": "/demo/run",
            "server.address": server_address,
            "agentscope.component": "api",
        },
    ) as request_span:
        agent_result = run_demo_agent(scenario)
        with span(
            "INSERT agent_runs",
            tracer_override=API_TRACER,
            **{
                "db.system.name": "in_memory",
                "db.operation.name": "INSERT",
                "db.collection.name": "agent_runs",
                "agentscope.component": "persistence",
            },
        ):
            created = record_demo_run(agent_result)
        if request_span:
            request_span.set_attribute("http.response.status_code", 200)
            request_span.set_attribute("agentscope.trace_id", created.trace_id)
    flush_telemetry()
    return created


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._json({"status": "ok"})
            return
        if parsed.path == "/incidents":
            self._json([asdict(run) for run in list_runs()])
            return
        if parsed.path.startswith("/incidents/"):
            run_id = parsed.path.rsplit("/", 1)[-1]
            self._json(asdict(get_run(run_id)))
            return
        self.send_error(404)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.endswith("/explain") and parsed.path.startswith("/incidents/"):
            run_id = parsed.path.split("/")[2]
            self._json(explain_run(get_run(run_id)))
            return
        if parsed.path == "/demo/run":
            payload = self._read_json()
            scenario = str(payload.get("scenario", "tool_failure"))
            created = execute_demo_run(
                scenario,
                self.headers.get("Host", "agentscope-api").split(":", 1)[0],
            )
            self._json({"created": asdict(created)})
            return
        self.send_error(404)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def _read_json(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length == 0:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except json.JSONDecodeError:
            return {}

    def _cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, payload: object) -> None:
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(200)
        self._cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    host = os.getenv("AGENTSCOPE_API_HOST", "0.0.0.0")
    port = int(os.getenv("AGENTSCOPE_API_PORT", "8088"))
    server = HTTPServer((host, port), Handler)
    print(f"AgentScope API listening on http://{host}:{port}")
    server.serve_forever()
