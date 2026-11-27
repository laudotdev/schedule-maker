import re

DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday",
             "Friday", "Saturday", "Sunday"]

# Day codes as they appear on a COR. TTh = Tuesday + Thursday.
DAY_MAP = {
    "M": ["Monday"],
    "T": ["Tuesday"],
    "W": ["Wednesday"],
    "TH": ["Thursday"],
    "F": ["Friday"],
    "S": ["Saturday"],
    "SAT": ["Saturday"],
    "SUN": ["Sunday"],
    "MW": ["Monday", "Wednesday"],
    "WF": ["Wednesday", "Friday"],
    "MWF": ["Monday", "Wednesday", "Friday"],
    "TTH": ["Tuesday", "Thursday"],     
}

# e.g. "12:30-2 pm T SELB 302B"  /  "10:30 am-12 pm TTh SELB 302B"
TIME_RE = re.compile(
    r"(?P<sh>\d{1,2})(?::(?P<sm>\d{2}))?\s*(?P<sap>[ap])?\.?m?\.?\s*-\s*"
    r"(?P<eh>\d{1,2})(?::(?P<em>\d{2}))?\s*(?P<eap>[ap])?\.?m?\.?\s+"
    r"(?P<days>TTh|MWF|MW|WF|TH|SAT|SUN|T|M|W|F|S)\b",
    re.IGNORECASE,
)

# e.g. "C507 ACC 211 Fundamentals of Electrical Circuits 4.0 4.0 1.0 ..."
SUBJECT_RE = re.compile(
    r"^C?\d{3}\s+([A-Z]{2,4}\s?\d{0,3}[A-Z]?\*?)\s+(.+?)\s+\d\.\d\s+\d\.\d"
)

ROOM_RE = re.compile(
    r"(VIRTUAL\s*RM\s*\d+|GYMNASIUM\s*[A-Z]?|[A-Z]{2,}\s*\d+[A-Z]?|RM\s*\d+)",
    re.IGNORECASE,
)

NAME_RE = re.compile(r"Name:\s*([A-Z][A-Za-z.,' -]+?)\s+ID", re.IGNORECASE)
PROGRAM_RE = re.compile(
    r"(?:degree\s+)?(?:program|course)\s*:\s*(.+?)(?=\s+(?:year(?:\s+level)?|id|name)\s*:|$)",
    re.IGNORECASE,
)
YEAR_RE = re.compile(r"year(?:\s+level)?\s*:\s*(\d+(?:st|nd|rd|th)?|[A-Za-z]+)", re.IGNORECASE)
TERM_RE = re.compile(
    r"(?:(?:academic\s+year|a\.?\s*y\.?)\s*:?\s*)?"
    r"(?P<year>20\d{2}\s*[-–/]\s*20\d{2})\s*[/|,-]?\s*"
    r"(?P<term>first|second|summer)\s+semester",
    re.IGNORECASE,
)
INSTRUCTOR_LABEL_RE = re.compile(r"(?:instructor|teacher)\s*:\s*(.+)", re.IGNORECASE)


def _ap(value):
    return value.lower()[0] if value else None


def _guess(hour):
    """Guess a/p for an unmarked hour (school hours ~7am-7pm)."""
    h = int(hour)
    return "p" if h == 12 or 1 <= h <= 6 else "a"


def _flip(ap):
    return "a" if ap == "p" else "p"


def _to_min(hour, minute, ap):
    h = int(hour) % 12
    if ap == "p":
        h += 12
    return h * 60 + int(minute or 0)


def _resolve(m):
    """Return (start_min, end_min) from a TIME_RE match, handling missing am/pm."""
    sap, eap = _ap(m["sap"]), _ap(m["eap"])
    s = sap or _guess(m["sh"])
    e = eap or _guess(m["eh"])
    start = _to_min(m["sh"], m["sm"], s)
    end = _to_min(m["eh"], m["em"], e)
    if start >= end:
        if eap is None:
            e = _flip(e)
        elif sap is None:
            s = _flip(s)
        start = _to_min(m["sh"], m["sm"], s)
        end = _to_min(m["eh"], m["em"], e)
    return start, end


