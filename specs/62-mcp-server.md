# 62 — MCP server

**Status: live.** Merged and deployed at `mcp.livediagram.app`; connect flow
verified end-to-end from Claude. Builds directly on [spec/61](61-public-api-and-tokens.md)
(API tokens), which it picks up where §7 left off: spec/61 deferred "OAuth /
third-party app authorization" — this spec adds exactly that, scoped to one
client (an MCP server), reusing the `lvd_` token as the credential it ultimately
mints. No new authorization model; an OAuth front door onto the existing token.

## 1. Goal

Let a person connect livediagram to whatever AI tool they already drive (Claude
desktop/web, Claude Code, any MCP client) and, from inside that tool:

1. **Find and view** the diagrams they already have — search by name, get back a
   link to open in the editor **and an inline image** of the diagram.
2. **Create** a new diagram from a request — e.g. point the AI at a codebase and
   have it produce a diagram of the control flow.
3. **Edit** an existing diagram — full rework of a tab, or a small adjustment.

**The calling LLM does the thinking; the MCP is only the bridge.** This is the
load-bearing decision. We are **not** proxying to the first-party `/api/ai`
endpoint (`apps/api/src/routes/ai.ts`, OpenAI/`gpt-4o`) — that endpoint is weak
and may be removed. The user already has a capable model in front of them; the
MCP's job is to (a) hand that model the diagram **schema** so it can emit
well-formed elements, (b) **validate + lay out** what it produces, and (c)
**persist** it through the same REST API the web app uses. The MCP carries no
model of its own and makes no LLM calls.

