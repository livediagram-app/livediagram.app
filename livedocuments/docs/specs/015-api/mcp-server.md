# MCP server

**Status: live.** Merged and deployed at `mcp.livedocuments.app`; connect flow
verified end-to-end from Claude. Builds directly on [Public API and API tokens](public-api-and-tokens.md)
(API tokens), which it picks up where §7 left off: [Public API and API tokens](public-api-and-tokens.md) deferred "OAuth /
third-party app authorization" — this spec adds exactly that, scoped to one
client (an MCP server), reusing the `lvd_` token as the credential it ultimately
mints. No new authorization model; an OAuth front door onto the existing token.

## 1. Goal

Let a person connect livedocuments to whatever AI tool they already drive (Claude
desktop/web, Claude Code, any MCP client) and, from inside that tool:

1. **Find and view** the documents they already have — search by name, get back a
   link to open in the editor **and an inline image** of the document.
2. **Create** a new document from a request — e.g. point the AI at a codebase and
   have it write an article or a slide deck explaining it.
3. **Edit** an existing document — full rework of a tab, or a small adjustment.

**The calling LLM does the thinking; the MCP is only the bridge.** This is the
load-bearing decision. livedocuments runs no model of its own (the in-editor
AI assistant was removed). The user already has a capable model in front of them; the
MCP's job is to (a) hand that model the element **schema** so it can emit
well-formed elements, (b) **validate + lay out** what it produces, and (c)
**persist** it through the same REST API the web app uses. The MCP carries no
model of its own and makes no LLM calls.

