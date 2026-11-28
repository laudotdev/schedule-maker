import io
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from PIL import Image, ImageDraw

from services import ocr


def make_text_pdf(text):
    content = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode("ascii")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n"
        + content
        + b"\nendstream",
    ]
    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(output))
        output.extend(f"{number} 0 obj\n".encode())
        output.extend(obj)
        output.extend(b"\nendobj\n")
    xref_offset = len(output)
    output.extend(f"xref\n0 {len(offsets)}\n".encode())
    output.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode())
    output.extend(
        f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n".encode()
    )
    return bytes(output)


class FakeOcrEngine:
    def __init__(self, text="recognized text"):
        self.text = text
        self.images = []

    def __call__(self, image):
        self.images.append((image.size, image.mode))
        return SimpleNamespace(txts=[self.text])


class OcrProcessingTests(unittest.TestCase):
    def test_ocr_boxes_on_same_row_are_joined_left_to_right(self):
        result = SimpleNamespace(
            boxes=[
                [[50, 10], [80, 10], [80, 30], [50, 30]],
                [[10, 11], [40, 11], [40, 29], [10, 29]],
                [[10, 50], [40, 50], [40, 68], [10, 68]],
            ],
            txts=["second", "first", "next row"],
        )
        self.assertEqual(ocr._join_ocr_rows(result), "first second\nnext row")

    def test_cached_engine_uses_tiny_models_without_orientation_model(self):
        import rapidocr

        ocr._ocr_engine.cache_clear()
        with patch.object(rapidocr, "RapidOCR") as rapid_ocr:
            ocr._ocr_engine()

        params = rapid_ocr.call_args.kwargs["params"]
        self.assertEqual(params["Det.model_type"].value, "tiny")
        self.assertEqual(params["Det.lang_type"].value, "en")
        self.assertEqual(params["Rec.model_type"].value, "tiny")
        self.assertEqual(params["Rec.lang_type"].value, "en")
        self.assertFalse(params["Global.use_cls"])
        ocr._ocr_engine.cache_clear()

    def test_image_ocr_caps_long_side_and_preserves_aspect_ratio(self):
        image = Image.new("RGB", (4000, 3000), "white")
        engine = FakeOcrEngine()
        with patch("services.ocr._ocr_engine", return_value=engine):
            ocr._ocr_image(image)
        self.assertEqual(engine.images, [((2000, 1500), "RGB")])

    def test_image_ocr_does_not_upscale_small_image(self):
        image = Image.new("RGB", (800, 600), "white")
        engine = FakeOcrEngine()
        with patch("services.ocr._ocr_engine", return_value=engine):
            ocr._ocr_image(image)
        self.assertEqual(engine.images, [((800, 600), "RGB")])

    def test_image_ocr_applies_exif_orientation(self):
        image = Image.new("RGB", (1200, 800), "white")
        exif = Image.Exif()
        exif[274] = 6
        engine = FakeOcrEngine()
        with tempfile.NamedTemporaryFile(suffix=".jpg") as temporary:
            image.save(temporary.name, format="JPEG", exif=exif)
            with patch("services.ocr._ocr_engine", return_value=engine):
                ocr.extract_text(temporary.name, "image")

        self.assertEqual(engine.images, [((800, 1200), "RGB")])

    def test_invalid_image_raises_value_error_for_client_error_response(self):
        with tempfile.NamedTemporaryFile(suffix=".jpg") as temporary:
            temporary.write(b"not an image")
            temporary.flush()
            with self.assertRaises(ValueError):
                ocr.extract_text(temporary.name, "image")

    def test_image_ocr_uses_prepared_image_and_returns_detected_lines(self):
        engine = FakeOcrEngine("line one")
        image = Image.new("RGB", (4000, 3000), "white")
        with patch("services.ocr._ocr_engine", return_value=engine):
            result = ocr._ocr_image(image)

        self.assertEqual(result, "line one")
        self.assertEqual(engine.images, [((2000, 1500), "RGB")])

    def test_digital_pdf_text_is_extracted_without_starting_ocr(self):
        pdf = make_text_pdf("Digital COR text extraction stays on the text path")
        with io.BytesIO(pdf) as stream:
            # pdfplumber accepts a file-like object through its own API; this test
            # uses a temporary file because extract_text mirrors the route path.
            with tempfile.NamedTemporaryFile(suffix=".pdf") as temporary:
                temporary.write(stream.read())
                temporary.flush()
                with patch("services.ocr._ocr_engine", side_effect=AssertionError("OCR should not run")):
                    text = ocr.extract_text(temporary.name, "pdf")

        self.assertIn("Digital COR text extraction", text)

    def test_scanned_pdf_renders_pages_and_passes_them_to_ocr(self):
        image = Image.new("RGB", (1200, 800), "white")
        ImageDraw.Draw(image).text((40, 40), "Scanned COR", fill="black")
        buffer = io.BytesIO()
        image.save(buffer, format="PDF", resolution=72)
        engine = FakeOcrEngine("scanned text")
        with tempfile.NamedTemporaryFile(suffix=".pdf") as temporary:
            temporary.write(buffer.getvalue())
            temporary.flush()
            with patch("services.ocr._ocr_engine", return_value=engine):
                text = ocr.extract_text(temporary.name, "pdf")

        self.assertEqual(text, "scanned text")
        self.assertEqual(len(engine.images), 1)
        self.assertLessEqual(max(engine.images[0][0]), 2200)


if __name__ == "__main__":
    unittest.main()
