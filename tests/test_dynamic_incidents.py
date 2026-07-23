import unittest

from apps.api.incidents import explain_run, get_run, list_runs, record_demo_run, reset_demo_runs


class DynamicIncidentTests(unittest.TestCase):
    def tearDown(self):
        reset_demo_runs()

    def test_recorded_demo_run_appears_first(self):
        created = record_demo_run(
            {
                "trace_id": "abc123def4567890",
                "scenario": "token_spike",
                "retrieval_score": 0.74,
                "tool_status": "ok",
                "tokens": 18642,
            }
        )
        runs = list_runs()
        self.assertEqual(runs[0].id, created.id)
        self.assertEqual(runs[0].scenario, "Token spike")
        self.assertEqual(runs[0].tokens, 18642)

    def test_dynamic_tool_failure_can_be_explained(self):
        created = record_demo_run(
            {
                "trace_id": "feedfacecafebeef",
                "scenario": "tool_failure",
                "retrieval_score": 0.66,
                "tool_status": "error",
                "tokens": 2341,
            }
        )
        fetched = get_run(created.id)
        explanation = explain_run(fetched)
        self.assertEqual(fetched.status, "failed")
        self.assertIn("tool.search_docs", explanation["summary"])
        self.assertIn("trace_id=feedfacecafebeef", explanation["evidence"])

    def test_reset_demo_runs_restores_seed_count(self):
        seed_count = len(list_runs())
        record_demo_run(
            {
                "trace_id": "abc123def4567890",
                "scenario": "retrieval_miss",
                "retrieval_score": 0.18,
                "tool_status": "ok",
                "tokens": 1203,
            }
        )
        self.assertEqual(len(list_runs()), seed_count + 1)
        reset_demo_runs()
        self.assertEqual(len(list_runs()), seed_count)


if __name__ == "__main__":
    unittest.main()
