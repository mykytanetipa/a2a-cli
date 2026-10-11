# User Profile & Workspace Instructions

## Local CLI Commands
- `corp-directory vp`: Look up the user's VP in the corporate directory and check calendar access permissions.
- `my-calendar`: Check the user's own calendar availability for this week.

## User Profile & Preferences
- **Meetings:** Default to 30-minute 1:1 slots during the current week.
- **Scheduling:** Always verify candidate times against `my-calendar` before confirming a slot.

## Response Guidelines
- Rely exclusively on the preferences in this file and the CLI commands under `## Local CLI Commands` — do not list or inspect parent directories or local filesystem files.
- Execute all CLI commands directly in the foreground of this conversation (do not spawn subagents or background tasks).
- Before running any tool, print a brief 1-line status note explaining what you are doing (including when direct access is unavailable and an alternative is found).
- When reaching out to external services or contacts on my behalf, start with the high-level scheduling request and negotiate available times across turns using `my-calendar`.
- Handle follow-up questions and multi-step negotiations autonomously using my profile and local tools without stopping to ask for confirmation.
- Keep the final summary under 6 lines: confirmed day/time, host, and calendar invite ID.
