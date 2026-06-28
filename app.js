/* ── THEME ── */
function setTheme(t, el) {
  document.body.className = 'theme-' + t;
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
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
const GEMINI_API_KEY = 'AQ.Ab8RN6IazqdTWsPueWCSCohQfm10vApwi-ESR5x_2qbWueeOkw';
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

/* ── RENDER SCHEDULE ── */
function renderSchedule(data) {
  document.getElementById('studentInfo').style.display = 'flex';
  document.getElementById('siName').textContent = data.studentName || '—';
  document.getElementById('siId').textContent = data.studentId || '—';
  document.getElementById('siCourse').textContent = data.courseYear || '—';
  document.getElementById('siPeriod').textContent = data.period || '—';
  document.getElementById('captureName').textContent = [data.studentName, data.courseYear].filter(Boolean).join('  ·  ');
  document.getElementById('capturePeriod').textContent = data.period || '';

  const dayItems = Array.from({length: 6}, () => []);
  data.subjects.forEach(subj => {
    (subj.schedules || []).forEach(sc => {
      (sc.days || []).forEach(d => {
        if (d >= 0 && d <= 5) dayItems[d].push({subj, sc});
      });
    });
  });
  dayItems.forEach(arr => arr.sort((a, b) => timeToMins(a.sc.start) - timeToMins(b.sc.start)));

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
      const e = document.createElement('div');
      e.className = 'empty-day';
      e.textContent = 'No class';
      col.appendChild(e);
    } else {
      items.forEach(({subj, sc}) => {
        const block = document.createElement('div');
        block.className = 'subject-block';
        block.innerHTML =
          `<div class="sub-code">${subj.code}</div>` +
          `<div class="sub-name">${subj.name}</div>` +
          `<div class="sub-time">${ICON_CLOCK} ${fmt12(sc.start)} &ndash; ${fmt12(sc.end)}</div>` +
          `<div class="sub-room">${ICON_PIN} ${sc.room || ''}</div>`;
        col.appendChild(block);
      });
    }
    grid.appendChild(col);
  }

  document.getElementById('scheduleSection').style.display = 'block';

  const cardsEl = document.getElementById('subjectCards');
  cardsEl.innerHTML = '';
  data.subjects.forEach(subj => {
    const card = document.createElement('div');
    card.className = 'subject-card';
    const schedText = (subj.schedules || []).map(sc => {
      const days = (sc.days || []).map(d => DAY_FULL[d].slice(0, 3)).join('/');
      return `${days}  ${fmt12(sc.start)} – ${fmt12(sc.end)}  ·  ${sc.room || ''}`;
    }).join('<br>');
    card.innerHTML =
      `<div class="sc-code">${subj.code} · ${subj.units} units</div>` +
      `<div class="sc-name">${subj.name}</div>` +
      `<div class="sc-meta">${schedText || 'No schedule info'}</div>`;
    cardsEl.appendChild(card);
  });
  document.getElementById('subjectListSection').style.display = 'block';
}

/* ── DOWNLOAD PNG ── */
async function downloadPNG() {
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
    const prompt =
`This is a Certificate of Registration (COR) from a Philippine university. Extract ALL subjects and schedule information.
Return ONLY valid JSON — no markdown fences, no explanation:
{
  "studentName": "LASTNAME, FIRSTNAME MI",
  "studentId": "...",
  "courseYear": "e.g. BSBIO 1",
  "period": "e.g. 2026-2027/First Semester",
  "subjects": [
    {
      "code": "e.g. PE 1B",
      "name": "Full subject name",
      "units": 2,
      "schedules": [
        { "start": "HH:MM", "end": "HH:MM", "days": [0,2], "room": "CAS 203" }
      ]
    }
  ]
}
Day index: M=0 T=1 W=2 Th=3 F=4 S=5. MW=[0,2] TTh=[1,3] MWF=[0,2,4] S=[5]
Time 24h: 9-10am="09:00","10:00" | 12:30-2pm="12:30","14:00" | 3:30-5pm="15:30","17:00" | 7:30-9am="07:30","09:00"
If a subject has separate lab rows, include as a second object in the schedules array.`;

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

// inspect disabled code
document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('keydown', e => {
  if (
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) ||
    (e.ctrlKey && e.key.toUpperCase() === 'U')
  ) {
    e.preventDefault();
  }
});
