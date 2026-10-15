/**
 * Cloudflare Worker for Demo 1 (PC Build):
 * - `mockegg.<subdomain>.workers.dev`: Public 3-tier multi-page store (Department Hubs -> Category Pages -> Product Spec/Stock Pages).
 * - `rigfoundry.<subdomain>.workers.dev`: Full A2A v1.0 Server & Client powered by `@a2a-js/sdk`.
 */
import { createA2AWorkerAgent } from "./a2a-worker-runtime.js";

function getMockEggHomeHtml(origin, rigfoundryUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Custom PC Parts & Pre-Built Gaming Systems</title></head>
<body>
  <h1>MockEgg — Custom PC Parts &amp; Pre-Built Gaming Systems</h1>
  <section id="partner-stores">
    <p><strong>Partner Boutique Builder:</strong> Looking for custom walnut/stealth SFF builds, millimeter compatibility verification, or private warehouse bundle pricing? Visit our official partner <a href="${rigfoundryUrl}">RigFoundry Custom Builds (${rigfoundryUrl})</a>.</p>
  </section>
  <hr>
  <h2>Shop by Department</h2>
  <p>Select a department URL below to browse component sub-categories, paginated listings, and individual product specification &amp; live inventory pages:</p>
  <nav>
    <ul>
      <li><a href="${origin}/departments/prebuilts">Pre-Built Gaming Desktops Department (${origin}/departments/prebuilts)</a> — Ready-to-ship gaming towers ($949 – $1,229)</li>
      <li><a href="${origin}/departments/core">Core Components Department (${origin}/departments/core)</a> — Processors (CPUs), CPU Coolers, Motherboards &amp; DDR5 Memory</li>
      <li><a href="${origin}/departments/gpus">Graphics Cards (GPUs) Department (${origin}/departments/gpus)</a> — Flagship 4K, 1440p &amp; 1080p GPUs (3-page paginated catalog)</li>
      <li><a href="${origin}/departments/chassis-power">Enclosures, Power &amp; Storage Department (${origin}/departments/chassis-power)</a> — PC Cases, ATX 3.0 Power Supplies, NVMe SSDs &amp; OS</li>
    </ul>
  </nav>
</body>
</html>`;
}

function renderDeptPrebuilts(origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Pre-Built Gaming Desktops Department</title></head>
<body>
  <h1>MockEgg — Pre-Built Gaming Desktops</h1>
  <p><a href="${origin}/">← Back to MockEgg Home (${origin}/)</a></p>
  <p><em>Fetch each product URL below to view full component specifications, case lighting details, and live warehouse stock status.</em></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>System Name</th><th>Summary</th><th>Price</th><th>Spec &amp; Stock URL</th></tr>
    <tr>
      <td>ME-PB-101</td>
      <td>MockEgg CyberPrism Tower</td>
      <td>Ryzen 5 7600 / Radeon RX 7700 XT / 16GB DDR5 / 1TB NVMe</td>
      <td>$999</td>
      <td><a href="${origin}/product/ME-PB-101">${origin}/product/ME-PB-101</a></td>
    </tr>
    <tr>
      <td>ME-PB-102</td>
      <td>MockEgg NeonBlade System</td>
      <td>Core i5-13400F / GeForce RTX 4060 / 16GB DDR5 / 1TB NVMe</td>
      <td>$949</td>
      <td><a href="${origin}/product/ME-PB-102">${origin}/product/ME-PB-102</a></td>
    </tr>
    <tr>
      <td>ME-PB-103</td>
      <td>MockEgg Creator &amp; Gaming Pro 1440p</td>
      <td>Ryzen 5 7600 / Radeon RX 7800 XT / 32GB DDR5 / 1TB NVMe</td>
      <td>$1,229</td>
      <td><a href="${origin}/product/ME-PB-103">${origin}/product/ME-PB-103</a></td>
    </tr>
  </table>
</body>
</html>`;
}

