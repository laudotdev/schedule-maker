from functools import lru_cache


@lru_cache(maxsize=1)
def _ocr_engine():
    """Create one CPU OCR engine and reuse it across uploads."""
    from rapidocr import RapidOCR

    return RapidOCR()


def _ocr_image(image):
    """Recognize text from a Pillow image using the Python OCR runtime."""
    from PIL import Image

    image = image.convert("RGB")
    if image.width < 1500:
        scale = 1500 / image.width
        image = image.resize((1500, int(image.height * scale)))

    result = _ocr_engine()(image)
    return "\n".join(result.txts or ())


def _extract_image_text(path):
    from PIL import Image

    with Image.open(path) as image:
        return _ocr_image(image)


def _extract_pdf_text(path):
    import pdfplumber

    with pdfplumber.open(path) as pdf:
        text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    if len(text.strip()) >= 50:
        return text

    # Scanned PDFs have no text layer. Render pages with PDFium, then OCR them.
    import pypdfium2 as pdfium

    document = pdfium.PdfDocument(path)
    try:
        page_text = []
        for page in document:
            image = page.render(scale=300 / 72).to_pil()
            try:
                page_text.append(_ocr_image(image))
            finally:
                image.close()
                page.close()
        return "\n".join(page_text)
    finally:
        document.close()


def extract_text(path: str, file_type: str) -> str:
    """Extract text from an image or PDF COR file."""
    if file_type == "pdf":
        return _extract_pdf_text(path)
    return _extract_image_text(path)
