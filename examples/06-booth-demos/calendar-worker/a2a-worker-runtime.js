import {
  A2A_CONTENT_TYPE,
  A2A_PROTOCOL_VERSION,
  A2A_VERSION_HEADER,
  AgentCard,
  ListTaskPushNotificationConfigsResponse,
  ListTasksResponse,
  SendMessageRequest,
  SendMessageResponse,
  StreamResponse,
  Task,
  TaskPushNotificationConfig,
  TaskState,
  formatSSEErrorEvent,
  formatSSEEvent,
  SSE_HEADERS,
} from "@a2a-js/sdk";
import {
  AgentEvent,
  DefaultPushNotificationSender,
  DefaultRequestHandler,
  InMemoryPushNotificationStore,
  InMemoryTaskStore,
  JsonRpcTransportHandler,
  UnauthenticatedUser,
  defaultServerCallContextBuilder,
  validateVersion,
} from "@a2a-js/sdk/server";
import {
  ClientFactory,
  ClientFactoryOptions,
  DefaultAgentCardResolver,
  JsonRpcTransportFactory,
  RestTransportFactory,
} from "@a2a-js/sdk/client";
import {
  HTTP_STATUS,
  PushNotificationNotSupportedError,
  RequestMalformedError,
  restStatusFor,
  toRestErrorBody,
} from "@a2a-js/sdk/errors";

/**
 * Wraps `@a2a-js/sdk/server`'s `InMemoryPushNotificationStore` so that if a caller
 * registers `http://127.0.0.1:19081/webhook` (or `localhost:19081`), `@a2a-js/sdk`'s
 * `DefaultPushNotificationSender` delivers the webhook over the registered upstream tunnel.
 */
class TunnelAwarePushNotificationStore extends InMemoryPushNotificationStore {
  constructor(getUpstreamUrl) {
    super();
    this.getUpstreamUrl = getUpstreamUrl;
  }

  async load(taskId, context) {
    const configs = await super.load(taskId, context);
    const upstream = this.getUpstreamUrl();
    if (!upstream) return configs;
    return configs.map((c) => {
      if (
        c.url &&
        (c.url.includes("127.0.0.1:19081") || c.url.includes("localhost:19081"))
      ) {
        const base = upstream.replace(/\/+(alex|vp)?\/?$/, "");
        return { ...c, url: `${base}/webhook` };
      }
      return c;
    });
  }
}

/**
 * `AgentExecutor` implementation powered by `@a2a-js/sdk/client` (`ClientFactory` +
 * `RestTransportFactory`). Emits `TASK_STATE_SUBMITTED` immediately (so `a2a send --async`
 * returns right away), then forwards the A2A `sendMessage` request via `@a2a-js/sdk/client`
 * to the local `a2a server` (`claude -p`) and publishes the resulting artifact & `TASK_STATE_COMPLETED`.
 */
class TunnelBridgeAgentExecutor {
  constructor(getUpstreamUrl, registerBackgroundPromise, fallbackFn) {
    this.getUpstreamUrl = getUpstreamUrl;
    this.registerBackgroundPromise = registerBackgroundPromise;
    this.fallbackFn = fallbackFn;
    this.cancelledTasks = new Set();
  }

  async cancelTask(taskId, _eventBus) {
    this.cancelledTasks.add(taskId);
  }

