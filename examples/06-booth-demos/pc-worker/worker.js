/**
 * Cloudflare Worker for A2A Booth Demo 1 (PC Build Scenario):
 *  - Role 1: rigfoundry (Serves HTML storefront at GET / + PC Build-a-Bot A2A agent)
 *  - Role 2: mockegg    (Serves Newegg-style retail HTML catalog at GET /, returns 404 on /.well-known/agent-card.json)
 *
 * Works out-of-the-box with ZERO API keys needed, AND automatically uses real Claude API
 * (`env.ANTHROPIC_API_KEY`) if configured via `npx wrangler secret put ANTHROPIC_API_KEY --name rigfoundry`.
 */

const PC_STATE = {
  logs: [],
  tasks: new Map(),
  contexts: new Map(),
  historyByContext: new Map(),
};

function pushLog(line) {
  console.log(line);
  PC_STATE.logs.push({
    id: PC_STATE.logs.length,
    ts: new Date().toISOString(),
    text: line,
  });
  if (PC_STATE.logs.length > 500) {
    PC_STATE.logs.shift();
  }
}

function detectStoreRole(url) {
  const host = url.hostname.toLowerCase();
  if (host.includes("mockegg") || url.pathname.startsWith("/mockegg")) {
    return "mockegg";
  }
  return "rigfoundry";
}

const MOCKEGG_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>MockEgg — Custom PC Parts & Component Catalog</title>
</head>
<body>
  <h1>MockEgg PC Component Catalog (Public Retail Pricing)</h1>
  <p>Standard retail component pricing. All orders self-assembled by customer.</p>
  <table border="1" cellpadding="6">
    <tr><th>Category</th><th>Part Name</th><th>Specs</th><th>Availability</th><th>Retail Price</th></tr>
    <tr><td>CPU</td><td>AMD Ryzen 5 7600</td><td>AM5, 6-Core / 12-Thread, Includes Wraith Stealth Cooler</td><td>In Stock</td><td>$185</td></tr>
    <tr><td>Motherboard</td><td>ASRock B650M Pro RS WiFi</td><td>AM5, mATX, White/Silver, WiFi 6E</td><td>In Stock</td><td>$135</td></tr>
    <tr><td>RAM</td><td>TEAMGROUP T-Create Expert 32GB (2x16GB) DDR5-6000 CL30</td><td>White, Zero RGB</td><td>In Stock</td><td>$85</td></tr>
    <tr><td>RAM</td><td>Corsair Vengeance 64GB (2x32GB) DDR5-6000</td><td>Black</td><td>In Stock</td><td>$175</td></tr>
    <tr><td>GPU</td><td>Sapphire PURE Radeon RX 7800 XT 16GB Arctic White</td><td>16GB GDDR6, White</td><td>In Stock</td><td>$519</td></tr>
    <tr><td>GPU</td><td>XFX Radeon RX 7900 GRE 16GB</td><td>16GB GDDR6, Triple-Fan</td><td>Ships from partner warehouse</td><td>$479</td></tr>
    <tr><td>GPU</td><td>PowerColor Fighter Radeon RX 7700 XT 12GB</td><td>12GB GDDR6, Black</td><td>In Stock</td><td>$389</td></tr>
    <tr><td>Case</td><td>Lian Li DAN A3-mATX Wood Edition</td><td>Compact mATX, White + Walnut Wood Front Panel, Zero RGB</td><td>In Stock</td><td>$85</td></tr>
    <tr><td>PSU</td><td>Corsair RM750e 750W ATX 3.0</td><td>80+ Gold Modular, Zero RGB</td><td>In Stock</td><td>$90</td></tr>
    <tr><td>SSD</td><td>WD Black SN770 1TB PCIe 4.0 NVMe</td><td>M.2 2280</td><td>In Stock</td><td>$75</td></tr>
    <tr><td>OS</td><td>Microsoft Windows 11 Home OEM</td><td>64-bit</td><td>In Stock</td><td>$119</td></tr>
  </table>
  <p><em>Note: Standard retail build with Ryzen 5 7600 + B650M + 32GB DDR5 + Sapphire PURE RX 7800 XT White + Lian Li DAN A3 Wood + RM750e totals <strong>$1,099</strong> at public retail prices.</em></p>
