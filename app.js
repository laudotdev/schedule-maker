function setTheme(t, el) {
  document.body.className = 'theme-' + t;
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
}

/* ── SOURCE TYPE ── */
let currentSourceType = 'cor';
function setSourceType(type, el) {
  currentSourceType = type;
  document.querySelectorAll('.source-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
}

/* ── GEMINI API KEY ──────────────────────────────────────────────────
   Hardcoded so visitors never have to enter anything — just upload and go.
   Get your own free key (no card required) at https://aistudio.google.com/app/apikey
   Free tier limits (per Google, mid-2026): ~10 requests/min, ~250/day on
   gemini-2.5-flash. If you publish this site, in Google AI Studio go to
   your key's settings and add an "HTTP referrer" restriction for your
   domain — that stops other sites from riding on your free quota, though
   it doesn't fully stop someone determined from copying the key out of
   your page source. It's a free-tier key, so the worst case if it leaks
   is your quota gets used up, not a bill.
   ──────────────────────────────────────────────────────────────────── */
// const GEMINI_API_KEY = 'AQ.Ab8RN6IazqdTWsPueWCSCohQfm10vApwi-ESR5x_2qbWueeOkw';
const GEMINI_API_KEY = 'AQ.Ab8RN6Lawn70h_THolapZSykkXVaeF0YTlBUwzq15LBAWvP4ow';
const GEMINI_MODEL = 'gemini-2.5-flash';

/* ── HELPERS ── */
const DAY_FULL = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function timeToMins(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function fmt12(hhmm) {
  if (!hhmm) return '';
  let [h, m] = hhmm.split(':').map(Number);
  const ap = h < 12 ? 'AM' : 'PM';
  if (h === 0) h = 12; else if (h > 12) h -= 12;
  return `${h}:${String(m || 0).padStart(2, '0')} ${ap}`;
}

/* SVG icons as strings (no emojis) */
const ICON_CLOCK = `<svg class="icon" width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg>`;
const ICON_PIN = `<svg class="icon" width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2a4 4 0 0 1 4 4c0 3-4 8-4 8S4 9 4 6a4 4 0 0 1 4-4z"/><circle cx="8" cy="6" r="1.5" fill="currentColor"/></svg>`;
const ICON_PROF = `<svg class="icon" width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5.5" r="2.8"/><path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/></svg>`;
const ICON_PLUS = `<svg class="icon" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>`;
const ICON_TRASH = `<svg class="icon" width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.5h11"/><path d="M5.5 4.5V3.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.3"/><path d="M4 4.5l.8 8.3a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9l.8-8.3"/><path d="M6.5 7v4"/><path d="M9.5 7v4"/></svg>`;

/* ── EDIT MODE STATE ── */
let currentData = null;
let isEditing = false;

function addBlankSubjectToDay(dayIndex) {
  if (!currentData || !isEditing) return;

  currentData.subjects.push({
    code: '',
    name: 'New Subject',
    units: 0,
    schedules: [{
      start: '',
      end: '',
      days: [dayIndex],
      room: '',
      professor: ''
    }]
  });

  renderSchedule(currentData);
}

function removeScheduleEntry(subject, schedule) {
  if (!currentData || !subject || !schedule) return;

  const subjectIndex = currentData.subjects.findIndex(item => item === subject);
  if (subjectIndex < 0) return;

  subject.schedules = (subject.schedules || []).filter(item => item !== schedule);
  if (!subject.schedules.length) {
    currentData.subjects.splice(subjectIndex, 1);
  }

  renderSchedule(currentData);
}

/* ── RENDER SCHEDULE ── */
function renderSchedule(data) {
  currentData = data;
  const studentName = (data.studentName && data.studentName.trim()) ? data.studentName.trim() : '';

  document.getElementById('studentInfo').style.display = 'flex';

  if (isEditing) {
    setInfoField('siName', data, 'studentName', studentName, 'text');
    setInfoField('siId', data, 'studentId', data.studentId || '', 'text');
    setInfoField('siCourse', data, 'courseYear', data.courseYear || '', 'text');
    setInfoField('siPeriod', data, 'period', data.period || '', 'text');
  } else {
    document.getElementById('siName').textContent = studentName || '—';
    document.getElementById('siId').textContent = data.studentId || '—';
    document.getElementById('siCourse').textContent = data.courseYear || '—';
    document.getElementById('siPeriod').textContent = data.period || '—';
  }
  updateCaptureHeader();

  const dayItems = Array.from({length: 6}, () => []);
  data.subjects.forEach(subj => {
    (subj.schedules || []).forEach(sc => {
      (sc.days || []).forEach(d => {
        if (d >= 0 && d <= 5) dayItems[d].push({subj, sc});
      });
    });
  });
  if (!isEditing) {
    dayItems.forEach(arr => arr.sort((a, b) => timeToMins(a.sc.start) - timeToMins(b.sc.start)));
  }

  const grid = document.getElementById('scheduleGrid');
  grid.innerHTML = '';

  DAY_FULL.forEach(day => {
    const h = document.createElement('div');
    h.className = 'col-header';
    h.textContent = day;
    grid.appendChild(h);
  });

  for (let d = 0; d < 6; d++) {
    const col = document.createElement('div');
    col.className = 'day-col';

    const items = dayItems[d];
    if (items.length === 0) {
      if (isEditing) {
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'edit-add-btn';
        addBtn.innerHTML = ICON_PLUS;
        addBtn.title = 'Add subject';
        addBtn.setAttribute('aria-label', 'Add subject');
        addBtn.onclick = () => addBlankSubjectToDay(d);
        col.appendChild(addBtn);
      } else {
        const e = document.createElement('div');
        e.className = 'empty-day';
        e.innerHTML = `<img class="no-class-kitty" src="https://img.icons8.com/clouds/100/hello-kitty.png" alt="" width="30" height="30" /><span>No class</span>`;
        col.appendChild(e);
      }
    } else {
      items.forEach(({subj, sc}, index) => {
        const block = document.createElement('div');
        const prevItem = items[index - 1];
        const shouldSeparate = !!(prevItem && prevItem.subj === subj && (
          prevItem.sc.start !== sc.start ||
          prevItem.sc.end !== sc.end ||
          prevItem.sc.room !== sc.room ||
          prevItem.sc.professor !== sc.professor
        ));
        block.className = shouldSeparate ? 'subject-block subject-block-separated' : 'subject-block';

        if (isEditing) {
          const codeValue = sc.subjectCode ?? subj.code ?? '';
          const nameValue = sc.subjectName ?? subj.name ?? '';

          block.innerHTML =
            `<input class="edit-input ei-code" value="${escAttr(codeValue)}" placeholder="Code" />` +
            `<input class="edit-input" style="margin-top:3px" value="${escAttr(nameValue)}" placeholder="Subject name" />` +
            `<div class="edit-row">${ICON_CLOCK}<input type="time" class="edit-input" value="${escAttr(sc.start || '')}" />` +
            `<span style="opacity:.7">&ndash;</span><input type="time" class="edit-input" value="${escAttr(sc.end || '')}" /></div>` +
            `<div class="edit-row">${ICON_PIN}<input class="edit-input" value="${escAttr(sc.room || '')}" placeholder="Room" /></div>` +
            `<div class="edit-row">${ICON_PROF}<input class="edit-input" value="${escAttr(sc.professor || subj.professor || '')}" placeholder="Professor" /></div>` +
            `<button type="button" class="edit-delete-btn" title="Delete subject" aria-label="Delete subject">${ICON_TRASH}</button>`;

          const inputs = block.querySelectorAll('input');
          const deleteBtn = block.querySelector('.edit-delete-btn');
          inputs[0].oninput = e => { sc.subjectCode = e.target.value; };
          inputs[1].oninput = e => { sc.subjectName = e.target.value; };
          inputs[2].oninput = e => { sc.start = e.target.value; };
          inputs[3].oninput = e => { sc.end = e.target.value; };
          inputs[4].oninput = e => { sc.room = e.target.value; };
          inputs[5].oninput = e => { sc.professor = e.target.value; };
          deleteBtn.onclick = () => removeScheduleEntry(subj, sc);
        } else {
          const profLine = sc.professor || subj.professor
            ? `<div class="sub-prof">${ICON_PROF} ${sc.professor || subj.professor}</div>`
            : '';
          const codeText = sc.subjectCode || subj.code || '';
          const nameText = sc.subjectName || subj.name || '';
          block.innerHTML =
            `<div class="sub-code">${codeText}</div>` +
            `<div class="sub-name">${nameText}</div>` +
            `<div class="sub-time">${ICON_CLOCK} ${fmt12(sc.start)} &ndash; ${fmt12(sc.end)}</div>` +
            `<div class="sub-room">${ICON_PIN} ${sc.room || ''}</div>` +
            profLine;
        }
        col.appendChild(block);
      });

      if (isEditing) {
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'edit-add-btn';
        addBtn.innerHTML = ICON_PLUS;
        addBtn.title = 'Add subject';
        addBtn.setAttribute('aria-label', 'Add subject');
        addBtn.onclick = () => addBlankSubjectToDay(d);
        col.appendChild(addBtn);
      }
    }
    grid.appendChild(col);
  }

  document.getElementById('scheduleSection').style.display = 'block';

  if (!isEditing) {
    const cardsEl = document.getElementById('subjectCards');
    cardsEl.innerHTML = '';
    data.subjects.forEach(subj => {
      const card = document.createElement('div');
      card.className = 'subject-card';
      const schedText = (subj.schedules || []).map(sc => {
        const days = (sc.days || []).map(d => DAY_FULL[d].slice(0, 3)).join('/');
        const prof = sc.professor || subj.professor;
        return `${days}  ${fmt12(sc.start)} – ${fmt12(sc.end)}  ·  ${sc.room || ''}` + (prof ? `<br><span style="opacity:.8">${prof}</span>` : '');
      }).join('<br>');
      card.innerHTML =
        `<div class="sc-code">${subj.code} · ${subj.units} units</div>` +
        `<div class="sc-name">${subj.name}</div>` +
        `<div class="sc-meta">${schedText || 'No schedule info'}</div>`;
      cardsEl.appendChild(card);
    });
    document.getElementById('subjectListSection').style.display = 'block';
  } else {
    document.getElementById('subjectListSection').style.display = 'none';
  }
}

function escAttr(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
}

function setInfoField(id, data, key, value, type) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  const input = document.createElement('input');
  input.className = 'edit-input';
  input.type = type;
  input.value = value;
  input.placeholder = key;
  input.oninput = e => { data[key] = e.target.value; updateCaptureHeader(); };
  el.appendChild(input);
}

function updateCaptureHeader() {
  if (!currentData) return;
  const name = (currentData.studentName && currentData.studentName.trim()) || '';
  document.getElementById('captureName').textContent = [name, currentData.courseYear].filter(Boolean).join('  ·  ');
  document.getElementById('capturePeriod').textContent = currentData.period || '';
}

/* ── TOGGLE EDIT ── */
function toggleEdit() {
  if (!currentData) return;
  isEditing = !isEditing;

  const editBtn = document.getElementById('editBtn');
  const downloadBtn = document.getElementById('downloadBtn');

  if (isEditing) {
    editBtn.classList.add('active');
    editBtn.innerHTML = `<svg class="icon" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8 6.5 11.5 13 4.5"/></svg> Done Editing`;
    downloadBtn.classList.add('editing-locked');
  } else {
    editBtn.classList.remove('active');
    editBtn.innerHTML = `<svg class="icon" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2l3 3-8 8H3v-3z"/></svg> Edit`;
    downloadBtn.classList.remove('editing-locked');
  }

  renderSchedule(currentData);
}

/* ── DOWNLOAD PNG (with accuracy confirmation modal) ── */
function downloadPNG() {
  if (isEditing) {
    alert('Finish editing first — click "Done Editing", then download.');
    return;
  }
  document.getElementById('confirmModal').style.display = 'flex';
}

function closeConfirmModal() {
  document.getElementById('confirmModal').style.display = 'none';
}

async function confirmAndDownload() {
  closeConfirmModal();
  const btn = document.getElementById('downloadBtn');
  btn.innerHTML = `<svg class="icon" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="8" r="6" stroke-dasharray="3 2"/></svg> Generating...`;
  btn.disabled = true;

  try {
    const el = document.getElementById('captureArea');
    const bgColor = getComputedStyle(el).backgroundColor;

    const canvas = await window.html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: bgColor,
      logging: false,
      width: el.offsetWidth,
      height: el.offsetHeight,
    });

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const name = (document.getElementById('siName').textContent || 'schedule')
        .replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
      a.download = `schedule_${name}.png`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    }, 'image/png');

  } catch(e) {
    alert('PNG generation failed: ' + e.message);
  }

  btn.innerHTML = `<svg class="icon" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M8 2v8M5 7l3 3 3-3"/><path d="M2 13h12"/></svg> Download PNG`;
  btn.disabled = false;
}

