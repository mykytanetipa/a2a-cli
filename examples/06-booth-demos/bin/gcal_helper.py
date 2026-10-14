#!/usr/bin/env python3
"""Real Google Calendar API v3 integration with dynamic 09:00-17:00 interval scanning."""
import base64
from concurrent.futures import ThreadPoolExecutor
import datetime
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

DEMO_DIR = pathlib.Path(__file__).resolve().parent.parent
STATE_FILE = DEMO_DIR / ".gcal-state.json"
TOKEN_CACHE = pathlib.Path("/tmp/a2a-gcal-token.json")
SA_KEY_FILE = pathlib.Path.home() / ".config" / "a2a-cal-sa.json"

CALENDARS = {
    "my": {"summary": "Demo: My Calendar", "colorId": "14"},
    "vp": {"summary": "Demo: VP Yaroslav", "colorId": "3"},
    "alex": {"summary": "Demo: Director Alex", "colorId": "6"},
}

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


def load_state() -> dict:
  if not STATE_FILE.exists():
    return {}
  try:
    return json.loads(STATE_FILE.read_text())
  except Exception:
    return {}


def _b64url(data: bytes) -> str:
  return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _token_from_sa_key(key_path: pathlib.Path) -> str:
  key_data = json.loads(key_path.read_text())
  now = int(time.time())
  header = _b64url(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
  claim = _b64url(
      json.dumps({
          "iss": key_data["client_email"],
          "scope": "https://www.googleapis.com/auth/calendar",
          "aud": "https://oauth2.googleapis.com/token",
          "iat": now,
          "exp": now + 3600,
      }).encode()
  )
  signing_input = f"{header}.{claim}".encode("ascii")
  with tempfile.NamedTemporaryFile("w", delete=False) as f:
    f.write(key_data["private_key"])
    pem_path = f.name
  try:
    proc = subprocess.run(
        ["openssl", "dgst", "-sha256", "-sign", pem_path],
        input=signing_input,
        capture_output=True,
        check=True,
    )
    sig = _b64url(proc.stdout)
  finally:
    pathlib.Path(pem_path).unlink(missing_ok=True)

  jwt_assertion = f"{header}.{claim}.{sig}"
  body = urllib.parse.urlencode({
      "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
      "assertion": jwt_assertion,
  }).encode()
  req = urllib.request.Request("https://oauth2.googleapis.com/token", data=body, method="POST")
  with urllib.request.urlopen(req, timeout=10) as resp:
    return json.loads(resp.read().decode())["access_token"]


def get_access_token_and_project():
  if os.environ.get("GCAL_ACCESS_TOKEN"):
    return os.environ["GCAL_ACCESS_TOKEN"], os.environ.get("GOOGLE_CLOUD_PROJECT", "")

  if TOKEN_CACHE.exists():
    try:
      cached = json.loads(TOKEN_CACHE.read_text())
      if cached.get("expires_at", 0) > time.time() + 60:
        return cached["access_token"], cached.get("quota_project", "")
    except Exception:
      pass

  state = load_state()
  sa_email = state.get("sa_email", "")
  quota_project = state.get("quota_project", "")

  if SA_KEY_FILE.exists():
    try:
      token = _token_from_sa_key(SA_KEY_FILE)
      TOKEN_CACHE.write_text(
          json.dumps({
              "access_token": token,
              "expires_at": time.time() + 3000,
              "quota_project": quota_project,
          })
      )
      return token, quota_project
    except Exception as e:
      sys.stderr.write(f"[warn] SA key token exchange failed: {e}\n")

  if sa_email:
    proc = subprocess.run(
        [
            "gcloud",
            "auth",
            "print-access-token",
            f"--impersonate-service-account={sa_email}",
            "--scopes=https://www.googleapis.com/auth/calendar",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode == 0 and proc.stdout.strip():
      token = proc.stdout.strip()
      TOKEN_CACHE.write_text(
          json.dumps({
              "access_token": token,
              "expires_at": time.time() + 3000,
              "quota_project": quota_project,
          })
      )
      return token, quota_project

  raise RuntimeError(
      "Could not obtain Google Calendar token. Check gcloud login/project and re-run reset-calendars."
  )


def gcal_request(method: str, path: str, body=None, query=None):
  token, _ = get_access_token_and_project()
  url = f"https://www.googleapis.com/calendar/v3{path}"
  if query:
    url += "?" + urllib.parse.urlencode(query)
  data = json.dumps(body).encode() if body is not None else None
  headers = {
      "Authorization": f"Bearer {token}",
      "Content-Type": "application/json",
  }

  for attempt in range(6):
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
      with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
      err_body = e.read().decode(errors="ignore")
      if e.code in (403, 429, 500, 503) and (
          "rateLimitExceeded" in err_body
          or "userRateLimitExceeded" in err_body
          or "quotaExceeded" in err_body
          or e.code in (429, 500, 503)
      ) and attempt < 5:
        time.sleep(0.6 * (attempt + 1))
        continue
      raise RuntimeError(f"Google Calendar API {method} {path} failed ({e.code}): {err_body}") from e


def next_week_monday() -> datetime.date:
  today = datetime.date.today()
  return today - datetime.timedelta(days=today.weekday()) + datetime.timedelta(days=7)


def local_tz() -> datetime.tzinfo:
  return datetime.datetime.now().astimezone().tzinfo


def local_tz_offset() -> str:
  now = datetime.datetime.now().astimezone()
  offset = now.utcoffset() or datetime.timedelta(0)
  total_minutes = int(offset.total_seconds() // 60)
  sign = "+" if total_minutes >= 0 else "-"
  total_minutes = abs(total_minutes)
  return f"{sign}{total_minutes // 60:02d}:{total_minutes % 60:02d}"


def slot_iso(day_offset: int, hh_mm: str) -> str:
  monday = next_week_monday()
  target_date = monday + datetime.timedelta(days=day_offset)
  tz = local_tz_offset()
  return f"{target_date.isoformat()}T{hh_mm}:00{tz}"


def create_event(cal_id: str, summary: str, day_offset: int, start_hm: str, end_hm: str, description: str = "") -> dict:
  body = {
      "summary": summary,
      "description": description,
      "start": {"dateTime": slot_iso(day_offset, start_hm)},
      "end": {"dateTime": slot_iso(day_offset, end_hm)},
  }
  return gcal_request("POST", f"/calendars/{urllib.parse.quote(cal_id, safe='')}/events", body=body)


def list_week_events(cal_id: str, include_this_week: bool = False) -> list[dict]:
  monday = next_week_monday()
  start_day = monday - datetime.timedelta(days=7) if include_this_week else monday
  saturday = monday + datetime.timedelta(days=5)
  tz = local_tz_offset()
  res = gcal_request(
      "GET",
      f"/calendars/{urllib.parse.quote(cal_id, safe='')}/events",
      query={
          "timeMin": f"{start_day.isoformat()}T00:00:00{tz}",
          "timeMax": f"{saturday.isoformat()}T23:59:59{tz}",
          "singleEvents": "true",
          "orderBy": "startTime",
      },
  )
  return res.get("items", [])


def clear_week_events(cal_id: str):
  events = list_week_events(cal_id, include_this_week=True)
  def _del(ev):
    ev_id = ev.get("id")
    if ev_id:
      try:
        gcal_request(
            "DELETE",
            f"/calendars/{urllib.parse.quote(cal_id, safe='')}/events/{urllib.parse.quote(ev_id, safe='')}",
        )
      except Exception:
        pass
  with ThreadPoolExecutor(max_workers=2) as pool:
    list(pool.map(_del, events))


def get_alex_agent_url() -> str:
  if os.environ.get("ALEX_AGENT_URL"):
    return os.environ["ALEX_AGENT_URL"]
  env_file = DEMO_DIR / "calendar-worker" / ".deployed-urls.env"
  if env_file.exists():
    for line in env_file.read_text().splitlines():
      if line.startswith("ALEX_AGENT_URL="):
        return line.split("=", 1)[1].strip().strip('"')
  return "https://alex-schedule-bot.booth-demos.workers.dev"


def reset_and_seed(quota_project: str = "", sa_email: str = "", user_email: str = ""):
  prev = load_state()
  STATE_FILE.write_text(
      json.dumps(
          {
              **prev,
              "quota_project": quota_project or prev.get("quota_project", ""),
              "sa_email": sa_email or prev.get("sa_email", ""),
              "user_email": user_email or prev.get("user_email", ""),
          },
          indent=2,
      )
  )
  if TOKEN_CACHE.exists():
    TOKEN_CACHE.unlink()

  cal_list = gcal_request("GET", "/users/me/calendarList").get("items", [])
  by_summary = {c.get("summary"): c.get("id") for c in cal_list}

  cal_ids = {}
  for key, meta in CALENDARS.items():
    cal_id = by_summary.get(meta["summary"])
    if not cal_id:
      print(f"📅 Creating Google Calendar: {meta['summary']}...")
      created = gcal_request("POST", "/calendars", body={"summary": meta["summary"]})
      cal_id = created["id"]
    if user_email:
      try:
        gcal_request(
            "POST",
            f"/calendars/{urllib.parse.quote(cal_id, safe='')}/acl",
            body={"role": "owner", "scope": {"type": "user", "value": user_email}},
        )
      except Exception:
        pass
    try:
      gcal_request(
          "PATCH",
          f"/users/me/calendarList/{urllib.parse.quote(cal_id, safe='')}",
          body={"colorId": meta["colorId"], "selected": True},
      )
    except Exception:
      pass
    cal_ids[key] = cal_id

  print("🧹 Clearing existing demo events (this week & next week)...")
  for key, cid in cal_ids.items():
    clear_week_events(cid)

  alex_url = get_alex_agent_url()
  movable_desc = f"movable: true\nattendee_agent: {alex_url}"

  # Full realistic Monday-Friday 09:00-17:00 schedules across all 3 calendars
  my_specs = [
      # Monday: open 16:00-16:30
      (cal_ids["my"], "Sprint Planning & Design Deep Dive", 0, "09:00", "16:00", ""),
      (cal_ids["my"], "PR & Code Review Triage", 0, "16:30", "17:00", ""),
      # Tuesday: fully booked 09:00-17:00
      (cal_ids["my"], "Architecture Offsite & Incident Game Day", 1, "09:00", "17:00", ""),
      # Wednesday: open 10:30-11:00
      (cal_ids["my"], "Platform Guild Sync", 2, "09:00", "10:30", ""),
      (cal_ids["my"], "Security Review & Customer Escalation Session", 2, "11:00", "17:00", ""),
      # Thursday: open 15:30-16:00
      (cal_ids["my"], "Quarterly Roadmap & Load Benchmarking", 3, "09:00", "15:30", ""),
      (cal_ids["my"], "Mentorship & Peer 1:1s", 3, "16:00", "17:00", ""),
      # Friday: fully booked 09:00-17:00
      (cal_ids["my"], "Release Readiness Review & Eng All-Hands", 4, "09:00", "17:00", ""),
  ]

  vp_specs = [
      # Monday: fully booked 09:00-17:00
      (cal_ids["vp"], "Executive Staff Sync & Board Deck Prep", 0, "09:00", "17:00", ""),
      # Tuesday: open 10:00-10:30
      (cal_ids["vp"], "VP & Directors Weekly Sync", 1, "09:00", "10:00", ""),
      (cal_ids["vp"], "Cloud FinOps Review & Keynote Rehearsal", 1, "10:30", "17:00", ""),
      # Wednesday: open 14:00-14:30
      (cal_ids["vp"], "Enterprise Customer Executive Briefing", 2, "09:00", "14:00", ""),
      (cal_ids["vp"], "Product & GTM Strategy Review", 2, "14:30", "17:00", ""),
      # Thursday: open 11:00-11:30; movable internal 1:1 at 15:30-16:00
      (cal_ids["vp"], "Quarterly Business Review (QBR)", 3, "09:00", "11:00", ""),
      (cal_ids["vp"], "Executive Offsite & Working Lunch", 3, "11:30", "15:30", ""),
      (cal_ids["vp"], "Weekly Sync: Yaroslav (VP) & Alex (Director of Platform)", 3, "15:30", "16:00", movable_desc),
      (cal_ids["vp"], "Investor Relations Call", 3, "16:00", "17:00", ""),
      # Friday: open 11:00-11:30
      (cal_ids["vp"], "FY Headcount & Org Planning", 4, "09:00", "11:00", ""),
      (cal_ids["vp"], "Engineering All-Hands & Town Hall", 4, "11:30", "17:00", ""),
  ]

  alex_specs = [
      # Monday: fully booked 09:00-17:00
      (cal_ids["alex"], "Platform Roadmap & Core Infra Review", 0, "09:00", "17:00", ""),
      # Tuesday: open 15:00-15:30
      (cal_ids["alex"], "SRE & Reliability Engineering Summit", 1, "09:00", "15:00", ""),
      (cal_ids["alex"], "Cloud Vendor Contract Negotiation", 1, "15:30", "17:00", ""),
      # Wednesday: fully booked 09:00-17:00
      (cal_ids["alex"], "Data Center Capacity & GPU Cluster Planning", 2, "09:00", "17:00", ""),
      # Thursday: movable internal 1:1 at 15:30-16:00
      (cal_ids["alex"], "Quarterly Business Review & Staff Hiring Panel", 3, "09:00", "15:30", ""),
      (cal_ids["alex"], "Weekly Sync: Yaroslav (VP) & Alex (Director of Platform)", 3, "15:30", "16:00", movable_desc),
      (cal_ids["alex"], "Platform Postmortem Review", 3, "16:00", "17:00", ""),
      # Friday: open 11:00-11:30
      (cal_ids["alex"], "Core Infra Escalation Triage", 4, "09:00", "11:00", ""),
      (cal_ids["alex"], "Engineering All-Hands & Skip-Level 1:1s", 4, "11:30", "17:00", ""),
  ]

  print("🌱 Seeding full 09:00–17:00 Mon–Fri schedules on all 3 Google Calendars...")
  all_specs = my_specs + vp_specs + alex_specs
  with ThreadPoolExecutor(max_workers=2) as pool:
    list(pool.map(lambda s: create_event(*s), all_specs))

  next_mon = next_week_monday()
  state = {
      "quota_project": quota_project,
      "sa_email": sa_email,
      "user_email": user_email,
      "calendars": cal_ids,
      "week_monday": next_mon.isoformat(),
  }
  STATE_FILE.write_text(json.dumps(state, indent=2))
  print(f"✅ All 3 Google Calendars seeded for NEXT WEEK (week of {next_mon.isoformat()})!")
  for key, meta in CALENDARS.items():
    cid = urllib.parse.quote(cal_ids[key])
    print(f"   🔗 Add '{meta['summary']}' to your Google Calendar UI: https://calendar.google.com/calendar/u/0/r?cid={cid}")
  print(f"\n📅 View Next Week in Google Calendar: https://calendar.google.com/calendar/u/0/r/week/{next_mon.year}/{next_mon.month}/{next_mon.day}")


def analyze_calendar_week(cal_id: str) -> dict:
  """Dynamically scans all real events on `cal_id` for next week (Mon-Fri 09:00-17:00)
  and computes open 30-min slots, busy events, and movable internal meetings."""
  monday = next_week_monday()
  tz = local_tz()
  events = list_week_events(cal_id)

  parsed_events = []
  for ev in events:
    s_raw = ev.get("start", {}).get("dateTime", "")
    e_raw = ev.get("end", {}).get("dateTime", "")
    if not s_raw or not e_raw:
      continue
    dt_s = datetime.datetime.fromisoformat(s_raw).astimezone(tz)
    dt_e = datetime.datetime.fromisoformat(e_raw).astimezone(tz)
    desc = ev.get("description", "") or ""
    parsed_events.append({
        "id": ev.get("id", ""),
        "summary": ev.get("summary", "Busy"),
        "description": desc,
        "start": dt_s,
        "end": dt_e,
        "day_name": dt_s.strftime("%A"),
        "slot": f"{dt_s.strftime('%A')} {dt_s.strftime('%H:%M')}-{dt_e.strftime('%H:%M')}",
    })

  open_slots = []
  for day_idx in range(5):
    day_date = monday + datetime.timedelta(days=day_idx)
    day_name = DAY_NAMES[day_idx]
    for hour in range(9, 17):
      for minute in (0, 30):
        slot_s = datetime.datetime(
            day_date.year, day_date.month, day_date.day, hour, minute, tzinfo=tz
        )
        slot_e = slot_s + datetime.timedelta(minutes=30)
        overlaps = any(ev["start"] < slot_e and ev["end"] > slot_s for ev in parsed_events)
        if not overlaps:
          open_slots.append(
              f"{day_name} {slot_s.strftime('%H:%M')}-{slot_e.strftime('%H:%M')}"
          )

  movable = []
  for ev in parsed_events:
    if "movable: true" in ev["description"].lower():
      m_agent = re.search(r"attendee_agent:\s*(\S+)", ev["description"])
      agent_url = m_agent.group(1) if m_agent else get_alex_agent_url()
      movable.append({
          "slot": ev["slot"],
          "google_calendar_event_id": ev["id"],
          "meeting_title": ev["summary"],
          "attendee_a2a_agent": agent_url,
      })

  return {
      "week_of": monday.isoformat(),
      "open_30m_slots": open_slots,
      "movable_internal_meetings": movable,
      "events": parsed_events,
  }


def print_my_calendar():
  state = load_state()
  cal_id = state.get("calendars", {}).get("my")
  if not cal_id:
    raise RuntimeError("Google Calendars not initialized. Run reset-calendars.")
  analysis = analyze_calendar_week(cal_id)
  print(
      f"=== My Calendar Next Week (Week of {analysis['week_monday'] if 'week_monday' in analysis else analysis['week_of']} — Live Google Calendar 09:00–17:00) ==="
  )
  print("\nOpen 30-Minute Slots (09:00–17:00 Mon–Fri):")
  if analysis["open_30m_slots"]:
    for s in analysis["open_30m_slots"]:
      print(f"  ✅ FREE: {s}")
  else:
    print("  (No open 30-min slots)")

  print("\nScheduled Meetings on Google Calendar:")
  for ev in analysis["events"]:
    marker = "📅 BOOKED 1:1" if ("1:1 with" in ev["summary"] or "Invite:" in ev["summary"]) else "❌ BUSY"
    print(f"  - {ev['slot']}: {marker} ({ev['summary']})")


def parse_slot_arg(slot_text: str) -> tuple[int, str, str]:
  lower = (slot_text or "").lower()
  day_map = {"monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4}
  day_offset = 3
  for dname, idx in day_map.items():
    if dname in lower:
      day_offset = idx
      break
  m = re.search(r"(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})", slot_text or "")
  if m:
    s_hm = m.group(1).zfill(5)
    e_hm = m.group(2).zfill(5)
    return day_offset, s_hm, e_hm
  m_single = re.search(r"(\d{1,2}:\d{2})", slot_text or "")
  if m_single:
    s_hm = m_single.group(1).zfill(5)
    dt = datetime.datetime.strptime(s_hm, "%H:%M") + datetime.timedelta(minutes=30)
    return day_offset, s_hm, dt.strftime("%H:%M")
  return day_offset, "15:30", "16:00"


def find_event_at_slot(cal_id: str, day_offset: int, start_hm: str) -> dict | None:
  target_iso = slot_iso(day_offset, start_hm)
  target_dt = datetime.datetime.fromisoformat(target_iso)
  for ev in list_week_events(cal_id):
    s_raw = ev.get("start", {}).get("dateTime", "")
    e_raw = ev.get("end", {}).get("dateTime", "")
    if not s_raw or not e_raw:
      continue
    dt_s = datetime.datetime.fromisoformat(s_raw)
    dt_e = datetime.datetime.fromisoformat(e_raw)
    if dt_s <= target_dt < dt_e:
      return ev
  return None


def move_meeting_dynamic(from_slot_str: str, to_slot_str: str) -> dict:
  state = load_state()
  cals = state.get("calendars", {})
  from_day, from_s, _ = parse_slot_arg(from_slot_str)
  to_day, to_s, to_e = parse_slot_arg(to_slot_str)

  body_patch = {
      "start": {"dateTime": slot_iso(to_day, to_s)},
      "end": {"dateTime": slot_iso(to_day, to_e)},
  }

  moved_calendars = []
  for cal_key in ("alex", "vp"):
    cid = cals.get(cal_key)
    if not cid:
      continue
    ev = find_event_at_slot(cid, from_day, from_s)
    if ev and ev.get("id"):
      new_summary = ev.get("summary", "Weekly Sync")
      if "CAL-RESCHED-409" not in new_summary:
        new_summary = f"{new_summary} [Rescheduled: CAL-RESCHED-409]"
      gcal_request(
          "PATCH",
          f"/calendars/{urllib.parse.quote(cid, safe='')}/events/{urllib.parse.quote(ev['id'], safe='')}",
          body={**body_patch, "summary": new_summary},
      )
      moved_calendars.append(CALENDARS[cal_key]["summary"])

  return {
      "status": "RESCHEDULED",
      "moved_from": f"{DAY_NAMES[from_day]} {from_s}",
      "moved_to": f"{DAY_NAMES[to_day]} {to_s}-{to_e}",
      "reschedule_id": "CAL-RESCHED-409",
      "updated_google_calendars": moved_calendars,
  }


def book_1on1_on_gcal(summary: str, invite_id: str, slot_str: str = "Thursday 15:30-16:00", include_vp: bool = True) -> dict:
  state = load_state()
  cals = state.get("calendars", {})
  day_offset, start_hm, end_hm = parse_slot_arg(slot_str)
  full_summary = f"{summary} [Invite: {invite_id}]"
  if cals.get("my"):
    create_event(cals["my"], full_summary, day_offset, start_hm, end_hm, description=f"Invite ID: {invite_id}")
  if include_vp and cals.get("vp"):
    create_event(cals["vp"], full_summary, day_offset, start_hm, end_hm, description=f"Invite ID: {invite_id}")
  return {
      "status": "CONFIRMED",
      "slot": f"{DAY_NAMES[day_offset]} {start_hm}-{end_hm}",
      "calendar_invite_id": invite_id,
      "google_calendar_synced": True,
  }


def get_vp_availability_live() -> dict:
  state = load_state()
  cal_id = state.get("calendars", {}).get("vp")
  if not cal_id:
    raise RuntimeError("No VP calendar in state")
  analysis = analyze_calendar_week(cal_id)
  return {
      "source": "Google Calendar API v3 (Demo: VP Yaroslav)",
      "week_of": analysis["week_of"],
      "open_30m_slots": analysis["open_30m_slots"],
      "movable_internal_meetings": analysis["movable_internal_meetings"],
  }


def get_alex_availability_live() -> dict:
  state = load_state()
  cal_id = state.get("calendars", {}).get("alex")
  if not cal_id:
    raise RuntimeError("No Alex calendar in state")
  analysis = analyze_calendar_week(cal_id)
  return {
      "source": "Google Calendar API v3 (Demo: Director Alex)",
      "week_of": analysis["week_of"],
      "open_30m_slots": analysis["open_30m_slots"],
      "movable_internal_meetings": analysis["movable_internal_meetings"],
  }


if __name__ == "__main__":
  cmd = sys.argv[1] if len(sys.argv) > 1 else ""
  if cmd == "reset":
    proj = sys.argv[2] if len(sys.argv) > 2 else ""
    sa = sys.argv[3] if len(sys.argv) > 3 else ""
    usr = sys.argv[4] if len(sys.argv) > 4 else ""
    reset_and_seed(proj, sa, usr)
  elif cmd == "my-calendar":
    print_my_calendar()
  elif cmd == "vp-availability":
    print(json.dumps(get_vp_availability_live(), indent=2))
  elif cmd == "alex-availability":
    print(json.dumps(get_alex_availability_live(), indent=2))
  elif cmd == "move-sync":
    from_arg = sys.argv[2] if len(sys.argv) > 2 else "Thursday 15:30-16:00"
    to_arg = sys.argv[3] if len(sys.argv) > 3 else "Friday 11:00-11:30"
    print(json.dumps(move_meeting_dynamic(from_arg, to_arg), indent=2))
  elif cmd == "book-vp":
    slot_arg = sys.argv[2] if len(sys.argv) > 2 else "Thursday 15:30-16:00"
    print(json.dumps(book_1on1_on_gcal("1:1 with Yaroslav, VP of Engineering", "CAL-INV-8842", slot_arg, include_vp=True), indent=2))
  elif cmd == "book-ea":
    slot_arg = sys.argv[2] if len(sys.argv) > 2 else "Thursday 15:30-16:00"
    print(json.dumps(book_1on1_on_gcal("1:1 with VP Sarah Chen (Confirmed via EA email)", "CAL-EA-104", slot_arg, include_vp=False), indent=2))
