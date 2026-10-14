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
  restStatusFor,
  toRestErrorBody,
} from "@a2a-js/sdk/errors";

function getEdgeCache() {
  return typeof caches !== "undefined" && caches.default ? caches.default : null;
}

async function cachePutJson(keyUrl, data) {
  const cache = getEdgeCache();
  if (!cache) return;
  await cache.put(
    new Request(keyUrl),
    new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    })
  );
}

async function cacheGetJson(keyUrl) {
  const cache = getEdgeCache();
  if (!cache) return null;
  const res = await cache.match(new Request(keyUrl));
  if (!res) return null;
  return await res.json();
}

/**
 * Extends `@a2a-js/sdk/server`'s `InMemoryTaskStore` with Cloudflare's shared
 * `caches.default` so tasks created via `a2a send --async` in Isolate A are
 * immediately visible to `a2a task push-config create` and `a2a task get` in Isolate B.
 */
class EdgeSharedTaskStore extends InMemoryTaskStore {
  constructor(namespace) {
    super();
    this.namespace = namespace;
  }

  _key(taskId) {
    return `https://a2a-state.internal/${this.namespace}/tasks/${encodeURIComponent(taskId)}`;
  }

  async save(task, context) {
    await super.save(task, context);
    await cachePutJson(this._key(task.id), Task.toJSON(task));
  }

  async load(taskId, context) {
    const cached = await cacheGetJson(this._key(taskId));
    if (cached) {
      const hydrated = Task.fromJSON(cached);
      await super.save(hydrated, context);
      return hydrated;
    }
    return await super.load(taskId, context);
  }
}

/**
 * Extends `@a2a-js/sdk/server`'s `InMemoryPushNotificationStore` with Cloudflare's
 * shared `caches.default` AND rewrites `127.0.0.1:19081/webhook` to the active
 * tunnel's `/webhook` route so `@a2a-js/sdk`'s `DefaultPushNotificationSender`
 * delivers webhooks across isolates to the user's local machine.
 */
class EdgeSharedPushNotificationStore extends InMemoryPushNotificationStore {
  constructor(namespace, getUpstreamUrl) {
    super();
    this.namespace = namespace;
    this.getUpstreamUrl = getUpstreamUrl;
  }

  _key(taskId) {
    return `https://a2a-state.internal/${this.namespace}/push/${encodeURIComponent(taskId)}`;
  }

  async save(taskId, context, config) {
    await super.save(taskId, context, config);
    const existing = await super.load(taskId, context);
    await cachePutJson(
      this._key(taskId),
      existing.map((c) => TaskPushNotificationConfig.toJSON(c))
    );
  }

  async load(taskId, context) {
    let configs = await super.load(taskId, context);
    const cached = await cacheGetJson(this._key(taskId));
    if (Array.isArray(cached) && cached.length > 0) {
      configs = cached.map((c) => TaskPushNotificationConfig.fromJSON(c));
    }
    const upstream = await this.getUpstreamUrl();
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

  async loadWithMetadata(taskId, context) {
    const configs = await this.load(taskId, context);
    const wireVersion = context?.requestedVersion || A2A_PROTOCOL_VERSION;
    return configs.map((config) => ({ config, wireVersion }));
  }
}

/**
 * `AgentExecutor` implementation powered by `@a2a-js/sdk/client` (`ClientFactory` +
 * `RestTransportFactory`).
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
      await new Promise((r) => setTimeout(r, 50));

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
      const upstreamUrl = await this.getUpstreamUrl();

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

    this.registerBackgroundPromise(
      runPromise.then(
        () => new Promise((r) => setTimeout(r, 2000)),
        () => new Promise((r) => setTimeout(r, 2000))
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

export function createA2AWorkerAgent({ cardTemplate, defaultUpstreamUrl, fallbackFn }) {
  const namespace = (cardTemplate.name || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
  const upstreamKey = `https://a2a-state.internal/${namespace}/config/upstream`;
  let upstreamUrl = defaultUpstreamUrl || "";
  let activeCtx = null;

  const getUpstreamUrl = async () => {
    const cached = await cacheGetJson(upstreamKey);
    if (cached?.upstreamUrl) {
      upstreamUrl = cached.upstreamUrl;
    }
    return upstreamUrl;
  };
  const setUpstreamUrl = async (u) => {
    upstreamUrl = u;
    await cachePutJson(upstreamKey, { upstreamUrl: u });
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

  const taskStore = new EdgeSharedTaskStore(namespace);
  const pushStore = new EdgeSharedPushNotificationStore(namespace, getUpstreamUrl);
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

    if (request.method === "POST" && url.pathname === "/_admin/register-upstream") {
      const body = await request.json();
      if (body?.upstreamUrl) {
        await setUpstreamUrl(body.upstreamUrl);
      }
      return Response.json({ ok: true, upstreamUrl });
    }

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

      if (request.method === "POST" && url.pathname === "/message:send") {
        const raw = await request.json();
        const params = SendMessageRequest.fromJSON(raw ?? {});
        const result = await requestHandler.sendMessage(params, callContext);
        if ("id" in result && result.id) {
          await taskStore.save(result, callContext);
        }
        const protoPayload =
          "messageId" in result
            ? { payload: { $case: "message", value: result } }
            : { payload: { $case: "task", value: result } };
        return new Response(JSON.stringify(SendMessageResponse.toJSON(protoPayload)), {
          status: HTTP_STATUS.OK,
          headers: { "Content-Type": A2A_CONTENT_TYPE },
        });
      }

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
