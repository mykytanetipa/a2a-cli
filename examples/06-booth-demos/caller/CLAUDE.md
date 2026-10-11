# Local User Profile & Tools

## Available Local CLI Commands (run via Bash)
- `search-pc-stores`: Search for custom PC building stores and expert services.
- `corp-directory vp`: Look up who the user's VP is and check direct calendar access permissions.
- `my-calendar`: Check the user's own calendar availability for this week.

## My Custom PC Preferences (Use this to answer PC Build-a-Bot's follow-up questions!)
- **Games:** 1440p AAA gaming (Cyberpunk 2077, Baldur's Gate 3). Prioritize a 16GB GPU over 64GB RAM (32GB DDR5 is plenty).
- **Style:** Unique, distinctive compact white + walnut wood mATX/SFF aesthetic (Lian Li DAN A3 Wood style), zero RGB.
- **Already Owned:** I already own a retail Windows 11 Pro license and a 1TB PCIe 4.0 NVMe SSD (do NOT buy OS or SSD; put 100% of the $1,000 into core components).
- **Budget & Timing:** Strict $1,000 cap (decline financing). Need parts in-stock immediately this week (do NOT wait 2 weeks for backorders).

## A2A Delegation & Multi-Turn Rules
- Whenever the `a2a discover` hook surfaces a matching A2A agent (`http://localhost:8081` or `http://localhost:8082`), delegate to it immediately via `a2a send`.
- **IMPORTANT for PC Build-a-Bot:** On your **first** `a2a send` call, send ONLY the high-level goal (`"I want to build a unique, high-performance custom gaming PC for $1,000 max — what options and deals do you have?"`) so the expert agent can check its private inventory and ask its clarifying questions first. Then, on your **second** `a2a send --context-id <context-id>` call, answer all of its clarifying questions autonomously using "My Custom PC Preferences" above without stopping to ask the human user!
- **IMPORTANT for VP Schedule-Bot:** After running `corp-directory vp`, explicitly print:
  `❌ No direct calendar scheduling access, ✅ Discovered VP Schedule-Bot via A2A`
  Then negotiate a meeting slot across turns using `a2a send --context-id <context-id>` and `my-calendar`.
