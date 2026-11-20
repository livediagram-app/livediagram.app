# MCP server

**Status: live.** Merged and deployed at `mcp.livediagram.app`; connect flow
verified end-to-end from Claude. Builds directly on [Public API and API tokens](public-api-and-tokens.md)
(API tokens), which it picks up where §7 left off: [Public API and API tokens](public-api-and-tokens.md) deferred "OAuth /
third-party app authorization": this spec adds exactly that, scoped to one
client (an MCP server), reusing the `lwt_` token as the credential it ultimately
mints. No new authorization model; an OAuth front door onto the existing token.

## 1. Goal

Let a person connect livediagram to whatever AI tool they already drive (Claude
desktop/web, Claude Code, any MCP client) and, from inside that tool:

1. **Find and view** the documents they already have: search by name, get back a
   link to open in the editor **and an inline image** of the document.
2. **Create** a new document from a request: e.g. point the AI at a codebase and
   have it produce a diagram of the control flow.
3. **Edit** an existing document: full rework of a tab, or a small adjustment.

**The calling LLM does the thinking; the MCP is only the bridge.** This is the
load-bearing decision. livediagram has no model of its own to proxy to (there is no
in-editor AI assistant). The user already has a capable model in front of them; the
MCP's job is to (a) hand that model the diagram **schema** so it can emit
well-formed elements, (b) **validate + lay out** what it produces, and (c)
**persist** it through the same REST API the web app uses. The MCP carries no
model of its own and makes no LLM calls.

