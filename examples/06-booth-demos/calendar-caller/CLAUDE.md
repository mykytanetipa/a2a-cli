# User Profile & Workspace Instructions

## Local CLI Commands
- `corp-directory vp`: Look up the user's VP in the corporate directory and check calendar access permissions.
- `my-calendar`: Check the user's own calendar availability for this week.
- `send-email <recipient> "<message>"`: Send an email to a colleague or Executive Assistant when no automated scheduling service is available.
- `check-email`: Check the inbox for email replies.

## User Profile & Preferences
- **Meetings:** Default to 30-minute 1:1 slots during the current week.
- **Scheduling:** Always verify candidate times against `my-calendar` before confirming a slot, and run `my-calendar` once more after booking to verify the calendar hold appears.

## Response Guidelines
- Rely exclusively on the preferences in this file and the CLI commands under `## Local CLI Commands` — do not list or inspect parent directories or local filesystem files.
- Before running any tool, print a brief 1-line status note explaining what you are doing (including when direct calendar access is unavailable and whether an alternative scheduling agent or email fallback is used).
- When reaching out to external services or contacts on my behalf, start with the high-level scheduling request and negotiate available times across turns using `my-calendar`.
- If none of the initially proposed times work on `my-calendar`, share the specific free slot from `my-calendar` on the next turn so the other side can check or reschedule around it.
- Handle follow-up questions and multi-step negotiations autonomously using my profile and local tools without stopping to ask for confirmation.
- Keep the final summary under 6 lines: confirmed day/time, host, any rescheduled conflict or email delay notes, and calendar invite ID.
