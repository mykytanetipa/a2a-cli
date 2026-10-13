/**
 * Cloudflare Worker for A2A Booth Demo 2 (Calendar Scenario):
 *  - Role 1: vp-schedule-bot   (Yaroslav's A2A Scheduling Agent + Multi-Hop A2A caller)
 *  - Role 2: alex-schedule-bot (Director Alex's A2A Scheduling Agent for multi-hop rescheduling)
 *  - Role 3: vp-sarah          (No-A2A executive profile — returns 404 on /.well-known/agent-card.json)
 *
 * Also exposes:
 *  - GET  /logs?since=<index>  Live ANSI-colored agent log stream for Window 3 (watch-calendar-bot)
 *  - GET  /calendar-state      Current booking status so `my-calendar` reflects confirmed meetings
 *  - POST /reset               Resets demo state and logs between takes
 */

const GLOBAL_STATE = {
  logs: [],
  bookedSlot: null,
  alexMovedTo: null,
  tasks: new Map(),
  contexts: new Map(),
};

function pushLog(line) {
  console.log(line);
  GLOBAL_STATE.logs.push({
    id: GLOBAL_STATE.logs.length,
    ts: new Date().toISOString(),
    text: line,
  });
  if (GLOBAL_STATE.logs.length > 500) {
    GLOBAL_STATE.logs.shift();
  }
}

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

