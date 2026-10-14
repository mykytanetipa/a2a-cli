#!/usr/bin/env python3
"""Zero-dependency stdio MCP server for Director Alex's Schedule-Bot backed by live Google Calendar API."""
import json
import pathlib
import subprocess
import sys

TOOLS = [
    {
        "name": "get_alex_calendar_availability",
        "description": (
            "Queries Director Alex's live Google Calendar for next week (09:00-17:00 Mon-Fri) "
            "and returns all open 30-minute slots and movable internal meetings."
        ),
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "move_calendar_meeting",
        "description": "Moves an internal meeting on Google Calendar from `from_slot` to `to_slot`.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "from_slot": {"type": "string", "description": "e.g. 'Thursday 15:30-16:00'"},
                "to_slot": {"type": "string", "description": "e.g. 'Friday 11:00-11:30'"},
            },
            "required": ["from_slot", "to_slot"],
        },
    },
]


def main():
  demo_dir = pathlib.Path(__file__).resolve().parent.parent
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
      if name == "get_alex_calendar_availability":
        proc = subprocess.run(
            ["python3", str(gcal_helper), "alex-availability"],
            capture_output=True,
            text=True,
            check=False,
        )
        out = json.loads(proc.stdout) if proc.returncode == 0 and proc.stdout.strip() else {"error": proc.stderr}
      elif name == "move_calendar_meeting":
        from_slot = args.get("from_slot", "")
        to_slot = args.get("to_slot", "")
        proc = subprocess.run(
            ["python3", str(gcal_helper), "move-sync", from_slot, to_slot],
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