</body>
</html>`;

function buildRigFoundryHtml(origin) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>RigFoundry — Boutique Custom SFF & mATX Gaming PCs</title>
</head>
<body>
  <h1>RigFoundry Custom Boutique Builds</h1>
  <p>Specialists in compact mATX &amp; SFF custom gaming rigs (including Lian Li DAN A3 White + Walnut builds).</p>
  <h2>Public Retail Catalog</h2>
  <p>Public individual part prices match MockEgg ($1,099 for Ryzen 5 7600 + Sapphire PURE RX 7800 XT 16GB White + Lian Li DAN A3 Wood + 32GB DDR5 + 750W PSU).</p>
  <h2>Why Use Our Custom Build Specialist Service?</h2>
  <ul>
    <li><strong>Unadvertised Private VIP Bundle Pricing:</strong> Up to $100 off combined CPU/GPU/PSU/Case builds (bringing our White + Walnut RX 7800 XT 16GB rig under $1,000).</li>
    <li><strong>3D CAD Millimeter Clearance Verification:</strong> We verify exact GPU length in mm against SFF/mATX case limits (e.g., warning customers that the 335mm XFX RX 7900 GRE physically collides with the 334mm max GPU limit of the Lian Li DAN A3-mATX and is on a 2-week backorder).</li>
  </ul>
  <p>Automated A2A build specialist available at <a href="${origin}/.well-known/agent-card.json">${origin}/.well-known/agent-card.json</a>.</p>
</body>
</html>`;
}

function buildRigFoundryCard(origin) {
  return {
    name: "PC Build-a-Bot (RigFoundry)",
    description:
      "Expert custom gaming PC builder at RigFoundry with access to private VIP bundle discounts (saving up to $100 vs public retail), live warehouse backorder status, and 3D CAD millimeter GPU-to-case clearance verification.",
    version: "1.0.0",
    capabilities: { streaming: false },
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    supportedInterfaces: [
      {
        url: origin,
        protocolBinding: "HTTP+JSON",
        protocolVersion: "1.0",
      },
    ],
    skills: [
      {
        id: "custom-pc-build",
        name: "Custom PC Configurator & Millimeter Clearance Verifier",
        description:
          "Designs custom gaming PCs under budget using unadvertised RigFoundry VIP bundle pricing, checks real warehouse stock, and verifies millimeter physical clearance.",
        tags: ["pc-build", "gaming", "hardware", "sff"],
        examples: ["Build a unique 1440p gaming PC under $1000"],
      },
    ],
  };
}

const COMPLETED_BUILD_TEXT =
  "✅ **3D CAD Clearance & Warehouse Lock Complete — Reserve Code: `RF-VIP-999`**\n\n" +
  "| Part | Model | Stock | Price |\n" +
  "|---|---|---|---|\n" +
  "| CPU | AMD Ryzen 5 7600 (AM5, includes 54mm Wraith Stealth non-RGB cooler) | In Stock | $185 |\n" +
  "| Motherboard | ASRock B650M Pro RS WiFi (White/Silver, mATX, Zero RGB) | In Stock | $135 |\n" +
  "| RAM | TEAMGROUP T-Create Expert 32GB DDR5-6000 CL30 White (Zero RGB, QVL Verified) | In Stock | $85 |\n" +
  "| GPU | Sapphire PURE Radeon RX 7800 XT 16GB Arctic White (Stealth Zero-RGB VIP Deal) | In Stock | $449 |\n" +
  "| Case | Lian Li DAN A3-mATX White + Walnut Wood Front Panel (Zero RGB) | In Stock | $85 |\n" +
  "| PSU | Corsair RM750e 750W ATX 3.0 (140mm Compact ATX, VIP Bundle Discount) | In Stock | $60 |\n" +
  "| OS / SSD | Reusing customer's owned Windows 11 Pro & 1TB PCIe 4.0 NVMe SSD | Owned | $0 |\n" +
  "| **Total** | **VIP White + Walnut Bundle (Saved $100 vs $1,099 public retail)** | **Ships Today** | **$999** |\n\n" +
  "- **Millimeter Clearance Verified:** 320mm Sapphire PURE RX 7800 XT fits inside the 334mm Lian Li DAN A3-mATX with 14mm spare (335mm XFX RX 7900 GRE rejected: 1mm collision + 2-week backorder).\n" +
  "- **Full Hardware Compatibility:** Socket AM5, DDR5-6000 QVL, 54mm cooler height (<=165mm max), 140mm ATX PSU bay clearance, and 100% Zero-RGB compliance verified.";

