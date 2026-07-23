import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class SecurityPostureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.initial = (ROOT / "supabase/migrations/202607230001_initial_schema.sql").read_text(encoding="utf-8")
        cls.remediation = (ROOT / "supabase/migrations/202607230004_closed_loop_remediation.sql").read_text(encoding="utf-8")
        cls.hardening = (ROOT / "supabase/migrations/202607230005_security_hardening.sql").read_text(encoding="utf-8")
        cls.proof = (ROOT / "supabase/tests/rls_isolation.sql").read_text(encoding="utf-8")
        cls.docs = (ROOT / "docs/security.md").read_text(encoding="utf-8")

    def test_every_product_table_enables_rls(self):
        migrations = self.initial + self.remediation
        for table in (
            "profiles", "workspaces", "workspace_members", "agent_runs", "run_spans",
            "run_logs", "alert_rules", "investigation_notes", "remediations",
        ):
            self.assertIn(f"alter table public.{table} enable row level security", migrations)

    def test_sensitive_rpcs_are_not_public_or_anonymous(self):
        for signature in (
            "public.create_demo_run(text)",
            "public.get_healthy_baselines(uuid, integer, integer)",
            "public.run_remediation(uuid, text)",
        ):
            self.assertIn(f"revoke execute on function {signature} from public, anon;", self.hardening)
            self.assertIn(f"grant execute on function {signature} to authenticated;", self.hardening)

    def test_note_updates_require_current_membership(self):
        self.assertGreaterEqual(
            self.hardening.count("public.is_workspace_member(public.run_workspace_id(run_id))"),
            2,
        )

    def test_executable_policy_proof_covers_denial_and_grants(self):
        self.assertIn("select plan(12);", self.proof)
        self.assertIn("Anonymous users cannot execute remediations", self.proof)
        self.assertIn("Authenticated users can execute a scoped remediation", self.proof)
        self.assertIn("select * from finish();", self.proof)
        self.assertIn("rollback;", self.proof)

    def test_security_document_explains_verification(self):
        self.assertIn("npx supabase test db", self.docs)
        self.assertIn("No service-role credential", self.docs)
        self.assertIn("tenant-isolation", self.docs.lower())


if __name__ == "__main__":
    unittest.main()