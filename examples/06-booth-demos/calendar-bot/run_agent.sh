#!/usr/bin/env bash
set -euo pipefail
BOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEMO_DIR="$(cd "$BOT_DIR/.." && pwd)"
PLUGIN_DIR="$(cd "$DEMO_DIR/../../agent-plugin" && pwd)"
export PATH="$DEMO_DIR/bin:$PATH"
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

log_live "\n\033[1;35m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
log_live "\033[1;35m📥 [VP Schedule-Bot] INBOUND A2A MESSAGE (Context: ${SESSION_ID})\033[0m"
log_live "\033[0;37m${msg}\033[0m"
log_live "\033[1;33m⚙️  Running Claude Code (VP Schedule-Bot + Calendar MCP + A2A Plugin)...\033[0m"

cd "$BOT_DIR"
if resp="$(claude -p --dangerously-skip-permissions --strict-mcp-config \
  --disallowedTools "AskUserQuestion" \
  --settings '{"enabledPlugins":{"a2a-cli@a2a":false}}' \
  --plugin-dir "$PLUGIN_DIR" \
  --mcp-config "$BOT_DIR/mcp.json" \
  --append-system-prompt-file "$BOT_DIR/INSTRUCTIONS.md" \
  --resume "$SESSION_ID" "$msg" 2>/dev/null)"; then
  :
else
  resp="$(claude -p --dangerously-skip-permissions --strict-mcp-config \
    --disallowedTools "AskUserQuestion" \
    --settings '{"enabledPlugins":{"a2a-cli@a2a":false}}' \
    --plugin-dir "$PLUGIN_DIR" \
    --mcp-config "$BOT_DIR/mcp.json" \
    --append-system-prompt-file "$BOT_DIR/INSTRUCTIONS.md" \
    --session-id "$SESSION_ID" "$msg")"
fi

log_live "\033[1;32m📤 [VP Schedule-Bot] OUTBOUND A2A RESPONSE:\033[0m"
log_live "\033[0;32m${resp}\033[0m"
log_live "\033[1;35m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"

printf "%s\n" "$resp"
