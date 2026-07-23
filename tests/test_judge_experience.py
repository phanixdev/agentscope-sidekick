import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class JudgeExperienceContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ui = (ROOT / "apps/web/src/main.jsx").read_text(encoding="utf-8")
        cls.data = (ROOT / "apps/web/src/data.js").read_text(encoding="utf-8")
        cls.migration = (ROOT / "supabase/migrations/202607230001_initial_schema.sql").read_text(encoding="utf-8")

    def test_confidence_is_explainable(self):
        self.assertIn("3 signals corroborated", self.ui)
        self.assertIn("0.70 evidence baseline", self.ui)
        self.assertIn("Trace-correlated log", self.ui)

    def test_run_comparison_has_healthy_baselines(self):
        self.assertIn("Current run vs healthy baseline", self.ui)
        self.assertEqual(self.data.count("sampleSize:"), 3)
        self.assertIn("First divergent span", self.ui)

    def test_alerts_deep_link_to_investigation(self):
        self.assertIn("openAlertInvestigation", self.ui)
        self.assertIn("Opened from", self.ui)
        for metric in (
            "agentscope.tool.calls",
            "agentscope.agent.tokens_per_run.max",
            "agentscope.retrieval.score.min",
            "agentscope.agent.duration.max",
        ):
            self.assertIn(metric, self.ui)

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