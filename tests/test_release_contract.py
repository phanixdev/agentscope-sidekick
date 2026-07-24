import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class ReleaseContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
        cls.readme = (ROOT / "README.md").read_text(encoding="utf-8")
        cls.judge = (ROOT / "docs/JUDGE_GUIDE.md").read_text(encoding="utf-8")
        cls.release = (ROOT / "docs/RELEASE_NOTES.md").read_text(encoding="utf-8")
        cls.telemetry = (ROOT / "docs/telemetry-contract.md").read_text(encoding="utf-8")
        cls.architecture = (ROOT / "docs/architecture.md").read_text(encoding="utf-8")
        cls.blog = (ROOT / "docs/project-blog-draft.md").read_text(encoding="utf-8")

    def test_release_metadata_describes_current_product(self):
        self.assertEqual(self.package["version"], "1.3.0")
        self.assertIn("v1.3.0", self.release)
        self.assertIn("breach", self.release.lower())
        self.assertIn("npm.cmd run check", self.release)

    def test_public_docs_use_stable_release_link_and_canonical_trace(self):
        trace_id = "70468b87b41bc6ecbe14d95f30ebcd2c"
        self.assertIn("/releases/latest", self.judge)
        self.assertIn(trace_id, self.readme)
        self.assertIn(trace_id, self.judge)
        self.assertNotIn("56-test suite", self.readme)

    def test_project_blog_has_specific_technical_evidence(self):
        word_count = len(self.blog.split())
        self.assertGreaterEqual(word_count, 1000)
        self.assertLessEqual(word_count, 1500)
        for evidence in (
            "POST /demo/run",
            "14 spans",
            "eight trace-correlated logs",
            "SigNoz MCP server",
            "Trace identity verified",
            "OpenAI Codex and ChatGPT",
            "failing-trace-live.png",
            "dashboard-live.png",
            "alerts-live.png",
        ):
            self.assertIn(evidence, self.blog)

    def test_architecture_docs_are_free_of_mojibake(self):
        for content in (self.telemetry, self.architecture):
            self.assertNotIn("\u00e2\u201d", content)
            self.assertIn("POST /demo/run", content)

    def test_architecture_documents_evidence_and_security_boundaries(self):
        for heading in (
            "Execution Planes",
            "Evidence Identity",
            "Proof Resolution",
            "Trust Boundaries",
            "Failure Behavior",
            "Reproducing the Stack",
        ):
            self.assertIn(heading, self.architecture)

    def test_repository_declares_an_open_source_license(self):
        license_text = (ROOT / "LICENSE").read_text(encoding="utf-8")
        self.assertIn("MIT License", license_text)
        self.assertIn("2026", license_text)


if __name__ == "__main__":
    unittest.main()
