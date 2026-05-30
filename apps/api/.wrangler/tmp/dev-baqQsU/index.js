var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-lkHFDF/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/db.ts
function rowToDiagram(row) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    tabs: JSON.parse(row.data),
    shareable: row.shareable === 1,
    shareCode: row.share_code,
    savedAt: row.saved_at,
    createdAt: row.created_at
  };
}
__name(rowToDiagram, "rowToDiagram");
function rowToSummary(row) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    shareable: row.shareable === 1,
    shareCode: row.share_code,
    savedAt: row.saved_at,
    createdAt: row.created_at
  };
}
__name(rowToSummary, "rowToSummary");
var DIAGRAM_COLS = "id, owner_id, name, data, shareable, share_code, saved_at, created_at";
var DIAGRAM_SUMMARY_COLS = "id, owner_id, name, shareable, share_code, saved_at, created_at";
async function getDiagram(env, id) {
  const row = await env.DB.prepare(`SELECT ${DIAGRAM_COLS} FROM diagrams WHERE id = ?`).bind(id).first();
  return row ? rowToDiagram(row) : null;
}
__name(getDiagram, "getDiagram");
async function getDiagramByShareCode(env, code) {
  const row = await env.DB.prepare(
    `SELECT ${DIAGRAM_COLS} FROM diagrams WHERE share_code = ? AND shareable = 1`
  ).bind(code).first();
  return row ? rowToDiagram(row) : null;
}
__name(getDiagramByShareCode, "getDiagramByShareCode");
async function listDiagramsByOwner(env, ownerId) {
  const result = await env.DB.prepare(
    `SELECT ${DIAGRAM_SUMMARY_COLS} FROM diagrams WHERE owner_id = ? ORDER BY saved_at DESC`
  ).bind(ownerId).all();
  return (result.results ?? []).map(rowToSummary);
}
__name(listDiagramsByOwner, "listDiagramsByOwner");
async function upsertDiagram(env, d) {
  await env.DB.prepare(
    `INSERT INTO diagrams (id, owner_id, name, data, shareable, share_code, saved_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       owner_id = excluded.owner_id,
       name = excluded.name,
       data = excluded.data,
       saved_at = excluded.saved_at`
  ).bind(
    d.id,
    d.ownerId,
    d.name,
    JSON.stringify(d.tabs),
    d.shareable ? 1 : 0,
    d.shareCode,
    d.savedAt,
    d.createdAt
  ).run();
}
__name(upsertDiagram, "upsertDiagram");
async function setDiagramShare(env, id, shareable, shareCode) {
  await env.DB.prepare("UPDATE diagrams SET shareable = ?, share_code = ? WHERE id = ?").bind(shareable ? 1 : 0, shareCode, id).run();
}
__name(setDiagramShare, "setDiagramShare");
async function deleteDiagram(env, id) {
  await env.DB.prepare("DELETE FROM diagrams WHERE id = ?").bind(id).run();
}
__name(deleteDiagram, "deleteDiagram");
async function getParticipant(env, id) {
  const row = await env.DB.prepare(
    "SELECT id, name, color, created_at FROM participants WHERE id = ?"
  ).bind(id).first();
  return row ? { id: row.id, name: row.name, color: row.color, createdAt: row.created_at } : null;
}
__name(getParticipant, "getParticipant");
async function upsertParticipant(env, p) {
  await env.DB.prepare(
    `INSERT INTO participants (id, name, color, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       color = excluded.color`
  ).bind(p.id, p.name, p.color, p.createdAt).run();
}
__name(upsertParticipant, "upsertParticipant");
var SHARE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateShareCode(length = 8) {
  let code = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) {
    code += SHARE_ALPHABET[byte % SHARE_ALPHABET.length];
  }
  return code;
}
__name(generateShareCode, "generateShareCode");
function rowToShareLink(row) {
  return {
    code: row.code,
    diagramId: row.diagram_id,
    role: row.role === "view" ? "view" : "edit",
    createdAt: row.created_at
  };
}
__name(rowToShareLink, "rowToShareLink");
async function listShareLinks(env, diagramId) {
  const result = await env.DB.prepare(
    "SELECT code, diagram_id, role, created_at FROM share_links WHERE diagram_id = ? ORDER BY created_at ASC"
  ).bind(diagramId).all();
  return (result.results ?? []).map(rowToShareLink);
}
__name(listShareLinks, "listShareLinks");
async function getShareLink(env, code) {
  const row = await env.DB.prepare(
    "SELECT code, diagram_id, role, created_at FROM share_links WHERE code = ?"
  ).bind(code).first();
  return row ? rowToShareLink(row) : null;
}
__name(getShareLink, "getShareLink");
async function createShareLink(env, diagramId, code, role) {
  const createdAt = Date.now();
  await env.DB.prepare(
    "INSERT INTO share_links (code, diagram_id, role, created_at) VALUES (?, ?, ?, ?)"
  ).bind(code, diagramId, role, createdAt).run();
  await env.DB.prepare(
    "UPDATE diagrams SET shareable = 1, share_code = COALESCE(share_code, ?) WHERE id = ?"
  ).bind(code, diagramId).run();
  return { code, diagramId, role, createdAt };
}
__name(createShareLink, "createShareLink");
async function deleteShareLink(env, code) {
  const existing = await getShareLink(env, code);
  if (!existing)
    return;
  await env.DB.prepare("DELETE FROM share_links WHERE code = ?").bind(code).run();
  const remaining = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM share_links WHERE diagram_id = ?"
  ).bind(existing.diagramId).first();
  if (!remaining || remaining.n === 0) {
    await env.DB.prepare("UPDATE diagrams SET shareable = 0, share_code = NULL WHERE id = ?").bind(existing.diagramId).run();
  } else if (existing.code === (await getDiagram(env, existing.diagramId))?.shareCode) {
    const survivor = await env.DB.prepare(
      "SELECT code FROM share_links WHERE diagram_id = ? ORDER BY created_at ASC LIMIT 1"
    ).bind(existing.diagramId).first();
    if (survivor) {
      await env.DB.prepare("UPDATE diagrams SET share_code = ? WHERE id = ?").bind(survivor.code, existing.diagramId).run();
    }
  }
}
__name(deleteShareLink, "deleteShareLink");

