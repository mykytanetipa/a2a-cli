/**
 * Cloudflare Worker for Demo 2 (Calendar Scheduling):
 * - `vp-sarah.<subdomain>.workers.dev`: Public VP profile page with NO A2A Agent Card (404).
 * - `vp-schedule-bot.<subdomain>.workers.dev`: Full A2A v1.0 Server & Client powered by `@a2a-js/sdk`
 *   for VP Yaroslav's Executive Calendar Agent (`VP Schedule-Bot`).
 * - `alex-schedule-bot.<subdomain>.workers.dev`: Full A2A v1.0 Server & Client powered by `@a2a-js/sdk`
 *   for Director Alex's Calendar Agent (`Alex Schedule-Bot`).
 */
import { createA2AWorkerAgent } from "./a2a-worker-runtime.js";

const VP_CARD_TEMPLATE = {
  name: "VP Schedule-Bot",
  description:
    "Executive scheduling agent for VP Yaroslav. Proposes 1:1 slots, negotiates movable internal conflicts via multi-hop A2A with other attendees' agents, and sends calendar invites.",
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
      id: "schedule-1on1",
      name: "VP 1:1 Slot Negotiation & Multi-Hop Conflict Resolution",
      description:
        "Checks VP Yaroslav's calendar availability, coordinates with other executives' A2A agents to move internal conflicts, and books confirmed 1:1 meetings.",
      tags: ["calendar", "scheduling", "1on1"],
      examples: ["Schedule a 30-minute 1:1 with my VP this week"],
      inputModes: [],
      outputModes: [],
      securityRequirements: [],
    },
  ],
};

const ALEX_CARD_TEMPLATE = {
  name: "Alex Schedule-Bot (Director of Platform)",
  description:
    "Calendar scheduling agent for Director Alex. Checks availability and moves movable internal 1:1 meetings when requested by other scheduling agents.",
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
      id: "reschedule-internal-sync",
      name: "Internal Sync Rescheduler",
      description:
        "Checks Director Alex's calendar for open slots and moves movable internal syncs.",
      tags: ["calendar", "scheduling", "reschedule"],
      examples: [
        "Can we move Yaroslav & Alex's Weekly Sync from Thursday 15:30-16:00 to Friday 11:00-11:30?",
      ],
      inputModes: [],
      outputModes: [],
      securityRequirements: [],
    },
  ],
};

async function fallbackVpReply(userText) {
  const lower = userText.toLowerCase();
  if (!lower.includes("15:30") && !lower.includes("3:30") && !lower.includes("none")) {
    return [
      "Here are VP Yaroslav's 3 open 30-minute slots this week:",
      "- **Tuesday 10:00–10:30**",
      "- **Wednesday 14:00–14:30**",
      "- **Thursday 11:00–11:30**",
      "Which of these works for your calendar?",
    ].join("\n");
  }
  return [
    "I contacted Director Alex's A2A agent (`Alex Schedule-Bot`) and moved their Thursday 15:30–16:00 Weekly Sync to Friday 11:00–11:30 (`CAL-RESCHED-409`).",
    "- **Confirmed Slot:** **Thursday 15:30–16:00** with VP Yaroslav",
    "- **Calendar Invite ID:** **`CAL-INV-8842`**",
  ].join("\n");
}

async function fallbackAlexReply() {
  return [
    "Friday 11:00–11:30 is free on Director Alex's calendar.",
    "Moved the Weekly Sync with VP Yaroslav from Thursday 15:30–16:00 to Friday 11:00–11:30 (`CAL-RESCHED-409`). Thursday 15:30–16:00 is now open.",
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
  if (url.hostname.startsWith("vp-sarah") || url.searchParams.get("role") === "sarah") {
    return "sarah";
  }
  if (url.hostname.startsWith("alex") || url.searchParams.get("role") === "alex") {
    return "alex";
  }
  return "vp";
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const role = detectRole(url);
    const ua = request.headers.get("user-agent") || "";

    // Sarah Chen's profile (`vp-sarah`) has NO A2A agent card (returns 404)
    if (role === "sarah") {
      if (url.pathname.endsWith("/.well-known/agent-card.json")) {
        return new Response("Not Found", { status: 404 });
      }
      return new Response(
        `<!DOCTYPE html><html><body><h1>Sarah Chen — VP of Product</h1><p>Direct Calendar Access: 403 Forbidden. Please email Executive Assistant (ea-sarah@0-a.org) to coordinate 1:1 scheduling.</p></body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const activeAgent = role === "alex" ? alexAgent : vpAgent;
    const a2aResp = await activeAgent.handleFetch(request, env, ctx);
    if (a2aResp) {
      return a2aResp;
    }

    return new Response(
      `<!DOCTYPE html><html><body><h1>${role === "alex" ? "Alex Schedule-Bot" : "VP Schedule-Bot (Yaroslav)"}</h1><p>A2A v1.0 Agent Endpoint Ready (Powered by @a2a-js/sdk).</p></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  },
};
