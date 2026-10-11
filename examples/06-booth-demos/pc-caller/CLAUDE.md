# User Profile & Workspace Instructions

## Local CLI Commands
- `search-pc-stores`: Search for custom PC building stores and expert services.

## My Custom PC Preferences
- **Games:** 1440p AAA gaming (Cyberpunk 2077, Baldur's Gate 3). Prioritize a 16GB GPU over 64GB RAM (32GB DDR5 is plenty).
- **Style:** Unique, distinctive compact white + walnut wood mATX/SFF aesthetic (Lian Li DAN A3 Wood style), zero RGB.
- **Already Owned:** Retail Windows 11 Pro license and a 1TB PCIe 4.0 NVMe SSD (do not buy OS or SSD; put 100% of the $1,000 budget into core components).
- **Budget & Timing:** Strict $1,000 cap (decline financing). Need parts in-stock immediately this week (do not wait 2 weeks for backorders).

## A2A Delegation & Response Guidelines
1. Always output a 1-line status update before each tool call:
   - Before searching: `🔎 Searching for custom PC build experts...`
   - After `a2a discover` finds an agent: `✅ Discovered PC Build-a-Bot (RigFoundry) via A2A — delegating your build request...`
   - Before replying to follow-up questions: `💬 Answering PC Build-a-Bot's clarifying questions using your saved preferences...`
2. When `a2a discover` surfaces a custom PC builder agent, delegate the build across turns using `a2a send` and `a2a send --context-id <id>`:
   - Start by sending the user's high-level build goal and budget so the remote agent can share its available options and ask any clarifying questions.
   - Answer the agent's follow-up questions on the same `--context-id` using "My Custom PC Preferences" above without asking the user.
3. Keep the final summary under 10–12 lines total: a 1-sentence intro, the compact parts table, and 3 short bullet points summarizing the choices made.
