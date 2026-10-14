#!/usr/bin/env python3
"""Real Google Calendar API v3 integration for Demo 2 (My Calendar, VP Yaroslav, Director Alex)."""
import datetime
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

DEMO_DIR = pathlib.Path(__file__).resolve().parent.parent
STATE_FILE = DEMO_DIR / ".gcal-state.json"
TOKEN_CACHE = pathlib.Path("/tmp/a2a-gcal-token.json")
ADC_FILE = pathlib.Path.home() / ".config" / "gcloud" / "application_default_credentials.json"

CALENDARS = {
    "my": {"summary": "Demo: My Calendar", "colorId": "14"},
    "vp": {"summary": "Demo: VP Yaroslav", "colorId": "3"},
    "alex": {"summary": "Demo: Director Alex", "colorId": "6"},
}


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

  quota_project = ""
  if STATE_FILE.exists():
    try:
      quota_project = json.loads(STATE_FILE.read_text()).get("quota_project", "")
    except Exception:
      pass

  if ADC_FILE.exists():
    try:
      adc = json.loads(ADC_FILE.read_text())
      if not quota_project:
        quota_project = adc.get("quota_project_id", "")
      if adc.get("type") == "authorized_user" and adc.get("refresh_token"):
        data = urllib.parse.urlencode({
            "client_id": adc["client_id"],
            "client_secret": adc["client_secret"],
            "refresh_token": adc["refresh_token"],
            "grant_type": "refresh_token",
        }).encode()
        req = urllib.request.Request("https://oauth2.googleapis.com/token", data=data, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
          tok = json.loads(resp.read().decode())
          access_token = tok["access_token"]
          TOKEN_CACHE.write_text(json.dumps({
              "access_token": access_token,
              "expires_at": time.time() + int(tok.get("expires_in", 3600)),
              "quota_project": quota_project,
          }))
          return access_token, quota_project
    except Exception:
      pass

  proc = subprocess.run(
      ["gcloud", "auth", "application-default", "print-access-token"],
      capture_output=True,
      text=True,
      check=False,
  )
  if proc.returncode == 0 and proc.stdout.strip():
    return proc.stdout.strip(), quota_project
  raise RuntimeError(
      "No Google Calendar credentials found. Run ./examples/06-booth-demos/bin/reset-calendars first."
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
    return _do(True)
  except urllib.error.HTTPError as e:
    err_body = e.read().decode(errors="ignore")
    if quota_project and ("USER_PROJECT_DENIED" in err_body or "SERVICE_DISABLED" in err_body or e.code == 403):
      return _do(False)
    raise RuntimeError(f"Google Calendar API {method} {path} failed ({e.code}): {err_body}") from e


def current_week_monday() -> datetime.date:
  today = datetime.date.today()
  return today - datetime.timedelta(days=today.weekday())


def local_tz_offset() -> str:
  now = datetime.datetime.now().astimezone()
  offset = now.utcoffset() or datetime.timedelta(0)
  total_minutes = int(offset.total_seconds() // 60)
  sign = "+" if total_minutes >= 0 else "-"
  total_minutes = abs(total_minutes)
  return f"{sign}{total_minutes // 60:02d}:{total_minutes % 60:02d}"


def slot_iso(day_offset: int, hh_mm: str) -> tuple[str, str]:
  """day_offset: 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday."""
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


def list_week_events(cal_id: str) -> list[dict]:
  monday = current_week_monday()
  saturday = monday + datetime.timedelta(days=5)
  tz = local_tz_offset()
  res = gcal_request(
      "GET",
      f"/calendars/{urllib.parse.quote(cal_id, safe='')}/events",
      query={
          "timeMin": f"{monday.isoformat()}T00:00:00{tz}",
          "timeMax": f"{saturday.isoformat()}T23:59:59{tz}",
          "singleEvents": "true",
          "orderBy": "startTime",
      },
  )
  return res.get("items", [])


def clear_week_events(cal_id: str):
  for ev in list_week_events(cal_id):
    ev_id = ev.get("id")
    if ev_id:
      try:
        gcal_request(
            "DELETE",
            f"/calendars/{urllib.parse.quote(cal_id, safe='')}/events/{urllib.parse.quote(ev_id, safe='')}",
        )
      except Exception:
        pass


def load_state() -> dict:
  if not STATE_FILE.exists():
    return {}
  try:
    return json.loads(STATE_FILE.read_text())
  except Exception:
    return {}


def reset_and_seed(quota_project: str = ""):
  if quota_project:
    STATE_FILE.write_text(json.dumps({"quota_project": quota_project}, indent=2))
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
    try:
      gcal_request(
          "PATCH",
          f"/users/me/calendarList/{urllib.parse.quote(cal_id, safe='')}",
          body={"colorId": meta["colorId"], "selected": True},
      )
    except Exception:
      pass
    cal_ids[key] = cal_id

  print("🧹 Clearing existing current-week demo events...")
  for key, cid in cal_ids.items():
    clear_week_events(cid)

  print("🌱 Seeding 'Demo: My Calendar'...")
  create_event(cal_ids["my"], "Architecture Offsite", 1, "10:00", "10:30")
  create_event(cal_ids["my"], "Customer Escalation Sync", 2, "14:00", "14:30")
  create_event(cal_ids["my"], "Sprint Planning", 3, "11:00", "11:30")
  create_event(cal_ids["my"], "Dentist", 4, "09:30", "10:00")
  create_event(cal_ids["my"], "Release Readiness Review", 4, "11:00", "11:30")

  print("🌱 Seeding 'Demo: VP Yaroslav'...")
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

  print("🌱 Seeding 'Demo: Director Alex'...")
  alex_sync = create_event(
      cal_ids["alex"],
      "Weekly Sync: Yaroslav (VP) & Alex (Director of Platform)",
      3,
      "15:30",
      "16:00",
      description="[MOVABLE_INTERNAL_1ON1]",
  )

  state = {
      "quota_project": quota_project,
      "calendars": cal_ids,
      "vp_sync_event_id": vp_sync["id"],
      "alex_sync_event_id": alex_sync["id"],
      "week_monday": current_week_monday().isoformat(),
  }
  STATE_FILE.write_text(json.dumps(state, indent=2))
  print("✅ All 3 Google Calendars seeded for this week!")


def format_slot_label(ev: dict) -> tuple[str, str]:
  start_raw = ev.get("start", {}).get("dateTime", "")
  end_raw = ev.get("end", {}).get("dateTime", "")
  if not start_raw or not end_raw:
    return ("Unknown", ev.get("summary", "Busy"))
  dt_start = datetime.datetime.fromisoformat(start_raw)
  dt_end = datetime.datetime.fromisoformat(end_raw)
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
  print("=== My Calendar Availability This Week (Live Google Calendar) ===")
  for s in target_slots:
    if s in by_slot:
      summary = by_slot[s]
      if "1:1 with" in summary or "CONFIRMED" in summary or "CAL-INV" in summary or "CAL-EA" in summary:
        print(f"- {s}:  📅 BOOKED: {summary}")
      else:
        print(f"- {s}:  ❌ BUSY ({summary})")
    else:
      print(f"- {s}:  ✅ FREE (Open 30-min slot on Google Calendar)")


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
    reset_and_seed(proj)
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
