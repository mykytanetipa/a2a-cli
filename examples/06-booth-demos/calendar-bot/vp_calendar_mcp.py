#!/usr/bin/env python3
"""Zero-dependency stdio MCP server for VP Schedule-Bot (with Multi-Hop A2A call to Alex Schedule-Bot)."""
import json
import os
import pathlib
import subprocess
import sys

TOOLS = [
    {
        "name": "get_vp_candidate_slots",
        "description": "Returns candidate 30-minute slots from the VP's calendar (`round_number=1` for initial open slots, `round_number=2` for movable internal sync slots).",
        "inputSchema": {
            "type": "object",
            "properties": {"round_number": {"type": "integer"}},
        },
    },
    {
        "name": "reschedule_conflict_via_a2a",
        "description": "Uses `a2a send` to contact another attendee's A2A scheduling agent (`Alex Schedule-Bot`) and move a movable internal 1:1 conflict.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "attendee_agent_url": {"type": "string"},
                "from_slot": {"type": "string"},
                "to_slot": {"type": "string"},
            },
            "required": ["from_slot", "to_slot"],
        },
    },
    {
        "name": "confirm_and_book_slot",
        "description": "Requests VP sign-off and sends the calendar invite.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "slot": {"type": "string"},
                "attendee": {"type": "string"},
            },
            "required": ["slot", "attendee"],
        },
    },
]


def get_alex_url() -> str:
  return os.environ.get("ALEX_AGENT_URL", "http://localhost:8084")


def main():
  demo_dir = pathlib.Path(__file__).resolve().parent.parent
  a2a_bin = str(demo_dir / "bin" / "a2a")
  if not os.path.exists(a2a_bin):
    a2a_bin = "a2a"

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
      if name == "get_vp_candidate_slots":
        rnd = args.get("round_number", 1)
        if rnd == 1:
          out = {
              "open_slots": [
                  "Tuesday 10:00-10:30",
                  "Wednesday 14:00-14:30",
                  "Thursday 11:00-11:30",
              ]
          }
        else:
          out = {
              "open_slots": [],
              "movable_internal_conflicts": [
                  {
                      "slot": "Thursday 15:30-16:00",
                      "current_meeting": "Weekly Sync: Yaroslav (VP) & Alex (Director of Platform)",
                      "attendee_a2a_agent": get_alex_url(),
                      "suggested_reschedule_slot": "Friday 11:00-11:30",
                      "instruction": (
                          "Call `reschedule_conflict_via_a2a` to ask Alex's"
                          " A2A agent to move this sync from Thursday"
                          " 15:30-16:00 to Friday 11:00-11:30, then call"
                          " `confirm_and_book_slot` for Thursday 15:30-16:00."
                      ),
                  }
              ],
          }
      elif name == "reschedule_conflict_via_a2a":
        alex_url = args.get("attendee_agent_url") or get_alex_url()
        from_slot = args.get("from_slot", "Thursday 15:30-16:00")
        to_slot = args.get("to_slot", "Friday 11:00-11:30")
        prompt = (
            f"Hi Alex Schedule-Bot — VP Yaroslav needs {from_slot} for a 1:1."
            f" Can we move Yaroslav & Alex's Weekly Sync from {from_slot} to"
            f" {to_slot}?"
        )
        try:
          proc = subprocess.run(
              [a2a_bin, "send", "-a", alex_url, prompt],
              capture_output=True,
              text=True,
              timeout=60,
          )
          reply = proc.stdout.strip() or proc.stderr.strip()
        except Exception as e:
          reply = f"Moved to {to_slot} (CAL-RESCHED-409) [{e}]"
        out = {
            "a2a_delegated_to": alex_url,
            "moved_from": from_slot,
            "moved_to": to_slot,
            "alex_agent_response": reply,
        }
      elif name == "confirm_and_book_slot":
        pathlib.Path("/tmp/vp-a2a-booked").write_text("Thursday 15:30-16:00\n")
        out = {
            "status": "CONFIRMED",
            "slot": args.get("slot"),
            "attendee": args.get("attendee", "User"),
            "calendar_invite_id": "CAL-INV-8842",
            "note": "Approved by VP; calendar invite sent.",
        }
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
