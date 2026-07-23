import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class AccessibilityContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ui = (ROOT / "apps/web/src/main.jsx").read_text(encoding="utf-8")
        cls.styles = (ROOT / "apps/web/src/styles.css").read_text(encoding="utf-8")

    def test_search_and_note_fields_have_accessible_names(self):
        for label in (
            'aria-label="Filter agent runs"',
            'aria-label="Search correlated logs"',
            'aria-label="Investigation note"',
        ):
            self.assertIn(label, self.ui)

    def test_dialogs_support_escape_and_initial_focus(self):
        self.assertIn('event.key === "Escape"', self.ui)
        self.assertIn('aria-label="Close SigNoz evidence" className="icon-button" autoFocus', self.ui)
        self.assertIn('aria-modal="true"', self.ui)

    def test_async_feedback_uses_live_regions(self):
        self.assertIn('className="loading" role="status"', self.ui)
        self.assertIn('className={`toast ${toast.kind}`} role="status"', self.ui)
        self.assertIn('role="alert"', self.ui)

    def test_keyboard_focus_and_reduced_motion_are_supported(self):
        self.assertIn(":focus-visible", self.styles)
        self.assertIn("prefers-reduced-motion:reduce", self.styles)

    def test_mobile_navigation_exposes_expanded_state(self):
        self.assertIn("aria-expanded={menuOpen}", self.ui)
        self.assertIn("menuOpen={mobile}", self.ui)


if __name__ == "__main__":
    unittest.main()