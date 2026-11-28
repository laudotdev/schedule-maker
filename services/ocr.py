from functools import lru_cache
import logging
import statistics
import threading

from services.memory import log_memory

logger = logging.getLogger(__name__)
MAX_OCR_WIDTH = 2000
SCANNED_PDF_DPI = 200
_OCR_LOCK = threading.Lock()


class UnreadableDocumentError(ValueError):
    """The uploaded document is invalid or cannot be decoded."""


@lru_cache(maxsize=1)
def _ocr_engine():
    log_memory("before_ocr_engine_init", logger)
    from rapidocr import EngineType, LangDet, LangRec, ModelType, OCRVersion, RapidOCR

    engine = RapidOCR(
        params={
            # The Render free instance has 512 MB RAM. Use RapidOCR's smaller
            # English models and skip the extra orientation model.
            "Det.engine_type": EngineType.ONNXRUNTIME,
            "Det.lang_type": LangDet.EN,
            "Det.model_type": ModelType.TINY,
            "Det.ocr_version": OCRVersion.PPOCRV6,
            "Rec.engine_type": EngineType.ONNXRUNTIME,
            "Rec.lang_type": LangRec.EN,
            "Rec.model_type": ModelType.TINY,
            "Rec.ocr_version": OCRVersion.PPOCRV6,
            "Global.use_cls": False,
            "EngineConfig.onnxruntime.intra_op_num_threads": 1,
            "EngineConfig.onnxruntime.inter_op_num_threads": 1,
            "EngineConfig.onnxruntime.enable_cpu_mem_arena": False,
        }
    )
    log_memory("after_ocr_engine_init", logger)
    return engine


def _ocr_image(image):
    from PIL import Image

    if not isinstance(image, Image.Image):
        raise UnreadableDocumentError("Unsupported image")
    image = image.convert("RGB")
    if image.width > MAX_OCR_WIDTH:
        scale = MAX_OCR_WIDTH / image.width
        resized = image.resize((MAX_OCR_WIDTH, round(image.height * scale)))
        image.close()
        image = resized
    log_memory("before_ocr_inference", logger, width=image.width, height=image.height)
    try:
        with _OCR_LOCK:
            result = _ocr_engine()(image)
        log_memory("after_ocr_inference", logger)
        return _join_ocr_rows(result)
    finally:
        image.close()


def _join_ocr_rows(result):
    """Join horizontally separated OCR boxes that share the same text row."""
    boxes = getattr(result, "boxes", None)
    texts = getattr(result, "txts", None)
    if boxes is None:
        boxes = ()
    if texts is None:
        texts = ()
    items = []
    for box, text in zip(boxes, texts):
        if not text:
            continue
        ys = [point[1] for point in box]
        xs = [point[0] for point in box]
        items.append(((min(ys) + max(ys)) / 2, min(xs), max(ys) - min(ys), text.strip()))
    if not items:
        return "\n".join(texts)

    tolerance = max(6.0, statistics.median(item[2] for item in items) * 0.5)
    rows = []
    for item in sorted(items, key=lambda value: (value[0], value[1])):
        y = item[0]
        candidates = [
            (abs(y - statistics.mean(box[0] for box in row)), index)
            for index, row in enumerate(rows)
            if abs(y - statistics.mean(box[0] for box in row)) <= tolerance
        ]
        if candidates:
            rows[min(candidates)[1]].append(item)
        else:
            rows.append([item])
    return "\n".join(
        " ".join(item[3] for item in sorted(row, key=lambda value: value[1]))
        for row in sorted(rows, key=lambda row: statistics.mean(item[0] for item in row))
    )


def _extract_image_text(path):
    from PIL import Image, ImageOps, UnidentifiedImageError

    try:
        with Image.open(path) as source:
            oriented = ImageOps.exif_transpose(source)
            return _ocr_image(oriented)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise UnreadableDocumentError("Invalid image file") from exc


def _extract_pdf_text(path):
    import pdfplumber
    from pdfminer.pdfdocument import PDFEncryptionError
    from pdfminer.pdfparser import PDFSyntaxError

    try:
        with pdfplumber.open(path) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        if len(text.strip()) >= 50:
            return text
        import pypdfium2 as pdfium

        document = pdfium.PdfDocument(path)
        page_text = []
        try:
            for page in document:
                image = page.render(scale=SCANNED_PDF_DPI / 72).to_pil()
                try:
                    page_text.append(_ocr_image(image))
                finally:
                    image.close()
                    page.close()
            return "\n".join(page_text)
        finally:
            document.close()
    except (PDFEncryptionError, PDFSyntaxError, OSError, ValueError) as exc:
        raise UnreadableDocumentError("Invalid or encrypted PDF") from exc


def extract_text(path: str, file_type: str) -> str:
    if file_type == "pdf":
        return _extract_pdf_text(path)
    return _extract_image_text(path)
