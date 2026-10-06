# MCP server

**Status: live.** Merged and deployed at `mcp.livediagram.app`; connect flow
verified end-to-end from Claude. Builds directly on [Public API and API tokens](public-api-and-tokens.md)
(API tokens), which it picks up where §7 left off: [Public API and API tokens](public-api-and-tokens.md) deferred "OAuth /
third-party app authorization" — this spec adds exactly that, scoped to one
client (an MCP server), reusing the `lvd_` token as the credential it ultimately
mints. No new authorization model; an OAuth front door onto the existing token.

## 1. Goal

Let a person connect livediagram to whatever AI tool they already drive (Claude
desktop/web, Claude Code, any MCP client) and, from inside that tool:

1. **Find and view** the documents they already have — search by name, get back a
   link to open in the editor **and an inline image** of the document.
2. **Create** a new document from a request — e.g. point the AI at a codebase and
   have it produce a diagram of the control flow.
3. **Edit** an existing document — full rework of a tab, or a small adjustment.

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
shared helpers from `packages/document`; the MCP adds no business logic that
isn't reusable.

This must not weaken the friction-free guest model
([Auth + guest access](../014-identity/auth-and-guest-access.md)) or self-hosting
([Open source + distribution](../002-project-scope/open-source-and-business-model.md)). Like API tokens and teams,
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
  ([Public API and API tokens §3.3](public-api-and-tokens.md)), so **no api authorization
  changes are needed** for the tools themselves.
- **Reuses `packages/document`** headless: element factories, `validate.ts`
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
from [Public API and API tokens](public-api-and-tokens.md) — storage, hashing, 6-month expiry,
per-account cap, revoke, account-deletion cascade, rate limiting — instead of
inventing a parallel credential. An MCP-minted token is an ordinary API token;
it appears in the Settings API Tokens category and can be revoked there like any
other.

This implements the OAuth flow Manager Toolkit uses:

1. **Discovery** — the MCP worker serves RFC 8414 metadata at
   `/.well-known/oauth-authorization-server` (and the protected-resource
   metadata): `authorization_endpoint`, `token_endpoint`, `registration_endpoint`,
   `code_challenge_methods_supported: ["S256"]`, `token_endpoint_auth_methods_supported: ["none"]`.
2. **Dynamic client registration** — `POST /oauth/register` issues a `client_id`
   (validates redirect URIs: `https:` anywhere, or `http:` on a loopback host for
   local clients; the scheme is checked on its own, so a loopback host never
   admits another scheme such as `javascript:`), stored in KV with a TTL.
   Rate-limited per IP. Authorize re-checks the scheme of the requested
   redirect URI, and the consent page only ever navigates to an http(s) URL.
   The token endpoint refuses a code presented with another `client_id`.
