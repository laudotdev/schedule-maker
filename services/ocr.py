OCR_CONFIG = "--psm 6"  # A uniform block of text suits common COR table layouts.


def _extract_image_text(path):
    import pytesseract
    from PIL import Image

    image = Image.open(path).convert("L")
    if image.width < 1500:
        scale = 1500 / image.width
        image = image.resize((int(image.width * scale), int(image.height * scale)))
    return pytesseract.image_to_string(image, config=OCR_CONFIG)


def _extract_pdf_text(path):
    import pdfplumber

    with pdfplumber.open(path) as pdf:
        text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    if len(text.strip()) >= 50:
        return text

    # Scanned PDFs have no text layer, so rasterize and OCR each page.
    from pdf2image import convert_from_path
    import pytesseract

    pages = convert_from_path(path, dpi=300)
    return "\n".join(pytesseract.image_to_string(page, config=OCR_CONFIG) for page in pages)


def extract_text(path: str, file_type: str) -> str:
    """Extract text from an image or PDF COR file."""
    if file_type == "pdf":
        return _extract_pdf_text(path)
    return _extract_image_text(path)
