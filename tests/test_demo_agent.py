import contextlib
import io
import unittest

import apps.agent.demo_agent as demo_agent


class DemoAgentTests(unittest.TestCase):
    def run_silently(self, scenario):
        original_tracer = demo_agent.TRACER
        demo_agent.TRACER = None
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                return demo_agent.run_demo_agent(scenario)
        finally:
            demo_agent.TRACER = original_tracer

    def test_tool_failure_returns_error_status(self):
        result = self.run_silently("tool_failure")
        self.assertEqual(result["scenario"], "tool_failure")
        self.assertEqual(result["tool_status"], "error")
        self.assertIn("trace_id", result)

    def test_retrieval_miss_has_low_score(self):
        result = self.run_silently("retrieval_miss")
        self.assertLess(result["retrieval_score"], 0.3)
        self.assertEqual(result["tool_status"], "ok")

    def test_token_spike_exceeds_budget_threshold(self):
        result = self.run_silently("token_spike")
        self.assertGreater(result["tokens"], 10_000)
        self.assertEqual(result["tool_status"], "ok")


if __name__ == "__main__":
    unittest.main()
