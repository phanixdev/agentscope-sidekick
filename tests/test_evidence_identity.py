import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class EvidenceIdentityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = (ROOT / "apps/web/src/data.js").read_text(encoding="utf-8")
        cls.incidents = (ROOT / "apps/api/incidents.py").read_text(encoding="utf-8")
        cls.mcp = (ROOT / "output/telemetry/mcp-failing-trace.json").read_text(encoding="utf-8-sig")

    def test_fixture_trace_ids_use_opentelemetry_format(self):
        trace_ids = re.findall(r'traceId: "([0-9a-f]+)"', self.data)
        self.assertGreaterEqual(len(trace_ids), 3)
        self.assertTrue(all(re.fullmatch(r"[0-9a-f]{32}", trace_id) for trace_id in trace_ids))

    def test_failed_fixture_matches_real_mcp_trace(self):
        trace_id = "70468b87b41bc6ecbe14d95f30ebcd2c"
        self.assertIn(f'traceId: "{trace_id}"', self.data)
        self.assertIn(f'trace_id="{trace_id}"', self.incidents)
        self.assertIn(trace_id, self.mcp)

    def test_anomalous_span_matches_real_mcp_span(self):
        span_id = "883a2e422369d0b9"
        self.assertIn(f'id: "{span_id}"', self.data)
        self.assertIn(span_id, self.mcp)


if __name__ == "__main__":
    unittest.main()
