import pathlib
import re
import subprocess
import sys
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "output" / "telemetry" / "otel-all-signals.txt"


class TelemetryEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        result = subprocess.run(
            [sys.executable, "-m", "scripts.capture_canonical_trace"],
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=True,
            text=True,
        )
        cls.text = result.stdout

    def test_real_opentelemetry_span_output_is_captured(self):
        self.assertIn('"telemetry.sdk.name": "opentelemetry"', self.text)
        for service in (
            "agentscope-api", "agentscope-demo-agent", "agentscope-retrieval",
            "agentscope-tool-gateway", "agentscope-llm-gateway",
        ):
            self.assertIn(f'"service.name": "{service}"', self.text)
        self.assertIn('"service.namespace": "agentscope-sidekick"', self.text)

    def test_track_one_ai_attributes_are_present(self):
        self.assertIn('"gen_ai.request.model": "gpt-4o-mini"', self.text)
        self.assertIn('"gen_ai.usage.input_tokens"', self.text)
        self.assertIn('"agentscope.retrieval.score"', self.text)
        self.assertIn('"gen_ai.tool.name": "search_docs"', self.text)

    def test_canonical_trace_has_http_to_persistence_waterfall(self):
        for span_name in (
            "POST /demo/run", "invoke_agent ResearchAgent", "query knowledge_chunks",
            "execute_tool search_docs", "chat gpt-4o-mini", "INSERT agent_runs",
        ):
            self.assertIn(f'"name": "{span_name}"', self.text)
        self.assertIn('"http.request.method": "POST"', self.text)
        self.assertIn('"db.operation.name": "INSERT"', self.text)
        self.assertIn('"gen_ai.operation.name": "chat"', self.text)

    def test_canonical_waterfall_preserves_one_trace_id(self):
        trace_ids = set()
        for span_name in (
            "POST /demo/run", "invoke_agent ResearchAgent", "query knowledge_chunks",
            "execute_tool search_docs", "chat gpt-4o-mini", "INSERT agent_runs",
        ):
            start = self.text.index(f'"name": "{span_name}"')
            match = re.search(r'"trace_id": "(0x[0-9a-f]{32})"', self.text[start:start + 700])
            self.assertIsNotNone(match, span_name)
            trace_ids.add(match.group(1))
        self.assertEqual(len(trace_ids), 1)

    def test_error_span_is_clean_and_sig_noz_ready(self):
        self.assertIn('"status_code": "ERROR"', self.text)
        self.assertIn('"http.response.status_code": 500', self.text)
        self.assertIn('"agentscope.status": "error"', self.text)
        self.assertNotIn("agentscope_status_override", self.text)

    def test_metrics_are_exported_as_real_opentelemetry_signals(self):
        self.assertIn('"name": "agentscope.agent.runs"', self.text)
        self.assertIn('"name": "agentscope.agent.tokens"', self.text)
        self.assertIn('"name": "agentscope.agent.tokens_per_run"', self.text)
        self.assertIn('"name": "agentscope.retrieval.score"', self.text)
        self.assertIn('"name": "agentscope.tool.calls"', self.text)

    def test_error_logs_are_correlated_to_trace_and_span(self):
        self.assertIn('"body": "search_docs returned HTTP 500"', self.text)
        self.assertRegex(self.text, r'"trace_id": "0x[0-9a-f]{32}"')
        self.assertRegex(self.text, r'"span_id": "0x[0-9a-f]{16}"')


if __name__ == "__main__":
    unittest.main()

