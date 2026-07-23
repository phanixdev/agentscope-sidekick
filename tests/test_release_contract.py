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

    def test_release_metadata_describes_current_product(self):
        self.assertEqual(self.package["version"], "1.1.0")
        self.assertIn("v1.1.0", self.release)
        self.assertIn("breach", self.release.lower())
        self.assertIn("npm.cmd run check", self.release)

    def test_public_docs_use_stable_release_link_and_canonical_trace(self):
        trace_id = "70468b87b41bc6ecbe14d95f30ebcd2c"
        self.assertIn("/releases/latest", self.judge)
        self.assertIn(trace_id, self.readme)
        self.assertIn(trace_id, self.judge)
        self.assertNotIn("56-test suite", self.readme)

    def test_architecture_docs_are_free_of_mojibake(self):
        for content in (self.telemetry, self.architecture):
            self.assertNotIn("â”", content)
            self.assertIn("POST /demo/run", content)


if __name__ == "__main__":
    unittest.main()
