import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class RemediationWorkflowContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ui = (ROOT / "apps/web/src/main.jsx").read_text(encoding="utf-8")
        cls.service = (ROOT / "apps/web/src/lib/runService.js").read_text(encoding="utf-8")
        cls.migration = (ROOT / "supabase/migrations/202607230004_closed_loop_remediation.sql").read_text(encoding="utf-8")

    def test_ui_closes_the_investigation_loop(self):
        self.assertIn('"remediate", "Remediate"', self.ui)
        self.assertIn("Apply and run verification", self.ui)
        self.assertIn("Remediation verified", self.ui)
        self.assertIn("Guardrails passed", self.ui)

    def test_preview_rerun_has_improved_telemetry(self):
        self.assertIn("previewRemediationRun", self.service)
        self.assertIn('status: "completed"', self.service)
        self.assertIn('role: "after"', self.service)
        self.assertIn("Verification rerun passed", self.service)

    def test_persisted_remediation_is_tenant_isolated(self):
        self.assertIn("alter table public.remediations enable row level security", self.migration)
        self.assertIn('create policy "members can view remediations"', self.migration)
        self.assertIn("public.is_workspace_member(source_run.workspace_id)", self.migration)
        self.assertIn("before_snapshot", self.migration)
        self.assertIn("after_run_id", self.migration)

    def test_verification_run_preserves_traceable_lineage(self):
        self.assertIn("remediation_of", self.migration)
        self.assertIn("run_remediation", self.migration)
        self.assertIn("Verification rerun passed", self.migration)


if __name__ == "__main__":
    unittest.main()