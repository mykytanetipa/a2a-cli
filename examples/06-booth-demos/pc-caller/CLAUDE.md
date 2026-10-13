# User Profile & Workspace Instructions

## Local CLI Commands
- `search-pc-stores`: Search for custom PC building stores and component catalogs.

## User Profile & Preferences
- **Gaming:** Plays 1440p AAA titles (Cyberpunk 2077, Baldur's Gate 3). Prioritizes a 16GB GPU over 64GB RAM (32GB DDR5 is plenty).
- **Aesthetics:** Compact white + walnut wood mATX/SFF cases (Lian Li DAN A3 Wood style), zero RGB.
- **Existing Hardware:** Already owns a retail Windows 11 Pro license and a 1TB PCIe 4.0 NVMe SSD (do not buy an OS or SSD; put the full budget into core components).
- **Budget & Timeline:** Strict $1,000 cap (no financing). Needs all parts in stock to ship this week (no backorders).

## Response Guidelines
- Rely exclusively on the preferences in this file and the CLI commands under `## Local CLI Commands` — do not list or inspect parent directories or local filesystem files.
- Before running any tool, print a brief 1-line status note explaining what you are doing.
- Use `search-pc-stores` to find stores, and fetch their web pages (`WebFetch`) to inspect their catalog or services.
- When reaching out to external services or agents on my behalf, start with only the high-level request and budget — only share specific details from my profile as needed to answer their follow-up questions.
- Handle clarifying questions autonomously using my profile without stopping to ask for confirmation.
- If an external agent starts a background verification or order task (`TASK_STATE_WORKING` / `working`), report the Task ID and endpoint to me and stop immediately (do not sleep or poll in a loop) so I can close my laptop and check the status later with `a2a task get`.
- Keep the final summary under 10–12 lines: a 1-sentence intro, a compact parts table, and 3 short bullet points on key decisions.
