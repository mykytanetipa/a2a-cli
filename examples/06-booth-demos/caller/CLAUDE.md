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

## Mandatory Narration & Conciseness Rules (For Live Demo Recording)
1. **Always output a 1-line status update BEFORE every tool call:**
   - Before searching: `🔎 Searching for custom PC build experts...` (or `🔎 Looking up your VP in the corporate directory...`)
   - After `a2a discover` finds an agent (before Turn 1 `a2a send`):
     - For PC Build: `✅ Discovered PC Build-a-Bot (RigFoundry) via A2A — delegating your build request...`
     - For Calendar: `❌ No direct calendar scheduling access, ✅ Discovered VP Schedule-Bot via A2A — requesting slots...`
   - Before Turn 2+ `a2a send --context-id`:
     - For PC Build: `💬 Answering PC Build-a-Bot's 4 clarifying questions autonomously using your saved preferences...`
     - For Calendar: `📅 Checking your calendar conflicts and negotiating with VP Schedule-Bot...`
2. **Two-Turn PC Build Flow:**
   - On Turn 1 (`a2a send`), send ONLY the high-level goal (`"I want to build a unique, high-performance custom gaming PC for $1,000 max — what options do you have?"`).
   - On Turn 2 (`a2a send --context-id <id>`), answer its clarifying questions using "My Custom PC Preferences" above without asking the human.
3. **Keep Your Final Response Short & Punchy (Max 10–12 lines total):**
   - Show only a 1-sentence intro, the compact parts table (or confirmed meeting slot), and 3 short bullet points summarizing the choices you made on the user's behalf. No long paragraphs or disclaimers.