function buildVpCard(origin) {
  return {
    name: "VP Schedule-Bot",
    description:
      "Executive scheduling agent for Yaroslav (VP of Engineering). Proposes conflict-free 30-minute meeting slots, coordinates multi-hop rescheduling with other attendees' A2A agents, and books calendar invites.",
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
}

function buildAlexCard(origin) {
  return {
    name: "Alex Schedule-Bot (Director of Platform)",
    description:
      "Personal calendar scheduling agent for Director Alex. Handles internal meeting rescheduling requests from peer A2A agents.",
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
}

function extractMessageText(body) {
  const parts = body?.message?.parts || [];
  return parts.map((p) => p.text || "").join(" ").trim();
}

function makeTaskResponse(contextId, userMessage, replyText) {
  const taskId = crypto.randomUUID();
  const artifactId = crypto.randomUUID();
  const task = {
    id: taskId,
    contextId,
    artifacts: [
      {
        artifactId,
        parts: [{ text: replyText }],
      },
    ],
    history: userMessage ? [userMessage] : [],
    status: {
      state: "TASK_STATE_COMPLETED",
      timestamp: new Date().toISOString(),
    },
  };
  GLOBAL_STATE.tasks.set(taskId, task);
  return { task };
}

async function handleAlexA2A(request, url) {
  const body = await request.json();
  const msgText = extractMessageText(body);
  const contextId = body?.message?.contextId || crypto.randomUUID();

  GLOBAL_STATE.alexMovedTo = "Friday 11:00-11:30";

  const replyText =
    "Checked Director Alex's calendar: Friday 11:00-11:30 is free.\n" +
    "- Moved 'Weekly Sync: Yaroslav & Alex' from Thursday 15:30-16:00 to Friday 11:00-11:30 (Reschedule ID: CAL-RESCHED-409).\n" +
    "- Thursday 15:30-16:00 is now open on both calendars.";

  return Response.json(makeTaskResponse(contextId, body.message, replyText));
}

async function callAlexAgentMultiHop(url, vpContextId) {
  const alexOrigin = url.origin.includes("vp-schedule-bot")
    ? url.origin.replace("vp-schedule-bot", "alex-schedule-bot")
    : `${url.origin}/alex`;

  const outboundMsg =
    "Hi Alex Schedule-Bot — Yaroslav needs Thursday 15:30-16:00 for a 1:1. Can we move Yaroslav & Alex's Weekly Sync from Thursday 15:30-16:00 to Friday 11:00-11:30?";

  pushLog(
    `\x1b[1;33m🔀 [MULTI-HOP A2A] VP Schedule-Bot ──► Alex Schedule-Bot (${alexOrigin})\x1b[0m`
  );
  pushLog(`\x1b[0;33m   "${outboundMsg}"\x1b[0m`);

  let alexReply =
    "Checked Director Alex's calendar: Friday 11:00-11:30 is free. Moved 'Weekly Sync: Yaroslav & Alex' from Thursday 15:30-16:00 to Friday 11:00-11:30 (CAL-RESCHED-409).";

  try {
    const resp = await fetch(`${alexOrigin}/message:send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          messageId: crypto.randomUUID(),
          contextId: vpContextId,
          role: "ROLE_USER",
          parts: [{ text: outboundMsg }],
        },
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      alexReply =
        data?.task?.artifacts?.[0]?.parts?.[0]?.text || alexReply;
    }
  } catch (_) {
    // Fallback if same-zone worker-to-worker fetch is restricted
  }

  GLOBAL_STATE.alexMovedTo = "Friday 11:00-11:30";
  pushLog(
    `\x1b[1;36m📥 [MULTI-HOP A2A] Alex Schedule-Bot ──► VP Schedule-Bot:\x1b[0m`
  );
  pushLog(`\x1b[0;36m   ${alexReply.replace(/\n/g, "\n   ")}\x1b[0m`);
  return alexReply;
}

async function handleVpA2A(request, url) {
  const body = await request.json();
  const msgText = extractMessageText(body);
  const lower = msgText.toLowerCase();
  const contextId = body?.message?.contextId || crypto.randomUUID();
  const prevTurns = GLOBAL_STATE.contexts.get(contextId) || 0;
  const turn = prevTurns + 1;
  GLOBAL_STATE.contexts.set(contextId, turn);

  pushLog(
    `\n\x1b[1;35m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`
  );
  pushLog(
    `\x1b[1;35m📥 [VP Schedule-Bot] INBOUND A2A MESSAGE (Turn ${turn} | Context: ${contextId})\x1b[0m`
  );
  pushLog(`\x1b[0;37m${msgText}\x1b[0m`);

  let replyText = "";

  // Case 1: Caller asks for Thursday 15:30 OR confirms moving Alex's meeting
  const mentionsThuAfternoon =
    lower.includes("15:30") ||
    lower.includes("3:30") ||
    lower.includes("reschedule") ||
    lower.includes("alex") ||
    lower.includes("confirm") ||
    turn >= 3;

  if (turn === 1 && !lower.includes("15:30") && !lower.includes("3:30")) {
    pushLog(
      `\x1b[1;33m⚙️  [VP Schedule-Bot] Checking Yaroslav's calendar (round 1 open slots)...\x1b[0m`
    );
    replyText =
      "Here are Yaroslav's 3 open 30-minute slots this week:\n" +
      "- **Tuesday 10:00–10:30**\n" +
      "- **Wednesday 14:00–14:30**\n" +
      "- **Thursday 11:00–11:30**\n" +
      "Which of these works for your user?";
  } else if (!mentionsThuAfternoon && turn === 2) {
    pushLog(
      `\x1b[1;33m⚙️  [VP Schedule-Bot] Checking Yaroslav's remaining calendar blocks...\x1b[0m`
    );
    replyText =
      "Yaroslav has no other unbooked slots this week, but he has a movable internal 1:1 with **Director Alex** on **Thursday 15:30–16:00**.\n" +
      "- If **Thursday 15:30–16:00** works for your user, confirm and I will contact Director Alex's A2A agent (`Alex Schedule-Bot`) to move their sync to Friday 11:00–11:30.";
  } else {
    pushLog(
      `\x1b[1;33m⚙️  [VP Schedule-Bot] Conflict on Thursday 15:30–16:00 (Movable sync with Director Alex). Initiating Multi-Hop A2A reschedule...\x1b[0m`
    );
    await callAlexAgentMultiHop(url, contextId);
    GLOBAL_STATE.bookedSlot = "Thursday 15:30-16:00";
    replyText =
      "Confirmed! Here is what I did:\n" +
      "- **Multi-Hop A2A Reschedule:** Contacted `Alex Schedule-Bot` over A2A and moved Yaroslav & Alex's internal sync from Thursday 15:30–16:00 to **Friday 11:00–11:30** (`CAL-RESCHED-409`).\n" +
      "- **Booked Slot:** **Thursday 15:30–16:00** (30-min 1:1 with Yaroslav, VP of Engineering).\n" +
      "- **Calendar Invite ID:** `CAL-INV-8842` (VP approved, invite sent).";
  }

  pushLog(`\x1b[1;32m📤 [VP Schedule-Bot] OUTBOUND A2A RESPONSE:\x1b[0m`);
  pushLog(`\x1b[0;32m${replyText}\x1b[0m`);
  pushLog(
    `\x1b[1;35m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`
  );

  return Response.json(makeTaskResponse(contextId, body.message, replyText));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const role = detectRole(url);

    // 1. Live log polling endpoint for Window 3 (`watch-calendar-bot`)
    if (url.pathname === "/logs") {
      const since = parseInt(url.searchParams.get("since") || "0", 10);
      const entries = GLOBAL_STATE.logs.filter((e) => e.id >= since);
      const nextCursor =
        GLOBAL_STATE.logs.length > 0
          ? GLOBAL_STATE.logs[GLOBAL_STATE.logs.length - 1].id + 1
          : since;
      return Response.json({ entries, nextCursor });
    }

    // 2. Calendar booking state endpoint (used by `my-calendar` to show live booked status)
    if (url.pathname === "/calendar-state") {
      return Response.json({
        bookedSlot: GLOBAL_STATE.bookedSlot,
        alexMovedTo: GLOBAL_STATE.alexMovedTo,
        inviteId: GLOBAL_STATE.bookedSlot ? "CAL-INV-8842" : null,
      });
    }

    // 3. Reset state between demo takes
    if (url.pathname === "/reset" && request.method === "POST") {
      GLOBAL_STATE.logs = [];
      GLOBAL_STATE.bookedSlot = null;
      GLOBAL_STATE.alexMovedTo = null;
      GLOBAL_STATE.tasks.clear();
      GLOBAL_STATE.contexts.clear();
      pushLog(
        `\x1b[1;34m🔄 [VP Schedule-Bot & Alex Schedule-Bot] Demo state reset — ready for recording.\x1b[0m`
      );
      return Response.json({ ok: true });
    }

    // 4. Agent Card discovery (/.well-known/agent-card.json)
    if (url.pathname.endsWith("/.well-known/agent-card.json")) {
      if (role === "sarah") {
        return new Response("Not Found (VP Sarah has no A2A agent)", {
          status: 404,
        });
      }
      if (role === "alex") {
        const alexOrigin = url.pathname.startsWith("/alex")
          ? `${url.origin}/alex`
          : url.origin;
        return Response.json(buildAlexCard(alexOrigin));
      }
      return Response.json(buildVpCard(url.origin));
    }

    // 5. A2A message:send endpoint
    if (
      request.method === "POST" &&
      (url.pathname.endsWith("/message:send") || url.pathname === "/")
    ) {
      if (role === "alex") {
        return handleAlexA2A(request, url);
      }
      return handleVpA2A(request, url);
    }

    // 6. A2A tasks/<id> GET endpoint
    if (request.method === "GET" && url.pathname.includes("/tasks/")) {
      const taskId = url.pathname.split("/tasks/")[1];
      const task = GLOBAL_STATE.tasks.get(taskId);
      if (!task) {
        return new Response("Task not found", { status: 404 });
      }
      return Response.json(task);
    }

    // 7. Human-readable Corporate Profile HTML page at GET /
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
