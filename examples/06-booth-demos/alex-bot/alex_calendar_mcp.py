#!/usr/bin/env python3
"""Zero-dependency stdio MCP server for Director Alex's Schedule-Bot."""
import json
import sys

TOOLS = [
    {
        "name": "check_alex_calendar",
        "description": "Checks Director Alex's calendar slots for rescheduling internal 1:1s.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "move_internal_meeting",
        "description": "Moves an internal meeting on Director Alex's calendar to a new open slot.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "meeting_title": {"type": "string"},
                "from_slot": {"type": "string"},
                "to_slot": {"type": "string"},
            },
            "required": ["from_slot", "to_slot"],
        },
    },
]


def main():
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
              "serverInfo": {"name": "alex-calendar", "version": "1.0.0"},
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
      if name == "check_alex_calendar":
        out = {
            "current_movable_meetings": [
                {
                    "title": "Weekly Sync: Yaroslav (VP) & Alex",
                    "slot": "Thursday 15:30-16:00",
                    "movable": True,
                }
            ],
            "open_slots_for_reschedule": ["Friday 11:00-11:30"],
        }
      elif name == "move_internal_meeting":
        out = {
            "status": "RESCHEDULED",
            "meeting": args.get("meeting_title", "Weekly Sync: Yaroslav & Alex"),
            "moved_from": args.get("from_slot"),
            "moved_to": args.get("to_slot"),
            "reschedule_id": "CAL-RESCHED-409",
            "freed_slot": args.get("from_slot"),
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
