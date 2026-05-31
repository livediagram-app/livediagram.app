# API app

The HTTP + WebSocket layer the live editor calls for diagram persistence and realtime collab.

- **Workspace:** `apps/api` (`@livediagram/api`).
- **Worker name:** `livediagram-api`.
- **Mount:** routed from the [router worker](08-router-app.md) at `/api/*`. The router forwards the request as-is — the api worker sees the full `/api/...` path.

## Why this exists

The first prototype phase ([spec 02](02-prototype-scope.md)) ran entirely client-side with `localStorage` persistence. Once realtime collaboration entered scope, server state became necessary: a Durable Object holds the in-room participant list and broadcasts ops between connected clients, and D1 owns the durable diagram snapshot. The live app no longer reads or writes `localStorage` for diagrams — `apps/live/lib/api-client.ts` is the single boundary.

## Tech

- **Runtime:** Cloudflare Workers.
- **DB:** Cloudflare D1 (binding `DB`). Schema lives in `apps/api/migrations/`; each numbered file is one applied change. Treat the migration log as the source of truth on the schema — features get a migration each, so the count grows.
- **Realtime:** Cloudflare Durable Objects (`DiagramRoom`, binding `DIAGRAM_ROOM`). One instance per diagram id, identified by the diagram's UUID via `idFromName`.

## Wire-format types

The DTO shapes the api worker emits + the live editor consumes live in `packages/api-schema` (`@livediagram/api-schema`) — `Diagram`, `TabSummary`, `TabRecord`, `Folder`, `ShareLink`, `ChangeLogEntry`, `ServerMessage` / `ClientMessage`, etc. Both apps import them; the api worker also re-exports under historical `XxxDTO` aliases (`apps/api/src/types.ts`) for backward compatibility with its existing call sites.

Defining the wire shapes once means server and client cannot drift — adding a field on one side without updating the other is a typechecker error. **Do not redefine these types inline in `apps/api/` or `apps/live/`**; extend the schema package instead. Per CLAUDE.md the reuse-over-duplication rule is non-negotiable.

## Auth (TODO)

The API is currently **open** — no auth on any endpoint. Owner identity is carried by an `X-Owner-Id` header set by the live app to the current participant id. The participant id is a `crypto.randomUUID()` minted on first visit and persisted in `localStorage` under the bootstrap key `livediagram:v2:self-id`.

Clerk is the planned replacement (per [spec 04](04-auth-and-guest-access.md)). When it lands, `X-Owner-Id` becomes the verified Clerk user id; guests keep the localStorage path and migrate their diagrams on sign-up.

## Endpoints

All JSON. CORS allows any origin (the live app is same-origin via the router; this is mostly a dev convenience). Routes are dispatched in `apps/api/src/index.ts` — that file is short enough to skim for the authoritative list.

Owner-only routes require `X-Owner-Id`; shared-edit routes accept `X-Owner-Id` + `X-Share-Code` from visitors holding an edit-role share link.

**Diagrams (meta)**

| Method | Path                       | Auth        | Notes                                                                  |
| ------ | -------------------------- | ----------- | ---------------------------------------------------------------------- |
| GET    | `/api/diagrams`            | owner       | List the caller's diagrams, newest first.                              |
| POST   | `/api/diagrams`            | owner       | Body `{ id, name, tabs?, folderId? }`. Seeds tabs inline when present. |
| GET    | `/api/diagrams/:id`        | owner       | Returns the diagram meta; 404 if owner mismatch (no existence leak).   |
| PUT    | `/api/diagrams/:id`        | owner/share | Body `{ name?, tabIds? }` — rename and/or reorder tabs.                |
| DELETE | `/api/diagrams/:id`        | owner       |                                                                        |
| PUT    | `/api/diagrams/:id/folder` | owner       | Body `{ folderId: string \| null }` — move into a folder or Unsorted.  |

**Tabs (per-tab content — see [13-per-tab-storage.md](13-per-tab-storage.md))**

| Method | Path                            | Auth        | Notes                                                                            |
| ------ | ------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| GET    | `/api/diagrams/:id/tabs/:tabId` | owner/share | Returns one tab's full payload (elements + per-tab settings).                    |
| PUT    | `/api/diagrams/:id/tabs/:tabId` | owner/share | Replaces the tab's body. Body is the `Tab` shape.                                |
| DELETE | `/api/diagrams/:id/tabs/:tabId` | owner/share | Drops the tab row; the diagram's `tabIds` order is fixed up via a follow-up PUT. |

**Share links (multiple per diagram — see [04-auth-and-guest-access.md](04-auth-and-guest-access.md))**

| Method | Path                            | Auth  | Notes                                                         |
| ------ | ------------------------------- | ----- | ------------------------------------------------------------- |
| GET    | `/api/share/:code`              | none  | Resolves a share code to `{ diagram, role }`. 404 if revoked. |
| GET    | `/api/diagrams/:id/share`       | owner | List the diagram's share links.                               |
| POST   | `/api/diagrams/:id/share`       | owner | Body `{ role: 'edit' \| 'view' }`. Returns the minted link.   |
| DELETE | `/api/diagrams/:id/share/:code` | owner | Revoke a single link.                                         |

**Change log (audit + activity panel — see [12-activity-and-audit.md](12-activity-and-audit.md))**

| Method | Path                                | Auth        | Notes                               |
| ------ | ----------------------------------- | ----------- | ----------------------------------- |
| GET    | `/api/diagrams/:id/log`             | owner/share | Up to N most recent entries.        |
| POST   | `/api/diagrams/:id/log`             | owner/share | Append one entry.                   |
| DELETE | `/api/diagrams/:id/log/:entryId`    | owner/share | Drop an entry (Undo / Revert path). |
| DELETE | `/api/diagrams/:id/log?tab=<tabId>` | owner/share | Clear all entries for one tab.      |

