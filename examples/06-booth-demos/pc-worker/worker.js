/**
 * Cloudflare Worker for Demo 1 (PC Build):
 * - `mockegg.<subdomain>.workers.dev`: Public multi-page Newegg-style store (NO A2A card -> 404).
 * - `rigfoundry.<subdomain>.workers.dev`: Full A2A v1.0 Server & Client powered by `@a2a-js/sdk`
 *   (`DefaultRequestHandler`, `InMemoryTaskStore`, `InMemoryPushNotificationStore`,
 *   `DefaultPushNotificationSender`, `ClientFactory`, `RestTransportFactory`).
 *   All A2A requests (`card get`, `send`, `send --async`, `task push-config create`, `task get`)
 *   run through this Cloudflare Worker and bridge via `@a2a-js/sdk/client` to the local `a2a server`.
 */
import { createA2AWorkerAgent } from "./a2a-worker-runtime.js";

function getMockEggHomeHtml(rigfoundryUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Custom PC Parts & Pre-Built Gaming Systems</title></head>
<body>
  <h1>MockEgg — Custom PC Parts &amp; Pre-Built Gaming Systems</h1>
  <section id="partner-stores">
    <p><strong>Partner Boutique Builder:</strong> Looking for custom walnut/stealth SFF builds, millimeter compatibility verification, or private warehouse bundle pricing? Visit our official partner <a href="${rigfoundryUrl}">RigFoundry Custom Builds (${rigfoundryUrl})</a>.</p>
  </section>
  <hr>
  <p>Browse MockEgg's public component catalog and pre-built desktops by category:</p>
  <nav>
    <ul>
      <li><a href="/prebuilts">Pre-Built Gaming Desktops</a> — Ready-to-ship configurations ($949 – $1,249)</li>
      <li><a href="/gpus">Graphics Cards (GPUs)</a> — Radeon RX &amp; GeForce RTX series</li>
      <li><a href="/cpus-mobos">Processors (CPUs), Motherboards &amp; DDR5 Memory</a></li>
      <li><a href="/cases-psus">PC Cases, Power Supplies, NVMe Storage &amp; OS</a></li>
    </ul>
  </nav>
</body>
</html>`;
}

const MOCKEGG_PREBUILTS_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Pre-Built Gaming Desktops</title></head>
<body>
  <h1>MockEgg — Pre-Built Gaming Desktops</h1>
  <p><a href="/">← Back to MockEgg Home</a></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>System Name</th><th>Specs</th><th>Stock</th><th>Price</th></tr>
    <tr>
      <td>ME-PB-101</td>
      <td>MockEgg CyberPrism RGB Gaming Tower</td>
      <td>Ryzen 5 7600, RX 7700 XT 12GB, 16GB DDR5, 1TB NVMe, Tempered Glass Case w/ 6x Rainbow ARGB Fans</td>
      <td>In Stock</td>
      <td>$999</td>
    </tr>
    <tr>
      <td>ME-PB-102</td>
      <td>MockEgg NeonBlade RTX 4060 System</td>
      <td>Core i5-13400F, RTX 4060 8GB, 16GB DDR5, 1TB NVMe, Black RGB Mesh Case</td>
      <td>In Stock</td>
      <td>$949</td>
    </tr>
    <tr>
      <td>ME-PB-103</td>
      <td>MockEgg Creator &amp; Gaming Pro 1440p</td>
      <td>Ryzen 5 7600, RX 7800 XT 16GB, 32GB DDR5, 1TB NVMe, NZXT H5 RGB Case</td>
      <td>In Stock</td>
      <td>$1,229</td>
    </tr>
  </table>
</body>
</html>`;

const MOCKEGG_GPUS_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Graphics Cards (GPUs)</title></head>
<body>
  <h1>MockEgg — Graphics Cards (GPUs)</h1>
  <p><a href="/">← Back to MockEgg Home</a></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Model</th><th>VRAM</th><th>Lighting</th><th>Stock</th><th>Retail Price</th></tr>
    <tr><td>ME-GPU-7800W</td><td>Sapphire PURE Radeon RX 7800 XT Arctic White</td><td>16GB GDDR6</td><td>ARGB LED Logo</td><td>In Stock</td><td>$519</td></tr>
    <tr><td>ME-GPU-7900GRE</td><td>XFX Radeon RX 7900 GRE Black</td><td>16GB GDDR6</td><td>None</td><td>Backordered (2 Weeks)</td><td>$549</td></tr>
    <tr><td>ME-GPU-7700XT</td><td>PowerColor Fighter Radeon RX 7700 XT</td><td>12GB GDDR6</td><td>None</td><td>In Stock</td><td>$419</td></tr>
    <tr><td>ME-GPU-4060TI</td><td>MSI Ventus GeForce RTX 4060 Ti</td><td>8GB GDDR6</td><td>None</td><td>In Stock</td><td>$389</td></tr>
  </table>
</body>
</html>`;

const MOCKEGG_CPUS_MOBOS_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — CPUs, Motherboards & DDR5 RAM</title></head>
<body>
  <h1>MockEgg — CPUs, Motherboards &amp; DDR5 Memory</h1>
  <p><a href="/">← Back to MockEgg Home</a></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Category</th><th>Model</th><th>Notes</th><th>Stock</th><th>Retail Price</th></tr>
    <tr><td>ME-CPU-7600</td><td>CPU</td><td>AMD Ryzen 5 7600 6-Core AM5</td><td>Includes Wraith Stealth Cooler</td><td>In Stock</td><td>$195</td></tr>
    <tr><td>ME-CPU-7700X</td><td>CPU</td><td>AMD Ryzen 7 7700X 8-Core AM5</td><td>No Cooler Included</td><td>In Stock</td><td>$289</td></tr>
    <tr><td>ME-MB-B650M</td><td>Motherboard</td><td>ASRock B650M Pro RS WiFi (White/Silver mATX)</td><td>AM5, DDR5, WiFi 6E</td><td>In Stock</td><td>$149</td></tr>
    <tr><td>ME-RAM-32W</td><td>Memory</td><td>TEAMGROUP T-Create Expert 32GB (2x16GB) DDR5-6000 CL30 White</td><td>Zero RGB</td><td>In Stock</td><td>$95</td></tr>
    <tr><td>ME-RAM-64B</td><td>Memory</td><td>Corsair Vengeance 64GB (2x32GB) DDR5-6000 CL30 Black</td><td>Zero RGB</td><td>In Stock</td><td>$195</td></tr>
  </table>
</body>
</html>`;

const MOCKEGG_CASES_PSUS_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Cases, Power Supplies, Storage & OS</title></head>
<body>
  <h1>MockEgg — PC Cases, Power Supplies, Storage &amp; OS</h1>
  <p><a href="/">← Back to MockEgg Home</a></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Category</th><th>Model</th><th>Specs</th><th>Stock</th><th>Retail Price</th></tr>
    <tr><td>ME-CASE-A3W</td><td>Case</td><td>Lian Li DAN A3-mATX Wood Edition (White + Walnut Front)</td><td>mATX, Zero RGB</td><td>In Stock</td><td>$89</td></tr>
    <tr><td>ME-CASE-H5RGB</td><td>Case</td><td>NZXT H5 Flow RGB White</td><td>ATX Mid-Tower, 2x RGB Fans</td><td>In Stock</td><td>$99</td></tr>
    <tr><td>ME-PSU-750E</td><td>PSU</td><td>Corsair RM750e 750W 80+ Gold ATX 3.0</td><td>Fully Modular</td><td>In Stock</td><td>$99</td></tr>
    <tr><td>ME-SSD-1TB</td><td>Storage</td><td>WD Black SN770 1TB PCIe Gen4 NVMe SSD</td><td>5,150 MB/s</td><td>In Stock</td><td>$75</td></tr>
    <tr><td>ME-OS-W11</td><td>OS</td><td>Microsoft Windows 11 Home OEM</td><td>64-bit</td><td>In Stock</td><td>$119</td></tr>
  </table>
  <p><em>Note: Public retail total for Ryzen 5 7600 ($195) + ASRock B650M ($149) + 32GB White DDR5 ($95) + Sapphire RX 7800 XT 16GB ($519) + Lian Li DAN A3 Wood Case ($89) + Corsair RM750e 750W ($99) = <strong>$1,146</strong> (before SSD/OS), exceeding a $1,000 budget unless downgraded to a 12GB RX 7700 XT ($1,046) or 8GB RTX 4060 Ti ($1,016).</em></p>
</body>
</html>`;

const RIGFOUNDRY_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>RigFoundry — Boutique Custom Gaming PCs</title></head>
<body>
  <h1>RigFoundry — Boutique SFF &amp; Custom Gaming PCs</h1>
  <p>RigFoundry specializes in minimalist, zero-RGB custom gaming rigs and physical millimeter clearance verification.</p>
  <p><em>Online web catalog is currently undergoing maintenance.</em></p>
</body>
</html>`;

const RIGFOUNDRY_CARD_TEMPLATE = {
  name: "PC Build-a-Bot (RigFoundry)",
  description:
    "Expert custom gaming PC builder at RigFoundry with private warehouse inventory, unadvertised VIP bundle discounts (saving up to $100 vs MockEgg public retail), and millimeter physical compatibility verification.",
  version: "1.0.0",
  capabilities: {
    streaming: true,
    pushNotifications: true,
    extensions: [],
    extendedAgentCard: false,
  },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  securitySchemes: {},
  securityRequirements: [],
  skills: [
    {
      id: "custom-pc-build",
      name: "Custom PC Configurator & Compatibility Solver",
      description:
        "Designs custom gaming PCs, verifies physical GPU/case clearance in millimeters, and applies private warehouse bundle pricing.",
      tags: ["pc-build", "gaming", "hardware"],
      examples: ["Build a unique 1440p gaming PC under $1000"],
      inputModes: [],
      outputModes: [],
      securityRequirements: [],
    },
  ],
};

const rigfoundryAgent = createA2AWorkerAgent({
  cardTemplate: RIGFOUNDRY_CARD_TEMPLATE,
  defaultUpstreamUrl: "",
});

function detectRole(url) {
  if (url.hostname.startsWith("rigfoundry") || url.searchParams.get("site") === "rigfoundry") {
    return "rigfoundry";
  }
  return "mockegg";
}

function getPartnerUrl(url) {
  if (url.hostname.startsWith("mockegg.")) {
    return `${url.protocol}//${url.hostname.replace(/^mockegg\./, "rigfoundry.")}`;
  }
  return `${url.origin}?site=rigfoundry`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const role = detectRole(url);
    const ua = request.headers.get("user-agent") || "";

    // 1. Block non-A2A-CLI scrapers (like WebFetch in the No-A2A caller) from reading the Agent Card
    if (url.pathname.endsWith("/.well-known/agent-card.json")) {
      if (role === "mockegg" || !ua.includes("Go-http-client")) {
        return new Response("Not Found", { status: 404 });
      }
      return rigfoundryAgent.handleFetch(request, env, ctx);
    }

    // 2. Route all RigFoundry A2A protocol requests through `@a2a-js/sdk`
    if (role === "rigfoundry") {
      const a2aResp = await rigfoundryAgent.handleFetch(request, env, ctx);
      if (a2aResp) {
        return a2aResp;
      }
      return new Response(RIGFOUNDRY_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // 3. MockEgg public multi-page HTML catalog
    if (url.pathname === "/prebuilts") {
      return new Response(MOCKEGG_PREBUILTS_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (url.pathname === "/gpus") {
      return new Response(MOCKEGG_GPUS_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (url.pathname === "/cpus-mobos") {
      return new Response(MOCKEGG_CPUS_MOBOS_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (url.pathname === "/cases-psus") {
      return new Response(MOCKEGG_CASES_PSUS_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return new Response(getMockEggHomeHtml(getPartnerUrl(url)), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