**Keep the surface small.** Nine tools and one schema resource (see
[§4](#4-tools)). Each tool is a thin wrapper over an existing `/api` route plus
shared helpers from `packages/diagram`; the MCP adds no business logic that
isn't reusable.

This must not weaken the friction-free guest model
([spec/04](04-auth-and-guest-access.md)) or self-hosting
([spec/03](03-open-source-and-business-model.md)). Like API tokens and teams,
the MCP is **signed-in only** and **absent end-to-end** on a no-auth self-host.

## 2. Architecture

A **new standalone Cloudflare Worker**, `apps/mcp` (worker name
`livediagram-mcp`), mirroring how Manager Toolkit ships its MCP as its own
worker. Not folded into `apps/api`: it has a distinct dependency surface (the MCP
SDK, OAuth/KV, a WASM rasteriser) and a distinct public origin, and `apps/api`
stays a pure REST/WS surface.

- **Framework / transport.** [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol)
  with **Streamable HTTP** transport (`WebStandardStreamableHTTPServerTransport`,
  `enableJsonResponse: true`), fronted by **Hono** for routing/CORS — the exact
  stack proven in the Manager Toolkit MCP. Tools are defined with `zod` input
  schemas.
- **Talks to `apps/api` over a Cloudflare service binding** (`API`), not public
  DNS. Every tool resolves to one or more `/api/*` calls carrying
  `Authorization: Bearer lvd_…` — the caller's token, passed straight through.
  The api worker already accepts `lvd_` tokens on every route
  ([spec/61 §3.3](61-public-api-and-tokens.md)), so **no api authorization
  changes are needed** for the tools themselves.
- **Reuses `packages/diagram`** headless: element factories, `validate.ts`
  (`isValidTab`/`isValidElement`), `auto-layout.ts` (`autoLayoutElements`,
  `isLayoutCandidate`), and a new pure SVG renderer ([§5](#5-visualise--inline-image-render)).
  This is the reuse-over-duplication rule: the MCP must not re-implement layout,
  validation, geometry, or theme-colour resolution.
- **Routing + deploy.** Served at **`mcp.livediagram.app`** (its own hostname,
  like the api). Add the service to the deploy workflow alongside marketing /
  live / telemetry / api (it depends on api existing, so it deploys in the same
  wave as api or just after). The `router` worker is unchanged — `mcp.` is a
  separate host, not a path under the main hostname, so it carries no router
  business logic. `GET /health` returns `{ status: 'ok' }`.
- **Endpoints on the worker:** `POST /mcp` (the MCP transport, Bearer-gated),
  the OAuth endpoints ([§3](#3-authentication-oauth-21)), and `/health`.

## 3. Authentication: OAuth 2.1

The MCP authenticates with **OAuth 2.1 + PKCE (S256) + dynamic client
registration**, so a user gets a one-click "Connect" in their AI tool rather
than pasting a raw token. The flow **mints an `lvd_` token** under the hood and
hands it to the client; from then on every request is just
`Authorization: Bearer lvd_…`. This deliberately reuses the entire token model
from [spec/61](61-public-api-and-tokens.md) — storage, hashing, 6-month expiry,
per-account cap, revoke, account-deletion cascade, rate limiting — instead of
inventing a parallel credential. An MCP-minted token is an ordinary API token;
it appears in the Explorer "API tokens" page and can be revoked there like any
other.

This implements the OAuth flow Manager Toolkit uses:

1. **Discovery** — the MCP worker serves RFC 8414 metadata at
   `/.well-known/oauth-authorization-server` (and the protected-resource
   metadata): `authorization_endpoint`, `token_endpoint`, `registration_endpoint`,
   `code_challenge_methods_supported: ["S256"]`, `token_endpoint_auth_methods_supported: ["none"]`.
2. **Dynamic client registration** — `POST /oauth/register` issues a `client_id`
   (validates HTTPS redirect URIs, or `http://localhost` for dev), stored in KV
   with a TTL. Rate-limited per IP.
3. **Authorize** — `GET /oauth/authorize` creates a short-lived session in KV and
   redirects to a **consent page in `apps/live`** (e.g. `/oauth/authorize` or an
   Explorer "Connect an app" screen), passing the session id. The user is
   already signed in there via Clerk.
4. **Consent + mint** — on approve, `apps/live` calls a **new
   `POST /api/oauth/exchange`** on the api worker. This is the one api change: an
   endpoint that requires a verified Clerk identity (gated exactly like
   `/api/tokens`), and on success **reuses the existing token-mint path**
   (`generateApiToken` → `hashApiToken` → `createApiToken`,
   `apps/api/src/auth/api-token.ts` + `db/api-tokens.ts`) to create an `lvd_`
   token owned by that Clerk user, named for the connecting client (e.g. "Claude
   (MCP)"). It binds the PKCE challenge so only the holder of the verifier can
   redeem it.
5. **Callback + token exchange** — the MCP redirects back to the client with a
   code; `POST /oauth/token` (with the PKCE `code_verifier`) exchanges it for the
   `access_token` (= the `lvd_` secret). `expires_in` reflects the token's
   remaining 6-month lifetime.

**State storage.** Add a **KV namespace binding (`OAUTH_KV`) to `apps/mcp`** for
client registrations, authorize sessions, and codes (all short TTLs). `apps/api`
needs no KV — minting stays in D1 via the existing token table.

**Why OAuth and not just token-paste.** A static-token-paste connector works in
Claude Code / custom connectors, but the polished "Connect" button in claude.ai
web connectors expects OAuth, and the user chose the OAuth path. Because it still
resolves to an `lvd_` token, the heavy lifting (verification, gating, revoke,
caps) is already built — OAuth is the front door, not a new lock.

**Self-hosting / Clerk gating.** OAuth depends on the consent page authenticating
the user via Clerk and on `/api/oauth/exchange` requiring a Clerk identity — the
same gate as `/api/tokens` ([spec/61 §3.7](61-public-api-and-tokens.md)). A
no-auth self-host: the exchange endpoint rejects every caller and the consent
page has no signed-in user, so the MCP can mint nothing. Operators who don't want
the MCP simply don't deploy `apps/mcp`; nothing else references it.

## 4. Tools

Six tools. The search/view capability is two tools (find, then read); create,
add_tab, and update are separate because their inputs and intent differ;
list_templates exposes the template catalogue ([§4.5](#45-list_templates)).

### 4.1 `find_diagrams`

Search/list the caller's diagrams — the **personal library AND every joined
team's shared library** ([spec/35](35-team-shared-diagrams.md)). A diagram
filed into a team leaves its owner's personal list entirely, so the personal
`GET /api/diagrams` alone is not "the user's diagrams": the tool sweeps
`GET /api/teams` + `GET /api/teams/:id/library` alongside it (the api accepts
the token identity on those reads — [spec/61 §3.4](61-public-api-and-tokens.md)),
merges, and ranks newest-saved first. The team sweep is best-effort: a teams
failure degrades to personal-only results, never an error. Input: optional
`query` (name match), `limit`. Returns a compact list:
`{ id, name, updatedAt, library, url }` where `library` is `personal` or the
team's name and `url` is the `livediagram.app` deep link to open it. **No image
here** — kept lightweight so the model can scan many results cheaply, then
`read_diagram` the one it wants.

### 4.2 `read_diagram`

Fetch one diagram's full content **and render it** — this is the "visualise"
capability. Input: `diagramId`, optional `tabId` (defaults to the first tab).
Wraps `GET /api/diagrams/:id` + `GET /api/diagrams/:id/tabs/:tabId`. Returns the
tab's `elements` as structured JSON (so the model can understand and, if asked,
edit it) **plus an inline PNG** of the tab as MCP image content ([§5](#5-visualise--inline-image-render)),
plus the deep-link `url`. So "show me my auth-flow diagram" → `find_diagrams` →
`read_diagram` renders it inline.

### 4.3 `create_diagram`

Create a new diagram from elements the model produced. Input: `name`, `tabs:
[{ name, elements: Element[] }]` (one tab, or several to build a **multi-tab**
diagram in one call — an overview plus a detail tab per subsystem), and the
optional `layout`. Each tab may instead pass `template: TemplateKind` in place
of `elements` — the server materialises the hand-tuned scaffold from
`@livediagram/templates` ([§4.5](#45-list_templates)), keeping its curated
layout (`layout` is ignored for a template tab) and applying that template's
canvas overrides; the model then personalises labels via `update_diagram`'s
`ops` mode. The MCP:

1. **Validates** each tab's `elements` with `isValidTab` (reject `400`-style with
   a clear message naming the offending tab).
2. **Lays out — but the model decides.** A `layout` argument (`'auto'` |
   `'preserve'`, optional) governs it: `'preserve'` keeps the exact coordinates
   the model gave (so it can draw a deliberate shape — a cycle as a ring, a tree,
   a grid), `'auto'` runs `autoLayoutElements`, and **omitted = auto-detect**:
   preserve a real arrangement, but run the layout when the model left nodes
   piled at ~one point (`nodesLookUnplaced`). This realigns with "the calling LLM
   does the thinking" — the server stopped overriding the model's spatial intent
   (which flattened a life-cycle ring into a row). When it does lay out it reuses
   the editor's engine; the model is never _forced_ into pixel-perfect placement.
   Layout only ever arranges the **connected graph** — edgeless content (titles,
   per-node descriptions, captions) passes through at its given position rather
   than being raked into a disconnected-component column.
3. **Tags it as generated.** The create sends `source: 'mcp'`, which the
   Explorer surfaces in a synthetic **Generated** folder (`source != null`,
   spec/15) so a user's own work and AI-generated diagrams stay separate
   without a real, deletable folder. The user can file one into a folder of
   their own afterwards (which moves it out of Generated). (Earlier this
   find-or-created a real "Generated" folder; the provenance tag replaces
   that so the folder is dynamic, like Unsorted.)
4. **Persists** all tabs via `POST /api/diagrams` (which seeds a `tabs[]` array
   and accepts `source`).
5. **Returns** the new `id`, tab count + ids, the folder, the deep-link `url`,
   **and the rendered PNG of the first tab** so the user sees the result inline.

### 4.3a `add_tab`

Add a **new tab** (its own canvas) to an existing diagram — the motivating case:
"make a tab going into more detail on one part of this architecture." Input:
`diagramId`, `name`, `elements`, optional `layout` — or `template: TemplateKind`
instead of `elements`, exactly like a `create_diagram` tab. Validates + lays out
exactly like a `create_diagram` tab, then `PUT /api/diagrams/:id/tabs/:newTabId` — which
is an upsert that also links the tab into the diagram and appends it, so a fresh
tab id creates and orders the tab in one call. Returns the new `tabId`, `url`,
and the rendered PNG. (Pair with `read_diagram`, which lists the diagram's
existing tabs, to decide where a new one fits.)

### 4.4 `update_diagram`

Edit an existing tab. **Two modes** (the user asked for both):

- **`replace`** — for building or reworking a whole tab. Input: full new
  `elements: Element[]` (and the same optional `layout` control as
  `create_diagram`). Validated + laid out exactly like `create_diagram`, then
  `PUT …/tabs/:tabId`. Use when the change is large enough that re-emitting the
  tab is cleaner than patching.
- **`ops`** — for small adjustments. Input: an ordered list of
  `{ op: 'add' | 'update' | 'remove', element? , elementId? }` targeting existing
  element ids. The MCP reads the current tab, applies the ops, validates the
  result, then `PUT`s it. **Auto-layout is NOT run by default** in `ops` mode —
  the point of a granular edit is to preserve the user's existing positions;
  re-laying out would move everything. (A future `relayout: true` opt-in could be
  added if wanted.)

Both modes re-read → apply → validate → write, and return the rendered PNG of the
result. The model picks the mode: rebuild → `replace`; tweak → `ops`.

### 4.5 `list_templates`

Browse the template library — the same hand-tuned catalogue the editor's
Quick Start picker ships (spec/09), served from the shared
`@livediagram/templates` package so the worker and the editor can't drift.
No input. Returns the categories plus one row per template:
`{ kind, title, description, category }` — enough for the model to pick a
`kind` and pass it as `template` on `create_diagram` / `add_tab`. Deliberately
metadata-only (no elements): the scaffold materialises server-side on create,
so the model never has to re-emit — or accidentally mangle — a curated layout.
The recommended flow for "make me a kanban board"-style asks: `list_templates`
→ create with `template` → `update_diagram` (`ops`) to fill in real content.

### 4.6 Schema resource (not a tool)

A static, cacheable MCP **resource** — e.g. `livediagram://schema/elements` —
returning a compact description of the element schema: the element types
(`shape` / `text` / `sticky` / `arrow` / `table` / …), the shape vocabulary,
required fields, the pinned-arrow anchor convention (`from.e → to.w` etc.), and
the design rules that make diagrams read well (don't set colours — the theme
owns them; size siblings consistently; prefer pinned arrows). This is **how the
model produces high-quality diagrams**: the schema is presented once, declaratively,
rather than baked verbatim into every tool description. The same essentials are
also summarised in the MCP server `instructions` and in the `create`/`update`
input-schema field descriptions, so a client that ignores resources still gets
enough. The schema text derives from `packages/diagram` types — single source of
truth, no hand-maintained copy that can drift.

### 4.7 Graph-first authoring (the low-burden path)

Emitting raw `elements` with `x/y/width/height`, a shape vocabulary, and
arrow-endpoint anchor objects is the biggest source of model error (it's why
`coerceShapeKind`, the validation error paths, and auto-layout-on-replace all
exist). So `create_diagram`, `add_tab`, and `update_diagram` (replace mode)
accept an alternative **`graph`** input — the connection graph and nothing else:

```
graph: { nodes: [{ id, label?, shape? }], edges: [{ from, to, label? }] }
```

The server turns each node into a `shape` box and each edge into a pinned
arrow, then **always auto-lays-it-out** (a graph carries no positions). The
model expresses only intent — which nodes exist, what points at what — and
never touches geometry, anchors, or endpoint shapes. Off-vocabulary shape kinds
are coerced; an edge to an unknown node id is dropped rather than producing a
broken arrow. This is the **preferred path for any node/edge diagram**
(flowcharts, org charts, architecture, dependency graphs); `elements` stays for
deliberate arrangements (a ring, a grid) and mixed non-node content.

The translation (`graphToElements`) is a pure function in `packages/diagram`
beside the layout it feeds, so the public API can adopt it later; the MCP tab
builders (`buildGraphTab`) live in `apps/mcp/src/tab-builders.ts` — split out of
`tool-helpers.ts` so they're render-free and unit-testable. Provide **one** of
`graph` / `elements` / `template`, not several.

### 4.8 `share_diagram`

Create a shareable link so anyone with the URL can open a diagram without
signing in — the verb that turns "the AI made a diagram" into "the AI made a
diagram and here's a link to send the team." Wraps `POST /api/diagrams/<id>/share`
(spec/24): `{ diagramId, role?, expiry? }` → the public URL
(`/diagram/shared?s=<code>`), the granted role, and the expiry. `role` defaults
to **`view`** (least privilege for an automated share — showing your work
shouldn't silently grant edit; the model passes `edit` to allow changes), and
the api applies the same owner-only authorization every share route enforces, so
a token can only share diagrams its account owns. `expiry` (spec/34) defaults to
`never`.

### 4.9 `rename_diagram` and `delete_diagram`

CRUD completeness — the verbs a user will reach for the moment they ask their
assistant to "rename that" or "delete the old one":

- **`rename_diagram`** — `{ diagramId, name, tabId? }`. Renames the diagram
  (`PUT /api/diagrams/<id>` `{ name }`), or one tab when `tabId` is given (no
  tab-name-only route, so it reads the tab and writes it back with the new
  name). Non-destructive.
- **`delete_diagram`** — `{ diagramId, tabId? }`. Permanently deletes the
  diagram (`DELETE /api/diagrams/<id>`) or one tab (`DELETE …/tabs/<tabId>`).
  Irreversible, so the description tells the model to confirm with the user
  first; the api refuses deleting a diagram's last remaining tab and surfaces a
  clear message. Both inherit the ordinary owner/team authorization the routes
  already enforce ([spec/61 §3.4](61-public-api-and-tokens.md)).

### 4.10 Prompts (discoverability)

Registered MCP **prompts** — pre-canned templates a client surfaces as slash
commands / quick actions, so a user finds what the server does without knowing
the tool names. Pure text (no api calls, no auth to list); each steers the model
to the right tools and the graph-first path:

- **`diagram_this`** `{ description }` — create a diagram from a description via
  create_diagram + the graph input, and return a link.
- **`flowchart_from_steps`** `{ steps }` — turn an ordered step list (with
  branches) into a flowchart (diamond decisions, labelled branch edges).
- **`show_my_diagram`** `{ name }` — find a diagram by name and read_diagram it
  inline.

Registered in `apps/mcp/src/prompts.ts`, wired in `buildServer` beside the tools
and schema resource.

### 4.11 Read-only tokens (the one scope)

A trust story for cautious users: the MCP consent screen offers a **"read-only
access"** checkbox. When ticked, the minted `lvd_` token carries `read_only = 1`
(spec/61 §3.4, migration 0039), and the api worker rejects every write it
presents — `POST`/`PUT`/`DELETE` → `403 read_only_token` — at a **single
dispatch choke point** in `apps/api/src/index.ts`, so no write route can be
reached, present or future, with no per-route changes. The read tools
(find_diagrams, read_diagram, both GETs) still work; every write tool
(create/update/delete/share/add_tab/rename) is blocked server-side, which is the
security boundary (the tool list is static, but the api is the enforcer). Clerk
sessions and full tokens are unaffected. The token list in the Explorer shows a
"Read-only" badge. This is a single boolean, not a general scopes system —
finer grants stay deferred (spec/61 §7).

## 5. Visualise — inline image render

`read_diagram`, `create_diagram`, and `update_diagram` all return an **inline
PNG** so the diagram shows in the chat. This needs headless rendering inside a
Worker (no DOM, no React).

- **Reuse what's already pure.** The existing export
  (`apps/live/lib/export-tab.ts`) has a **purely procedural SVG path**
  (`renderTabToSvg`) that already calls headless helpers in `packages/diagram`:
  `arrow-path.ts` (path `d` strings, label anchors), `geometry.ts` (endpoint /
  anchor / bounds), `colors.ts` (`defaultFillColor` / `defaultStrokeColor` /
  `defaultTextColor` theme resolution). The PNG/PDF paths are Canvas/DOM-bound
  and are **not** reusable.
- **Extract a shared renderer.** Move the SVG-building logic into a new pure
  `packages/diagram/src/svg-render.ts` (`renderElementsToSvg(tab): string`),
  consumed by **both** the existing in-app export (dedup — the editor stops
  carrying its own copy) and the MCP worker. This is the reuse rule applied: one
  renderer, two callers.
- **Rasterise in the worker.** Convert the SVG to PNG with
  [`@resvg/resvg-wasm`](https://github.com/yisibl/resvg-js) (runs in the Workers
  runtime), return it as base64 MCP image content (`image/png`) — broadest client
  support vs. raw SVG.
- **Embedded font.** Workers have no system fonts, so the worker bundles one
  (Inter, OFL — `apps/mcp/fonts/`, wired as a `Data` module + passed to resvg as
  a `fontBuffer`) and renders every label in it. Without an embedded font resvg
  draws shapes/arrows/colours but no text, so the calling model gets a text-less
  preview it can't self-check against. A diagram's own font choice falls back to
  Inter in the preview; the structured elements still carry the true font.
- **Known limitation (v1).** Image elements render as placeholder rectangles
  (the SVG export already does this), since embedding R2-hosted bitmaps is extra
  work. Acceptable for code/architecture/flow diagrams, which are shape+arrow+text.
  Embedding real images is a follow-up.
- **Element coverage.** The shared renderer draws tables as their real grid
  (tracks / headers / zebra / per-cell text, `svg-render-table.ts`), freehand
  sketches as their polyline, the full shape-silhouette vocabulary (hexagon /
  cylinder / document / cloud / devices / actor / frame ... —
  `svg-render-shapes.ts`, mirroring the editor's ShapeSvgOverlay geometry),
  element rotation, and icon glyphs (above). The PNG/PDF canvas path
  rasterises any element the canvas drawers can't reproduce from the SAME
  svg markup (`boxedNeedsSvgRaster`), so the three visual exports can't
  drift. Remaining gaps: the self-drawing data shapes (progress / rail /
  rating / charts) and inline icons beside a shape's label still render as
  plain boxes / label-only.
- **Icon elements render their real glyph.** The renderer takes an injected
  `resolveIconArt(iconId)` (like `resolveImageHref`); the MCP worker supplies
  `resolveIconExportArt` from `@livediagram/icons/resolve` (a static import of
  the catalogue data — fine in a Worker), so line-art icons draw stroke-tinted
  and Technology marks draw their brand tile instead of the old
  box-with-caption fallback. Without a resolver (or for an unknown id) the
  renderer still emits that fallback, so resolver-less callers are unchanged.

## 6. Rollout

1. **`apps/mcp` skeleton** — worker, Hono, MCP SDK, service binding to api,
   `/health`, deploy wiring + `mcp.livediagram.app` host. `.env.example`.
2. **Shared SVG renderer** — extract `packages/diagram/src/svg-render.ts` from
   `export-tab.ts`, repoint the in-app export to it (no behaviour change), add
   `@resvg/resvg-wasm` rasterisation in the worker.
3. **Tools, read-first** — `find_diagrams`, `read_diagram` (+ schema resource).
   These are read-only and prove the schema + render path end to end.
4. **Write tools** — `create_diagram`, `update_diagram` (both modes), reusing
   `validate.ts` + `auto-layout.ts`.
5. **OAuth** — `/api/oauth/exchange` on the api worker (reusing the token-mint
   path, Clerk-gated like `/api/tokens`); `apps/live` consent page; the MCP
   OAuth endpoints + `OAUTH_KV`. Until this lands, the worker can be exercised
   with a hand-pasted `lvd_` Bearer for development.
6. **Docs + help, shipped WITH the feature** (per the help-centre + docs rules in
   `CLAUDE.md`):
   - A help article (e.g. `account-and-data/connect-ai-mcp`) — what the MCP is,
     connecting it to Claude/an AI tool, the signed-in-only limitation, that it
     mints a revocable API token — **registered in `apps/help/lib/articles.ts`**.
   - `docs/architecture.md` — the new `apps/mcp` worker in the layout + deploy
     order; `docs/self-hosting.md` — MCP needs Clerk (like tokens/teams) and is
     optional to deploy; `README.md` repo-layout tree gets the new app.
   - Cross-link from the API-token help/docs ([spec/61](61-public-api-and-tokens.md)).

## 7. Out of scope (for now)

- **Streaming progress** from tools (the SDK supports it; v1 returns once).
- **Real image-element embedding** in renders ([§5](#5-visualise--inline-image-render)).
- **Folder / team management** via MCP — there are no tools to list, rename, or
  move folders (create_diagram only auto-files new diagrams under "Generated");
  more `/api` surface can be wrapped later if demand appears. (Share-link
  creation IS in scope now — `share_diagram`, [§4.8](#48-share_diagram); managing
  folders/teams themselves stays out.)
  (Team **content** is in scope: `find_diagrams` sweeps team shared libraries
  and the other tools read/edit team diagrams through the ordinary access
  gates — [§4.1](#41-find_diagrams), [spec/61 §3.4](61-public-api-and-tokens.md).
  Managing teams themselves stays out, and the api refuses it to tokens.)
- **Token-paste connector** as a supported path — OAuth is the chosen front door
  ([§3](#3-authentication-oauth-21)); a raw Bearer still works for local dev but
  isn't a documented user flow.
- **Finer-grained scoped MCP tokens** — a **read-only** token now exists
  ([§4.11](#411-read-only-tokens-the-one-scope), spec/61 §3.4); per-resource /
  per-verb scopes beyond that stay deferred.
