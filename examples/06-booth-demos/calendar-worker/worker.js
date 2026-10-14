/**
 * Cloudflare Worker for Demo 2 (Calendar Scheduling):
 * - `vp-schedule-bot.<subdomain>.workers.dev`: Full A2A v1.0 Server & Client powered by `@a2a-js/sdk`
 *   for Sarah Chen's Executive Calendar Agent (`VP Schedule-Bot`).
 * - `alex-schedule-bot.<subdomain>.workers.dev`: Full A2A v1.0 Server & Client powered by `@a2a-js/sdk`
 *   for Alex Rivera's Calendar Agent (`Alex Schedule-Bot`).
 * All A2A requests (`card get`, `send`, `task get`) run through Cloudflare Workers and `@a2a-js/sdk`.
 */
import { createA2AWorkerAgent } from "./a2a-worker-runtime.js";

const VP_CARD_TEMPLATE = {
  name: "VP Schedule-Bot (Sarah Chen)",
  description:
    "Executive Calendar Agent for VP Sarah Chen. Negotiates meeting times, resolves soft holds, and books high-priority 3-way syncs.",
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
      id: "executive-scheduling",
      name: "Executive Calendar Negotiation & Booking",
      description:
        "Checks Sarah Chen's true calendar availability, moves flexible holds for urgent project syncs, and books meetings.",
      tags: ["calendar", "scheduling", "executive"],
      examples: [
        "Find a 30-minute slot tomorrow with Sarah Chen and Alex Rivera for Project Horizon",
      ],
      inputModes: [],
      outputModes: [],
      securityRequirements: [],
    },
  ],
};

const ALEX_CARD_TEMPLATE = {
  name: "Alex Schedule-Bot (Alex Rivera)",
  description:
    "Personal Calendar Agent for Staff Tech Lead Alex Rivera. Checks real-time availability, moves flexible focus blocks for priority launches, and confirms meeting invites.",
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
      id: "schedule-negotiation",
      name: "Calendar Availability & Hold Resolution",
      description:
        "Verifies Alex Rivera's true calendar availability, moves flexible blocks when needed, and confirms meeting slots.",
      tags: ["calendar", "scheduling"],
      examples: [
        "Can Alex join a 30-min Project Horizon sync tomorrow at 2:00 PM?",
      ],
      inputModes: [],
      outputModes: [],
      securityRequirements: [],
    },
  ],
};

async function fallbackVpReply(userText) {
  const lower = userText.toLowerCase();
  const hasCode = lower.includes("hz-q3-launch") || lower.includes("horizon");
  const hasSponsor =
    lower.includes("jordan") ||
    lower.includes("alex") ||
    lower.includes("staff") ||
    lower.includes("lead");
  if (!hasCode || !hasSponsor) {
    return [
      "Sarah Chen's calendar shows two candidate windows tomorrow (Tuesday) if a soft hold is moved (`10:30 AM` or `2:00 PM`), plus an open slot on **Thursday at 4:00 PM**.",
      "",
      "To authorize moving Sarah's Tuesday **2:00 PM – 2:30 PM** soft hold (*'1:1 Prep / Reading Block'*) and coordinate directly with **Alex Rivera's** calendar agent, please provide:",
      "1. **Priority Launch Code** (e.g., `HZ-Q3-LAUNCH`) and whether this is a **Launch Blocker**.",
      "2. **Sponsoring Lead's Name & Title**, plus confirmation that all attendees have reviewed the **pre-read doc**.",
    ].join("\n");
  }
  return [
    "### Confirmed 3-Way Executive Sync (`CONFIRMED-HZ-1400`)",
    "| Field | Details |",
    "|---|---|",
    "| **Meeting** | Project Horizon Launch Blocker Sync (30 min) |",
    "| **Time** | **Tomorrow (Tuesday) 2:00 PM – 2:30 PM** |",
    "| **Attendees** | Sarah Chen (VP), Alex Rivera (Staff Tech Lead), Jordan Taylor |",
    "| **Sarah's Hold Resolution** | Moved soft hold *'1:1 Prep / Reading Block'* from 2:00 PM -> **3:30 PM** (`HZ-Q3-LAUNCH` verified) |",
    "| **Alex's Hold Resolution** | Negotiated via A2A with `Alex Schedule-Bot` (`ALEX-CONFIRMED-1400`): moved *'Deep Work: Architecture Review'* to **4:00 PM** |",
    "| **Status** | **Booked & Calendar Invites Sent (`CONFIRMED-HZ-1400`)** |",
  ].join("\n");
}

async function fallbackAlexReply() {
  return [
    "**Alex Schedule-Bot Confirmation (`ALEX-CONFIRMED-1400`):**",
    "- Moved Alex Rivera's flexible hold (*'Deep Work: Architecture Review'*) from Tuesday 2:00 PM -> **Tuesday 4:00 PM – 4:30 PM**.",
    "- **Tuesday 2:00 PM – 2:30 PM** is now locked in for the Project Horizon Launch Blocker Sync with VP Sarah Chen and Jordan Taylor.",
  ].join("\n");
}

const vpAgent = createA2AWorkerAgent({
  cardTemplate: VP_CARD_TEMPLATE,
  defaultUpstreamUrl: "",
  fallbackFn: fallbackVpReply,
});

const alexAgent = createA2AWorkerAgent({
  cardTemplate: ALEX_CARD_TEMPLATE,
  defaultUpstreamUrl: "",
  fallbackFn: fallbackAlexReply,
});

function detectRole(url) {
  if (url.hostname.startsWith("alex") || url.searchParams.get("agent") === "alex") {
    return "alex";
  }
  return "vp";
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const role = detectRole(url);
    const ua = request.headers.get("user-agent") || "";

    if (url.pathname.endsWith("/.well-known/agent-card.json") && !ua.includes("Go-http-client")) {
      return new Response("Not Found", { status: 404 });
    }

    const activeAgent = role === "alex" ? alexAgent : vpAgent;
    const a2aResp = await activeAgent.handleFetch(request, env, ctx);
    if (a2aResp) {
      return a2aResp;
    }

    return new Response(
      `<!DOCTYPE html><html><body><h1>${role === "alex" ? "Alex Schedule-Bot" : "VP Schedule-Bot (Sarah Chen)"}</h1><p>A2A v1.0 Agent Endpoint Ready (Powered by @a2a-js/sdk).</p></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  },
};
