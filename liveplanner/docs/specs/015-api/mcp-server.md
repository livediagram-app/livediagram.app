# MCP server

**Status: live.** Merged and deployed at `mcp.liveplanner.app`; connect flow
verified end-to-end from Claude. Builds directly on [Public API and API tokens](public-api-and-tokens.md)
(API tokens), which it picks up where §7 left off: [Public API and API tokens](public-api-and-tokens.md) deferred "OAuth /
third-party app authorization"; this spec adds exactly that, scoped to one
client (an MCP server), reusing the `lwt_` token as the credential it ultimately
mints. No new authorization model; an OAuth front door onto the existing token.

## 1. Goal

Let a person connect liveplanner to whatever AI tool they already drive (Claude
desktop/web, Claude Code, any MCP client) and, from inside that tool:

1. **Find and view** the projects they already have: search by name, get back a
   link to open in the editor **and an inline image** of the project.
2. **Create** a new project from a request, e.g. point the AI at a codebase and
   have it build a sprint dashboard from a backlog.
3. **Edit** an existing project: full rework of a tab, or a small adjustment.

**The calling LLM does the thinking; the MCP is only the bridge.** This is the
load-bearing decision. liveplanner runs no model of its own (the in-editor
AI assistant and no `/api/ai` endpoint). The user already has a capable model in front of them; the
MCP's job is to (a) hand that model the element **schema** so it can emit
well-formed elements, (b) **validate** what it produces, and (c)
**persist** it through the same REST API the web app uses. The MCP carries no
model of its own and makes no LLM calls.