// src/diagram-room.ts
var DiagramRoom = class {
  state;
  // `sessions` is keyed by WebSocket; the value is the most recent
  // ParticipantPresence the client identified itself with via `hello`.
  // Null means "connected but hasn't said hello yet" — those clients
  // receive presence but aren't included in the presence list.
  sessions = /* @__PURE__ */ new Map();
  constructor(state) {
    this.state = state;
  }
  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.handleSession(server);
    return new Response(null, { status: 101, webSocket: client });
  }
  handleSession(ws) {
    ws.accept();
    this.sessions.set(ws, null);
    ws.addEventListener("message", (event) => {
      let msg;
      try {
        msg = JSON.parse(typeof event.data === "string" ? event.data : "");
      } catch {
        return;
      }
      if (msg.kind === "hello") {
        this.sessions.set(ws, msg.participant);
        this.broadcastPresence();
        return;
      }
      if (msg.kind === "op") {
        const sender = this.sessions.get(ws);
        if (!sender)
          return;
        const payload = { kind: "op", from: sender.id, op: msg.op };
        const serialized = JSON.stringify(payload);
        for (const peer of this.sessions.keys()) {
          if (peer !== ws) {
            try {
              peer.send(serialized);
            } catch {
              this.sessions.delete(peer);
            }
          }
        }
      }
    });
    const close = /* @__PURE__ */ __name(() => {
      this.sessions.delete(ws);
      this.broadcastPresence();
    }, "close");
    ws.addEventListener("close", close);
    ws.addEventListener("error", close);
  }
  broadcastPresence() {
    const participants = [];
    for (const p of this.sessions.values()) {
      if (p)
        participants.push(p);
    }
    const payload = { kind: "presence", participants };
    const serialized = JSON.stringify(payload);
    for (const ws of this.sessions.keys()) {
      try {
        ws.send(serialized);
      } catch {
        this.sessions.delete(ws);
      }
    }
  }
};
__name(DiagramRoom, "DiagramRoom");