/* ── PROCESS FILE ── */
async function processFile(file) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'PASTE_YOUR_FREE_GEMINI_API_KEY_HERE') {
    const eb = document.getElementById('errorBox');
    eb.style.display = 'block';
    eb.innerHTML = 'No API key configured. Open this file and paste a free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">aistudio.google.com/app/apikey</a> into <code>GEMINI_API_KEY</code> near the top of the script.';
    return;
  }

  document.getElementById('uploadZone').style.display = 'none';
  document.getElementById('processingBox').style.display = 'block';
  document.getElementById('errorBox').style.display = 'none';

  try {
    const base64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

    const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    const corInstructions = `This is a Certificate of Registration (COR) from a Philippine university — a table with columns roughly: Code, Subject Code, Subject Description, Units (often split into TF=lecture units and Lab=lab units), Schedule, Instructor, Section.

CRITICAL — COR rows often contain MULTIPLE schedule lines stacked inside the SAME table row (one subject = one row, but 2 or even 3 separate time/day/room lines underneath each other within that row's "Schedule" and "Instructor" cells). Each stacked line is its OWN separate meeting — read every line, do not merge them and do not only read the first line. Common patterns:
- Two lines with different days and different rooms but the same time, e.g. "12:30-2 pm T SELB 302B" then "12:30-2 pm Th VIRTUAL RM16" directly below it — these are TWO separate schedule objects (one day=[1], one day=[3]), each with its own room, even though the instructor is only printed once and applies to both.
- A combined-day line like "10:30 am-12 pm MW SELB 303" — one schedule object with days=[0,2].
- A subject with separate lecture and lab components (units column shows both a lecture-unit number and a lab-unit number, e.g. "4.0 4.0 1.0"): the lecture lines and the lab line are still the SAME subject (same code/name), but each printed schedule line is its own object in "schedules" with its own days/start/end/room. A trailing lab line (e.g. "3:30-5 pm TTh SELB 301B") may have no instructor name printed on its own line — if so, reuse the instructor name printed for that same subject's other lines.
- If the instructor's name is blank/empty on a particular line, inherit it from the nearest line above for that same subject rather than leaving it empty.
Read every line within a row top-to-bottom before moving to the next subject row; do not stop after the first schedule line of a subject.`;

    const gridInstructions = `This is a tabular Class Schedule (a weekly timetable grid with Time down the left side, often in 30-minute sub-rows, and days Mon/Tue/Wed/Thu/Fri/Sat across the top). Each class meeting is shown as a solid COLORED block (e.g. yellow, blue, gray) filling one or more sub-rows under one day column.

CRITICAL — COLOR BLOCK BOUNDARIES: the colored fill of each block always starts and ends exactly ON a horizontal black grid line — never partway through a sub-row. To get the correct start/end time, find the black line where the color begins (that sub-row's start label = the block's start time) and the black line where the color ends (that sub-row's end label = the block's end time). Do not eyeball an approximate time — trace the color fill against the row lines precisely, the same way you would read a bar chart's edges against gridlines. A block spanning three stacked 30-minute sub-rows of the same color is ONE meeting from the top sub-row's start time to the bottom sub-row's end time, not three meetings.

IMPORTANT — the SAME subject code/name can legitimately appear MORE THAN ONCE in the same day column at two separate, non-adjacent colored blocks (e.g. once around mid-morning and again later in the afternoon, often in a different color). Treat each colored block as its OWN separate object in "schedules" with its own start/end/room/professor — do NOT merge them into one block just because the code matches, and do NOT assume it's a duplicate/OCR error.

If a subject's label distinguishes (LEC) vs (LAB) — or any other suffix tag — treat the (LEC) occurrences and the (LAB) occurrences as different schedule entries (different days/times/rooms are expected and normal), but keep them under the same "code"/"name" subject unless the lecture and lab are clearly separate courses.

CRITICAL — read row/column position carefully, do not guess from memory of "typical" schedules:
- Before extracting, identify the exact time-row boundaries (left axis) and exact day-column boundaries (top axis) for this specific document, then re-check each colored block against BOTH axes individually. Do not assume a block belongs to a time/day just because it looks similar to a nearby one — verify the row label and column header line up with the block you are reading.
- Merge sub-rows into one schedule block ONLY if they are physically ADJACENT (back-to-back, no gap, unbroken same color) on the SAME day column. If there is any gap (even one empty or different-color row) between two colored appearances of the same subject on the same day, they are TWO separate schedule entries, not one merged block.
- A subject can have schedule entries with different day-sets and different times at once (e.g. a lecture MW 3:30–5:00 plus a lab on a single day like Fri 2:00–4:00 in a different room) — list each as its own object in "schedules" with its own days/start/end/room.
- If a subject appears twice (or more) in the same day column at clearly separated time ranges, output that many separate schedule objects for it — never collapse a gap between two occurrences into one continuous block, and never drop the second occurrence assuming it's redundant.
- After extraction, re-scan your draft against the image once more, block-by-block, confirming each block's color still starts/ends exactly on the row lines you assigned, and that no day or time was shifted or swapped with an adjacent column.`;

    const sourceInstructions = currentSourceType === 'grid' ? gridInstructions : corInstructions;

    const prompt =
`${sourceInstructions}

Extract ALL subjects, their meeting schedules, rooms, and instructors. Also extract student name, ID number, course/year or section, and the semester/period if shown.

Return ONLY valid JSON — no markdown fences, no explanation:
{
  "studentName": "LASTNAME, FIRSTNAME MI (leave empty string if genuinely not present anywhere in the document)",
  "studentId": "student ID if present, else empty string",
  "courseYear": "e.g. BSBIO 1 or BSCpE - 2A",
  "period": "e.g. 2026-2027/First Semester or 1st Semester, A.Y. 2026-2027",
  "subjects": [
    {
      "code": "subject code e.g. PE 1B or CpE 211",
      "name": "full subject name",
      "units": 2,
      "schedules": [
        { "start": "HH:MM", "end": "HH:MM", "days": [0,2], "room": "room code", "professor": "instructor name if shown for this meeting, else empty string" }
      ]
    }
  ]
}

Day index: M=0 T=1 W=2 Th=3 F=4 S=5. MW=[0,2] TTh=[1,3] MWF=[0,2,4] S=[5]
Time 24h: 9-10am="09:00","10:00" | 12:30-2pm="12:30","14:00" | 3:30-5pm="15:30","17:00" | 7:30-9am="07:30","09:00"

CRITICAL — TIME RANGE SHORTHAND: schedules are very often printed as shorthand like "2-3:30" or "10-11:30", where only ONE side of the range has an explicit minutes value. In that shorthand, BOTH numbers refer to the SAME hour-format already shown — "2-3:30" means 2:00 to 3:30, NOT 2:00 to 3:00 and NOT 2:30 to 3:30. Never invent or drop the ":00"/":30" on the side that doesn't show it; copy the printed minutes for the side that has them and assume ":00" only for the side that has no minutes printed at all. Also use the surrounding time-of-day context (morning rows before noon, afternoon/evening rows after) to resolve AM/PM correctly — do not default to AM for every value.

CRITICAL — read row/column position carefully, do not guess from memory of "typical" schedules. Double check start and end times against the printed labels exactly as shown — do not shift by one row up or down, and do not round to the nearest hour.

If a subject meets on different days with different rooms/times/instructors (e.g. a lecture on MW and a separate lab on Thu), include each as a separate object in the schedules array.
If the same subject+room+time block appears under two adjacent day columns with identical content, you may still list both days together in one "days" array as long as start/end/room/professor match.
Always try to find the instructor/professor name near or inside each class block — common labels include "ENGR.", "TEACHER", or a plain name — and put it in "professor" for that schedule entry.`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: prompt }
          ]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0
        }
      })
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      const msg = e.error?.message || `API error (${res.status})`;
      if (res.status === 429) throw new Error('Free quota hit for right now — wait a bit and try again.');
      if (res.status === 400 && /API key/i.test(msg)) throw new Error('Invalid Gemini API key. Check GEMINI_API_KEY in the script.');
      throw new Error(msg);
    }

    const result = await res.json();
    const text = (result.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || '').join('').trim();

    if (!text) throw new Error('No response from the model. The file may be unreadable — try a clearer scan.');

    let data;
    try { data = JSON.parse(text); }
    catch { const m = text.match(/\{[\s\S]*\}/); if (m) data = JSON.parse(m[0]); else throw new Error('Could not parse schedule. Use a clearer image.'); }

    document.getElementById('processingBox').style.display = 'none';
    renderSchedule(data);

  } catch(err) {
    document.getElementById('processingBox').style.display = 'none';
    document.getElementById('uploadZone').style.display = 'block';
    const eb = document.getElementById('errorBox');
    eb.style.display = 'block';
    eb.textContent = 'Error: ' + (err.message || 'Something went wrong. Try with a clearer image.');
  }
}

