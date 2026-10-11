#!/usr/bin/env python3
"""Zero-dependency stdio MCP server for VP Schedule-Bot."""
import json
import sys

TOOLS = [
    {
        "name": "get_vp_candidate_slots",
        "description": "Returns 3 candidate 30-minute free slots from the VP's calendar without exposing meeting titles.",
        "inputSchema": {
            "type": "object",
            "properties": {"round_number": {"type": "integer"}},
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
          out = [
              "Tuesday 10:00-10:30",
              "Wednesday 14:00-14:30",
              "Thursday 11:00-11:30",
          ]
        else:
          out = [
              "Thursday 15:30-16:00",
              "Friday 09:30-10:00",
              "Friday 11:00-11:30",
          ]
      elif name == "confirm_and_book_slot":
        out = {
            "status": "CONFIRMED",
            "slot": args.get("slot"),
            "attendee": args.get("attendee", "User"),
            "calendar_invite_id": "CAL-INV-8842",
            "note": "Approved by VP via Telegram (--human agent); calendar invite sent.",
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
