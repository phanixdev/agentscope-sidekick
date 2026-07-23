import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class InvestigationLineageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ui = (ROOT / "apps/web/src/main.jsx").read_text(encoding="utf-8")
        cls.styles = (ROOT / "apps/web/src/styles.css").read_text(encoding="utf-8")

    def test_alert_investigation_exposes_auditable_lineage(self):
        self.assertIn('aria-label="Investigation lineage"', self.ui)
        for step in ("1 · Alert", "2 · Breach", "3 · Trace", "4 · Decision"):
            self.assertIn(step, self.ui)
        self.assertIn("alertContext.observed", self.ui)
        self.assertIn("run.traceId", self.ui)

    def test_lineage_has_mobile_layout(self):
        self.assertIn(".investigation-lineage", self.styles)
        self.assertIn("@media(max-width:560px)", self.styles)


if __name__ == "__main__":
    unittest.main()
