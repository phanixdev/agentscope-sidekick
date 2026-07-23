import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class MobileAlertContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.styles = (ROOT / "apps/web/src/styles.css").read_text(encoding="utf-8")

    def test_mobile_alerts_do_not_require_page_horizontal_scroll(self):
        self.assertIn(".alerts-table{overflow:visible}", self.styles)
        self.assertIn(".alert-row{min-width:0;grid-template-columns:minmax(0,1fr) auto", self.styles)

    def test_mobile_alert_rows_keep_operational_labels_visible(self):
        self.assertIn('content:"Rule state: "', self.styles)
        self.assertIn('content:"Affected: "', self.styles)
        self.assertIn(".alert-row>.alert-actions{grid-column:1/-1", self.styles)

    def test_mobile_investigation_keeps_all_lineage_steps_visible(self):
        self.assertIn(".investigation-lineage{grid-template-columns:1fr 1fr;gap:6px}", self.styles)
        self.assertNotIn(".investigation-lineage>span:nth-of-type(3)", self.styles)
        self.assertNotIn(".investigation-lineage>span:nth-of-type(4)", self.styles)


if __name__ == "__main__":
    unittest.main()
