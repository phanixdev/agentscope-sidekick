import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class TraceContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.agent = (ROOT / "apps/agent/demo_agent.py").read_text(encoding="utf-8")
        cls.api = (ROOT / "apps/api/main.py").read_text(encoding="utf-8")
        cls.docs = (ROOT / "docs/telemetry-contract.md").read_text(encoding="utf-8")

    def test_http_request_is_the_trace_root(self):
        self.assertIn('"POST /demo/run"', self.api)
        self.assertIn('"http.request.method": "POST"', self.api)
        self.assertIn('span_kind="server"', self.api)

    def test_trace_covers_all_components(self):
        for service in (
            "agentscope-retrieval", "agentscope-tool-gateway", "agentscope-llm-gateway",
        ):
            self.assertIn(service, self.agent)
        self.assertIn('"INSERT agent_runs"', self.api)

    def test_current_semantic_attributes_are_used(self):
        for attribute in (
            "db.system.name", "db.operation.name", "gen_ai.operation.name",
            "gen_ai.provider.name", "gen_ai.request.model", "gen_ai.usage.input_tokens",
        ):
            self.assertIn(attribute, self.agent + self.api)
        self.assertNotIn("gen_ai_request_model", self.agent)

    def test_trace_contract_avoids_sensitive_content(self):
        self.assertIn("Prompt or retrieved-document contents are deliberately excluded", self.docs)
        self.assertIn("OTEL_EXPORTER_OTLP_ENDPOINT", self.docs)


if __name__ == "__main__":
    unittest.main()