// src/index.ts
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Owner-Id",
  "Access-Control-Max-Age": "86400"
};
function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  for (const [k, v] of Object.entries(CORS_HEADERS))
    headers.set(k, v);
  return new Response(JSON.stringify(body), { ...init, headers });
}
__name(json, "json");
function notFound() {
  return json({ error: "not_found" }, { status: 404 });
}
__name(notFound, "notFound");
function badRequest(msg) {
  return json({ error: "bad_request", message: msg }, { status: 400 });
}
__name(badRequest, "badRequest");
function forbidden() {
  return json({ error: "forbidden" }, { status: 403 });
}
__name(forbidden, "forbidden");
function ownerOf(request) {
  return request.headers.get("X-Owner-Id");
}
__name(ownerOf, "ownerOf");
var src_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    const segments = url.pathname.replace(/^\//, "").split("/");
    if (segments[0] !== "api")
      return notFound();
    try {
      if (segments[1] === "share" && segments.length === 3) {
        const code = segments[2];
        if (request.method === "GET") {
          const link = await getShareLink(env, code);
          if (link) {
            const d2 = await getDiagram(env, link.diagramId);
            return d2 ? json({ diagram: d2, role: link.role }) : notFound();
          }
          const d = await getDiagramByShareCode(env, code);
          return d ? json({ diagram: d, role: "edit" }) : notFound();
        }
      }
      if (segments[1] === "diagrams") {
        if (segments.length === 2) {
          if (request.method === "GET") {
            const owner = ownerOf(request);
            if (!owner)
              return badRequest("missing X-Owner-Id");
            const diagrams = await listDiagramsByOwner(env, owner);
            return json({ diagrams });
          }
          if (request.method === "POST") {
            const body = await request.json();
            const owner = ownerOf(request);
            if (!owner)
              return badRequest("missing X-Owner-Id");
            if (!body.id || !body.name || !body.tabs) {
              return badRequest("missing id/name/tabs");
            }
            const now = Date.now();
            const diagram = {
              id: body.id,
              ownerId: owner,
              name: body.name,
              tabs: body.tabs,
              shareable: body.shareable ?? false,
              shareCode: body.shareCode ?? null,
              savedAt: now,
              createdAt: body.createdAt ?? now
            };
            await upsertDiagram(env, diagram);
            return json({ diagram }, { status: 201 });
          }
        }
        if (segments.length === 3) {
          const id = segments[2];
          if (request.method === "GET") {
            const owner = ownerOf(request);
            if (!owner)
              return badRequest("missing X-Owner-Id");
            const d = await getDiagram(env, id);
            return d && d.ownerId === owner ? json({ diagram: d }) : notFound();
          }
          if (request.method === "PUT") {
            const body = await request.json();
            const owner = ownerOf(request);
            if (!owner)
              return badRequest("missing X-Owner-Id");
            if (!body.name || !body.tabs)
              return badRequest("missing name/tabs");
            const existing = await getDiagram(env, id);
            const now = Date.now();
            const diagram = {
              id,
              ownerId: existing?.ownerId ?? owner,
              name: body.name,
              tabs: body.tabs,
              // Sharing state is owned by the dedicated /share endpoint,
              // not by PUT — saves from visitors never touch it. Preserve
              // whatever the existing row had, or fall through to "not
              // shared" for brand-new rows.
              shareable: existing?.shareable ?? false,
              shareCode: existing?.shareCode ?? null,
              savedAt: now,
              createdAt: existing?.createdAt ?? now
            };
            await upsertDiagram(env, diagram);
            return json({ diagram });
          }
          if (request.method === "DELETE") {
            await deleteDiagram(env, id);
            return new Response(null, { status: 204, headers: CORS_HEADERS });
          }
        }
        if (segments.length === 4 && segments[3] === "share") {
          const id = segments[2];
          const owner = ownerOf(request);
          if (!owner)
            return badRequest("missing X-Owner-Id");
          const existing = await getDiagram(env, id);
          if (!existing)
            return notFound();
          if (existing.ownerId !== owner)
            return forbidden();
          if (request.method === "GET") {
            const links = await listShareLinks(env, id);
            return json({ links });
          }
          if (request.method === "POST") {
            const body = await request.json().catch(() => ({}));
            const role = body.role === "view" ? "view" : "edit";
            const code = generateShareCode();
            const link = await createShareLink(env, id, code, role);
            return json({ link }, { status: 201 });
          }
          if (request.method === "DELETE") {
            const links = await listShareLinks(env, id);
            for (const link of links)
              await deleteShareLink(env, link.code);
            await setDiagramShare(env, id, false, null);
            return json({ shareable: false, shareCode: null });
          }
        }
        if (segments.length === 5 && segments[3] === "share") {
          const id = segments[2];
          const code = segments[4];
          const owner = ownerOf(request);
          if (!owner)
            return badRequest("missing X-Owner-Id");
          const existing = await getDiagram(env, id);
          if (!existing)
            return notFound();
          if (existing.ownerId !== owner)
            return forbidden();
          if (request.method === "DELETE") {
            await deleteShareLink(env, code);
            return new Response(null, { status: 204, headers: CORS_HEADERS });
          }
        }
        if (segments.length === 4 && segments[3] === "ws") {
          const id = segments[2];
          const stub = env.DIAGRAM_ROOM.get(env.DIAGRAM_ROOM.idFromName(id));
          return stub.fetch(request);
        }
      }
      if (segments[1] === "participants" && segments.length === 3) {
        const id = segments[2];
        if (request.method === "GET") {
          const p = await getParticipant(env, id);
          return p ? json({ participant: p }) : notFound();
        }
        if (request.method === "PUT") {
          const body = await request.json();
          if (!body.name || !body.color)
            return badRequest("missing name/color");
          const existing = await getParticipant(env, id);
          const now = Date.now();
          const p = {
            id,
            name: body.name,
            color: body.color,
            createdAt: existing?.createdAt ?? now
          };
          await upsertParticipant(env, p);
          return json({ participant: p });
        }
      }
    } catch (err) {
      console.error("api error", err);
      return json(
        { error: "internal_error", message: String(err.message ?? err) },
        { status: 500 }
      );
    }
    return notFound();
  }
};

// ../../node_modules/.pnpm/wrangler@3.114.17_@cloudflare+workers-types@4.20260529.1/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../node_modules/.pnpm/wrangler@3.114.17_@cloudflare+workers-types@4.20260529.1/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-lkHFDF/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../node_modules/.pnpm/wrangler@3.114.17_@cloudflare+workers-types@4.20260529.1/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-lkHFDF/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  DiagramRoom,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
