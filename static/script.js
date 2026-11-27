const API_URL = "/api/schedule";
const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const form = document.getElementById("upload-form");
const fileInput = document.getElementById("file");
const submitButton = document.getElementById("submit-btn");
const selectedFileName = document.getElementById("selected-file-name");
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");
const themeLabel = document.getElementById("theme-label");
const termsDialog = document.getElementById("terms-dialog");
const termsForm = document.getElementById("terms-form");
const termsCheckbox = document.getElementById("terms-checkbox");
const acceptTermsButton = document.getElementById("accept-terms");
const closeTermsButton = document.getElementById("close-terms");
const closeTermsSecondaryButton = document.getElementById("close-terms-secondary");
const statusElement = document.getElementById("status");
const alertsElement = document.getElementById("alerts");
const resultElement = document.getElementById("result");
const studentElement = document.getElementById("student");
const termElement = document.getElementById("term");
const scheduleElement = document.getElementById("schedule");
const subjectsElement = document.getElementById("subjects");
const subjectCountElement = document.getElementById("subject-count");
const downloadToolbar = document.getElementById("download-toolbar");
const editScheduleButton = document.getElementById("edit-schedule-button");
const cancelEditButton = document.getElementById("cancel-edit-button");
const openDownloadDialogButton = document.getElementById("open-download-dialog");
const downloadDialog = document.getElementById("download-dialog");
const downloadForm = document.getElementById("download-form");
const confirmDownloadButton = document.getElementById("confirm-download");
const closeDownloadDialogButton = document.getElementById("close-download-dialog");
const cancelDownloadButton = document.getElementById("cancel-download");
const scheduleCaptureElement = document.getElementById("schedule-capture");

let currentScheduleData = null;
let isEditingSchedule = false;

let savedTheme = "light";
try {
  savedTheme = localStorage.getItem("cor-schedule-theme") === "dark" ? "dark" : "light";
} catch {
  // The page still works with the light theme when browser storage is unavailable.
}
applyTheme(savedTheme, false);

closeTermsButton.addEventListener("click", () => termsDialog.close());
closeTermsSecondaryButton.addEventListener("click", () => termsDialog.close());
termsCheckbox.addEventListener("change", () => {
  acceptTermsButton.disabled = !termsCheckbox.checked;
});
termsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!termsCheckbox.checked) return;
  termsDialog.close();
  const file = fileInput.files[0];
  if (!file) {
    showAlert("Choose a COR file before building your schedule.", "error");
    return;
  }
  await buildSchedule(file);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  termsCheckbox.checked = false;
  acceptTermsButton.disabled = true;
  termsDialog.showModal();
});

themeToggle.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

fileInput.addEventListener("change", () => {
  selectedFileName.textContent = fileInput.files[0] ? "COR file selected" : "No file selected";
});

editScheduleButton.addEventListener("click", () => {
  if (isEditingSchedule) {
    saveScheduleEdits();
    return;
  }
  isEditingSchedule = true;
  resultElement.classList.add("is-editing");
  editScheduleButton.textContent = "Save changes";
  cancelEditButton.classList.remove("hidden");
  openDownloadDialogButton.classList.add("hidden");
  renderSchedule(currentScheduleData, true);
  statusElement.textContent = "Edit mode: update the class details, then select Save changes.";
});

cancelEditButton.addEventListener("click", () => {
  isEditingSchedule = false;
  resultElement.classList.remove("is-editing");
  editScheduleButton.textContent = "Edit schedule";
  cancelEditButton.classList.add("hidden");
  openDownloadDialogButton.classList.remove("hidden");
  renderSchedule(currentScheduleData);
  statusElement.textContent = "Schedule edits canceled.";
});

openDownloadDialogButton.addEventListener("click", () => downloadDialog.showModal());
closeDownloadDialogButton.addEventListener("click", () => downloadDialog.close());
cancelDownloadButton.addEventListener("click", () => downloadDialog.close());

downloadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const format = new FormData(downloadForm).get("export-format");
  if (!["png", "jpg", "pdf"].includes(format)) return;

  confirmDownloadButton.disabled = true;
  confirmDownloadButton.textContent = "Preparing…";
  statusElement.textContent = "Preparing your download…";
  try {
    await downloadSchedule(format);
    downloadDialog.close();
    statusElement.textContent = "Download ready.";
  } catch (error) {
    downloadDialog.close();
    showAlert(`Could not create the download: ${error.message || "Please try again."}`, "error");
  } finally {
    confirmDownloadButton.disabled = false;
    confirmDownloadButton.textContent = "Download";
  }
});

function applyTheme(theme, persist = true) {
  const selectedTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = selectedTheme;
  const isDark = selectedTheme === "dark";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  themeIcon.textContent = isDark ? "☀" : "☾";
  themeLabel.textContent = isDark ? "Ang dilim" : "Nakasilaw";
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#160710" : "#fff3f8";
  if (persist) {
    try {
      localStorage.setItem("cor-schedule-theme", selectedTheme);
    } catch {
      // Theme changes remain active for this page when storage is unavailable.
    }
  }
}

async function buildSchedule(file) {
  setLoading(true);
  clearOutput();
  statusElement.textContent = "Reading your COR. This can take a few seconds for images…";

  const body = new FormData();
  body.append("file", file);

  try {
    const response = await fetch(API_URL, { method: "POST", body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      showAlert(data.error || `Request failed (${response.status}).`, "error");
      return;
    }

    renderResult(data);
    statusElement.textContent = "Schedule ready.";
  } catch {
    showAlert("Could not reach the server. Make sure the app is running on port 5000.", "error");
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Processing…" : "I-convert na 'yan";
}

function clearOutput() {
  alertsElement.replaceChildren();
  resultElement.classList.add("hidden");
  resultElement.classList.remove("is-editing");
  downloadToolbar.classList.add("hidden");
  currentScheduleData = null;
  isEditingSchedule = false;
  editScheduleButton.textContent = "Hala may mali? edit mo";
  cancelEditButton.classList.add("hidden");
  openDownloadDialogButton.classList.remove("hidden");
  if (downloadDialog.open) downloadDialog.close();
  studentElement.textContent = "";
  termElement.textContent = "";
  scheduleElement.replaceChildren();
  subjectsElement.replaceChildren();
  subjectCountElement.textContent = "";
}

function showAlert(message, type) {
  const alert = document.createElement("div");
  alert.className = `alert ${type}`;
  alert.textContent = message;
  alertsElement.appendChild(alert);
  statusElement.textContent = "";
}

function addDetail(card, icon, label, value, className = "") {
  if (!value) return;
  const row = document.createElement("p");
  row.className = `class-detail ${className}`.trim();

  const symbol = document.createElement("span");
  symbol.className = "detail-icon";
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = icon;

  const text = document.createElement("span");
  text.textContent = value;
  row.setAttribute("aria-label", `${label}: ${value}`);
  row.append(symbol, text);
  card.appendChild(row);
}

function createEditorField(label, value, field, multiline = false) {
  const wrapper = document.createElement("label");
  wrapper.className = "class-editor-field";
  wrapper.appendChild(document.createTextNode(label));

  const input = document.createElement(multiline ? "textarea" : "input");
  if (!multiline) input.type = "text";
  input.value = value || "";
  input.dataset.field = field;
  input.setAttribute("aria-label", label);
  wrapper.appendChild(input);
  return wrapper;
}

function renderClass(slot, day, editing = false) {
  const card = document.createElement("article");
  card.className = "class-card";

  if (editing) {
    card.classList.add("class-card-editor");
    const fields = document.createElement("div");
    fields.className = "class-editor-fields";
    fields.append(
      createEditorField("Course code", slot.code, "code"),
      createEditorField("Course name", slot.description, "description", true),
      createEditorField("Time", slot.time, "time"),
      createEditorField("Room", slot.room, "room"),
      createEditorField("Instructor", slot.instructor, "instructor"),
    );

    const dayField = document.createElement("label");
    dayField.className = "class-editor-field";
    dayField.appendChild(document.createTextNode("Day"));
    const daySelect = document.createElement("select");
    daySelect.dataset.field = "day";
    daySelect.setAttribute("aria-label", "Day");
    DAY_ORDER.forEach((optionDay) => {
      const option = document.createElement("option");
      option.value = optionDay;
      option.textContent = optionDay;
      option.selected = optionDay === day;
      daySelect.appendChild(option);
    });
    dayField.appendChild(daySelect);
    fields.appendChild(dayField);
    card.appendChild(fields);
    return card;
  }

  const code = document.createElement("h4");
  code.textContent = slot.code || "Class";
  card.appendChild(code);

  const description = document.createElement("p");
  description.className = "class-description";
  description.textContent = slot.description || "Course description unavailable";
  card.appendChild(description);

  addDetail(card, "◷", "Time", slot.time?.replace(" - ", " – "), "time-detail");
  addDetail(card, "⌖", "Room", slot.room, "room-detail");
  addDetail(card, "♙", "Instructor", slot.instructor?.toUpperCase(), "instructor-detail");
  return card;
}

function renderResult(data) {
  currentScheduleData = JSON.parse(JSON.stringify(data));
  isEditingSchedule = false;
  resultElement.classList.remove("hidden");
  resultElement.classList.remove("is-editing");

  const student = data.student || {};
  studentElement.textContent = "Weekly Class Schedule";
  termElement.textContent = student.term || "Academic term not detected";

  renderConflicts(data.conflicts || []);

  renderSchedule(currentScheduleData);
  renderSubjects(currentScheduleData.subjects || []);

  downloadToolbar.classList.remove("hidden");
}

function renderConflicts(conflicts) {
  alertsElement.replaceChildren();
  if (conflicts.length) {
    const alert = document.createElement("div");
    alert.className = "alert warning";
    const heading = document.createElement("strong");
    heading.textContent = "Schedule conflicts";
    const list = document.createElement("ul");
    conflicts.forEach((conflict) => {
      const item = document.createElement("li");
      item.textContent = conflict;
      list.appendChild(item);
    });
    alert.append(heading, list);
    alertsElement.appendChild(alert);
  }
}

function renderSchedule(data, editing = false) {
  scheduleElement.replaceChildren();
  const byDay = data.by_day || {};
  DAY_ORDER.forEach((day) => {
    const column = document.createElement("section");
    column.className = "day-column";
    column.setAttribute("aria-label", day);

    const heading = document.createElement("h3");
    heading.textContent = day;
    column.appendChild(heading);

    const classes = byDay[day] || [];
    if (classes.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-day";
      const icon = document.createElement("img");
      icon.className = "empty-day-icon";
      icon.src = scheduleElement.dataset.noClassIcon;
      icon.alt = "";
      const message = document.createElement("span");
      message.textContent = "No class";
      empty.append(icon, message);
      column.appendChild(empty);
    } else {
      classes.forEach((slot) => column.appendChild(renderClass(slot, day, editing)));
    }
    scheduleElement.appendChild(column);
  });
}

function renderSubjects(subjects) {
  subjectsElement.replaceChildren();
  subjectCountElement.textContent = `(${subjects.length})`;
  subjects.forEach((subject) => {
    const item = document.createElement("li");
    item.textContent = `${subject.code} — ${subject.description}`;
    subjectsElement.appendChild(item);
  });
}

function readTimeRange(time) {
  const matches = [...String(time || "").matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi)];
  if (matches.length < 2) return null;
  const toMinutes = (match) => {
    let hour = Number(match[1]) % 12;
    if (match[3].toUpperCase() === "PM") hour += 12;
    return hour * 60 + Number(match[2]);
  };
  return [toMinutes(matches[0]), toMinutes(matches[1])];
}

function getScheduleConflicts(byDay) {
  const conflicts = [];
  DAY_ORDER.forEach((day) => {
    const classes = byDay[day] || [];
    for (let leftIndex = 0; leftIndex < classes.length; leftIndex += 1) {
      const leftRange = readTimeRange(classes[leftIndex].time);
      if (!leftRange) continue;
      for (let rightIndex = leftIndex + 1; rightIndex < classes.length; rightIndex += 1) {
        const rightRange = readTimeRange(classes[rightIndex].time);
        if (!rightRange || leftRange[0] >= rightRange[1] || rightRange[0] >= leftRange[1]) continue;
        conflicts.push(`${day}: ${classes[leftIndex].code || "Class"} overlaps with ${classes[rightIndex].code || "Class"}.`);
      }
    }
  });
  return conflicts;
}

function saveScheduleEdits() {
  const updatedByDay = Object.fromEntries(DAY_ORDER.map((day) => [day, []]));
  scheduleElement.querySelectorAll(".class-card-editor").forEach((card) => {
    const getValue = (field) => card.querySelector(`[data-field="${field}"]`)?.value.trim() || "";
    const day = getValue("day");
    if (!updatedByDay[day]) return;
    updatedByDay[day].push({
      code: getValue("code"),
      description: getValue("description"),
      time: getValue("time"),
      room: getValue("room"),
      instructor: getValue("instructor"),
    });
  });

  const subjects = new Map();
  DAY_ORDER.forEach((day) => updatedByDay[day].forEach((slot) => {
    const key = `${slot.code.toLowerCase()}|${slot.description.toLowerCase()}`;
    if (slot.code || slot.description) subjects.set(key, { code: slot.code, description: slot.description });
  }));
  currentScheduleData.by_day = updatedByDay;
  currentScheduleData.subjects = [...subjects.values()];
  currentScheduleData.conflicts = getScheduleConflicts(updatedByDay);

  isEditingSchedule = false;
  resultElement.classList.remove("is-editing");
  editScheduleButton.textContent = "Edit schedule";
  cancelEditButton.classList.add("hidden");
  openDownloadDialogButton.classList.remove("hidden");
  renderConflicts(currentScheduleData.conflicts);
  renderSchedule(currentScheduleData);
  renderSubjects(currentScheduleData.subjects);
  statusElement.textContent = "Schedule changes saved.";
}

async function captureSchedule() {
  if (document.fonts?.ready) await document.fonts.ready;
  const backgroundColor = getComputedStyle(scheduleCaptureElement).backgroundColor;
  return window.html2canvas(scheduleCaptureElement, {
    backgroundColor,
    scale: 2,
    useCORS: true,
    logging: false,
  });
}

function getExportFilename(extension) {
  return `class-schedule.${extension}`;
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The browser could not encode this image."));
    }, mimeType, quality);
  });
}

function saveBlob(blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  let filename = "sked_prmsu_schedule"
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadSchedule(format) {
  if (typeof window.html2canvas !== "function") {
    throw new Error("The image export tool did not load. Reload the page and try again.");
  }

  const canvas = await captureSchedule();
  if (format === "png" || format === "jpg") {
    const mimeType = format === "png" ? "image/png" : "image/jpeg";
    const quality = format === "jpg" ? 0.94 : undefined;
    const blob = await canvasToBlob(canvas, mimeType, quality);
    saveBlob(blob, getExportFilename(format));
    return;
  }

  const jsPDF = window.jspdf?.jsPDF;
  if (typeof jsPDF !== "function") {
    throw new Error("The PDF export tool did not load. Reload the page and try again.");
  }
  const pdf = new jsPDF({
    orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width, canvas.height],
    compress: true,
  });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, canvas.width, canvas.height, undefined, "FAST");
  pdf.save(getExportFilename("pdf"));
}