**Keep the surface small.** Fifteen tools and one schema resource (see
[§4](#4-tools)). Each tool is a thin wrapper over an existing `/api` route plus
shared helpers from `packages/document`; the MCP adds no business logic that
isn't reusable.

This must not weaken the friction-free guest model
([Auth + guest access](../014-identity/auth-and-guest-access.md)) or self-hosting
([Open source + distribution](../002-project-scope/open-source-and-business-model.md)). Like API tokens and teams,
the MCP is **signed-in only** and **absent end-to-end** on a no-auth self-host.

## 2. Architecture

A **new standalone Cloudflare Worker**, `apps/mcp` (worker name
`livedocuments-mcp`), mirroring how Manager Toolkit ships its MCP as its own
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
- **Routing + deploy.** Served at **`mcp.livedocuments.app`** (its own hostname,
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
   admits another scheme such as `javascript:`, and never with a fragment, per RFC 6749
   §3.1.2; the rule is `oauthRedirectUrl` in
   `@livedocuments/api-schema`), stored in KV with a TTL.
   Rate-limited per IP. Authorize re-checks the scheme of the requested
   redirect URI, and the consent page only ever navigates to an http(s) URL.
   The token endpoint refuses a code presented with another `client_id`.
3. **Authorize** — `GET /oauth/authorize` creates a short-lived session in KV and
   redirects to a **consent page in `apps/live`** (e.g. `/oauth/authorize` or an
   Explorer "Connect an app" screen), passing the session id. The user is
   already signed in there (a livedocuments session through the liveworkspace accounts
   Worker; a signed-out visitor gets a Sign in link that returns here).
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
   endpoint that requires a verified account identity (gated exactly like
   `/api/tokens`), and on success **reuses the existing token-mint path**
   (`generateApiToken` → `hashApiToken` → `createApiToken`,
   `apps/api/src/auth/api-token.ts` + `db/api-tokens.ts`) to create an `lvd_`
   token owned by that account, named for the connecting client (e.g. "Claude
   (MCP)"). It binds the PKCE challenge so only the holder of the verifier can
   redeem it. A minted token is never left orphaned: the page re-checks the
   session (`GET /oauth/session/<id>`) before minting, and when the MCP's
   `/oauth/complete` refuses the token (the session expired or was used, a 429)
   it revokes it at once (`DELETE /api/tokens/<id>`), so retries never pile up
   six-month tokens against the per-account cap. The failure line names the
   cause: an expired request ("This request has expired. Start the connection
   again from your app."), the token cap (409 `token_limit_reached`: "Your
   account has reached its limit of API tokens. Revoke one in Settings, under
   Account › API Tokens, then try again."), or anything else ("Something went
   wrong. Please try again."). The device page does the same
   (`apps/live/lib/oauth-handover.ts`).
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

**Self-hosting / sign-in gating.** OAuth depends on the consent page authenticating
the user through sign-in and on `/api/oauth/exchange` requiring an account identity — the
same gate as `/api/tokens` ([Public API and API tokens §3.7](public-api-and-tokens.md)). A
no-auth self-host: the exchange endpoint rejects every caller and the consent
page has no signed-in user, so the MCP can mint nothing. Operators who don't want
the MCP simply don't deploy `apps/mcp`; nothing else references it.

**The CLI signs in here too** ([CLI](cli.md#authentication)). This server is the
one authorisation server for both front doors, so it also offers what a
command-line client needs: a loopback redirect matched on scheme, host and path
with any port (RFC 8252 §7.3), a pre-registered public client `livedocuments-cli`
whose name the consent screen can trust, and the device authorisation grant
(RFC 8628) with a `/oauth/device` page in `apps/live` for machines without a
browser. A token minted for the CLI is named "livedocuments CLI".

## 4. Tools

Fifteen tools: thirteen for documents and two for pages and articles ([§4.9d](#49d-the-pages-tools)), besides the deprecated names ([§4.18](#418-deprecated-tool-names)). The search/view capability is two tools (find, then read); create,
add_tab, and update are separate because their inputs and intent differ;
list_templates exposes the template catalogue ([§4.5](#45-list_templates)), search_icons the icon catalogue
([§4.5a](#45a-search_icons)) and list_images the user's image gallery ([§4.5b](#45b-list_images));
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
team's name and `url` is the `livedocuments.app` deep link to open it. **No image
here** — kept lightweight so the model can scan many results cheaply, then
`read_document` the one it wants.

### 4.2 `read_document`

Fetch one document's full content **and render it** — this is the "visualise"
capability. Input: `documentId`, optional `tabId` (defaults to the first tab).
Wraps `GET /api/documents/:id` + `GET /api/documents/:id/tabs/:tabId?view=outline`. Returns the
tab's [outline view](../024-agents/document-views.md), about a tenth of the element JSON, with
the refs the edit tools take (`format: "json"` returns the elements instead), plus the deep-link
`url`. With `image: true` it also attaches an inline **PNG** of the tab as MCP image content
([§5](#5-visualise--inline-image-render)); without it a read costs no image tokens. So "show me my onboarding deck" → `find_documents` →
`read_document` with `image: true` renders it inline. Its structured result carries the tab's `rev`,
which `update_document` takes back as the base of its ops ([§4.4](#44-update_document)).
It also takes `view` (`outline`, `pages`, `layout`, `comments`, `show`, `find`), `budget` (8,000 tokens unless
given), `only`, `ref`, `q`, `coarse`, `all` and `style`; a ref that names nothing or several comes back as a
correctable result naming the candidates.

### 4.3 `create_document`

Create a new document from elements the model produced. Input: `name`, `tabs:
[{ name, elements: Element[] }]` (one tab, or several to build a **multi-tab**
document in one call — an overview plus a detail tab per subsystem), the
optional `layout`, and the optional `markUsed` (boolean, default `true`). Each tab may instead pass `template: TemplateKind` in place
of `elements` — the server materialises the hand-tuned scaffold from
`@livedocuments/templates` ([§4.5](#45-list_templates)), keeping its curated
layout (`layout` is ignored for a template tab) and applying that template's
canvas overrides; the model then personalises labels via `update_document`'s
`ops` mode. The MCP:

1. **Validates** each tab's `elements` with `isValidTab` (reject `400`-style with
   a clear message naming the offending tab).
2. **Lays out — but the model decides.** A `layout` argument (`'auto'` |
   `'preserve'`, optional) governs it: `'preserve'` keeps the exact coordinates
   the model gave (so it can draw a deliberate shape — a cycle as a ring, a tree,
   a grid), `'auto'` runs `autoLayoutElements`, and **omitted = auto-detect**:
   preserve a real arrangement, but run the layout when the model left elements
   piled at ~one point (`nodesLookUnplaced`). The server never overrides the
   model's spatial intent; when it does lay out it reuses the editor's engine, so
   the model is never _forced_ into pixel-perfect placement.
3. **Tags it as made by AI.** The create sends `source: 'mcp'`, which the Explorer's **Made by AI** filter (`made-by:ai`, [Explorer filters](../013-workspace/explorer-filters.md)) reads, so a user's own work and AI-made documents can be told apart wherever either is filed. Unfiled, it sits at the root of My Work like any other document, with its **Made by AI** badge. (Earlier this find-or-created a real "Generated" folder, then the Explorer showed a Generated view; provenance is a filter, not a place.) The create also sends the creation `intent` of the first tab it built and the template it used, so with no folder named the server files it in the user's [default folder](../013-workspace/default-folders.md) for that intent, when they have one.
4. **Persists** all tabs via `POST /api/documents` (which seeds a `tabs[]` array
   and accepts `source`). A tab given as a `template` travels
   as such and is compiled by the api ([API app](api.md)), so the MCP and the
   [CLI](cli.md) build documents alike.
   Making a document is a use of it, so it joins the user's
   Jump Back In at once ([Explorer Home](../013-workspace/explorer-home.md#making-a-document));
   `markUsed: false` is passed through to the create
   ([API](api.md#marking-a-document-used)) for a model making many documents in one go,
   so a batch never pushes the user's own work out of reach. Absent, nothing is sent and the
   create counts.
5. **Returns** the new `id`, tab count + ids, the folder ("My Work" for the root,
   or the name of the default folder it was filed in), the deep-link `url`,
   **and the rendered PNG of the first tab** so the user sees the result inline.

### 4.3a `add_tab`

Add a **new tab** (its own canvas) to an existing document — the motivating case:
"add a tab with the speaker handout for this deck." Input:
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

**Edits.** `ops` mode takes `edits` instead of `ops` (`mode: "edits"` names the same mode, as agents read it): [edit operations](../024-agents/edit-operations.md) in the line
form, one a line, sent as the changeset's operations text for the api to parse and apply all or nothing. They reach
what JSON ops cannot say in one step (`insert … between a b` making room, `connect a -> b`, `layout`
of a selection, placement beside another element), and they are the language each [lint](../024-agents/diagram-lint.md)
finding's fix is written in, so a finding in a write's result can be applied as printed. The base is the revision the
model read (else the tab as loaded) and every element's fingerprint as loaded, since the text may name any of them.
Coordinates in edits are relative to the content origin, as views print them. `ops` and `edits` together are refused.
The tool's `edits` description carries the vocabulary, selectors, placements and keys in brief.

**Arrow ends by ref.** A pinned arrow end the model writes (on `create_document`, `add_tab` and both modes here)
may name its element by id or by the ref `read_document` prints, as an op's `elementId` may. Each end is resolved
among the ids the result will hold: in `ops` mode the tab's elements and every element the call adds; in `replace`
mode and on a new tab only the elements sent. An end that names nothing there, or more than one element, refuses
the call, naming the arrow and its side (`arrow "a1": "to" is pinned to "4aeb", which is no element on the tab or
in this call`); an arrow to nowhere is never stored.

**Values checked.** A whole element the model sends (on `create_document`, `add_tab`, `replace` and an ops `add`)
is checked as an edit operation's `set` checks a field: a field its type does not have is refused with the fields
like it (`"icon" is not a field of a shape; fields like it: iconId, iconPosition`), a value off a closed vocabulary
(`textSize` `sm`, `md`, `lg`, `scale` or a pixel number; the alignments, arrow styles, ends and heads, border styles
and radii, and the content kinds' looks, media, attach points and pyramid variants: the
same list edit operations check, [Edit operations](../024-agents/edit-operations.md)) is refused naming the values,
and an `iconId` that names no icon is refused with the icons like it and a
pointer to `search_icons`. Each of these was once stored and drawn wrong in silence. The check passes every element
of every template, so a tab read back as JSON writes again unchanged.

### 4.5 `list_templates`

Browse the template library — the same hand-tuned catalogue the editor's
template starts ship ([Canvas and palette](../008-canvas/canvas-and-palette.md)), served from the shared
`@livedocuments/templates` package so the worker and the editor can't drift.
No input. Returns the categories plus one row per template:
`{ kind, title, description, category }` — enough for the model to pick a
`kind` and pass it as `template` on `create_document` / `add_tab`. Deliberately
metadata-only (no elements): the scaffold materialises server-side on create,
so the model never has to re-emit — or accidentally mangle — a curated layout.
The recommended flow for "make me a pitch deck"-style asks: `list_templates`
→ create with `template` → `update_document` (`ops`) to fill in real content.

A `template` that names no kind is refused before anything is written, offering the kinds it most likely meant first:
those whose kind or title has a word starting with a word of it of 3 letters or more (`closestTemplateKinds`, at most
`CLOSEST_TEMPLATES_MAX` (5)), then every kind: `Unknown template "deck". Closest: slide-deck, blank-slide-deck.
Valid kinds: ...`. The CLI's and api's template bodies refuse with the same hint.

### 4.5a `search_icons`

Finds icons by what they show, best match first, across the icon catalogue: `{ query, limit? }` (20 by default, at most 50) answers `{ icons: [{ id, label, set }], more }`. An
id is what an element's `iconId` takes. The catalogue is bundled with the worker (`@livedocuments/icons`'s
`searchIcons`, the api's `/icons` route and the CLI's `icon search` use the same ranking), so the search makes no
api call. Read-only.

### 4.5b `list_images`

The user's image gallery ([Image element](../009-elements/images.md#agents)), so an element can show a picture the
user uploaded, such as a screenshot: `{ query?, limit?, image? }` answers `{ images: [{ id, name, width, height,
size, uploadedAt }], more }`, newest first, `query` matching the name, `limit` 20 by default and at most 50, `size`
in bytes. An id is what an `image` element's `imageId` takes. Names are often a camera's or a screenshot tool's
("Screenshot 2026-10-12 at 14.03.png"), so `image: true` adds a **contact sheet**: one PNG of the listed images (the
first 12), each drawn to fit a cell above its place in the list and its name, through the same image embedding as
the preview ([§5](#5-visualise--inline-image-render)). The sheet spends the preview's picture budget itself, from the
sizes and dimensions the gallery lists: it draws pictures in order only while they stay within it, and each one past
that keeps a placeholder captioned "too large to draw here", and its bytes are not fetched. The gallery is the caller's own (`GET /api/images`, owner
only): a teammate's uploads are not in it. Read-only, so a read-only token may call it. A deployment without image
storage answers that images are not available here.

There is no upload tool: a chat assistant cannot pass an attachment's bytes to a tool, so pictures reach the gallery
through the editor (upload, paste or drop) and the assistant places them from there.

### 4.6 Schema resource (not a tool)

A static, cacheable MCP **resource** — e.g. `livedocuments://schema/elements` —
returning a compact description of the element schema: the element types
(`shape` / `text` / `sticky` / `arrow` / `table` / …), the shape vocabulary,
required fields, the pinned-arrow anchor convention (`from.e → to.w` etc.), and
the design rules that make pages read well (don't set colours — the theme
owns them, a sticky's own colours excepted; size siblings consistently; prefer
pinned arrows), and the content fields of the kinds that carry content (§4.7a). This is **how the
model produces high-quality pages**: the schema is presented once, declaratively,
rather than baked verbatim into every tool description. The same essentials are
also summarised in the MCP server `instructions` and in the `create`/`update`
input-schema field descriptions, so a client that ignores resources still gets
enough. The schema text derives from `packages/document` types — single source of
truth, no hand-maintained copy that can drift.

### 4.7a Content-carrying element kinds

These kinds hold content of their own, and the element format documents their
fields so a model can fill them rather than guess: **sticky**, **table**,
**code block**, the three **charts** (bar, line, pie), the **Sankey**, **card**, **badge**, **step**,
the concept graphics (**layer stack**, **pyramid**, **cycle**, **hub**, **onion**, **chevrons**, **timeline**),
**stack** and the **image**.
Every other kind stays listed by name only. The field notes are facts about what
each field does (§4.15), carried on the tools' element argument and in the
schema resource (§4.6), short enough not to bloat every tool definition.

| Kind                                        | Content fields                                                                                            | Facts the notes state                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sticky` (type)                             | `label`; optional `fillColor` + `textColor`                                                               | The theme never recolours a sticky, so its own colours are kept; the notes list the palette's sticky pairs (classic, lemon, peach, rose, lilac, sky, mint, teal, slate, paper, charcoal, ink). Unset, it is the classic amber note.                                                                                                                                                                                   |
| `image` (type)                              | `imageId`, `alt`, `objectFit`                                                                             | `imageId` is an id from `list_images`; one not in the caller's gallery is refused, naming `list_images`. Without `imageId` the element is a placeholder the user fills in the editor. `objectFit` `contain` (the default) shows the whole picture, `cover` fills the box and crops; `alt` describes the picture. A box of the picture's own proportions (`width` and `height` from `list_images`) shows it uncropped. |
| `table` (type)                              | `cells` (rows of strings), `headerRow`, `headerColumn`, `zebra`                                           | The first row is the header when `headerRow` is set.                                                                                                                                                                                                                                                                                                                                                                  |
| `code-block` (shape)                        | `code` (up to 4000 chars), `codeLanguage`, `codeTheme`, `codeWrap`                                        | The languages and themes are listed; the block draws itself, so `label` is not shown.                                                                                                                                                                                                                                                                                                                                 |
| `bar-chart` / `pie-chart` (shape)           | `pieSlices` `[{ label, value }]`                                                                          | A chart draws no title: a caption is a separate `text` element. Categories show in the legend.                                                                                                                                                                                                                                                                                                                        |
| `line-chart` (shape)                        | `lineCategories` (x labels), `lineSeries` `[{ name, values }]`                                            | The same, with one value per category.                                                                                                                                                                                                                                                                                                                                                                                |
| `sankey` (shape)                            | `sankeyFlows` `[{ from, to, value }]` (up to 200), options                                                | Nodes are the names; `source` / `target` and text amounts (`"1,200"`) are read too. A flow back to an earlier node is hidden. Options: `sankeyLinkColor`, `sankeyAlign`, `sankeyValueLabel`, `sankeyUnit`, `sankeyNodes`, `sankeyLeftover` (`show` by default: an unbalanced middle node draws its difference to a Leftover node), `sankeyLeftoverName`. No title.                                                    |
| `card` (shape)                              | `pageTitle`, `pageSubtitle` (meta), `label` (body), `cardMedia`, `iconId`, `cardHeader`, `tags` (up to 6) | Use cards for service and component nodes: title the thing, meta the product or runtime, tags the facts. `callout` is accepted and becomes a card with `cardMedia: 'badge'`.                                                                                                                                                                                                                                          |
| `badge` (shape)                             | `label` (up to 24), `chipLook`, `attachedTo`, `attachAt`                                                  | A badge attached to a node sits on one of its eight points and is placed there by the server; no x / y needed.                                                                                                                                                                                                                                                                                                        |
| `step` (shape)                              | `label` (the number, up to 3), `chipLook`, `attachedTo`, `attachAt`                                       | Number the steps of a walkthrough 1, 2, 3; place them on or beside the arrows they mark.                                                                                                                                                                                                                                                                                                                              |
| `layer-stack` / `pyramid` / `cycle` (shape) | `conceptRows` `[{ label, note? }]`, `pyramidVariant`, `label` (a cycle's centre)                          | Rows: stack 2 to 8 (note = side note), pyramid 2 to 6 (first row the apex; note = a funnel's value), cycle 3 to 8 (clockwise from the top).                                                                                                                                                                                                                                                                           |
| `hub` / `onion` / `chevrons` (shape)        | `conceptRows` `[{ label }]`, `hubSpokes`, `label` (a hub's centre)                                        | Hub 3 to 8 satellites, onion 2 to 6 rings from the core out, chevrons 2 to 8 stages left to right.                                                                                                                                                                                                                                                                                                                    |
| `timeline-rail` (shape)                     | `conceptRows` `[{ label, note }]`                                                                         | A Timeline: 2 to 8 milestones left to right, `label` what happens, `note` when (a date, a quarter).                                                                                                                                                                                                                                                                                                                   |
| `stack` (shape)                             | `stackDirection`, `stackColumns`, `stackGap`, `stackPadding`, `stackAlign`                                | Children are the elements whose centre is inside; the editor lays them out.                                                                                                                                                                                                                                                                                                                                           |

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
  them, the title alignment and padding. Unset, text scales to
  fill its box, so a sticky's note filled it edge to edge; a box drawn in the
  editor never arrives that way. On a list of more than 12 labelled
  boxes, a box that gives no `textSize` takes `sm` rather than `md`, so a page of twenty boxes
  does not wrap its names mid-word. A raw arrow pinned at both ends that gives no `arrowStyle` is
  angled, and an angled one that gives no bends takes two (out of its
  start, across, into its end), so it meets both ends square;
  one whose ends line up runs straight. `"arrowStyle": "straight"` keeps a diagonal. Both defaults are for content
  arriving fresh: a `replace` that sends back elements the tab already holds (by id) leaves their text size and lines
  as they are, so reading a tab and writing it back never restyles what the person made.
- A **table**'s ragged rows are padded to the widest (`normalizeTable`, the same
  pass the editor runs on load), so every row renders.
- An unknown **codeLanguage** becomes `plain` and an unknown **codeTheme** is
  dropped (the default), rather than failing the whole tab validation.
- **Chart** data is coerced: a slice or value that is not a finite number
  becomes 0, labels become strings, and each series' `values` is padded or cut
  to the category count. Empty data draws the built-in sample, which the notes
  state.
- **A freehand stroke in the former `{ nx, ny }` shape is packed**
  ([Stroke points](../006-document/stroke-points.md)): a stroke read from a tab
  carries its points as one `packedPoints` block, and a model that writes
  `points` instead gets them packed, as the api's own writes would. In an
  update, sent `points` replace the stroke's block (`mergeElementUpdate`).

**Style fields.** The element format names the style fields a box or arrow takes beyond its geometry, as facts:
every closed vocabulary from `ELEMENT_FIELD_VALUES` (text size and alignment, icon position, arrow style, ends and
heads, border style and radius, font) with its values, bold and italic, `colorPreset` with the theme's preset looks,
`iconId` (from `search_icons`) and `note`. Before, these were discoverable only by reading a template's JSON, and
an agent hand-placing an infographic guessed `textAlign` and `textSize: "xl"`.

**Block kinds.** The format also names what the ready-made blocks hold:
a checklist's `checklistItems`, a stat row's `stats`, a callout's `pageTitle` over its `label` body, a banner's
`pageTitle` and `pageSubtitle`, and a sticker's `stickerId`. A bare `text` is centred in its box unless it sets
`textAlignX`.

**Outlines.** A `freehand` element (a logo's polygon outline) is written with `points` as canvas coordinates, `[[x, y], ...]` in
drawing order, `closed` to close and fill it, and a `penColour` (ink, grey or a hued pen). The stored form is a box
with the points packed inside it ([Stroke points](../006-document/stroke-points.md)), which no model can write, so
the MCP takes the box from the points and packs them through the stored-tab migration, before the element is
checked, on every element path (`freehand-points.ts`), and an ops update giving a stroke new `points` sets its new box and block together, where a bare `points` field would have emptied the stroke. Points it cannot draw (none, more than
`MAX_FREEHAND_POINTS`, or not number pairs) are refused naming the element. The format says that any box may carry a small `rotation`.

**Found by search.** A client that searches tools by text finds a tool by its name, description and schema, and
ranks long ones down or leaves the largest out. So `create_document` leads with what it makes (a slide deck among
them, and how to start one), `change_pages` and `write_article` say which is for slides, and the single-`tab` alias
is checked against the tab shape by the tool rather than repeating that shape (the whole element format) in the
schema: the definition halved, from about 41 KB to 21 KB, the size of `update_document` and `add_tab`.

**No CLI hints.** An edit's result text is the api's, less its footer's revert line: that line names the
`livedocuments changeset revert` command, which no MCP tool runs. Its `@x,y` positions are from the content's top-left as it was read, while an element's `x` and `y` are canvas
coordinates; when the content does not start at 0,0, a closing line gives the offset (`x, y = @x + ox, @y + oy`),
so a position read from a result is not sent back off by it.

### 4.8 `share_document`

Create a shareable link so anyone with the URL can open a document without
signing in — the verb that turns "the AI made a deck" into "the AI made a
deck and here's a link to send the team." Wraps `POST /api/documents/<id>/share`
([Share password](../013-workspace/share-password.md)): `{ documentId, role?, expiry? }` → the public URL
(`/document/shared?s=<code>`), the granted role, and the expiry. `role` is
`view`, `participate` or `edit` ([Share roles](../013-workspace/share-roles.md)) and defaults to
**`participate`**: recipients take part (stickies, text, comments) without reshaping the pages, and an automated share
never silently grants edit; the model passes `edit` to allow any change or `view` for an audience, and
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

### 4.9d The Pages tools

The pages of a tab and the articles written on them ([Pages for agents](../024-agents/pages-for-agents.md)).
Pages are named by id, place (`2`) or name; articles by flow id or title. Both tools go through one api route
(`POST /api/documents/:id/tabs/:tabId/pages`, `apps/mcp/src/pages-tools.ts` over
`packages/agent-verbs/src/pages/`) and the editor's own page edits, and reach open editors at once.

- **`change_pages`** (destructive, as it deletes and replaces page content): up to 50 page changes in order,
  `add` `{ kind, size, orientation, name, background, layout, at }` (infographic, slide or logo), `set`
  `{ page, name, size, orientation, background, locked }`, `layout` `{ page, layout }`, `move` `{ page, to }`,
  `duplicate` `{ page }`, `delete` `{ page }` and `apply_background_to_all` `{ page }` (every other page of its kind
  takes its background), written as one edit; a refusal writes nothing and names the
  change. The answer lists each page with its rectangle on the canvas, where `update_document` puts elements.
- **`write_article`** (destructive, as a replace drops the old text): an article's text from Markdown (front
  matter `title:` / `subtitle:`, headings, lists, to-dos, quotes, code, dividers, `\pagebreak`), `replace` or
  `append`, a new article or a named one, with an optional look, accent and page numbers. The editor flows it
  onto as many pages as it needs.
- **Reading**: `read_document` with `view: "pages"` lists the pages, the elements on each, the layouts on offer
  and each article as Markdown in the form `write_article` takes.

### 4.10 Prompts (discoverability)

Registered MCP **prompts** — pre-canned templates a client surfaces as slash
commands / quick actions, so a user finds what the server does without knowing
the tool names. Pure text (no api calls, no auth to list); each steers the model
to the right tools:

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
security boundary (the tool list is static, but the api is the enforcer). Signed-in
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

| Name                  | Where                          | Absent means                                                                                                                                                                       |
| --------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONSENT_BASE_URL`    | `[vars]` (not secret)          | Defaults to `https://livedocuments.app`, so a self-host's OAuth callers land on the hosted consent screen instead of their own. Also the host of every tool's `url` and share link |
| `INTERNAL_EVENTS_KEY` | worker secret, **also on api** | This worker's telemetry shares the anonymous per-IP rate-limit bucket and throttles itself ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))            |

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

Three behaviours cover the fifteen tools, and each is a preset in
`apps/mcp/src/tool-annotations.ts`:

| Behaviour       | `readOnlyHint` | `destructiveHint` | Tools                                                                                            |
| --------------- | -------------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| **read**        | `true`         | (not applicable)  | `find_documents`, `read_document`, `list_templates`, `search_icons`, `list_trash`, `list_images` |
| **write**       | `false`        | `false`           | `create_document`, `add_tab`, `share_document`, `rename_document`, `restore_document`            |
| **destructive** | `false`        | `true`            | `update_document`, `delete_document`, `change_pages`, `write_article`                            |

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
  `2025-12-11` schema. Name `io.github.livedocuments-app/livedocuments`: the
  `io.github.<org>` namespace is proven by the repo's own GitHub OIDC token, so
  publishing needs no DNS record and no secret. One `remotes` entry,
  `streamable-http` at `https://mcp.livedocuments.app/mcp`, with no `headers`:
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
and no `structuredContent`; MCP exempts errors from the output schema. Every mistake the caller can fix is
such a result, never a thrown protocol error: the `registerTool` wrapper answers an api 4xx in words (by its
code or status: a document in the Trash, a view-only grant, an id that names nothing) and a named input error
(a tab id the document lacks names its tabs); only a 5xx or a network failure throws. A deleted tab's refusal
says why by its status (no such tab, view only, the last tab).

| Tool               | Result object                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `find_documents`   | `count`, `documents[]` of `{ id, name, updatedAt, library, url }`                                         |
| `read_document`    | `id`, `name`, `tab { id, name, rev, ... }`, `tabs[]` of `{ id, name }` (every tab, in order), `url`       |
| `list_templates`   | `categories[]` of `{ id, label, description }`, `templates[]` of `{ kind, title, description, category }` |
| `create_document`  | `id` and `documentId` (the same), `name`, `tabCount`, `tabIds[]`, `folder`, `url`                         |
| `add_tab`          | `documentId`, `tabId`, `name`, `url`, `note` when a template has more tabs than it added                  |
| `update_document`  | `id` and `documentId` (the same), `tabId`, `url`                                                          |
| `share_document`   | `url`, `role`, `expiresAt` (ms epoch, or null for never), `documentUrl`                                   |
| `rename_document`  | `renamed` (`document` or `tab`), `name`, then `id` + `url` for a document or `tabId` for a tab            |
| `delete_document`  | `deleted` (`document` or `tab`), `documentId`, then `trashed` + `restorableForDays` or `tabId`            |
| `list_trash`       | `trash[]` of `{ id, name, library, reason, deletedAt, purgeAt }` (ISO timestamps)                         |
| `restore_document` | `restored`, `id`, `name` (null when the api omits it), `url`                                              |

**The schema and the result can't drift.** Each tool is a verb in the shared catalogue
(`packages/agent-verbs/src/verbs/mcp-tools.ts`, [CLI](cli.md#one-catalogue-for-the-cli-and-the-mcp)) holding its
name, title, description, behaviour and both schemas (`packages/agent-verbs/src/mcp/output-schema.ts`, one per
tool); the `registerTool` wrapper (§4.14) registers a tool only from its verb, so a tool without an output schema
or a behaviour cannot be written, and a parity test (`apps/mcp/src/verb-parity.test.ts`) fails when a registered
tool and its verb disagree. The MCP SDK validates every successful
result against its tool's schema on the way out, so a result that stopped
matching fails the call loudly rather than shipping a wrong contract. A test
drives every tool through a real SDK client and server, which validates
`structuredContent` on both ends.

**Every input parameter is described**, nested fields included (each `ops[]` entry's `op`, `element` and `elementId`). A parameter
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

- The alias is the same tool: the same handler, behaviour annotations and output schema, and its input checked
  against the same schema, refused in the SDK's own words (`Input validation error: Invalid arguments for tool <old
name>: ...`).
- Its title ends in "(deprecated)" and its description is one line: "Deprecated: use `<new name>` instead; this name
  is removed on 2027-04-30. It takes the same input as `<new name>`.", so a model reading the tool list prefers the
  new name.
- It lists an open input (any object), so the tool list carries each input schema once. The element format inside
  `create_document` and `update_document` is most of the list: listing it again under the old names made them 22% of
  every tool list (67,937 of 308,741 characters); without it they are 4% (10,733 of 251,537).
- A call logs `[mcp] deprecated tool name <old> -> <new>` and counts as `Mcp·Used·<NewName>`, so the feature's history stays one line.

The output literals that named the container changed with it: `renamed`, `deleted` and `restored` report `document` where they reported `diagram`.
<!-- /legacy-names -->

- **Previews**: `read_document` with `image` draws a Pages tab as its pages, each as the editor exports it
  (`svg-render-pages.ts` over `page-frame.ts`): its background, gradient, pattern or picture, the elements
  reaching onto it cut at its edges, in rows (two slides or three tall pages to a row) with each page's place and name
  under it; `page` (an id, place or name) draws one page alone at its own size. An article page draws its writing as
  estimated without a browser (`article-layout-estimate.ts`: each block set as the editor's stylesheet sets it,
  wrapped at an estimated width, flowed down the article's pages), with the pages the editor would add after its last
  shown and labelled as such. An emoji icon or sticker, which needs a colour-emoji font a Worker lacks,
  draws from its Twemoji SVG (release 15.1.0 on jsDelivr, CC-BY 4.0, in `THIRD_PARTY_NOTICES.md`), fetched by its
  code points when the preview is made (`preview-emoji.ts`: at most `PREVIEW_EMOJI_MAX` (40) a preview, within
  `PREVIEW_EMOJI_TIMEOUT_MS` (2.5 s), each file at most 64 kB and kept in the Cache API, alongside the fonts). One
  that cannot be fetched in time draws as a disc labelled emoji (`previewResolvers` in `@livedocuments/icons/resolve`).
- Article summaries (`write_article`, `change_pages`, the `pages` view) carry `estimatedPages`, the pages the writing
  reaches once laid out, from the same estimate; `write_article`'s last line says it in words ("It takes about 2 pages
  once laid out"), so an agent asked for one page sees at once that it ran over.

## 5. Visualise — inline image render

`create_document`, `add_tab` and `update_document` return, and `read_document` with `image: true` returns, an **inline
PNG** so the pages show in the chat. This needs headless rendering inside a
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
  (Inter, OFL — `packages/render-png/fonts/`, Regular and Bold, wired as `Data` modules + passed to resvg as
  `fontBuffers`) and renders every label in it; a weight past 500 (a title, a table's header row) draws
  in Bold. Without an embedded font resvg
  draws shapes/arrows/colours but no text, so the calling model gets a text-less
  preview it can't self-check against. A tab's own font choice falls back to
  Inter in the preview; the structured elements still carry the true font.
- **Fonts.** The faces a tab uses beyond Inter (its elements', its own, its articles' heading and
  body faces) are read from the Google Fonts stylesheet the editor loads (`fonts.ts`' `google` specs), whose answer
  to a client that is not a browser names TrueType files, and handed to resvg for that render (`preview-fonts.ts`):
  at most `PREVIEW_FONTS_MAX` (4) families, whatever arrives within `PREVIEW_FONTS_TIMEOUT_MS` (2.5 s), each kept in
  the isolate and the Cache API. A face that cannot be fetched draws in Inter, as before; nothing is sent but the
  family names. The embedded Inter is upright only, so a tab with any text in italic (an element's, a run's, a
  cell's) fetches Inter's italics the same way (`INTER_ITALIC`); resvg drew italic it had no face for upright.
- **No scaled strokes.** resvg ignores `vector-effect="non-scaling-stroke"`, so
  the renderer never relies on it: stretched silhouettes (cylinders, device
  frames) are mapped into the element box point by point
  (`svg-shape-fit.ts`) rather than nested in a scaled `<svg>`. Before that, a
  stretched shape's border in the preview grew with the shape, several pixels
  thick on a large one.
- **Image-element embedding.** When a rendered tab has image elements,
  `imageResult` prefetches their bytes (owner-authed via the caller's token,
  `GET /api/images/:id`) and inlines them as base64 data URIs through the
  renderer's `resolveImageHref` hook — resvg (WASM) can't fetch, so the bytes
  must be inline. A tab with no images does no extra work. The fetch-and-inline core is
  `embedTabImages` in `@livedocuments/api-schema`, shared with the api worker's
  snapshot render ([Document SVG snapshots](../006-document/document-snapshots.md)), which passes its own byte source
  (R2) and a total byte budget.
- **Picture budget.** resvg decodes every picture at full size and holds them all while it draws: about 4 bytes a
  pixel on top of about 28 MB for a 2048 px preview, in wasm memory that never shrinks. Measured: one 2880x1800
  screenshot 49 MB, four 112 MB, and a flat 8000x8000 PNG of 0.19 MB 461 MB, against a Worker's 128 MB in all. Time
  is the smaller cost (0.02 to 0.15 s a megapixel). So one preview draws pictures in document order while they stay
  within 8 million pixels together (`PREVIEW_IMAGE_BUDGET_PIXELS`, one full-screen retina screenshot or several
  ordinary ones) and 6 MB together (`PREVIEW_IMAGE_BUDGET_BYTES`, carried inline as base64), each at most 2 MB
  (`PREVIEW_IMAGE_MAX_BYTES`), all in `apps/mcp/src/preview-budget.ts`. A picture's pixels are read from its header
  (`imagePixelSize`), never decoded; one whose header cannot be read is not drawn. A picture past a limit, or that
  fails to fetch, keeps the placeholder rectangle (the structured elements still carry its id), and a preview that
  left any out for a limit says so in a line before the picture ("2 pictures are drawn as a placeholder in this
  preview, which draws only so many pixels; ..."), so the model does not take one for a failed placement. The data URL takes the image's stored
  type; one stored without an image type (`application/octet-stream`) is
  labelled by sniffing its bytes, and bytes that match no accepted format keep
  the placeholder.
- **Element coverage.** The shared renderer draws tables as their real grid
  (tracks / headers / zebra / per-cell text, `svg-render-table.ts`), freehand
  sketches as the canvas draws them (the same Catmull-Rom smoothing, straight
  segments for a polygon-tool path), the full shape-silhouette vocabulary (hexagon /
  cylinder / document / cloud / devices / actor ... —
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
  `resolveIconExportArt` from `@livedocuments/icons/resolve` (a static import of
  the catalogue data — fine in a Worker), so line-art icons draw stroke-tinted
  and Technology marks draw their brand tile instead of the old
  box-with-caption fallback. Without a resolver (or for an unknown id) the
  renderer still emits that fallback, so resolver-less callers are unchanged.

## 6. Rollout

1. **`apps/mcp` skeleton** — worker, Hono, MCP SDK, service binding to api,
   `/health`, deploy wiring + `mcp.livedocuments.app` host. `.env.example`.
2. **Shared SVG renderer** — extract `packages/document/src/svg-render.ts` from
   `export-tab.ts`, repoint the in-app export to it (no behaviour change), add
   `@resvg/resvg-wasm` rasterisation in the worker.
3. **Tools, read-first** — `find_documents`, `read_document` (+ schema resource).
   These are read-only and prove the schema + render path end to end.
4. **Write tools** — `create_document`, `update_document` (both modes), reusing
   `validate.ts` + `auto-layout.ts`.
5. **OAuth** — `/api/oauth/exchange` on the api worker (reusing the token-mint
   path, signed-in only like `/api/tokens`); `apps/live` consent page; the MCP
   OAuth endpoints + `OAUTH_KV`. Until this lands, the worker can be exercised
   with a hand-pasted `lvd_` Bearer for development.
6. **Docs + help, shipped WITH the feature** (per the help-centre + docs rules in
   `AGENTS.md`):
   - A help article (e.g. `account-and-data/connect-ai-mcp`) — what the MCP is,
     connecting it to Claude/an AI tool, the signed-in-only limitation, that it
     mints a revocable API token — **registered in `apps/help/lib/articles.ts`**.
   - `docs/development/architecture.md` — the new `apps/mcp` worker in the layout + deploy
     order; `docs/operations/self-hosting.md` — MCP needs sign-in (like tokens/teams) and is
     optional to deploy; `README.md` repo-layout tree gets the new app.
   - Cross-link from the API-token help/docs ([Public API and API tokens](public-api-and-tokens.md)).

## 7. Out of scope (for now)

- **Streaming progress** from tools (the SDK supports it; v1 returns once).
- **Folder / team management** via MCP — there are no tools to list, rename, or
  move folders (create_document files new documents at the root of the user's My Work, or their default folder);
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
