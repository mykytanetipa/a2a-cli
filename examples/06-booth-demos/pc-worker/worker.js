/**
 * Cloudflare Worker for A2A Booth Demo 1 (PC Build Scenario — Option B):
 *  - Worker 1 (`mockegg.<you>.workers.dev`):
 *      Multi-page Newegg-style e-commerce store (`/`, `/prebuilts`, `/gpus`, `/cpus-mobos`, `/cases-psus`).
 *      Home page (`/`) links to category subpages AND mentions boutique SFF partner `https://rigfoundry.<you>.workers.dev`.
 *      Returns 404 on `/.well-known/agent-card.json`.
 *  - Worker 2 (`rigfoundry.<you>.workers.dev`):
 *      Serves RigFoundry landing page at `GET /` and `PC Build-a-Bot (RigFoundry)` Agent Card at
 *      `GET /.well-known/agent-card.json` (only to `a2a` CLI `Go-http-client`, returning 404 to `WebFetch`/`curl`
 *      so the No-A2A caller cannot manually scrape the Agent Card!).
 */

function detectRole(url) {
  const host = url.hostname.toLowerCase();
  if (host.includes("rigfoundry") || url.pathname.startsWith("/rigfoundry")) {
    return "rigfoundry";
  }
  return "mockegg";
}

function getRigFoundryOrigin(url) {
  if (url.hostname.includes("mockegg")) {
    return `${url.protocol}//${url.hostname.replace("mockegg", "rigfoundry")}`;
  }
  return `${url.origin}/rigfoundry`;
}

