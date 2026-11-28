import unittest
import importlib.util


class MemoryDiagnosticsTests(unittest.TestCase):
    def test_current_rss_reports_a_positive_value_on_linux(self):
        spec = importlib.util.find_spec("services.memory")
        self.assertIsNotNone(spec)
        if spec is None:
            return
        from services.memory import current_rss_mb

        rss_mb = current_rss_mb()

        self.assertIsNotNone(rss_mb)
        self.assertGreater(rss_mb, 0)


if __name__ == "__main__":
    unittest.main()
