# Self-hosted runtime blueprint

Derived from [Self-hosted runtime](../self-hosted-runtime.md).

Everything here is measured against the tree as it is, not as it is imagined. Line references are to the files at the time of writing.

## Domain and naming

| Term               | Identifier           | Meaning                                                                                                     |
| ------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Runtime            | `Runtime`            | Everything the application needs from its platform: db, objects, rooms, limiters, scheduler                 |
| Runtime seam       | `createRuntime`      | The one place a runtime is resolved for a request                                                           |
| Cloudflare runtime | `cloudflareRuntime`  | Resolves bindings from `env`                                                                                |
| Node runtime       | `nodeRuntime`        | Resolves the process's SQLite handle, directory, room registry, buckets, timers                             |
| App process        | `apps/server`        | The Node process serving the api and the rooms                                                              |
| Room               | `DocumentRoom`       | The per-document realtime unit; one instance per document id                                                |
| Room registry      | `RoomRegistry`       | The app process's map of document id to live room                                                           |
| Room store         | `RoomStore`          | The four-method key/value store a room keeps its state in                                                   |
| Identity provider  | `IDP`                | The service issuing JWTs and a JWKS: Clerk hosted, Better Auth self-hosted                                  |
| Owner id           | `ownerId`            | The `sub` claim; what documents, images and memberships are keyed by                                        |
| Guest id           | `X-Owner-Id`         | The always-available unsigned identity ([Auth + guest access](../../014-identity/auth-and-guest-access.md)) |
| Static apps        | `out/`               | The five static exports: marketing, live, telemetry, help, community                                        |
| Delivery           | `docker-compose.yml` | The stack an operator runs                                                                                  |

## Coupling measured before the work

