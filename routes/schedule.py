import os
import tempfile

from flask import Blueprint, jsonify, render_template, request

from schedule_parser import build_schedule, parse_cor_text, parse_header
from services.ocr import extract_text


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
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        return jsonify(error="Send the COR as multipart form field 'file'."), 400

    extension = os.path.splitext(upload.filename)[1].lower()
    file_type = ALLOWED_EXTENSIONS.get(extension)
    if file_type is None:
        return jsonify(error="Only PNG, JPG, or PDF files are accepted."), 415

    with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as temporary_file:
        temporary_path = temporary_file.name

    try:
        upload.save(temporary_path)
        text = extract_text(temporary_path, file_type)
    except Exception as exc:  # OCR and PDF libraries raise several exception types.
        return jsonify(error=f"Could not read the file: {exc}"), 422
    finally:
        if os.path.exists(temporary_path):
            os.remove(temporary_path)

    subjects = parse_cor_text(text)
    if not subjects:
        return jsonify(
            error="No subjects found. Try a higher-resolution image or a text-based PDF."
        ), 422

    result = build_schedule(subjects)
    student = parse_header(text)
    student.pop("name", None)
    result["student"] = student
    return jsonify(result)