async function maybeCallClaudeTurn1(env, userMsg) {
  if (!env || !env.ANTHROPIC_API_KEY) return null;
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 350,
        system:
          "You are PC Build-a-Bot at RigFoundry. Ask 4 short numbered clarifying questions (under 6 lines total, no parts table yet): 1. Reuse existing OS & SSD or include them? 2. Prioritize 64GB RAM or 32GB DDR5 + 16GB GPU? 3. Use 12-month 0% APR financing (up to $1,250) or keep a strict $1,000 cap? 4. Preferred case style/RGB aesthetic and immediate in-stock shipping this week vs waiting 2 weeks for backordered GPU upgrades?",
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.content?.[0]?.text || null;
  } catch (_) {
    return null;
  }
}

function materializeTask(task) {
  if (
    task.status.state === "TASK_STATE_WORKING" &&
    Date.now() - task.createdAtMs >= 10000
  ) {
    task.status = {
      state: "TASK_STATE_COMPLETED",
      timestamp: new Date().toISOString(),
    };
    task.artifacts = [
      {
        artifactId: crypto.randomUUID(),
        parts: [{ text: COMPLETED_BUILD_TEXT }],
      },
    ];
    if (!task.loggedCompletion) {
      task.loggedCompletion = true;
      pushLog(
        `\n\x1b[1;32m🔔 [PC Build-a-Bot] ASYNC BACKGROUND JOB COMPLETED (Task: ${task.id})\x1b[0m`
      );
      pushLog(
        `\x1b[0;32m   3D CAD Clearance PASS (320mm <= 334mm) & Warehouse Bin Locked -> Reserve Code: RF-VIP-999 ($999)\x1b[0m`
      );
      pushLog(
        `\x1b[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`
      );
    }
  }
  const { createdAtMs, loggedCompletion, ...cleanTask } = task;
  return cleanTask;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const role = detectStoreRole(url);

    for (const t of PC_STATE.tasks.values()) {
      materializeTask(t);
    }

    if (url.pathname === "/logs") {
      const since = parseInt(url.searchParams.get("since") || "0", 10);
      const entries = PC_STATE.logs.filter((e) => e.id >= since);
      const nextCursor =
        PC_STATE.logs.length > 0
          ? PC_STATE.logs[PC_STATE.logs.length - 1].id + 1
          : since;
      return Response.json({ entries, nextCursor });
    }

    if (url.pathname === "/reset" && request.method === "POST") {
      PC_STATE.logs = [];
      PC_STATE.tasks.clear();
      PC_STATE.contexts.clear();
      pushLog(
        `\x1b[1;34m🔄 [PC Build-a-Bot] Demo state reset — ready for recording.\x1b[0m`
      );
      return Response.json({ ok: true });
    }

    if (url.pathname.endsWith("/.well-known/agent-card.json")) {
      if (role === "mockegg") {
        return new Response(
          "Not Found (MockEgg is a static retail catalog with no A2A agent)",
          { status: 404 }
        );
      }
      return Response.json(buildRigFoundryCard(url.origin));
    }

    if (request.method === "GET" && url.pathname.includes("/tasks/")) {
      const taskId = url.pathname.split("/tasks/")[1];
      const task = PC_STATE.tasks.get(taskId);
      if (!task) {
        return new Response("Task not found", { status: 404 });
      }
      const clean = materializeTask(task);
      pushLog(
        `\x1b[1;36m🔎 [PC Build-a-Bot] Status Check (a2a task get ${taskId}) -> ${clean.status.state}\x1b[0m`
      );
      return Response.json(clean);
    }

    if (
      request.method === "POST" &&
      (url.pathname.endsWith("/message:send") || url.pathname === "/")
    ) {
      const body = await request.json();
      const parts = body?.message?.parts || [];
      const msgText = parts.map((p) => p.text || "").join(" ").trim();
      const lower = msgText.toLowerCase();
      const contextId = body?.message?.contextId || crypto.randomUUID();
      const prevTurns = PC_STATE.contexts.get(contextId) || 0;
      const turn = prevTurns + 1;
      PC_STATE.contexts.set(contextId, turn);

      pushLog(
        `\n\x1b[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`
      );
      pushLog(
        `\x1b[1;36m📥 [PC Build-a-Bot] INBOUND A2A MESSAGE (Turn ${turn} | Context: ${contextId})\x1b[0m`
      );
      pushLog(`\x1b[0;37m${msgText}\x1b[0m`);

      const hasAnswers =
        turn >= 2 ||
        (lower.includes("windows") &&
          (lower.includes("ssd") || lower.includes("nvme")) &&
          (lower.includes("walnut") || lower.includes("32gb")));

      if (!hasAnswers) {
        pushLog(
          `\x1b[1;33m⚙️  [PC Build-a-Bot] Querying RigFoundry private inventory & bundle offers...\x1b[0m`
        );
        const llmReply = await maybeCallClaudeTurn1(env, msgText);
        const replyText =
          llmReply ||
          "I checked RigFoundry's private warehouse inventory and VIP bundle deals. Before I lock in your build and run our 3D CAD clearance check, please clarify:\n" +
            "1. **OS & Storage:** Do you need Windows 11 ($119) and an NVMe SSD included, or are you reusing your own?\n" +
            "2. **RAM vs. GPU:** Do you prioritize 64GB RAM or 32GB DDR5 paired with a higher-tier 16GB GPU?\n" +
            "3. **0% APR Financing:** Would you like to use our 12-month 0% APR financing (up to $1,250) or keep a strict $1,000 cap?\n" +
            "4. **Style & Timeline:** What case aesthetic/RGB style do you prefer, and do you need immediate in-stock shipping this week vs. waiting 2 weeks for backordered parts?";

        const taskId = crypto.randomUUID();
        const task = {
          id: taskId,
          contextId,
          createdAtMs: Date.now(),
          loggedCompletion: true,
          artifacts: [
            {
              artifactId: crypto.randomUUID(),
              parts: [{ text: replyText }],
            },
          ],
          history: body.message ? [body.message] : [],
          status: {
            state: "TASK_STATE_COMPLETED",
            timestamp: new Date().toISOString(),
          },
        };
        PC_STATE.tasks.set(taskId, task);

        pushLog(`\x1b[1;32m📤 [PC Build-a-Bot] OUTBOUND A2A RESPONSE:\x1b[0m`);
        pushLog(`\x1b[0;32m${replyText}\x1b[0m`);
        pushLog(
          `\x1b[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`
        );
        return Response.json({ task: materializeTask(task) });
      }

      const taskId = "order-rf-vip-999";
      const workingText =
        `⏳ **Order & 3D CAD Clearance Verification Queued in Background (Task ID: \`${taskId}\`)**\n` +
        `- **Status:** \`TASK_STATE_WORKING\` (running millimeter GPU/case CAD simulation & locking warehouse bin for VIP White + Walnut RX 7800 XT bundle at **$999**; est. 10 seconds).\n` +
        `- **Next Step:** Work is running asynchronously on RigFoundry's server — you can close your session and check the final build & reserve code anytime with:\n` +
        `  \`a2a task get -a ${url.origin} ${taskId}\``;

      const task = {
        id: taskId,
        contextId,
        createdAtMs: Date.now(),
        loggedCompletion: false,
        artifacts: [
          {
            artifactId: crypto.randomUUID(),
            parts: [{ text: workingText }],
          },
        ],
        history: body.message ? [body.message] : [],
        status: {
          state: "TASK_STATE_WORKING",
          timestamp: new Date().toISOString(),
        },
      };
      PC_STATE.tasks.set(taskId, task);

      pushLog(
        `\x1b[1;33m⚙️  [PC Build-a-Bot] Started Async 3D CAD Clearance & Warehouse Lock (Task: ${taskId} -> TASK_STATE_WORKING, completes in 10s)...\x1b[0m`
      );
      pushLog(`\x1b[1;32m📤 [PC Build-a-Bot] OUTBOUND A2A RESPONSE:\x1b[0m`);
      pushLog(`\x1b[0;32m${workingText}\x1b[0m`);
      pushLog(
        `\x1b[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`
      );

      return Response.json({ task: materializeTask(task) });
    }

    if (role === "mockegg") {
      return new Response(MOCKEGG_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return new Response(buildRigFoundryHtml(url.origin), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