3. **Authorize** — `GET /oauth/authorize` creates a short-lived session in KV and
   redirects to a **consent page in `apps/live`** (e.g. `/oauth/authorize` or an
   Explorer "Connect an app" screen), passing the session id. The user is
   already signed in there via Clerk.
   **What the consent screen may believe.** `/oauth/authorize` also passes the
   client name and the redirect host as query params for display, and the screen
   must **not** render those. It is the only thing standing between a user and a
   full-access token, and its one anti-phishing line ("Access will be sent to
   `<host>`. Only continue if you recognise this.") is forgeable by exactly the
   party it exists to expose: registration is open by design, so an attacker can
   register a client, start a real authorize to obtain a session id, then hand
   the victim a hand-written `/oauth/consent?session=…&client=Notion&to=notion.so`
   whose code lands on their own `redirect_uri`. The screen reads
   **`GET /oauth/session/<id>`** instead → `{ clientName, redirectHost }`, taken
   from the stored session where `redirectUri` was checked against the client's
   registered list before it was written. The session id is the read capability
   (10-minute TTL, held by the browser in the flow); the response carries no
   token, code or PKCE material and does not consume the session, so answering
   grants a holder nothing it could not get by completing the flow. Client
   **name** is never a trust signal either way (it is whatever was registered) —
   the host is the fact to check, which is why it must come from the server. A
   session that is unknown or expired is a blocking screen, never a screen with
   an approve button and a blank destination. See
   `apps/live/lib/mcp-consent-session.ts`. The screen is never frameable
   (`X-Frame-Options: DENY`, [Embeds](../013-workspace/embeds.md)), so the
   Connect click can't be clickjacked from an attacker's page.
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
same gate as `/api/tokens` ([Public API and API tokens §3.7](public-api-and-tokens.md)). A
no-auth self-host: the exchange endpoint rejects every caller and the consent
page has no signed-in user, so the MCP can mint nothing. Operators who don't want
the MCP simply don't deploy `apps/mcp`; nothing else references it.

**The CLI signs in here too** ([CLI](cli.md#authentication)). This server is the
one authorisation server for both front doors, so it also offers what a
command-line client needs: a loopback redirect matched on scheme, host and path
with any port (RFC 8252 §7.3), a pre-registered public client `livediagram-cli`
whose name the consent screen can trust, and the device authorisation grant
(RFC 8628) with a `/oauth/device` page in `apps/live` for machines without a
browser. A token minted for the CLI is named "livediagram CLI".

## 4. Tools

Eleven tools. The search/view capability is two tools (find, then read); create,
add_tab, and update are separate because their inputs and intent differ;
list_templates exposes the template catalogue ([§4.5](#45-list_templates));
share, rename, and delete complete the CRUD verbs, with list_trash and
restore_document as the way back from a delete
([§4.8](#48-share_document), [§4.9](#49-rename_document-and-delete_document), [§4.9a](#49a-list_trash-and-restore_document)).
Every one of them declares its behaviour as **annotations**
([§4.14](#414-tool-annotations-behaviour-hints)), describes itself in facts
rather than instructions ([§4.15](#415-descriptions-state-facts-not-instructions)),
and declares the shape of its result as an **output schema**
([§4.17](#417-structured-output-and-described-parameters)).

Every document and tab **name** argument (`create_document`'s `name` and each
tab's `name`, `add_tab`'s `name`, `rename_document`'s `name`) states the
60-character cap in its description and is shortened by the schema itself
with the shared `truncateName`, so the name a tool sends and reports back is
the one the api stores ([Tab and document name length](../006-document/name-length.md)).

### 4.1 `find_documents`

Search/list the caller's documents — the **personal library AND every joined
team's shared library** ([Team shared documents](../013-workspace/team-shared-documents.md)). A document
filed into a team leaves its owner's personal list entirely, so the personal
`GET /api/documents` alone is not "the user's documents": the tool sweeps
`GET /api/teams` + `GET /api/teams/:id/library` alongside it (the api accepts
the token identity on those reads — [Public API and API tokens §3.4](public-api-and-tokens.md)),
merges, and ranks newest-saved first. The team sweep is best-effort: a teams
failure degrades to personal-only results, never an error. Input: optional
`query` (name match), `limit`. Returns a compact list:
`{ id, name, updatedAt, library, url }` where `library` is `personal` or the
team's name and `url` is the `livediagram.app` deep link to open it. **No image
here** — kept lightweight so the model can scan many results cheaply, then
`read_document` the one it wants.

### 4.2 `read_document`

Fetch one document's full content **and render it** — this is the "visualise"
capability. Input: `documentId`, optional `tabId` (defaults to the first tab).
Wraps `GET /api/documents/:id` + `GET /api/documents/:id/tabs/:tabId?view=outline`. Returns the
tab's [outline view](../024-agents/document-views.md), about a tenth of the element JSON, with
the refs the edit tools take (`format: "json"` returns the elements instead), plus the deep-link
`url`. With `image: true` it also attaches an inline **PNG** of the tab as MCP image content
([§5](#5-visualise--inline-image-render)); without it a read costs no image tokens. So "show me my auth-flow diagram" → `find_documents` →
`read_document` with `image: true` renders it inline. Its structured result carries the tab's `rev`,
which `update_document` takes back as the base of its ops ([§4.4](#44-update_document)).
It also takes `view` (`outline`, `graph`, `layout`, `comments`, `show`, `find`), `budget` (8,000 tokens unless
given), `only`, `ref`, `q`, `coarse`, `all` and `style`; a ref that names nothing or several comes back as a
correctable result naming the candidates.

### 4.3 `create_document`

Create a new document from elements the model produced. Input: `name`, `tabs:
[{ name, elements: Element[] }]` (one tab, or several to build a **multi-tab**
document in one call — an overview plus a detail tab per subsystem), the
optional `layout`, and the optional `markUsed` (boolean, default `true`). Each tab may instead pass `template: TemplateKind` in place
of `elements` — the server materialises the hand-tuned scaffold from
`@livediagram/templates` ([§4.5](#45-list_templates)), keeping its curated
layout (`layout` is ignored for a template tab) and applying that template's
canvas overrides; the model then personalises labels via `update_document`'s
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
3. **Tags it as made by AI.** The create sends `source: 'mcp'`, which the
   Explorer's **Made by AI** filter (`made-by:ai`,
   [Explorer filters](../013-workspace/explorer-filters.md)) reads, so a user's
   own work and AI-made documents can be told apart wherever either is filed.
   Unfiled, it sits at the root of My documents like any other document,
   with its **Made by AI** badge. (Earlier this find-or-created a real
   "Generated" folder, then the Explorer showed a Generated view;
   provenance is a filter, not a place.)
   The create also sends the creation `intent` of the first tab it built and the
   template it used (`{ mode: "diagram" }` unless the input makes a whiteboard, an
   event-storming board, or a document from a template family such as a retrospective), so with no folder named the server files it in the
   user's [default folder](../013-workspace/default-folders.md) for that intent,
   when they have one.
4. **Persists** all tabs via `POST /api/documents` (which seeds a `tabs[]` array
   and accepts `source`). A tab given as `graph`, `mermaid` or `template` travels
   as such and is compiled by the api ([API app](api.md)), so the MCP and the
   [CLI](cli.md) build documents alike.
   Making a document is a use of it, so it joins the user's
   Jump back in at once ([Explorer Home](../013-workspace/explorer-home.md#making-a-document));
   `markUsed: false` is passed through to the create
   ([API](api.md#marking-a-document-used)) for a model making many documents in one go,
   so a batch never pushes the user's own work out of reach. Absent, nothing is sent and the
   create counts.
5. **Returns** the new `id`, tab count + ids, the folder ("My documents" for the root,
   or the name of the default folder it was filed in), the deep-link `url`,
   **and the rendered PNG of the first tab** so the user sees the result inline.

### 4.3a `add_tab`

Add a **new tab** (its own canvas) to an existing document — the motivating case:
"make a tab going into more detail on one part of this architecture." Input:
`documentId`, `name`, `elements`, optional `layout` — or `template: TemplateKind`
instead of `elements`, exactly like a `create_document` tab. Validates + lays out
exactly like a `create_document` tab, then submits a [changeset](../024-agents/agent-changesets.md)
that creates the tab, so anyone with the document open sees it arrive. Returns the new `tabId`, `url`,
and the rendered PNG. (Pair with `read_document`, which lists the document's
existing tabs, to decide where a new one fits.)

### 4.4 `update_document`

Edit an existing tab. **Two modes** (the user asked for both):

- **`replace`** — for building or reworking a whole tab. Input: full new
  `elements: Element[]` (and the same optional `layout` control as
  `create_document`). Validated + laid out exactly like `create_document`, as a
  `replace` changeset. Use when the change is large enough that re-emitting the
  tab is cleaner than patching.
- **`ops`** — for small adjustments. Input: an ordered list of
  `{ op: 'add' | 'update' | 'remove', element? , elementId? }` targeting existing
  elements by id or by the ref `read_document` prints, sent as `set` / `rm` on the always-safe `id:"…"` ref and
  compiled by the api's edit-operation engine. **Auto-layout is NOT run by default** in `ops` mode —
  the point of a granular edit is to preserve the user's existing positions;
  re-laying out would move everything. (A future `relayout: true` opt-in could be
  added if wanted.)

Both modes submit one [changeset](../024-agents/agent-changesets.md); the api
applies, validates and lays out, relays it live to anyone with the tab open, and
keeps it through their next save. `ops` mode sends its ops as
[edit operations](../024-agents/edit-operations.md) based on the revision
`read_document` returned, so nothing a person saved in between is overwritten: a
touched element that changed is a conflict, an element a person has selected is
refused as held. Both return the changeset's result lines, its [lint](../024-agents/diagram-lint.md) summary line
(also as its own text block; `create_document` carries one per created tab) and
the rendered PNG of the result. The model picks the mode: rebuild → `replace`;
tweak → `ops`.

### 4.5 `list_templates`

Browse the template library — the same hand-tuned catalogue the editor's
Quick Start picker ships ([Canvas and palette](../008-canvas/canvas-and-palette.md)), served from the shared
`@livediagram/templates` package so the worker and the editor can't drift.
No input. Returns the categories plus one row per template:
`{ kind, title, description, category }` — enough for the model to pick a
`kind` and pass it as `template` on `create_document` / `add_tab`. Deliberately
metadata-only (no elements): the scaffold materialises server-side on create,
so the model never has to re-emit — or accidentally mangle — a curated layout.
The recommended flow for "make me a kanban board"-style asks: `list_templates`
→ create with `template` → `update_document` (`ops`) to fill in real content.

### 4.6 Schema resource (not a tool)

A static, cacheable MCP **resource** — e.g. `livediagram://schema/elements` —
returning a compact description of the element schema: the element types
(`shape` / `text` / `sticky` / `arrow` / `table` / …), the shape vocabulary,
required fields, the pinned-arrow anchor convention (`from.e → to.w` etc.), and
the design rules that make diagrams read well (don't set colours — the theme
owns them, a sticky's own colours excepted; size siblings consistently; prefer
pinned arrows), and the content fields of the kinds that carry content (§4.7a). This is **how the
model produces high-quality diagrams**: the schema is presented once, declaratively,
rather than baked verbatim into every tool description. The same essentials are
also summarised in the MCP server `instructions` and in the `create`/`update`
input-schema field descriptions, so a client that ignores resources still gets
enough. The schema text derives from `packages/document` types — single source of
truth, no hand-maintained copy that can drift.

### 4.7 Graph-first authoring (the low-burden path)

Emitting raw `elements` with `x/y/width/height`, a shape vocabulary, and
arrow-endpoint anchor objects is the biggest source of model error (it's why
`coerceShapeKind`, the validation error paths, and auto-layout-on-replace all
exist). So `create_document`, `add_tab`, and `update_document` (replace mode)
accept an alternative **`graph`** input — the connection graph and nothing else —
or the same thing written as **`mermaid`**:

```
graph: {
  nodes:  [{ id, label?, shape?, note?, group? }],
  edges:  [{ from, to, label? }],
  groups?: [{ id, label?, members?: [nodeId, ...] }],
  direction?: 'down' | 'right',
  style?:  'flow' | 'tree' | 'mindmap',
  lines?:  'straight' | 'angled' | 'curved',
}
mermaid: "flowchart LR\n  A[Idea] --> B{Worth it?} ..."
```

The server turns each node into a `shape` box and each edge into a pinned
arrow, then **always lays it out** (a graph carries no positions). The model
expresses only intent — which nodes exist, what points at what, how they group
— and never touches geometry, anchors, or endpoint shapes. Off-vocabulary shape
kinds are coerced; an edge to an unknown node id is dropped rather than
producing a broken arrow. This is the **preferred path for any node/edge
diagram** (flowcharts, org charts, architecture, dependency graphs); `elements`
stays for deliberate arrangements (a ring, a grid) and mixed non-node content.
Provide **one** of `graph` / `mermaid` / `elements` / `template`, not several.

**A label is a heading; detail goes in the note.** A node's `label` is the text
in the box and is capped at **40 characters** (`GRAPH_LABEL_MAX`). The cap is a
plain fact in the tool's description, not an instruction (§4.15), and the server
enforces it rather than rejecting the call. A longer label becomes a heading:
bracketed asides go first ("Web client (React SPA served from the CDN)" becomes
"Web client"); then the noun phrase before its first clause word when there is
one ("Orders service which creates orders" becomes "Orders service", "Message
queue for async events" becomes "Message queue"); otherwise the text cut at a
word boundary with an ellipsis. Either way the **full text moves into the node's `note`**
(prepended to any note the model gave), which the editor shows as the element's
note. A model now has somewhere to put the explanation, so the box keeps the
heading; this is what stops a verbose model filling a diagram with sentences.
Edge labels are capped the same way (overflow is dropped, an arrow has no note).

**Boxes fit their labels.** Each node is sized from its label (estimated text
width and line count, within a sane range) and **keeps that size** through the
layout: the peer sizing that Tidy Up applies (every box of a tier as big as its
longest label) is skipped for graph input, where it let one long label inflate
every box ("CTO" drawn as wide as "Platform and site reliability"). An
unlabelled circle is a small solid dot ([Mermaid](../020-import-export/mermaid.md)
"Node boxes and text").

**Layout choices** (defaults in brackets):

- `direction` (auto): `down` (ranks top to bottom) or `right` (left to right).
- `style` (`flow`): `flow` is the layered layout, `tree` the tidy tree (an org
  chart, a hierarchy), `mindmap` the radial layout around the first node.
- `groups`: named clusters drawn as frames around their members and laid out as
  one block each (the clustered layout the editor's Mermaid import uses); an edge
  may point at a group id. With groups, `style` is flow. A node may name its
  group itself (`group`), the shape a model reaches for first; it joins that
  group's members, and a group id nothing declares is created with the id as its
  label. `members` is then optional.
- `lines` (`straight` for flow, `angled` for tree, `curved` for mindmap): the
  arrows' routing, from the editor's own arrow styles. Angled lines **bend
  twice** along the flow (down, across at half height, down into the child's
  top), the org-chart shape; one whose ends already line up runs straight
  ([Layout cleanup](../008-canvas/layout-cleanup.md) "Angled lines bend twice").

The flow layout reduces crossings: after ranking, a few up-and-down barycentre
passes reorder each rank, and a new order is kept only when it crosses fewer
edges ([Layout cleanup](../008-canvas/layout-cleanup.md)), so graph input, whose
nodes all start at one point, no longer lays out in arbitrary input order. It
also gives long edges a lane, places each node by its neighbours instead of
centring its rank, and has every edge to a later rank leave and land on the
faces that point along the flow (the same page). An arrow that still crosses an
unrelated box passes behind it with a gap, on the canvas and in the preview
([Arrows pass behind intervening boxes](../008-canvas/arrow-route-behind.md)).

**`mermaid`** is parsed by the editor's own importer (`parseMermaid`:
flowcharts with subgraphs, state diagrams and ER diagrams, [Mermaid](../020-import-export/mermaid.md)) into the same
graph, its direction and subgraphs becoming `direction` and `groups`, and then
takes the same path, label cap included. A dialect it cannot read comes back as
an error naming what is supported.

The translation (`graphToElements`, the sizing, the clustered layout) is pure
code in `packages/document` beside the layout it feeds, so the public API can
adopt it later; the MCP side (`graph-input.ts`: the label cap, choosing the
layout, the lines, Mermaid) lives in `apps/mcp/src` and is unit-tested there.
The cap is the MCP's alone: the editor's Mermaid import never truncates what a
person typed.

The **prompts** (§4.10) are messages the user sends, not tool descriptions, so
they do ask for it outright: short headings, detail in the note, related nodes
grouped, a direction and style that fit the subject. Nodes are set in one fixed
text size (`sm`, what the sizing measures against), not the shape default that
scales text to fill each box.

### 4.7a Content-carrying element kinds

Six kinds hold content of their own, and the element format documents their
fields so a model can fill them rather than guess: **sticky**, **table**,
**code block**, **entity**, **lane**, and the three **charts** (bar, line, pie).
Every other kind stays listed by name only. The field notes are facts about what
each field does (§4.15), carried on the tools' element argument and in the
schema resource (§4.6), short enough not to bloat every tool definition.

| Kind                              | Content fields                                                     | Facts the notes state                                                                                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sticky` (type)                   | `label`; optional `fillColor` + `textColor`                        | The theme never recolours a sticky, so its own colours are kept; the notes list the palette's sticky pairs (classic, lemon, peach, rose, lilac, sky, mint, teal, slate, paper, charcoal, ink). Unset, it is the classic amber note. |
| `table` (type)                    | `cells` (rows of strings), `headerRow`, `headerColumn`, `zebra`    | The first row is the header when `headerRow` is set.                                                                                                                                                                                |
| `code-block` (shape)              | `code` (up to 4000 chars), `codeLanguage`, `codeTheme`, `codeWrap` | The languages and themes are listed; the block draws itself, so `label` is not shown.                                                                                                                                               |
| `entity` (shape)                  | `label` (the title), `entityFields` `[{ name, type? }]` (up to 40) | Keys go in the type text (`uuid PK`).                                                                                                                                                                                               |
| `lane` (shape)                    | `label` (the title), `headerFill`                                  | Contents sit inside the lane's box; lanes are placed one under another.                                                                                                                                                             |
| `bar-chart` / `pie-chart` (shape) | `pieSlices` `[{ label, value }]`                                   | A chart draws no title: a caption is a separate `text` element. Categories show in the legend.                                                                                                                                      |
| `line-chart` (shape)              | `lineCategories` (x labels), `lineSeries` `[{ name, values }]`     | The same, with one value per category.                                                                                                                                                                                              |

**The sticky exception to "the theme owns colours".** The design rule that a
model leaves colours to the theme (§4.6) holds for every themed element; a
sticky is not themed at all (it keeps its amber across every theme), so its
`fillColor` / `textColor` are content, and the notes say so.

**The server makes these kinds safe to author** (`packages/document/src/element-normalise.ts`),
before validation, on every element path (create, add_tab, update in either
mode), so a near-miss draws correctly instead of failing the call or drawing
wrongly:

- **Every element takes the presentation defaults the editor's own factory
  gives a new one of its kind** for the fields it leaves out: `textSize` (`md`
  for shapes, stickies and tables, `sm` for text) and, where the kind sets
  them, the title alignment and padding (an entity's top-left title, a lane's
  left title strip and `lg` padding, a frame's header). Unset, text scales to
  fill its box, so a lane or entity title came out as one giant word across
  its contents and a sticky's note filled it edge to edge; a box drawn in the
  editor never arrives that way. This applies to every element on these paths,
  not only the six.
- A **table**'s ragged rows are padded to the widest (`normalizeTable`, the same
  pass the editor runs on load), so every row renders.
- An unknown **codeLanguage** becomes `plain` and an unknown **codeTheme** is
  dropped (the default), rather than failing the whole tab validation.
- An **entity**'s height grows to fit its rows (`entityHeight`, the geometry
  the canvas and the export draw with: the title bar, 13.75 px a row, 3 px
  between rows, 6 px above and below the list), since rows past the box are not
  drawn.
- **Chart** data is coerced: a slice or value that is not a finite number
  becomes 0, labels become strings, and each series' `values` is padded or cut
  to the category count. Empty data draws the built-in sample, which the notes
  state.
- **Lanes move to the front of the element list** (their order among themselves
  kept), so they paint behind everything: a lane has a fill, and one listed after
  its contents covered them. It also makes each lane the backmost box under its
  contents, which is what lets dragging it in the editor carry them.
- **A freehand stroke in the former `{ nx, ny }` shape is packed**
  ([Stroke points](../006-document/stroke-points.md)): a stroke read from a tab
  carries its points as one `packedPoints` block, and a model that writes
  `points` instead gets them packed, as the api's own writes would. In an
  update, sent `points` replace the stroke's block (`mergeElementUpdate`).

### 4.8 `share_document`

Create a shareable link so anyone with the URL can open a document without
signing in — the verb that turns "the AI made a diagram" into "the AI made a
diagram and here's a link to send the team." Wraps `POST /api/documents/<id>/share`
([Share password](../013-workspace/share-password.md)): `{ documentId, role?, expiry? }` → the public URL
(`/document/shared?s=<code>`), the granted role, and the expiry. `role` defaults
to **`view`** (least privilege for an automated share — showing your work
shouldn't silently grant edit; the model passes `edit` to allow changes), and
the api applies the same owner-only authorization every share route enforces, so
a token can only share documents its account owns. `expiry` ([Share-link expiry](../013-workspace/share-link-expiry.md)) defaults to
`never`.

### 4.9 `rename_document` and `delete_document`

CRUD completeness — the verbs a user will reach for the moment they ask their
assistant to "rename that" or "delete the old one":

- **`rename_document`** — `{ documentId, name, tabId? }`. Renames the document
  (`PUT /api/documents/<id>` `{ name }`), or one tab when `tabId` is given
  (`PUT /api/documents/<id>/tabs/<tabId>/name`, no whole-tab save). Non-destructive.
- **`delete_document`** — `{ documentId, tabId? }`. Moves the document to the
  [Trash](../013-workspace/trash.md) (`DELETE /api/documents/<id>`), restorable
  for 30 days, and says so in its result (`trashed: true`, `restorableForDays`).
  There is no permanent option: an AI tool can only ever bin a document, never
  destroy it. A permanent delete stays with the person (Settings › Trash) or
  the REST API's `?permanent=true` ([Public API and API tokens](public-api-and-tokens.md)).
  With `tabId` it deletes one tab (`DELETE …/tabs/<tabId>`) outright: tabs have
  no Trash. Still destructive, so the description tells the model to confirm
  with the user first; the api refuses deleting a document's last remaining tab,
  and a document already in the Trash answers 410, which the tool reports as
  already in the Trash, pointing at `list_trash`.

Both inherit the ordinary owner/team authorization the routes already enforce
([Public API and API tokens §3.4](public-api-and-tokens.md)).

### 4.9a `list_trash` and `restore_document`

The way back from `delete_document`, with exactly the REST Trash's authority
(`GET /api/trash`, `POST /api/trash/<id>/restore`): the user's personal Trash
and every team Trash they have joined.

- **`list_trash`** — `{}`. Read-only. Each document the user may restore:
  `{ id, name, library, reason, deletedAt, purgeAt }`, `library` being
  `personal` or the team's name, `reason` being `deleted` or `empty` (moved by
  the [empty document clean-up](../013-workspace/empty-document-cleanup.md)),
  the two times ISO 8601.
- **`restore_document`** — `{ documentId }`. Restores it to its folder, or
  the root of its space when that folder is gone, and returns `{ restored, id, name, url }`.
  A 404 (not in the Trash, or not the user's) becomes a model-correctable error
  pointing at `list_trash`.

### 4.9b `list_items` and `change_items`

The items Plan boards show ([Items](../026-plan/items.md), [Plan mode](../026-plan/plan-mode.md#agents)):

- **`list_items`** (read): a document's items, by number, narrowed by `type` and `status`. Titles and fields are
  people's writing, read as data.
- **`change_items`** (destructive, as it may delete): up to 50 changes in order, each `add` `{ title, type,
status, fields }`, `set` `{ item, fields, clear, type }`, `move` `{ item, status, before }` or `delete`
  `{ item }`. Items are named by number (`#12`) or id prefix, as the CLI's `item` verbs name them
  (`resolveItemRef`). A refusal answers what was applied before it. Each change reaches open boards at once.

### 4.10 Prompts (discoverability)

Registered MCP **prompts** — pre-canned templates a client surfaces as slash
commands / quick actions, so a user finds what the server does without knowing
the tool names. Pure text (no api calls, no auth to list); each steers the model
to the right tools and the graph-first path:

- **`diagram_this`** `{ description }` — create a diagram from a description via
  create_document + the graph input, and return a link.
- **`flowchart_from_steps`** `{ steps }` — turn an ordered step list (with
  branches) into a flowchart (diamond decisions, labelled branch edges).
- **`show_my_document`** `{ name }` — find a document by name and read_document it
  inline.

Registered in `apps/mcp/src/prompts.ts`, wired in `buildServer` beside the tools
and schema resource.

### 4.11 Read-only tokens (the one scope)

A trust story for cautious users: the MCP consent screen offers a **"read-only
access"** checkbox. When ticked, the minted `lvd_` token carries `read_only = 1`
([Public API and API tokens](public-api-and-tokens.md) §3.4, migration 0039), and the api worker rejects every write it
presents — `POST`/`PUT`/`DELETE` → `403 read_only_token` — at a **single
dispatch choke point** in `apps/api/src/index.ts`, so no write route can be
reached, present or future, with no per-route changes. The read tools
(find_documents, read_document, both GETs) still work; every write tool
(create/update/delete/share/add_tab/rename) is blocked server-side, which is the
security boundary (the tool list is static, but the api is the enforcer). Clerk
sessions and full tokens are unaffected. The token list in the Explorer shows a
"Read-only" badge. This is a single boolean, not a general scopes system —
finer grants stay deferred ([Public API and API tokens](public-api-and-tokens.md) §7).

### 4.12 Error telemetry

Genuine tool failures reach the public **Exceptions** dashboard ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) Error
category), so we see WHERE the MCP breaks. `apiJson` reports a **5xx** from the
api worker (`Error·Api·Http5xx.<Tool>`) and a **network fault** (the service
binding threw — `Error·Api·Internal.<Tool>`), then rethrows; the
`delete_document` raw-fetch path reports a 5xx too. `<Tool>` is the running
tool's PascalCase name (`Http503.UpdateDocument`), the same token as its
`Mcp·Used` event, carried by the `AsyncLocalStorage` scope `registerTool` wraps
every handler in (`tool-scope.ts`), so the dashboard says which tool broke. A **4xx is deliberately NOT reported** — a bad id or
malformed elements is expected, model-correctable input, not a fault, and
reporting it would flood the view (an empty Exceptions view is the goal).
Fire-and-forget, generic tokens only — never a message, stack, or user content.
Every post (these reports and `Mcp·Used`) is handed to the request's
`ctx.waitUntil` (`request-scope.ts`) so it outlives the response, and
`Mcp·Used` is sent by `registerTool` only after a tool call succeeds
([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) Mcp).

### 4.13 Worker configuration

The MCP worker reads three bindings and two out-of-band values. Bindings
(`API` service binding, `OAUTH_KV`) are declared in `wrangler.toml`; the rest:

| Name                  | Where                          | Absent means                                                                                                                                                            |
| --------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONSENT_BASE_URL`    | `[vars]` (not secret)          | Defaults to `https://livediagram.app`, so a self-host's OAuth callers land on the hosted consent screen instead of their own                                            |
| `INTERNAL_EVENTS_KEY` | worker secret, **also on api** | This worker's telemetry shares the anonymous per-IP rate-limit bucket and throttles itself ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)) |

`INTERNAL_EVENTS_KEY` exists because §4.12's telemetry posts travel over the
**service binding**, which carries no `CF-Connecting-IP` — so the api's
`clientIp` fell back to a literal `'anonymous'` and every internal caller in
the world contended for one 120/min key, the overflow dropped as a 204 this
worker can't distinguish from success. Since we post one request per tool
call, that ceiling was roughly two tool calls per second globally: enough to
make a growing integration read as flat in the very dashboard meant to show
it growing. The value **must match** the api worker's, and a mismatch is
silent — the deploy workflow drives both from one GitHub secret for exactly
that reason. See [Secrets policy](../002-project-scope/secrets-policy.md) for the secrets table.

### 4.14 Tool annotations (behaviour hints)

Every registered tool carries an MCP **`annotations`** block alongside its
title and description. These are the standard behaviour hints
(`readOnlyHint`, `destructiveHint`, `openWorldHint`), and they are not
decoration: a client reads them to decide whether a call needs a per-use
permission prompt, so a read-only tool runs without interrupting the user
while a destructive one always asks. Directory listings (the Claude connectors
portal among them) also require them, and a missing block is a listing blocker,
which is how the gap was found.

Three behaviours cover the eleven tools, and each is a preset in
`apps/mcp/src/tool-annotations.ts`:

| Behaviour       | `readOnlyHint` | `destructiveHint` | Tools                                                                                 |
| --------------- | -------------- | ----------------- | ------------------------------------------------------------------------------------- |
| **read**        | `true`         | (not applicable)  | `find_documents`, `read_document`, `list_templates`, `list_trash`, `list_items`       |
| **write**       | `false`        | `false`           | `create_document`, `add_tab`, `share_document`, `rename_document`, `restore_document` |
| **destructive** | `false`        | `true`            | `update_document`, `delete_document`, `change_items`                                  |

The split mirrors §4.11's read-only-token boundary exactly (what a
`read_only = 1` token can still reach is what `read` annotates), so the hint a
client sees and the rule the api enforces can't drift apart.

`update_document` is **destructive** rather than a plain write: its `replace`
mode swaps a tab's whole element set, so an edit can overwrite work the user
already had. (Its `ops` mode is surgical, but a hint describes the tool, not
the argument, and the cautious reading is the right one.) `share_document`
stays a plain write: it mints a new link and changes nothing that existed,
and the link is revocable. `destructiveHint` is deliberately omitted where
`readOnlyHint` is `true`: MCP ignores it there, and stating it would imply the
tool writes.

**A new tool inherits this, it doesn't re-decide it.** Tools are registered
through the local `registerTool` wrapper in `tool-annotations.ts`, whose
config type makes `behaviour` a **required** field, so a tool added without
one is a type error, not a silently unannotated tool on the wire. Any
still-hand-rolled registration is caught by `tools.test.ts`, which drives the
real `registerTools` and fails on a tool whose annotations are missing or
whose hints don't match one of the three presets. Same reasoning as
§4.12's telemetry guard: nothing at runtime notices a missing hint, so the
test has to.

### 4.15 Descriptions state facts, not instructions

A tool description (and the server-level instructions block) says **what the
tool is and does**. It does not tell the calling model how to behave, and it
never steers it away from another tool or capability. Two reasons, and they
point the same way: a connector-directory review rejects behavioural
directives in a description, and a server that tries to govern a model it does
not own is overstepping, since the client owns that.

The rule bites where it's tempting to be helpful. Because the element format
is carried inline on every element argument (§4.5), the honest thing to say is
that the format is complete right there; earlier wording went one step
further and instructed the model not to web-search, open the repo, or read
another document to find it. Same information, but phrased as a rule for the
caller, so it was rewritten as a plain statement:

> The full element format is documented inline on each tool's element
> argument, so the tool definitions are the complete reference for it.

Where a genuine safety confirmation belongs, as in `delete_document` asking the
user before an irreversible delete, it stays, and is now also carried
structurally by `destructiveHint` (§4.14), which is the mechanism a client
actually acts on.
Pointing at a tool is fine too ("check list_templates first"): the flag is
discouraging tool use, not encouraging it.

### 4.16 Registry listing

The hosted server is listed in the official **MCP Registry**
(`registry.modelcontextprotocol.io`), which other directories (PulseMCP among
them) ingest from, so one listing reaches several catalogues.

- **Descriptor.** `server.json` at the repo root, under the registry's
  `2025-12-11` schema. Name `io.github.livediagram-app/livediagram`: the
  `io.github.<org>` namespace is proven by the repo's own GitHub OIDC token, so
  publishing needs no DNS record and no secret. One `remotes` entry,
  `streamable-http` at `https://mcp.livediagram.app/mcp`, with no `headers`:
  OAuth (§3) is discovered from the server's metadata, not configured by the
  client. The icon is the 512px mark in `marketing/media/icons`.
- **Publishing.** `.github/workflows/mcp-registry.yml` runs `mcp-publisher
login github-oidc` then `mcp-publisher publish` when `server.json` changes on
  `main`, or on manual dispatch. The registry rejects a version it already
  holds, so republishing means bumping `version` in `server.json`.
- **Self-hosts** are not listed: the descriptor names the hosted origin only.

### 4.17 Structured output and described parameters

Every tool declares an MCP **`outputSchema`**: the JSON Schema of the object it
returns on success. A successful result carries that object twice: as
**`structuredContent`**, which a client can parse and validate without reading
prose, and serialised as the first text block, for clients that only read
`content` (the backwards-compatible form MCP recommends). The four tools that
render a preview (`read_document`, `create_document`, `add_tab`,
`update_document`) add the inline PNG after it (`read_document` only when asked with `image: true`) ([§5](#5-visualise--inline-image-render)).
An error result (`isError: true`, a model-correctable message) carries text only
and no `structuredContent`; MCP exempts errors from the output schema.

| Tool               | Result object                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `find_documents`   | `count`, `documents[]` of `{ id, name, updatedAt, library, url }`                                         |
| `read_document`    | `id`, `name`, `tab { id, name, elements[] }`, `url`                                                       |
| `list_templates`   | `categories[]` of `{ id, label, description }`, `templates[]` of `{ kind, title, description, category }` |
| `create_document`  | `id`, `name`, `tabCount`, `tabIds[]`, `folder`, `url`                                                     |
| `add_tab`          | `documentId`, `tabId`, `name`, `url`                                                                      |
| `update_document`  | `id`, `tabId`, `url`                                                                                      |
| `share_document`   | `url`, `role`, `expiresAt` (ms epoch, or null for never), `documentUrl`                                   |
| `rename_document`  | `renamed` (`document` or `tab`), `name`, then `id` + `url` for a document or `tabId` for a tab            |
| `delete_document`  | `deleted` (`document` or `tab`), `documentId`, then `trashed` + `restorableForDays` or `tabId`            |
| `list_trash`       | `trash[]` of `{ id, name, library, reason, deletedAt, purgeAt }` (ISO timestamps)                         |
| `restore_document` | `restored`, `id`, `name` (null when the api omits it), `url`                                              |
| `list_items`       | `count`, `items[]` of `{ ref, id, type, status, title, fields }`, `url`                                   |
| `change_items`     | `applied[]` (one line per change), `url`                                                                  |

**The schema and the result can't drift.** The schemas live in
`apps/mcp/src/output-schema.ts`, one per tool, and the `registerTool` wrapper
(§4.14) makes `outputSchema` a **required** field beside `behaviour`, so a new
tool without one is a type error. The MCP SDK validates every successful
result against its tool's schema on the way out, so a result that stopped
matching fails the call loudly rather than shipping a wrong contract. A test
drives every tool through a real SDK client and server, which validates
`structuredContent` on both ends.

**Every input parameter is described**, nested fields included (each graph
node field, each `ops[]` entry's `op`, `element` and `elementId`). A parameter
with only a name and a type leaves the model guessing at intent and valid
values, and connector directories score servers on it. A test walks the
advertised `tools/list` schemas and fails on any property without a
description.

**Tool names stay `snake_case` verbs** (`create_document`, `list_trash`). Some
directories prefer dot-notation trees (`document.create`); it is not adopted,
because several clients restrict a tool name to `[a-zA-Z0-9_-]`, and a rename
would break every existing connection and the cross-references between tool
descriptions.

<!-- legacy-names -->

### 4.18 Deprecated tool names

The tools named for the container were `*_diagram` / `find_diagrams` before it became a document ([Document](../006-document/document.md)). Each `*_document` tool is also registered under its old name until **30 April 2027** (`apps/mcp/src/legacy-tool-names.ts`, wired in `registerTool`):

- The alias is the same tool: the same handler, input and output schemas and behaviour annotations.
- Its title ends in "(deprecated)" and its description opens with "Deprecated: use `<new name>` instead; this name is removed on 2027-04-30.", so a model reading the tool list prefers the new name.
- A call logs `[mcp] deprecated tool name <old> -> <new>` and counts as `Mcp·Used·<NewName>`, so the feature's history stays one line.

The output literals that named the container changed with it: `renamed`, `deleted` and `restored` report `document` where they reported `diagram`.
<!-- /legacy-names -->

## 5. Visualise — inline image render

`create_document`, `add_tab` and `update_document` return, and `read_document` with `image: true` returns, an **inline
PNG** so the diagram shows in the chat. This needs headless rendering inside a
Worker (no DOM, no React).

- **Reuse what's already pure.** The existing export
  (`apps/live/lib/export-tab.ts`) has a **purely procedural SVG path**
  (`renderTabToSvg`) that already calls headless helpers in `packages/document`:
  `arrow-path.ts` (path `d` strings, label anchors), `geometry.ts` (endpoint /
  anchor / bounds), `colors.ts` (`defaultFillColor` / `defaultStrokeColor` /
  `defaultTextColor` theme resolution). The PNG/PDF paths are Canvas/DOM-bound
  and are **not** reusable.
- **Extract a shared renderer.** Move the SVG-building logic into a new pure
  `packages/document/src/svg-render.ts` (`renderElementsToSvg(tab): string`),
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
- **No scaled strokes.** resvg ignores `vector-effect="non-scaling-stroke"`, so
  the renderer never relies on it: stretched silhouettes (frames, cylinders,
  device frames) are mapped into the element box point by point
  (`svg-shape-fit.ts`) rather than nested in a scaled `<svg>`. Before that, a
  frame's border in the preview grew with the frame, several pixels thick on a
  large group.
- **Image-element embedding.** When a rendered tab has image elements,
  `imageResult` prefetches their bytes (owner-authed via the caller's token,
  `GET /api/images/:id`) and inlines them as base64 data URIs through the
  renderer's `resolveImageHref` hook — resvg (WASM) can't fetch, so the bytes
  must be inline. Each image is capped (2 MB) so a large upload doesn't bloat the
  preview's own base64 payload; over the cap, or on any fetch failure, it falls
  back to the placeholder rectangle (the structured elements still carry the id).
  A tab with no images does no extra work. The fetch-and-inline core is
  `embedTabImages` in `@livediagram/api-schema`, shared with the api worker's
  snapshot render ([Document SVG snapshots](../006-document/document-snapshots.md)), which passes its own byte source (R2) and a total
  budget instead of this per-image cap. The data URL takes the image's stored
  type; one stored without an image type (`application/octet-stream`) is
  labelled by sniffing its bytes, and bytes that match no accepted format keep
  the placeholder.
- **Element coverage.** The shared renderer draws tables as their real grid
  (tracks / headers / zebra / per-cell text, `svg-render-table.ts`), freehand
  sketches as the canvas draws them (the same Catmull-Rom smoothing, straight
  segments for a polygon-tool path), the full shape-silhouette vocabulary (hexagon /
  cylinder / document / cloud / devices / actor / frame ... —
  `svg-render-shapes.ts`, drawn from the same geometry table as the editor's
  ShapeSvgOverlay: `shape-geometry.ts`, pinned by a test per kind on each side),
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
2. **Shared SVG renderer** — extract `packages/document/src/svg-render.ts` from
   `export-tab.ts`, repoint the in-app export to it (no behaviour change), add
   `@resvg/resvg-wasm` rasterisation in the worker.
3. **Tools, read-first** — `find_documents`, `read_document` (+ schema resource).
   These are read-only and prove the schema + render path end to end.
4. **Write tools** — `create_document`, `update_document` (both modes), reusing
   `validate.ts` + `auto-layout.ts`.
5. **OAuth** — `/api/oauth/exchange` on the api worker (reusing the token-mint
   path, Clerk-gated like `/api/tokens`); `apps/live` consent page; the MCP
   OAuth endpoints + `OAUTH_KV`. Until this lands, the worker can be exercised
   with a hand-pasted `lvd_` Bearer for development.
6. **Docs + help, shipped WITH the feature** (per the help-centre + docs rules in
   `AGENTS.md`):
   - A help article (e.g. `account-and-data/connect-ai-mcp`) — what the MCP is,
     connecting it to Claude/an AI tool, the signed-in-only limitation, that it
     mints a revocable API token — **registered in `apps/help/lib/articles.ts`**.
   - `docs/development/architecture.md` — the new `apps/mcp` worker in the layout + deploy
     order; `docs/operations/self-hosting.md` — MCP needs Clerk (like tokens/teams) and is
     optional to deploy; `README.md` repo-layout tree gets the new app.
   - Cross-link from the API-token help/docs ([Public API and API tokens](public-api-and-tokens.md)).

## 7. Out of scope (for now)

- **Streaming progress** from tools (the SDK supports it; v1 returns once).
- **Folder / team management** via MCP — there are no tools to list, rename, or
  move folders (create_document files new documents at the root of the user's My documents, or their default folder);
  more `/api` surface can be wrapped later if demand appears. (Share-link
  creation IS in scope now — `share_document`, [§4.8](#48-share_document); managing
  folders/teams themselves stays out.)
  (Team **content** is in scope: `find_documents` sweeps team shared libraries
  and the other tools read/edit team documents through the ordinary access
  gates — [§4.1](#41-find_documents), [Public API and API tokens §3.4](public-api-and-tokens.md).
  Managing teams themselves stays out, and the api refuses it to tokens.)
- **Token-paste connector** as a supported path — OAuth is the chosen front door
  ([§3](#3-authentication-oauth-21)); a raw Bearer still works for local dev but
  isn't a documented user flow.
- **Finer-grained scoped MCP tokens** — a **read-only** token now exists
  ([§4.11](#411-read-only-tokens-the-one-scope), [Public API and API tokens](public-api-and-tokens.md) §3.4); per-resource /
  per-verb scopes beyond that stay deferred.
