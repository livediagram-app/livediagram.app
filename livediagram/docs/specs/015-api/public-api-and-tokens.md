# Public API and API tokens

**Status: shipped.** Everything below is live on `main`: API tokens (§3),
the verified guest identity (§4, §4.1) and the input validation (§5). This
spec sequenced opening the REST API to external, programmatic callers.

## 1. Goal

Let **signed-in** people call the livediagram API from their own scripts /
integrations with a long-lived **API token**, not just from the first-party web
app. Read their documents, create/update them, manage folders — the same surface
the app uses, under an explicit, revocable credential.

**Signed-in only (gated like teams, [Teams](../013-workspace/teams.md)).** API tokens are an
advanced, opt-in feature for users with an account; the canvas, guests, and the
share/realtime flows are unaffected and stay account-free ([Auth + guest access](../014-identity/auth-and-guest-access.md)).
A token always acts as a signed-in account; there are **no guest-owned tokens**. This
is a deliberate constraint, not a limitation to apologise for: programmatic API
use is a power-user need, requiring an account for it is reasonable, and it
keeps tokens apart from guests entirely (a guest's own credential, the guest
token, is [§4](#4-guest-identity-a-verified-guest-token)).

This must not weaken the friction-free guest model ([Auth + guest access](../014-identity/auth-and-guest-access.md))
or the optional-services rule ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)).

## 2. Why the API wasn't safe to expose as-is (history)

