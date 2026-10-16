#!/usr/bin/env python3
"""Zero-dependency stdio MCP server for VP Schedule-Bot backed by live Google Calendar API."""
import json
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
      elif name == "book_calendar_slot":
        slot = args.get("slot", "Thursday 15:30-16:00")
        attendee = args.get("attendee", "Caller")
        proc = subprocess.run(
            ["python3", str(gcal_helper), "vp-book", slot, attendee],
            capture_output=True,
            text=True,
            check=False,
        )
        out = json.loads(proc.stdout) if proc.returncode == 0 and proc.stdout.strip() else {"error": proc.stderr}
      else:
        out = {"error": f"Unknown tool: {name}"}

      resp = {
          "jsonrpc": "2.0",
          "id": msg_id,
          "result": {"content": [{"type": "text", "text": json.dumps(out, indent=2)}]},
      }
      sys.stdout.write(json.dumps(resp) + "\n")
      sys.stdout.flush()


if __name__ == "__main__":
  main()
