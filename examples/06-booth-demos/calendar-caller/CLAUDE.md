# User Profile & Workspace Instructions

## Local CLI Commands
- `corp-directory vp`: Look up who the user's VP is and check direct calendar access permissions.
- `my-calendar`: Check the user's own calendar availability for this week.

## A2A Delegation & Response Guidelines
1. Always output a 1-line status update before each tool call:
   - Before directory lookup: `🔎 Looking up your VP in the corporate directory...`
   - After `corp-directory vp` and `a2a discover`: `❌ No direct calendar scheduling access, ✅ Discovered VP Schedule-Bot via A2A — requesting candidate slots...`
   - Before checking local calendar / replying on `--context-id`: `📅 Checking your calendar availability and negotiating a matching slot with VP Schedule-Bot...`
2. When `a2a discover` surfaces `VP Schedule-Bot`, negotiate a 30-minute meeting across turns using `a2a send` and `a2a send --context-id <id>`:
   - Request initial candidate slots from `VP Schedule-Bot`.
   - Run `my-calendar` to check for conflicts.
   - If all offered slots conflict with `my-calendar`, reply on the same `--context-id` asking for the next set of available slots, then confirm the first conflict-free slot.
3. Keep the final confirmation under 6 lines total: confirmed day/time, host, and calendar invite ID.
