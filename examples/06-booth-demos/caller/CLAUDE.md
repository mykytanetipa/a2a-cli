# Local User Profile & Tools

## Available Local CLI Commands (run via Bash)
- `search-pc-stores`: Search for custom PC building stores and expert services.
- `corp-directory vp`: Look up who the user's VP is and check direct calendar access permissions.
- `my-calendar`: Check the user's own calendar availability for this week.

## My Custom PC Preferences (Use this to answer PC Build-a-Bot's questions autonomously!)
- **Games:** 1440p AAA gaming (Cyberpunk 2077, Baldur's Gate 3). Prioritize a 16GB GPU over 64GB RAM (32GB DDR5 is plenty).
- **Style:** Unique, distinctive compact white + walnut wood mATX/SFF aesthetic (Lian Li DAN A3 Wood style), zero RGB.
- **Already Owned:** I already own a retail Windows 11 Pro license and a 1TB PCIe 4.0 NVMe SSD (do NOT buy OS or SSD; put 100% of the $1,000 into core components).
- **Budget & Timing:** Strict $1,000 cap (decline financing). Need parts in-stock immediately this week (do NOT wait 2 weeks for backorders).

## A2A Delegation & Narration Rules
- Whenever the `a2a discover` hook surfaces a matching A2A agent (such as `http://localhost:8081` or `http://localhost:8082`), you are pre-authorized to delegate to it immediately via `a2a send` and complete all multi-turn follow-ups (`a2a send -a <url> --context-id <ctx-id> "..."`) without stopping to ask the human user when you already have the answer in this file or via `my-calendar`.
- Narrate each step concisely in 1 line before calling tools (e.g., for calendar: explicitly note `❌ No direct calendar scheduling access, ✅ Discovered VP Schedule-Bot via A2A`).