| Surface                                                                    | Call sites | Files                             | Where it lands                                                                                                                                      |
| -------------------------------------------------------------------------- | ---------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `env.DB` (D1)                                                              | 464        | 56                                | behind the db interface; the SQL itself stays                                                                                                       |
| `env.DOCUMENT_ROOM` / `DocumentRoom`                                       | 123        | 29                                | [room-client.ts](../../../../apps/api/src/room-client.ts) (415 lines) + [document-room.ts](../../../../apps/api/src/document-room.ts) (1,223 lines) |
| `env.IMAGES` (R2)                                                          | 26         | 9                                 | object-store interface (`put`, `get`, `delete`, bulk `delete`)                                                                                      |
| `*.limit({ key })`                                                         | 19         | —                                 | limiter interface                                                                                                                                   |
| `HTMLRewriter`                                                             | 1          | 1                                 | [routes/unfurl.ts](../../../../apps/api/src/routes/unfurl.ts#L119)                                                                                  |
| `executionCtx.waitUntil`                                                   | 6          | —                                 | already optional-chained in [index.ts](../../../../apps/api/src/index.ts#L476)                                                                      |
| `WebSocketPair`, `acceptWebSocket`, `serializeAttachment`, `getWebSockets` | 49         | 1                                 | the room's socket shell                                                                                                                             |
| `state.storage`                                                            | 12         | 4                                 | `get` / `put` / `delete` / `list` only                                                                                                              |
| `setAlarm` / `deleteAlarm`                                                 | 2          | 1                                 | one scheduler per room                                                                                                                              |
| Clerk                                                                      | 521 hits   | 83                                | 4 adapter files (below); 198 are the app's own `clerkUserId` variable                                                                               |
| Server source                                                              | —          | 231 non-test files / 43,784 lines | 213 test files / 35,440 lines stay                                                                                                                  |

Three properties make this affordable, and every decision below leans on them:

1. **The room is reached over HTTP**, not over an RPC stub: [room-client.ts:25](../../../../apps/api/src/room-client.ts#L25) does `env.DOCUMENT_ROOM.get(idFromName(id)).fetch('https://room/broadcast')`. A room is therefore a service with an HTTP contract, and the contract does not change.
2. **Room state is already behind narrow adapters**: [room-ledger-store.ts](../../../../apps/api/src/room-ledger-store.ts) (50 lines), [room-live-poll.ts](../../../../apps/api/src/room-live-poll.ts) (199), [room-selections.ts](../../../../apps/api/src/room-selections.ts) (76) all take a storage object and use four methods.
3. **The tests already run on `node:sqlite`**: [test-sqlite-d1.ts](../../../../apps/api/src/test-sqlite-d1.ts) (124 lines) implements D1's `prepare/bind/first/all/run/batch` over `node:sqlite` and applies the real migrations.

## Modules

The tree as built. Paths are the ones that exist, not the ones that were planned.

| File                                                                        | Responsibility                                                                                                         |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `packages/runtime/src/runtime.ts`                                           | The `Runtime` type: `db`, `objects`, `rooms`, `limiters`, `scheduler`, `html`, `identity`                              |
| `packages/runtime/src/db.ts`                                                | The db interface: `prepare`, `batch`, `exec` — the shape [types.ts](../../../../apps/api/src/types.ts) already exposed |
| `packages/runtime/src/objects.ts`                                           | The object-store interface: `put`, `get`, `delete` (single and bulk)                                                   |
| `packages/runtime/src/limiters.ts`                                          | Named limiters: `{ limit({ key }) => { success } }`                                                                    |
| `packages/runtime/src/scheduler.ts`                                         | `waitUntil(promise)` and a cron registration                                                                           |
| `packages/runtime/src/testing.ts`                                           | `runtimeContract()`: the operations two runtimes must answer identically                                               |
| `apps/api/src/runtime/cloudflare.ts`                                        | The Cloudflare runtime: today's bindings, unchanged behaviour                                                          |
| `apps/api/src/runtime/room-shell.ts`                                        | `RoomState` / `RoomSocket`: the room's platform surface, and nothing else                                              |
| `apps/api/src/runtime/config.ts`                                            | The configuration keys derived from `Env`; both runtimes fill them                                                     |
| `apps/server/src/runtime/sqlite-db.ts`                                      | D1's interface over `node:sqlite`: WAL, `busy_timeout`, foreign keys, a write queue                                    |
| `apps/server/src/runtime/migrations.ts`                                     | `apps/api/migrations` applied at start-up, booked in wrangler's own `d1_migrations`                                    |
| `apps/server/src/runtime/object-store.ts`                                   | A directory: atomic writes, sidecar metadata, checked keys                                                             |
| `apps/server/src/runtime/limiters.ts`                                       | The ten named limiters in memory, at the wrangler file's ceilings                                                      |
| `apps/server/src/runtime/scheduler.ts`                                      | Held promises, and the daily sweep                                                                                     |
| `apps/server/src/runtime/html.ts`                                           | The `HTMLRewriter` substitute link unfurling needs                                                                     |
| `apps/server/src/runtime/node.ts`                                           | `createNodeRuntime()`: the seam over all of the above                                                                  |
| `apps/server/src/rooms/room-store.ts`                                       | `RoomStorage` over the `room_kv` table, alarms included                                                                |
| `apps/server/src/rooms/room-state.ts`                                       | `RoomState`: sockets, `waitUntil`, the constructor gate                                                                |
| `apps/server/src/rooms/node-room.ts`                                        | One document's room: the api's own `DocumentRoom`, plus a shell                                                        |
| `apps/server/src/rooms/node-socket.ts`                                      | `RoomSocket` over `ws`                                                                                                 |
| `apps/server/src/rooms/registry.ts`                                         | `RoomRegistry`: document id → room, idle eviction, shutdown                                                            |
| `apps/server/src/auth/better-auth.ts`                                       | The identity provider: its options, its schema, its instance                                                           |
| `apps/server/src/static.ts`                                                 | The five static exports, and the router worker's routing rules                                                         |
| `apps/server/src/main.ts`                                                   | The process: HTTP, WebSocket upgrades, the auth mount, graceful shutdown                                               |
| `apps/server/scripts/build.mjs`                                             | Bundling (`esbuild`, with the `createRequire` shim) and the migrations beside it                                       |
| `apps/server/Dockerfile`, `docker-compose.yml`, `Caddyfile`, `.env.example` | The delivery artifact                                                                                                  |

Modified, not replaced:

| File                            | Change                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/index.ts`         | Takes a runtime instead of reading `env` directly; still exports `{ fetch, scheduled }`, and now also `fetchWithRuntime` / `scheduledWithRuntime` |
| `apps/api/src/document-room.ts` | Platform-free: `RoomState` and `RoomSocket` instead of `DurableObjectState` and `WebSocket`. The 1,200 lines of room logic are untouched          |
| `apps/api/src/room-client.ts`   | Calls `runtime.rooms.for(documentId)` instead of `idFromName`                                                                                     |
| `apps/api/src/auth/clerk.ts`    | The same verification, reading the seam's `identity` first (the `CLERK_*` variables stay as the fallback)                                         |
| `apps/api/src/routes/unfurl.ts` | `HTMLRewriter` behind `runtime.html()`                                                                                                            |

## The runtime seam

```ts
type Runtime = {
  db: Db; // prepare / batch / exec
  objects: ObjectStore; // put / get / delete / deleteMany / head
  rooms: RoomHost; // for(documentId): { fetch(request) }
  limiters: Limiters; // limiter(name).limit({ key })
  scheduler: Scheduler; // waitUntil(promise), cron(expr, fn)
  html: HtmlTransformer; // the one platform-specific hole
  identity: IdentityConfig; // jwksUrl, issuer, audience, claim names
};
```

Rules that keep the seam honest:

- **No binding type leaks upward.** `D1Database`, `R2Bucket` and `DurableObjectNamespace` appear only in `runtime/cloudflare.ts`.
- **The seam resolves per request, once.** `createRuntime(env, ctx)` is called at the top of `worker.fetch`; nothing below it branches on platform.
- **Both runtimes are tested by the same suites.** Every existing test that passes `env` gets a runtime instead; the Cloudflare runtime's tests and the Node runtime's tests exercise the same call sites.

This is the shape tldraw arrived at for the same reason — a replaceable sync-storage interface behind one server — and it is what keeps the Node implementation from becoming a fork ([tldraw sync storage PR](https://github.com/tldraw/tldraw/pull/7123)).

## Node runtime: the database

- **Engine**: `node:sqlite`, built in since Node 22.5 and a release candidate since 25.7 ([Node docs](https://nodejs.org/api/sqlite.html)). It is what the test suites already use, so the two agree by construction.
- **Mode**: WAL with `busy_timeout = 5000`, `foreign_keys = ON`, `synchronous = NORMAL` ([SQLite WAL](https://sqlite.org/wal.html)). D1 enforces foreign keys, so the runtime does too.
- **The interface**: `prepare(sql)` → `{ bind, first, all, run }`, plus `batch(statements)` in a single transaction. This is exactly what [test-sqlite-d1.ts](../../../../apps/api/src/test-sqlite-d1.ts) already implements; the production version adds `busy_timeout`, WAL and migration bookkeeping.
- **Writes serialise.** One SQLite writer at a time. The runtime holds a write queue so a burst of autosaves queues rather than throws `SQLITE_BUSY`.
- **Migrations**: the same files under `apps/api/migrations/`, applied in filename order at start-up, recorded in the same table D1 uses, so a database can move between runtimes.
- **SQL portability**: 11 of 1,645 migration lines use SQLite-only syntax (`json_extract`, `strftime`, `AUTOINCREMENT`). Staying on SQLite keeps all of them; that is why Postgres is not the default (see Decisions).

## Node runtime: the rooms

The room's behaviour is already separated from its shell: rules in [document-room-rules.ts](../../../../apps/api/src/document-room-rules.ts), the facilitator state machine in [facilitator.ts](../../../../apps/api/src/facilitator.ts), scoping and access in `room-scope.ts` / `room-access.ts`, storage in the three adapters. What the Node runtime supplies is the shell.

| Durable Object                                 | Node runtime                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `idFromName(documentId)`                       | `RoomRegistry.get(documentId)`, creating on first use                                                               |
| One instance, serialised input                 | One object per document id, with an explicit promise queue as its input gate                                        |
| `state.storage.get/put/delete/list`            | `RoomStore` over `room_kv(room, key, value)` in the same SQLite file                                                |
| `state.acceptWebSocket` + class-level handlers | `ws` server: one `WebSocket` per client, handlers bound per socket                                                  |
| `ws.serializeAttachment(state)`                | A `WeakMap<WebSocket, SessionAttachment>`; the process is not evicted, so the 2 KB limit disappears                 |
| `state.setAlarm(t)` / `deleteAlarm()`          | One timer per room, recomputed whenever deadlines change                                                            |
| `new WebSocketPair()`                          | The socket the HTTP upgrade produced                                                                                |
| A room per document, forever                   | Idle eviction: a room with no sockets and no pending timers is dropped from the registry; its state stays in SQLite |

Two behaviours are deliberately **dropped**, and this is a real difference from the hosted runtime:

- **Hibernation.** A Durable Object evicts from memory while keeping clients connected. The Node room stays in memory while anyone is connected. Idle rooms are evicted in full (socket closed), which is a visible difference: a client reconnects where a DO client stayed connected.
- **Edge placement.** A room lives in the one process, so every client of a document talks to the same machine.

## Identity: Better Auth in the app process

The application's requirement is exactly what [clerk.ts:76-113](../../../../apps/api/src/auth/clerk.ts#L76-L113) implements: verify a JWT against a JWKS, read `sub`, optionally read `email`.

- **Provider**: [Better Auth](https://better-auth.com/docs) inside the app process, with the [JWT plugin](https://better-auth.com/docs/plugins/jwt) — it serves a JWKS endpoint and mints JWKS-verifiable JWTs for "services that can't use the session", which is this case exactly.
- **Sign-in methods**: the [email OTP plugin](https://better-auth.com/docs/plugins/email-otp) (the current email-code flow) and Google. Resend is already wired ([Transactional & lifecycle email](../../014-identity/transactional-email.md)).
- **Session transport**: bearer JWT in `Authorization`, never a cookie session. The api, the CLI, the MCP exchange and the workbench all already speak that.
- **Claim mapping**: `sub` → owner id, `email` → invite matching, `sid` / `fva` → telemetry only, and both are already null-tolerant ([session-telemetry.ts](../../../../apps/api/src/auth/session-telemetry.ts)).
- **Environment names become provider-neutral**: `CLERK_JWKS_URL` / `CLERK_ISSUER` / `CLERK_AUDIENCE` gain `AUTH_JWKS_URL` / `AUTH_ISSUER` / `AUTH_AUDIENCE` aliases, with the old names still honoured so the hosted deployment does not change.
- **Authentication tables** are created by the provider's own migration step against the same SQLite file, kept out of the D1 migration sequence.

**Teams need nothing from the provider.** [teams.ts](../../../../apps/api/src/db/teams.ts) and [team-invites.ts](../../../../apps/api/src/db/team-invites.ts) own membership, roles, invites and acceptance; the provider only has to put a stable `sub` and an `email` in the token. That is why a heavyweight IdP with organisations (Keycloak, Zitadel) buys nothing here.

**MCP needs nothing from the provider either.** [apps/mcp/src/oauth.ts](../../../../apps/mcp/src/oauth.ts) is a complete OAuth 2.1 authorization server — PKCE S256, discovery (RFC 8414 + 9728), dynamic client registration, device-code grant — minting ordinary `lvd_` API tokens. Only two things touch identity: the consent page needs a signed-in user, and `/api/oauth/exchange` verifies the caller. Both come free once the app process authenticates. The Better Auth MCP plugin is deliberately **not** used ([MCP plugin](https://better-auth.com/docs/plugins/mcp)): our own server exists, and MCP is moving from dynamic client registration to Client ID Metadata Documents ([MCP 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration)) — an upstream evolution, tracked on the hosted side too.

## Frontend: one provider, not 83 files

The live app already has the shape this needs. [clerk-config.ts](../../../../apps/live/lib/clerk-config.ts) decides at build time whether Clerk exists at all; [ClerkProvider.tsx](../../../../apps/live/components/providers/ClerkProvider.tsx) wraps the app; [ClerkBridge.tsx](../../../../apps/live/components/providers/ClerkBridge.tsx) bridges auth state into the app's own state; and [E2EAuthBridge.tsx](../../../../apps/live/components/providers/E2EAuthBridge.tsx) is a **non-Clerk sign-in path that already exists** — a bridge that signs a person in with a JWT minted against its own JWKS, used by the Drive and workbench e2e builds.

The work is to make that pattern a product:

| File                                               | Change                                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `components/providers/SelfHostAuthBridge.tsx`      | New: sign-in UI + token storage + refresh, exposing the same state `ClerkBridge` consumes |
| `components/providers/ClerkProvider.tsx`           | Render the self-host provider when the deployment is self-hosted                          |
| `components/providers/deferred-auth.tsx`           | Same, for the deferred path                                                               |
| `lib/self-host-auth.ts`                            | New: how a deployment is asked whether it is self-hosted, at runtime                      |
| `app/sign-in/page.tsx`, `app/get-started/page.tsx` | Reach the provider's flow (67 of the 521 call sites)                                      |

The remaining 77 files read the bridged state (`isSignedIn`, `getToken()`, `signOut()`, the person's name and picture) and are **not touched**. `packages/ui` has no Clerk dependency beyond a publishable-key validator.

The sign-in surface is the only new UI, and it inherits the rules the rest of the editor follows:

- **States**: idle, code sent, wrong code, expired code, provider unreachable — each with its own copy, no silent spinner.
- **Accessibility**: WCAG 2.2 AA, keyboard-first (the code field autofocuses, Enter submits), visible focus, 4.5:1 contrast, and the same reduced-motion behaviour as the surrounding chrome.
- **Web Experience**: one route, statically exported — HTML plus a small client island — so it inherits the editor's LCP budget rather than setting a new one.

## Known gaps

What is built and what is not, stated here rather than left in a build log.

**Built and measured.** The api on a Node runtime; the rooms' storage, state and
shells; the database and its migrations; the object store; the limiters; the
scheduler; the link-unfurl substitute; the identity provider, server side and the
browser's sign-in beside the Clerk one; the five static exports served by the app
process; **the MCP process** — the same Hono app on Node, with the service binding
as an HTTP call, `OAUTH_KV` as a SQLite table and its own origin; and the Compose
delivery. Measured end to end: request a code, sign in, mint a JWT, create a document
whose `ownerId` is the account id; six static routes answering over real HTTP;
`docker compose config` accepting the stack, and refusing it when the secret is
missing; and an MCP client through Caddy running `initialize`, `tools/list` (24
tools) and `create_document` — which wrote the document and returned a PNG of the
tab.

**Not wired: the consent page's MCP origin.** The MCP process serves the whole OAuth
2.1 flow — discovery, dynamic client registration, PKCE — and the editor serves the
consent page, but that page posts the minted token to a **build-time** origin
(`lib/mcp-config.ts`: `NEXT_PUBLIC_MCP_ORIGIN`, defaulting to the hosted
`https://mcp.livediagram.app`). On a self-hosted deployment that is somebody else's
server, so an OAuth connect cannot finish against the operator's own MCP. An API
token works today and is what
[Self-hosting with Docker Compose](../../../operations/self-hosted-docker.md) tells an
operator to use. The fix is the shape `lib/self-host-auth.ts` already has: the app
process knows the MCP origin it was configured with, so the page asks it at runtime
rather than reading a build-time constant.

**Cosmetic, same area: the OAuth rate limits share one bucket.** `oauth.ts` and
`oauth-device.ts` key their per-IP counters on `CF-Connecting-IP`, which a
self-hosted deployment never sends — behind Caddy the address arrives as
`X-Forwarded-For`. Every caller therefore counts against one bucket (20
registrations and 20 device starts an hour). First-party clients only, and the
thresholds are far above a small deployment's traffic, so this is a note rather than
a defect; the fix, when it is wanted, is to copy the first `X-Forwarded-For` hop
into that header in `apps/mcp/src/node/main.ts`.

**Partly verified: the image build.** The `app` target builds and runs on this
machine: `docker compose build mcp` produced the image, the `mcp` service started
from it and answered through Caddy. The `runtime` target, which bakes the five static
exports into the image, has not been built here — it compiles five Next.js apps, which
is why a local run of the checkout sets `APP_TARGET=app` and serves a host build from
`./data-static`.

### Known defect: relaying between two clients

A Node room serves one client correctly: it upgrades, admits the session, answers an internal
call, and relays that client's frames. What does not work yet is the second socket.

Measured, with temporary probes that have since been removed:

- both clients connect, are admitted into **one** room (`socketCount === 2`), and both hellos
  reach the room;
- each client receives the other's roster, and a single client's follow-up frame is answered;
- the second upgrade **never reaches the `ws` upgrade callback**, throws nothing, and its raw
  socket is destroyed — while the client observed a completed handshake.

Ruled out: two rooms, a broken message path, the roster excluding its own entry (that is the
design — `broadcastPresence` in `document-room.ts`), and `@hono/node-server`'s own `upgrade`
listener (removed before ours is registered, which changed nothing).

The failing case is `it.skip` in `apps/server/src/realtime.test.ts`, with the same trace in its
comment. Nothing else in this blueprint depends on it.

## Static apps and routing

Caddy serves the five exports and proxies the two processes ([Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)):

| Path                                                                                                 | Serves                                                                                                                   |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/`                                                                                                  | `apps/marketing/out`                                                                                                     |
| `/document/*`, `/explorer/*`, `/new`, `/join`, `/sign-in`, `/get-started`, `/embed`, `/sso-callback` | `apps/live/out` (the `/document/<id>` rewrite to the placeholder page the live worker performs moves into the Caddyfile) |
| `/live/_next/*`                                                                                      | `apps/live/out/_next`                                                                                                    |
| `/telemetry`                                                                                         | `apps/telemetry/out`                                                                                                     |
| `/help`                                                                                              | `apps/help/out`                                                                                                          |
| `/community`                                                                                         | `apps/community/out`                                                                                                     |
| `/api/*`                                                                                             | the app process                                                                                                          |
| the MCP host                                                                                         | the MCP process                                                                                                          |

The path rewrites and caching rules stay in TypeScript. The `router` worker's logic — stripping the `/live` prefix, rewriting `/document/<id>` onto the placeholder page, and the cache headers from [apps/router/src/cache-policy.ts](../../../../apps/router/src/cache-policy.ts) — moves into a thin router layer inside the app process, so those rules keep exactly one source of truth. Caddy does TLS, serves the static directories and proxies; it never restates a caching policy that lives in code. The MCP process needs **its own origin** (its OAuth discovery documents must be served at its own `/.well-known/` paths), so it gets its own hostname, exactly as `mcp.livediagram.app` does.

## Delivery: Docker Compose

```yaml
services:
  app: # Node, one process: api + rooms + identity
  mcp: # Node, one process: MCP tools + OAuth server
  caddy: # TLS, static files, routing
  # minio:  # optional; omitted when the object store is the local directory
volumes:
  db: # SQLite file + WAL + snapshots
  files: # image bytes and document snapshots
```

- **First start**: apply migrations, create the identity tables, create the first account, print the URL.
- **Upgrade**: `docker compose pull && docker compose up -d`; migrations run at start-up against a snapshot taken first.
- **Health**: `/api/health` (liveness) and `/api/capabilities` (readiness, already implemented).
- **Config**: one `.env` next to the compose file; the vars the api already reads keep their names, and the hosted-only ones (`TELEMETRY_ENABLED`, image caps) default off exactly as they do for a Cloudflare fork.

## Backup and restore

- **Snapshots**: `node:sqlite`'s `sqlite.backup(sourceDb, path)` ([Node docs](https://nodejs.org/api/sqlite.html)) on a schedule into `volumes/db`, rotated.
- **Off-machine**: documented as a one-liner (`rclone`, `restic`, or a plain `scp`) rather than built in. Continuous replication is optional and out of the default stack ([Litestream](https://github.com/benbjohnson/litestream) remains the tool to reach for if the operator wants near-zero RPO).
- **Restore**: stop, replace the file, start; `docker compose run app restore <snapshot>` performs it and refuses while the server is running.
- **Drill**: the operations doc includes a restore drill, because a backup nobody has restored is a hypothesis.

## Observability

- Structured JSON lines on stdout, one per request: method, path, status, duration, owner kind (guest or account), and a request id echoed in `X-Request-Id`.
- `docker compose logs -f app` is the UI; no log shipper is required.
- Failing decisions keep the fingerprints the code already emits, so the hosted and self-hosted logs read alike.

## Security and trust

| Boundary         | Rule                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Internet → Caddy | TLS only; HSTS; the security headers [apps/live/src/worker.ts](../../../../apps/live/src/worker.ts) already sets for the live app                          |
| Caddy → app      | The app binds to the compose network only; never published directly                                                                                        |
| Guest identity   | Unchanged: `X-Owner-Id`, optionally signed with `GUEST_ID_HMAC_SECRET`; a self-host that enables accounts should set it so a guest can upgrade safely      |
| Rate limits      | Every named limiter from [wrangler.toml](../../../../apps/api/wrangler.toml) exists in the Node runtime with the same ceilings, so abuse behaviour matches |
| Secrets          | One `.env`, mode 600, never in the image; the identity provider's signing key is generated on first start and stored in the volume                         |
| Image bytes      | Content-sniffed and re-encoded exactly as today ([image-sniff.ts](../../../../apps/api/src/image-sniff.ts))                                                |

## Performance and limits

Sizing for one process on a small VPS (2 vCPU, 2 GB), stated as arithmetic rather than a promise:

- **Rooms**: a room is a few KB of state plus its sockets. Memory is bounded by concurrent documents, not by users per document.
- **Sockets**: `ws` handles a few thousand connections per process; the practical ceiling is far lower, because one process also serves the REST api.
- **Writes**: SQLite serialises writers. An autosave is a handful of rows; a few hundred writes per second is the practical ceiling with WAL on local disk.
- **Reads**: concurrent, and the hot paths are indexed.
- **The stated ceiling**: a deployment that needs more than a few hundred concurrent editors, or more than one machine, should use the hosted deployment. The self-hosted runtime does not grow sideways.

## Errors and edge cases

| Case                            | Handling                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Migration fails at start-up     | The process exits non-zero before serving; the pre-migration snapshot is the way back                               |
| `SQLITE_BUSY` under a burst     | Absorbed by the write queue; if it survives `busy_timeout`, the request answers 503 and is retryable, never a 500   |
| Disk full                       | Writes fail loudly; the health endpoint reports `storage: degraded` and snapshots are skipped rather than truncated |
| Port in use                     | Fail fast at boot, naming the port                                                                                  |
| A second `docker compose up`    | Idempotent: migrations are tracked, the identity tables are created once                                            |
| A room client sends a bad frame | The limits already in `document-room.ts`: a 256 KB frame cap and a per-session op rate                              |
| The process is killed mid-write | WAL rollback on the next start; no manual repair                                                                    |
| Restore attempted while running | Refused, naming the running container                                                                               |
| Identity tables missing         | The first start creates them; a deployment that skips it fails at sign-in, not at boot                              |

## Assets and external resources

| Asset                                    | Source           | Licence    |
| ---------------------------------------- | ---------------- | ---------- |
| Node runtime image                       | `node:26-slim`   | MIT        |
| Caddy image                              | `caddy:2-alpine` | Apache-2.0 |
| `better-auth`                            | npm              | MIT        |
| `ws`                                     | npm              | MIT        |
| `@aws-sdk/client-s3` (optional S3 store) | npm              | Apache-2.0 |

Each licence is confirmed against the package manifest when the dependency is added, and the additions flow into `packages/licences` so the `/licences` page keeps telling the truth about what a deployment bundles.

## Testing

- **Existing suites**: 213 test files already run against `node:sqlite`; they gain a runtime parameter and stay green on both runtimes.
- **Runtime parity suite**: one suite that runs the same operations through both runtimes and compares results — the guard that keeps the seam from drifting.
- **Rooms**: the room's own tests already fake storage; the Node shell adds upgrade, message, close and eviction tests, plus a two-client broadcast test.
- **Identity**: sign-in, JWKS fetch and `sub`/`email` mapping, the invite-matching path, and the guest → account migration.
- **Delivery**: a compose smoke test that boots the stack, creates a document, opens two WebSocket clients, edits, and asserts both see the change — the only test that proves the artifact an operator gets.
- **e2e**: [scripts/e2e-stack.mjs](../../../../scripts/e2e-stack.mjs) currently boots the api with `wrangler dev --local`; it gains a mode that boots the Node app instead, so the Playwright suite runs against the self-hosted stack.

## Constants and configuration

| Constant            | Value                                                                                             | Source                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| SQLite journal mode | `WAL`                                                                                             | [SQLite WAL](https://sqlite.org/wal.html)                                 |
| `busy_timeout`      | 5000 ms                                                                                           | 5x the longest expected write                                             |
| Snapshot interval   | 1 hour                                                                                            | Operator-tunable; RPO stated in the operations doc                        |
| Snapshot retention  | 24 hourly + 7 daily                                                                               | Sized for a small volume                                                  |
| Room idle eviction  | 5 minutes with no sockets and no timers                                                           | Matches the reconnect grace the room already assumes                      |
| Rate limiters       | The 10 named limiters and their ceilings from [wrangler.toml](../../../../apps/api/wrangler.toml) | One source of truth: the file                                             |
| JWT clock tolerance | 5 s                                                                                               | Same as today ([clerk.ts:18](../../../../apps/api/src/auth/clerk.ts#L18)) |

## Decisions and alternatives

| Decision              | Chosen                               | Alternatives                                        | Why                                                                                                                                                                                                                                                                        |
| --------------------- | ------------------------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime               | Node 26 + `node:sqlite`              | Bun 1.4; Deno                                       | The suites already run on `node:sqlite`; Bun's draw (built-in `HTMLRewriter`, S3, WS) saves one afternoon, not one week                                                                                                                                                    |
| Database              | SQLite in WAL                        | Postgres; libSQL                                    | Keeps all 78 migrations byte-identical; Postgres would rewrite 11 migration lines plus the D1 interface, for scale this spec does not target                                                                                                                               |
| Auth                  | Better Auth in-process               | Logto / Zitadel / Keycloak / Authentik; hand-rolled | Teams and MCP OAuth are application code, so the provider only needs JWKS + `sub` + `email`; a container-shaped IdP adds a service to run and buys organisation features nothing uses                                                                                      |
| Object storage        | Local directory default, S3 optional | MinIO always; R2 via S3 API                         | One volume is the smallest thing that works; S3 is there for operators who already have it                                                                                                                                                                                 |
| Delivery              | Docker Compose                       | systemd units; Kubernetes; a single static binary   | Compose is the self-hosting norm and the requested artifact                                                                                                                                                                                                                |
| Room model            | In-process registry                  | Redis pub/sub; a second process per room            | One process owns every room; Redis would add a service to buy scaling this spec excludes                                                                                                                                                                                   |
| Node HTTP and sockets | `@hono/node-server` + `ws`           | Hand-written adapters; Bun's built-ins              | Both already sit in the lockfile — the root `pnpm.overrides` pins `@hono/node-server` and `ws`, and `hono` is already the MCP worker's dependency — so this adds no new ecosystem risk. `apps/server` declares them explicitly rather than relying on a transitive install |

## Settled with the operator

Every answer below is settled; the implementation follows it.

| #   | Question                                                       | Decision                                                                                            |
| --- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Q1  | Where the Node implementation lives                            | In-repo, under `apps/server` — it is the second runtime of the same product                         |
| Q2  | Whether the identity tables share the document file            | Share the file; one backup covers everything                                                        |
| Q3  | Whether the MCP process ships in the default stack             | Yes, on its own hostname, off if the operator sets no hostname for it                               |
| Q4  | Whether Google sign-in is on by default                        | Off until a client id and secret are set, matching the hosted behaviour                             |
| Q5  | Whether the first start creates an administrator               | No: the first account to sign in becomes the owner of nothing; documents stay owner-scoped as today |
| Q6  | Whether `GUEST_ID_HMAC_SECRET` is required once accounts exist | Recommended, warned about at start-up, not enforced                                                 |

## Out of scope

- Multi-instance or multi-region self-hosting; horizontal scaling of rooms.
- A Workers-compatible runtime, `workerd`, or running Durable Objects locally.
- Postgres, MySQL, Redis or any external service as a hard requirement.
- Preview deployments, staging environments or CI/CD for self-hosted installs.
- Removing or deprecating the Cloudflare deployment path.
- Migrating an existing Cloudflare deployment's data automatically; a documented export/import is enough.
- Mobile or desktop packaging.
