# SKED

**Website:** [sked.laupyde.online](https://sked.laupyde.online)

SKED turns a Certificate of Registration (COR) into a weekly class schedule. Upload a COR image or PDF, review the generated timetable, correct any OCR mistakes, and download the schedule as a PNG, JPG, or PDF.

> Generated schedules can contain OCR or parsing errors. Compare the result with your official COR and edit it before downloading.

## Features

- Accepts COR files in PNG, JPG/JPEG, and PDF format, up to 10 MB.
- Extracts text from digital PDFs and uses OCR for images and scanned PDFs.
- Builds a Monday-to-Saturday timetable with course, time, room, and instructor details when detected.
- Lets you edit course details and move classes between displayed days before exporting.
- Shows detected subjects and schedule time-overlap warnings.
- Exports the schedule from your browser as PNG, JPG, or PDF.
- Includes a responsive light-pink theme and a dark theme.
- Does not display student names in the generated schedule.

## Tech stack

### Backend

- Python 3
- Flask for the web app and JSON API
- RapidOCR with ONNX Runtime for image and scanned-PDF text recognition
- Pillow for image loading and preparation
- pdfplumber for extracting text from digital PDFs
- pypdfium2 for rendering scanned PDF pages without an external Poppler install
- A custom Python parser for COR subject, schedule, and header data

### Frontend

- HTML and Jinja templates
- CSS for responsive layouts and light/dark themes
- Vanilla JavaScript for uploads, schedule editing, and downloads
- html2canvas-next and jsPDF, bundled locally under `static/vendor/`, for PNG/JPG/PDF exports

There is no Node.js build step or database.

## Requirements

- Python 3.10 or newer
- OCR and scanned-PDF rendering run through Python packages; no separate Tesseract or Poppler installation is required.

Then install the Python dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## Run locally

From the project directory, activate the virtual environment if it is not active, then run:

```bash
python app.py
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your browser. The Flask development server runs with debug mode enabled; use a production WSGI server and appropriate deployment settings when hosting the app publicly.

## How to use SKED

1. Open the website and select a PNG, JPG/JPEG, or PDF COR file (maximum 10 MB).
2. Click **I-covert na 'yan** (Build schedule), then review and accept the terms and privacy information to continue.
3. Wait for the COR to be processed. If the result is incorrect, choose **Hala may mali?** (edit schedule), update the course fields or day, and select **Save changes**. Choose **Cancel** to discard the current edits.
4. Review the timetable and detected subjects. Confirm the details against your official COR.
5. Click **Download** and choose PNG, JPG, or PDF.

The current timetable displays Monday through Saturday. The parser recognizes Sunday schedule codes too, but Sunday is not currently shown in the timetable.

## Project layout

```text
.
├── app.py                       # Flask app setup and upload-size limit
├── routes/
│   └── schedule.py              # Website routes and schedule API endpoint
├── schedule_parser.py           # COR text parsing and timetable generation
├── services/
│   └── ocr.py                   # Image and PDF text extraction
├── templates/
│   └── index.html               # SKED page and dialogs
├── static/
│   ├── script.js                # Upload flow, editing, and browser exports
│   ├── style.css                # Layout, themes, and responsive styling
│   ├── sad_happy.png            # Empty-day illustration
│   └── vendor/                  # Locally bundled export libraries and licenses
└── requirements.txt             # Python dependencies
```

## HTTP endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Serves the SKED website. |
| `GET` | `/health` | Returns a small JSON health response. |
| `POST` | `/api/schedule` | Accepts a multipart file in the `file` field and returns parsed schedule JSON. |

The API accepts `.png`, `.jpg`, `.jpeg`, and `.pdf` files. It returns an error response for unsupported files, uploads over 10 MB, or documents where no subjects could be parsed.

## Privacy and data handling

- The project has no database and does not require an account.
- The uploaded COR is written to a temporary file for processing; the route removes that file after extraction, including when processing raises an error.
- The app processes the document locally on the server and does not send it to an external OCR service.
- OCR models run locally in the Python service; the first OCR request may take longer while the model initializes.
- The browser keeps the generated schedule in the page while it is open. Theme preference may be stored in the browser's local storage.
- The schedule heading and exported filenames do not include the student's name.
- OCR and parsing may be incomplete or incorrect. Verify the generated schedule against the official COR.

## Credits

SKED acknowledges President Ramon Magsaysay State University (PRMSU) for its Certificate of Registration, which informs the schedule format.

© 2026 SKED.
