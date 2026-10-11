#!/usr/bin/env bash
set -euo pipefail
BOT_DIR="$(cd "$(dirname "$0")" && pwd)"
msg="$(cat)"

# Normalize A2A_CONTEXT_ID to a valid UUID (required by `claude -p --session-id`)
SESSION_ID="$(python3 -c '
import os, uuid
c = os.environ.get("A2A_CONTEXT_ID", "").strip() or "default"
try:
    print(str(uuid.UUID(c)))
except ValueError:
    print(str(uuid.uuid5(uuid.NAMESPACE_DNS, c)))
')"

if claude -p --dangerously-skip-permissions \
  --mcp-config "$BOT_DIR/mcp.json" \
  --append-system-prompt-file "$BOT_DIR/INSTRUCTIONS.md" \
  --resume "$SESSION_ID" "$msg" 2>/dev/null; then
  exit 0
fi

exec claude -p --dangerously-skip-permissions \
  --mcp-config "$BOT_DIR/mcp.json" \
  --append-system-prompt-file "$BOT_DIR/INSTRUCTIONS.md" \
  --session-id "$SESSION_ID" "$msg"