function renderDeptCore(origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Core Components Department</title></head>
<body>
  <h1>MockEgg — Core Components Department</h1>
  <p><a href="${origin}/">← Back to MockEgg Home (${origin}/)</a></p>
  <p>Browse individual component category URLs below to view models, pricing, and product specification sheets:</p>
  <ul>
    <li><a href="${origin}/catalog/cpus">Processors (CPUs): ${origin}/catalog/cpus</a> — AMD Socket AM5 &amp; Intel LGA1700 Processors</li>
    <li><a href="${origin}/catalog/coolers">CPU Coolers: ${origin}/catalog/coolers</a> — Air &amp; Liquid CPU Coolers (with height/RGB specs)</li>
    <li><a href="${origin}/catalog/motherboards">Motherboards: ${origin}/catalog/motherboards</a> — mATX &amp; ATX Motherboards</li>
    <li><a href="${origin}/catalog/memory">DDR5 Memory: ${origin}/catalog/memory</a> — 32GB &amp; 64GB DDR5 RAM Kits</li>
  </ul>
</body>
</html>`;
}

function renderDeptGpusPage1(origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Graphics Cards (Page 1 of 3: Enthusiast 4K Series)</title></head>
<body>
  <h1>MockEgg — Graphics Cards (Page 1 of 3: Enthusiast 4K Series)</h1>
  <p><strong>Next Page (Upper-Midrange 1440p GPUs): <a href="${origin}/departments/gpus/page-2">${origin}/departments/gpus/page-2</a></strong> | <strong>Page 3 (Value 1440p/1080p GPUs): <a href="${origin}/departments/gpus/page-3">${origin}/departments/gpus/page-3</a></strong></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Model</th><th>VRAM</th><th>Retail Price</th><th>Spec &amp; Stock URL</th></tr>
    <tr><td>ME-GPU-4090</td><td>ASUS ROG Strix GeForce RTX 4090 OC</td><td>24GB GDDR6X</td><td>$1,799</td><td><a href="${origin}/product/ME-GPU-4090">${origin}/product/ME-GPU-4090</a></td></tr>
    <tr><td>ME-GPU-4080S</td><td>MSI Gaming X Slim GeForce RTX 4080 Super</td><td>16GB GDDR6X</td><td>$1,049</td><td><a href="${origin}/product/ME-GPU-4080S">${origin}/product/ME-GPU-4080S</a></td></tr>
    <tr><td>ME-GPU-7900XTX</td><td>Sapphire NITRO+ Radeon RX 7900 XTX</td><td>24GB GDDR6</td><td>$949</td><td><a href="${origin}/product/ME-GPU-7900XTX">${origin}/product/ME-GPU-7900XTX</a></td></tr>
  </table>
  <p>Looking for 1440p GPUs under $600? Continue to Page 2: <a href="${origin}/departments/gpus/page-2">${origin}/departments/gpus/page-2</a></p>
</body>
</html>`;
}

