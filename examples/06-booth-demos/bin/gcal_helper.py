#!/usr/bin/env python3
"""Real Google Calendar API v3 integration for Demo 2 (using Service Account key or impersonation)."""
import base64
import datetime
import json
import os
import pathlib
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

  # 1. Fastest & zero IAM propagation delay: sign JWT with ~/.config/a2a-cal-sa.json
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

  # 2. Fallback: gcloud service account impersonation
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
    sys.stderr.write(f"[warn] gcloud impersonation stderr: {proc.stderr}\n")

  raise RuntimeError(
      "Could not obtain Google Calendar token. Check gcloud login/project and re-run reset-calendars."
  )


def gcal_request(method: str, path: str, body=None, query=None):
  token, quota_project = get_access_token_and_project()
  url = f"https://www.googleapis.com/calendar/v3{path}"
  if query:
    url += "?" + urllib.parse.urlencode(query)
  data = json.dumps(body).encode() if body is not None else None

  def _do(use_project: bool):
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    if use_project and quota_project:
      headers["X-Goog-User-Project"] = quota_project
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=15) as resp:
      raw = resp.read().decode()
      return json.loads(raw) if raw else {}

  try:
    return _do(False)
  except urllib.error.HTTPError as e:
    err_body = e.read().decode(errors="ignore")
    if quota_project:
      try:
        return _do(True)
      except urllib.error.HTTPError as e2:
        err_body = e2.read().decode(errors="ignore")
        raise RuntimeError(f"Google Calendar API {method} {path} failed ({e2.code}): {err_body}") from e2
    raise RuntimeError(f"Google Calendar API {method} {path} failed ({e.code}): {err_body}") from e


def current_week_monday() -> datetime.date:
  today = datetime.date.today()
  return today - datetime.timedelta(days=today.weekday()) + datetime.timedelta(days=7)


