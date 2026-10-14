#!/usr/bin/env python3
"""Zero-dependency stdio MCP server for VP Schedule-Bot backed by live Google Calendar API."""
import json
import os
import pathlib
import subprocess
import sys

TOOLS = [
    {
        "name": "get_vp_calendar_availability",
        "description": (
            "Queries VP Yaroslav's live Google Calendar for next week (09:00-17:00 Mon-Fri) "
            "and returns all open 30-minute slots as well as any movable internal 1:1 meetings."
        ),
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "reschedule_conflict_via_a2a",
        "description": (
            "Uses `a2a send` to contact another attendee's A2A scheduling agent and ask to move "
            "a movable internal 1:1 from `from_slot` to one of the VP's `candidate_new_slots`."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "attendee_agent_url": {"type": "string"},
                "meeting_title": {"type": "string"},
                "from_slot": {"type": "string"},
                "candidate_new_slots": {
                    "type": "array",
                    "items": {"type": "string"},
                },
            },
            "required": ["from_slot", "candidate_new_slots"],
        },
    },
    {
        "name": "book_calendar_slot",
        "description": "Books the confirmed 30-minute 1:1 slot on Google Calendar and returns the invite ID.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "slot": {"type": "string", "description": "e.g. 'Thursday 15:30-16:00'"},
                "attendee": {"type": "string"},
            },
            "required": ["slot"],
        },
    },
]


def get_alex_url() -> str:
  return os.environ.get("ALEX_AGENT_URL", "https://alex-schedule-bot.booth-demos.workers.dev")


def main():
  demo_dir = pathlib.Path(__file__).resolve().parent.parent
  a2a_bin = str(demo_dir / "bin" / "a2a")
  if not os.path.exists(a2a_bin):
    a2a_bin = "a2a"
  gcal_helper = demo_dir / "bin" / "gcal_helper.py"

  for line in sys.stdin:
    line = line.strip()
    if not line:
      continue
    req = json.loads(line)
    method = req.get("method")
    msg_id = req.get("id")
    if method == "initialize":
      resp = {
          "jsonrpc": "2.0",
          "id": msg_id,
          "result": {
              "protocolVersion": "2024-11-05",
              "capabilities": {"tools": {}},
              "serverInfo": {"name": "vp-calendar", "version": "1.0.0"},
          },
      }
      sys.stdout.write(json.dumps(resp) + "\n")
      sys.stdout.flush()
    elif method == "tools/list":
      resp = {"jsonrpc": "2.0", "id": msg_id, "result": {"tools": TOOLS}}
      sys.stdout.write(json.dumps(resp) + "\n")
      sys.stdout.flush()
    elif method == "tools/call":
      params = req.get("params", {})
      name = params.get("name")
      args = params.get("arguments", {})
      if name == "get_vp_calendar_availability":
        proc = subprocess.run(
            ["python3", str(gcal_helper), "vp-availability"],
            capture_output=True,
            text=True,
            check=False,
        )
        out = json.loads(proc.stdout) if proc.returncode == 0 and proc.stdout.strip() else {"error": proc.stderr}
      elif name == "reschedule_conflict_via_a2a":
        alex_url = args.get("attendee_agent_url") or get_alex_url()
        from_slot = args.get("from_slot", "")
        candidates = args.get("candidate_new_slots", [])
        title = args.get("meeting_title", "Weekly Sync")
        cand_str = ", ".join(candidates) if isinstance(candidates, list) else str(candidates)
        prompt = (
            f"Hi — VP Yaroslav needs {from_slot} next week for a 1:1. "
            f"Can we move '{title}' from {from_slot} to one of VP Yaroslav's open slots ({cand_str})?"
        )
        proc = subprocess.run(
            [a2a_bin, "send", "-a", alex_url, prompt],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        reply = proc.stdout.strip() or proc.stderr.strip()
        out = {
            "a2a_delegated_to": alex_url,
            "requested_move_from": from_slot,
            "candidate_new_slots_offered": candidates,
            "attendee_agent_response": reply,
        }
      elif name == "book_calendar_slot":
        slot = args.get("slot", "")
        pathlib.Path("/tmp/vp-a2a-booked").write_text(f"{slot}\n")
        proc = subprocess.run(
            ["python3", str(gcal_helper), "book-vp", slot],
            capture_output=True,
            text=True,
            check=False,
        )
        out = json.loads(proc.stdout) if proc.returncode == 0 and proc.stdout.strip() else {"error": proc.stderr}
      else:
        out = {"error": f"unknown tool {name}"}
      resp = {
          "jsonrpc": "2.0",
          "id": msg_id,
          "result": {
              "content": [{"type": "text", "text": json.dumps(out, indent=2)}]
          },
      }
      sys.stdout.write(json.dumps(resp) + "\n")
      sys.stdout.flush()


if __name__ == "__main__":
  main()
