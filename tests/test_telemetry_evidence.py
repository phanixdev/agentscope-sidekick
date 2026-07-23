import pathlib
import subprocess
import sys
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "output" / "telemetry" / "otel-all-signals.txt"


class TelemetryEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
        with EVIDENCE.open("w", encoding="utf-8") as handle:
            subprocess.run(
                [sys.executable, "-m", "apps.agent.demo_agent"],
                cwd=ROOT,
                stdout=handle,
                stderr=subprocess.STDOUT,
                check=True,
                text=True,
            )
        cls.text = EVIDENCE.read_text(encoding="utf-8")

    def test_real_opentelemetry_span_output_is_captured(self):
        self.assertIn('"telemetry.sdk.name": "opentelemetry"', self.text)
        self.assertIn('"service.name": "agentscope-demo-agent"', self.text)
        self.assertIn('"service.namespace": "agentscope-sidekick"', self.text)

    def test_track_one_ai_attributes_are_present(self):
        self.assertIn('"gen_ai_request_model": "gpt-4o-mini"', self.text)
        self.assertIn('"gen_ai_usage_input_tokens"', self.text)
        self.assertIn('"retrieval_score"', self.text)
        self.assertIn('"tool_name": "search_docs"', self.text)

    def test_error_span_is_clean_and_sig_noz_ready(self):
        self.assertIn('"status_code": "ERROR"', self.text)
        self.assertIn('"http.status_code": 500', self.text)
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

