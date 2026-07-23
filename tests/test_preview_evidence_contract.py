import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class PreviewEvidenceContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.service = (ROOT / "apps/web/src/lib/runService.js").read_text(encoding="utf-8")
        cls.ui = (ROOT / "apps/web/src/main.jsx").read_text(encoding="utf-8")
        cls.rules = (ROOT / "apps/web/src/lib/alertRules.js").read_text(encoding="utf-8")

    def test_ephemeral_runs_get_fresh_otel_identifiers(self):
        self.assertIn('const traceId = crypto.randomUUID().replaceAll("-", "")', self.service)
        self.assertIn('id: `run_${traceId.slice(0, 8)}`', self.service)
        self.assertIn('.slice(0, 16)', self.service)

    def test_ephemeral_sources_are_not_labeled_as_captured_signoz_proof(self):
        self.assertIn('evidence_source: "Ephemeral judge dataset"', self.service)
        self.assertIn('evidence_source: "Ephemeral verification rerun"', self.service)
        self.assertIn('run.attributes?.evidence_source ?? "SigNoz / OpenTelemetry"', self.ui)

    def test_tool_alert_compares_an_error_rate_with_its_threshold(self):
        self.assertIn("failures / toolSpans.length * 100", self.rules)
        self.assertIn("breached: rate > 5", self.rules)
        self.assertIn("tool spans", self.rules)


if __name__ == "__main__":
    unittest.main()
