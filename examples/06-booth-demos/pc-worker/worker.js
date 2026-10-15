/**
 * Cloudflare Worker for Demo 1 (PC Build):
 * - `mockegg.<subdomain>.workers.dev`: Public 3-tier multi-page store (Department Hubs -> Category Pages -> Product Spec/Stock Pages).
 * - `rigfoundry.<subdomain>.workers.dev`: Full A2A v1.0 Server & Client powered by `@a2a-js/sdk`.
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
  <h2>Shop by Department</h2>
  <p>Select a department below to browse component sub-categories, paginated listings, and individual product specification &amp; live inventory pages:</p>
  <nav>
    <ul>
      <li><a href="/departments/prebuilts">Pre-Built Gaming Desktops Department</a> — Ready-to-ship gaming towers ($949 – $1,229)</li>
      <li><a href="/departments/core">Core Components Department</a> — Processors (CPUs), CPU Coolers, Motherboards &amp; DDR5 Memory</li>
      <li><a href="/departments/gpus">Graphics Cards (GPUs) Department</a> — Flagship 4K &amp; Midrange 1440p/1080p GPUs (Multi-page catalog)</li>
      <li><a href="/departments/chassis-power">Enclosures, Power &amp; Storage Department</a> — PC Cases, ATX 3.0 Power Supplies, NVMe SSDs &amp; OS</li>
    </ul>
  </nav>
</body>
</html>`;
}

const DEPT_PREBUILTS_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Pre-Built Gaming Desktops Department</title></head>
<body>
  <h1>MockEgg — Pre-Built Gaming Desktops</h1>
  <p><a href="/">← Back to MockEgg Home</a></p>
  <p><em>Click each SKU to view full component specifications, case lighting details, and live warehouse stock status.</em></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>System Name</th><th>Summary</th><th>Price</th><th>Spec &amp; Stock Page</th></tr>
    <tr>
      <td>ME-PB-101</td>
      <td>MockEgg CyberPrism Tower</td>
      <td>Ryzen 5 7600 / Radeon RX 7700 XT / 16GB DDR5 / 1TB NVMe</td>
      <td>$999</td>
      <td><a href="/product/ME-PB-101">View Full Specs &amp; Stock</a></td>
    </tr>
    <tr>
      <td>ME-PB-102</td>
      <td>MockEgg NeonBlade System</td>
      <td>Core i5-13400F / GeForce RTX 4060 / 16GB DDR5 / 1TB NVMe</td>
      <td>$949</td>
      <td><a href="/product/ME-PB-102">View Full Specs &amp; Stock</a></td>
    </tr>
    <tr>
      <td>ME-PB-103</td>
      <td>MockEgg Creator &amp; Gaming Pro 1440p</td>
      <td>Ryzen 5 7600 / Radeon RX 7800 XT / 32GB DDR5 / 1TB NVMe</td>
      <td>$1,229</td>
      <td><a href="/product/ME-PB-103">View Full Specs &amp; Stock</a></td>
    </tr>
  </table>
</body>
</html>`;

const DEPT_CORE_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Core Components Department</title></head>
<body>
  <h1>MockEgg — Core Components Department</h1>
  <p><a href="/">← Back to MockEgg Home</a></p>
  <p>Browse individual component categories below to view models, pricing, and product specification sheets:</p>
  <ul>
    <li><a href="/catalog/cpus">Processors (CPUs)</a> — AMD Socket AM5 &amp; Intel LGA1700 Processors</li>
    <li><a href="/catalog/coolers">CPU Coolers</a> — Air &amp; Liquid CPU Coolers (with height/RGB specs)</li>
    <li><a href="/catalog/motherboards">Motherboards</a> — mATX &amp; ATX Motherboards</li>
    <li><a href="/catalog/memory">DDR5 Memory</a> — 32GB &amp; 64GB DDR5 RAM Kits</li>
  </ul>
</body>
</html>`;

const DEPT_GPUS_PAGE1_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Graphics Cards (Page 1 of 2: Enthusiast 4K Series)</title></head>
<body>
  <h1>MockEgg — Graphics Cards (Page 1 of 2: Enthusiast 4K Series)</h1>
  <p><a href="/">← Back to MockEgg Home</a> | <strong><a href="/departments/gpus/page-2">Next Page: Midrange 1440p &amp; 1080p GPUs ($389–$549) →</a></strong></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Model</th><th>VRAM</th><th>Retail Price</th><th>Details</th></tr>
    <tr><td>ME-GPU-4090</td><td>ASUS ROG Strix GeForce RTX 4090 OC</td><td>24GB GDDR6X</td><td>$1,799</td><td><a href="/product/ME-GPU-4090">Specs &amp; Stock</a></td></tr>
    <tr><td>ME-GPU-4080S</td><td>MSI Gaming X Slim GeForce RTX 4080 Super</td><td>16GB GDDR6X</td><td>$1,049</td><td><a href="/product/ME-GPU-4080S">Specs &amp; Stock</a></td></tr>
    <tr><td>ME-GPU-7900XTX</td><td>Sapphire NITRO+ Radeon RX 7900 XTX</td><td>24GB GDDR6</td><td>$949</td><td><a href="/product/ME-GPU-7900XTX">Specs &amp; Stock</a></td></tr>
  </table>
  <p>Looking for GPUs under $600 for a $1,000 build? <a href="/departments/gpus/page-2">Go to Page 2: Midrange 1440p &amp; 1080p Graphics Cards →</a></p>
</body>
</html>`;

const DEPT_GPUS_PAGE2_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Graphics Cards (Page 2 of 2: Midrange 1440p & 1080p Series)</title></head>
<body>
  <h1>MockEgg — Graphics Cards (Page 2 of 2: Midrange 1440p &amp; 1080p Series)</h1>
  <p><a href="/departments/gpus">← Previous Page (4K GPUs)</a> | <a href="/">MockEgg Home</a></p>
  <p><em>Click a product link to check live warehouse stock status, card length (mm), and RGB lighting details.</em></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Model</th><th>VRAM</th><th>Retail Price</th><th>Spec &amp; Stock Page</th></tr>
    <tr><td>ME-GPU-7900GRE</td><td>XFX Radeon RX 7900 GRE Matte Black</td><td>16GB GDDR6</td><td>$549</td><td><a href="/product/ME-GPU-7900GRE">View Specs, Length &amp; Stock</a></td></tr>
    <tr><td>ME-GPU-7800W</td><td>Sapphire PURE Radeon RX 7800 XT Arctic White</td><td>16GB GDDR6</td><td>$519</td><td><a href="/product/ME-GPU-7800W">View Specs, Length &amp; Stock</a></td></tr>
    <tr><td>ME-GPU-7700XT</td><td>PowerColor Fighter Radeon RX 7700 XT</td><td>12GB GDDR6</td><td>$419</td><td><a href="/product/ME-GPU-7700XT">View Specs, Length &amp; Stock</a></td></tr>
    <tr><td>ME-GPU-4060TI</td><td>MSI Ventus 2X Black GeForce RTX 4060 Ti</td><td>8GB GDDR6</td><td>$389</td><td><a href="/product/ME-GPU-4060TI">View Specs, Length &amp; Stock</a></td></tr>
  </table>
</body>
</html>`;

const DEPT_CHASSIS_POWER_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Enclosures, Power & Storage Department</title></head>
<body>
  <h1>MockEgg — Enclosures, Power &amp; Storage Department</h1>
  <p><a href="/">← Back to MockEgg Home</a></p>
  <p>Select a category below to browse cases, power supplies, storage drives, and operating systems:</p>
  <ul>
    <li><a href="/catalog/cases">PC Cases &amp; SFF Enclosures</a> — mATX Wood/Minimalist &amp; ATX Mid-Tower Cases</li>
    <li><a href="/catalog/psus">Power Supplies (PSUs)</a> — ATX 3.0 &amp; SFX Modular Power Supplies</li>
    <li><a href="/catalog/storage-os">NVMe SSD Storage &amp; Operating Systems</a> — PCIe Gen4 M.2 SSDs &amp; Windows 11 OEM</li>
  </ul>
</body>
</html>`;

const CATALOG_CPUS_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Processors (CPUs)</title></head>
<body>
  <h1>MockEgg — Processors (CPUs)</h1>
  <p><a href="/departments/core">← Back to Core Components Department</a></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Model</th><th>Socket</th><th>Retail Price</th><th>Spec &amp; Stock Page</th></tr>
    <tr><td>ME-CPU-7600</td><td>AMD Ryzen 5 7600 6-Core / 12-Thread</td><td>AM5</td><td>$195</td><td><a href="/product/ME-CPU-7600">View Cooler Info &amp; Stock</a></td></tr>
    <tr><td>ME-CPU-7700X</td><td>AMD Ryzen 7 7700X 8-Core / 16-Thread</td><td>AM5</td><td>$289</td><td><a href="/product/ME-CPU-7700X">View Cooler Info &amp; Stock</a></td></tr>
  </table>
</body>
</html>`;

const CATALOG_COOLERS_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — CPU Coolers</title></head>
<body>
  <h1>MockEgg — CPU Coolers</h1>
  <p><a href="/departments/core">← Back to Core Components Department</a></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Model</th><th>Type</th><th>Retail Price</th><th>Spec &amp; Stock Page</th></tr>
    <tr><td>ME-COOL-PA120</td><td>Thermalright Peerless Assassin 120 SE Matte Black</td><td>Dual-Tower Air</td><td>$35</td><td><a href="/product/ME-COOL-PA120">View Height &amp; RGB Specs</a></td></tr>
    <tr><td>ME-COOL-AIO240</td><td>NZXT Kraken 240 RGB White</td><td>240mm AIO Liquid</td><td>$139</td><td><a href="/product/ME-COOL-AIO240">View Height &amp; RGB Specs</a></td></tr>
  </table>
</body>
</html>`;

const CATALOG_MOBOS_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Motherboards</title></head>
<body>
  <h1>MockEgg — Motherboards</h1>
  <p><a href="/departments/core">← Back to Core Components Department</a></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Model</th><th>Form Factor</th><th>Retail Price</th><th>Spec &amp; Stock Page</th></tr>
    <tr><td>ME-MB-B650M</td><td>ASRock B650M Pro RS WiFi (White/Silver)</td><td>mATX (AM5)</td><td>$149</td><td><a href="/product/ME-MB-B650M">View Specs &amp; Stock</a></td></tr>
    <tr><td>ME-MB-B650A</td><td>ASUS TUF Gaming B650-PLUS WiFi</td><td>ATX (AM5)</td><td>$189</td><td><a href="/product/ME-MB-B650A">View Specs &amp; Stock</a></td></tr>
  </table>
</body>
</html>`;

const CATALOG_MEMORY_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — DDR5 Memory</title></head>
<body>
  <h1>MockEgg — DDR5 Memory Kits</h1>
  <p><a href="/departments/core">← Back to Core Components Department</a></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Model</th><th>Capacity &amp; Speed</th><th>Retail Price</th><th>Spec &amp; Stock Page</th></tr>
    <tr><td>ME-RAM-32W</td><td>TEAMGROUP T-Create Expert 32GB (2x16GB) White</td><td>DDR5-6000 CL30</td><td>$95</td><td><a href="/product/ME-RAM-32W">View RGB &amp; Stock</a></td></tr>
    <tr><td>ME-RAM-32RGB</td><td>G.Skill Trident Z5 RGB 32GB (2x16GB) Silver</td><td>DDR5-6000 CL30</td><td>$115</td><td><a href="/product/ME-RAM-32RGB">View RGB &amp; Stock</a></td></tr>
    <tr><td>ME-RAM-64B</td><td>Corsair Vengeance 64GB (2x32GB) Matte Black</td><td>DDR5-6000 CL30</td><td>$195</td><td><a href="/product/ME-RAM-64B">View RGB &amp; Stock</a></td></tr>
  </table>
</body>
</html>`;

const CATALOG_CASES_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — PC Cases & SFF Enclosures</title></head>
<body>
  <h1>MockEgg — PC Cases &amp; SFF Enclosures</h1>
  <p><a href="/departments/chassis-power">← Back to Enclosures, Power &amp; Storage</a></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Model</th><th>Form Factor</th><th>Retail Price</th><th>Spec &amp; Clearance Page</th></tr>
    <tr><td>ME-CASE-A3W</td><td>Lian Li DAN A3-mATX Wood Edition (White + Walnut Front)</td><td>mATX SFF</td><td>$89</td><td><a href="/product/ME-CASE-A3W">View Clearance &amp; Stock</a></td></tr>
    <tr><td>ME-CASE-H5RGB</td><td>NZXT H5 Flow RGB White</td><td>ATX Mid-Tower</td><td>$99</td><td><a href="/product/ME-CASE-H5RGB">View Clearance &amp; Stock</a></td></tr>
  </table>
</body>
</html>`;

const CATALOG_PSUS_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — Power Supplies (PSUs)</title></head>
<body>
  <h1>MockEgg — Power Supplies (PSUs)</h1>
  <p><a href="/departments/chassis-power">← Back to Enclosures, Power &amp; Storage</a></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Model</th><th>Wattage</th><th>Retail Price</th><th>Spec &amp; Stock Page</th></tr>
    <tr><td>ME-PSU-750E</td><td>Corsair RM750e 750W 80+ Gold ATX 3.0</td><td>750W Modular</td><td>$99</td><td><a href="/product/ME-PSU-750E">View Length &amp; Stock</a></td></tr>
    <tr><td>ME-PSU-850SFX</td><td>Cooler Master V850 SFX Gold White</td><td>850W SFX</td><td>$159</td><td><a href="/product/ME-PSU-850SFX">View Length &amp; Stock</a></td></tr>
  </table>
</body>
</html>`;

const CATALOG_STORAGE_OS_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — NVMe SSD Storage & OS</title></head>
<body>
  <h1>MockEgg — NVMe SSD Storage &amp; Operating Systems</h1>
  <p><a href="/departments/chassis-power">← Back to Enclosures, Power &amp; Storage</a></p>
  <table border="1" cellpadding="6">
    <tr><th>SKU</th><th>Category</th><th>Model</th><th>Retail Price</th><th>Spec &amp; Stock Page</th></tr>
    <tr><td>ME-SSD-1TB</td><td>NVMe SSD</td><td>WD Black SN770 1TB PCIe Gen4 M.2</td><td>$75</td><td><a href="/product/ME-SSD-1TB">View Specs &amp; Stock</a></td></tr>
    <tr><td>ME-OS-W11</td><td>Operating System</td><td>Microsoft Windows 11 Home 64-bit OEM</td><td>$119</td><td><a href="/product/ME-OS-W11">View Specs &amp; Stock</a></td></tr>
  </table>
</body>
</html>`;

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
    back: "/departments/gpus/page-2",
    price: "$419",
    stock: "In Stock — Ships Today",
    lighting: "Zero RGB (Matte Black shroud, no LEDs)",
    specs: "12GB GDDR6, 192-bit, 290mm length.",
  },
  "ME-GPU-4060TI": {
    title: "MSI Ventus 2X Black GeForce RTX 4060 Ti 8GB (ME-GPU-4060TI)",
    back: "/departments/gpus/page-2",
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

function renderProductPage(sku) {
  const item = PRODUCT_SPECS[sku];
  if (!item) return null;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>MockEgg — ${item.title}</title></head>
<body>
  <h1>${item.title}</h1>
  <p><a href="${item.back}">← Back to Category Listing</a> | <a href="/">MockEgg Home</a></p>
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

const SUBPAGE_ROUTES = {
  "/departments/prebuilts": DEPT_PREBUILTS_HTML,
  "/prebuilts": DEPT_PREBUILTS_HTML,
  "/departments/core": DEPT_CORE_HTML,
  "/cpus-mobos": DEPT_CORE_HTML,
  "/departments/gpus": DEPT_GPUS_PAGE1_HTML,
  "/gpus": DEPT_GPUS_PAGE1_HTML,
  "/departments/gpus/page-2": DEPT_GPUS_PAGE2_HTML,
  "/departments/chassis-power": DEPT_CHASSIS_POWER_HTML,
  "/cases-psus": DEPT_CHASSIS_POWER_HTML,
  "/catalog/cpus": CATALOG_CPUS_HTML,
  "/catalog/coolers": CATALOG_COOLERS_HTML,
  "/catalog/motherboards": CATALOG_MOBOS_HTML,
  "/catalog/memory": CATALOG_MEMORY_HTML,
  "/catalog/cases": CATALOG_CASES_HTML,
  "/catalog/psus": CATALOG_PSUS_HTML,
  "/catalog/storage-os": CATALOG_STORAGE_OS_HTML,
};

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

    // 3. MockEgg 3-tier multi-page HTML catalog
    if (url.pathname.startsWith("/product/")) {
      await new Promise((r) => setTimeout(r, 900));
      const sku = decodeURIComponent(url.pathname.slice("/product/".length));
      const prodHtml = renderProductPage(sku);
      if (prodHtml) {
        return new Response(prodHtml, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
    }

    if (SUBPAGE_ROUTES[url.pathname]) {
      await new Promise((r) => setTimeout(r, 900));
      return new Response(SUBPAGE_ROUTES[url.pathname], {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Homepage (`/`) returns immediately so Window 2 (With A2A) triggers discovery right away
    return new Response(getMockEggHomeHtml(getPartnerUrl(url)), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
