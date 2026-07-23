import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class FailureStateContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ui = (ROOT / "apps/web/src/main.jsx").read_text(encoding="utf-8")

    def test_workspace_failure_has_recovery_paths(self):
        self.assertIn("Workspace telemetry unavailable", self.ui)
        self.assertIn("Network unavailable", self.ui)
        self.assertIn("setReloadToken", self.ui)
        self.assertIn("Open judge demo", self.ui)

    def test_delayed_telemetry_is_explicit(self):
        self.assertIn("Telemetry is taking longer than expected", self.ui)
        self.assertIn("slowTimer", self.ui)

    def test_empty_workspace_can_retry_or_create_data(self):
        self.assertIn("No runs recorded", self.ui)
        self.assertIn("Retry ingestion", self.ui)
        self.assertIn("Create demo run", self.ui)

    def test_failed_remediation_remains_recoverable(self):
        self.assertIn("Verification failed", self.ui)
        self.assertIn("setRemediationError", self.ui)
        self.assertIn("Apply and run verification", self.ui)

    def test_expired_session_returns_to_authentication(self):
        self.assertIn("onAuthStateChange", self.ui)
        self.assertIn("if (!session && !preview) return <AuthScreen", self.ui)


if __name__ == "__main__":
    unittest.main()