function renderDeptGpusPage2(origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Graphics Cards (Page 2 of 3: 16GB 1440p Series)</title></head>
<body>
  <h1>MockEgg — Graphics Cards (Page 2 of 3: 16GB 1440p Series)</h1>
  <p><a href="${origin}/departments/gpus">← Page 1</a> | <strong>Next Page (12GB &amp; 8GB GPUs under $450): <a href="${origin}/departments/gpus/page-3">${origin}/departments/gpus/page-3</a></strong></p>
  <p><em>Fetch each product URL below to check live warehouse stock status, card length (mm), and RGB lighting details.</em></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Model</th><th>VRAM</th><th>Retail Price</th><th>Spec &amp; Stock URL</th></tr>
    <tr><td>ME-GPU-7900GRE</td><td>XFX Radeon RX 7900 GRE Matte Black</td><td>16GB GDDR6</td><td>$549</td><td><a href="${origin}/product/ME-GPU-7900GRE">${origin}/product/ME-GPU-7900GRE</a></td></tr>
    <tr><td>ME-GPU-7800W</td><td>Sapphire PURE Radeon RX 7800 XT Arctic White</td><td>16GB GDDR6</td><td>$519</td><td><a href="${origin}/product/ME-GPU-7800W">${origin}/product/ME-GPU-7800W</a></td></tr>
  </table>
  <p>Need a lower-priced GPU to fit a $1,000 total build budget? Check Page 3: <a href="${origin}/departments/gpus/page-3">${origin}/departments/gpus/page-3</a></p>
</body>
</html>`;
}

function renderDeptGpusPage3(origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Graphics Cards (Page 3 of 3: Midrange 12GB & 8GB Series)</title></head>
<body>
  <h1>MockEgg — Graphics Cards (Page 3 of 3: Midrange 12GB &amp; 8GB Series)</h1>
  <p><a href="${origin}/departments/gpus/page-2">← Page 2 (16GB GPUs)</a> | <a href="${origin}/">MockEgg Home</a></p>
  <p><em>Fetch each product URL below to check live warehouse stock status, card length (mm), and RGB lighting details.</em></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Model</th><th>VRAM</th><th>Retail Price</th><th>Spec &amp; Stock URL</th></tr>
    <tr><td>ME-GPU-7700XT</td><td>PowerColor Fighter Radeon RX 7700 XT</td><td>12GB GDDR6</td><td>$419</td><td><a href="${origin}/product/ME-GPU-7700XT">${origin}/product/ME-GPU-7700XT</a></td></tr>
    <tr><td>ME-GPU-4060TI</td><td>MSI Ventus 2X Black GeForce RTX 4060 Ti</td><td>8GB GDDR6</td><td>$389</td><td><a href="${origin}/product/ME-GPU-4060TI">${origin}/product/ME-GPU-4060TI</a></td></tr>
  </table>
</body>
</html>`;
}

function renderDeptChassisPower(origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Enclosures, Power & Storage Department</title></head>
<body>
  <h1>MockEgg — Enclosures, Power &amp; Storage Department</h1>
  <p><a href="${origin}/">← Back to MockEgg Home (${origin}/)</a></p>
  <p>Select a category URL below to browse cases, power supplies, storage drives, and operating systems:</p>
  <ul>
    <li><a href="${origin}/catalog/cases">PC Cases &amp; SFF Enclosures: ${origin}/catalog/cases</a> — mATX Wood/Minimalist &amp; ATX Mid-Tower Cases</li>
    <li><a href="${origin}/catalog/psus">Power Supplies (PSUs): ${origin}/catalog/psus</a> — ATX 3.0 &amp; SFX Modular Power Supplies</li>
    <li><a href="${origin}/catalog/storage-os">NVMe SSD Storage &amp; Operating Systems: ${origin}/catalog/storage-os</a> — PCIe Gen4 M.2 SSDs &amp; Windows 11 OEM</li>
  </ul>
</body>
</html>`;
}

function renderCatalogCpus(origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Processors (CPUs)</title></head>
<body>
  <h1>MockEgg — Processors (CPUs)</h1>
  <p><a href="${origin}/departments/core">← Back to Core Components Department (${origin}/departments/core)</a></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Model</th><th>Socket</th><th>Retail Price</th><th>Spec &amp; Stock URL</th></tr>
    <tr><td>ME-CPU-7600</td><td>AMD Ryzen 5 7600 6-Core / 12-Thread</td><td>AM5</td><td>$195</td><td><a href="${origin}/product/ME-CPU-7600">${origin}/product/ME-CPU-7600</a></td></tr>
    <tr><td>ME-CPU-7700X</td><td>AMD Ryzen 7 7700X 8-Core / 16-Thread</td><td>AM5</td><td>$289</td><td><a href="${origin}/product/ME-CPU-7700X">${origin}/product/ME-CPU-7700X</a></td></tr>
  </table>
</body>
</html>`;
}

