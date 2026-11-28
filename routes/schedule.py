import os
import tempfile
import time

from flask import Blueprint, current_app, jsonify, render_template, request

from schedule_parser import build_schedule, parse_cor_text, parse_header
from services.memory import log_memory
from services.ocr import UnreadableDocumentError, extract_text


schedule = Blueprint("schedule", __name__)

ALLOWED_EXTENSIONS = {
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".pdf": "pdf",
}


@schedule.get("/")
def home():
    return render_template("index.html")


@schedule.get("/health")
def health():
    return jsonify(status="ok")


@schedule.post("/api/schedule")
def make_schedule():
    started_at = time.perf_counter()
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        return jsonify(error="Send the COR as multipart form field 'file'."), 400

    extension = os.path.splitext(upload.filename)[1].lower()
    file_type = ALLOWED_EXTENSIONS.get(extension)
    if file_type is None:
        return jsonify(error="Only PNG, JPG, or PDF files are accepted."), 415

    log_memory("upload_received", current_app.logger, file_type=file_type)
    with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as temporary_file:
        temporary_path = temporary_file.name

    try:
        upload.save(temporary_path)
        upload_size = os.path.getsize(temporary_path)
        log_memory(
            "before_file_extraction",
            current_app.logger,
            file_type=file_type,
            upload_bytes=upload_size,
        )
        text = extract_text(temporary_path, file_type)
        log_memory("after_file_extraction", current_app.logger, file_type=file_type)
    except UnreadableDocumentError:
        current_app.logger.info("Rejected unreadable COR upload (type=%s)", file_type)
        return jsonify(error="This file is invalid, damaged, or cannot be read."), 422
    except Exception:
        current_app.logger.exception("COR extraction failed (type=%s)", file_type)
        return jsonify(error="The server could not process this file. Please try again."), 500
    finally:
        if os.path.exists(temporary_path):
            os.remove(temporary_path)
        log_memory(
            "upload_complete",
            current_app.logger,
            file_type=file_type,
            elapsed_seconds=round(time.perf_counter() - started_at, 2),
        )

    subjects = parse_cor_text(text)
    if not subjects:
        return jsonify(
            error="No subjects found. Try a higher-resolution image or a text-based PDF."
        ), 422

    try:
        result = build_schedule(subjects)
        student = parse_header(text)
        student.pop("name", None)
        result["student"] = student
        return jsonify(result)
    except Exception:
        current_app.logger.exception("Failed to build schedule from extracted COR text")
        return jsonify(error="The server could not build a schedule from this file."), 500
