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

**Keep the surface small.** Four tools and one schema resource, no more (see
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

Four tools. The search/view capability is two tools (find, then read); create
and update are separate because their inputs and intent differ.

### 4.1 `find_diagrams`

Search/list the caller's diagrams. Input: optional `query` (name match), `limit`.
Wraps `GET /api/diagrams`, filters by name. Returns a compact list:
`{ id, name, tabs: [{ id, name }], updatedAt, url }` where `url` is the
`livediagram.app` deep link to open it. **No image here** — kept lightweight so
the model can scan many results cheaply, then `read_diagram` the one it wants.

### 4.2 `read_diagram`

Fetch one diagram's full content **and render it** — this is the "visualise"
capability. Input: `diagramId`, optional `tabId` (defaults to the first tab).
Wraps `GET /api/diagrams/:id` + `GET /api/diagrams/:id/tabs/:tabId`. Returns the
tab's `elements` as structured JSON (so the model can understand and, if asked,
edit it) **plus an inline PNG** of the tab as MCP image content ([§5](#5-visualise--inline-image-render)),
plus the deep-link `url`. So "show me my auth-flow diagram" → `find_diagrams` →
`read_diagram` renders it inline.

### 4.3 `create_diagram`

Create a new diagram (or add a tab) from elements the model produced. Input:
`name`, `tab: { name, elements: Element[] }`. The MCP:

1. **Validates** `elements` with `isValidTab` (reject `400`-style with a clear
   message the model can correct against).
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
3. **Persists** via `POST /api/diagrams` (seed) + `PUT …/tabs/:tabId`.
4. **Returns** the new `id`, deep-link `url`, **and the rendered PNG** so the user
   sees the result inline immediately.

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

### 4.5 Schema resource (not a tool)

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
- **Known limitation (v1).** Image elements render as placeholder rectangles
  (the SVG export already does this), since embedding R2-hosted bitmaps is extra
  work. Acceptable for code/architecture/flow diagrams, which are shape+arrow+text.
  Embedding real images is a follow-up.

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
- **Folder / team / share management** via MCP — the four tools cover the three
  stated capabilities; more `/api` surface can be wrapped later if demand appears.
- **Token-paste connector** as a supported path — OAuth is the chosen front door
  ([§3](#3-authentication-oauth-21)); a raw Bearer still works for local dev but
  isn't a documented user flow.
- **Read-only / scoped MCP tokens** — inherits spec/61's "full read+write, no
  scopes yet" ([spec/61 §3.4](61-public-api-and-tokens.md)); a read-only token
  would map cleanly to find/read-only MCP use if scopes ever land.
- **Multi-tab generation** in one call — `create`/`update` operate on one tab;
  multiple calls build multiple tabs.