function renderCatalogCoolers(origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — CPU Coolers</title></head>
<body>
  <h1>MockEgg — CPU Coolers</h1>
  <p><a href="${origin}/departments/core">← Back to Core Components Department (${origin}/departments/core)</a></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Model</th><th>Type</th><th>Retail Price</th><th>Spec &amp; Stock URL</th></tr>
    <tr><td>ME-COOL-PA120</td><td>Thermalright Peerless Assassin 120 SE Matte Black</td><td>Dual-Tower Air</td><td>$35</td><td><a href="${origin}/product/ME-COOL-PA120">${origin}/product/ME-COOL-PA120</a></td></tr>
    <tr><td>ME-COOL-AIO240</td><td>NZXT Kraken 240 RGB White</td><td>240mm AIO Liquid</td><td>$139</td><td><a href="${origin}/product/ME-COOL-AIO240">${origin}/product/ME-COOL-AIO240</a></td></tr>
  </table>
</body>
</html>`;
}

function renderCatalogMobos(origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Motherboards</title></head>
<body>
  <h1>MockEgg — Motherboards</h1>
  <p><a href="${origin}/departments/core">← Back to Core Components Department (${origin}/departments/core)</a></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Model</th><th>Form Factor</th><th>Retail Price</th><th>Spec &amp; Stock URL</th></tr>
    <tr><td>ME-MB-B650M</td><td>ASRock B650M Pro RS WiFi (White/Silver)</td><td>mATX (AM5)</td><td>$149</td><td><a href="${origin}/product/ME-MB-B650M">${origin}/product/ME-MB-B650M</a></td></tr>
    <tr><td>ME-MB-B650A</td><td>ASUS TUF Gaming B650-PLUS WiFi</td><td>ATX (AM5)</td><td>$189</td><td><a href="${origin}/product/ME-MB-B650A">${origin}/product/ME-MB-B650A</a></td></tr>
  </table>
</body>
</html>`;
}

function renderCatalogMemory(origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — DDR5 Memory</title></head>
<body>
  <h1>MockEgg — DDR5 Memory Kits</h1>
  <p><a href="${origin}/departments/core">← Back to Core Components Department (${origin}/departments/core)</a></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Model</th><th>Capacity &amp; Speed</th><th>Retail Price</th><th>Spec &amp; Stock URL</th></tr>
    <tr><td>ME-RAM-32W</td><td>TEAMGROUP T-Create Expert 32GB (2x16GB) White</td><td>DDR5-6000 CL30</td><td>$95</td><td><a href="${origin}/product/ME-RAM-32W">${origin}/product/ME-RAM-32W</a></td></tr>
    <tr><td>ME-RAM-32RGB</td><td>G.Skill Trident Z5 RGB 32GB (2x16GB) Silver</td><td>DDR5-6000 CL30</td><td>$115</td><td><a href="${origin}/product/ME-RAM-32RGB">${origin}/product/ME-RAM-32RGB</a></td></tr>
    <tr><td>ME-RAM-64B</td><td>Corsair Vengeance 64GB (2x32GB) Matte Black</td><td>DDR5-6000 CL30</td><td>$195</td><td><a href="${origin}/product/ME-RAM-64B">${origin}/product/ME-RAM-64B</a></td></tr>
  </table>
</body>
</html>`;
}

function renderCatalogCases(origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — PC Cases & SFF Enclosures</title></head>
<body>
  <h1>MockEgg — PC Cases &amp; SFF Enclosures</h1>
  <p><a href="${origin}/departments/chassis-power">← Back to Enclosures, Power &amp; Storage (${origin}/departments/chassis-power)</a></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Model</th><th>Form Factor</th><th>Retail Price</th><th>Spec &amp; Clearance URL</th></tr>
    <tr><td>ME-CASE-A3W</td><td>Lian Li DAN A3-mATX Wood Edition (White + Walnut Front)</td><td>mATX SFF</td><td>$89</td><td><a href="${origin}/product/ME-CASE-A3W">${origin}/product/ME-CASE-A3W</a></td></tr>
    <tr><td>ME-CASE-H5RGB</td><td>NZXT H5 Flow RGB White</td><td>ATX Mid-Tower</td><td>$99</td><td><a href="${origin}/product/ME-CASE-H5RGB">${origin}/product/ME-CASE-H5RGB</a></td></tr>
  </table>
</body>
</html>`;
}