def local_tz_offset() -> str:
  now = datetime.datetime.now().astimezone()
  offset = now.utcoffset() or datetime.timedelta(0)
  total_minutes = int(offset.total_seconds() // 60)
  sign = "+" if total_minutes >= 0 else "-"
  total_minutes = abs(total_minutes)
  return f"{sign}{total_minutes // 60:02d}:{total_minutes % 60:02d}"


def slot_iso(day_offset: int, hh_mm: str) -> str:
  monday = current_week_monday()
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
  next_monday = current_week_monday()
  start_day = next_monday - datetime.timedelta(days=7) if include_this_week else next_monday
  saturday = next_monday + datetime.timedelta(days=5)
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
  for ev in list_week_events(cal_id, include_this_week=True):
    ev_id = ev.get("id")
    if ev_id:
      try:
        gcal_request(
            "DELETE",
            f"/calendars/{urllib.parse.quote(cal_id, safe='')}/events/{urllib.parse.quote(ev_id, safe='')}",
        )
      except Exception:
        pass


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

  print("🌱 Seeding 'Demo: My Calendar' for next week...")
  create_event(cal_ids["my"], "Architecture Offsite", 1, "10:00", "10:30")
  create_event(cal_ids["my"], "Customer Escalation Sync", 2, "14:00", "14:30")
  create_event(cal_ids["my"], "Sprint Planning", 3, "11:00", "11:30")
  create_event(cal_ids["my"], "Dentist", 4, "09:30", "10:00")
  create_event(cal_ids["my"], "Release Readiness Review", 4, "11:00", "11:30")

  print("🌱 Seeding 'Demo: VP Yaroslav' for next week...")
  create_event(cal_ids["vp"], "Staff Sync", 1, "09:00", "10:00")
  create_event(cal_ids["vp"], "Board Prep", 1, "10:30", "12:00")
  create_event(cal_ids["vp"], "Product Review", 2, "13:00", "14:00")
  create_event(cal_ids["vp"], "Exec Review", 2, "14:30", "16:00")
  create_event(cal_ids["vp"], "QBR Review", 3, "09:30", "11:00")
  create_event(cal_ids["vp"], "Leadership Lunch", 3, "11:30", "12:30")
  vp_sync = create_event(
      cal_ids["vp"],
      "Weekly Sync: Yaroslav (VP) & Alex (Director of Platform)",
      3,
      "15:30",
      "16:00",
      description="[MOVABLE_INTERNAL_1ON1]",
  )

  print("🌱 Seeding 'Demo: Director Alex' for next week...")
  alex_sync = create_event(
      cal_ids["alex"],
      "Weekly Sync: Yaroslav (VP) & Alex (Director of Platform)",
      3,
      "15:30",
      "16:00",
      description="[MOVABLE_INTERNAL_1ON1]",
  )

  next_mon = current_week_monday()
  state = {
      "quota_project": quota_project,
      "sa_email": sa_email,
      "user_email": user_email,
      "calendars": cal_ids,
      "vp_sync_event_id": vp_sync["id"],
      "alex_sync_event_id": alex_sync["id"],
      "week_monday": next_mon.isoformat(),
  }
  STATE_FILE.write_text(json.dumps(state, indent=2))
  print(f"✅ All 3 Google Calendars seeded for NEXT WEEK (week of {next_mon.isoformat()})!")
  for key, meta in CALENDARS.items():
    cid = urllib.parse.quote(cal_ids[key])
    print(f"   🔗 Add '{meta['summary']}' to your Google Calendar UI: https://calendar.google.com/calendar/u/0/r?cid={cid}")
  print(f"\n📅 View Next Week in Google Calendar: https://calendar.google.com/calendar/u/0/r/week/{next_mon.year}/{next_mon.month}/{next_mon.day}")


def format_slot_label(ev: dict) -> tuple[str, str]:
  start_raw = ev.get("start", {}).get("dateTime", "")
  end_raw = ev.get("end", {}).get("dateTime", "")
  if not start_raw or not end_raw:
    return ("Unknown", ev.get("summary", "Busy"))
  dt_start = datetime.datetime.fromisoformat(start_raw).astimezone()
  dt_end = datetime.datetime.fromisoformat(end_raw).astimezone()
  day_name = dt_start.strftime("%A")
  slot_str = f"{day_name} {dt_start.strftime('%H:%M')}-{dt_end.strftime('%H:%M')}"
  return slot_str, ev.get("summary", "Busy")


def print_my_calendar():
  state = load_state()
  cal_id = state.get("calendars", {}).get("my")
  if not cal_id:
    raise RuntimeError("Google Calendars not initialized. Run reset-calendars.")
  events = list_week_events(cal_id)
  by_slot = {}
  for ev in events:
    slot_str, summary = format_slot_label(ev)
    by_slot[slot_str] = summary

  target_slots = [
      "Tuesday 10:00-10:30",
      "Wednesday 14:00-14:30",
      "Thursday 11:00-11:30",
      "Thursday 15:30-16:00",
      "Friday 09:30-10:00",
      "Friday 11:00-11:30",
  ]
  next_mon = current_week_monday()
  print(f"=== My Calendar Availability Next Week (Week of {next_mon.isoformat()} — Live Google Calendar) ===")
  for s in target_slots:
    if s in by_slot:
      summary = by_slot[s]
      if "1:1 with" in summary or "CONFIRMED" in summary or "CAL-INV" in summary or "CAL-EA" in summary:
        print(f"- {s}:  📅 BOOKED: {summary}")
      else:
        print(f"- {s}:  ❌ BUSY ({summary})")
    else:
      print(f"- {s}:  ✅ FREE (Only open 30-min slot on Google Calendar)")


def move_alex_and_vp_sync(to_day_offset: int = 4, to_start: str = "11:00", to_end: str = "11:30"):
  state = load_state()
  cals = state.get("calendars", {})
  body = {
      "start": {"dateTime": slot_iso(to_day_offset, to_start)},
      "end": {"dateTime": slot_iso(to_day_offset, to_end)},
      "summary": "Weekly Sync: Yaroslav (VP) & Alex [Rescheduled: CAL-RESCHED-409]",
  }
  if cals.get("alex") and state.get("alex_sync_event_id"):
    gcal_request(
        "PATCH",
        f"/calendars/{urllib.parse.quote(cals['alex'], safe='')}/events/{urllib.parse.quote(state['alex_sync_event_id'], safe='')}",
        body=body,
    )
  if cals.get("vp") and state.get("vp_sync_event_id"):
    gcal_request(
        "PATCH",
        f"/calendars/{urllib.parse.quote(cals['vp'], safe='')}/events/{urllib.parse.quote(state['vp_sync_event_id'], safe='')}",
        body=body,
    )


def parse_slot_arg(slot_text: str) -> tuple[int, str, str]:
  lower = (slot_text or "").lower()
  day_map = {"monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4}
  day_offset = 3
  for dname, idx in day_map.items():
    if dname in lower:
      day_offset = idx
      break
  import re
  m = re.search(r"(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})", slot_text or "")
  if m:
    s_hm = m.group(1).zfill(5)
    e_hm = m.group(2).zfill(5)
    return day_offset, s_hm, e_hm
  return day_offset, "15:30", "16:00"


def book_1on1_on_gcal(summary: str, invite_id: str, day_offset: int = 3, start_hm: str = "15:30", end_hm: str = "16:00", include_vp: bool = True):
  state = load_state()
  cals = state.get("calendars", {})
  full_summary = f"{summary} [Invite: {invite_id}]"
  if cals.get("my"):
    create_event(cals["my"], full_summary, day_offset, start_hm, end_hm, description=f"Invite ID: {invite_id}")
  if include_vp and cals.get("vp"):
    create_event(cals["vp"], full_summary, day_offset, start_hm, end_hm, description=f"Invite ID: {invite_id}")


def get_vp_slots_live(round_number: int) -> dict:
  state = load_state()
  cal_id = state.get("calendars", {}).get("vp")
  if not cal_id:
    raise RuntimeError("No VP calendar in state")
  events = list_week_events(cal_id)
  busy = {format_slot_label(ev)[0]: ev for ev in events}
  candidates = ["Tuesday 10:00-10:30", "Wednesday 14:00-14:30", "Thursday 11:00-11:30"]
  open_slots = [s for s in candidates if s not in busy]
  if round_number == 1:
    return {"source": "Google Calendar API v3 (Demo: VP Yaroslav)", "open_slots": open_slots}
  thu_ev = busy.get("Thursday 15:30-16:00", {})
  return {
      "source": "Google Calendar API v3 (Demo: VP Yaroslav)",
      "open_slots": [],
      "movable_internal_conflicts": [
          {
              "slot": "Thursday 15:30-16:00",
              "google_calendar_event_id": thu_ev.get("id", state.get("vp_sync_event_id", "")),
              "current_meeting": thu_ev.get("summary", "Weekly Sync: Yaroslav (VP) & Alex (Director of Platform)"),
              "attendee_a2a_agent": os.environ.get("ALEX_AGENT_URL", "https://alex-schedule-bot.booth-demos.workers.dev"),
              "suggested_reschedule_slot": "Friday 11:00-11:30",
              "instruction": (
                  "Call `reschedule_conflict_via_a2a` to ask Alex's A2A agent to move this sync"
                  " from Thursday 15:30-16:00 to Friday 11:00-11:30, then call"
                  " `confirm_and_book_slot` for Thursday 15:30-16:00."
              ),
          }
      ],
  }


def get_alex_slots_live() -> dict:
  state = load_state()
  cal_id = state.get("calendars", {}).get("alex")
  if not cal_id:
    raise RuntimeError("No Alex calendar in state")
  events = list_week_events(cal_id)
  busy = {format_slot_label(ev)[0]: ev for ev in events}
  thu_ev = busy.get("Thursday 15:30-16:00", {})
  fri_free = "Friday 11:00-11:30" not in busy
  return {
      "source": "Google Calendar API v3 (Demo: Director Alex)",
      "current_movable_meetings": [
          {
              "google_calendar_event_id": thu_ev.get("id", state.get("alex_sync_event_id", "")),
              "title": thu_ev.get("summary", "Weekly Sync: Yaroslav (VP) & Alex"),
              "slot": "Thursday 15:30-16:00",
              "movable": True,
          }
      ],
      "open_slots_for_reschedule": ["Friday 11:00-11:30"] if fri_free else [],
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
  elif cmd == "vp-slots":
    rnd = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    print(json.dumps(get_vp_slots_live(rnd), indent=2))
  elif cmd == "alex-slots":
    print(json.dumps(get_alex_slots_live(), indent=2))
  elif cmd == "move-sync":
    move_alex_and_vp_sync()
  elif cmd == "book-vp":
    book_1on1_on_gcal("1:1 with Yaroslav, VP of Engineering", "CAL-INV-8842", include_vp=True)
  elif cmd == "book-ea":
    book_1on1_on_gcal("1:1 with VP Sarah Chen (Confirmed via EA email)", "CAL-EA-104", include_vp=False)