def fmt_time(minutes):
    h24, mm = divmod(minutes, 60)
    h12 = h24 % 12 or 12
    return f"{h12}:{mm:02d} {'AM' if h24 < 12 else 'PM'}"


def parse_header(text):
    name_match = NAME_RE.search(text)
    program_match = PROGRAM_RE.search(text)
    year_match = YEAR_RE.search(text)
    term_match = TERM_RE.search(text)

    program = program_match.group(1).strip(" \t:;,-") if program_match else None
    year_level = year_match.group(1).strip() if year_match else None
    term = None
    if term_match:
        academic_year = re.sub(r"\s+", "", term_match.group("year")).replace("–", "-").replace("/", "-")
        semester = term_match.group("term").title()
        term = f"{academic_year}/{semester} Semester"

    return {
        "name": name_match.group(1).strip() if name_match else None,
        "program": program,
        "year_level": year_level,
        "term": term,
    }


def _parse_instructor(tail, room_match):
    after_room = tail[room_match.end():] if room_match else tail
    after_room = after_room.strip(" \t|,:;-.")
    if not after_room:
        return ""

    labeled = INSTRUCTOR_LABEL_RE.search(after_room)
    if labeled:
        after_room = labeled.group(1).strip()

    # Only accept name-like text so trailing units or OCR fragments aren't shown as staff.
    if re.fullmatch(r"[A-Za-z][A-Za-z.' -]*[A-Za-z.]", after_room) and len(after_room.split()) >= 2:
        return after_room
    return ""


def parse_segments(line):
    segments = []
    matches = list(TIME_RE.finditer(line))
    for i, m in enumerate(matches):
        days_key = m["days"].upper()
        if days_key not in DAY_MAP:
            continue
        tail_end = matches[i + 1].start() if i + 1 < len(matches) else len(line)
        tail = line[m.end():tail_end]
        room = ROOM_RE.search(tail)
        start, end = _resolve(m)
        segments.append({
            "days": DAY_MAP[days_key],
            "start": start,
            "end": end,
            "room": room.group(1).strip() if room else "",
            "instructor": _parse_instructor(tail, room),
        })
    return segments


def parse_cor_text(text):
    subjects = []
    current = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        m = SUBJECT_RE.match(line)
        if m:
            current = {
                "code": m.group(1).replace("*", "").strip(),
                "description": m.group(2).strip(),
                "schedules": [],
            }
            subjects.append(current)
        if current is None:
            continue
        # Schedule rows can wrap onto their own line, so attach them to the last subject.
        current["schedules"].extend(parse_segments(line))
    return subjects


def build_schedule(subjects):
    entries = []
    for s in subjects:
        for seg in s["schedules"]:
            for day in seg["days"]:
                entries.append({
                    "day": day,
                    "start": seg["start"],
                    "end": seg["end"],
                    "code": s["code"],
                    "description": s["description"],
                    "room": seg["room"],
                    "instructor": seg.get("instructor", ""),
                })

    by_day, readable, conflicts = {}, [], []
    for day in DAY_ORDER:
        items = sorted((e for e in entries if e["day"] == day), key=lambda e: e["start"])
        if not items:
            continue
        by_day[day] = []
        for prev, cur in zip(items, items[1:]):
            if cur["start"] < prev["end"]:
                conflicts.append(
                    f"{day}: {prev['code']} overlaps {cur['code']} "
                    f"({fmt_time(cur['start'])})"
                )
        for e in items:
            time_str = f"{fmt_time(e['start'])} - {fmt_time(e['end'])}"
            by_day[day].append({
                "time": time_str,
                "code": e["code"],
                "description": e["description"],
                "room": e["room"],
                "instructor": e["instructor"],
            })
            readable.append(
                f"{day}: {time_str} | {e['code']} {e['description']}"
                + (f" | {e['room']}" if e["room"] else "")
            )

    return {
        "subjects": [{"code": s["code"], "description": s["description"]} for s in subjects],
        "by_day": by_day,
        "readable": readable,
        "conflicts": conflicts,
    }
