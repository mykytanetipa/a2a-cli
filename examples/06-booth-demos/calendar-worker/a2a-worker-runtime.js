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

class EdgeSharedPushNotificationStore extends InMemoryPushNotificationStore {
  constructor(namespace) {
    super();
    this.namespace = namespace;
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
    return configs;
  }

  async loadWithMetadata(taskId, context) {
    const configs = await this.load(taskId, context);
    const wireVersion = context?.requestedVersion || A2A_PROTOCOL_VERSION;
    return configs.map((config) => ({ config, wireVersion }));
  }
}

class FallbackAgentExecutor {
  constructor(registerBackgroundPromise, fallbackFn) {
    this.registerBackgroundPromise = registerBackgroundPromise;
    this.fallbackFn = fallbackFn;
  }

  async cancelTask(_taskId, _eventBus) {}

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

      const userText = (userMessage?.parts || [])
        .map((p) => p?.content?.value ?? p?.text ?? "")
        .filter(Boolean)
        .join("\n");
      const replyText = this.fallbackFn
        ? await this.fallbackFn(userText, contextId, taskId)
        : "No upstream tunnel connected.";

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

    this.registerBackgroundPromise(runPromise);
    await runPromise;
  }
}

/**
 * Builds an `@a2a-js/sdk/client` `Client` connected to the upstream local `a2a server` tunnel.
 */
async function createUpstreamSdkClient(upstreamUrl) {
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
  return await factory.createFromUrl(upstreamUrl);
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
  const pushStore = new EdgeSharedPushNotificationStore(namespace);
  const pushSender = new DefaultPushNotificationSender(pushStore, { timeout: 10000 });
  const executor = new FallbackAgentExecutor(registerBackgroundPromise, fallbackFn);

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

    // 1. Agent Card served via `@a2a-js/sdk` `DefaultRequestHandler.getAgentCard()` + `AgentCard.toJSON`
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
      const liveUpstream = await getUpstreamUrl();

      // 2. HTTP+JSON REST: POST /message:send
      if (request.method === "POST" && url.pathname === "/message:send") {
        const raw = await request.json();
        const params = SendMessageRequest.fromJSON(raw ?? {});
        let result;
        if (liveUpstream) {
          // Forward via `@a2a-js/sdk/client` to the upstream local `a2a server`
          // (supports both blocking and `returnImmediately: true` `--async` without hitting Cloudflare's 30s waitUntil cap!)
          const client = await createUpstreamSdkClient(liveUpstream);
          result = await client.sendMessage(params);
        } else {
          result = await requestHandler.sendMessage(params, callContext);
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

      // 3. HTTP+JSON REST: GET /tasks/:taskId
      const taskMatch = url.pathname.match(/^\/tasks\/([^/:]+)$/);
      if (request.method === "GET" && taskMatch) {
        const taskId = decodeURIComponent(taskMatch[1]);
        const historyLength = url.searchParams.has("historyLength")
          ? Number(url.searchParams.get("historyLength"))
          : undefined;
        const task = liveUpstream
          ? await (await createUpstreamSdkClient(liveUpstream)).getTask({
              id: taskId,
              historyLength,
              tenant: "",
            })
          : await requestHandler.getTask({ id: taskId, historyLength, tenant: "" }, callContext);
        return new Response(JSON.stringify(Task.toJSON(task)), {
          status: HTTP_STATUS.OK,
          headers: { "Content-Type": A2A_CONTENT_TYPE },
        });
      }

      // 4. HTTP+JSON REST: POST & GET /tasks/:taskId/pushNotificationConfigs
      const pushListMatch = url.pathname.match(/^\/tasks\/([^/:]+)\/pushNotificationConfigs$/);
      if (pushListMatch) {
        const taskId = decodeURIComponent(pushListMatch[1]);
        if (request.method === "POST") {
          const raw = await request.json();
          const cfg = TaskPushNotificationConfig.fromJSON({ ...(raw ?? {}), taskId });
          if (!cfg.id) {
            cfg.id = crypto.randomUUID();
          }
          const created = liveUpstream
            ? await (await createUpstreamSdkClient(liveUpstream)).createTaskPushNotificationConfig(
                cfg
              )
            : await requestHandler.createTaskPushNotificationConfig(cfg, callContext);
          return new Response(JSON.stringify(TaskPushNotificationConfig.toJSON(created)), {
            status: HTTP_STATUS.OK,
            headers: { "Content-Type": A2A_CONTENT_TYPE },
          });
        }
        if (request.method === "GET") {
          const list = liveUpstream
            ? await (await createUpstreamSdkClient(liveUpstream)).listTaskPushNotificationConfigs({
                taskId,
                pageSize: 0,
                pageToken: "",
                tenant: "",
              })
            : await requestHandler.listTaskPushNotificationConfigs(
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

      // 5. HTTP+JSON REST: POST /tasks/:taskId:cancel
      const cancelMatch = url.pathname.match(/^\/tasks\/([^/:]+):cancel$/);
      if (request.method === "POST" && cancelMatch) {
        const taskId = decodeURIComponent(cancelMatch[1]);
        const task = liveUpstream
          ? await (await createUpstreamSdkClient(liveUpstream)).cancelTask({
              id: taskId,
              tenant: "",
              metadata: {},
            })
          : await requestHandler.cancelTask({ id: taskId, tenant: "", metadata: {} }, callContext);
        return new Response(JSON.stringify(Task.toJSON(task)), {
          status: HTTP_STATUS.OK,
          headers: { "Content-Type": A2A_CONTENT_TYPE },
        });
      }

      // 6. HTTP+JSON REST: POST /message:stream
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
