#!/usr/bin/env python3
"""Zero-dependency stdio MCP server for RigFoundry (PC Build-a-Bot)."""
import json
import sys

PARTS_DB = {
    "cpu_7600": {"name": "AMD Ryzen 5 7600", "socket": "AM5", "price": 185},
    "mobo_b650m": {
        "name": "ASRock B650M Pro RS WiFi (White/Silver)",
        "socket": "AM5",
        "form": "mATX",
        "price": 135,
    },
    "ram_32_white": {
        "name": "TEAMGROUP T-Create Expert 32GB DDR5-6000 CL30 White (Zero RGB)",
        "price": 85,
    },
    "gpu_7800xt_white": {
        "name": "Sapphire PURE Radeon RX 7800 XT 16GB Arctic White (Private VIP Deal)",
        "length_mm": 320,
        "price": 449,
        "stock": "In Stock",
    },
    "gpu_7900gre_backorder": {
        "name": "XFX Radeon RX 7900 GRE 16GB",
        "length_mm": 335,
        "price": 479,
        "stock": "2-Week Backorder",
    },
    "case_lianli_wood": {
        "name": "Lian Li DAN A3-mATX White + Walnut Wood Front Panel",
        "form": "mATX",
        "max_gpu_mm": 334,
        "price": 85,
    },
    "psu_750": {
        "name": "Corsair RM750e ATX 3.0 (With VIP Bundle Discount)",
        "watts": 750,
        "price": 60,
    },
}


def get_private_inventory_and_offers() -> dict:
  return {
      "inventory": PARTS_DB,
      "unadvertised_offers": [
          "VIP-WHITE-WALNUT-BUNDLE: Sapphire PURE RX 7800 XT 16GB White + Lian Li DAN A3 Wood Case + Ryzen 7600 + 32GB DDR5 + 750W PSU for $999 total (requires reusing customer's existing SSD & OS).",
          "WAIT-2-WEEKS-OFFER: Upgrade to RX 7900 GRE for +$30 if customer waits 2 weeks (Note: 335mm length FAILS clearance in Lian Li A3 334mm max!).",
          "FINANCING-OFFER: 0% APR for 12 months if customer wants to increase budget to $1,250.",
      ],
  }


def verify_build_compatibility(part_ids: list) -> dict:
  selected = [PARTS_DB[k] for k in part_ids if k in PARTS_DB]
  gpu = next((p for p in selected if "length_mm" in p), None)
  case = next((p for p in selected if "max_gpu_mm" in p), None)
  clearance_ok = True
  notes = ["Socket AM5 verified", "750W ATX 3.0 headroom verified"]
  if gpu and case:
    if gpu["length_mm"] <= case["max_gpu_mm"]:
      notes.append(
          f"CLEARANCE PASS: {gpu['name']} ({gpu['length_mm']}mm) fits inside"
          f" {case['name']} (max {case['max_gpu_mm']}mm)."
      )
    else:
      clearance_ok = False
      notes.append(
          f"CLEARANCE FAIL: {gpu['length_mm']}mm exceeds {case['max_gpu_mm']}mm."
      )
  return {
      "compatible": clearance_ok,
      "notes": notes,
      "total_price_usd": sum(p["price"] for p in selected),
      "parts": [f"{p['name']} (${p['price']})" for p in selected],
      "quote_id": "RF-VIP-999",
  }


TOOLS = [
    {
        "name": "get_private_inventory_and_offers",
        "description": "Returns private warehouse stock, unadvertised bundle deals, and financing offers.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "verify_build_compatibility",
        "description": "Verifies socket, form-factor, wattage, and exact millimeter GPU-to-case clearance.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "part_ids": {"type": "array", "items": {"type": "string"}}
            },
            "required": ["part_ids"],
        },
    },
]


def main():
  for line in sys.stdin:
    line = line.strip()
    if not line:
      continue
    req = json.loads(line)
    method = req.get("method")
    msg_id = req.get("id")
    if method == "initialize":
      resp = {
          "jsonrpc": "2.0",
          "id": msg_id,
          "result": {
              "protocolVersion": "2024-11-05",
              "capabilities": {"tools": {}},
              "serverInfo": {"name": "rigfoundry-inventory", "version": "1.0.0"},
          },
      }
      sys.stdout.write(json.dumps(resp) + "\n")
      sys.stdout.flush()
    elif method == "tools/list":
      resp = {"jsonrpc": "2.0", "id": msg_id, "result": {"tools": TOOLS}}
      sys.stdout.write(json.dumps(resp) + "\n")
      sys.stdout.flush()
    elif method == "tools/call":
      params = req.get("params", {})
      name = params.get("name")
      args = params.get("arguments", {})
      if name == "get_private_inventory_and_offers":
        out = get_private_inventory_and_offers()
      elif name == "verify_build_compatibility":
        out = verify_build_compatibility(args.get("part_ids", []))
      else:
        out = {"error": f"unknown tool {name}"}
      resp = {
          "jsonrpc": "2.0",
          "id": msg_id,
          "result": {
              "content": [{"type": "text", "text": json.dumps(out, indent=2)}]
          },
      }
      sys.stdout.write(json.dumps(resp) + "\n")
      sys.stdout.flush()


if __name__ == "__main__":
  main()
