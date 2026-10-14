#!/usr/bin/env bash
set -euo pipefail
BOT_DIR="$(cd "$(dirname "$0")" && pwd)"
msg="$(cat)"

SESSION_ID="$(python3 -c '
import os, uuid
c = os.environ.get("A2A_CONTEXT_ID", "").strip() or "default"
try:
    print(str(uuid.UUID(c)))
except ValueError:
    print(str(uuid.uuid5(uuid.NAMESPACE_DNS, c)))
')"

log_live() {
  printf "%b\n" "$1" >> /tmp/a2a-live.log
  if [ -w /dev/tty ]; then
    printf "%b\n" "$1" > /dev/tty
  fi
}

log_live "\n\033[1;36m  ┌──────────────────────────────────────────────────────────────────┐\033[0m"
log_live "\033[1;36m  │ 🔀 [MULTI-HOP A2A -> Alex Schedule-Bot] INBOUND MESSAGE          │\033[0m"
log_live "\033[1;36m  └──────────────────────────────────────────────────────────────────┘\033[0m"
log_live "\033[0;37m  ${msg}\033[0m"
log_live "\033[1;33m  ⚙️  Running Claude Code (Alex Schedule-Bot + Alex Calendar MCP)...\033[0m"

if resp="$(claude -p --dangerously-skip-permissions --strict-mcp-config \
  --mcp-config "$BOT_DIR/mcp.json" \
  --append-system-prompt-file "$BOT_DIR/INSTRUCTIONS.md" \
  --resume "$SESSION_ID" "$msg" 2>/dev/null)"; then
  :
else
  resp="$(claude -p --dangerously-skip-permissions --strict-mcp-config \
    --mcp-config "$BOT_DIR/mcp.json" \
    --append-system-prompt-file "$BOT_DIR/INSTRUCTIONS.md" \
    --session-id "$SESSION_ID" "$msg")"
fi

log_live "\033[1;32m  📤 [Alex Schedule-Bot -> VP Schedule-Bot] OUTBOUND A2A RESPONSE:\033[0m"
log_live "\033[0;32m  ${resp}\033[0m"

printf "%s\n" "$resp"
