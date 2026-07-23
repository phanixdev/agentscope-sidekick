import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class JudgeExperienceContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ui = (ROOT / "apps/web/src/main.jsx").read_text(encoding="utf-8")
        cls.alert_rules = (ROOT / "apps/web/src/lib/alertRules.js").read_text(encoding="utf-8")
        cls.data = (ROOT / "apps/web/src/data.js").read_text(encoding="utf-8")
        cls.migration = (ROOT / "supabase/migrations/202607230001_initial_schema.sql").read_text(encoding="utf-8")
        cls.baseline_migration = (ROOT / "supabase/migrations/202607230003_observed_healthy_baselines.sql").read_text(encoding="utf-8")

    def test_confidence_is_explainable(self):
        self.assertIn("3 signals corroborated", self.ui)
        self.assertIn("Heuristic evidence indicator, not a statistical probability.", self.ui)
        self.assertIn("Trace-correlated log", self.ui)

    def test_run_comparison_discloses_reference_provenance(self):
        self.assertIn("deterministic reference", self.ui)
        self.assertIn("Versioned judge fixture", self.data)
        self.assertIn("Reference data", self.ui)
        self.assertEqual(self.data.count("sampleSize:"), 3)
        self.assertIn("First divergent span", self.ui)

    def test_observed_baseline_is_tenant_scoped_and_sample_gated(self):
        self.assertIn("public.is_workspace_member(run.workspace_id)", self.baseline_migration)
        self.assertIn("having count(*) >= greatest(1, required_samples)", self.baseline_migration)
        self.assertIn("run.status = 'completed'", self.baseline_migration)
        self.assertIn("span.status = 'error'", self.baseline_migration)

    def test_alerts_deep_link_to_investigation(self):
        self.assertIn("openAlertInvestigation", self.ui)
        self.assertIn("Opened from", self.ui)
        for metric in (
            "agentscope.tool.calls",
            "agentscope.agent.tokens_per_run.max",
            "agentscope.retrieval.score.min",
            "agentscope.agent.duration.max",
        ):
            self.assertIn(metric, self.alert_rules)
        self.assertIn("affectedRunsForAlert(alert, runs)", self.ui)
        self.assertIn("strongest.run", self.ui)
        self.assertIn("observed {alertContext.observed}", self.ui)


    def test_ephemeral_and_resolved_states_are_explicit(self):
        self.assertIn("ephemeral demo", self.ui)
        self.assertIn("resets on refresh", self.ui)
        self.assertIn("Active guardrail breaches", self.ui)
        self.assertIn("Resolved by verification", self.ui)
        self.assertIn("Remediation verification", (ROOT / "apps/web/src/lib/runService.js").read_text(encoding="utf-8"))

    def test_slo_view_uses_operational_guardrails(self):
        for label in ("Run success", "p95 latency", "Tool reliability", "Token compliance", "Retrieval quality"):
            self.assertIn(label, self.ui)

    def test_all_user_facing_tables_enable_rls(self):
        for table in (
            "profiles", "workspaces", "workspace_members", "agent_runs", "run_spans",
            "run_logs", "alert_rules", "investigation_notes",
        ):
            self.assertIn(f"alter table public.{table} enable row level security;", self.migration)
        self.assertIn('create policy "admins can edit alerts"', self.migration)
        self.assertIn('create policy "members can view own notes"', self.migration)


if __name__ == "__main__":
    unittest.main()