**Keep the surface small.** Nine tools and one schema resource (see
[§4](#4-tools)). Each tool is a thin wrapper over an existing `/api` route plus
shared helpers from `packages/document`; the MCP adds no business logic that
isn't reusable.

This must not weaken the friction-free guest model
([Auth + guest access](../014-identity/auth-and-guest-access.md)) or the optional-services rule
([Open source + distribution](../002-project-scope/open-source-and-business-model.md)). Like API tokens and teams,
the MCP is **signed-in only** and **absent end-to-end** on a no-auth deployment.

## 2. Architecture

A **new standalone Cloudflare Worker**, `apps/mcp` (worker name
`livediagram-mcp`), mirroring how Manager Toolkit ships its MCP as its own
worker. Not folded into `apps/api`: it has a distinct dependency surface (the MCP
SDK, OAuth/KV, a WASM rasteriser) and a distinct public origin, and `apps/api`
stays a pure REST/WS surface.

- **Framework / transport.** [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol)
  with **Streamable HTTP** transport (`WebStandardStreamableHTTPServerTransport`,
  `enableJsonResponse: true`), fronted by **Hono** for routing/CORS: the exact
  stack proven in the Manager Toolkit MCP. Tools are defined with `zod` input
  schemas.
- **Talks to `apps/api` over a Cloudflare service binding** (`API`), not public
  DNS. Every tool resolves to one or more `/api/*` calls carrying
  `Authorization: Bearer lwt_…`: the caller's token, passed straight through.
  The api worker already accepts `lwt_` tokens on every route
  ([Public API and API tokens §3.3](public-api-and-tokens.md)), so **no api authorization
  changes are needed** for the tools themselves.
- **Reuses `packages/document`** headless: element factories, `validate.ts`
  (`isValidTab`/`isValidElement`), `auto-layout.ts` (`autoLayoutElements`,
  `isLayoutCandidate`), and a new pure SVG renderer ([§5](#5-visualise--inline-image-render)).
  This is the reuse-over-duplication rule: the MCP must not re-implement layout,
  validation, geometry, or theme-colour resolution.
- **Routing + deploy.** Served at **`mcp.livediagram.app`** (its own hostname,
  like the api). The monorepo's deploy ships it in the tier after the api
  (its service binding needs the api to exist, [Deployment](../016-platform/deployment.md) "Deploy"). The `router` worker is unchanged: `mcp.` is a
  separate host, not a path under the main hostname, so it carries no router
  business logic. `GET /health` returns `{ status: 'ok' }`.
- **Endpoints on the worker:** `POST /mcp` (the MCP transport, Bearer-gated),
  the OAuth endpoints ([§3](#3-authentication-oauth-21)), and `/health`.

## 3. Authentication: OAuth 2.1

The MCP authenticates with **OAuth 2.1 + PKCE (S256) + dynamic client
registration**, so a user gets a one-click "Connect" in their AI tool rather
than pasting a raw token. The flow **mints an `lwt_` token** under the hood and
hands it to the client; from then on every request is just
`Authorization: Bearer lwt_…`. This deliberately reuses the entire token model
from [Public API and API tokens](public-api-and-tokens.md) (storage, hashing, 6-month expiry,
per-account cap, revoke, account-deletion cascade, rate limiting) instead of
inventing a parallel credential. An MCP-minted token is an ordinary liveworkspace
account token: it is listed in Settings › API Tokens (any app's, or liveworkspace.app's) and can be revoked there like any
other, and it works with every liveworkspace app's MCP server.

This implements the OAuth flow Manager Toolkit uses:

1. **Discovery**: the MCP worker serves RFC 8414 metadata at
   `/.well-known/oauth-authorization-server` (and the protected-resource
   metadata): `authorization_endpoint`, `token_endpoint`, `registration_endpoint`,
   `code_challenge_methods_supported: ["S256"]`, `token_endpoint_auth_methods_supported: ["none"]`.
2. **Dynamic client registration**: `POST /oauth/register` issues a `client_id`
   (validates redirect URIs: `https:` anywhere, or `http:` on a loopback host for
   local clients; the scheme is checked on its own, so a loopback host never
   admits another scheme such as `javascript:`, and never with a fragment, per RFC 6749
   §3.1.2; one rule shared with the api's Drive redirect, `oauthRedirectUrl` in
   `@livediagram/api-schema`), stored in KV with a TTL.
   Rate-limited per IP, an IPv6 caller by its /64 (`clientRateKey`, as the api keys its limiters). Authorize re-checks the scheme of the requested
   redirect URI, and the consent page only ever navigates to an http(s) URL.
   The token endpoint requires `client_id` and `redirect_uri` and refuses a code presented with another value of either (RFC 6749 §4.1.3). A name that reads as a liveworkspace app is refused (`400 invalid_client_metadata`), and so is one that reads as Claude, ChatGPT or Cursor unless every redirect URI is a loopback one or on that tool's own domains; at registration and again at authorize (`reservedNameRefusal`, `../packages/mcp-kit/src/oauth-names.ts`).
3. **Authorize**: `GET /oauth/authorize` creates a short-lived session in KV and
   redirects to a **consent page in `apps/editor`** (e.g. `/oauth/authorize` or an
   Explorer "Connect an app" screen), passing the session id. The user is
   already signed in there (a livediagram session through the liveworkspace accounts
   Worker; a signed-out visitor gets a Sign in link that returns here). A person signed in to liveworkspace but
   not yet here is signed in on the way by the page's silent bounce, and a browser whose signed-in hint is set waits
   for its session's answer before offering Sign in ([Auth + guest access](../014-identity/auth-and-guest-access.md#who-is-a-guest-before-sign-in-answers)).
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
   **name** is never a trust signal either way (it is whatever was registered, kept without bidi
   controls or invisible characters at its ends and cut to 120 whole characters, "MCP client" when that leaves
   nothing, so it can neither turn the screen's words around nor look blank):
   the host is the fact to check, which is why it must come from the server. Every client that is not built in (so every registered one) wears an **Unverified App** badge beside its name, with "{name} is not made by liveworkspace, and we can't check who made it.", and the screen puts the redirect host first, "Access will be sent to {host}"; the lookup's `verified` decides it. A
   session that is unknown or expired is a blocking screen, never a screen with
   an approve button and a blank destination. See
   `../packages/workbench/src/lib/mcp-consent-session.ts` and `../packages/workbench/src/components/oauth/OauthConsentPage.tsx` (with its test). The screen is never frameable
   (`X-Frame-Options: DENY`, [Embeds](../013-workspace/embeds.md)), so the
   Connect click can't be clickjacked from an attacker's page.
4. **Consent + mint**: on approve, `apps/editor` calls `POST /api/oauth/exchange`
   on the api worker with the person's account access token. It asks liveworkspace
   to mint an `lwt_` account token named for the connecting client (e.g. "Claude
   (MCP)"), read-only if the person ticked that (`POST /api/account/internal/tokens`,
   [Public API and API tokens](public-api-and-tokens.md) §3). It binds the PKCE
   challenge so only the holder of the verifier can redeem it. A minted token is
   never left orphaned: the page re-checks the session (`GET /oauth/session/<id>`)
   before minting, and when the MCP's `/oauth/complete` refuses the token (the
   session expired or was used, a 429) it revokes it at once by presenting it to
   `DELETE /api/tokens/current`, so retries never pile up six-month tokens against
   the per-account cap. The failure line names the cause: an expired request ("This
   request has expired. Start the connection again from your app."), the token cap
   (409 `token_limit_reached`: "Your account has reached its limit of API tokens.
   Revoke one on liveworkspace.app, under API tokens, then try again."), or anything
   else ("Something went wrong. Please try again."). The device page does the same
   (`../packages/workbench/src/lib/oauth-handover.ts`).
5. **Callback + token exchange**: the MCP redirects back to the client with a
   code; `POST /oauth/token` (with the PKCE `code_verifier`) exchanges it for the
   `access_token` (= the `lwt_` secret). `expires_in` reflects the token's
   remaining 6-month lifetime.

**A token the api stops accepting.** `POST /mcp` lets any Bearer through to the transport (only the api can tell
whether liveworkspace still knows it), so a revoked, expired or unknown token used to come back as HTTP 200 with every
tool call failing "the token is not accepted", and a client never learned to sign in again: reconnecting reused the
same dead token. Now, when any call the request made to the api answered 401, the MCP answers the whole request
`401` with `WWW-Authenticate: Bearer error="invalid_token", resource_metadata="<origin>/.well-known/oauth-protected-resource"`
(RFC 6750 §3.1), the same challenge a request with no Bearer gets, so an MCP client starts the connect flow again
(`../packages/mcp-kit/src/token-refusal.ts`). A request that never reaches the api (`initialize`, `tools/list`) is
answered as before. It costs nothing extra: the api's own answers are watched, no call is added.

**What Claude's connector directory checks** (registration lifetime, Anthropic's egress range, refresh and
unknown grants, refusals in words, no token in a URL) is audited in [§4.16a](#416a-claude-connector-directory).

**State storage.** Add a **KV namespace binding (`OAUTH_KV`) to `apps/mcp`** for
client registrations, authorize sessions, and codes (all short TTLs). `apps/api`
needs no KV: tokens are minted and kept by the liveworkspace accounts Worker.

**Why OAuth and not just token-paste.** A static-token-paste connector works in
Claude Code / custom connectors, but the polished "Connect" button in claude.ai
web connectors expects OAuth, and the user chose the OAuth path. Because it still
resolves to an `lwt_` token, the heavy lifting (verification, gating, revoke,
caps) is already built: OAuth is the front door, not a new lock.

**Sign-in gating.** OAuth depends on the consent page authenticating
the user through sign-in and on `/api/oauth/exchange` requiring an account identity: the
same gate as `/api/tokens` ([Public API and API tokens §3.7](public-api-and-tokens.md)). A
no-auth deployment: the exchange endpoint rejects every caller and the consent
page has no signed-in user, so the MCP can mint nothing. Operators who don't want
the MCP simply don't deploy `apps/mcp`; nothing else references it.

**The CLI signs in here too** ([CLI](cli.md#authentication)). This server is the
one authorisation server for both front doors, so it also offers what a
command-line client needs: a loopback redirect matched on scheme, host and path
with any port (RFC 8252 §7.3), a pre-registered public client `livediagram-cli`
whose name the consent screen can trust, and the device authorisation grant
(RFC 8628) with a `/oauth/device` page in `apps/editor` for machines without a
browser. A token minted for the CLI is named "livediagram CLI".

## 4. Tools

Seventeen tools, fifteen for documents and two for their gallery, besides the deprecated names ([§4.18](#418-deprecated-tool-names)). The search/view capability is two tools (find, then read); create,
add_tab, and update are separate because their inputs and intent differ;
list_templates exposes the template catalogue ([§4.5](#45-list_templates)), search_icons the icon catalogue
([§4.5a](#45a-search_icons)), list_images the user's image gallery ([§4.5b](#45b-list_images)), and
upload_image and delete_image add pictures to it and remove them ([§4.5c](#45c-upload_image),
[§4.5d](#45d-delete_image));
share, rename, and delete complete the CRUD verbs, with list_trash and
restore_document as the way back from a delete
([§4.8](#48-share_document), [§4.9](#49-rename_document-and-delete_document), [§4.9a](#49a-list_trash-and-restore_document)),
and archive_document and unarchive_document put a document away in its owner's Archived and back
([§4.9b](#49b-archive_document-and-unarchive_document)).
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

Search/list the caller's documents: the **personal library AND every joined
team's shared library** ([Team shared documents](../013-workspace/team-shared-documents.md)). A document
filed into a team leaves its owner's personal list entirely, so the personal
`GET /api/documents` alone is not "the user's documents": the tool asks
`GET /api/documents?team=all&q=<query>&limit=<limit>`, which the api answers from one index page over mine and
every joined team, searched and capped there, newest saved first, beside `GET /api/teams` for the teams' names
(the api accepts the token identity on those reads; [Public API and API tokens §3.4](public-api-and-tokens.md)).
Before, it read every library whole (`GET /api/teams/:id/library` for each team, at most 1,000 documents each)
and matched here: the index's search finds what that missed past the 1,000th. The teams' names are best-effort:
a teams failure names a team's document by its team id, never an error. Input: optional `query`, each word found
in the name or the folder's name (ASCII case-insensitive; a document whose name holds the query as typed still
matches, and so now does one holding its words apart or in its folder's name), `limit`. A query with a
non-ASCII character, which the index would fold differently, or one the index refuses (over 200 characters or
16 words), is matched as before: the whole sweep, the name containing the query in any case. Returns a compact list:
`{ id, name, updatedAt, library, url }` where `library` is `personal` or the
team's name and `url` is the `livediagram.app` deep link to open it. **No image
here**: kept lightweight so the model can scan many results cheaply, then
`read_document` the one it wants.

### 4.2 `read_document`

Fetch one document's full content **and render it**: this is the "visualise"
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
document in one call: an overview plus a detail tab per subsystem), the
optional `layout`, and the optional `markUsed` (boolean, default `true`). Each tab may instead pass `template: TemplateKind` in place
of `elements`: the server materialises the hand-tuned scaffold from
`@livediagram/templates` ([§4.5](#45-list_templates)), keeping its curated
layout (`layout` is ignored for a template tab) and applying that template's
canvas overrides; the model then personalises labels via `update_document`'s
`ops` mode. A template tab may also carry `elements`: once the document exists they are added to the template's
tab as `update_document`'s `add` ops would add them, in canvas coordinates, so they land beside the scaffold (an
arrow may pin to one of its elements), never silently dropped. They are checked like any other tab's elements
before anything is written; if the api then refuses them the answer says the document was made and why. A
template tab given a `graph` or `mermaid` is refused, naming the tab, since a template builds its own boxes and
arrows. `add_tab` does the same. A tab's `name` is optional: an unnamed template tab takes the template's title, as the editor names one
(`templateTabName`, [The tab's name](../007-editor/templates-by-mode.md#the-tabs-name)), and any other unnamed tab is
"Tab n". The MCP:

1. **Validates** each tab's `elements` with `isValidTab` (reject `400`-style with
   a clear message naming the offending tab).
2. **Lays out, but the model decides.** A `layout` argument (`'auto'` |
   `'preserve'`, optional) governs it: `'preserve'` keeps the exact coordinates
   the model gave (so it can draw a deliberate shape: a cycle as a ring, a tree,
   a grid), `'auto'` runs `autoLayoutElements`, and **omitted = auto-detect**:
   preserve a real arrangement, but run the layout when the model left nodes
   piled at ~one point (`nodesLookUnplaced`). This realigns with "the calling LLM
   does the thinking": the server stopped overriding the model's spatial intent
   (which flattened a life-cycle ring into a row). When it does lay out it reuses
   the editor's engine; the model is never _forced_ into pixel-perfect placement.
   Layout only ever arranges the **connected graph**: edgeless content (titles,
   per-node descriptions, captions) passes through at its given position rather
   than being raked into a disconnected-component column.
3. **Tags it as made by AI.** The create sends `source: 'mcp'`, which the
   Explorer's **Made by AI** filter (`made-by:ai`,
   [Explorer filters](../013-workspace/explorer-filters.md)) reads, so a user's
   own work and AI-made documents can be told apart wherever either is filed.
   Unfiled, it sits at the root of My Work like any other document,
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
   Most Used and Recent at once ([Explorer Home](../013-workspace/explorer-home.md#opens));
   `markUsed: false` is passed through to the create
   ([API](api.md#marking-a-document-used)) for a model making many documents in one go,
   so a batch never pushes the user's own work out of reach. Absent, nothing is sent and the
   create counts.
   A tab made from a presented template also seeds the new document's deck with its slides, sent as the create's
   `presentation`, in tab order when there are several
   ([Decks a template seeds](../012-collaboration/presentation-mode.md#decks-a-template-seeds)); the result's
   `notes` say how many slides each tab added.
5. **Returns** the new `id`, tab count + ids, the folder ("My Work" for the root,
   or the name of the default folder it was filed in), the deep-link `url`,
   **and the rendered PNG of the first tab** so the user sees the result inline.

### 4.3a `add_tab`

Add a **new tab** (its own canvas) to an existing document, the motivating case:
"make a tab going into more detail on one part of this architecture." Input:
`documentId`, `name`, `elements`, optional `layout`, or `template: TemplateKind`
instead of `elements`, exactly like a `create_document` tab. Validates + lays out
exactly like a `create_document` tab, then submits a [changeset](../024-agents/agent-changesets.md)
that creates the tab, so anyone with the document open sees it arrive. A presented template's slides are then
appended after the document's deck (`PUT /documents/:id` with `appendSlides`, which tells everyone with the document
open, [Slides an agent appends](../012-collaboration/presentation-mode.md#slides-an-agent-appends); against an api
that does not know `appendSlides` yet, read with `GET` and written back whole as before); a note says so, or that
the tab was made without them when the deck could not be written. A C4 `template` (`c4-context`, `c4-container`,
`c4-component`) links its level to the levels already in the document, as the editor's template flow does
([Templates](../008-canvas/canvas-and-palette.md), the C4 levels link to each other): the new links are written as one
`set` changeset per tab they land on, before the tab is read back, and a note says how many were made (or that they
could not be, the tab kept). Returns the new `tabId`, `url`,
and the rendered PNG. (Pair with `read_document`, which lists the document's
existing tabs, to decide where a new one fits.)

### 4.4 `update_document`

Edit an existing tab. **Two modes** (the user asked for both):

- **`replace`**: for building or reworking a whole tab. Input: full new
  `elements: Element[]` (and the same optional `layout` control as
  `create_document`). Validated + laid out exactly like `create_document`, as a
  `replace` changeset. Use when the change is large enough that re-emitting the
  tab is cleaner than patching.
- **`ops`**: for small adjustments. Input: an ordered list of
  `{ op: 'add' | 'update' | 'remove', element? , elementId? }` targeting existing
  elements by id or by the ref `read_document` prints, sent as `set` / `rm` on the always-safe `id:"…"` ref and
  compiled by the api's edit-operation engine. **Auto-layout is NOT run by default** in `ops` mode:
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
what JSON ops cannot say in one step (`insert … between a b` making room, `wrap … in frame`, `connect a -> b`, `layout`
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
and radii, and the diagram-building kinds' looks, media, attach points, boundary styles and pyramid variants: the
same list edit operations check, [Edit operations](../024-agents/edit-operations.md)) is refused naming the values,
and an `iconId` that names no icon is refused with the icons like it and a
pointer to `search_icons`. Each of these was once stored and drawn wrong in silence. The check passes every element
of every template, so a tab read back as JSON writes again unchanged.

### 4.5 `list_templates`

Browse the template library: the same hand-tuned catalogue the editor's
template starts ship ([Canvas and palette](../008-canvas/canvas-and-palette.md)), served from the shared
`@livediagram/templates` package so the worker and the editor can't drift.
No input. Returns the categories plus one row per template:
`{ kind, title, description, category }`: enough for the model to pick a
`kind` and pass it as `template` on `create_document` / `add_tab`. Deliberately
metadata-only (no elements): the scaffold materialises server-side on create,
so the model never has to re-emit (or accidentally mangle) a curated layout.
The recommended flow for "make me a retrospective"-style asks: `list_templates`
→ create with `template` → `update_document` (`ops`) to fill in real content.
Its description also says where a template is not the only start: the C4 levels are templates (`c4-context`,
`c4-container`, `c4-component`) and a graph's `c4` style (§4.7) draws any level of the user's own system without
coordinates.

A `template` that names no kind is refused before anything is written, offering the kinds it most likely meant first:
those whose kind or title has a word starting with a word of it of 3 letters or more (`closestTemplateKinds`, at most
`CLOSEST_TEMPLATES_MAX` (5)), then every kind: `Unknown template "retro". Closest: retrospective, team-retro, four-ls,
sailboat. Valid kinds: ...`. The CLI's and api's template bodies refuse with the same hint.

### 4.5a `search_icons`

Finds icons by what they show, best match first, across the line-art set and the Technology set (brand, cloud and
database marks): `{ query, limit? }` (20 by default, at most 50) answers `{ icons: [{ id, label, set }], more }`. An
id is what an element's `iconId` takes. The catalogue is bundled with the worker (`@liveworkspace/icons`'s
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

Pictures reach the gallery through the editor (upload, paste or drop) and through `upload_image`
([§4.5c](#45c-upload_image)); `delete_image` ([§4.5d](#45d-delete_image)) removes them.

### 4.5c `upload_image`

Adds a picture to the user's image gallery, so an `image` element can show something the assistant made itself (a
render, a chart, a logo from a repository): `{ data?, url?, name? }`, exactly one of `data` and `url`, answers
`{ id, name, width, height, size, uploadedAt, deduped }`, the same image fields `list_images` gives, its `id` what an
element's `imageId` takes. The shared code is `@liveworkspace/agent-verbs`'s `packages/agent-verbs/src/images/upload.ts`; the tool is
`packages/agent-verbs/src/mcp/image-tools.ts`'s, wired by `apps/mcp/src/image-tools.ts`.

- **The bytes.** `data` is base64, or a `data:` URL whose payload is base64 (`data:image/png;base64,...`); line
  breaks are allowed. The request carrying it is at most 15 MiB (`@liveworkspace/mcp-kit`'s `MCP_MAX_REQUEST_BYTES`, room for a 10 MB picture's base64, where the SDK's own default of 4 MiB would stop at about 3 MB), so the text is decoded and the decoded bytes are held to the cap. `url` is a public https URL of the picture itself, which the server fetches
  (below). `name` is the name the gallery lists it by; without one, a URL's last path segment, else none.
- **What it takes.** What the media service stores
  ([liveworkspace media "Uploads"](../../../../liveworkspace/docs/specs/006-media/media.md#uploads)): PNG, JPEG, WebP
  and GIF, at most `MAX_IMAGE_BYTES` (10 MB). The type is read from the bytes (`sniffImageType`), never a header or a
  file name, and the width and height from the format's own header (`imageDimensions`). SVG is refused with words of
  its own ("SVG or other markup, which the gallery never stores"): it can carry a script, so the service never stores
  it on any path and an assistant renders it to a PNG first. A file whose header gives no size is refused as damaged.
- **The upload.** `POST /api/images` as the caller, with their own bearer token, the route the editor's upload uses:
  the service checks the type against the bytes again, dedupes the same bytes to the image the gallery already holds
  (`deduped: true`), strips a JPEG's metadata and holds the per-person caps. The upload names its tool
  (`X-Image-Source: mcp`), so the Image Gallery shows the picture **Made by AI**, as it shows a document an AI tool
  made ([liveworkspace media "Uploaded by a tool"](../../../../liveworkspace/docs/specs/006-media/media.md#uploads)).
- **Refusals, in words.** Too large ("That picture is 12.4 MB; the gallery takes files up to 10 MB."), not a picture
  it takes, not valid base64, a URL it will not fetch (each reason below), and a full gallery, with how full it is:
  "The image gallery is full: it holds 100 of its 100 images. Remove pictures it no longer needs with delete_image
  (list_images lists them), then upload again." (or, by bytes, "it holds 99.2 MB of its 100.0 MB").
- **Fetching a URL.** `@liveworkspace/api-kit`'s `fetchPublicBytes` (`public-fetch.ts`), the server-side fetch of a
  URL someone else chose: https on port 443 only, with no user name or password; a literal address is judged as it
  stands and a name is resolved (DNS over HTTPS, A and AAAA) and refused when any answer is private, loopback,
  link-local, carrier NAT, multicast, reserved or a cloud metadata address (`public-address.ts`, the index's webhook
  checks), or an internal name (`localhost`, `.local`, `.internal`, a single label). Redirects are followed by hand,
  at most 3, each target checked the same way; the whole exchange, body included, has 10 seconds; the body is read
  through a byte counter that stops one chunk past 10 MB, so a huge or endless answer is cut off there. The answer's
  `Content-Type` is never read: the bytes are sniffed as any upload's are.
- Behaviour **write**, with `openWorldHint: true`: a URL reaches the open web. A read-only token is refused, as for
  any write.

### 4.5d `delete_image`

Removes pictures from the user's own image gallery: `{ imageIds, force? }`, 1 to 20 ids from `list_images`, answers
`{ results: [{ id, outcome, name?, usedIn? }], deleted, kept }`, one result per id asked for, in order. The shared
code is `@liveworkspace/agent-verbs`'s `packages/agent-verbs/src/images/remove.ts`.

- **Only the caller's own.** The gallery (`GET /api/images`, owner only) is read once for the call; an id not in it
  (another person's picture, one already gone, or no image at all) answers `not_found` and is never sent to the
  delete.
- **Never a placed picture by default.** The Image Gallery's own usage (`GET /api/images/usage`, the caller's items in
  every app that place each picture, not in the Trash) is read once, beside the gallery. A picture something places
  is kept and answered `in_use` with `usedIn: [{ id, name, app }]`. `force: true` removes it anyway; every element
  that placed it then shows a broken picture until someone picks another, and the result still names where it was
  used.
- **The delete.** `DELETE /api/images/:id` as the caller, the route the Gallery's own delete uses; the service
  removes the row, then the bytes. A picture gone between the read and the delete answers `not_found`. There is no
  Trash for pictures.
- Behaviour **destructive**, with `idempotentHint: true`: the same call again removes nothing more (each id answers
  `not_found`).

### 4.6 Schema resource (not a tool)

A static, cacheable MCP **resource** (e.g. `livediagram://schema/elements`)
returning a compact description of the element schema: the element types
(`shape` / `text` / `sticky` / `arrow` / `table` / …), the shape vocabulary,
required fields, the pinned-arrow anchor convention (`from.e → to.w` etc.), and
the design rules that make diagrams read well (don't set colours: the theme
owns them, a sticky's own colours excepted; size siblings consistently; prefer
pinned arrows), and the content fields of the kinds that carry content (§4.7a). This is **how the
model produces high-quality diagrams**: the schema is presented once, declaratively,
rather than baked verbatim into every tool description. The same essentials are
also summarised in the MCP server `instructions` and in the `create`/`update`
input-schema field descriptions, so a client that ignores resources still gets
enough. The schema text derives from `packages/document` types: single source of
truth, no hand-maintained copy that can drift.

### 4.7 Graph-first authoring (the low-burden path)

Emitting raw `elements` with `x/y/width/height`, a shape vocabulary, and
arrow-endpoint anchor objects is the biggest source of model error (it's why
`coerceShapeKind`, the validation error paths, and auto-layout-on-replace all
exist). So `create_document`, `add_tab`, and `update_document` (replace mode)
accept an alternative **`graph`** input, the connection graph and nothing else,
or the same thing written as **`mermaid`**:

```
graph: {
  title?: string, subtitle?: string, key?: boolean,
  nodes:  [{ id, label?, shape?, note?, group?, icon?, tone?, c4Kind?, tech?, description? }],
  edges:  [{ from, to, label?, line? }],
  groups?: [{ id, label?, members?: [nodeId, ...] }],
  direction?: 'down' | 'right',
  style?:  'flow' | 'tree' | 'mindmap' | 'lanes' | 'cycle' | 'storm' | 'sequence' | 'c4',
  lines?:  'straight' | 'angled' | 'curved',
}
mermaid: "flowchart LR\n  A[Idea] --> B{Worth it?} ..."
```

The server turns each node into a `shape` box and each edge into a pinned
arrow, then **always lays it out** (a graph carries no positions). The model
expresses only intent: which nodes exist, what points at what, how they group,
and never touches geometry, anchors, or endpoint shapes. Off-vocabulary shape
kinds are coerced; an edge to an unknown node id is dropped rather than
producing a broken arrow. This is the **preferred path for any node/edge
diagram** (flowcharts, org charts, architecture, dependency graphs); `elements`
stays for deliberate arrangements (a ring, a grid) and mixed non-node content.
Provide **one** of `graph` / `mermaid` / `elements` / `template`, not several.
A graph holds at most 500 nodes and 1 000 edges (`GRAPH_LAYOUT_MAX_NODES` / `_EDGES`,
[Mermaid](../020-import-export/mermaid.md#limits)): the schema refuses a larger `graph`, and a larger
`mermaid` answers the parser's "too large to lay out" error, so the worker never spends its CPU on
a layout no one could read.

**A label is a heading; detail goes in the note.** A node's `label` is the text
in the box and is capped at **40 characters** (`GRAPH_LABEL_MAX`). The cap is a
plain fact in the tool's description, not an instruction (§4.15), and the server
enforces it rather than rejecting the call. A label that fits keeps the line breaks written into it
("App tasks\nECS Fargate" is two lines, measured line by line), other runs of space made one. A longer label becomes a heading:
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

**The graph look** (what makes graph input read like a template, the flowchart template being the yardstick):

- **Boxes are template-sized.** A box is at least 180×64 (a diamond 180×104, wider than tall; a circle stays round),
  wider for a longer label, never the 120×120 square the editor's palette starts a square at. The labelled boxes of
  one kind share one size, the largest any of them needs, so a wrapped step does not stand taller than its
  neighbours. Every node's text is
  one size: `md` for a graph of up to 12 nodes (the template's size), `sm` beyond, so a large system still fits.
- **Roles by notation.** In a flowchart (a graph with a diamond or a stadium) the first stadium a flow starts from is
  `bold` and a stadium it ends on `soft`; a diamond is `soft`. A node's `tone` overrides: `strong` (bold), `soft`,
  `muted` (outlined and dashed, the exception idiom) or `plain`. `icon` puts an icon (an id from `search_icons`) on
  the box; an id that names none is refused.
- **Starts are exact.** A `flow` line whose start is the one line fanning at its anchor starts exactly on it
  (`exactStart`, as a flowchart's connectors do in the editor), and a `mindmap` connector always does; a start that
  shares its anchor with another fanning line keeps fanning. Nothing moves on the page; the switch is what an
  editor sees, and what the next arrow drawn there follows.
- **Flow lines are elbows.** `lines` defaults to `angled` for flow, lanes and tree; every edge to a later rank bends
  twice along the flow. Unlabelled arrows out of one node share one trunk and arrows into one node one bus, as long as
  they are drawn alike (an unset line is solid): where solid and dashed lines meet at one end of a node, the lines of
  the style most of the ones that could merge have share it (a labelled arrow saying something of its own does not
  count) and the rest keep their own ends, leaving from that side's quarter toward their other end, beside the
  trunk rather than on it, so a dashed event line never rides a solid call's trunk, nor its run across the gap
  between ranks (each line's runs take their own channel there); a labelled
  arrow keeps its own ends, unless arrows into one node (or out of one) say the same thing in the same line: those
  join one bus too (several services that each "publish" to one event bus), and so does the one labelled arrow
  among unlabelled ones into one node in its line (an agent that names the bus once, on one of its arrows), the bus
  saying it once, on the stretch
  into that node they all share (four "publish" plates, one a leg, read as four different things; a trunk out of one
  node keeps one on each leg, where each says where it goes), never a
  decision's exits, whose label names that decision's branch (two decisions' "no" on one bus could not say which was
  which), and its label
  sits on a run no other labelled arrow shares (the drop into its target,
  else the leg out of its source, else its longest run), one line wide. Runs are read as drawn, those on one line
  as one, and a run takes the label only when its plate there touches no box: long enough along it, clear beside it,
  and off every frame's and lane's border and heading, and, where any run allows, off every other line too (a
  neighbour's drop struck a label through); where the middle of a run is not clear, a point a quarter or a
  third of the way along it is tried before the next run. Where no run holds the label on its line, it sits beside
  one, just off the line on either side, where it touches no box, border, heading or line (a wide label on a drop
  beside a neighbour's drop), before it is ever laid over another line. Each label keeps off the labels placed
  before it (two "publish" labels off one bus stood over each other).
  The gap between two ranks fits the widest label crossing it, as Tidy Up's does (its width left to right, its line
  height either side of the jog top to bottom), so a caption is never longer than its edge; between a group and a
  node outside it too.
- **Side steps sit level with their decision.** A decision (diamond) with two or more exits keeps its main exit on
  the spine (the one labelled yes / ok / true / pass, else the one leading furthest) and lays each other exit whose
  target nothing else enters on the decision's own rank, beside it, as the template's "No → Show card error" does.
  An exit back to a step the flow reaches before the decision (a retry to the start, entered by nothing else) is a
  loop, never a side step: laid level, it was drawn straight over the line into the decision.
- **Loops go round the outside.** An edge back to an earlier rank (a retry, a loop) leaves its source by the side
  away from the spine, runs outside every box between, and enters its target from that side: an elbow that never
  crosses the spine. Several loops take separate tracks. On a drawing of up to 120 boxes a loop or a detour is first
  searched for (the orthogonal router: the cheapest clean path over every pair of sides); the search shares one
  budget per layout (`ROUTER_BUDGET`, grid crossings laid out plus steps taken), and once it is spent the rest take
  their outside tracks, so a dense graph lays out in well under a second (60 boxes and 140 edges in about 0.2 s).
  The search prices a run along a line already drawn (`ROUTER_SHARE_COST`), counting one within `ROUTER_SHARE_NEAR`
  (8 px) beside it, or on its line stopping that short of its end, as sharing it: a "No" running up to the very point
  a "Yes" turns into a step read as going into that step. It also prices each line already ending on a side the
  route leaves or enters (`ROUTER_SIDE_LOAD_COST`, about two bends' worth), so a third line into one side of a shared
  end takes a free side instead of squeezing in beside the other two.
- **Groups keep their lines clear.** A node outside a group that a member links to sits by that member, not by the
  middle of the group (a database under the service that owns it), its rank kept in order and its gaps kept. An edge
  to or from the group itself leaves the frame facing the other end: from the side level with it when it lies under
  the frame, else from the frame's near side, so it never sweeps along the frame past its members' own drops (the
  D2 "publish events" bus). An edge between two nodes outside a group is routed round the frame, never through the
  gaps between its members. A line into a group's first members lands clear of its heading: down the page, a frame
  whose first member would take a line through the heading's text is widened on the left until it does not, on the
  heading's side only: the far side hugs the members (a long heading framed two boxes in twice their room), unless
  an edge meets the group itself, whose frame then stays centred on its members so that edge stays on their line.
  A row of members with no lines among them sits by its links to the group most of the row links to (each store
  under its own service, a service's link to a third party pulling it off none), never by a hub's. A hub (a member
  linked to more outside nodes than half its row, at least three, in a row holding at least three one-link members:
  a Kafka bus every service publishes to) goes to the end of its row rather than mid-row between a service and its
  store. Two members wanting one spot split the difference, unless that spreads along a tight row: then the first
  takes the spot and the next packs beside it, so the rest stay straight.
  A label's plate keeps 6 px off every frame's and lane's border, inside or out, never sitting on the edge. The
  reverse holds too: a group in one row whose members have no lines among them (a row of data stores) seats each
  member by the outside nodes it links to, a database under its service, its order and gaps kept, and its frame
  refits round them; skipped when the refitted frame would cover another node or frame. A member left within a
  notch (6 px) of its spot sits on it, its gap shrinking by no more than that, so its line drops straight rather
  than as a slant.
- **Stacked groups line up.** Groups that follow one another down the flow, no two side by side (a pipeline's
  stages), keep the spine straight: a group with one entry (the one member a line from outside reaches) moves,
  frame and members together, until that entry sits on the line of what feeds it, so the spine runs straight
  through every stage rather than jogging where a stage's own branch pulled its members aside. Each frame keeps
  its own width, hugging what it holds: stretched to one width, frames of two boxes stood mostly empty. Skipped
  for a group whose moved frame would cover another node or frame.
- **Lanes stay compact and their decisions branch.** In a `lanes` graph a hand-off to the next lane up or down that is
  its step's only way out and its next step's only way in drops straight into that lane, in the same column, rather
  than taking a column of its own, so a chain of hand-offs climbs or descends a staircase instead of stretching across
  the page; never two drops in a row, so the staircase steps right as it goes and the flow still reads left to right
  (four drops in a row stood the first four steps in one column). Next steps one step of the same lane feeds, stacked in one column, spread until each clears that step's
  points, so its exits can branch. A step with two or more exits (a decision, or any step that branches) keeps the one whose next step sits
  most nearly level with it on its point toward the flow; each other exit leaves from its top or bottom, toward its
  next step's lane, and bends once into that step's side, so no two exits leave as parallel stubs. A flow down the
  page does the same across: of a step's exits leaving its bottom on their own ends (labelled, or drawn unlike the
  trunk), one whose next step lies clearly to its left or right leaves that side instead. A step with exactly two
  exits whose next steps lie clearly either side of it, neither ahead, sends both out of their sides (accept up,
  decline down; yes left, no right): kept on the point, one left by a corner and the other by the tip, lopsided.
  Steps stacked in one column of a lane read top to bottom as their feeders do (a step fed from its own lane and from
  below sits over one fed only from below), so the lines into the stack do not cross on their way in. A stack one of
  whose steps a step of the same lane feeds from an earlier column, with nothing of that lane on the line between
  them, moves so the two sit level and the hand-off runs straight along the lane (a first decision's "No" straight
  into a shared rejection); that line keeps the middle of its next step's side and another line into the same side
  comes in beside it on a quarter. A decision's own branches stacked beside it are not lined up: they stay spread so
  each leaves by its own side. The lane grows to hold a stack that moved. A labelled line running level across one
  gap between columns (a decision's "Accept" on its point) widens that gap to hold its label, and every later column
  moves along with it, so the label is never cut short ("Accep").
- **Title, subtitle and key.** `title` and `subtitle` set a heading and a muted caption above the diagram, left
  aligned, as every template has. The drawing they clear is its boxes and every line as drawn: a cycle's arcs round
  the outside of its top stop rose past the boxes and ran through the heading, so the heading sits above the
  highest line and the key right of the furthest. `key` adds a key beside it, a frame titled "Key" so it moves, in the editor or by
  an edit, as one: one miniature per shape kind the graph uses, with
  what that shape means, in the tone the diagram gives that kind most, its muted exceptions aside unless every one is muted;
  those exceptions then get a row of their own, "Exception or optional" (`{"muted": "Error path"}` renames it), so a
  dashed step never goes unexplained. `true` names them by default: in a flowchart by ISO 5807
  (stadium "Start or end", square "Step", diamond "Decision", parallelogram "Input or output", document "Document",
  hexagon "Preparation"), otherwise as a diagram of systems reads them (stadium "Entry point", square "Component",
  hexagon "Hub or bus", circle "Node"; cylinder "Data store", cloud "External system", actor "Person" in both). An
  object names them by shape (`{"hexagon": "Event bus"}`), the rest by default.

**Layout choices** (defaults in brackets):

- `direction` (auto): `down` (ranks top to bottom) or `right` (left to right), for `flow` and `tree` alike. Auto is
  `down` for a flowchart (it reads down the page, as the template does) and for a graph of more than 150 nodes; any
  other flow is laid out both ways and keeps the one whose aspect is nearer a landscape page (3:2). A tree's auto is
  `down`, the org chart; `right` puts its roots at the left and each generation in a column to the right of the one
  before, every parent centred beside its own children, its angled lines bending across rather than down, and no
  leaves stacked (across the page a family is already a column). The other styles have a shape of their own (a
  ring, lanes left to right, a radial map, a board, lifelines) and take no direction.
- `style` (`flow`): `flow` is the layered layout, `tree` the tidy tree (an org
  chart, a hierarchy; a parent below the root whose two or more children are all leaves stacks them in a column
  under it, indented, joined by a bus down its lower-left quarter, the compact org chart; its lines carry no
  arrowheads, as the org-chart template's do, since a tree shows belonging, unless an edge asks with `ends`; a node
  with a `role` draws as the template's person card, its name in bold over the role with a person icon unless it
  names another, in any style), `mindmap` a real mind map as the mind-map template draws one (mind nodes, so it grows with Tab
  and Enter, laid out balanced: the root is the first node nothing enters, a bold round centre; a part no edge joins to the root hangs off it as a
  branch of its own, its edges still the tree's; each first-level
  branch tinted in its own hue with its icon; leaves white and edged in their branch's hue, one height for every leaf of the map (the tallest any label needs); a root
  whose label would grow the circle past 260 px takes the next text size down, so the centre stays near the template's; curved connectors in
  the branch hue with no arrowheads; an edge the tree leaves out drawn dashed), `lanes` a swimlane diagram (each group
  a lane, one under another, its label in the lane's header strip (a heading, a size up from the steps, the strip as
  wide as the longest title needs up to the swimlane template's, the columns 48 px apart); the flow runs left to right across the lanes and
  a node outside every group gets an unnamed lane), `sequence` a sequence diagram (the nodes the participants, a
  node shaped `actor` a stick figure; the edges the messages in order, a dashed edge a reply; Mermaid says more; a message's label and a participant's name stay whole, never cut to the 40-character heading cap, since a message is a sentence and a lifeline's head is not a box), `storm` an event-storming board ([Event storming](../021-event-storming/event-storming.md#agents)), `cycle` a ring (the nodes in order clockwise from the top, each
  edge a curved arrow following the ring's arc, leaving and entering its stops along the ring's tangent so every arc bows
  out alike; an edge between stops that are not ring neighbours, as a star's spokes are, goes round the outside of the
  stops between them the shorter way, each hop further a lane further out, never along the ring behind them; a node with no edge at all at the ring's centre, sized on its own so a longer centre label never grows
  the stops, the ring widened until no stop comes within half a gap of the centre's stack, a node given no shape a circle).
- `c4`: a level of the **C4 model** (Simon Brown's System Context, Container and Component diagrams), drawn as the
  C4 templates draw them ([Templates](../008-canvas/canvas-and-palette.md), the C4 levels), with no coordinates. It is
  the flow layout (layered, `down` unless `direction` says `right`, angled lines) with every node a **C4 element** by
  its `c4Kind`: `person` (a deep-blue card with the person glyph), `system` (the software system in focus, mid blue),
  `container` (the container blue), `component` (light blue, dark ink), `database` (a cylinder in the container blue)
  or `external` (an external system, grey). Unset, a node shaped `actor` is a person, one shaped `cylinder` a
  database, a node in a group a container and any other a software system. A card's name is the `label` (the 40
  character heading), its meta line the `tech` (the technology: "Go", "PostgreSQL") or else its kind's name
  ("Person", "Software system", "Container", "Component", "External system"), and its body the `description` (what
  it does, up to 120 characters; a longer one is cut at a word with its whole text kept in the note); a database
  draws its name over its technology. Cards are 280 wide, wider for a long name (up to 420, so a name is never cut), as tall as their description needs (up to four lines),
  every card keeping its C4 fill and its ink under any theme (`themeLockFill`, `themeLockText`). Each **group** is a **boundary** in the C4 style:
  its label bold in the bottom-left corner, its meta line in brackets under it, "Container" when it holds a
  component and "Software system" otherwise; its members sit at its top, the heading's band at its foot. A **key**
  (a frame titled "Key", right of the drawing) names each kind the drawing uses with a swatch of its fill; `key:
false` leaves it out, an object renames a kind (`{"external": "Third party"}`). Edge labels say what flows and
  how ("Places orders · HTTPS"). Tones and roles do not apply. `c4Kind`, `tech` and `description` are read only by
  this style; a node naming a `c4Kind` the style does not know is refused (`graphBodyIssue`, the schema).
- **Self-edges**: an edge from a node to itself never loses the node. The flow style (and lanes and tree) draws it as
  a loop round the node; the mindmap and cycle styles have no place for one (a branch cannot enter its own node, and
  a ring's arcs run between stops), so there the node shows and the self-edge is dropped, as if never given: a cycle
  node whose only edge is a self-edge sits at the centre with the other nodes no edge joins.
- `groups`: named clusters drawn as frames around their members and laid out as
  one block each (the clustered layout the editor's Mermaid import uses); an edge
  may point at a group id. With groups, `style` is flow. A node may name its
  group itself (`group`), the shape a model reaches for first; it joins that
  group's members, and a group id nothing declares is created with the id as its
  label. `members` is then optional. Nodes and groups share one set of ids: an id naming both is refused, naming
  it, since each becomes an element of that id, and so is a node id or a group id given twice. Groups do not nest: a group listed as another's member is refused,
  naming both, rather than dropped; and a `lanes` graph refuses a node in no group, which would otherwise land in an
  unlabelled lane of its own, and a node in two lanes, which each lane would draw (`graphShapeError`). The api's `replace` with a `graph` refuses the same, so every
  caller of graph input is held to it (`graphBodyIssue`).
- `lines` (`angled` for flow, lanes and tree, `curved` for mindmap and cycle): the
  arrows' routing, from the editor's own arrow styles. Angled lines **bend
  twice** along the flow (down, across at half height, down into the child's
  top), the org-chart shape; one whose ends already line up runs straight
  ([Layout cleanup](../008-canvas/layout-cleanup.md) "Angled lines bend twice"). **No notch in a straight line:** an
  elbow whose ends sit within `NOTCH_MAX` (6 px) of one line, across a middle run shorter than `KINK_RUN` (12 px),
  is drawn straight, as a step that short reads as a notch (two boxes of different widths centred a pixel or two
  apart). Where one end's box meets no other line, that box moves across by the step so the line runs true, unless that would
  take it onto a neighbour or over the border of a frame or lane that holds it; only
  when both ends meet other lines is it drawn as a slight slant (a store's 5 px slant over 250 was seen). An elbow
  whose straight line would cross a box it was routed round keeps its bends, and lines are straightened before their
  labels are placed, so a label sits on the line as it is drawn.

The flow layout reduces crossings: after ranking, a few up-and-down barycentre
passes reorder each rank, and a new order is kept only when it crosses fewer
edges ([Layout cleanup](../008-canvas/layout-cleanup.md)), so graph input, whose
nodes all start at one point, does not lay out in arbitrary input order. It
also gives long edges a lane, places each node by its neighbours instead of
centring its rank, and has every edge to a later rank leave and land on the
faces that point along the flow (the same page). An arrow that still crosses an
unrelated box passes behind it with a gap, on the canvas and in the preview
([Arrows pass behind intervening boxes](../008-canvas/arrow-route-behind.md)).

**`mermaid`** is parsed by the editor's own importer (`parseMermaid`:
flowcharts with subgraphs, state diagrams and ER diagrams, [Mermaid](../020-import-export/mermaid.md)), or for a
`sequenceDiagram` by the agents' sequence reader ([Sequence diagrams](../020-import-export/mermaid.md#sequence-diagrams-agents),
drawn with lifelines, activation bars, notes and fragments as `style: "sequence"`), into the same
graph, its direction and subgraphs becoming `direction` and `groups`, and then
takes the same path, label cap included. Mermaid's front matter title (`---` / `title: Checkout` / `---`) heads the
diagram as `title` does on a graph, in every dialect. A dialect it cannot read comes back as
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
text size (`md` up to 12 nodes, else `sm`; what the sizing measures against), not the shape default that
scales text to fill each box.

#### What a graph leaves out

A graph is drawn as well as it can be, and what the drawing could not keep is said in the answer's `notes`, never
dropped without a word and never a reason to refuse the whole diagram:

- **An edge naming no node or group** is left out, and the note names it (`a → ghost`), up to five and a count of
  the rest.
- **A node label over the cap** becomes its heading, with the full text in the node's note; **an edge label over
  the cap** is cut. The note says which and what each now reads. A sequence message and an event-storming note stay
  whole.
- **An icon that names none** is left off its node, and the note names the node, what was asked and the icons like
  it, with the edit that sets one (`set <node> iconId=<id>`). An icon is decoration: a guessed id ("envelope" for
  `mail`) used to refuse the whole diagram, a second call of the same graph for one glyph. `iconId` on a raw
  element is still refused, where the caller wrote the element by hand.

The same holds for a graph given as Mermaid (`graphInputNotes`, `../packages/document/src/graph-input.ts`;
`graphInputOf`, `apps/mcp/src/graph-input-of.ts`).

#### A Mermaid type that is not read

The refusal of a Mermaid type this server does not read names the form to give instead, by the type's opening
word: a `pie` is a `pie-chart` element, a `mindmap` a graph with style `mindmap`, a `gantt` the `gantt` template,
a `classDiagram` `entity` elements, a `timeline` or `journey` a `timeline-rail`, a chart a chart element, a
`sankey` a `sankey` element, a `C4Context` a graph with style `c4` (`mermaidInstead`). A type with no closer form
is refused as before.

### 4.7a Content-carrying element kinds

These kinds hold content of their own, and the element format documents their
fields so a model can fill them rather than guess: **sticky**, **table**,
**code block**, **entity**, **lane**, the three **charts** (bar, line, pie), the
**Sankey**, and the diagram-building kinds: **card**, **badge**, **step**,
**boundary**, the concept graphics (**layer stack**, **pyramid**, **cycle**, **hub**, **onion**, **chevrons**, **timeline**),
**pointer note**, **diagram key**, **stack**, the org chart's **person node**, the **sequence diagram** and the
**image**.
Every other kind stays listed by name only. The field notes are facts about what
each field does (§4.15), carried on the tools' element argument and in the
schema resource (§4.6), short enough not to bloat every tool definition.

| Kind                                        | Content fields                                                                                                                              | Facts the notes state                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sticky` (type)                             | `label`; optional `fillColor` + `textColor`                                                                                                 | The theme never recolours a sticky, so its own colours are kept; the notes list the palette's sticky pairs (classic, lemon, peach, rose, lilac, sky, mint, teal, slate, paper, charcoal, ink). Unset, it is the classic amber note.                                                                                                                                                                                   |
| `image` (type)                              | `imageId`, `alt`, `objectFit`                                                                                                               | `imageId` is an id from `list_images`; one not in the caller's gallery is refused, naming `list_images`. Without `imageId` the element is a placeholder the user fills in the editor. `objectFit` `contain` (the default) shows the whole picture, `cover` fills the box and crops; `alt` describes the picture. A box of the picture's own proportions (`width` and `height` from `list_images`) shows it uncropped. |
| `table` (type)                              | `cells` (rows of strings), `headerRow`, `headerColumn`, `zebra`                                                                             | The first row is the header when `headerRow` is set.                                                                                                                                                                                                                                                                                                                                                                  |
| `code-block` (shape)                        | `code` (up to 4000 chars), `codeLanguage`, `codeTheme`, `codeWrap`                                                                          | The languages and themes are listed; the block draws itself, so `label` is not shown.                                                                                                                                                                                                                                                                                                                                 |
| `entity` (shape)                            | `label` (the title), `entityFields` `[{ name, type?, key? }]` (up to 40)                                                                    | `key` is `pk`, `fk`, `pk-fk` or `uk` ([The entity](../009-elements/entity.md) "Keys"); a legacy `uuid PK` type still reads as a key. A pinned arrow end may carry `field` (a field index, anchor `w` or `e`) to join that field.                                                                                                                                                                                      |
| `lane` (shape)                              | `label` (the title), `headerFill`                                                                                                           | Contents sit inside the lane's box; lanes are placed one under another.                                                                                                                                                                                                                                                                                                                                               |
| `bar-chart` / `pie-chart` (shape)           | `pieSlices` `[{ label, value }]`                                                                                                            | A chart draws no title: a caption is a separate `text` element. Categories show in the legend.                                                                                                                                                                                                                                                                                                                        |
| `line-chart` (shape)                        | `lineCategories` (x labels), `lineSeries` `[{ name, values }]`                                                                              | The same, with one value per category.                                                                                                                                                                                                                                                                                                                                                                                |
| `sankey` (shape)                            | `sankeyFlows` `[{ from, to, value }]` (up to 200), options                                                                                  | Nodes are the names; `source` / `target` and text amounts (`"1,200"`) are read too. A flow back to an earlier node is hidden. Options: `sankeyLinkColor`, `sankeyAlign`, `sankeyValueLabel`, `sankeyUnit`, `sankeyNodes`, `sankeyLeftover` (`show` by default: an unbalanced middle node draws its difference to a Leftover node), `sankeyLeftoverName`. No title.                                                    |
| `card` (shape)                              | `pageTitle`, `pageSubtitle` (meta), `label` (body), `cardMedia`, `iconId`, `cardHeader`, `tags` (up to 6)                                   | Use cards for service and component nodes: title the thing, meta the product or runtime, tags the facts. `callout` is accepted and becomes a card with `cardMedia: 'badge'`.                                                                                                                                                                                                                                          |
| `badge` (shape)                             | `label` (up to 24), `chipLook`, `attachedTo`, `attachAt`                                                                                    | A badge attached to a node sits on one of its eight points and is placed there by the server; no x / y needed.                                                                                                                                                                                                                                                                                                        |
| `step` (shape)                              | `label` (the number, up to 3), `chipLook`, `attachedTo`, `attachAt`                                                                         | Number the steps of a walkthrough 1, 2, 3; place them on or beside the arrows they mark.                                                                                                                                                                                                                                                                                                                              |
| `boundary` (shape)                          | `label` (the title), `pageSubtitle`, `iconId`, `boundaryStyle`                                                                              | A container: elements whose centre is inside it belong to it. Nest boundaries for edge, region, VPC, subnet; Inset suits a nested one, C4 a C4 diagram.                                                                                                                                                                                                                                                               |
| `layer-stack` / `pyramid` / `cycle` (shape) | `conceptRows` `[{ label, note? }]`, `pyramidVariant`, `label` (a cycle's centre)                                                            | Rows: stack 2 to 8 (note = side note), pyramid 2 to 6 (first row the apex; note = a funnel's value), cycle 3 to 8 (clockwise from the top).                                                                                                                                                                                                                                                                           |
| `hub` / `onion` / `chevrons` (shape)        | `conceptRows` `[{ label }]`, `hubSpokes`, `label` (a hub's centre)                                                                          | Hub 3 to 8 satellites, onion 2 to 6 rings from the core out, chevrons 2 to 8 stages left to right.                                                                                                                                                                                                                                                                                                                    |
| `timeline-rail` (shape)                     | `conceptRows` `[{ label, note }]`                                                                                                           | A Timeline: 2 to 8 milestones left to right, `label` what happens, `note` when (a date, a quarter).                                                                                                                                                                                                                                                                                                                   |
| `pointer-note` (shape)                      | `label`, `pointerTip` `{ x, y }`, `attachedTo`, `attachAt`                                                                                  | The tip is relative to the note's top-left, or pinned to a point of a node.                                                                                                                                                                                                                                                                                                                                           |
| `diagram-key` (shape)                       | `label` (the title), `keyMeanings`                                                                                                          | Its rows fill in from the tab's line styles and tag colours; meanings are keyed by row id (`line:dashed`).                                                                                                                                                                                                                                                                                                            |
| `stack` (shape)                             | `stackDirection`, `stackColumns`, `stackGap`, `stackPadding`, `stackAlign`                                                                  | Children are the elements whose centre is inside; the editor lays them out.                                                                                                                                                                                                                                                                                                                                           |
| `mind-node` with `mindLook: person`         | `label` (the name), `pageSubtitle` (the role), `mindParentId`                                                                               | An org chart: the root takes `mindFlow: downward`.                                                                                                                                                                                                                                                                                                                                                                    |
| `sequence` (shape)                          | `sequenceParticipants` `[{ id, label, actor? }]` (2 to 12), `sequenceMessages` `[{ from, to, label, kind }]` (up to 60), `sequenceNumbered` | It lays itself out; prefer it over loose shapes for a sequence diagram that will be edited.                                                                                                                                                                                                                                                                                                                           |

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
  not only the six. As graph input sizes its text by count, so do raw boxes: on a list of more than 12 labelled
  boxes, a box that gives no `textSize` takes `sm` rather than `md`, so a hand-placed architecture of twenty boxes
  does not wrap its names mid-word ("ElastiCa / che"). A raw arrow pinned at both ends that gives no `arrowStyle` is
  angled, as graph input draws its lines, and an angled one that gives no bends takes graph input's two (out of its
  start, across, into its end), so it meets both ends square rather than as the editor's lone L, sideways into a top;
  one whose ends line up runs straight. `"arrowStyle": "straight"` keeps a diagonal. Both defaults are for content
  arriving fresh: a `replace` that sends back elements the tab already holds (by id) leaves their text size and lines
  as they are, so reading a tab and writing it back never restyles what the person made.
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

**Style fields.** The element format names the style fields a box or arrow takes beyond its geometry, as facts:
every closed vocabulary from `ELEMENT_FIELD_VALUES` (text size and alignment, icon position, arrow style, ends and
heads, border style and radius, font) with its values, bold and italic, `colorPreset` with the theme's preset looks,
`iconId` (from `search_icons`), `note` and a shape's `statusUrl` (a public https status URL whose badge shows while the
canvas is open, [Live service status](../009-elements/live-status.md)). Before, these were discoverable only by
reading a template's JSON, and
an agent hand-placing a dashboard guessed `textAlign` and `textSize: "xl"`.

**Facilitation kinds.** The format also names what the session kinds hold: a `session-button`'s `session` (a timer
with `minutes`, a stopwatch, a vote with `dots`, a poll with `question` and `options`), an agenda's `agendaItems`,
a checklist's `checklistItems`, a stat row's `stats`, a callout's `pageTitle` over its `label` body, a banner's
`pageTitle` and `pageSubtitle`, and a sticker's `stickerId`. A bare `text` is centred in its box unless it sets
`textAlignX`. The entries of a Q&A board, an idea box and a temperature check are the people's, never an edit's,
so starter questions go on stickies beside them. An agenda written with segments grows to draw every one
([Agenda](../012-collaboration/agenda.md) "The face").

**Hand-drawn strokes.** A `freehand` element is written with `points` as canvas coordinates, `[[x, y], ...]` in
drawing order, `closed` to close and fill it, and a `penColour` (ink, grey or a hued pen). The stored form is a box
with the points packed inside it ([Stroke points](../006-document/stroke-points.md)), which no model can write, so
the MCP takes the box from the points and packs them through the stored-tab migration, before the element is
checked, on every element path (`freehand-points.ts`), and an ops update giving a stroke new `points` sets its new box and block together, where a bare `points` field would have emptied the stroke. Points it cannot draw (none, more than
`MAX_FREEHAND_POINTS`, or not number pairs) are refused naming the element. The format says a hand-drawn board
starts from the `whiteboard` template, a tab in Draw mode, and that any box may carry a small `rotation`.

**Found by search.** A client that searches tools by text finds a tool by its name, description and schema, and
ranks long ones down or leaves the largest out. So `create_document` leads with what it makes, and the single-`tab` alias
is checked against the tab shape by the tool rather than repeating that shape (the whole element format) in the
schema: the definition halved, from about 41 KB to 21 KB, the size of `update_document` and `add_tab`.

**No CLI hints.** An edit's result text is the api's, less its footer's revert line: that line names the
`livediagram changeset revert` command, which no MCP tool runs. Its `@x,y` positions are from the content's top-left as it was read, while an element's `x` and `y` are canvas
coordinates; when the content does not start at 0,0, a closing line gives the offset (`x, y = @x + ox, @y + oy`),
so a position read from a result is not sent back off by it.

### 4.8 `share_document`

Create a shareable link so anyone with the URL can open a document without
signing in: the verb that turns "the AI made a diagram" into "the AI made a
diagram and here's a link to send the team." Wraps `POST /api/documents/<id>/share`
([Share password](../013-workspace/share-password.md)): `{ documentId, role?, expiry? }` → the public URL
(`/document/shared?s=<code>`), the granted role, and the expiry. `role` is
`view`, `participate` or `edit` ([Share roles](../013-workspace/share-roles.md)) and defaults to
**`participate`**: recipients take part (stickies, text, votes) without reshaping the board, and an automated share
never silently grants edit; the model passes `edit` to allow any change or `view` for an audience, and
the api applies the same owner-only authorization every share route enforces, so
a token can only share documents its account owns. `expiry` ([Share-link expiry](../013-workspace/share-link-expiry.md)) defaults to
`never`.

### 4.9 `rename_document` and `delete_document`

CRUD completeness: the verbs a user will reach for the moment they ask their
assistant to "rename that" or "delete the old one":

- **`rename_document`**: `{ documentId, name, tabId? }`. Renames the document
  (`PUT /api/documents/<id>` `{ name }`), or one tab when `tabId` is given
  (`PUT /api/documents/<id>/tabs/<tabId>/name`, no whole-tab save). Non-destructive.
- **`delete_document`**: `{ documentId, tabId? }`. Moves the document to the
  [Trash](../013-workspace/trash.md) (`DELETE /api/documents/<id>`), restorable
  for 30 days, and says so in its result (`trashed: true`, `restorableForDays`).
  There is no permanent option: an AI tool can only ever bin a document, never
  destroy it. A permanent delete stays with the person (the Explorer's Trash) or
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

- **`list_trash`**: `{}`. Read-only. Each document the user may restore:
  `{ id, name, library, reason, deletedAt, purgeAt }`, `library` being
  `personal` or the team's name, `reason` being `deleted` or `empty` (moved by
  the [empty document clean-up](../013-workspace/empty-document-cleanup.md)),
  the two times ISO 8601.
- **`restore_document`**: `{ documentId }`. Restores it to its folder, or
  the root of its space when that folder is gone, and returns `{ restored, id, name, url }`.
  A 404 (not in the Trash, or not the user's) becomes a model-correctable error
  pointing at `list_trash`.

### 4.9b `archive_document` and `unarchive_document`

The owner's Archived ([One Explorer contracts "Archived"](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md)), with exactly the
REST doors' authority (`POST /api/documents/<id>/archive` and `POST /api/documents/<id>/unarchive`, which pass to the
index as the caller; `@liveworkspace/index-app` `archive-doors.ts`). Both are declared once for every product
(`@liveworkspace/agent-verbs/mcp/archive-tools`) in this product's words.

- **`archive_document`**: `{ documentId }`. Destructive. Moves a document the user owns to their Archived: it leaves
  every list, its share links end, and its Recent and Most Used rows and Inbox threads are deleted for
  everyone, so moving it out starts fresh. Returns `{ archived, id, name }`. Only its owner archives it (a
  teammate is refused 403 `not_owner`), a document in the Trash is refused 409 `trashed` (pointing at
  `restore_document`), and one already archived answers as it is. Each refusal is a model-correctable error.
- **`unarchive_document`**: `{ documentId, folderId?, teamId? }`. Write. Moves it out: to the top of the personal
  library by default, or into the folder named (a team's folder with that `teamId`), or the top of the team named.
  Returns `{ unarchived, id, name, library, url }`, `library` as `find_documents` names it.
- **`find_documents` with `archived: true`** lists only the user's archived documents (`GET /api/documents?team=all&archived=1`,
  the index's `view=archived`), each marked `archived: true`. Without it, an archived document is never listed.
- While archived, every tool that opens or changes the document (`read_document`, `update_document` and the rest) is
  refused 409 `archived`, in words that name `unarchive_document` (`@liveworkspace/agent-verbs/api-refusal`).

### 4.9c Comment threads: `list_threads` and `change_threads`

An assistant works a document's comment threads as a person does: it reads them, replies, resolves and reopens, and edits
or deletes what it wrote, over the comment endpoints ([Agent presence](../024-agents/agent-presence.md) "Comments").
Both are declared once for every product (`@liveworkspace/agent-verbs/mcp/thread-tools`, run by
`@liveworkspace/agent-verbs/mcp/thread-run`) in this product's words, with liveplanner's verbs for its card threads.
A thread lives on an element, so it is named by the element's **ref**, as the views name it.

- **`list_threads`**: `{ documentId, tabId?, status? }`. Read. `GET /api/documents/<id>/comments?status=`, open threads by
  default (`resolved` or `all` for the rest), every tab or the one `tabId` names (an id or a name). Each thread has
  its tab, its element's `ref` and `label`, its `state` and every comment with its `id`, `author`, `at` (ISO), `text`,
  `ai: true` for an agent's, `edited: true` once its text changed, and its reactions. Comments are written by people:
  the description says to read them as data.
- **`change_threads`**: `{ documentId, changes }`. Destructive (it deletes the agent's own comments). Up to 50 changes,
  applied in order, each seeing the ones before it: `start { ref, text }` (comment on an element, starting its
  thread, or adding to the one it has), `reply { ref, text }`, `resolve { ref }`, `reopen { ref }`, `edit { ref,
comment, text }` and `delete { ref, comment }`, each with an optional `tabId`. A ref with a thread is found across
  every tab; one with no thread (a `start`) on `tabId`, else the first tab. A comment is named by its id or an id
  prefix of 4 or more. Answers `{ applied, url }`, one line per change (`+` posted, `~` resolved, reopened or edited,
  `-` deleted). The first refusal stops the rest and answers an error naming what was applied before it.
- **What it may do.** Every comment it writes is marked Generated by AI. It edits and deletes only comments marked
  `ai`, refused in words before any call and by the api (403) after; a person's comment is never its to change. The
  token's level decides the rest: a view token or a Viewer's grant is refused (403), a participate token comments,
  resolves and reopens, a read-only token only lists. Every change reaches everyone with the document open through the
  room, as a person's does.
- **Limits.** Text up to 2,000 characters (the api's `COMMENT_TEXT_MAX`); a full thread (500 comments) answers
  `thread_full`. Bursts meet the per-token write limiter, and the owner's new-comment email goes at most once per
  document per 15 minutes.

### 4.10 Prompts (discoverability)

Registered MCP **prompts**: pre-canned templates a client surfaces as slash
commands / quick actions, so a user finds what the server does without knowing
the tool names. Pure text (no api calls, no auth to list); each steers the model
to the right tools and the graph-first path:

- **`diagram_this`** `{ description }`: create a diagram from a description via
  create_document + the graph input, and return a link.
- **`flowchart_from_steps`** `{ steps }`: turn an ordered step list (with
  branches) into a flowchart (diamond decisions, labelled branch edges).
- **`show_my_document`** `{ name }`: find a document by name and read_document it
  inline.

Registered in `apps/mcp/src/prompts.ts` (the show-my prompt by `registerShowMyPrompt`, `../packages/mcp-kit/src/prompts.ts`), wired in `buildServer` beside the tools
and schema resource.

### 4.11 Read-only tokens (the one scope)

A trust story for cautious users: the MCP consent screen offers a **"read-only
access"** checkbox. When ticked, the minted `lwt_` token carries `read_only = 1`
([Public API and API tokens](public-api-and-tokens.md) §3.4), and the api worker rejects every write it
presents (`POST`/`PUT`/`DELETE` → `403 read_only_token`) at a **single
dispatch choke point** in `apps/api/src/index.ts`, so no write route can be
reached, present or future, with no per-route changes. The read tools
(find_documents, read_document, both GETs) still work; every write tool
(create/update/delete/share/add_tab/rename) is blocked server-side, which is the
security boundary (the tool list is static, but the api is the enforcer). Signed-in
sessions and full tokens are unaffected. The token list in the Explorer shows a
"Read-only" badge. This is a single boolean, not a general scopes system:
finer grants stay deferred ([Public API and API tokens](public-api-and-tokens.md) §7).

### 4.12 Error telemetry

Genuine tool failures reach the public **Exceptions** dashboard ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) Error
category), so we see WHERE the MCP breaks. `apiJson` reports a **5xx** from the
api worker (`Error·Api·Http5xx.<Tool>`) and a **network fault** (the service
binding threw: `Error·Api·Internal.<Tool>`), then rethrows; the
`delete_document` raw-fetch path reports a 5xx too. `<Tool>` is the running
tool's PascalCase name (`Http503.UpdateDocument`), the same token as its
`Mcp·Used` event, carried by the `AsyncLocalStorage` scope `registerTool` wraps
every handler in (`tool-scope.ts`, over `../packages/mcp-kit/src/tool-scope.ts`), so the dashboard says which tool broke. A **4xx is deliberately NOT reported**: a bad id or
malformed elements is expected, model-correctable input, not a fault, and
reporting it would flood the view (an empty Exceptions view is the goal).
Fire-and-forget, generic tokens only: never a message, stack, or user content.
Every post (these reports and `Mcp·Used`) is handed to the request's
`ctx.waitUntil` (`../packages/mcp-kit/src/request-scope.ts`) so it outlives the response, and
`Mcp·Used` is sent by `registerTool` only after a tool call succeeds
([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) Mcp).

### 4.13 Worker configuration

The MCP worker reads three bindings and two out-of-band values. Bindings
(`API` service binding, `OAUTH_KV`) are declared in `wrangler.toml`; the rest:

| Name               | Where                          | Absent means                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONSENT_BASE_URL` | `[vars]` (not secret)          | Required on a deployment of your own: unset, it is `https://www.livediagram.app`, so the deployment's OAuth callers land on the hosted consent screen instead of their own. Also the host of every tool's `url` and share link. Local dev (`pnpm dev`) passes `http://localhost:3100` with `--var`; production and staging set theirs in `wrangler.toml` |
| `TELEMETRY_KEY`    | worker secret, **also on api** | livediagram's key on the liveworkspace telemetry service; unset, this worker sends no telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))                                                                                                                                                                             |

`TELEMETRY_KEY` is what lets §4.12's telemetry posts reach the liveworkspace
telemetry service directly: a Worker sends no Origin, so the key is how the
service knows the batch is livediagram's. (It replaced `INTERNAL_EVENTS_KEY`,
which exempted these posts from the api's per-IP limiter when they went over the
service binding.) The value **must match** the api worker's and the service's
`TELEMETRY_KEY_LIVEDIAGRAM`, and a mismatch is silent, so set the same value on both workers with
`wrangler secret put TELEMETRY_KEY` and check it with `wrangler secret list` on each. See
[Secrets policy](../002-project-scope/secrets-policy.md) for the secrets table.

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

| Behaviour       | `readOnlyHint` | `destructiveHint` | Tools                                                                                                                       |
| --------------- | -------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **read**        | `true`         | (not applicable)  | `find_documents`, `read_document`, `list_templates`, `search_icons`, `list_trash`                                           |
| **write**       | `false`        | `false`           | `create_document`, `add_tab`, `share_document`, `rename_document`, `restore_document`, `unarchive_document`, `upload_image` |
| **destructive** | `false`        | `true`            | `update_document`, `delete_document`, `archive_document`, `delete_image`                                                    |

Two tools state one hint more than their behaviour's preset, through the verb (`idempotent`, `openWorld` on
`mcpTool`) and `@liveworkspace/mcp-kit`'s `toolAnnotations`: `delete_image` is `idempotentHint: true` (removing
the same pictures again changes nothing), and `upload_image` is `openWorldHint: true` (its `url` reaches the open web).

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
them) ingest from, so one listing reaches several catalogues. Directories that
look at a server themselves (Smithery, Glama, a client's add-a-server screen)
read its server card, because `/mcp` answers only a signed-in caller.

- **Descriptor.** `livediagram/server.json`, under the registry's `2025-12-11` schema.
  Name `io.github.livediagram-app/livediagram`: every product lists under
  `io.github.livediagram-app`, the GitHub organisation that owns the monorepo
  (`livediagram-app/livediagram.app`, public), so a GitHub sign-in as one of its
  members, or the repo's own GitHub OIDC token, proves the namespace: no DNS
  record and no stored secret. `title` `livediagram`, a `description` of at most 100
  characters, `websiteUrl` `https://www.livediagram.app`, `repository` the monorepo with
  `subfolder` `livediagram/apps/mcp`, the 512px PNG mark the marketing site serves
  (`https://www.livediagram.app/livediagram-icon-512.png`), and one `remotes` entry,
  `streamable-http` at `https://mcp.livediagram.app/mcp` (the Worker's custom domain),
  with no `headers`: OAuth (§3) is discovered from the server's metadata, not
  configured by the client.
- **One identity.** The listing is written once, in `apps/mcp/src/listing.ts`
  (built with `@liveworkspace/mcp-kit/listing`). The `initialize` response's
  `serverInfo` carries it (name `livediagram`, title, version, website and icon) beside
  the server instructions, the server card is made from it, and a test checks
  `server.json` against the registry's schema (vendored in mcp-kit) and against
  that identity, so the descriptor, the handshake and the card cannot drift.
- **Server card.** `GET /.well-known/mcp/server-card.json`, with no sign-in and
  cacheable for an hour: `serverInfo`, the description, icon, website and
  documentation (the help article Connect an AI Assistant), the transport
  (`streamable-http` at this origin's `/mcp`), OAuth 2.1 as the required
  authentication with the protected-resource metadata's address, the
  instructions, and every tool, resource and prompt with its schema, read from
  the same server `/mcp` builds, so it is never stale.
- **Publishing** is manual, never on a push. By hand from `livediagram/`:
  `mcp-publisher login github`, then `mcp-publisher publish`. Or the root
  workflow `mcp-registry.yml`, started by hand (`workflow_dispatch`) with the
  product to publish, which logs in with `github-oidc` and publishes
  `livediagram/server.json`. The registry rejects a version it already holds, so
  republishing means bumping `version` in `listing.ts` and `server.json` (the
  test keeps them equal).
- Only the hosted origin is listed: the descriptor names it alone.

### 4.16a Claude connector directory

The hosted server is meant for **Claude's connector directory**, so a person finds livediagram under Connectors in
claude.ai or Claude Desktop and presses Connect instead of pasting `https://mcp.livediagram.app/mcp`. Submitting
happens at `claude.ai/directory/manage` and is the owner's (a paid Claude account, seven policy acknowledgments, and
a test account if review is escalated to Verified). This section is the audit against the directory's public pages
(read 2026-11-16): [submission](https://claude.com/docs/connectors/building/submission),
[review criteria](https://claude.com/docs/connectors/building/review-criteria) and
[authentication](https://claude.com/docs/connectors/building/authentication). OAuth, the tool rules and the listing
helpers are `@liveworkspace/mcp-kit`'s, the same for every product, so each finding is fixed once there.

**Authentication (§3).**

| Directory asks                                                 | Here                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `401` with `WWW-Authenticate: Bearer resource_metadata="…"`    | Met: `/mcp` without a Bearer, or with one the api refuses (`error="invalid_token"`), answers `401` with the challenge (`token-refusal.ts`).                                                                                                                                                                      |
| Protected resource `resource` equals the MCP URL exactly       | Met: `resource` is `<origin>/mcp`, one authorization server (itself), `bearer_methods_supported: ["header"]`, at the root and at the path-inserted `/.well-known/oauth-protected-resource/mcp`.                                                                                                                  |
| PKCE S256 on every authorize                                   | Met: `code_challenge_methods_supported: ["S256"]`; `plain`, a short challenge or a short verifier is refused.                                                                                                                                                                                                    |
| DCR or CIMD                                                    | DCR (RFC 7591), `token_endpoint_auth_methods_supported: ["none"]`. CIMD is not advertised, so Claude uses DCR.                                                                                                                                                                                                   |
| claude.ai's callback `https://claude.ai/api/mcp/auth_callback` | Met: an https redirect registers; a client named Claude may register only redirects on `claude.ai`, `claude.com`, `anthropic.com` or loopback (`oauth-names.ts`).                                                                                                                                                |
| Claude Code's loopback redirect on any port                    | Met: a registered `http` loopback URI matches on scheme, host and path with any port (RFC 8252 §7.3).                                                                                                                                                                                                            |
| A registration stays usable                                    | A registered client lives 200 days, longer than the six-month token it mints, and every authorize renews it, so Claude can always sign in again with the `client_id` it kept.                                                                                                                                    |
| Refresh tokens rotate; a dead one gets `invalid_grant`         | Not applicable: no refresh token is issued (each access token lives six months, §3.5). A `refresh_token` grant answers `400 invalid_grant` "This server issues no refresh tokens. Sign in again.", so a client signs in again. Refresh support is added only if review asks.                                     |
| `/token` takes `application/x-www-form-urlencoded`             | Met; a body that parses as nothing (JSON) is `400 invalid_request` saying to send it form-encoded, never `415`. An unknown grant is `400 unsupported_grant_type`.                                                                                                                                                |
| Discovery, registration and token answer within 10 s           | Met: each is at most three KV operations and never calls another service (a test runs the whole claude.ai flow with the network refused).                                                                                                                                                                        |
| Nothing blocks `160.79.104.0/21`                               | Met: no address is blocked. The one per-address limit Claude meets, 20 registrations an hour, would stop every claude.ai user at once from Anthropic's shared egress, so that range has its own budget of 2,000 an hour (`anthropic-egress.ts`). Tool calls are limited per token by the api, never per address. |
| No token in a query string                                     | Met: only the `Authorization` header is read, and a `/mcp` request naming `access_token`, `token`, `api_key` or `apikey` in its query is refused `400 invalid_request` in words.                                                                                                                                 |

**Tools (§4).**

- **Titles and hints.** Every tool has a title and a behaviour (§4.14): `readOnlyHint: true`, or `readOnlyHint: false`
  with a `destructiveHint`. `upload_image` is `openWorldHint: true` and its description says plainly that the server
  fetches a public https URL it is given: the one call that reaches past livediagram's own api.
- **The guard.** `apps/mcp/src/directory.test.ts` reads every tool from the server card (exactly what `/mcp` lists) and
  runs `directoryProblems` (`@liveworkspace/mcp-kit/directory`): a title, the read-only or destructive hint, a name of at
  most 64 characters in `A-Z a-z 0-9 _ . -`, a description of at least 20 characters, and an open-world tool that says it
  fetches a URL. A new tool that misses one fails CI.
- **Reads and writes apart.** No catch-all request tool: each tool is one verb.
- **Descriptions are facts** (§4.15): no instruction to the model, no hidden text, no promotion.
- **Refusals in words.** A mistake the caller can fix is a tool error that says what to change ("Errors that teach").
  A failure it cannot fix is worded too: an api `5xx` reads "The service behind this tool did not finish the call
  (HTTP 503). Try again in a moment.", anything else "This tool failed unexpectedly (…). Try again in a moment.", never a
  bare "api 500: Internal Server Error" (`failureWords`). Outside the tools, an unknown path names `/mcp`, a crash is
  `500 server_error` with a sentence, and every OAuth refusal carries an `error_description`. The device grant's polling
  answers keep their RFC 8628 codes alone, since only the CLI uses it and words them itself.
- **Bounded answers.** Searches are capped by their `limit`, pictures have their own byte budget (§5), and any text
  answer over 150,000 characters, Claude's own cap on a tool result, becomes a refusal saying how to ask for less
  (`TOOL_RESULT_MAX_CHARS`).
- **MCP Apps.** The interactive view (§5a) opens links only to `https://www.livediagram.app`, the product's own editor, and
  its CSP lists only livediagram's own socket host.

**Listing copy** (for the submission form):

- **Server name:** livediagram
- **One-liner:** Draw and edit diagrams, flowcharts and mind maps on livediagram from a chat.
- **Description:** livediagram is a free, open-source canvas for diagrams, flowcharts, architecture maps, mind maps and workshop boards, live for everyone on it. Connect it and Claude can find your canvases, read a tab as an outline or a picture, draw a new diagram from a description, a codebase or Mermaid text (livediagram lays it out), change one, start a tab from a template, answer comment threads, share a link and tidy your library. Every change appears live for anyone with the canvas open and can be undone; what Claude makes is marked Made by AI.
- **Categories:** Design; Productivity; Developer tools
- **Server URL:** `https://mcp.livediagram.app/mcp`
- **Documentation:** `https://www.livediagram.app/help/account-and-data/connect-ai-mcp/`
- **Privacy policy:** `https://www.liveworkspace.app/privacy` (it covers connected AI tools for every app)
- **Support:** the liveworkspace contact form, `https://www.liveplanner.app/form/90Bgj5sY9eTpVrjhx9tTZj`
- **Icon:** `https://www.livediagram.app/livediagram-icon-512.png`
- **Slug:** `livediagram` (permanent once published)
- **Allowed link URIs:** `https://www.livediagram.app`
- **Use cases:**
  - Diagram a codebase, a system or a process from a description.
  - Turn Mermaid or a list of steps into a laid-out flowchart.
  - Read a canvas and explain it, or change it as asked.
  - Go through a canvas's comment threads and act on them.
- **Before connecting:** a free liveworkspace account (sign-in is required; guests can't connect).
- **Reads and writes:** both. Reads: find, read, and list templates, icons, images, threads and the Trash. Writes:
  create, add a tab, update (destructive), share, rename, delete to the Trash (destructive), archive (destructive), restore, comment threads, upload or delete gallery images. A read-only connection (a switch on the approval page) is refused every write by the api.
- **Data handling:** the api is livediagram's own, first-party; no personal health data and no sponsored content. The server
  runs no AI model and keeps no conversation data: it stores only OAuth state (sessions, codes, client registrations),
  and the token lives in the liveworkspace accounts Worker. What Claude makes is marked Made by AI or Generated by AI.
- **Authentication:** OAuth, always required, DCR.

### 4.17 Structured output and described parameters

Every tool declares an MCP **`outputSchema`**: the JSON Schema of the object it
returns on success. A successful result carries that object twice: as
**`structuredContent`**, which a client can parse and validate without reading
prose, and serialised as the first text block (JSON on one line: indentation was a third or more of a nested
answer's characters and a model reads it the same), for clients that only read
`content` (the backwards-compatible form MCP recommends). The four tools that
render a preview (`read_document`, `create_document`, `add_tab`,
`update_document`) add the inline PNG after it (`read_document` only when asked with `image: true`) ([§5](#5-visualise--inline-image-render)).
An error result (`isError: true`, a model-correctable message) carries text only
and no `structuredContent`; MCP exempts errors from the output schema. Every mistake the caller can fix is
such a result, never a thrown protocol error: the `registerTool` wrapper answers an api 4xx in words (by its
code or status: a document in the Trash, a view-only grant, an id that names nothing) and a named input error
(a tab id the document lacks names its tabs); only a 5xx or a network failure throws. A deleted tab's refusal
says why by its status (no such tab, view only, the last tab).

| Tool                 | Result object                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `find_documents`     | `count`, `documents[]` of `{ id, name, updatedAt, library, url, archived? }`                                                 |
| `read_document`      | `id`, `name`, `tab { id, name, rev, ... }`, `tabs[]` of `{ id, name }` (every tab, in order), `url`                          |
| `list_templates`     | `categories[]` of `{ id, label, description }`, `templates[]` of `{ kind, title, description, category }`                    |
| `create_document`    | `id` and `documentId` (the same), `name`, `tabCount`, `tabIds[]`, `folder`, `url`                                            |
| `add_tab`            | `documentId`, `tabId`, `name`, `url`, `changesetId`, `rev`, `text`, `lint`, `notes` when the graph or Mermaid lost something |
| `update_document`    | `id` and `documentId` (the same), `tabId`, `url`                                                                             |
| `share_document`     | `url`, `role`, `expiresAt` (ms epoch, or null for never), `documentUrl`                                                      |
| `rename_document`    | `renamed` (`document` or `tab`), `name`, then `id` + `url` for a document or `tabId` for a tab                               |
| `delete_document`    | `deleted` (`document` or `tab`), `documentId`, then `trashed` + `restorableForDays` or `tabId`                               |
| `list_trash`         | `trash[]` of `{ id, name, library, reason, deletedAt, purgeAt }` (ISO timestamps)                                            |
| `restore_document`   | `restored`, `id`, `name` (null when the api omits it), `url`                                                                 |
| `archive_document`   | `archived`, `id`, `name`                                                                                                     |
| `unarchive_document` | `unarchived`, `id`, `name`, `library`, `url`                                                                                 |

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

Only the eight tools that had an old name keep one (`RENAMED_TOOLS` in `legacy-tool-names.ts`): a tool added since,
such as `archive_document` and `unarchive_document`, is served under its own name alone.
<!-- /legacy-names -->

- **Previews**: an emoji icon, sticker or reaction pad, which needs a colour-emoji font a Worker lacks,
  draws from its Twemoji SVG (release 15.1.0 on jsDelivr, CC-BY 4.0, in `THIRD_PARTY_NOTICES.md`), fetched by its
  code points when the preview is made (`preview-emoji.ts`: at most `PREVIEW_EMOJI_MAX` (40) a preview, within
  `PREVIEW_EMOJI_TIMEOUT_MS` (2.5 s), each file at most 64 kB and kept in the Cache API, alongside the fonts). One
  that cannot be fetched in time draws as a disc labelled emoji (`previewResolvers` in `@liveworkspace/icons/resolve`).

### 4.18 What the tool list and an answer cost

Every client pays for the whole tool list in each session, and for every answer's text, so both are kept as small
as they can be without saying less.

- **Tool list size.** A schema built from shared parts repeats their descriptions wherever the part is used. In the
  `tools/list` answer each description of 200 characters or more is said once per tool: a repeat reads
  `Same as "<path>" above.`, the path of the first place it stands (`changes[](op=add).rule.trigger`). Only the
  listing changes; a call is validated against the tool's own schema
  (`../packages/mcp-kit/src/tool-list-compact.ts`).
- **An answer's text** is its structured result as one-line JSON (§4.17).
- **A tab by its name.** Where a tool reads a tab (`read_document`, `update_document` and the tools that load a tab the same
  way), `tabId` takes the tab's id or its name, in any case, when exactly one tab has that name
  (`../packages/mcp-kit/src/tab-named.ts`). A caller that made the tabs knows them by name, and an unknown id was
  already refused with every tab's name beside its id: a call spent to learn what the name said. A name two tabs
  share, or none has, is refused as before, naming the tabs. Renaming and deleting a tab still take its id.

- **A read-only token** that writes is told so: the api's `read_only_token` is answered "this connection is
  read-only: its token can find and read, never create or change ...", on every tool
  (`READ_ONLY_TOKEN_WORDS`, `../packages/api-client/src/client.ts`). It used to read "you may view this ... but not
  change it", which names a share role the caller does not have (and no file at all on a create), or the bare code.

- **A picture's place.** An image element that names no picture (`imageId` left out) is a placeholder the person
  fills in the editor, stored with `imageId: null` (`withPicturePlace`, the model's `element-normalise`). The element
  format always said so, but a call that left the field out had its whole tab refused ("imageId: a string or
  null"): found by the benchmark, where a model built a poster round an empty picture frame.

## 5. Visualise: inline image render

`create_document`, `add_tab` and `update_document` return, and `read_document` with `image: true` returns, an **inline
PNG** so the diagram shows in the chat. This needs headless rendering inside a
Worker (no DOM, no React).

- **Reuse what's already pure.** The existing export
  (`apps/editor/lib/export-tab.ts`) has a **purely procedural SVG path**
  (`renderTabToSvg`) that already calls headless helpers in `packages/document`:
  `arrow-path.ts` (path `d` strings, label anchors), `geometry.ts` (endpoint /
  anchor / bounds), `colors.ts` (`defaultFillColor` / `defaultStrokeColor` /
  `defaultTextColor` theme resolution). The PNG/PDF paths are Canvas/DOM-bound
  and are **not** reusable.
- **Extract a shared renderer.** Move the SVG-building logic into a new pure
  `packages/document/src/svg-render.ts` (`renderElementsToSvg(tab): string`),
  consumed by **both** the existing in-app export (dedup: the editor stops
  carrying its own copy) and the MCP worker. This is the reuse rule applied: one
  renderer, two callers.
- **Rasterise in the worker.** Convert the SVG to PNG with
  [`@resvg/resvg-wasm`](https://github.com/yisibl/resvg-js) (runs in the Workers
  runtime), return it as base64 MCP image content (`image/png`), broadest client
  support vs. raw SVG.
- **Embedded font.** Workers have no system fonts, so the worker bundles one
  (Inter, OFL, `packages/render-png/fonts/`, Regular and Bold, wired as `Data` modules + passed to resvg as
  `fontBuffers`) and renders every label in it; a weight past 500 (a title, a sheet's header row and totals) draws
  in Bold. Without an embedded font resvg
  draws shapes/arrows/colours but no text, so the calling model gets a text-less
  preview it can't self-check against. A diagram's own font choice falls back to
  Inter in the preview; the structured elements still carry the true font.
- **Fonts.** The faces a tab uses beyond Inter (its elements', its own, a sheet's cells') are read from the Google Fonts stylesheet the editor loads (`fonts.ts`' `google` specs), whose answer
  to a client that is not a browser names TrueType files, and handed to resvg for that render (`preview-fonts.ts`, over `../packages/mcp-kit/src/preview-fonts.ts`):
  at most `PREVIEW_FONTS_MAX` (4) families, whatever arrives within `PREVIEW_FONTS_TIMEOUT_MS` (2.5 s), each kept in
  the isolate and the Cache API. A face that cannot be fetched draws in Inter, as before; nothing is sent but the
  family names. The embedded Inter is upright only, so a tab with any text in italic (an element's, a run's, a
  cell's) fetches Inter's italics the same way (`INTER_ITALIC`); resvg drew italic it had no face for upright.
- **No scaled strokes.** resvg ignores `vector-effect="non-scaling-stroke"`, so
  the renderer never relies on it: stretched silhouettes (frames, cylinders,
  device frames) are mapped into the element box point by point
  (`svg-shape-fit.ts`) rather than nested in a scaled `<svg>`. Before that, a
  frame's border in the preview grew with the frame, several pixels thick on a
  large group.
- **Image-element embedding.** When a rendered tab has image elements,
  `imageResult` prefetches their bytes (owner-authed via the caller's token,
  `GET /api/images/:id`) and inlines them as base64 data URIs through the
  renderer's `resolveImageHref` hook: resvg (WASM) can't fetch, so the bytes
  must be inline. A tab with no images does no extra work. The fetch-and-inline core is
  `embedTabImages` in `@livediagram/api-schema`, shared with the api worker's
  snapshot render ([Document SVG snapshots](../006-document/document-snapshots.md)), which passes its own byte source
  (R2) and a total byte budget.
- **Picture budget.** resvg decodes every picture at full size and holds them all while it draws: about 4 bytes a
  pixel on top of about 28 MB for a 2048 px preview, in wasm memory that never shrinks. Measured: one 2880x1800
  screenshot 49 MB, four 112 MB, and a flat 8000x8000 PNG of 0.19 MB 461 MB, against a Worker's 128 MB in all. Time
  is the smaller cost (0.02 to 0.15 s a megapixel). So one preview draws pictures in document order while they stay
  within 8 million pixels together (`PREVIEW_IMAGE_BUDGET_PIXELS`, one full-screen retina screenshot or several
  ordinary ones) and 6 MB together (`PREVIEW_IMAGE_BUDGET_BYTES`, carried inline as base64), each at most 2 MB
  (`PREVIEW_IMAGE_MAX_BYTES`), all in `../packages/mcp-kit/src/preview-budget.ts`. A picture's pixels are read from its header
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
  cylinder / document / cloud / devices / actor / frame ...:
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
  `resolveIconExportArt` from `@liveworkspace/icons/resolve` (a static import of
  the catalogue data; fine in a Worker), so line-art icons draw stroke-tinted
  and Technology marks draw their brand tile instead of the old
  box-with-caption fallback. Without a resolver (or for an unknown id) the
  renderer still emits that fallback, so resolver-less callers are unchanged.

**An empty tab.** A write whose tab has nothing on it yet (a new document from a blank template, a tab emptied by a
replace) answers no picture, and a line saying so ("No preview: the tab has nothing on it yet."): a blank page told
the caller nothing, and a blank slide's background was a 120 KB picture on the first call of every deck. `read_document`
with `image: true` still draws what it is asked.

## 5a. Interactive view (MCP Apps)

The PNG is flat: nobody can zoom into a busy diagram, flip to another tab or click through to the element they want
to change. A host that supports **MCP Apps** (the `io.modelcontextprotocol/ui` extension, stable 2026-01-26: Claude,
ChatGPT, VS Code Copilot, Cursor) renders a tool's linked view in a sandboxed frame beside its result. livediagram is
the pilot; livedocuments and livedesign show the same view a page at a time, and liveplanner a board's columns and
cards, each from the same shared viewer (their mcp-server.md "Interactive view (MCP Apps)").

- **The view resource.** The server lists `ui://livediagram/view.html` (`text/html;profile=mcp-app`), one
  self-contained page with its script and styles inline: the shared viewer (`@liveworkspace/mcp-kit/app-view`,
  `viewerHtml(app, { edits: true })`, about 29 KB with live updates and in-view edits), its size held under
  `VIEWER_EDIT_HTML_BUDGET_BYTES` (32 KB) by a test; a page without edits (the other products', about 20 KB) stays
  under `VIEWER_HTML_BUDGET_BYTES` (24 KB), the edit parts left out of it. The script ships without indentation,
  blank lines or comment lines (`compactScript`). The SVG is
  drawn as an image, so nothing in it fetches: its `_meta.ui.csp` allows one connection only, the WebSocket to
  this deployment's own api (`connectDomains: ["wss://<editor host>"]`, from `CONSENT_BASE_URL`), no resource
  domains, and it asks for a border.
- **The tools that link it.** `create_document`, `add_tab`, `update_document` and `read_document` carry
  `_meta.ui.resourceUri` (and the older flat `ui/resourceUri` key) in their definitions. Their results are unchanged:
  **the PNG always stays**, since the model checks its work from it (§5) and a host without MCP Apps shows only it.
- **What the view does.** It receives the tool's result from the host (`ui/notifications/tool-result`) and takes the
  document and tab from its structured content (`documentId` or `id`, `tabId` or `tab.id`). It then asks the server
  for that tab through the host (`tools/call view_tab`) and draws the SVG we already render (`renderElementsToSvg`,
  the PNG's own source, its pictures, icons and emoji resolved the same way). Wheel, pinch and the + and - buttons
  zoom about the pointer, dragging pans, Fit returns to the whole tab; a strip of the document's tabs switches tab
  (another `view_tab`); clicking an element opens the editor at it (`ui/open-link` to
  `/document/<id>#t=<tab>&el=<element>`, the Inbox's element deep link), and **Open in editor** opens the tab.
  A tab that cannot be read says so in the frame; nothing is cached between results.
- **`view_tab`**: `{ documentId, tabId? }`. Read. The view's own tool (`_meta.ui.visibility: ["app"]`, so a host
  with MCP Apps keeps it from the model): the tab's SVG, its view box, every element's box with its ref and label
  (for the click) and what an edit may do to it (`canRename`, `canMove`, "Edits in the view"), the document's tabs
  and links. Its text block is one short line, not the SVG, so a host without
  MCP Apps that shows it to the model spends few tokens on it; `read_document` stays the model's read.
- **Authority.** The view holds no lasting credential. It reads only through the host's own connection to this
  server, so every `view_tab` is the user's token, through the api's ordinary read gate, and a read-only token
  reads as it does today. No share link is minted, ever. The view is read-only unless the token is edit-level
  ("Edits in the view" below), and even then it holds no write credential of its own.
- **Live updates.** Once a tab is drawn, the view follows the document through its room, as the editor's peers do,
  and draws the tab again when it changes:
  - **The ticket.** The view asks for it through the host (`tools/call view_live`); the server mints it for the
    token's owner with `POST /api/documents/:id/room-ticket?cap=view` ([api.md](api.md)), the index's grant on
    this document sealed with the cap `view` and no pairing (`rt2~…`,
    [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "A
    view-only ticket"). So it is short-lived (the grant's 10 minutes), names one document, admits only at `view`
    whatever the owner's own level (an Editor, Participant or Viewer token alike), seats no owner, and is the
    owner's access as the index has it at the mint: a person whose access was revoked gets none (the mint's 404),
    and a removal closes the open socket (4005). It is never in a text block, the PNG, a log line or the tool's
    telemetry, only in `view_live`'s structured content, which a host with MCP Apps hands the view alone.
  - **The socket.** The view opens `wss://<editor host>/api/documents/:id/ws?t=<ticket>` and never sends a
    frame, as the CLI's room stream does ([cli.md](blueprints/cli.md) "The room stream"), so it is in no one's
    roster and draws no cursor. A relayed `op` that changes content on the shown tab (`tab`, `el`, `tab-meta`,
    `el-delta`, `vote`, `qa`, a `changeset`), a save landing on it (`tab-saved`, after which `view_tab` reads what
    the editor wrote) or a change to the tab list (`document-meta`) schedules one `view_tab`, at most one every
    `LIVE_REDRAW_MS` (1.5 s) however busy the room; presence ops (cursors, lasers, selections, viewports, drag
    previews, reactions, follows, poll answers) and other tabs' changes draw nothing. Pan and zoom survive a
    redraw. A redraw that fails, or answers another tab than the one shown (the shown tab was deleted), keeps the
    picture it has: the view never jumps to the document's first tab on its own.
  - **Reconnects.** The ticket is never renewed in place. Within its life, `LIVE_RENEW_BEFORE_MS` (30 s) before
    `expiresAt`, the view mints a fresh one, opens a new socket and draws the tab once. When the room closes the
    socket (its grant lapsed, 4007; access changed, 4005; full, 4008; the network), the view mints a fresh ticket and reconnects, waiting
    `LIVE_RECONNECT_MIN_MS` (1 s), doubling to `LIVE_RECONNECT_MAX_MS` (30 s), and draws the tab once on
    reopening, to catch up what it missed. After `LIVE_MAX_ATTEMPTS` (6) tries without an open socket it stops.
    A frame the host hides closes its socket and opens a fresh one when shown again, so a view out of sight holds
    nothing in the room.
  - **Snapshot.** When `view_live` is refused (no access, the document in the Trash, the server down), the
    attempts run out, or the document moves to the Trash (4004), the view keeps the tab it last drew and says so
    quietly: the header's live mark reads **Snapshot**, with a title saying live updates stopped and when the tab
    was drawn. While connected it reads **Live**, and **Reconnecting** between tries. Nothing else changes.
  - **Cost.** A document with no open view gets no ticket and no socket: `view_live` runs only when a view asks.
    An open view is one idle socket on the room, one mint every 10 minutes, and at most one `view_tab` per
    `LIVE_REDRAW_MS` while people edit.
- **`view_live`**: `{ documentId }`. Read. The view's own tool, kept from the model like `view_tab`: the socket's
  address (`url`), the ticket and when it lapses (`expiresAt`, epoch ms, read from the grant inside), and whether
  the token may edit through the view (`canEdit`, below). Its text block is one line without the ticket.
- **Edits in the view.** A view whose token is **edit-level** offers a small, safe set of edits; every other
  token gets the read-only view above, unchanged, with no edit control drawn at all.
  - **Who may.** `canEdit` is the server's answer, never the view's guess: `view_live`'s mint answers the
    caller's own level on the document beside the ticket (`level`, [api.md](api.md) `POST
/api/documents/:id/room-ticket?cap=view`), which is `view` for a read-only token whatever the person's own
    level, and `canEdit` is `level === "edit"`. A Participant or Viewer token, a read-only token, a refused mint
    and a document in the Trash all read `false`.
  - **What.** Two edits, nothing else: **rename** an element (its label: a shape, a text or a sticky) and
    **move** one (by a whole-pixel offset). `view_tab` marks each element `canRename` and `canMove`: neither
    for an element that is locked, on a locked layer or on a locked tab; no move for a badge or step number
    attached to a host, nor for the host it is attached to (the attachment follows only in the editor). A frame
    or lane moves with what it holds, as the engine's `move` carries it. Adding, deleting, restyling and
    reconnecting stay the editor's and the model's.
  - **The one write path.** An edit is the view's own tool call through the host, `view_edit`, on the user's
    own token, never a credential the frame holds. It is one agent changeset through the api
    (`POST /api/documents/:id/tabs/:tabId/changesets`), the path `update_document` writes through: a rename is
    `set label`, a move is `move by=dx,dy`, both on `id:"…"` targets, based on the tab as read at the call
    (each named element's fingerprint, as `update_document`'s ops mode bases its own). So the api decides on
    every write, whatever the view sent: a read-only token is refused at the choke point (§4.11,
    `403 read_only_token`), a level below edit at the changeset route's edit gate, a lock by the engine, and the
    room relays what lands to everyone with the tab open. A forged message into the frame can at most draw the
    edit controls; it cannot make a write the token may not make.
  - **The ticket stays view-only.** The live socket is still `view_live`'s view-only ticket, for every token:
    the view never writes on the socket, so an edit-level token gets no stronger ticket, no share link and no
    longer-lived credential than a read-only one.
  - **In the frame.** An **Edit** toggle joins the header beside **Open in editor** once `canEdit` is true
    (`aria-pressed`, drawn pressed with the focus ring's colour; under 760 px wide the live mark shows its dot
    alone, its title still saying how it keeps up, to make room). While it is
    on, a click selects an element instead of opening it: the selection ring is solid, and a small bar above
    the element offers **Rename** and **Open in editor**. Dragging a movable element moves it (the ring follows
    the pointer, dashed, and the drop sends one `view_edit`); dragging empty space still pans and a pinch still
    zooms. Double-click, Enter or F2 renames in a box over the element (Enter saves, Escape cancels, leaving
    it saves). With an element selected the arrow keys nudge it 10 px (Shift: 1 px), sent once the keys rest
    (`NUDGE_SETTLE_MS`, 400 ms) as one move; Tab and Shift+Tab step the selection through the elements (past
    either end the selection clears and focus moves on as usual); Escape clears it, then leaves Edit. The bar
    says what the element allows: **Drag to move**, **Move it in the editor** (a badge or its host), or
    **Locked**; Rename is disabled, with a title saying why, where a rename is not offered. A screen reader
    hears the selection and its keys. While a save is out the bar says **Saving…** in place of its hint, then
    **Saved** for a moment (and a screen reader hears it); a
    refusal says the api's reason in the note and the tab is drawn again as stored. A live redraw waits for a
    drag, a nudge, a rename or a save in progress to finish.
  - **Batched.** One `view_edit` per finished gesture (a drop, a saved rename, a run of nudges), never per
    pointer move, carrying up to `VIEW_EDIT_MAX` (20) edits; its answer is the tab drawn again (`view_tab`'s
    output with the `changesetId`), so the view redraws once without a second call, and the room's relay of
    that same changeset (its `id`) draws nothing more.
- **`view_edit`**: `{ documentId, tabId, edits: [{ elementId, label?, dx?, dy? }] }`. Write. The view's own tool,
  kept from the model like `view_tab` (the model edits with `update_document`): each edit names an element by
  id and gives a new `label` (up to 500 characters), a move (`dx`, `dy`, rounded to whole pixels, each within
  ±100000), or both; one with neither, or an element not on the tab, is refused before anything is sent. Its
  answer is `view_tab`'s for the tab as stored after the edit, with `changesetId`; its text block is
  `Saved 1 edit from the interactive view.` and a sentence telling the model the diagram changed and to call
  `read_diagram` before describing or editing it again (the model holds only the last picture, so without it
  its next turn would describe stale content). **Decision:** this is the whole mechanism; no `ui/update-model-context`
  is sent from the view, since no host in this repository's tests is known to apply it, and the sentence costs
  nothing where a host does pass the result on. A refusal is an error result with the api's reason.
- **Cost.** `view_tab` renders SVG only, no resvg: the Worker CPU of a view is the SVG build and the image fetch the
  PNG path already pays, not the rasterise. Measured on the 100-element service blueprint: the SVG builds in about
  2 ms of CPU and weighs 26 KB, where the PNG takes about 214 ms; a test holds the SVG build to a CPU budget.

**The reason, said.** When the view's own call fails, its note says why in brackets after the sentence: the host's
refusal with its code ("host -32601: ..."), the tool's own error text, or "the answer held no drawing". A view that
only said it could not be shown left nobody able to tell a host that refuses the view's calls from a tool that
failed: production counted no successful `view_tab` in the five days after the view shipped, and nothing said which
(`drawn`, `why`, `../packages/mcp-kit/src/app-viewer-script.ts`).

## 6. Rollout

1. **`apps/mcp` skeleton**: worker, Hono, MCP SDK, service binding to api,
   `/health`, deploy wiring + `mcp.livediagram.app` host. `.env.example`.
2. **Shared SVG renderer**: extract `packages/document/src/svg-render.ts` from
   `export-tab.ts`, repoint the in-app export to it (no behaviour change), add
   `@resvg/resvg-wasm` rasterisation in the worker.
3. **Tools, read-first**: `find_documents`, `read_document` (+ schema resource).
   These are read-only and prove the schema + render path end to end.
4. **Write tools**: `create_document`, `update_document` (both modes), reusing
   `validate.ts` + `auto-layout.ts`.
5. **OAuth**: `/api/oauth/exchange` on the api worker (reusing the token-mint
   path, signed-in only like `/api/tokens`); `apps/editor` consent page; the MCP
   OAuth endpoints + `OAUTH_KV`. Until this lands, the worker can be exercised
   with a hand-pasted `lwt_` Bearer for development.
6. **Docs + help, shipped WITH the feature** (per the help-centre + docs rules in
   `AGENTS.md`):
   - A help article (e.g. `account-and-data/connect-ai-mcp`): what the MCP is,
     connecting it to Claude/an AI tool, the signed-in-only limitation, that it
     mints a revocable API token; **registered in `liveworkspace/apps/help/lib/articles.ts`**.
   - `docs/development/architecture.md`: the new `apps/mcp` worker in the layout + deploy
     order; `docs/specs/016-platform/deployment.md`: MCP needs sign-in (like tokens/teams) and is
     optional to deploy; `README.md` repo-layout tree gets the new app.
   - Cross-link from the API-token help/docs ([Public API and API tokens](public-api-and-tokens.md)).

## 7. Out of scope (for now)

- **Streaming progress** from tools (the SDK supports it; v1 returns once).
- **Folder / team management** via MCP: there are no tools to list, rename, or
  move folders (create_document files new documents at the root of the user's My Work, or their default folder);
  more `/api` surface can be wrapped later if demand appears. (Share-link
  creation IS in scope now: `share_document`, [§4.8](#48-share_document); managing
  folders/teams themselves stays out.)
  (Team **content** is in scope: `find_documents` sweeps team shared libraries
  and the other tools read/edit team documents through the ordinary access
  gates; [§4.1](#41-find_documents), [Public API and API tokens §3.4](public-api-and-tokens.md).
  Managing teams themselves stays out, and the api refuses it to tokens.)
- **Token-paste connector** as a supported path: OAuth is the chosen front door
  ([§3](#3-authentication-oauth-21)); a raw Bearer still works for local dev but
  isn't a documented user flow.
- **Finer-grained scoped MCP tokens**: a **read-only** token now exists
  ([§4.11](#411-read-only-tokens-the-one-scope), [Public API and API tokens](public-api-and-tokens.md) §3.4); per-resource /
  per-verb scopes beyond that stay deferred.
