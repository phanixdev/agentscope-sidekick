import json
import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class InfraArtifactTests(unittest.TestCase):
    def test_required_track_one_infra_files_exist(self):
        for relative in (
            "infra/casting.yaml",
            "infra/casting.yaml.lock",
            "infra/docker-compose.yml",
            "infra/otel/collector-config.yaml",
            "infra/signoz/dashboards.json",
            "infra/signoz/alerts.json",
            "infra/signoz/alerts.tf",
            "infra/signoz/.terraform.lock.hcl",
            "infra/signoz/README.md",
            "infra/pours/deployment/compose.yaml",
            "apps/api/Dockerfile",
            "apps/web/Dockerfile",
            "scripts/verify_demo.ps1",
            "scripts/start_demo.ps1",
            "docs/submission.md",
            "docs/demo-script.md",
            "docs/judging-checklist.md",
        ):
            self.assertTrue((ROOT / relative).exists(), relative)

    def test_casting_yaml_matches_current_foundry_schema(self):
        text = (ROOT / "infra/casting.yaml").read_text(encoding="utf-8")
        self.assertNotIn("`r`n", text)
        self.assertIn("apiVersion: v1alpha1", text)
        self.assertIn("kind: Installation", text)
        self.assertIn("mode: docker", text)
        self.assertIn("flavor: compose", text)
        self.assertRegex(text, r"mcp:\s+spec:\s+enabled: true")

    def test_casting_lock_is_generated_foundry_state(self):
        text = (ROOT / "infra/casting.yaml.lock").read_text(encoding="utf-8")
        self.assertIn("apiVersion: v1alpha1", text)
        self.assertIn("kind: Installation", text)
        self.assertIn("status:", text)
        self.assertGreater(len(text.splitlines()), 100)

        compose = (ROOT / "infra/pours/deployment/compose.yaml").read_text(encoding="utf-8")
        self.assertIn("signoz/signoz-mcp-server", compose)
        self.assertIn("agentscope-api:", compose)
        self.assertIn("agentscope-web:", compose)
        self.assertIn("agentscope-demo-agent:", compose)

    def test_signoz_dashboard_is_importable_v5(self):
        dashboard = json.loads((ROOT / "infra/signoz/dashboards.json").read_text(encoding="utf-8-sig"))
        self.assertEqual(dashboard["version"], "v5")
        self.assertGreaterEqual(len(dashboard["widgets"]), 7)

        widget_ids = [widget["id"] for widget in dashboard["widgets"]]
        layout_ids = [item["i"] for item in dashboard["layout"]]
        self.assertEqual(len(widget_ids), len(set(widget_ids)))
        self.assertCountEqual(widget_ids, layout_ids)

        data_sources = set()
        metric_names = set()
        for widget in dashboard["widgets"]:
            self.assertEqual(widget["query"]["queryType"], "builder")
            query_data = widget["query"]["builder"]["queryData"]
            self.assertTrue(query_data)
            for query in query_data:
                data_sources.add(query["dataSource"])
                for aggregation in query["aggregations"]:
                    if "metricName" in aggregation:
                        metric_names.add(aggregation["metricName"])

        self.assertEqual(data_sources, {"metrics", "traces", "logs"})
        self.assertTrue(
            {
                "agentscope.agent.runs",
                "agentscope.agent.tokens",
                "agentscope.agent.tokens_per_run.max",
                "agentscope.tool.calls",
            }.issubset(metric_names)
        )

    def test_signoz_alerts_are_deployable_and_documented(self):
        alerts = json.loads((ROOT / "infra/signoz/alerts.json").read_text(encoding="utf-8-sig"))
        terraform = (ROOT / "infra/signoz/alerts.tf").read_text(encoding="utf-8")
        self.assertGreaterEqual(len(alerts["alerts"]), 4)
        self.assertIn('source  = "SigNoz/signoz"', terraform)
        self.assertIn('resource "signoz_rule" "agent"', terraform)
        self.assertNotIn('resource "signoz_alert"', terraform)
        self.assertIn('version = "= 0.0.17"', terraform)
        self.assertIn('schema_version = "v2alpha1"', terraform)
        self.assertIn('match_type  = "at_least_once"', terraform)
        self.assertIn('operator         = "below"', terraform)
        for metric in (
            "agentscope.tool.calls",
            "agentscope.agent.tokens_per_run.max",
            "agentscope.retrieval.score.min",
            "agentscope.agent.duration.max",
        ):
            self.assertRegex(terraform, rf'metric\s+= "{re.escape(metric)}"')

    def test_submission_docs_name_track_one_story(self):
        submission = (ROOT / "docs/submission.md").read_text(encoding="utf-8")
        demo_script = (ROOT / "docs/demo-script.md").read_text(encoding="utf-8")
        checklist = (ROOT / "docs/judging-checklist.md").read_text(encoding="utf-8")
        self.assertIn("Track 1", submission)
        self.assertIn("OpenTelemetry", submission)
        self.assertIn("90-Second Track 1 Demo Script", demo_script)
        self.assertIn("Best Use of SigNoz", checklist)


if __name__ == "__main__":
    unittest.main()




