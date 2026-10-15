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

const vpAgent = createA2AWorkerAgent({
  cardTemplate: VP_CARD_TEMPLATE,
  defaultUpstreamUrl: "",
});

const alexAgent = createA2AWorkerAgent({
  cardTemplate: ALEX_CARD_TEMPLATE,
  defaultUpstreamUrl: "",
});

function detectRole(url) {
  if (url.hostname.startsWith("alex") || url.searchParams.get("role") === "alex") {
    return "alex";
  }
  return "vp";
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const role = detectRole(url);

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