function renderCatalogPsus(origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Power Supplies (PSUs)</title></head>
<body>
  <h1>MockEgg — Power Supplies (PSUs)</h1>
  <p><a href="${origin}/departments/chassis-power">← Back to Enclosures, Power &amp; Storage (${origin}/departments/chassis-power)</a></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Model</th><th>Wattage</th><th>Retail Price</th><th>Spec &amp; Stock URL</th></tr>
    <tr><td>ME-PSU-750E</td><td>Corsair RM750e 750W 80+ Gold ATX 3.0</td><td>750W Modular</td><td>$99</td><td><a href="${origin}/product/ME-PSU-750E">${origin}/product/ME-PSU-750E</a></td></tr>
    <tr><td>ME-PSU-850SFX</td><td>Cooler Master V850 SFX Gold White</td><td>850W SFX</td><td>$159</td><td><a href="${origin}/product/ME-PSU-850SFX">${origin}/product/ME-PSU-850SFX</a></td></tr>
  </table>
</body>
</html>`;
}

function renderCatalogStorageOs(origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — NVMe SSD Storage & OS</title></head>
<body>
  <h1>MockEgg — NVMe SSD Storage &amp; Operating Systems</h1>
  <p><a href="${origin}/departments/chassis-power">← Back to Enclosures, Power &amp; Storage (${origin}/departments/chassis-power)</a></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Category</th><th>Model</th><th>Retail Price</th><th>Spec &amp; Stock URL</th></tr>
    <tr><td>ME-SSD-1TB</td><td>NVMe SSD</td><td>WD Black SN770 1TB PCIe Gen4 M.2</td><td>$75</td><td><a href="${origin}/product/ME-SSD-1TB">${origin}/product/ME-SSD-1TB</a></td></tr>
    <tr><td>ME-OS-W11</td><td>Operating System</td><td>Microsoft Windows 11 Home 64-bit OEM</td><td>$119</td><td><a href="${origin}/product/ME-OS-W11">${origin}/product/ME-OS-W11</a></td></tr>
  </table>
</body>
</html>`;
}