/* ── RESET ── */
function reset() {
  currentData = null;
  isEditing = false;
  const editBtn = document.getElementById('editBtn');
  editBtn.classList.remove('active');
  editBtn.innerHTML = `<svg class="icon" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2l3 3-8 8H3v-3z"/></svg> Edit`;
  document.getElementById('downloadBtn').classList.remove('editing-locked');
  ['studentInfo','scheduleSection','subjectListSection','errorBox'].forEach(id =>
    document.getElementById(id).style.display = 'none');
  document.getElementById('uploadZone').style.display = 'block';
  document.getElementById('fileInput').value = '';
  document.getElementById('scheduleGrid').innerHTML = '';
}

/* ── EVENTS ── */
document.getElementById('fileInput').addEventListener('change', e => {
  if (e.target.files[0]) processFile(e.target.files[0]);
});
const zone = document.getElementById('uploadZone');
zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
zone.addEventListener('drop', e => {
  e.preventDefault(); zone.classList.remove('drag');
  if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
});

// // inspect disabled code
// document.addEventListener('contextmenu', e => e.preventDefault());

// document.addEventListener('keydown', e => {
//   if (
//     e.key === 'F12' ||
//     (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) ||
//     (e.ctrlKey && e.key.toUpperCase() === 'U')
//   ) {
//     e.preventDefault();
//   }
// });