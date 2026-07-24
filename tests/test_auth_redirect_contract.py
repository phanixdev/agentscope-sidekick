import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class AuthRedirectContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.auth = (ROOT / "apps/web/src/components/AuthScreen.jsx").read_text(encoding="utf-8")

    def test_signup_and_password_reset_return_to_the_current_app_origin(self):
        self.assertIn("emailRedirectTo: window.location.origin", self.auth)
        self.assertIn("redirectTo: window.location.origin", self.auth)


if __name__ == "__main__":
    unittest.main()