const PRODUCT_SPECS = {
  "ME-PB-101": {
    title: "MockEgg CyberPrism RGB Gaming Tower (ME-PB-101)",
    back: "/departments/prebuilts",
    price: "$999",
    stock: "In Stock — Ships in 24 hrs",
    lighting: "6x Non-Removable Rainbow ARGB Case Fans + ARGB Tempered Glass Strip (Cannot be disabled without proprietary Windows software)",
    specs: "AMD Ryzen 5 7600, Radeon RX 7700 XT 12GB, 16GB (2x8GB) DDR5-5200, 1TB NVMe SSD, 650W Bronze PSU",
  },
  "ME-PB-102": {
    title: "MockEgg NeonBlade RTX 4060 System (ME-PB-102)",
    back: "/departments/prebuilts",
    price: "$949",
    stock: "In Stock — Ships in 24 hrs",
    lighting: "4x Fixed Red/Blue LED Fans (Always-On LED wired to power rail)",
    specs: "Intel Core i5-13400F, GeForce RTX 4060 8GB, 16GB DDR5, 1TB NVMe SSD, Black Mesh ATX Case",
  },
  "ME-PB-103": {
    title: "MockEgg Creator & Gaming Pro 1440p (ME-PB-103)",
    back: "/departments/prebuilts",
    price: "$1,229",
    stock: "In Stock — Ships in 24 hrs",
    lighting: "2x Front ARGB Fans + RGB AIO Pump Cap",
    specs: "AMD Ryzen 5 7600, Radeon RX 7800 XT 16GB, 32GB DDR5-6000, 1TB NVMe SSD, NZXT H5 RGB Case",
  },
  "ME-GPU-4090": {
    title: "ASUS ROG Strix GeForce RTX 4090 OC 24GB (ME-GPU-4090)",
    back: "/departments/gpus",
    price: "$1,799",
    stock: "In Stock — Ships Today",
    lighting: "Full Aura Sync RGB shroud & backplate",
    specs: "24GB GDDR6X, 357.6mm length, 3.5-slot.",
  },
  "ME-GPU-4080S": {
    title: "MSI Gaming X Slim GeForce RTX 4080 Super 16GB (ME-GPU-4080S)",
    back: "/departments/gpus",
    price: "$1,049",
    stock: "In Stock — Ships Today",
    lighting: "Mystic Light RGB accents",
    specs: "16GB GDDR6X, 322mm length.",
  },
  "ME-GPU-7900XTX": {
    title: "Sapphire NITRO+ Radeon RX 7900 XTX 24GB (ME-GPU-7900XTX)",
    back: "/departments/gpus",
    price: "$949",
    stock: "In Stock — Ships Today",
    lighting: "Dual ARGB light bar",
    specs: "24GB GDDR6, 320mm length.",
  },
  "ME-GPU-7900GRE": {
    title: "XFX Radeon RX 7900 GRE Matte Black 16GB (ME-GPU-7900GRE)",
    back: "/departments/gpus/page-2",
    price: "$549",
    stock: "BACKORDERED — Estimated restock in 2 to 3 weeks (Not available for immediate shipping)",
    lighting: "Zero RGB (Stealth Matte Black shroud)",
    specs: "16GB GDDR6, 256-bit. Note: Exact 3D chassis clearance against front-mounted ATX PSUs is not listed in public retail spec sheet.",
  },
  "ME-GPU-7800W": {
    title: "Sapphire PURE Radeon RX 7800 XT Arctic White 16GB (ME-GPU-7800W)",
    back: "/departments/gpus/page-2",
    price: "$519 (Fixed public retail price; no public bundle discounts)",
    stock: "In Stock — Ships Today",
    lighting: "Red/White Sapphire LED Logo on side shroud (contains integrated LED lighting on standard retail SKU)",
    specs: "16GB GDDR6, 256-bit, Dual HDMI / Dual DP, 2.5-slot cooler.",
  },
  "ME-GPU-7700XT": {
    title: "PowerColor Fighter Radeon RX 7700 XT 12GB (ME-GPU-7700XT)",
    back: "/departments/gpus/page-3",
    price: "$419",
    stock: "In Stock — Ships Today",
    lighting: "Zero RGB (Matte Black shroud, no LEDs)",
    specs: "12GB GDDR6, 192-bit, 290mm length.",
  },
  "ME-GPU-4060TI": {
    title: "MSI Ventus 2X Black GeForce RTX 4060 Ti 8GB (ME-GPU-4060TI)",
    back: "/departments/gpus/page-3",
    price: "$389",
    stock: "In Stock — Ships Today",
    lighting: "Zero RGB (Matte Black)",
    specs: "8GB GDDR6, 128-bit, 199mm length.",
  },
  "ME-CPU-7600": {
    title: "AMD Ryzen 5 7600 6-Core / 12-Thread Socket AM5 (ME-CPU-7600)",
    back: "/catalog/cpus",
    price: "$195",
    stock: "In Stock — Ships Today",
    lighting: "Zero RGB (Includes non-RGB AMD Wraith Stealth low-profile cooler in box)",
    specs: "3.8 GHz Base / 5.1 GHz Boost, 65W TDP, PCIe 5.0, DDR5 support.",
  },
  "ME-CPU-7700X": {
    title: "AMD Ryzen 7 7700X 8-Core / 16-Thread Socket AM5 (ME-CPU-7700X)",
    back: "/catalog/cpus",
    price: "$289",
    stock: "In Stock — Ships Today",
    lighting: "Zero RGB (No cooler included — requires separate CPU cooler purchase)",
    specs: "4.5 GHz Base / 5.4 GHz Boost, 105W TDP.",
  },
  "ME-COOL-PA120": {
    title: "Thermalright Peerless Assassin 120 SE Matte Black (ME-COOL-PA120)",
    back: "/catalog/coolers",
    price: "$35",
    stock: "In Stock — Ships Today",
    lighting: "Zero RGB (Non-LED dual PWM fans)",
    specs: "155mm height, 6 heatpipes, AM5/LGA1700 compatible.",
  },
  "ME-COOL-AIO240": {
    title: "NZXT Kraken 240 RGB White 240mm Liquid Cooler (ME-COOL-AIO240)",
    back: "/catalog/coolers",
    price: "$139",
    stock: "In Stock — Ships Today",
    lighting: "2x F120 RGB Core Fans + LCD Pump Display",
    specs: "240mm radiator, AM5/LGA1700 brackets included.",
  },
  "ME-MB-B650M": {
    title: "ASRock B650M Pro RS WiFi White/Silver mATX (ME-MB-B650M)",
    back: "/catalog/motherboards",
    price: "$149",
    stock: "In Stock — Ships Today",
    lighting: "Zero onboard RGB LEDs (White/Silver brushed aluminum heatsinks)",
    specs: "Micro-ATX, Socket AM5, 4x DDR5 DIMM, 3x M.2 NVMe slots, WiFi 6E + 2.5GbE LAN.",
  },
  "ME-MB-B650A": {
    title: "ASUS TUF Gaming B650-PLUS WiFi ATX (ME-MB-B650A)",
    back: "/catalog/motherboards",
    price: "$189",
    stock: "In Stock — Ships Today",
    lighting: "Aura Sync RGB edge lighting on chipset area",
    specs: "Full ATX (Does NOT fit mATX SFF cases), Socket AM5.",
  },
  "ME-RAM-32W": {
    title: "TEAMGROUP T-Create Expert 32GB (2x16GB) DDR5-6000 CL30 White (ME-RAM-32W)",
    back: "/catalog/memory",
    price: "$95",
    stock: "In Stock — Ships Today",
    lighting: "Zero RGB (Minimalist matte white aluminum heatspreaders, 32mm low-profile height)",
    specs: "32GB (2x16GB), DDR5-6000MHz, CL30-36-36-76, AMD EXPO & Intel XMP 3.0.",
  },
  "ME-RAM-32RGB": {
    title: "G.Skill Trident Z5 RGB 32GB (2x16GB) DDR5-6000 CL30 (ME-RAM-32RGB)",
    back: "/catalog/memory",
    price: "$115",
    stock: "In Stock — Ships Today",
    lighting: "Full-length top ARGB light bar",
    specs: "32GB (2x16GB), DDR5-6000MHz, CL30.",
  },
  "ME-RAM-64B": {
    title: "Corsair Vengeance 64GB (2x32GB) DDR5-6000 CL30 Matte Black (ME-RAM-64B)",
    back: "/catalog/memory",
    price: "$195",
    stock: "In Stock — Ships Today",
    lighting: "Zero RGB",
    specs: "64GB (2x32GB), DDR5-6000MHz, CL30.",
  },
  "ME-CASE-A3W": {
    title: "Lian Li DAN A3-mATX Wood Edition — White + Walnut Front Panel (ME-CASE-A3W)",
    back: "/catalog/cases",
    price: "$89",
    stock: "In Stock — Ships Today",
    lighting: "Zero RGB (Minimalist steel mesh side panels + natural walnut wood front slat panel)",
    specs: "Micro-ATX Small Form Factor (26.3L). Note: Max GPU length depends on front ATX PSU mounting slot height and PSU cable clearance; MockEgg public support cannot verify 3D millimeter GPU + PSU combinations.",
  },
  "ME-CASE-H5RGB": {
    title: "NZXT H5 Flow RGB White ATX Mid-Tower (ME-CASE-H5RGB)",
    back: "/catalog/cases",
    price: "$99",
    stock: "In Stock — Ships Today",
    lighting: "Includes 2x F140 RGB Core fans",
    specs: "ATX Mid-Tower, tempered glass side panel.",
  },
  "ME-PSU-750E": {
    title: "Corsair RM750e 750W 80+ Gold Fully Modular ATX 3.0 (ME-PSU-750E)",
    back: "/catalog/psus",
    price: "$99",
    stock: "In Stock — Ships Today",
    lighting: "Zero RGB (Matte Black casing)",
    specs: "750W Cybenetics Gold, ATX 3.0 & PCIe 5.0 compliant, compact 140mm depth.",
  },
  "ME-PSU-850SFX": {
    title: "Cooler Master V850 SFX Gold White 850W Modular (ME-PSU-850SFX)",
    back: "/catalog/psus",
    price: "$159",
    stock: "In Stock — Ships Today",
    lighting: "Zero RGB (White casing + white braided cables)",
    specs: "850W SFX form factor (includes SFX-to-ATX bracket), 100mm depth.",
  },
  "ME-SSD-1TB": {
    title: "WD Black SN770 1TB PCIe Gen4 NVMe M.2 2280 SSD (ME-SSD-1TB)",
    back: "/catalog/storage-os",
    price: "$75",
    stock: "In Stock — Ships Today",
    lighting: "Zero RGB",
    specs: "Up to 5,150 MB/s read, M.2 2280.",
  },
  "ME-OS-W11": {
    title: "Microsoft Windows 11 Home 64-bit OEM DVD/Key (ME-OS-W11)",
    back: "/catalog/storage-os",
    price: "$119",
    stock: "In Stock — Ships Today",
    lighting: "N/A",
    specs: "64-bit OEM license.",
  },
};