**Folders (Explorer organisation — see [15-folders.md](15-folders.md))**

| Method | Path               | Auth  | Notes                                                |
| ------ | ------------------ | ----- | ---------------------------------------------------- |
| GET    | `/api/folders`     | owner | List the owner's folders (flat — parentId nests UI). |
| POST   | `/api/folders`     | owner | Body `{ id, name, parentId? }`. Cycle-checked.       |
| PUT    | `/api/folders/:id` | owner | Body `{ name?, parentId? }`. Cycle-checked.          |
| DELETE | `/api/folders/:id` | owner | Children get promoted; diagrams move to Unsorted.    |

**Realtime + participants**

| Method | Path                    | Notes                                                           |
| ------ | ----------------------- | --------------------------------------------------------------- |
| GET    | `/api/diagrams/:id/ws`  | WebSocket upgrade — connects to the `DiagramRoom`.              |
| GET    | `/api/participants/:id` | Fetch a participant by id.                                      |
| PUT    | `/api/participants/:id` | Upsert `{ name, color }`. Open — no auth check (prototype-era). |

## Realtime model

The `DiagramRoom` Durable Object holds the live state for one diagram id. Clients connect via the `/ws` endpoint and immediately send a `hello` identifying themselves; the room broadcasts a `presence` snapshot whenever the set changes.

Edits propagate via opaque `op` messages. The room never inspects or persists them — it just rebroadcasts to peers. The op vocabulary (defined in `apps/live/lib/api-client.ts` as `RoomOp`):

| Kind           | Carries                                      | Purpose                                                                                                                                                                                                                                                                                    |
| -------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tab`          | `{ tabId, tab }`                             | One tab's full body changed. Receivers merge by id.                                                                                                                                                                                                                                        |
| `diagram-meta` | `{ name, tabs: { id, name, orderIndex }[] }` | Diagram rename / tab add / tab delete / tab reorder.                                                                                                                                                                                                                                       |
| `log`          | `{ entry }`                                  | A new change-log entry just persisted. Peers mirror it into their Activity Panel without a refetch.                                                                                                                                                                                        |
| `log-remove`   | `{ entryId }`                                | The entry was removed (Undo / Revert).                                                                                                                                                                                                                                                     |
| `tab-focus`    | `{ tabId }`                                  | Sender switched to a tab. Drives per-tab participant dots in the TabBar.                                                                                                                                                                                                                   |
| `select`       | `{ elementId \| null }`                      | Sender's selected element changed; renders as a coloured ring on the peer's canvas.                                                                                                                                                                                                        |
| `cursor`       | `{ tabId, x \| null, y \| null }`            | Cursor position in canvas coordinates. `null` hides the indicator (cursor left the surface).                                                                                                                                                                                               |
| `laser`        | `{ tabId, x, y }`                            | One sample of the sender's laser-pointer trail (canvas-coords). Throttled to ~30 Hz like `cursor`. Receivers append to a per-participant buffer and fade over ~1 s; rendered in the sender's identity colour. See [spec/09 → Canvas tools](09-canvas-and-command-palette.md#canvas-tools). |

Conflict resolution is **last-writer-wins** on `tab` and `diagram-meta` ops. When a client receives one it replaces its local copy and skips the next debounced save (a ref flag prevents the obvious echo loop). Per-tab granularity (vs the original full-diagram `tabs` op) means concurrent edits to _different_ tabs no longer clobber each other — see [13-per-tab-storage.md](13-per-tab-storage.md).

This is still intentionally crude — operational-transform / CRDT remains out of scope. Two clients editing the same tab simultaneously clobber on the slower writer.

The room never touches D1; persistence is the REST `PUT /api/diagrams/:id/tabs/:tabId` call, fired from the live app's debounced save effect.

## Data model

The schema starts at `0001_init.sql` and evolves migration-by-migration; the migration files double as commit history of the shape. Today, in broad strokes:

- **`diagrams`** — id, owner, name, share flag, folder fk, timestamps. The original `data` JSON column was dropped in migration 0006 once tabs moved to their own rows.
- **`tabs`** — one row per tab keyed on `(id)`, FK to `diagrams(id)` with `ON DELETE CASCADE`. The body lives in a `data` JSON blob (elements + per-tab settings — theme, background, lock). Order is tracked by `order_index`. See [13-per-tab-storage.md](13-per-tab-storage.md) for why.
- **`participants`** — id, name, color. Volatile presence/status state stays on the wire.
- **`share_links`** — code → diagramId + role. Multiple links per diagram are supported; revoking a link is a row delete.
- **`change_log`** — per-diagram audit entries that drive the Activity Panel + Revert path. See [12-activity-and-audit.md](12-activity-and-audit.md).
- **`folders`** — id, owner, name, optional self-referential `parent_id`. Diagrams reference a folder via `diagrams.folder_id`. Both FKs `ON DELETE SET NULL` so deleting a folder promotes its children. Cycle prevention is enforced in the API layer (D1 can't declaratively).

Document-store hybrid: meta + folder + share state lives in real columns; element content lives in tab `data` JSON. Element-level SQL filtering isn't a use case today, so normalising element rows would buy nothing — and the editor already round-trips JSON for every save.

## One-time setup

Before the first deploy:

1. `pnpm --filter @livediagram/api exec wrangler d1 create livediagram`
2. Copy the printed `database_id` into `apps/api/wrangler.toml` (replacing `TODO_RUN_WRANGLER_D1_CREATE`).
3. `pnpm --filter @livediagram/api run db:migrate:remote` to apply migrations.

After that, GitHub Actions handles deploys via `deploy.yml` (`deploy-api` step). The router's service binding to `livediagram-api` means the API must deploy before the router.