  async execute(requestContext, eventBus) {
    const { taskId, contextId, userMessage, task: existingTask } = requestContext;

    // 1. Emit initial SUBMITTED task snapshot so `--async` (`returnImmediately: true`) returns immediately.
    const initialTask = existingTask ?? {
      id: taskId,
      contextId,
      status: {
        state: TaskState.TASK_STATE_SUBMITTED,
        timestamp: new Date().toISOString(),
      },
      artifacts: [],
      history: [userMessage],
      metadata: {},
    };
    eventBus.publish(AgentEvent.task(initialTask));

    const runPromise = (async () => {
      // Yield one macrotask so `DefaultRequestHandler.sendMessage` with `returnImmediately: true`
      // resolves `TASK_STATE_SUBMITTED` before we transition to `TASK_STATE_WORKING`.
      await new Promise((r) => setTimeout(r, 20));

      eventBus.publish(
        AgentEvent.statusUpdate({
          taskId,
          contextId,
          status: {
            state: TaskState.TASK_STATE_WORKING,
            timestamp: new Date().toISOString(),
          },
          metadata: {},
        })
      );

      let replyText = "";
      const upstreamUrl = this.getUpstreamUrl();

      if (upstreamUrl) {
        const baseResolver = new DefaultAgentCardResolver();
        const tunnelResolver = {
          async resolve(baseUrl, path) {
            const card = await baseResolver.resolve(baseUrl, path);
            card.supportedInterfaces = [
              {
                url: upstreamUrl,
                protocolBinding: "HTTP+JSON",
                tenant: "",
                protocolVersion: A2A_PROTOCOL_VERSION,
              },
            ];
            return card;
          },
        };
        const factory = new ClientFactory(
          ClientFactoryOptions.createFrom(ClientFactoryOptions.default, {
            transports: [new RestTransportFactory(), new JsonRpcTransportFactory()],
            cardResolver: tunnelResolver,
          })
        );
        const client = await factory.createFromUrl(upstreamUrl);
        const upstreamRes = await client.sendMessage({
          message: {
            messageId: crypto.randomUUID(),
            role: userMessage.role,
            parts: userMessage.parts,
            contextId,
            taskId: undefined,
            referenceTaskIds: [],
            extensions: [],
            metadata: {},
          },
        });
        replyText = extractTextFromSendMessageResult(upstreamRes);
      } else if (this.fallbackFn) {
        const userText = extractTextFromMessage(userMessage);
        replyText = await this.fallbackFn(userText, contextId, taskId);
      } else {
        throw new Error("No upstream local agent tunnel registered.");
      }

      eventBus.publish(
        AgentEvent.artifactUpdate({
          taskId,
          contextId,
          artifact: {
            artifactId: crypto.randomUUID(),
            name: "response",
            description: "",
            parts: [
              {
                content: { $case: "text", value: replyText },
                mediaType: "text/plain",
                filename: "",
                metadata: {},
              },
            ],
            metadata: {},
            extensions: [],
          },
          append: false,
          lastChunk: true,
          metadata: {},
        })
      );

      eventBus.publish(
        AgentEvent.statusUpdate({
          taskId,
          contextId,
          status: {
            state: TaskState.TASK_STATE_COMPLETED,
            timestamp: new Date().toISOString(),
          },
          metadata: {},
        })
      );
    })();

    // Keep the Cloudflare Worker isolate alive until both `runPromise` AND
    // `DefaultPushNotificationSender`'s async webhook POST settle.
    this.registerBackgroundPromise(
      runPromise.then(
        () => new Promise((r) => setTimeout(r, 1500)),
        () => new Promise((r) => setTimeout(r, 1500))
      )
    );

    await runPromise;
  }
}

function extractTextFromMessage(msg) {
  if (!msg?.parts) return "";
  return msg.parts
    .map((p) => p?.content?.value ?? p?.text ?? "")
    .filter(Boolean)
    .join("\n");
}

