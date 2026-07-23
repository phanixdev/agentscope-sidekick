import unittest

from apps.api.incidents import explain_run, get_run, list_runs


class ExplanationTests(unittest.TestCase):
    def test_lists_three_track_one_scenarios(self):
        scenarios = {run.scenario for run in list_runs()}
        self.assertEqual(scenarios, {"Tool failure", "Retrieval miss", "Token spike"})

    def test_tool_failure_explanation_cites_failing_span(self):
        explanation = explain_run(get_run("run_7f3a1c9d"))
        self.assertIn("tool.search_docs", explanation["summary"])
        self.assertIn("trace_id=a1b2c3d", explanation["evidence"])

    def test_retrieval_miss_uses_retrieval_score(self):
        explanation = explain_run(get_run("run_2c8b4e7a"))
        self.assertIn("Retrieval quality", explanation["summary"])
        self.assertIn("retrieval_score=0.18", explanation["evidence"])

    def test_token_spike_uses_token_budget(self):
        explanation = explain_run(get_run("run_9d7e6b11"))
        self.assertIn("token budget", explanation["summary"])
        self.assertIn("tokens=18642", explanation["evidence"])


if __name__ == "__main__":
    unittest.main()
