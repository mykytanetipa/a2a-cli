# A2A Booth Demos (`Without A2A` vs. `With A2A`)

## 1. Quick Start & Setup

Clone the repository and run the setup script for the demo you want to run:

```bash
git clone -b feat/booth-demos-cf https://github.com/mykytanetipa/a2a-cli.git
cd a2a-cli

# Setup Demo 1 (Custom PC Build)
./examples/06-booth-demos/bin/setup-pc-demo

# Setup Demo 2 (Executive Calendar Scheduling)
./examples/06-booth-demos/bin/setup-calendar-demo
```

### What the Setup Scripts Do
* **Auto-install missing CLI tools via Homebrew:** `go`, `node`/`npm`, `python3`, `openssl`, `cloudflared`, `gcloud` (Demo 2), and `claude` (`@anthropic-ai/claude-code`), then compile `./examples/06-booth-demos/bin/a2a`.
* **Cloudflare Workers (`@a2a-js/sdk`):** Checks `npx wrangler whoami` (opens a browser tab for `wrangler login` if needed) and deploys the Worker endpoints.
* **Google Cloud & Calendar API (Demo 2):** Checks `gcloud` auth (opens `gcloud auth login` if needed), enables the Google Calendar API on your active GCP project, creates a Service Account key (`~/.config/a2a-cal-sa.json`), creates 3 Google Calendars, and seeds next week's schedule. *(Note: Newly created GCP Service Account credentials can take a few seconds to propagate — if you see `RuntimeError: Could not obtain Google Calendar token. Check gcloud login/project and re-run reset-calendars.`, simply re-run the setup script.)*

---

## 2. Demo 1: Custom Gaming PC Build (`MockEgg` vs. `RigFoundry`)

### Expected Output of `./examples/06-booth-demos/bin/setup-pc-demo`

```text
========================================================================
✅ Demo 1 Cloudflare Workers Deployed (Powered by @a2a-js/sdk)!
   Store URL:      https://mockegg.booth-demos.workers.dev
   A2A Agent URL:  https://rigfoundry.booth-demos.workers.dev
========================================================================

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Demo 1 Setup Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Open 3 terminal windows in the repo root and run:

  Window 3 (RigFoundry A2A Server):  ./examples/06-booth-demos/bin/start-pc-bot
  Window 1 (Caller WITHOUT A2A):     ./examples/06-booth-demos/bin/start-pc-caller-no-a2a
  Window 2 (Caller WITH A2A):        ./examples/06-booth-demos/bin/start-pc-caller

Prompt to paste into Window 1 & Window 2:
  I want to build a new custom PC for video games from https://mockegg.booth-demos.workers.dev, make it unique and distinctive, but perform well. Give the best I can get for $1000. You know me and my preferences.
```

### Push Notifications Setup & 2 Ways to Demonstrate (Window 2)

* **Prerequisite for macOS Desktop Banner:** Open **System Settings → Notifications → Script Editor** and enable **Allow Notifications** (set style to *Banners* or *Alerts*).
* After Turn 2 (`a2a send --async` + `a2a task push-config create`), you can demonstrate the push notification in two ways:
  1. **Stay in the Claude Window (In-Chat Auto-Resume):** Stay inside Window 2 — when the task finishes, the push notification arrives directly in the chat input box and automatically wakes Claude to run `a2a task get`.
  2. **`/exit` + macOS Notification Banner:** Type `/exit` right after Turn 2 — when the task finishes, a macOS notification banner pops up (and prints in the terminal). Reopen the session with `./examples/06-booth-demos/bin/start-pc-caller -c` and type `"what is the setup status?"` — Claude will trigger `a2a task get` and display the completed $999 build.

---

## 3. Demo 2: 3-Way Executive Calendar Scheduling

### Expected Output of `./examples/06-booth-demos/bin/setup-calendar-demo`

```text
========================================================================
✅ Demo 2 Cloudflare Workers Deployed (Powered by @a2a-js/sdk)!
   VP Yaroslav Agent (With A2A):  https://vp-schedule-bot.booth-demos.workers.dev
   Director Alex Agent (A2A Hop): https://alex-schedule-bot.booth-demos.workers.dev
========================================================================

📅 Step 4/4: Provisioning & seeding the 3 Google Calendars...
🧹 Clearing existing demo events (this week & next week)...
🌱 Seeding full 09:00–17:00 Mon–Fri schedules on all 3 Google Calendars...
✅ All 3 Google Calendars seeded for NEXT WEEK (week of 2026-10-19)!
   🔗 Add 'Demo: My Calendar' to your Google Calendar UI: https://calendar.google.com/calendar/u/0/r?cid=ce90b240061350ef3c8138c9b1b914c3f6df25bfee08f6e441c18ba5fc6558cf%40group.calendar.google.com
   🔗 Add 'Demo: VP Yaroslav' to your Google Calendar UI: https://calendar.google.com/calendar/u/0/r?cid=bbf28ca3be40351137eeb5367f87f321dd2c7868e0cc67db79feff6bb1c4368d%40group.calendar.google.com
   🔗 Add 'Demo: Director Alex' to your Google Calendar UI: https://calendar.google.com/calendar/u/0/r?cid=5bbf430863a1199dac96c1c05f5116bfb037ec9aa634e44a636fa7ddb0f4691b%40group.calendar.google.com

📅 View Next Week in Google Calendar: https://calendar.google.com/calendar/u/0/r/week/2026/10/19

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Demo 2 Setup Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Open 4 terminal windows in the repo root (plus https://calendar.google.com in your browser) and run:

  Window 3 (VP Schedule-Bot Server):    ./examples/06-booth-demos/bin/start-calendar-bot
  Window 4 (Alex Schedule-Bot Server):  ./examples/06-booth-demos/bin/start-alex-bot
  Window 1 (Caller WITHOUT A2A):        ./examples/06-booth-demos/bin/start-calendar-caller-no-a2a
  Window 2 (Caller WITH A2A):           ./examples/06-booth-demos/bin/start-calendar-caller

Prompt to paste into Window 1 & Window 2:
  Schedule a 30-minute 1:1 with my VP next week
```

### Google Calendar UI Setup & Resetting Between Runs

* **Add Calendars & Set Colors (One-Time):** Click the 3 `🔗 Add 'Demo: ...' to your Google Calendar UI` URLs printed by the setup script to add them under **"Other calendars"** in Google Calendar, and customize each calendar's color in the sidebar so all 3 schedules are easy to distinguish side-by-side.
* **Reset Between Demo Runs:** Before each new take, reset all 3 calendars back to their initial next-week schedule:
  ```bash
  ./examples/06-booth-demos/bin/reset-calendars
  ```
