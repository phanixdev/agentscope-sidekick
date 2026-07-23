import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class ProvenanceContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ui = (ROOT / "apps/web/src/main.jsx").read_text(encoding="utf-8")
        cls.service = (ROOT / "apps/web/src/lib/runService.js").read_text(encoding="utf-8")

    def test_observed_facts_are_separate_from_interpretation(self):
        self.assertIn("Observed facts", self.ui)
        self.assertIn("Rule interpretation", self.ui)
        self.assertIn("No LLM in the decision path", self.ui)

    def test_diagnosis_exposes_a_versioned_rule(self):
        self.assertIn("Rule ID", self.ui)
        self.assertIn("Rule version", self.ui)
        self.assertIn("track1-rules@1.0.0", self.ui)

    def test_evidence_contract_exposes_source_and_query(self):
        self.assertIn("SigNoz / OpenTelemetry", self.ui)
        self.assertIn("Metric query", self.ui)
        self.assertIn("trace + metric + log", self.ui)

    def test_database_attributes_can_override_provenance(self):
        self.assertIn("attributes: run.attributes ?? {}", self.service)
        for key in ("rule_id", "rule_version", "diagnosis_engine", "diagnosis_model", "prompt_version"):
            self.assertIn(key, self.ui)


if __name__ == "__main__":
    unittest.main()