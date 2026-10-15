# A2A Booth Demos (`Without A2A` vs. `With A2A`)

Side-by-side live comparisons demonstrating **Claude Code** operating **Without A2A** vs. **With A2A** (`a2a` CLI + `agent-plugin` discovery hook + Cloudflare Workers powered by `@a2a-js/sdk`).

---

## Quick Clone (No SSH Key or Password Required)

```bash
git clone -b feat/booth-demos-cf https://github.com/mykytanetipa/a2a-cli.git
cd a2a-cli
```

---

## Demo 1: Custom Gaming PC Build (`MockEgg` vs. `RigFoundry`)

### 1. One-Command Setup (Demo 1)
Automatically checks/installs missing prerequisites via Homebrew (`go`, `node`, `python3`, `cloudflared`, `claude`), builds the `a2a` binary, and deploys the `mockegg` and `rigfoundry` Cloudflare Workers:

```bash
./examples/06-booth-demos/bin/setup-pc-demo
```
*(If not already logged into Cloudflare, `npx wrangler` will open a browser tab once to authorize.)*

### 2. Terminal Layout (3 Windows)

1. **Window 3 (RigFoundry A2A Server & Cloudflare Tunnel):**
   ```bash
   ./examples/06-booth-demos/bin/start-pc-bot
   ```
2. **Window 1 (Left — Caller WITHOUT A2A):**
   ```bash
   ./examples/06-booth-demos/bin/start-pc-caller-no-a2a
   ```
3. **Window 2 (Right — Caller WITH A2A):**
   ```bash
   ./examples/06-booth-demos/bin/start-pc-caller
   ```

### 3. Live Prompt (Paste into Window 1 & Window 2)
```text
I want to build a new custom PC for video games from https://mockegg.booth-demos.workers.dev, make it unique and distinctive, but perform well. Give the best I can get for $1000. You know me and my preferences.
```

* **Window 1 (`Without A2A`):** Crawls MockEgg's 4-tier catalog (`/` $\rightarrow$ `/departments/*` $\rightarrow$ `/catalog/*` $\rightarrow$ `/product/*` $\rightarrow$ `/inventory/*`) over ~1m 45s, cannot verify 3D GPU+PSU physical clearance, and finishes **$146 over budget ($1,146)**.
* **Window 2 (`With A2A`):**
  1. Fetches `/` $\rightarrow$ `a2a discover` hook detects `PC Build-a-Bot (RigFoundry)` on the partner link and pauses to confirm delegation.
  2. **Turn 1 (`a2a send`):** Sends the high-level goal; RigFoundry asks 4 clarifying questions.
  3. **Turn 2 (`a2a send --async` + `a2a task push-config create`):** Answers from `CLAUDE.md` asynchronously, registers the push notification webhook (`http://127.0.0.1:19081/webhook`), and ends its turn immediately.
  4. **Push Notification Arrival:**
     * **If Window 2 stays open:** The push notification is injected directly into the chat input box, automatically waking Claude to run `a2a task get` and display the **$999** verified White+Walnut build!
     * **If you run `/exit` after Turn 2:** A macOS desktop notification (`🔔 A2A Push Notification`) pops up with a chime when the build completes; run `./examples/06-booth-demos/bin/start-pc-caller -c` to resume and check the build.

---

## Demo 2: 3-Way Executive Calendar Scheduling (`Caller` + `VP Schedule-Bot` + `Alex Schedule-Bot`)

### 1. One-Command Setup (Demo 2)
Automatically checks/installs missing prerequisites (`go`, `node`, `python3`, `openssl`, `cloudflared`, `gcloud`, `claude`), builds `a2a`, deploys the `vp-schedule-bot` and `alex-schedule-bot` Cloudflare Workers, provisions a GCP Service Account key (`~/.config/a2a-cal-sa.json`), creates & shares 3 real Google Calendars (`Demo: My Calendar`, `Demo: VP Yaroslav`, `Demo: Director Alex`), and seeds next week's schedule:

```bash
./examples/06-booth-demos/bin/setup-calendar-demo
```
*(Before subsequent takes, run `./examples/06-booth-demos/bin/reset-calendars` to reset all 3 Google Calendars back to their initial state in ~2.5s.)*

### 2. Terminal Layout (4 Windows + Google Calendar Browser Tab)

1. **Window 3 (`VP Schedule-Bot` Server & Tunnel):**
   ```bash
   ./examples/06-booth-demos/bin/start-calendar-bot
   ```
2. **Window 4 (`Alex Schedule-Bot` Server & Tunnel):**
   ```bash
   ./examples/06-booth-demos/bin/start-alex-bot
   ```
3. **Window 1 (Left — Caller WITHOUT A2A):**
   ```bash
   ./examples/06-booth-demos/bin/start-calendar-caller-no-a2a
   ```
4. **Window 2 (Right — Caller WITH A2A):**
   ```bash
   ./examples/06-booth-demos/bin/start-calendar-caller
   ```

### 3. Live Prompt (Paste into Window 1 & Window 2)
```text
Schedule a 30-minute 1:1 with my VP this week
```

* **Window 1 (`Without A2A`):** Runs `corp-directory vp` (`403 FORBIDDEN`), checks `my-calendar`, and escalates by sending an email (`send-email ea-yaroslav@0-a.org`) with your open slots, waiting on a human reply.
* **Window 2 (`With A2A`):**
  1. Runs `corp-directory vp` $\rightarrow$ `a2a discover` hook detects `VP Schedule-Bot` (`https://vp-schedule-bot.booth-demos.workers.dev`) and asks to confirm delegation.
  2. **Turn 1 (`Caller -> VP Schedule-Bot`):** Dynamically scans `Demo: VP Yaroslav` on Google Calendar (`09:00–17:00` Mon–Fri) and returns Yaroslav's 3 open slots (`Tue 10:00–10:30`, `Wed 14:00–14:30`, `Thu 11:00–11:30`).
  3. **Turn 2 (`Caller -> VP Schedule-Bot -> Alex Schedule-Bot`):** Caller sees all 3 clash with `my-calendar`, sends your open slots (`Mon 16:00`, `Wed 10:30`, `Thu 15:30`), `VP Schedule-Bot` negotiates via A2A with `Alex Schedule-Bot` to move their `Thu 15:30–16:00` sync to `Fri 11:00–11:30`, and books `1:1: Caller & VP Yaroslav` at **Thursday `15:30–16:00`** live on Google Calendar!
