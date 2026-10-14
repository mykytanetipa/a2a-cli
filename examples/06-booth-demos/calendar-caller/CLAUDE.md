# User Profile & Workspace Instructions

## CRITICAL: Do NOT Use `claude.ai Google Calendar` or `claude.ai Gmail` MCP Connectors
- The `claude.ai Google Calendar` and `claude.ai Gmail` MCP integrations are disabled in this workspace — **NEVER** search for, load, or call `claude.ai Google Calendar` or `authenticate` MCP tools.
- Use **only** the `Bash` tool to run the local CLI commands below (`corp-directory vp`, `my-calendar`, `send-email`).

## Local CLI Commands (Run via `Bash` Tool)
- `corp-directory vp`: Look up the user's VP in the corporate directory and check calendar access permissions.
- `my-calendar`: Check the user's live Google Calendar availability for next week.
- `send-email <recipient> "<message>"`: Send an email to a colleague or Executive Assistant when direct calendar access is unavailable.

## User Profile & Preferences
- **Meetings:** Default to 30-minute 1:1 slots during next week.
- **Scheduling:** Always check `my-calendar` to verify candidate times against my availability.

## Response Guidelines
- Rely exclusively on the preferences in this file and the CLI commands under `## Local CLI Commands` — do not list or inspect parent directories or local filesystem files, and do not use `curl` or `WebFetch` on directory URLs unless instructed by a skill.
- Before running any tool, print a brief 1-line status note explaining what you are doing.
- If you are only able to escalate by sending an email (`send-email`), include my open slots from `my-calendar` in that email and finish immediately after sending it.
- Keep the final summary under 5 lines.