**Keep the surface small.** Nine tools and one schema resource (see
[§4](#4-tools)). Each tool is a thin wrapper over an existing `/api` route plus
shared helpers from `packages/project`; the MCP adds no business logic that
isn't reusable.

This must not weaken the friction-free guest model
([Auth + guest access](../014-identity/auth-and-guest-access.md)) or the degrade-never-break rule
([Business model + licence](../002-project-scope/business-model-and-licence.md)). Like API tokens and teams,
the MCP is **signed-in only** and **absent end-to-end** on a deployment without sign-in.

## 2. Architecture

A **new standalone Cloudflare Worker**, `apps/mcp` (worker name
`liveplanner-mcp`), mirroring how Manager Toolkit ships its MCP as its own
worker. Not folded into `apps/api`: it has a distinct dependency surface (the MCP
SDK, OAuth/KV, a WASM rasteriser) and a distinct public origin, and `apps/api`
stays a pure REST/WS surface.

- **Framework / transport.** [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol)
  with **Streamable HTTP** transport (`WebStandardStreamableHTTPServerTransport`,
  `enableJsonResponse: true`), fronted by **Hono** for routing/CORS, the exact
  stack proven in the Manager Toolkit MCP. Tools are defined with `zod` input
  schemas.
- **Talks to `apps/api` over a Cloudflare service binding** (`API`), not public
  DNS. Every tool resolves to one or more `/api/*` calls carrying
  `Authorization: Bearer lwt_…`: the caller's token, passed straight through.
  The api worker already accepts `lwt_` tokens on every route
  ([Public API and API tokens §3.3](public-api-and-tokens.md)), so **no api authorization
  changes are needed** for the tools themselves.
- **Reuses `packages/project`** headless: element factories, `validate.ts`
  (`isValidTab`/`isValidElement`) and a new pure SVG renderer ([§5](#5-visualise-inline-image-render)).
  This is the reuse-over-duplication rule: the MCP must not re-implement
  validation, geometry, or theme-colour resolution.
- **Routing + deploy.** Served at **`mcp.liveplanner.app`** (its own hostname,
  `mcp-staging.liveplanner.app` in staging, each a custom domain declared in
  `apps/mcp/wrangler.toml`, [Deployment](../016-platform/deployment.md#custom-domain)). The monorepo's deploy ships it in the tier after the api
  (its service binding needs the api to exist, [Deployment](../016-platform/deployment.md) "Deploy"). The `router` worker is unchanged; `mcp.` is a
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
   `@liveplanner/api-schema`), stored in KV with a TTL.
   Rate-limited per IP, an IPv6 caller by its /64 (`clientRateKey`, as the api keys its limiters). Authorize re-checks the scheme of the requested
   redirect URI, and the consent page only ever navigates to an http(s) URL.
   The token endpoint requires `client_id` and `redirect_uri` and refuses a code presented with another value of either (RFC 6749 §4.1.3). A name that reads as a liveworkspace app is refused (`400 invalid_client_metadata`), and so is one that reads as Claude, ChatGPT or Cursor unless every redirect URI is a loopback one or on that tool's own domains; at registration and again at authorize (`reservedNameRefusal`, `../packages/mcp-kit/src/oauth-names.ts`).
3. **Authorize**: `GET /oauth/authorize` creates a short-lived session in KV and
   redirects to a **consent page in `apps/editor`** (e.g. `/oauth/authorize` or an
   Explorer "Connect an app" screen), passing the session id. The user is
   already signed in there (a liveplanner session through the liveworkspace accounts
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
   nothing, so it can neither turn the screen's words around nor look blank);
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
needs no KV: minting is the liveworkspace accounts Worker's (`POST /api/oauth/exchange` asks it).

**Why OAuth and not just token-paste.** A static-token-paste connector works in
Claude Code / custom connectors, but the polished "Connect" button in claude.ai
web connectors expects OAuth, and the user chose the OAuth path. Because it still
resolves to an `lwt_` token, the heavy lifting (verification, gating, revoke,
caps) is already built; OAuth is the front door, not a new lock.

**Sign-in gating.** OAuth depends on the consent page authenticating
the user through sign-in and on `/api/oauth/exchange` requiring an account identity; the
same gate as `/api/tokens` ([Public API and API tokens §3.7](public-api-and-tokens.md)). A
deployment without sign-in: the exchange endpoint rejects every caller and the consent
page has no signed-in user, so the MCP can mint nothing. Operators who don't want
the MCP simply don't deploy `apps/mcp`; nothing else references it.

**The CLI signs in here too** ([CLI](cli.md#authentication)). This server is the
one authorisation server for both front doors, so it also offers what a
command-line client needs: a loopback redirect matched on scheme, host and path
with any port (RFC 8252 §7.3), a pre-registered public client `liveplanner-cli`
whose name the consent screen can trust, and the device authorisation grant
(RFC 8628) with a `/oauth/device` page in `apps/editor` for machines without a
browser. A token minted for the CLI is named "liveplanner CLI".

## 4. Tools

Twenty-nine tools: twelve for projects (`upload_image` among them), eight for Plan boards and their cards' comment threads ([§4.9b](#49b-the-plan-tools)), four for sheets
([§4.9c](#49c-the-sheet-tools)) and five
for forms ([§4.9e](#49e-the-form-tools)). The search/view capability is two tools (find, then read); create,
add_tab, and update are separate because their inputs and intent differ;
list_templates exposes the template catalogue ([§4.5](#45-list_templates)); upload_image adds a picture for a plan's cards ([§4.5b](#45b-upload_image-pictures-for-a-plans-cards));
share, rename, and delete complete the CRUD verbs, with list_trash and
restore_project as the way back from a delete
([§4.8](#48-share_project), [§4.9](#49-rename_project-and-delete_project), [§4.9a](#49a-list_trash-and-restore_project)).
Every one of them declares its behaviour as **annotations**
([§4.14](#414-tool-annotations-behaviour-hints)), describes itself in facts
rather than instructions ([§4.15](#415-descriptions-state-facts-not-instructions)),
and declares the shape of its result as an **output schema**
([§4.17](#417-structured-output-and-described-parameters)).

Every project and tab **name** argument (`create_project`'s `name` and each
tab's `name`, `add_tab`'s `name`, `rename_project`'s `name`) states the
60-character cap in its description and is shortened by the schema itself
with the shared `truncateName`, so the name a tool sends and reports back is
the one the api stores ([Tab and project name length](../006-project/name-length.md)).

### 4.1 `find_projects`

Search/list the caller's projects: the **personal library AND every joined
team's shared library** ([Team shared projects](../013-workspace/team-shared-projects.md)). A project
filed into a team leaves its owner's personal list entirely, so the personal
`GET /api/projects` alone is not "the user's projects": the tool asks
`GET /api/projects?team=all&q=<query>&limit=<limit>`, which the api answers from one index page over mine and
every joined team, searched and capped there, newest saved first, beside `GET /api/teams` for the teams' names
(the api accepts the token identity on those reads; [Public API and API tokens §3.4](public-api-and-tokens.md)).
Before, it read every library whole (`GET /api/teams/:id/library` for each team, at most 1,000 projects each)
and matched here: the index's search finds what that missed past the 1,000th. The teams' names are best-effort:
a teams failure names a team's project by its team id, never an error. Input: optional `query`, each word found
in the name or the folder's name (ASCII case-insensitive; a project whose name holds the query as typed still
matches, and so now does one holding its words apart or in its folder's name), `limit`. A query with a
non-ASCII character, which the index would fold differently, or one the index refuses (over 200 characters or
16 words), is matched as before: the whole sweep, the name containing the query in any case. Returns a compact list:
`{ id, name, updatedAt, library, url }` where `library` is `personal` or the
team's name and `url` is the `liveplanner.app` deep link to open it. **No image
here**, kept lightweight so the model can scan many results cheaply, then
`read_project` the one it wants.

### 4.2 `read_project`

Fetch one project's full content **and render it**; this is the "visualise"
capability. Input: `projectId`, optional `tabId` (defaults to the first tab).
Wraps `GET /api/projects/:id` + `GET /api/projects/:id/tabs/:tabId?view=outline`. Returns the
tab's [outline view](../024-agents/project-views.md), about a tenth of the element JSON, with
the refs the edit tools take (`format: "json"` returns the elements instead), plus the deep-link
`url`. With `image: true` it also attaches an inline **PNG** of the tab as MCP image content
([§5](#5-visualise-inline-image-render)); without it a read costs no image tokens. So "show me my sprint dashboard" → `find_projects` →
`read_project` with `image: true` renders it inline. Its structured result carries the tab's `rev`,
which `update_project` takes back as the base of its ops ([§4.4](#44-update_project)).
It also takes `view` (`outline`, `comments`, `show`, `find`), `budget` (8,000 tokens unless
given), `only`, `ref`, `q`, `all` and `style`; a ref that names nothing or several comes back as a
correctable result naming the candidates.

### 4.3 `create_project`

Create a new project from elements the model produced. Input: `name`, `tabs:
[{ name, elements: Element[] }]` (one tab, or several to build a **multi-tab**
project in one call: a dashboard plus a board and a sheet), and the optional `markUsed` (boolean, default `true`). Each tab may instead pass `template: TemplateKind` in place
of `elements`: the server materialises the hand-tuned scaffold from
`@liveplanner/templates` ([§4.5](#45-list_templates)), keeping its curated
layout and applying that template's
canvas overrides; the model then personalises labels via `update_project`'s
`ops` mode. A template tab may also carry `elements`: once the project exists they are added to the template's
first tab as `update_project`'s `add` ops would add them, at the `x` and `y` given, so a Board or Sheet template's
tab holds them beside its own, never silently dropped. They are checked like any other tab's elements before
anything is written; if the api then refuses them the answer says the project was made and why. Every template's
first tab is a Board, Sheet or plain tab, never a Dashboard (a Dashboard is built whole from its rows and could not
hold them), and a test keeps it so. A `dashboard` makes the whole tab, so one given with a `template` or `elements`
is refused, naming the tab, before anything is written. `add_tab` does the same. The MCP:

1. **Validates** each tab's `elements` with `isValidTab` (reject `400`-style with
   a clear message naming the offending tab).
2. **Keeps the model's placement.** Elements are kept at the `x` and `y` given; nothing is laid out for the model,
   and a tab may hold only the Plan elements (§4.7a).
3. **Tags it as made by AI.** The create sends `source: 'mcp'`, which the Explorer's **Made by AI** filter (`made-by:ai`, [Explorer filters](../013-workspace/explorer-filters.md)) reads, so a user's own work and AI-made projects can be told apart wherever either is filed. Unfiled, it sits at the root of My Work like any other project, with its **Made by AI** badge. (Earlier this find-or-created a real "Generated" folder, then the Explorer showed a Generated view; provenance is a filter, not a place.) The create also sends the creation `intent` of the first tab it built and the template it used, so with no folder named the server files it in the user's [default folder](../013-workspace/default-folders.md) for that intent, when they have one.
4. **Persists** all tabs via `POST /api/projects` (which seeds a `tabs[]` array
   and accepts `source`). A tab given as a `template` travels
   as such and is compiled by the api ([API app](api.md)), so the MCP and the
   [CLI](cli.md) build projects alike.
   Making a project is a use of it, so it joins the user's
   Most Used and Recent at once ([Explorer Home](../013-workspace/explorer-home.md));
   `markUsed: false` is passed through to the create
   ([API](api.md#marking-a-project-used)) for a model making many projects in one go,
   so a batch never pushes the user's own work out of reach. Absent, nothing is sent and the
   create counts.
5. **Returns** the new `id`, tab count + ids, the folder ("My Work" for the root,
   or the name of the default folder it was filed in), the deep-link `url`,
   **and the rendered PNG of the first tab** so the user sees the result inline.

### 4.3a `add_tab`

Add a **new tab** (its own canvas) to an existing project. The motivating case:
"make a tab going into more detail on one part of this architecture." Input:
`projectId`, `name`, `elements`, or `template: TemplateKind`
instead of `elements`, exactly like a `create_project` tab. Validates
exactly like a `create_project` tab, then submits a [changeset](../024-agents/agent-changesets.md)
that creates the tab, so anyone with the project open sees it arrive. Returns the new `tabId`, `url`,
and the rendered PNG. (Pair with `read_project`, which lists the project's
existing tabs, to decide where a new one fits.)

### 4.4 `update_project`

Edit an existing tab. **Two modes** (the user asked for both):

- **`replace`**: for building or reworking a whole tab. Input: full new
  `elements: Element[]`. Validated exactly like `create_project`, as a
  `replace` changeset. Use when the change is large enough that re-emitting the
  tab is cleaner than patching.
- **`ops`**: for small adjustments. Input: an ordered list of
  `{ op: 'add' | 'update' | 'remove', element? , elementId? }` targeting existing
  elements by id or by the ref `read_project` prints, sent as `set` / `rm` on the always-safe `id:"…"` ref and
  compiled by the api's edit-operation engine. Nothing is laid out: the user's positions are kept.

Both modes submit one [changeset](../024-agents/agent-changesets.md); the api
applies and validates, relays it live to anyone with the tab open, and
keeps it through their next save. `ops` mode sends its ops as
[edit operations](../024-agents/edit-operations.md) based on the revision
`read_project` returned, so nothing a person saved in between is overwritten: a
touched element that changed is a conflict, an element a person has selected is
refused as held. Both return the changeset's result lines and
the rendered PNG of the result. The model picks the mode: rebuild → `replace`;
tweak → `ops`.

**Edits.** `ops` mode takes `edits` instead of `ops` (`mode: "edits"` names the same mode, as agents read it): [edit operations](../024-agents/edit-operations.md) in the line
form, one a line, sent as the changeset's operations text for the api to parse and apply all or nothing. There are four:
`add` (a whole element as a JSON line), `set <selector> key=value… [all]`, `rm <selector> [all]` and
`test <selector> key=value…`; a selector is a ref or id, a `"label"`, `label~part`, `type:<kind>` or `selected`, and
all its terms must match. The base is the revision the
model read (else the tab as loaded) and every element's fingerprint as loaded, since the text may name any of them.
Coordinates in edits are relative to the content origin, as views print them. `ops` and `edits` together are refused.
The tool's `edits` description carries the operations and selectors in brief.

**Values checked.** A whole element the model sends (on `create_project`, `add_tab`, `replace` and an ops `add`)
must be one a liveplanner tab holds (§4.7a); any other is refused naming it (`element "v1": shape "square" is not an
element a liveplanner tab holds; read liveplanner://schema/elements.`). On a Plan element it is checked as an edit
operation's `set` checks a field: a field its type does not have is refused with the fields like it, and a value off
a closed vocabulary is refused naming the values ([Edit operations](../024-agents/edit-operations.md)). The check
passes every element of every template, so a tab read back as JSON writes again unchanged, and accepts a value
kept as stored but no longer offered (a font the pickers leave out, [Fonts](../004-interface-design/fonts.md) "Not
offered in liveplanner"), which an ops `update` (a `set`) refuses; the values a refusal names are the offered ones.

### 4.5 `list_templates`

Browse the template library: the same hand-tuned catalogue the editor's
template starts ship ([Canvas and palette](../008-canvas/canvas-and-palette.md)), served from the shared
`@liveplanner/templates` package so the worker and the editor can't drift.
No input. Returns the categories (grouped by what the work is for: Customer Support, Events, Sales and the rest,
[Template categories](../008-canvas/canvas-and-palette.md#template-categories), in display order, only those holding
a template it lists, then `blanks`) plus one row per template:
`{ kind, title, description, category }`, enough for the model to pick a
`kind` and pass it as `template` on `create_project` / `add_tab` (a template of several tabs, such as the
Plan templates and the three with a companion Sheet, adds them all on `create_project`, the first named as given; `add_tab` takes its first;
[Plan templates](../026-plan/plan-templates.md)). Deliberately
metadata-only (no elements): the scaffold materialises server-side on create,
so the model never has to re-emit (or accidentally mangle) a curated layout.
The recommended flow for "make me a kanban board"-style asks: `list_templates`
→ create with `template` → `update_project` (`ops`) to fill in real content.

A `template` that names no kind is refused before anything is written, offering the kinds it most likely meant first:
those whose kind or title has a word starting with a word of it of 3 letters or more (`closestTemplateKinds`, at most
`CLOSEST_TEMPLATES_MAX` (5)), then every kind: `Unknown template "retro". Closest: retrospective, team-retro, four-ls,
sailboat. Valid kinds: ...`. The CLI's and api's template bodies refuse with the same hint.

### 4.5b `upload_image`: pictures for a plan's cards

liveplanner keeps the pictures of its cards (Image fields, Several Images fields and Attachments;
[Image fields](../026-plan/item-types.md#image-fields), [Attachments](../026-plan/items.md#attachments)) in
liveworkspace's media service, in their uploader's gallery, and an agent adds them as the card panel does (the owner's
ask, 2026-11-11): first the picture, then the card.

- **`upload_image`** (write, `openWorldHint: true` for its `url`): `{ projectId, data?, url?, name? }`, exactly one of
  `data` and `url`, takes the bytes as livediagram's `upload_image` does (livediagram mcp-server.md §4.5c, the shared
  `packages/agent-verbs/src/images/upload.ts` (`@liveworkspace/agent-verbs`)): base64 or a `data:` URL, or a public https URL fetched through the
  SSRF-safe fetch; PNG, JPEG, WebP or GIF read from the bytes (`sniffImageType`), never SVG, at most `MAX_IMAGE_BYTES`
  (10 MB), with a size in its header. It uploads through the api's own route, `POST /api/images?p={projectId}`, as the
  caller with their own bearer token, naming the tool (`X-Image-Source: mcp`, so the gallery shows it **Made by AI**).
  That route is the one place the rules are held, for the editor and agents alike: the caller must be able to edit
  the plan's cards (an Editor or a Participant; a Viewer, a link that only reads and a read-only token are refused,
  403), the type and size are checked again before a byte leaves the Worker, and the media service checks the type
  against the bytes, dedupes, strips a JPEG's metadata and holds the per-person gallery caps. The plan records a grant
  for the picture, so it serves it to the plan's readers once a card holds it. It answers `{ id, name, width, height,
size, uploadedAt, deduped }` (livediagram's answer, `uploadImageOutput`); `id` is what `change_items` places. Its refusals are livediagram's words (too large, not a
  picture it takes, not valid base64, a URL it will not fetch, a full gallery with how full it is), and a plan the
  caller can't edit says so ("You can view this plan but not add pictures to it.").
- **Placing it**: `change_items`' `add` and `set` take, per Image field or Attachments (by name or id), `{ "add":
["<id>", ...] }` (an Image field set to it, a Several Images field and Attachments added at the end, up to 20, an id
  held already left where it is), `{ "remove": ["<id>", ...] }`, both at once, or `[]`, `null` or `""` (or the field
  in `clear`) to empty it. A bare id, a comma list or a list of ids reads as `add`, and so do the `{ id, link }`
  entries `list_items` gives, so a listing can be written back. An id the plan holds no grant for is refused before
  any card in the call is written ("That picture was not uploaded for this plan: upload it with upload_image first.",
  naming the id), so an agent can't place a picture uploaded for another plan, or someone else's. The check is one
  request for the whole call, `POST /api/images/grants?p={projectId}` ([api.md](api.md) "Images"), plus one for a
  change whose card an earlier change in the call makes. An Attachments entry is made from the upload's own name, size
  and type, read from the grant's record at the service, never from the agent, and only a PNG, JPEG, WebP or GIF up
  to 10 MB is one. Refused, with nothing written: a field that would pass 20 pictures (saying how many more fit), more
  than one picture for an Image field that holds one (it says to make it hold several with `change_card_types`'
  `multiple: true`), Attachments on a card type that does not offer them, more than 100 new pictures in one call, and
  a Viewer's call ("You can view this plan but not add pictures to it.").
- **Reading it**: `list_items` lists each picture of an Image field, a Several Images field and Attachments as its id
  and a `link`, the api's `GET /api/images/{id}?p={projectId}`, which answers the bytes to the agent's token as to
  the person (so a client that reads URLs can look at it).
- **Canvas elements** stay as they were: an `image` element is an empty placeholder, so every element-writing tool
  (create_project, add_tab, update_project) refuses an input that carries an `imageId` anywhere (an element, an op's
  `set`, a page's background), naming the element and saying to leave `imageId` out (`imageIdIssue` in
  `@liveplanner/agent-verbs`), before anything is written. There is no gallery listing or delete tool here: the
  Explorer's Image Gallery lists and removes a person's pictures from every app.

### 4.6 Schema resource (not a tool)

A static, cacheable MCP **resource**, `liveplanner://schema/elements`, returning a compact description of the
elements a liveplanner tab holds: the six Plan kinds (§4.7a), the fields common to all and each kind's own, and the
closed values those fields take. The schema is presented once, declaratively, rather than baked verbatim into every
tool description; the same essentials are summarised in the MCP server `instructions` and the tools' input-schema
field descriptions, so a client that ignores resources still gets enough. The text derives from the edit-operation
engine's own kind list (`PLAN_ELEMENT_KINDS`), so it cannot drift.

### 4.7 No graph or Mermaid input

The tools take no node/edge `graph` and no `mermaid` text. A tab is made from a `template`, a `dashboard` or raw
`elements` (a Form tab from `add_form`), and the Plan, sheet and form tools fill it ([§4.9b](#49b-the-plan-tools),
[§4.9c](#49c-the-sheet-tools), [§4.9e](#49e-the-form-tools)). The changeset `replace` body the api takes is the same
set: exactly one of `template`, `dashboard`, `form` or `elements` ([Agent changesets](../024-agents/agent-changesets.md)).

### 4.7a The elements a tab holds

A liveplanner tab holds only Plan elements, each a `shape` element:

| Kind                                   | Own fields                                                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `plan-board`                           | `planBoard`                                                                                                                                                              |
| `plan-sheet`                           | `planSheet`                                                                                                                                                              |
| `plan-view`                            | `planView`, `textSize`                                                                                                                                                   |
| `bar-chart`, `line-chart`, `pie-chart` | `chartSource { sheetId, range { r1, c1, r2, c2 } }` (required), `sheetAnchor`, `chartVariant`, `chartLegend`, `chartValues`, `chartPalette`; `chartAxis` on bar and line |

Every kind also takes `x`, `y`, `width`, `height`, `label` and `locked`. A chart draws what its sheet's range holds
now. Any other element is refused (§4.4 "Values checked"), and so is an `imageId` (§4.5b).

**Found by search.** A client that searches tools by text finds a tool by its name, description and schema, and
ranks long ones down or leaves the largest out. So `create_project` leads with what it makes, and the single-`tab` alias
is checked against the tab shape by the tool rather than repeating that shape (the whole element format) in the
schema: the definition halved, from about 41 KB to 21 KB, the size of `update_project` and `add_tab`.

**No CLI hints.** An edit's result text is the api's, less its footer's revert line: that line names the
`liveplanner changeset revert` command, which no MCP tool runs. Its `@x,y` positions are from the content's top-left as it was read, while an element's `x` and `y` are canvas
coordinates; when the content does not start at 0,0, a closing line gives the offset (`x, y = @x + ox, @y + oy`),
so a position read from a result is not sent back off by it.

### 4.8 `share_project`

Create a shareable link so anyone with the URL can open a project without
signing in: the verb that turns "the AI made a diagram" into "the AI made a
diagram and here's a link to send the team." Wraps `POST /api/projects/<id>/share`
([Share password](../013-workspace/share-password.md)): `{ projectId, role?, expiry? }` → the public URL
(`/project/shared?s=<code>`), the granted role, and the expiry. `role` is
`view`, `participate` or `edit` ([Share roles](../013-workspace/share-roles.md)) and defaults to
**`participate`**: recipients take part (stickies, text, votes) without reshaping the board, and an automated share
never silently grants edit; the model passes `edit` to allow any change or `view` for an audience, and
the api applies the same owner-only authorization every share route enforces, so
a token can only share projects its account owns. `expiry` ([Share-link expiry](../013-workspace/share-link-expiry.md)) defaults to
`never`.

### 4.9 `rename_project` and `delete_project`

CRUD completeness: the verbs a user will reach for the moment they ask their
assistant to "rename that" or "delete the old one":

- **`rename_project`**: `{ projectId, name, tabId? }`. Renames the project
  (`PUT /api/projects/<id>` `{ name }`), or one tab when `tabId` is given
  (`PUT /api/projects/<id>/tabs/<tabId>/name`, no whole-tab save). Non-destructive.
- **`delete_project`**: `{ projectId, tabId? }`. Moves the project to the
  [Trash](../013-workspace/trash.md) (`DELETE /api/projects/<id>`), restorable
  for 30 days, and says so in its result (`trashed: true`, `restorableForDays`).
  There is no permanent option: an AI tool can only ever bin a project, never
  destroy it. A permanent delete stays with the person (the Explorer's Trash) or
  the REST API's `?permanent=true` ([Public API and API tokens](public-api-and-tokens.md)).
  With `tabId` it deletes one tab (`DELETE …/tabs/<tabId>`) outright: tabs have
  no Trash. Still destructive, so the description tells the model to confirm
  with the user first; the api refuses deleting a project's last remaining tab,
  and a project already in the Trash answers 410, which the tool reports as
  already in the Trash, pointing at `list_trash`.

Both inherit the ordinary owner/team authorization the routes already enforce
([Public API and API tokens §3.4](public-api-and-tokens.md)).

### 4.9a `list_trash` and `restore_project`

The way back from `delete_project`, with exactly the REST Trash's authority
(`GET /api/trash`, `POST /api/trash/<id>/restore`): the user's personal Trash
and every team Trash they have joined.

- **`list_trash`**: `{}`. Read-only. Each project the user may restore:
  `{ id, name, library, reason, deletedAt, purgeAt }`, `library` being
  `personal` or the team's name, `reason` being `deleted` or `empty` (moved by
  the [empty project clean-up](../013-workspace/empty-project-cleanup.md)),
  the two times ISO 8601.
- **`restore_project`**: `{ projectId }`. Restores it to its folder, or
  the root of its space when that folder is gone, and returns `{ restored, id, name, url }`.
  A 404 (not in the Trash, or not the user's) becomes a model-correctable error
  pointing at `list_trash`.

### 4.9b `archive_project` and `unarchive_project`

The owner's Archived ([One Explorer contracts "Archived"](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md)), with exactly the
REST doors' authority (`POST /api/projects/<id>/archive` and `POST /api/projects/<id>/unarchive`, which pass to the
index as the caller; `@liveworkspace/index-app` `archive-doors.ts`). Both are declared once for every product
(`@liveworkspace/agent-verbs/mcp/archive-tools`) in this product's words.

- **`archive_project`**: `{ projectId }`. Destructive. Moves a plan the user owns to their Archived: it leaves
  every list, its share links end, and its Recent and Most Used rows and Inbox threads are deleted for
  everyone, so moving it out starts fresh. Returns `{ archived, id, name }`. Only its owner archives it (a
  teammate is refused 403 `not_owner`), a plan in the Trash is refused 409 `trashed` (pointing at
  `restore_project`), and one already archived answers as it is. Each refusal is a model-correctable error.
- **`unarchive_project`**: `{ projectId, folderId?, teamId? }`. Write. Moves it out: to the top of the personal
  library by default, or into the folder named (a team's folder with that `teamId`), or the top of the team named.
  Returns `{ unarchived, id, name, library, url }`, `library` as `find_projects` names it.
- **`find_projects` with `archived: true`** lists only the user's archived plans (`GET /api/projects?team=all&archived=1`,
  the index's `view=archived`), each marked `archived: true`. Without it, an archived plan is never listed.
- While archived, every tool that opens or changes the plan (`read_project`, `update_project` and the rest) is
  refused 409 `archived`, in words that name `unarchive_project` (`@liveworkspace/agent-verbs/api-refusal`).

### 4.9b The Plan tools

The cards Plan boards show, the boards and the card types ([Plan for agents](../026-plan/plan-agents.md),
[Items](../026-plan/items.md)). Everything is named as the board shows it (a column by name, a card type by name,
custom fields by name, a person by name, an item by number `#12`); the server resolves the ids and refuses an
unknown name with the ones there are.

- **`list_items`** (read): the project's boards with their columns and the cards in each and their header widgets
  by name (as `change_board` takes them), the items with their
  column names (and each card's linked pull requests' states, as the board shows the caller), and the card types
  with their fields; narrowed by card types or columns, by name, by text in a title or description and by when a
  card last changed. By default it leaves out closed cards (done columns, Trash, archived) and formatting runs, and
  says so (`omitted`; `includeClosed`, `includeRich` bring them back), and pages with `limit` and `cursor` so an
  answer never passes about 140,000 characters ([Plan for agents](../026-plan/plan-agents.md) "What `list_items`
  leaves out unless asked"). Each column's card refs and `notOnBoard` come on the first page only; later pages keep
  the boards, columns and card types by name, and the tool's description says so. A project with no board answers a hint saying how to get one.
  `handedToMe: true` lists only the cards handed to the calling assistant, and a card handed to any assistant lists its
  Assignee with `assistant: true` ([Cards handed to an assistant](../026-plan/plan-agents.md#cards-handed-to-an-assistant)).
- **`change_items`** (destructive, as it may delete): up to 50 changes in order, each `add` `{ title, type,
status, fields, template }` (`template` starts the card from one of its type's [card templates](../026-plan/plan-agents.md#card-templates)), `set` `{ item, fields, clear, type, moveFollowing }` (`moveFollowing: true` with a date change then moves the cards that follow it that now clash, [Plan for agents](../026-plan/plan-agents.md)), `move` `{ item, status, before }` or `delete`
  `{ item }`. A refusal answers what was applied before it. A value past a limit is refused naming the field by
  its label, its length or count and the most it takes ("Solution is 12,412 characters; the most is 10,000"; [Plan for
  agents](../026-plan/plan-agents.md) "Errors that teach"), and the tool's description states the limits: a title 500
  characters, the description and a Long Text field 10,000, a Text field 2,000, a checklist 50 rows of up to 200
  characters. Each change reaches open boards at once. Its
  description and `clear` argument say how a `set` empties a field (`"clear": ["Blocked By"]`), and that a field
  holding several also clears with `[]` or `null` in `fields`
  ([Clearing a field](../026-plan/plan-agents.md)). Its description and `fields` argument say that `flagged: true`
  flags a card and `flagged: false` or `clear: ["flagged"]` unflags it, and `list_items`' description and its
  `fields` output say a flagged card lists `flagged: true` ([Flagging a card](../026-plan/plan-agents.md)). A `set` adds and removes the pictures of an Image field, a Several
  Images field and Attachments by the ids `upload_image` answered ([§4.5b](#45b-upload_image-pictures-for-a-plans-cards)).
  `"assignee": "me"` hands a card to the calling assistant and `hand_back` `{ item }` hands one it holds back to its
  person ([Cards handed to an assistant](../026-plan/plan-agents.md#cards-handed-to-an-assistant)).
- **`add_board`** (write): a Plan board on a tab, from a preset or columns by name, as one changeset
  ([Plan tabs](../026-plan/plan-tabs.md#only-in-plan)).
- **`change_board`** (write): a board's title, columns (by name), the card types it takes or its header widgets
  (`widgets` `{ add, remove }`, by kind id or field widget name), as one changeset.
- **`import_board`** (write): a board from a Trello, Asana, Jira or Linear export (`content`, the file's text), in a
  new Board tab of `projectId` or a new plan, with its card type, cards and imported comments; `preview` writes
  nothing. Its people are matched to the plan's team by email on the server when the token's owner is in that team
  (no email is ever answered), else by name ([Importing from another tool](../026-plan/tracker-import.md#agents)).
- **`change_card_types`** (destructive, as deleting a type moves its cards to the Trash): up to 32 card type
  changes (`add`, `set`, `delete`, `add_default_types`; `restore_built_ins` is its older name), checked whole and saved once;
  `add` and `set` also add, edit and remove the type's [card templates](../026-plan/plan-agents.md#card-templates).
- **`list_threads`** (read): a plan's card comment threads, open by default, or one card's, each with its id, title,
  state, cards, Comments field (by name, on its first card) and comments, each comment with its reactions read only ([Plan for agents](../026-plan/plan-agents.md#comment-threads)).
- **`change_threads`** (destructive, as it deletes comments): up to 50 changes in order, `start` `{ item, text, field? }`,
  `reply` `{ thread, text }`, `resolve` / `reopen` `{ thread }`, `edit` `{ thread, comment, text }` and `delete`
  `{ thread, comment }`; every comment it writes is marked Generated by AI, and it edits and deletes only those.
- **`list_rules`** (read): a plan's Automations rules, each with its sentence, on or off, paused, needs attention, last
  run, runs this week and next run; `rule` (an id or exact name) adds its whole body, `runs: true` the recent Audit
  Trail ([Automations](../026-plan/automations.md#agents-and-the-cli)).
- **`change_rules`** (destructive, as it deletes rules): up to 20 changes in order, `add {rule}`, `set {rule, ...}`,
  `on`, `off`, `delete` and `duplicate {rule}`, `test {rule, card}` and `run {rule, card}`; the rule body's format is
  in the tool's input. Only a token whose account is an Editor of the whole plan reaches rules; a read-only token
  lists them and nothing else.

### 4.9c The sheet tools

The spreadsheets Sheet elements show ([Sheet store](../029-sheets/sheet-store.md#agents)). A sheet is named by its
title (case aside) or id, cells by A1, rows by number and columns by letter, never the ids of rows and columns; the
server (`apps/mcp/src/sheet-tools.ts` over `packages/agent-verbs/src/sheets/`) resolves them and refuses an unknown
sheet with the sheets there are. Values are worked out by the editor's engine (`@liveplanner/sheets`), with the
project's Plan cards when a formula reads them.

- **`list_sheets`** (read): the project's sheets (or one tab's), each with its title, tab, the rows and columns in
  use and that range in A1, and the id of the Sheet element framing it (null when none does).
- **`read_sheet`** (read): a range's non-empty cells (the range in use by default) as `{ at, input, value?, display? }`
  (`value` left out when it is what was typed, `display` when it reads as the value does: most cells are typed text
  and numbers, said once instead of three times),
  plus the frozen rows and columns, merges and filter, the validation rules (`validation`) and format rules
  (`conditionalFormats`) in words, and `invalid` on a cell whose value its rule does not allow. A read covers at most `AGENT_READ_CELLS_MAX` (5,000) cells
  of the range and answers at most `SHEET_READ_CHARS_MAX` (100,000) characters of cells; past either it stops,
  sets `truncated` and says in `note` where to read on.
- **`change_sheet`** (destructive, as it clears and deletes): up to 50 changes in order, each built against the
  sheet as the ones before it left it: `set` `{ at, rows }`, `clear` `{ range, what }`, `format` `{ range, format }`
  (bold, italic, underline, strikethrough, colours, font size, alignment, wrap, number format, decimals,
  currency), `insert_rows` / `insert_cols` `{ at, count, side }`, `delete_rows` `{ rows }`, `delete_cols`
  `{ cols }`, `rename` `{ title }`, `sort` `{ by, range?, descending, header }`, `freeze` `{ rows, cols }`, `validate`
  `{ range, rule, reject?, help? }`, `clear_validation` `{ range }`, `conditional_format` `{ range, when + style |
scale, first? }` and `clear_conditional_formats` `{ range? }` ([Data validation](../029-sheets/data-validation.md#agents),
  [Conditional formatting](../029-sheets/conditional-formatting.md#agents)); `resize` `{ cols | rows, px | fit }`,
  `merge` `{ range, across? }`, `unmerge` `{ range }`, `border` `{ range, sides, color, width, style }`, `filter`
  `{ range | null }`, `chart` `{ type, range, columns?, at?, width?, height?, palette? }`, `clear_charts`
  `{ range? }` and `design` `{ design }`
  ([Shaping a sheet, A design](../029-sheets/sheet-store.md#agents); `sheet-shape-change.ts`, `sheet-design.ts`,
  `sheet-charts.ts`, `sheet-chart-follow.ts`). Inserted rows take their neighbour's formats, columns its look. After the
  writes, one changeset on the sheet's tab removes the charts `clear_charts` took, moves those a change left over
  other cells back onto their cells, and adds the charts the changes made over the Sheet element, each with its
  first read. Each
  is sent through the sheet write route as the editor sends it (one write a call, split past 5,000 cells, each with
  its own write id). A formula that cannot be read is refused naming the cell (`formula_invalid`), as is a value a Reject
  validation rule does not allow (`value_invalid`, with what the rule allows); a refusal
  answers what was applied before it.
- **`add_sheet`** (write): a new sheet on a tab (the tab named, else the first with a sheet, else the first,
  [Plan tabs](../026-plan/plan-tabs.md#only-in-plan)), titled
  uniquely on the tab, blank or filled from A1 with `rows`, `csv` or a `design` (one of them), then a Sheet element
  framing it placed beside what the tab holds, as `add_board` places a board, in one changeset with a design's charts.
  The element is 960 x 560, grown to show every filled cell (up to 1,800 x 1,400).
- **Previews**: a Sheet tab's image grows its Sheet to its filled cells and charts (`sheetContentSize`); a chart linked
  to a sheet draws what its cells hold now (`chartsReadLive`); a dropdown draws as the editor's chip, or its arrow.

### 4.9e The form tools

A Form tab's form ([Forms](../030-forms/forms.md#agents)): its questions, sections, where its responses go and its
form link. Everything is named as the builder names it (a question by id or prompt, a section by id, title or place,
a board, card type, column, sheet and card field by name); the server (`apps/mcp/src/form-tools.ts` over
`packages/agent-verbs/src/forms/`) resolves them and refuses an unknown name with the ones there are. The form is
built with the editor's own edits (`@liveplanner/forms`) and started as Start Planning starts one
(`@liveplanner/templates` `planFormStart`).

- **`read_form`** (read): the form in words (sections, questions with their settings, each answer's destination by
  field name, section rules by prompt), where responses go, the card fields it sets automatically (`setAutomatically`,
  a broken one marked) or a sheet's extra columns (`extraColumns`), the settings, state, response count, the form
  link (an Editor's only) and its problems (`broken_fixed` among them); `image` adds a picture of the form on its
  tab's look.
- **`add_form`** (write): a Form tab from a starter or questions, its responses to a new or named board or sheet,
  the fields its mappings name added to the card type, with `setAutomatically` fields and `extraColumns`; a new
  project when no `projectId` is given. Answers as `read_form` does, with the tabs it made.
- **`change_form`** (destructive): up to 50 question, section, form, settings and destination changes, and
  `set_field` (a card field set automatically; `value: null` clears it), `add_column`, `set_column` and
  `delete_column` (a sheet's extra columns), checked whole and written as one changeset; a refusal writes nothing and
  names the change. Every new field is optional, so an agent that sends none keeps the form's set values and extra
  columns as they are. While the form takes responses only `settings` changes go through.
- **`share_form`** (write): `publish`, `close` or `delete_link`, through the form link routes as Share Form calls
  them; a form not ready answers every problem.
- **`try_form`** (write): fills the form in as the builder's Preview does, answers by question id or prompt checked
  first (a wrong one refused with why, nothing sent), then the "Preview: ..." card or row a response makes: through
  `.../form-preview` for a published or sheet form (a published form counts it), else the card through the items
  route. Answers what it made, where, and its number.
- `read_project` lists a Form tab as `kind=form` with a line naming `read_form`; its `image` draws the form as
  `read_form` does.

### 4.10 Prompts (discoverability)

Registered MCP **prompts**: pre-canned templates a client surfaces as slash
commands / quick actions, so a user finds what the server does without knowing
the tool names. Pure text (no api calls, no auth to list); each steers the model
to the right tools:

- **`plan_this`** `{ description }`: turn a goal or a piece of work into a new project: a template from
  list_templates made with create_project, then the real tasks added as cards with change_items, and a link back.
- **`board_from_tasks`** `{ tasks }`: put a list of tasks on a board: a project from the `kanban` template, one
  card per task with change_items (column, assignee and due date as the list gives them), and a link.
- **`show_my_project`** `{ name }`: find a project by name with find_projects and read_project it
  inline.
- **`work_my_cards`** `{ plan }`: work the cards handed to this assistant in a plan: find_projects for the plan,
  list_items with `handedToMe`, then each card in turn (move it to the working column, comment as it goes with
  change_threads, move it on when done, hand it back with change_items' `hand_back`), and a link back.

Registered in `apps/mcp/src/prompts.ts` (the show-my prompt by `registerShowMyPrompt`, `../packages/mcp-kit/src/prompts.ts`), wired in `buildServer` beside the tools
and schema resource.

### 4.11 Read-only tokens (the one scope)

A trust story for cautious users: the MCP consent screen offers a **"read-only
access"** checkbox. When ticked, the minted `lwt_` token carries `read_only = 1`
([Public API and API tokens](public-api-and-tokens.md) §3.4), and the api worker rejects every write it
presents (`POST`/`PUT`/`DELETE` → `403 read_only_token`) at a **single
dispatch choke point** in `apps/api/src/index.ts`, so no write route can be
reached, present or future, with no per-route changes. The read tools
(find_projects, read_project, both GETs) still work; every write tool
(create/update/delete/share/add_tab/rename) is blocked server-side, which is the
security boundary (the tool list is static, but the api is the enforcer). Signed-in
sessions and full tokens are unaffected. The token list in the Explorer shows a
"Read-only" badge. This is a single boolean, not a general scopes system;
finer grants stay deferred ([Public API and API tokens](public-api-and-tokens.md) §7).

### 4.12 Error telemetry

Genuine tool failures reach the public **Exceptions** dashboard ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) Error
category), so we see WHERE the MCP breaks. `apiJson` reports a **5xx** from the
api worker (`Error·Api·Http5xx.<Tool>`) and a **network fault** (the service
binding threw: `Error·Api·Internal.<Tool>`), then rethrows; the
`delete_project` raw-fetch path reports a 5xx too. `<Tool>` is the running
tool's PascalCase name (`Http503.UpdateProject`), the same token as its
`Mcp·Used` event, carried by the `AsyncLocalStorage` scope `registerTool` wraps
every handler in (`tool-scope.ts`, over `../packages/mcp-kit/src/tool-scope.ts`), so the dashboard says which tool broke. A **4xx is deliberately NOT reported**: a bad id or
malformed elements is expected, model-correctable input, not a fault, and
reporting it would flood the view (an empty Exceptions view is the goal).
Fire-and-forget, generic tokens only, never a message, stack, or user content.
Every post (these reports and `Mcp·Used`) is handed to the request's
`ctx.waitUntil` (`../packages/mcp-kit/src/request-scope.ts`) so it outlives the response, and
`Mcp·Used` is sent by `registerTool` only after a tool call succeeds
([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) Mcp).

### 4.13 Worker configuration

The MCP worker reads three bindings and two out-of-band values. Bindings
(`API` service binding, `OAUTH_KV`) are declared in `wrangler.toml`; the rest:

| Name               | Where                          | Absent means                                                                                                                                                                                  |
| ------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONSENT_BASE_URL` | `[vars]` (not secret)          | Defaults to `https://www.liveplanner.app`, so another deployment's OAuth callers land on the hosted consent screen unless it sets its own. Also the host of every tool's `url` and share link |
| `TELEMETRY_KEY`    | worker secret, **also on api** | This worker sends no telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))                                                                                   |

`TELEMETRY_KEY` is liveplanner's Worker key for liveworkspace's central telemetry service
(liveworkspace/docs/specs/008-telemetry/telemetry.md): §4.12's posts go there directly, with no Origin, and the key is what
lets them speak for liveplanner.app. It **must match** the api worker's and the service's
`TELEMETRY_KEY_LIVEPLANNER`; a mismatch is silent (the posts are simply not stored), so set the same value on
both workers with `wrangler secret put TELEMETRY_KEY`. `TELEMETRY_URL` names the service (unset is production's).
See [Secrets policy](../002-project-scope/secrets-policy.md) for the secrets table.

### 4.14 Tool annotations (behaviour hints)

Every registered tool carries an MCP **`annotations`** block alongside its
title and description. These are the standard behaviour hints
(`readOnlyHint`, `destructiveHint`, `openWorldHint`), and they are not
decoration: a client reads them to decide whether a call needs a per-use
permission prompt, so a read-only tool runs without interrupting the user
while a destructive one always asks. Directory listings (the Claude connectors
portal among them) also require them, and a missing block is a listing blocker,
which is how the gap was found.

Three behaviours cover the tools, and each is a preset in
`apps/mcp/src/tool-annotations.ts`:

| Behaviour       | `readOnlyHint` | `destructiveHint` | Tools                                                                                                                                                                                                                  |
| --------------- | -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **read**        | `true`         | (not applicable)  | `find_projects`, `read_project`, `list_templates`, `list_trash`, `list_items`, `list_threads`, `list_rules`, `list_sheets`, `read_sheet`, `read_form`                                                                  |
| **write**       | `false`        | `false`           | `create_project`, `add_tab`, `share_project`, `rename_project`, `restore_project`, `unarchive_project`, `add_board`, `change_board`, `import_board`, `add_sheet`, `add_form`, `share_form`, `try_form`, `upload_image` |
| **destructive** | `false`        | `true`            | `update_project`, `delete_project`, `archive_project`, `change_items`, `change_threads`, `change_rules`, `change_card_types`, `change_sheet`, `change_form`                                                            |

The split mirrors §4.11's read-only-token boundary exactly (what a
`read_only = 1` token can still reach is what `read` annotates), so the hint a
client sees and the rule the api enforces can't drift apart.

`update_project` is **destructive** rather than a plain write: its `replace`
mode swaps a tab's whole element set, so an edit can overwrite work the user
already had. (Its `ops` mode is surgical, but a hint describes the tool, not
the argument, and the cautious reading is the right one.) `share_project`
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
another project to find it. Same information, but phrased as a rule for the
caller, so it was rewritten as a plain statement:

> The full element format is documented inline on each tool's element
> argument, so the tool definitions are the complete reference for it.

Where a genuine safety confirmation belongs, as in `delete_project` asking the
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

- **Descriptor.** `liveplanner/server.json`, under the registry's `2025-12-11` schema.
  Name `io.github.livediagram-app/liveplanner`: every product lists under
  `io.github.livediagram-app`, the GitHub organisation that owns the monorepo
  (`livediagram-app/livediagram.app`, public), so a GitHub sign-in as one of its
  members, or the repo's own GitHub OIDC token, proves the namespace: no DNS
  record and no stored secret. `title` `liveplanner`, a `description` of at most 100
  characters, `websiteUrl` `https://www.liveplanner.app`, `repository` the monorepo with
  `subfolder` `liveplanner/apps/mcp`, the 512px PNG mark the marketing site serves
  (`https://www.liveplanner.app/liveplanner-icon-512.png`), and one `remotes` entry,
  `streamable-http` at `https://mcp.liveplanner.app/mcp` (the Worker's custom domain),
  with no `headers`: OAuth (§3) is discovered from the server's metadata, not
  configured by the client.
- **One identity.** The listing is written once, in `apps/mcp/src/listing.ts`
  (built with `@liveworkspace/mcp-kit/listing`). The `initialize` response's
  `serverInfo` carries it (name `liveplanner`, title, version, website and icon) beside
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
- **Publishing** is manual, never on a push. By hand from `liveplanner/`:
  `mcp-publisher login github`, then `mcp-publisher publish`. Or the root
  workflow `mcp-registry.yml`, started by hand (`workflow_dispatch`) with the
  product to publish, which logs in with `github-oidc` and publishes
  `liveplanner/server.json`. The registry rejects a version it already holds, so
  republishing means bumping `version` in `listing.ts` and `server.json` (the
  test keeps them equal).
- Only the hosted origin is listed: the descriptor names it alone.

### 4.16a Claude connector directory

The hosted server is meant for **Claude's connector directory**, so a person finds liveplanner under Connectors in
claude.ai or Claude Desktop and presses Connect instead of pasting `https://mcp.liveplanner.app/mcp`. Submitting
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
  fetches a public https URL it is given: the one call that reaches past liveplanner's own api.
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
- **MCP Apps.** The interactive view (§5a) opens links only to `https://www.liveplanner.app`, the product's own editor, and
  its CSP lists only liveplanner's own socket host.

**Listing copy** (for the submission form):

- **Server name:** liveplanner
- **One-liner:** Plan work on liveplanner boards, sheets, dashboards and forms from a chat.
- **Description:** liveplanner is a free planner of boards of cards, spreadsheets, dashboards and forms, live for everyone on a plan. Connect it and Claude can find your plans, read boards, cards and sheets, add and move cards by column, type and field name, fill and format sheet cells, build a dashboard, make a form and read its responses, import a Trello, Asana, Jira or Linear export, answer card comment threads and share a plan. Every change appears live for anyone with the plan open.
- **Categories:** Project management; Productivity
- **Server URL:** `https://mcp.liveplanner.app/mcp`
- **Documentation:** `https://www.liveplanner.app/help/account-and-data/connect-ai-mcp/`
- **Privacy policy:** `https://www.liveworkspace.app/privacy` (it covers connected AI tools for every app)
- **Support:** the liveworkspace contact form, `https://www.liveplanner.app/form/90Bgj5sY9eTpVrjhx9tTZj`
- **Icon:** `https://www.liveplanner.app/liveplanner-icon-512.png`
- **Slug:** `liveplanner` (permanent once published)
- **Allowed link URIs:** `https://www.liveplanner.app`
- **Use cases:**
  - Turn meeting notes or a spec into cards on a board.
  - Triage, move and update cards by asking.
  - Build a budget or tracker sheet, or a dashboard over a board.
  - Make a sign-up or survey form and summarise its responses.
- **Before connecting:** a free liveworkspace account (sign-in is required; guests can't connect).
- **Reads and writes:** both. Reads: find, read, and list templates, icons, images, threads and the Trash. Writes:
  create, add tabs, boards, sheets and forms, change cards, sheets, boards, card types, rules and threads (some destructive), share, rename, delete to the Trash (destructive), archive (destructive), restore, upload a picture. A read-only connection (a switch on the approval page) is refused every write by the api.
- **Data handling:** the api is liveplanner's own, first-party; no personal health data and no sponsored content. The server
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
render a preview (`read_project`, `create_project`, `add_tab`,
`update_project`) add the inline PNG after it (`read_project` only when asked with `image: true`) ([§5](#5-visualise-inline-image-render)).
An error result (`isError: true`, a model-correctable message) carries text only
and no `structuredContent`; MCP exempts errors from the output schema. Every mistake the caller can fix is
such a result, never a thrown protocol error: the `registerTool` wrapper answers an api 4xx in words (by its
code or status: a project in the Trash, a view-only grant, an id that names nothing) and a named input error
(a tab id the project lacks names its tabs); only a 5xx or a network failure throws. A deleted tab's refusal
says why by its status (no such tab, view only, the last tab).

| Tool                | Result object                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `find_projects`     | `count`, `projects[]` of `{ id, name, updatedAt, library, url, archived? }`                                                                                                                                                                                                                                                                                                            |
| `read_project`      | `id`, `name`, `tab { id, name, rev, ... }`, `tabs[]` of `{ id, name }` (every tab, in order), `url`                                                                                                                                                                                                                                                                                    |
| `list_templates`    | `categories[]` of `{ id, label, description }`, `templates[]` of `{ kind, title, description, category }`                                                                                                                                                                                                                                                                              |
| `create_project`    | `id` and `projectId` (the same), `name`, `tabCount`, `tabIds[]`, `folder`, `url`                                                                                                                                                                                                                                                                                                       |
| `add_tab`           | `projectId`, `tabId`, `name`, `url`, `note` when a template has more tabs than it added                                                                                                                                                                                                                                                                                                |
| `update_project`    | `id` and `projectId` (the same), `tabId`, `url`                                                                                                                                                                                                                                                                                                                                        |
| `share_project`     | `url`, `role`, `expiresAt` (ms epoch, or null for never), `projectUrl`                                                                                                                                                                                                                                                                                                                 |
| `rename_project`    | `renamed` (`project` or `tab`), `name`, then `id` + `url` for a project or `tabId` for a tab                                                                                                                                                                                                                                                                                           |
| `delete_project`    | `deleted` (`project` or `tab`), `projectId`, then `trashed` + `restorableForDays` or `tabId`                                                                                                                                                                                                                                                                                           |
| `list_trash`        | `trash[]` of `{ id, name, library, reason, deletedAt, purgeAt }` (ISO timestamps)                                                                                                                                                                                                                                                                                                      |
| `restore_project`   | `restored`, `id`, `name` (null when the api omits it), `url`                                                                                                                                                                                                                                                                                                                           |
| `archive_project`   | `archived`, `id`, `name`                                                                                                                                                                                                                                                                                                                                                               |
| `unarchive_project` | `unarchived`, `id`, `name`, `library`, `url`                                                                                                                                                                                                                                                                                                                                           |
| `list_items`        | `boards[]` of `{ title, tab, tabId, kind, takes, sortBy?, widgets?, columns[] { name, status, wipLimit?, done?, closed?, cards[]? } }`, `notOnBoard[]?` (both on the first page only), `count`, `total`, `items[]` of `{ ref, id, type, status, column, title, fields, pullRequests?, handedToYou? }`, `types[]`, `omitted?` `{ closed?, rich?, note }`, `nextCursor?`, `hint?`, `url` |
| `change_items`      | `applied[]` (one line per change, naming the column), `url`                                                                                                                                                                                                                                                                                                                            |
| `list_threads`      | `threads[]` of `{ id, title, state, resolvedBy?, cards[], field?, comments[] { id, author, at, text, ai?, edited?, reactions?[] { emoji, name, count, by[] } } }`, `count`, `url`                                                                                                                                                                                                      |
| `change_threads`    | `applied[]` (one line per change), `url`                                                                                                                                                                                                                                                                                                                                               |
| `list_rules`        | `rules[]` of `{ id, name, on, paused?, needsAttention?, trigger, sentence, lastRun, runsThisWeek, nextRun? }`, `rule?` (the whole rule), `runs?[]` of `{ id, rule, card, at, result, reason?, tookMs, steps[] }`, `runsToday`, `runsPerDay`, `count`, `url`                                                                                                                            |
| `change_rules`      | `applied[]` (one line per change), `runs?[]` (a test's or a run's), `url`                                                                                                                                                                                                                                                                                                              |
| `add_board`         | `tabId`, `elementId`, `title`, `columns[]` of `{ name, status }`, `changesetId`, `rev`, `url`                                                                                                                                                                                                                                                                                          |
| `change_board`      | `tabId`, `elementId`, `title`, `columns[]` of `{ name, status }`, `takes`, `widgets[]`, `changesetId`, `rev`, `url`                                                                                                                                                                                                                                                                    |
| `import_board`      | `projectId`, `tabId`, `title`, `source`, `columns[]` of `{ name, cards }`, `cards`, `leftOut[]` of `{ reason, count }`, `preview?`, `url`                                                                                                                                                                                                                                              |
| `change_card_types` | `applied[]` (with the ids made), `trashed[]`, `types[]`, `url`                                                                                                                                                                                                                                                                                                                         |
| `list_sheets`       | `sheets[]` of `{ id, title, tabId, tabName, rows, cols, filled, elementId }`, `url`                                                                                                                                                                                                                                                                                                    |
| `read_sheet`        | `sheetId`, `title`, `tabId`, `range`, `rows`, `cols`, `cells[]` of `{ at, input, value?, display? }`, `truncated`, `note?`, `frozen { rows, cols }`, `merges[]`, `filter`, `url`                                                                                                                                                                                                       |
| `change_sheet`      | `sheetId`, `title`, `applied[]` (one line per change), `rev`, `url`                                                                                                                                                                                                                                                                                                                    |
| `add_sheet`         | `tabId`, `sheetId`, `elementId`, `title`, `filled`, `truncated`, `changesetId`, `rev`, `url`                                                                                                                                                                                                                                                                                           |

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

**Tool names stay `snake_case` verbs** (`create_project`, `list_trash`). Some
directories prefer dot-notation trees (`project.create`); it is not adopted,
because several clients restrict a tool name to `[a-zA-Z0-9_-]`, and a rename
would break every existing connection and the cross-references between tool
descriptions.

- **Previews**: an emoji icon or sticker, which needs a colour-emoji font a Worker lacks,
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
- **A tab by its name.** Where a tool reads a tab (`read_project`, `update_project` and the tools that load a tab the same
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

`create_project`, `add_tab` and `update_project` return, and `read_project` with `image: true` returns, an **inline
PNG** so the diagram shows in the chat. This needs headless rendering inside a
Worker (no DOM, no React).

- **Reuse what's already pure.** The existing export
  (`apps/editor/lib/export-tab.ts`) has a **purely procedural SVG path**
  (`renderTabToSvg`) that already calls headless helpers in `packages/project`:
  `arrow-path.ts` (path `d` strings, label anchors), `geometry.ts` (endpoint /
  anchor / bounds), `colors.ts` (`defaultFillColor` / `defaultStrokeColor` /
  `defaultTextColor` theme resolution). The PNG/PDF paths are Canvas/DOM-bound
  and are **not** reusable.
- **Extract a shared renderer.** Move the SVG-building logic into a new pure
  `packages/project/src/svg-render.ts` (`renderElementsToSvg(tab): string`),
  consumed by **both** the existing in-app export (dedup: the editor stops
  carrying its own copy) and the MCP worker. This is the reuse rule applied: one
  renderer, two callers.
- **A Plan tab as the editor exports it.** A Board, Sheet or Dashboard tab previews as the editor's image export draws
  it ([Plan tabs](../026-plan/plan-tabs.md) "Export", `@liveplanner/plan-art` `planImageOf`): a Board tab its board
  alone, a Dashboard its page laid out row by row, each metric, chart and card drawn from the project's cards
  (`resolvePlanArt`), each tab slot that tab's board or Sheet. A Dashboard's preview reads the project's other tabs
  (up to `PLAN_PREVIEW_TABS_MAX`, 20) and its plan's column names; any read that fails draws as the editor draws it
  missing.
- **Rasterise in the worker.** Convert the SVG to PNG with
  [`@resvg/resvg-wasm`](https://github.com/yisibl/resvg-js) (runs in the Workers
  runtime), return it as base64 MCP image content (`image/png`), for broadest client
  support vs. raw SVG.
- **Embedded font.** Workers have no system fonts, so the worker bundles one
  (Inter, OFL, in `packages/render-png/fonts/`, Regular and Bold, wired as `Data` modules + passed to resvg as
  `fontBuffers`) and renders every label in it; a weight past 500 (a title, a sheet's header row and totals) draws
  in Bold. Without an embedded font resvg
  draws shapes/arrows/colours but no text, so the calling model gets a text-less
  preview it can't self-check against. A diagram's own font choice falls back to
  Inter in the preview; the structured elements still carry the true font.
- **Fonts.** The faces a tab uses beyond Inter (its elements', its own and a sheet's cells') are read from the Google Fonts stylesheet the editor loads (`fonts.ts`' `google` specs), whose answer
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
- **Image elements.** An image element draws as its placeholder rectangle: liveplanner keeps no uploaded pictures,
  so a preview fetches no picture bytes and inlines none.
- **Element coverage.** The shared renderer draws tables as their real grid
  (tracks / headers / zebra / per-cell text, `svg-render-table.ts`), freehand
  sketches as the canvas draws them (the same Catmull-Rom smoothing, straight
  segments for a polygon-tool path), the full shape-silhouette vocabulary (hexagon /
  cylinder / project / cloud / devices / actor / frame ...:
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
  the catalogue data, fine in a Worker), so line-art icons draw stroke-tinted
  and Technology marks draw their brand tile instead of the old
  box-with-caption fallback. Without a resolver (or for an unknown id) the
  renderer still emits that fallback, so resolver-less callers are unchanged.

**Colours the preview can read.** The picture is drawn by resvg, which reads `rgba(r, g, b, a)` and hex but not
the slash-alpha form (`rgb(15 23 42 / 0.05)`), which it paints solid black. What the preview draws (a page's
pattern, an article's code block and table header) is written as `rgba()`; a test holds the article's draw ops to
it.

## 5a. Interactive view (MCP Apps)

`list_items` and `read_project` answer in text, so an assistant cannot show the board itself in the chat. A host that
supports **MCP Apps** (the `io.modelcontextprotocol/ui` extension, stable 2026-01-26: Claude, ChatGPT, VS Code
Copilot, Cursor) renders a tool's linked view in a sandboxed frame beside its result. livediagram built the pilot (its
mcp-server.md "Interactive view (MCP Apps)"); liveplanner's view shows a **board**: its columns and their cards.

- **The view resource.** The server lists `ui://liveplanner/view.html` (`text/html;profile=mcp-app`), the shared
  viewer page in its board form (`@liveworkspace/mcp-kit/app-view`,
  `viewerHtml('liveplanner', { idKey: 'projectId', board: true })`) with its script and styles inline,
  its size held under `VIEWER_HTML_BUDGET_BYTES` (24 KB) by a test. It draws the board as plain HTML from text, never
  markup it is sent, and fetches nothing: its `_meta.ui.csp` allows one connection only, the WebSocket to this deployment's own api (`connectDomains: ["wss://<editor host>"]`, from `CONSENT_BASE_URL`), no resource domain, and it asks for a border.
- **The tools that link it.** `list_items` and `read_project` carry `_meta.ui.resourceUri` (and the older flat
  `ui/resourceUri` key) in their definitions. Their results are unchanged but for `list_items` naming its
  `projectId`, so the view knows the plan.
- **What the view does.** It takes the plan and tab from the tool's structured result (`projectId` or `id`, `tabId`
  or `tab.id`) and asks the server for that tab's boards through the host (`tools/call view_tab`). Each board shows
  its columns side by side, scrolling across, each headed by its name and its card count (with its WIP limit, `3 / 5`,
  when it has one; a done column muted), and its cards in the board's own order, each card its `#number`, its title
  and its type's colour stripe. A strip of the plan's board tabs switches tab (another `view_tab`). Clicking a card
  opens the editor at it on its board (`ui/open-link` to `/project/<id>#t=<tab>&el=<board element>&item=<card id>`,
  the Inbox's card deep link); **Open in editor** opens the tab. A tab with no board (or none named) shows the plan's
  first board tab; a plan with no board says so in the frame.
- **Draw only what fits.** The view draws at most `VIEW_BOARD_COLUMN_CARDS` (30) cards a column and
  `VIEW_BOARD_CARDS` (300) in all, each title cut at `VIEW_CARD_TITLE_MAX` (120) characters; a column with more says
  "+ 12 more", which opens the board in the editor. Archived and trashed cards are never drawn. The All Cards and
  Archive boards are not drawn.
- **`view_tab`**: `{ projectId, tabId? }`. Read. The view's own tool (`_meta.ui.visibility: ["app"]`, so a host with
  MCP Apps keeps it from the model): the tab's boards (each its element id, title and columns, each column its name,
  status, card count, WIP limit, whether done, and the cards it draws as `{ id, ref, title, color }`), the plan's
  board tabs and its link. Its text block is one short line; `list_items` stays the model's read.
- **Authority.** The view holds no lasting credential. It reads only through the host's own connection to this
  server, so every `view_tab` is the user's token through the api's ordinary read gate, and a read-only token reads as
  it does today. No share link is minted, ever. The view is read-only for every token, whatever its share role.
- **Live updates.** Once drawn, the view follows the plan through its room, as livediagram's does (its mcp-server.md
  "Live updates"), and draws the board again when it changes:
  - **The ticket.** The view asks for it through the host (`tools/call view_live`); the server mints it for the
    token's owner with `POST /api/projects/:id/room-ticket?cap=view` ([api.md](api.md)), the index's grant on this
    plan sealed with the cap `view` and no pairing (`rt2~…`,
    [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "A
    view-only ticket"). So it is short-lived (the grant's 10 minutes), names one plan, admits only at `view` whatever
    the owner's own level (an Editor, Participant or Viewer token alike, and a read-only token), and is the owner's
    access as the index has it at the mint: a person whose access was revoked gets none (the mint's 404). It is never
    a share link, and never in a text block, the PNG, a log line or the tool's telemetry, only in `view_live`'s
    structured content, which a host with MCP Apps hands the view alone. A revoked token stops the view at its next
    mint, within the ticket's 10 minutes (this room keeps no token on its sockets, so none closes at once).
  - **The socket.** The view opens `wss://<editor host>/api/projects/:id/ws?t=<ticket>` and never sends a frame,
    so it is in no one's roster and draws no cursor. A relayed `op` that changes what the view shows (cards written (`items`), card types (`item-types`), `tab`, `el`, `tab-meta`, `el-delta`, a `changeset`, on
    the shown tab or naming none), a save landing (`tab-saved`) or a change to the tab list (`project-meta`) schedules
    one `view_tab`, at most one every `LIVE_REDRAW_MS` (1.5 s) however busy the room; presence ops and other tabs'
    changes draw nothing. The scroll position survives a redraw, and a card that held focus keeps it. A redraw that fails, or answers another tab than the one shown, keeps
    what the view has.
  - **Reconnects and Snapshot.** As livediagram's: a fresh ticket `LIVE_RENEW_BEFORE_MS` (30 s) before one lapses, a
    dropped socket retried from 1 s doubling to 30 s for at most 6 tries, a hidden frame holding no socket. The
    header's mark reads **Live**, **Reconnecting** or **Snapshot**; Snapshot (a refused mint, the tries run out, or
    the plan moved to the Trash: `project-trashed` or the close 4004) keeps what the view last drew, its title saying
    why and when.
  - **Cost.** A plan with no open view gets no ticket and no socket. An open view is one idle socket on the room, one
    mint every 10 minutes, and at most one `view_tab` per `LIVE_REDRAW_MS` while people edit.
- **`view_live`**: `{ projectId }`. Read. The view's own tool, kept from the model like `view_tab`: the socket's
  address (`url`), the ticket and when it lapses (`expiresAt`, epoch ms). Its text block is one line without the
  ticket. Edits in the view stay livediagram's: this view is read-only for every token.
- **Cost.** One `view_tab` reads the items and the plan once (the reads `list_items` makes) and groups the cards by
  column in one pass. A test holds building the view of a 2,000-card board to a CPU budget and its size to under
  64 KB.

**The reason, said.** When the view's own call fails, its note says why in brackets after the sentence: the host's
refusal with its code ("host -32601: ..."), the tool's own error text, or "the answer held no drawing". A view that
only said it could not be shown left nobody able to tell a host that refuses the view's calls from a tool that
failed: production counted no successful `view_tab` in the five days after the view shipped, and nothing said which
(`drawn`, `why`, `../packages/mcp-kit/src/app-viewer-script.ts`).

## 6. Rollout

1. **`apps/mcp` skeleton**: worker, Hono, MCP SDK, service binding to api,
   `/health`, deploy wiring + `mcp.liveplanner.app` host. `.env.example`.
2. **Shared SVG renderer**: extract `packages/project/src/svg-render.ts` from
   `export-tab.ts`, repoint the in-app export to it (no behaviour change), add
   `@resvg/resvg-wasm` rasterisation in the worker.
3. **Tools, read-first**: `find_projects`, `read_project` (+ schema resource).
   These are read-only and prove the schema + render path end to end.
4. **Write tools**: `create_project`, `update_project` (both modes), reusing
   `validate.ts` + `auto-layout.ts`.
5. **OAuth**: `/api/oauth/exchange` on the api worker (reusing the token-mint
   path, signed-in only like `/api/tokens`); `apps/editor` consent page; the MCP
   OAuth endpoints + `OAUTH_KV`. Until this lands, the worker can be exercised
   with a hand-pasted `lwt_` Bearer for development.
6. **Docs + help, shipped WITH the feature** (per the help-centre + docs rules in
   `AGENTS.md`):
   - A help article (e.g. `account-and-data/connect-ai-mcp`): what the MCP is,
     connecting it to Claude/an AI tool, the signed-in-only limitation, that it
     mints a revocable API token, **registered in `liveworkspace/apps/help/lib/articles.ts`**.
   - `docs/development/architecture.md`: the new `apps/mcp` worker in the layout + deploy
     order; [Deployment](../016-platform/deployment.md): MCP needs sign-in (like tokens/teams) and is
     optional to deploy; `README.md` repo-layout tree gets the new app.
   - Cross-link from the API-token help/docs ([Public API and API tokens](public-api-and-tokens.md)).

## 7. Out of scope (for now)

- **Streaming progress** from tools (the SDK supports it; v1 returns once).
- **Folder / team management** via MCP: there are no tools to list, rename, or
  move folders (create_project files new projects at the root of the user's My Work, or their default folder);
  more `/api` surface can be wrapped later if demand appears. (Share-link
  creation IS in scope now: `share_project`, [§4.8](#48-share_project); managing
  folders/teams themselves stays out.)
  (Team **content** is in scope: `find_projects` sweeps team shared libraries
  and the other tools read/edit team projects through the ordinary access
  gates; [§4.1](#41-find_projects), [Public API and API tokens §3.4](public-api-and-tokens.md).
  Managing teams themselves stays out, and the api refuses it to tokens.)
- **Token-paste connector** as a supported path: OAuth is the chosen front door
  ([§3](#3-authentication-oauth-21)); a raw Bearer still works for local dev but
  isn't a documented user flow.
- **Finer-grained scoped MCP tokens**: a **read-only** token now exists
  ([§4.11](#411-read-only-tokens-the-one-scope), [Public API and API tokens](public-api-and-tokens.md) §3.4); per-resource /
  per-verb scopes beyond that stay deferred.