**History, not the current API.** This section records the weakness that
motivated §4, as it stood before this work shipped. Every surface it names has
since been closed; [Where it stands now](#where-it-stands-now) says how, and
what is still a deployment switch.

The worker resolved the caller two ways ([Auth + guest access](../014-identity/auth-and-guest-access.md)):

- **A session JWT** in `Authorization: Bearer <jwt>` (Clerk's then; an account access token from
  the liveworkspace accounts Worker now), verified (signature, exp, issuer, audience), today in
  `apps/api/src/auth/accounts.ts`. Sound.
- **Guest path**: an `X-Owner-Id` header carrying a per-browser UUID, **trusted
  verbatim** by `resolveOwner()` in `apps/api/src/index.ts`, with **no
  signature** on the REST path. (The realtime WS upgrade of the time required an
  HMAC proof, `?g=`; REST did not.)

The guest header was the blocker, and the owner id it carried was **not a
secret in practice.** The obvious REST surfaces were already redacted for
non-owners (the shared document DTO, `redactOwner`; comment author ids on tab
read, `redactCommentAuthorIds`), but two surfaces still exposed a
collaborator to the owner's id:

- **Realtime presence**: `broadcastPresence` (`document-room/document-room.ts`, roster in `room-roster.ts`) sent every
  connected participant's `id`, unredacted, to all room peers, and that id was
  the owner id. Any co-present collaborator, including a **view-only** share
  visitor, could read it off a presence frame.
- **Change-log / Activity** (endpoint since removed with the Activity panel, 2026-10-03): `GET /documents/<id>/log` returned each entry's
  `participantId` unredacted to any **edit-access** collaborator (edit-share
  holders, joined team members). A static, reliable harvest.

Because REST trusted `X-Owner-Id` with no signature, a collaborator who
harvested an owner's id could call the API **as** that owner across ALL their
content: `GET /api/documents` listed every document the id owned, each then
readable / editable / deletable. **Sharing one document (or being in a team)
could escalate to impersonating the owner account-wide.** It applied to
signed-in owners too: their id is the account `sub`, and the `X-Owner-Id`
fallback accepted it whenever a request carried no Bearer token.

Conclusion at the time: external access needed a real, server-verifiable
credential, AND the bare `X-Owner-Id` trust had to be replaced, which also
closed the escalation. The fix is [§4](#4-guest-identity-a-verified-guest-token).

### Where it stands now

- **There is no owner header.** A guest is identified by a guest token the
  liveworkspace accounts site signs, sent as `Authorization: Bearer` like an
  account's access token and verified the same way
  ([§4](#4-guest-identity-a-verified-guest-token)). An owner id, harvested
  from anywhere, admits nothing ([§4.1](#41-an-owner-id-is-never-a-credential)).
- **The WS upgrade takes no owner id.** It admits a caller by a one-time
  room ticket minted over authenticated REST (`t`, `routes/document-room-routes.ts`;
  [API app](api.md) "Realtime model"), or by a share code (`s`, with the share
  password as `p` where the link has one). No owner id or guest token rides the
  upgrade URL.
- **Presence carries no owner id.** The room mints a random presence id per
  socket and builds each presence entry itself (`helloPresence`,
  `document-room-rules.ts`); a client never supplies or learns one.
- **External callers have a real credential**: API tokens ([§3](#3-design-api-tokens)).

## 3. Design: API tokens

**API tokens belong to the liveworkspace account** ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md)
"API tokens"). They are made, listed and revoked on liveworkspace.app, and one token works on every app's API and
MCP server. liveworkspace holds the hash, the name, the read-only flag, the 6-month expiry and the cap (20 per
account). What follows records how livediagram uses them; where it describes livediagram minting, listing or
storing tokens itself, the account-level design below supersedes it.

- **Verifying.** An `lwt_` bearer is checked with liveworkspace (`POST /api/account/internal/tokens/verify`,
  client-credentials) by `createTokenChecker` in `apps/api/src/db/api-tokens.ts`. A verified token is cached for
  a minute per isolate, so a burst of MCP tool calls costs one round trip a minute. A token
  liveworkspace refuses gets `401 invalid_token`; if liveworkspace can't be reached, `503 accounts_unavailable`
  with `Retry-After: 5`.
- **No copy.** livediagram keeps no table of tokens. What hangs off one (workbench pairings and sessions) is
  liveworkspace's too, which reads the token's state at each mint and session check and ends what was paired through
  it when it is revoked ([liveworkspace/docs/workbench.md](../../../../liveworkspace/docs/workbench.md) "Ending access"). `GET /api/tokens/current` answers from the verify response.
- **Minting for an AI tool.** The OAuth exchange (`POST /api/oauth/exchange`) asks liveworkspace to mint the
  token with the person's access token (`POST /api/account/internal/tokens`). A token the MCP then refuses is
  revoked by presenting it to `DELETE /api/tokens/current`.
- **Management** is on liveworkspace.app. `GET/POST /api/tokens` and `DELETE /api/tokens/:id` answer
  `410 { error: 'tokens_moved', manageAt }`. The Settings dialog's API Tokens row links to liveworkspace.app and
  lists the account's paired workbenches with Unpair.
- **Self-revoke.** `DELETE /api/tokens/current` revokes the presenting token on liveworkspace
  (`POST /api/account/internal/tokens/revoke`) and ends its pairings here.
- **Expiry reminders** are not sent: liveworkspace sends none yet.

### 3.1 Token format

- An opaque secret with a visible prefix for greppability + leak-scanning:
  `lwt_<base64url(32 random bytes)>`. The prefix also disambiguates it from a
  account access token (a JWT) in the same `Authorization: Bearer` header.
- Shown **once** at creation; never retrievable again.
- Stored **hashed** (SHA-256), never in plaintext. Auth hashes the presented
  token and looks the hash up by its UNIQUE-indexed column — an indexed
  equality lookup, not a per-row compare: the hash derives from 256 bits of
  randomness, so there's no low-entropy value to time-attack (unlike a
  password) and the lookup leaks nothing useful.

### 3.2 Storage

livediagram stores no token and has no database to store one in. liveworkspace keeps each token (its hash, owner,
name, read-only flag, expiry and last use) with the account ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md)
"API tokens"). What hangs off a token, a workbench pairing or session, is liveworkspace's too, which ends it with the token
([Workbench embeds](../013-workspace/workbench-embeds.md)).

**Lifetime — fixed 6 months.** Every token expires at `created_at + 6 months`.
This is a hard maximum AND the only option: `expires_at` is **never null** (no
never-expires tokens) and there is no shorter / user-chosen value for now — a
long-lived credential that never lapses is the thing we don't want sitting in
someone's CI config forever. `expires_at` is therefore always set and always in
the future at creation, and liveworkspace refuses an
expired token exactly like a revoked one. **Rotation is manual**:
mint a fresh token before the old one lapses. A configurable or shorter
lifetime can be added later if there's demand; six months is the ceiling
regardless.

### 3.3 Resolution

A token authenticates as its own identity path, resolved once in `fetch`
alongside the account access token and the guest token:

1. An account access token or a guest token in `Authorization: Bearer`, when it
   verifies (`createPersonVerifier`, [§4](#4-guest-identity-a-verified-guest-token)).
2. Else `Authorization: Bearer lwt_…` → hash → look up a non-revoked,
   non-expired row → the request's owner id is the row's `owner_id`; stamp
   `last_used_at`. The column means "the last request this token made, to
   within a minute": a request writes it only when the stored value is older
   than `LAST_USED_STAMP_WINDOW_MS` (60 s, `apps/api/src/db/api-tokens.ts`),
   checked again in the UPDATE's WHERE, so a burst of MCP tool calls (3 to 6
   api requests each) costs one write a minute rather than one per request.
   Its only reader, the Settings token card, works at day grain. (A token and a JWT can't both be the bearer.) An `lwt_`
   bearer with no such row (unknown, revoked or expired), or one too short to be a token at all (cut short or
   mistyped when pasted), is refused there and then with `401 invalid_token` and `WWW-Authenticate: Bearer
error="invalid_token"`, on every route: it never falls through to a guest
   or to no owner, so a script holding a dead token is told so.
3. Else no owner: a link visitor, admitted only by a share code. Tokens never
   resolve to a guest id.

The resolved owner id flows through the **same** `gateRead` / `gateEdit` /
ownership checks every route already enforces — so a token can only touch what
its `owner_id` owns. No route changes for authorization; only the identity
source changes.

### 3.4 Access — full read + write, with an optional read-only flag

> **Specified, not built:** the read-only flag becomes a token level (view, participate or edit), one vocabulary with
> share links ([Share roles](../013-workspace/share-roles.md#api-tokens)). Read-only tokens become view tokens; the
> rest become edit tokens.

A token grants its owner's **full** access — read AND write, the same surface
the app has — **unless** it was minted **read-only** (the one scope that
exists): a `read_only` flag on the token (kept by liveworkspace accounts) that, when set, restricts the
token to `GET`/`HEAD`; the api worker rejects every write it presents at a
single dispatch choke point with `403 read_only_token`
([MCP server §4.11](mcp-server.md)). The same choke point refuses it the one read that is a
credential rather than content: `GET /api/documents/:id/share`, whose links and password would let it
open an edit link. Read-only tokens are minted through the MCP
consent screen (a "read-only access" checkbox), giving a cautious user a way to
let an AI tool VIEW their documents without granting edit. There is still no
finer-grained scope vocabulary (per-resource, per-verb); that remains deferred
([§7](#7-out-of-scope-for-now)) — `read_only` is a single boolean, not a general
scopes system.

**Team content counts as "the same surface".** A token's owner is always a
signed-in account ([§3.3](#33-resolution)), and both credentials — session JWT and
token — are server-verified, so the token identity feeds the same
team-membership checks the session does (`RouteContext.verifiedUserId`, used by
`gateRead`/`gateEdit` and the team-scoped document/folder verbs). Concretely: a
token can read and edit the documents in the shared libraries of the teams its
owner has joined ([Team shared documents](../013-workspace/team-shared-documents.md)), and can `GET` the
teams surface (list its teams, team detail, a team's library). Without this, a
document filed into a team was invisible to every external integration — the
personal `GET /documents` excludes team documents by design.

**Administration stays interactive-session-only.** Every teams MUTATION
(create, invite, role change, join/accept/leave, invite links, team deletion)
plus token management (`/api/tokens`) and account deletion
require a verified signed-in **session** (`accountUserId`), never a token. Boundary
rationale: a leaked token already exposes the owner's content (that's §3.4's
deal, revocable + 6-month-capped), but it must not be able to escalate — mint
further credentials, grant other people membership, or destroy the account.

**Deleting goes to the Trash, with an explicit way past it.** A token's
`DELETE /api/documents/<id>` moves the document to the [Trash](../013-workspace/trash.md)
like every other delete; `DELETE /api/documents/<id>?permanent=true` deletes it
for good at once (and purges one already in the Trash). The Trash routes
(`GET /api/trash`, `POST /api/trash/<id>/restore`, `DELETE /api/trash[/<id>]`)
are token-usable with the same delete authority; a read-only token may list the
Trash but not restore or purge. The MCP server, by contrast, offers no permanent
delete at all ([MCP server §4.9](mcp-server.md)).

### 3.5 Rate limiting

Key the existing `WRITE_RATE_LIMITER` on the token id (not just the owner) so a
runaway integration is throttled independently of the owner's interactive app
use, and add a read limiter for token reads. Per-IP limits stay as the outer
backstop.

### 3.6 Management — the Settings dialog's API Tokens category

> **Superseded**: tokens are managed on liveworkspace.app (see the head of §3). This section records the manager livediagram had.

Tokens are created, viewed and revoked in the **Settings dialog**
([User preferences](../007-editor/user-preferences.md)), in the **API Tokens**
sub-category of **Account** (id `tokens`, `parent: 'account'`, shown as
"Account › API Tokens"). It is account-scoped like its parent, and the dialog is reachable
from both the Explorer and the editor, so the tokens are too. There is no
Explorer page for them: the former `/explorer/tokens` route and its sidebar
entry are gone, with no redirect (few people had used it).

The category holds one row, the **token manager** (`kind: 'tokens'`), laid
out top to bottom:

- **Overview.** The row's own header (the key tile, the title and the line on what tokens are for, with Learn more)
  over the **capacity meter**: "3 of 10" over ten pips, one per slot, filled for each
  live token (brand; amber from 8; rose at the cap), with a **New** button beside it (accessible name "New token")
  that opens the composer; at the cap it is disabled and the meter says to revoke one first. The title and line are
  said once: the overview repeated them under the header.
- **Composer.** Opens in place under the overview from New. A name
  field (optional, up to 60 characters, focused when opened) with **suggestion chips** that fill it
  ("Claude", "Cursor", "CI Bot", "Local Script"), a live line saying when the
  token will expire (six months from today, as a date), then **Cancel** and
  **Create Token**. Enter submits, Escape cancels.
- **Reveal.** After a create, the composer becomes an emerald-edged "Token
  Created" card that follows the theme (light in light mode): a "Shown once"
  label and the secret in a monospace field with its `lwt_` prefix picked out.
  The field copies the way the Share dialog's pass link does: an icon-only copy button inside the field's right edge, with
  a tooltip, that turns into a check once the clipboard write resolves.
  **Done** drops the secret for good; it becomes the primary action once the
  secret has been copied.
- **Token cards**, newest first. Each has a key tile tinted by status, the
  name ("Untitled token" when unnamed), a Read-only badge where set, a meta
  line (created date; last used, with a green dot when used in the last 24
  hours, or "Never used"), and a **lifetime bar**: how much of the six months
  has passed, tinted by status (Active / Expires soon inside 14 days /
  Expired), labelled with the time left. A **Revoke** control per card opens
  a confirmation popover with the revoke warning first.
- **Paired workbenches.** Under a card's lifetime bar, the workbenches the token
  is paired with ([Workbench embeds](../013-workspace/workbench-embeds.md#pairing)),
  read once per account (`GET /api/workbench/pairings`) and grouped by token: each row
  the workbench's name ("Unnamed workbench" when it sent none), its origin in
  monospace, "Paired <relative time>", and an **Unpair** text button that asks
  first in the same popover as Revoke. A token with no pairings shows nothing extra.
- **First run.** With no tokens, the composer is already open and is the
  whole category: no New button, no meter, no Cancel, and no empty-list
  card, so the one thing on screen is the form. It does not take focus on
  load. Under it a single quiet line points readers who want to connect an AI
  tool at the Connect an AI Tool guide, since that flow creates its own token.
  Once a token exists the overview's meter and New button take over.

"Edit" is exactly what the API supports: create and revoke. There is no rename
or scope change; a token is replaced by creating a new one and revoking the old.

**Links to it open the dialog, never navigate.** Everything in the app that
points at tokens opens Settings on the API Tokens category in place: the
timeline's token cards and their **Open API Tokens** menu verb ([Timeline](../013-workspace/timeline.md)).
Mail, which cannot open a dialog, links at the `?settings=tokens` deep link
(`/explorer?settings=tokens`), which opens the Explorer with Settings on the
category.

**Guests** see the category with the manager replaced by
"Sign in to create API tokens." and a **Sign In** link (see the Settings
sign-in rule in [User preferences](../007-editor/user-preferences.md)).

Behind it, a new `GET/POST/DELETE /api/tokens` surface, **gated exactly like
the team routes** ([Teams](../013-workspace/teams.md)): it requires a verified account
identity and rejects a guest (a guest token) caller outright (`401`/`403`,
mirroring `routes/teams.ts`) — so the manager is inert for guests, the
same way the rest of the signed-in surface is. A token can only ever be minted
by, and act as, a signed-in account. Creation returns the secret **once**
(shown in the manager to copy, never retrievable again); the row then shows only
the public id + metadata. Revoke is immediate (the lookup filters
`revoked = 0`). The category states the fixed 6-month expiry ([§3.2](#32-storage-d1))
so rotation isn't a surprise.

**Per-account cap: 10.** A `POST /api/tokens` is refused (`409`) once the owner
already has 10 live (non-revoked, non-expired) tokens — enough for any real
integration set, low enough to keep the list + table tidy. Revoking or letting
one expire frees a slot. The count is part of the INSERT itself (one
`INSERT ... SELECT ... WHERE (SELECT COUNT(*) ...) < 10` statement in
`apps/api/src/db/api-tokens.ts`), so concurrent mints, from the Explorer and
the OAuth exchange alike, can never take an account past 10; a refused mint
logs `[api-tokens] mint refused: owner at the token cap` and answers `409
token_limit_reached`.

**Account deletion removes them.** Deleting an account erases ALL of that
user's data, tokens included: the tokens are the liveworkspace account's, and closing the account there deletes
them, so no credential outlives the account. livediagram keeps no copy; their workbench pairings and sessions, which hang
off their tokens, are liveworkspace's and close with the account there.

### 3.6a A token's view of itself

A token may read and revoke **itself**, which escalates nothing, so the [CLI](cli.md) can show who it is and sign
out cleanly:

- `GET /api/tokens/current`: the account id and display name, the token's name, its role and `expiresAt`.
- `DELETE /api/tokens/current`: revokes the presenting token (204).
- A session or guest has no token to describe and is refused `403 not_a_token`; a revoked token is refused at the
  front door like any dead token (§3.3).

Every other `/api/tokens` route answers `410 tokens_moved` (see the head of §3).

### 3.7 Without optional services

API tokens come with sign-in, as teams do ([Teams](../013-workspace/teams.md),
[Auth + guest access](../014-identity/auth-and-guest-access.md)). Every build offers sign-in, so:

- **Frontend** — the Settings API Tokens category always shows; to a guest its row says why it is
  empty and links to sign in.
- **Backend** — the `/api/tokens` routes require a verified account identity, and
  with `ACCOUNTS_URL` or `API_RESOURCE` unset the worker resolves no account identity at all
  ([`auth/accounts.ts`](../../../apps/api/src/auth/accounts.ts) returns null), so the
  routes reject every caller: token creation and use are impossible without an accounts Worker.

No new dependency beyond the sign-in that teams already need.

<!-- legacy-names -->

### 3.8 Deprecated diagram routes

The container was called a diagram before it became a document ([Document](../006-document/document.md)). The public routes moved from `/api/diagrams…` to `/api/documents…`; the old paths stay served until **30 April 2027** so scripts written against them keep working (`apps/api/src/legacy-documents-alias.ts`):

- A request to `/api/diagrams…` is moved to the same path under `/api/documents…` before anything else runs, so authentication and rate limits apply to it exactly as to the current route.
- The request body's keys `diagram`, `diagrams`, `diagramId`, `diagramName`, `diagramTeamId` and `diagramOwnerId` are renamed to their `document` forms; the response's keys are renamed back, at any depth. Values are never touched.
- Element links cross in both directions: an old `{ kind: 'diagram', diagramId }` link in a request is
  upgraded before the keys are renamed (`upgradeLegacyLinks`), and a response hands back the old
  form (`downgradeLinks`), so neither side ever sees a half-renamed link.
- An old client's `X-Diagram-Conversion` header travels on as `X-Document-Conversion`, and the
  `document_trashed` error code goes back as `diagram_trashed`.
- A body declared over the 8 MiB cap is refused with 413 before it is read, and the rewritten request
  carries its own `Content-Length`, so the size gate behind the alias still applies.
- Every aliased response carries `Deprecation: true`, `Sunset: Fri, 30 Apr 2027 00:00:00 GMT` and `Link: </api/documents>; rel="successor-version"`, and each call logs `[legacy-documents-alias] <method> <path>`, so the alias's remaining traffic is visible before it is removed.
- A WebSocket upgrade on the old path passes through unchanged.

Outside `/api/diagrams…` the paths never changed, so nothing marks a request as coming from an old
client. Those routes accept the old **request** forms until the sunset (`apps/api/src/legacy-request-forms.ts`):
the timeline's `scope=diagram:<id>`, and a `diagramId` in the team notification bodies. Their
**responses** use the new names only (`document` in `/share/{code}` and `/trash/{id}/restore`, the
`document_*` timeline types): repeating a whole document under two keys would double the largest
payloads.

After the sunset the alias module and this section go; `/api/diagrams…` then answers 404 like any unknown route.
<!-- /legacy-names -->

## 4. Guest identity: a verified guest token

A guest is liveworkspace's guest ([Auth + guest access](../014-identity/auth-and-guest-access.md#guest-identity)):
a year-long guest token minted by the liveworkspace accounts site, whose id is
`guest_<uuid>`, the same in every liveworkspace app. The editor sends it as
`Authorization: Bearer <guest token>`, exactly as it sends an account's access
token, and the api verifies both with `createPersonVerifier` from
`@liveworkspace/auth-client` (`apps/api/src/auth/accounts.ts`): a local
signature check against the accounts Worker's published keys, its issuer and
this API's own audience, answering the kind (`account` or `guest`) and the id.

That closes the [§2](#2-why-the-api-wasnt-safe-to-expose-as-is-history)
escalation at its root. The only things that say who is asking are tokens the
accounts site signed: an account's access token, a guest token, an API token
([§3](#3-design-api-tokens)) or a workbench session minted from one. A guest
token is held in one browser's `localStorage` and never appears in a DTO, a
presence frame or a URL.

**Guarantee for signed-up users.** An account's documents are reachable only
through a verified account credential (its access token, an API token, or a
workbench session). Nothing a guest or a stranger can send names an account.

**Without the accounts site.** Guest tokens come from the accounts site. A deployment
without it (`ACCOUNTS_*` unset) has no guest identity at all: visitors cannot
own documents on the server ([Deployment](../016-platform/deployment.md)).

### 4.1 An owner id is never a credential

Owner ids are handed out on purpose in places: `GET /api/teams/<id>` lists
`members[].userId` to every member of the team, invitees included. That is
safe because no request can present an owner id as its identity. The worker
reads the owner only from a verified token, so an id harvested from a roster,
a log or an old document DTO lets a caller do nothing as its owner.

The realtime room follows the same rule: its upgrade admits only a one-time
room ticket, minted over authenticated REST, or a share code, so an owner or
team member joins through the ticket and no owner id rides the URL.

The api still keeps owner ids out of what a reader sees
(`redactDocumentForReader`, [Auth + guest access](../014-identity/auth-and-guest-access.md#hybrid-identity)).
A guest's id is the same in every liveworkspace app, so showing it would tie
a document to that guest everywhere else. `GET /api/share/<code>` never
returns the document's primary `shareCode`, to anyone: the visitor already
holds the code they arrived with.

The **team**-document half of the same escalation is closed structurally as
well, by `ownsDocument` ([Team shared documents §Access](../013-workspace/team-shared-documents.md)).

## 5. Input validation (prerequisite — shipped)

Opening the API magnifies the cost of weak input handling, so the validation
hardening landed first:

- **Structural schema validation** — `isValidElement` / `isValidTab`
  (`packages/document/src/validate.ts`) vet the element/tab discriminant,
  required fields, endpoints, array bounds + unique ids. The document routes run
  incoming tabs (create-seed + tab PUT) through `isValidTab` and reject
  malformed trees with `400`.
- **Size caps** — a global Content-Length body cap, per-tab byte cap, and
  name / participant / share-password caps
  (`apps/api/src/limits.ts`); a per-frame cap in the realtime room. Document
  and tab names are shortened to the 60-character name cap rather than
  rejected (`apps/api/src/names.ts`, [Tab and document name length](../006-document/name-length.md)).
- **Already solid** (pre-existing): every SQL statement is parameterized; session JWT
  verification; share-link expiry + constant-time password compare + per-IP
  brute-force limiter; WS-upgrade auth; realtime role re-stamping + op-rate cap.

## 6. Rollout

1. ✅ Input hardening (done).
2. ✅ **A verified guest identity ([§4](#4-guest-identity-a-verified-guest-token)).**
   Pulled to the FRONT: it closed the cross-object escalation in
   [§2](#2-why-the-api-wasnt-safe-to-expose-as-is-history) and
   is independent of the token work, so it ships first. **Stop emitting the raw owner id where a collaborator can read it**
   (do this, not just "consider" — shrinking the attack surface is worth it
   even though §4 already makes a leaked id worthless, because people WILL probe
   for it):
   - Redact `participantId` in the change-log read for non-owners (the static
     harvest; moot since the change log was removed on 2026-10-03), the same way comment authors and the document `ownerId` already
     are.
   - Give each realtime session a **room-scoped ephemeral presence id**
     (random per connection) for the broadcast presence / cursor frames,
     decoupled from the real owner id. Cursor identity + dedup within the room
     use the ephemeral id; the server keeps the real→ephemeral mapping
     internally for its role/identity checks but never broadcasts the owner id.
     This removes the last surface that exposed it.

     One thing the ephemeral id cannot do, learned the hard way: **join a peer
     to something saved in the document.** It changes on every socket, so any
     feature that records an answer per person and then matches it back to the
     roster needs a second, stable id. That is `ParticipantPresence.key`, the
     collab key — see [Per-participant responses](../012-collaboration/participant-responses.md), which also
     explains why the owner id can't be it and why leaving the key claimable
     costs nothing.
3. ✅ API tokens (`expires_at` fixed to +6 months), kept by liveworkspace accounts and
   checked here (`db/api-tokens.ts`), signed-in-only `/api/tokens` routes (the team-route
   gate, [Teams](../013-workspace/teams.md)).
4. ✅ The **Settings API Tokens category** (`SettingsTokensRow`) — the management
   UI ([§3.6](#36-management--the-settings-dialogs-api-tokens-category)); it
   replaced the original Explorer "API tokens" page ([§3.7](#37-without-optional-services)).
5. ✅ Wire token resolution into `resolveOwner`; enforce the read-only flag
   ([§3.4](#34-access--full-read--write-with-an-optional-read-only-flag)).
6. ✅ **Docs + help, shipped WITH the feature** (help articles describe live
   features and must be registered — see the help-centre rule in `AGENTS.md`,
   so this copy lands when the feature does, not before):
   - A new help article (e.g. `account-and-data/api-tokens`) covering what
     tokens are, creating/revoking them **from the Explorer**, the **6-month
     expiry + manual rotation**, and the **signed-in-only** limitation —
     registered in `apps/help/lib/articles.ts`.
   - Add API tokens to the "what signing in unlocks" list in the
     `account-and-data/signing-in` article (next to teams + cross-device sync).
   - `docs/` updates: note the new `/api/tokens` surface + its account
     requirement in `docs/development/architecture.md`, and the signed-in-only nature in
     `docs/specs/016-platform/deployment.md` (tokens need sign-in, like teams).
   - ✅ Public API reference for the existing routes. Two layers, both
     shipped: the machine-readable `GET /api/openapi.json`
     ([API documentation (OpenAPI)](api-documentation.md)), and a human-facing **Developers**
     category in the help centre ([Help app](../018-help/help-app.md)) whose API
     reference links out to it. The `account-and-data/api-tokens` article
     cross-links the reference as the next step after minting a token.

## 7. Out of scope (for now)

Finer-grained scopes — per-document / per-folder grants, per-verb permissions —
plus webhooks and any billing or quota tiers (the product has no paid tier —
[Open source + distribution](../002-project-scope/open-source-and-business-model.md)). (The one scope that DID land is
the **read-only** flag, [§3.4](#34-access--full-read--write-with-an-optional-read-only-flag);
OAuth / third-party app authorization landed in [MCP server](mcp-server.md).)
Every full token inherits the owner's read+write access; finer grants come
later if demand appears.