function extractTextFromSendMessageResult(res) {
  if (!res) return "";
  if ("parts" in res && Array.isArray(res.parts)) {
    return extractTextFromMessage(res);
  }
  if ("artifacts" in res && Array.isArray(res.artifacts)) {
    return res.artifacts
      .flatMap((a) => a.parts || [])
      .map((p) => p?.content?.value ?? p?.text ?? "")
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

/**
 * Creates a full `@a2a-js/sdk` server instance (`DefaultRequestHandler`, `InMemoryTaskStore`,
 * `TunnelAwarePushNotificationStore`, `DefaultPushNotificationSender`, `JsonRpcTransportHandler`,
 * and Web-Standard `fetch(Request)` adapter for `HTTP+JSON` REST & `JSONRPC`).
 */
export function createA2AWorkerAgent({ cardTemplate, defaultUpstreamUrl, fallbackFn }) {
  let upstreamUrl = defaultUpstreamUrl || "";
  let activeCtx = null;

  const getUpstreamUrl = () => upstreamUrl;
  const setUpstreamUrl = (u) => {
    upstreamUrl = u;
  };
  const registerBackgroundPromise = (p) => {
    if (activeCtx && typeof activeCtx.waitUntil === "function") {
      activeCtx.waitUntil(p);
    }
  };

  let currentOrigin = "https://localhost";
  const dynamicCard = new Proxy(cardTemplate, {
    get(target, prop) {
      if (prop === "supportedInterfaces") {
        return [
          {
            url: currentOrigin,
            protocolBinding: "HTTP+JSON",
            tenant: "",
            protocolVersion: A2A_PROTOCOL_VERSION,
          },
        ];
      }
      return target[prop];
    },
  });

  const taskStore = new InMemoryTaskStore();
  const pushStore = new TunnelAwarePushNotificationStore(getUpstreamUrl);
  const pushSender = new DefaultPushNotificationSender(pushStore, { timeout: 10000 });
  const executor = new TunnelBridgeAgentExecutor(
    getUpstreamUrl,
    registerBackgroundPromise,
    fallbackFn
  );

  const requestHandler = new DefaultRequestHandler(
    dynamicCard,
    taskStore,
    executor,
    undefined,
    pushStore,
    pushSender
  );
  const jsonRpcTransport = new JsonRpcTransportHandler(requestHandler);

  async function handleFetch(request, env, ctx) {
    activeCtx = ctx;
    const url = new URL(request.url);
    currentOrigin = url.origin;

    // Admin endpoint for `start-pc-bot` / `start-calendar-bot` to register the live cloudflared tunnel URL
    if (request.method === "POST" && url.pathname === "/_admin/register-upstream") {
      const body = await request.json();
      if (body?.upstreamUrl) {
        setUpstreamUrl(body.upstreamUrl);
      }
      return Response.json({ ok: true, upstreamUrl });
    }

    // 1. Agent Card endpoint (`/.well-known/agent-card.json`)
    if (request.method === "GET" && url.pathname.endsWith("/.well-known/agent-card.json")) {
      const card = await requestHandler.getAgentCard();
      return Response.json(AgentCard.toJSON(card));
    }

    const headersObj = {};
    request.headers.forEach((v, k) => {
      headersObj[k.toLowerCase()] = v;
    });
    const callContext = defaultServerCallContextBuilder({
      user: new UnauthenticatedUser(),
      headers: headersObj,
      requestedVersion: request.headers.get(A2A_VERSION_HEADER) || A2A_PROTOCOL_VERSION,
      tenant: "",
    });

    try {
      const card = await requestHandler.getAgentCard();
      validateVersion(callContext.requestedVersion, card, "HTTP+JSON");

      // 2. HTTP+JSON REST: POST /message:send
      if (request.method === "POST" && url.pathname === "/message:send") {
        const raw = await request.json();
        const params = SendMessageRequest.fromJSON(raw ?? {});
        const result = await requestHandler.sendMessage(params, callContext);
        const protoPayload =
          "messageId" in result
            ? { payload: { $case: "message", value: result } }
            : { payload: { $case: "task", value: result } };
        return new Response(JSON.stringify(SendMessageResponse.toJSON(protoPayload)), {
          status: HTTP_STATUS.OK,
          headers: { "Content-Type": A2A_CONTENT_TYPE },
        });
      }

      // 3. HTTP+JSON REST: POST /message:stream
      if (request.method === "POST" && url.pathname === "/message:stream") {
        const raw = await request.json();
        const params = SendMessageRequest.fromJSON(raw ?? {});
        const stream = requestHandler.sendMessageStream(params, callContext);
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const enc = new TextEncoder();
        const pump = (async () => {
          try {
            for await (const ev of stream) {
              await writer.write(enc.encode(formatSSEEvent(StreamResponse.toJSON(ev))));
            }
          } catch (err) {
            await writer.write(
              enc.encode(formatSSEErrorEvent(toRestErrorBody(err, restStatusFor(err))))
            );
          } finally {
            await writer.close();
          }
        })();
        registerBackgroundPromise(pump);
        return new Response(readable, { status: HTTP_STATUS.OK, headers: SSE_HEADERS });
      }

      // 4. HTTP+JSON REST: GET /tasks/:taskId
      const taskMatch = url.pathname.match(/^\/tasks\/([^/:]+)$/);
      if (request.method === "GET" && taskMatch) {
        const taskId = decodeURIComponent(taskMatch[1]);
        const historyLength = url.searchParams.has("historyLength")
          ? Number(url.searchParams.get("historyLength"))
          : undefined;
        const task = await requestHandler.getTask(
          { id: taskId, historyLength, tenant: "" },
          callContext
        );
        return new Response(JSON.stringify(Task.toJSON(task)), {
          status: HTTP_STATUS.OK,
          headers: { "Content-Type": A2A_CONTENT_TYPE },
        });
      }

      // 5. HTTP+JSON REST: GET /tasks
      if (request.method === "GET" && url.pathname === "/tasks") {
        const listRes = await requestHandler.listTasks(
          {
            tenant: "",
            contextId: url.searchParams.get("contextId") || "",
            status: 0,
            pageToken: url.searchParams.get("pageToken") || "",
            includeArtifacts: url.searchParams.get("includeArtifacts") === "true",
          },
          callContext
        );
        return new Response(JSON.stringify(ListTasksResponse.toJSON(listRes)), {
          status: HTTP_STATUS.OK,
          headers: { "Content-Type": A2A_CONTENT_TYPE },
        });
      }

      // 6. HTTP+JSON REST: POST /tasks/:taskId:cancel
      const cancelMatch = url.pathname.match(/^\/tasks\/([^/:]+):cancel$/);
      if (request.method === "POST" && cancelMatch) {
        const taskId = decodeURIComponent(cancelMatch[1]);
        const task = await requestHandler.cancelTask(
          { id: taskId, tenant: "", metadata: {} },
          callContext
        );
        return new Response(JSON.stringify(Task.toJSON(task)), {
          status: HTTP_STATUS.OK,
          headers: { "Content-Type": A2A_CONTENT_TYPE },
        });
      }

      // 7. HTTP+JSON REST: POST & GET /tasks/:taskId/pushNotificationConfigs
      const pushListMatch = url.pathname.match(/^\/tasks\/([^/:]+)\/pushNotificationConfigs$/);
      if (pushListMatch) {
        const taskId = decodeURIComponent(pushListMatch[1]);
        if (request.method === "POST") {
          const raw = await request.json();
          const cfg = TaskPushNotificationConfig.fromJSON({ ...(raw ?? {}), taskId });
          if (!cfg.id) {
            cfg.id = crypto.randomUUID();
          }
          const created = await requestHandler.createTaskPushNotificationConfig(cfg, callContext);
          return new Response(JSON.stringify(TaskPushNotificationConfig.toJSON(created)), {
            status: HTTP_STATUS.OK,
            headers: { "Content-Type": A2A_CONTENT_TYPE },
          });
        }
        if (request.method === "GET") {
          const list = await requestHandler.listTaskPushNotificationConfigs(
            { taskId, pageSize: 0, pageToken: "", tenant: "" },
            callContext
          );
          return new Response(
            JSON.stringify(ListTaskPushNotificationConfigsResponse.toJSON(list)),
            {
              status: HTTP_STATUS.OK,
              headers: { "Content-Type": A2A_CONTENT_TYPE },
            }
          );
        }
      }

      // 8. HTTP+JSON REST: GET & DELETE /tasks/:taskId/pushNotificationConfigs/:configId
      const pushItemMatch = url.pathname.match(
        /^\/tasks\/([^/:]+)\/pushNotificationConfigs\/([^/]+)$/
      );
      if (pushItemMatch) {
        const taskId = decodeURIComponent(pushItemMatch[1]);
        const configId = decodeURIComponent(pushItemMatch[2]);
        if (request.method === "GET") {
          const item = await requestHandler.getTaskPushNotificationConfig(
            { taskId, id: configId, tenant: "" },
            callContext
          );
          return new Response(JSON.stringify(TaskPushNotificationConfig.toJSON(item)), {
            status: HTTP_STATUS.OK,
            headers: { "Content-Type": A2A_CONTENT_TYPE },
          });
        }
        if (request.method === "DELETE") {
          await requestHandler.deleteTaskPushNotificationConfig(
            { taskId, id: configId, tenant: "" },
            callContext
          );
          return new Response(null, { status: HTTP_STATUS.NO_CONTENT });
        }
      }

      // 9. JSON-RPC fallback on POST /
      if (request.method === "POST" && url.pathname === "/") {
        const raw = await request.json();
        const rpcResult = await jsonRpcTransport.handle(raw, callContext);
        return Response.json(rpcResult);
      }
    } catch (error) {
      const status = restStatusFor(error);
      return new Response(JSON.stringify(toRestErrorBody(error, status)), {
        status,
        headers: { "Content-Type": A2A_CONTENT_TYPE },
      });
    }

    return null;
  }

  return { handleFetch, setUpstreamUrl, getUpstreamUrl };
}