function renderMockEggHome(url) {
  const base = url.origin;
  const rigfoundryUrl = getRigFoundryOrigin(url);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>MockEgg — PC Parts, Gaming Desktops &amp; DIY Components</title>
</head>
<body>
  <h1>MockEgg — Custom PC Parts &amp; Pre-Built Gaming Systems</h1>
  <p>Welcome to MockEgg. Browse our online catalog categories below to configure a custom gaming PC or pick a ready-to-ship pre-built desktop:</p>
  <h2>Store Catalog Pages</h2>
  <ul>
    <li><a href="${base}/prebuilts">${base}/prebuilts</a> — Pre-Built Gaming PCs ($899 – $1,499)</li>
    <li><a href="${base}/gpus">${base}/gpus</a> — Graphics Cards (AMD Radeon &amp; NVIDIA GeForce GPUs)</li>
    <li><a href="${base}/cpus-mobos">${base}/cpus-mobos</a> — CPUs, Coolers, Motherboards &amp; DDR5 Memory</li>
    <li><a href="${base}/cases-psus">${base}/cases-psus</a> — PC Cases, Power Supplies, NVMe SSDs &amp; OS Licenses</li>
  </ul>
  <hr>
  <h2>Boutique SFF Partner: ${rigfoundryUrl}</h2>
  <p>Looking for compact mATX/SFF custom builds (Lian Li DAN A3) or bundle quotes under $1,000? Check our boutique partner at ${rigfoundryUrl}</p>
</body>
</html>`;
}

const MOCKEGG_PREBUILTS = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Pre-Built Gaming PCs</title></head>
<body>
  <h1>MockEgg Pre-Built Gaming Desktops</h1>
  <table border="1" cellpadding="6">
    <tr><th>Model</th><th>Specs</th><th>Case &amp; Lighting</th><th>Stock</th><th>Price</th></tr>
    <tr><td>MockEgg Blaze RGB 1080p</td><td>Ryzen 5 5600, RTX 4060 8GB, 16GB DDR4, 500GB SSD, Win11</td><td>Black ATX Mid-Tower, 4x ARGB Fans</td><td>In Stock</td><td>$899</td></tr>
    <tr><td>MockEgg CyberGlass 1440p</td><td>i5-13400F, RX 7700 XT 12GB, 16GB DDR5, 1TB SSD, Win11</td><td>Black Dual-Chamber Fishtank, Full RGB</td><td>In Stock</td><td>$1,099</td></tr>
    <tr><td>MockEgg Nordic Wood Pro</td><td>Ryzen 5 7600, RX 7800 XT 16GB, 32GB DDR5, 1TB SSD, Win11</td><td>Lian Li DAN A3 Wood (White + Walnut, Zero RGB)</td><td>In Stock</td><td>$1,249</td></tr>
  </table>
  <p><em>Note: Pre-built configurations cannot be modified (all include pre-installed Windows 11 and SSD). For DIY part selection, browse /gpus, /cpus-mobos, and /cases-psus.</em></p>
</body>
</html>`;

const MOCKEGG_GPUS = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Graphics Cards (GPUs)</title></head>
<body>
  <h1>MockEgg — Graphics Cards (GPUs)</h1>
  <table border="1" cellpadding="6">
    <tr><th>Model</th><th>VRAM</th><th>Color / Lighting</th><th>Availability</th><th>Retail Price</th></tr>
    <tr><td>Sapphire PURE Radeon RX 7800 XT 16GB Arctic White</td><td>16GB GDDR6</td><td>White (Zero RGB / LED toggle off)</td><td>In Stock</td><td>$519</td></tr>
    <tr><td>XFX Speedster QICK 319 Radeon RX 7900 GRE 16GB</td><td>16GB GDDR6</td><td>Black, Zero RGB</td><td>In Stock (Partner Warehouse)</td><td>$459</td></tr>
    <tr><td>PowerColor Fighter Radeon RX 7700 XT 12GB</td><td>12GB GDDR6</td><td>Black, Zero RGB</td><td>In Stock</td><td>$389</td></tr>
    <tr><td>ASUS Dual GeForce RTX 4060 Ti 8GB White</td><td>8GB GDDR6</td><td>White, Zero RGB</td><td>In Stock</td><td>$399</td></tr>
  </table>
</body>
</html>`;

const MOCKEGG_CPUS_MOBOS = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — CPUs, Motherboards &amp; DDR5 RAM</title></head>
<body>
  <h1>MockEgg — CPUs, Coolers, Motherboards &amp; Memory</h1>
  <table border="1" cellpadding="6">
    <tr><th>Category</th><th>Model</th><th>Specs</th><th>Availability</th><th>Retail Price</th></tr>
    <tr><td>CPU</td><td>AMD Ryzen 5 7600</td><td>Socket AM5, 6C/12T, Includes Wraith Stealth Non-RGB Cooler</td><td>In Stock</td><td>$185</td></tr>
    <tr><td>CPU</td><td>AMD Ryzen 7 7700X</td><td>Socket AM5, 8C/16T (No cooler included)</td><td>In Stock</td><td>$289</td></tr>
    <tr><td>Motherboard</td><td>ASRock B650M Pro RS WiFi</td><td>Socket AM5, mATX, White/Silver Heatsinks, WiFi 6E, Zero RGB</td><td>In Stock</td><td>$135</td></tr>
    <tr><td>RAM</td><td>TEAMGROUP T-Create Expert 32GB (2x16GB) DDR5-6000 CL30</td><td>White Aluminum Heatspreader, Zero RGB</td><td>In Stock</td><td>$85</td></tr>
    <tr><td>RAM</td><td>Corsair Vengeance 64GB (2x32GB) DDR5-6000 CL30</td><td>Black, Zero RGB</td><td>In Stock</td><td>$175</td></tr>
  </table>
</body>
</html>`;

const MOCKEGG_CASES_PSUS = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Cases, Power Supplies, Storage &amp; OS</title></head>
<body>
  <h1>MockEgg — Cases, PSUs, Storage &amp; OS</h1>
  <table border="1" cellpadding="6">
    <tr><th>Category</th><th>Model</th><th>Specs</th><th>Availability</th><th>Retail Price</th></tr>
    <tr><td>Case</td><td>Lian Li DAN A3-mATX Wood Edition</td><td>White Steel + Walnut Wood Front Panel, Zero RGB, Compact mATX</td><td>In Stock</td><td>$85</td></tr>
    <tr><td>Case</td><td>NZXT H5 Flow RGB</td><td>Black ATX Mid-Tower, Tempered Glass + ARGB Fans</td><td>In Stock</td><td>$95</td></tr>
    <tr><td>PSU</td><td>Corsair RM750e 750W ATX 3.0</td><td>80+ Gold Fully Modular, Compact ATX, Zero RGB</td><td>In Stock</td><td>$90</td></tr>
    <tr><td>SSD</td><td>WD Black SN770 1TB PCIe 4.0 NVMe</td><td>M.2 2280</td><td>In Stock</td><td>$75</td></tr>
    <tr><td>OS</td><td>Microsoft Windows 11 Home OEM</td><td>64-bit DVD/USB</td><td>In Stock</td><td>$119</td></tr>
  </table>
</body>
</html>`;

const RIGFOUNDRY_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>RigFoundry — Boutique Custom SFF &amp; mATX PC Builder</title></head>
<body>
  <h1>RigFoundry Boutique Custom SFF &amp; mATX Builds</h1>
  <p>RigFoundry is an appointment-only custom PC assembly workshop in Austin, TX. Online self-service part tables are not published on our website; please use MockEgg for self-service web catalog orders.</p>
</body>
</html>`;

const RIGFOUNDRY_CARD = {
  name: "PC Build-a-Bot (RigFoundry)",
  description:
    "Expert custom gaming PC builder at RigFoundry with private warehouse inventory, unadvertised VIP bundle discounts (saving up to $100 vs MockEgg public retail), and millimeter physical compatibility verification.",
  version: "1.0.0",
  capabilities: { streaming: true },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  supportedInterfaces: [
    {
      url: "http://localhost:8081",
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const role = detectRole(url);
    const ua = request.headers.get("user-agent") || "";

    // Only serve /.well-known/agent-card.json to the `a2a` Go CLI (`Go-http-client`),
    // returning 404 to WebFetch / curl so the No-A2A caller never manually scrapes the Agent Card!
    if (url.pathname.endsWith("/.well-known/agent-card.json")) {
      if (role === "mockegg" || !ua.includes("Go-http-client")) {
        return new Response("Not Found", { status: 404 });
      }
      return Response.json(RIGFOUNDRY_CARD);
    }

    if (role === "rigfoundry") {
      return new Response(RIGFOUNDRY_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (url.pathname === "/prebuilts") {
      return new Response(MOCKEGG_PREBUILTS, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (url.pathname === "/gpus") {
      return new Response(MOCKEGG_GPUS, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (url.pathname === "/cpus-mobos") {
      return new Response(MOCKEGG_CPUS_MOBOS, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (url.pathname === "/cases-psus") {
      return new Response(MOCKEGG_CASES_PSUS, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response(renderMockEggHome(url), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
