import io
import unittest
from unittest.mock import patch

from app import create_app
from services.ocr import UnreadableDocumentError


class ScheduleApiTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config.update(TESTING=True)
        self.client = self.app.test_client()

    def test_production_origin_cors_preflight_allows_multipart_post(self):
        response = self.client.options(
            "/api/schedule",
            headers={
                "Origin": "https://schedmaker.vercel.app",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers.get("Access-Control-Allow-Origin"),
            "https://schedmaker.vercel.app",
        )
        self.assertIn("POST", response.headers.get("Access-Control-Allow-Methods", ""))
        self.assertIn(
            "content-type",
            response.headers.get("Access-Control-Allow-Headers", "").lower(),
        )

    def test_project_preview_origin_is_allowed_and_unrelated_vercel_origin_is_not(self):
        allowed = self.client.get(
            "/health",
            headers={"Origin": "https://schedule-maker-6yolcrrhm-laurences-projects-e3ac5440.vercel.app"},
        )
        rejected = self.client.get(
            "/health", headers={"Origin": "https://unrelated.vercel.app"}
        )

        self.assertEqual(
            allowed.headers.get("Access-Control-Allow-Origin"),
            "https://schedule-maker-6yolcrrhm-laurences-projects-e3ac5440.vercel.app",
        )
        self.assertNotIn("Access-Control-Allow-Origin", rejected.headers)

    def test_valid_upload_returns_schedule_json(self):
        cor_text = "C101 CS101 Intro to Computing 3.0 3.0\n8:00-9:00 am M RM 101"
        with patch("routes.schedule.extract_text", return_value=cor_text):
            response = self.client.post(
                "/api/schedule",
                data={"file": (io.BytesIO(b"image bytes"), "cor.jpg")},
                headers={"Origin": "https://schedmaker.vercel.app"},
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["subjects"][0]["code"], "CS101")
        self.assertIn("Monday", response.json["by_day"])
        self.assertEqual(
            response.headers["Access-Control-Allow-Origin"],
            "https://schedmaker.vercel.app",
        )

    def test_invalid_document_returns_422_json(self):
        with patch(
            "routes.schedule.extract_text",
            side_effect=UnreadableDocumentError("invalid image"),
        ):
            response = self.client.post(
                "/api/schedule",
                data={"file": (io.BytesIO(b"not an image"), "cor.jpg")},
            )

        self.assertEqual(response.status_code, 422)
        self.assertIn("error", response.json)

    def test_processing_failure_returns_500_json_and_removes_temp_file(self):
        saved_path = None

        def fail(path, _file_type):
            nonlocal saved_path
            saved_path = path
            raise RuntimeError("OCR runtime failed")

        with patch("routes.schedule.extract_text", side_effect=fail):
            response = self.client.post(
                "/api/schedule",
                data={"file": (io.BytesIO(b"image bytes"), "cor.jpg")},
            )

        self.assertEqual(response.status_code, 500)
        self.assertIn("error", response.json)
        self.assertIsNotNone(saved_path)
        self.assertFalse(__import__("os").path.exists(saved_path))

    def test_upload_too_large_returns_413_json(self):
        self.app.config["MAX_CONTENT_LENGTH"] = 64
        response = self.client.post(
            "/api/schedule",
            data={"file": (io.BytesIO(b"x" * 256), "cor.jpg")},
            headers={"Origin": "https://schedmaker.vercel.app"},
        )

        self.assertEqual(response.status_code, 413)
        self.assertIn("error", response.json)
        self.assertEqual(
            response.headers["Access-Control-Allow-Origin"],
            "https://schedmaker.vercel.app",
        )

    def test_unsupported_extension_returns_415_json(self):
        response = self.client.post(
            "/api/schedule",
            data={"file": (io.BytesIO(b"text"), "cor.txt")},
        )

        self.assertEqual(response.status_code, 415)
        self.assertIn("error", response.json)


if __name__ == "__main__":
    unittest.main()