function renderProductPage(origin, sku) {
  const item = PRODUCT_SPECS[sku];
  if (!item) return null;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — ${item.title}</title></head>
<body>
  <h1>${item.title}</h1>
  <p><a href="${origin}${item.back}">← Back to Category Listing (${origin}${item.back})</a> | <a href="${origin}/">MockEgg Home (${origin}/)</a></p>
  <table border="1" cellpadding="6">
    <tr><th>Attribute</th><th>Details</th></tr>
    <tr><td><strong>SKU</strong></td><td>${sku}</td></tr>
    <tr><td><strong>Public Retail Price</strong></td><td>${item.price}</td></tr>
    <tr><td><strong>Warehouse Stock Status</strong></td><td>${item.stock}</td></tr>
    <tr><td><strong>RGB / LED Lighting</strong></td><td>${item.lighting}</td></tr>
    <tr><td><strong>Technical Specifications</strong></td><td>${item.specs}</td></tr>
  </table>
</body>
</html>`;
}

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
    const origin = url.origin;
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

    // 3. MockEgg 3-tier multi-page HTML catalog
    if (url.pathname.startsWith("/product/")) {
      await new Promise((r) => setTimeout(r, 1500));
      const sku = decodeURIComponent(url.pathname.slice("/product/".length));
      const prodHtml = renderProductPage(origin, sku);
      if (prodHtml) {
        return new Response(prodHtml, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
    }

    const subpageRenderers = {
      "/departments/prebuilts": renderDeptPrebuilts,
      "/prebuilts": renderDeptPrebuilts,
      "/departments/core": renderDeptCore,
      "/cpus-mobos": renderDeptCore,
      "/departments/gpus": renderDeptGpusPage1,
      "/gpus": renderDeptGpusPage1,
      "/departments/gpus/page-2": renderDeptGpusPage2,
      "/departments/gpus/page-3": renderDeptGpusPage3,
      "/departments/chassis-power": renderDeptChassisPower,
      "/cases-psus": renderDeptChassisPower,
      "/catalog/cpus": renderCatalogCpus,
      "/catalog/coolers": renderCatalogCoolers,
      "/catalog/motherboards": renderCatalogMobos,
      "/catalog/memory": renderCatalogMemory,
      "/catalog/cases": renderCatalogCases,
      "/catalog/psus": renderCatalogPsus,
      "/catalog/storage-os": renderCatalogStorageOs,
    };

    if (subpageRenderers[url.pathname]) {
      await new Promise((r) => setTimeout(r, 1500));
      return new Response(subpageRenderers[url.pathname](origin), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Homepage (`/`) returns immediately so Window 2 (With A2A) triggers discovery right away
    return new Response(getMockEggHomeHtml(origin, getPartnerUrl(url)), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
