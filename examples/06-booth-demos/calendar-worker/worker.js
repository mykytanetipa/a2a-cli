/**
 * Cloudflare Worker for A2A Booth Demo 2 (Calendar Scenario):
 *  - Worker 1 (`vp-schedule-bot.<you>.workers.dev`):
 *      Serves Yaroslav's Corporate Profile HTML at `GET /` and `VP Schedule-Bot` Agent Card at
 *      `GET /.well-known/agent-card.json` with `supportedInterfaces[0].url = "http://localhost:8082"`,
 *      routing `a2a send` directly to your local `a2a server` (`claude -p`) in Window 3!
 *  - Worker 2 (`alex-schedule-bot.<you>.workers.dev`):
 *      Serves Director Alex's `Alex Schedule-Bot` Agent Card at `GET /.well-known/agent-card.json`
 *      with `supportedInterfaces[0].url = "http://localhost:8084"` for Multi-Hop A2A rescheduling!
 *  - Worker 3 (`vp-sarah.<you>.workers.dev`):
 *      No-A2A executive profile — returns 404 on `/.well-known/agent-card.json`.
 */

function detectRole(url) {
  const host = url.hostname.toLowerCase();
  if (host.includes("alex-schedule-bot") || url.pathname.startsWith("/alex")) {
    return "alex";
  }
  if (host.includes("vp-sarah") || url.pathname.startsWith("/sarah")) {
    return "sarah";
  }
  return "vp";
}

const VP_CARD = {
  name: "VP Schedule-Bot",
  description:
    "Executive scheduling agent for Yaroslav (VP of Engineering). Proposes conflict-free 30-minute meeting slots, coordinates multi-hop rescheduling with other attendees' A2A agents, and books calendar invites.",
  version: "1.0.0",
  capabilities: { streaming: true },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  supportedInterfaces: [
    {
      url: "http://localhost:8082",
      protocolBinding: "HTTP+JSON",
      protocolVersion: "1.0",
    },
  ],
  skills: [
    {
      id: "schedule-vp-meeting",
      name: "VP Calendar Negotiation & Multi-Hop Rescheduling",
      description:
        "Finds mutual availability on the VP's calendar, negotiates with other executives' A2A agents to move movable internal syncs when needed, and sends calendar invites.",
      tags: ["calendar", "scheduling", "executive", "a2a"],
      examples: [
        "Schedule a 30-minute 1:1 with Yaroslav this week",
        "None of those slots work; my user is only free Thursday 15:30-16:00",
      ],
    },
  ],
};

const ALEX_CARD = {
  name: "Alex Schedule-Bot (Director of Platform)",
  description:
    "Personal calendar scheduling agent for Director Alex. Handles internal meeting rescheduling requests from peer A2A agents.",
  version: "1.0.0",
  capabilities: { streaming: true },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  supportedInterfaces: [
    {
      url: "http://localhost:8084",
      protocolBinding: "HTTP+JSON",
      protocolVersion: "1.0",
    },
  ],
  skills: [
    {
      id: "reschedule-internal-sync",
      name: "Internal Sync Rescheduler",
      description:
        "Checks Director Alex's calendar and moves internal 1:1 meetings to open slots.",
      tags: ["calendar", "reschedule", "a2a"],
      examples: [
        "Can we move our Thursday 15:30-16:00 Weekly Sync to Friday 11:00-11:30?",
      ],
    },
  ],
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const role = detectRole(url);

    if (url.pathname.endsWith("/.well-known/agent-card.json")) {
      if (role === "sarah") {
        return new Response("Not Found (VP Sarah has no A2A agent)", {
          status: 404,
        });
      }
      if (role === "alex") {
        return Response.json(ALEX_CARD);
      }
      return Response.json(VP_CARD);
    }

    if (role === "sarah") {
      return new Response(
        `<!doctype html><html><head><title>Corporate Directory — Sarah Chen (VP)</title></head>
        <body><h1>Sarah Chen — VP of Product</h1>
        <p>Direct Calendar Access: 403 Forbidden</p>
        <p>Executive Assistant: ea-sarah@0-a.org (Schedule via email only)</p></body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
    if (role === "alex") {
      return new Response(
        `<!doctype html><html><head><title>Corporate Directory — Alex Rivera (Director)</title></head>
        <body><h1>Alex Rivera — Director of Platform</h1>
        <p>A2A Scheduling Agent active at /.well-known/agent-card.json</p></body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
    return new Response(
      `<!doctype html><html><head><title>Corporate Directory — Yaroslav (VP of Engineering)</title></head>
      <body><h1>Yaroslav — VP of Engineering</h1>
      <p>Direct Calendar Access: 403 Forbidden (Executive ACL)</p>
      <p>Executive Assistant: ea-yaroslav@0-a.org</p></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  },
};
