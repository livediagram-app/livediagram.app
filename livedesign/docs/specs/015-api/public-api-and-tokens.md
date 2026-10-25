# Public API and API tokens

**Status: shipped.** Everything below is live on `main`: API tokens (§3),
who the API accepts and how a design's access is decided (§2, §4), and the
input validation (§5). This spec sequenced opening the REST API to external,
programmatic callers.

## 1. Goal

Let **signed-in** people call the livedesign API from their own scripts /
integrations with a long-lived **API token**, not just from the first-party web
app. Read their designs, create/update them, manage folders — the same surface
the app uses, under an explicit, revocable credential.

**Signed-in only (gated like teams, [Teams](../013-workspace/teams.md)).** API tokens are an
advanced, opt-in feature for users with an account; the canvas, guests, and the
share/realtime flows are unaffected and stay account-free ([Auth + guest access](../014-identity/auth-and-guest-access.md)).
A token always acts as a signed-in account; there are **no guest-owned tokens**. This
is a deliberate constraint, not a limitation to apologise for: programmatic API
use is a power-user need, requiring an account for it is reasonable, and it
keeps tokens apart from guests entirely (a guest is a liveworkspace guest with
its own token, [§4](#4-guests-and-grants)).

This must not weaken the friction-free guest model ([Auth + guest access](../014-identity/auth-and-guest-access.md))
or the optional-services rule ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)).

## 2. Who the API accepts

Opening the API to outside callers needs every identity it acts on to be a
credential the server verifies, never an id a caller merely names. So the api
takes no owner id from a header or a query string at all. A caller is one of
([Auth + guest access](../014-identity/auth-and-guest-access.md)):

- **An account**, by its access token in `Authorization: Bearer <jwt>` from the
  liveworkspace accounts Worker, verified (signature, exp, issuer, audience) in
  `apps/api/src/auth/accounts.ts`.
- **A guest**, by its liveworkspace guest token in the same header, verified the
  same way ([§4](#4-guests-and-grants)).
- **An API token** (`lwt_`, [§3](#3-design-api-tokens)), for external callers.
- **A link visitor**, with no identity: what it may do is only what its share
  link grants.

What each caller may do to one design is the index's grant on it, carried as
`X-Index-Grant` ([§4](#4-guests-and-grants)), never an id the request names.
Ids a collaborator can see are not credentials:

- **The WS upgrade takes a one-time room ticket** minted over authenticated REST
  (`t`, `routes/design-room-routes.ts`; [API app](api.md) "Realtime model"), so
  no owner id, share code or share password rides the upgrade URL.
- **Presence carries no owner id.** The room mints a random presence id per
  socket and builds each presence entry itself (`helloPresence`,
  `design-room-rules.ts`); a client never supplies or learns one.
- **An account id is never a guest's credential.** A signed-in editor with no
  access token refuses to send the request rather than going on as a guest
  (`SessionTokenUnavailableError`, `apps/live/lib/api/core.ts`).

## 3. Design: API tokens

**API tokens belong to the liveworkspace account** ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md)
"API tokens"). They are made, listed and revoked on liveworkspace.app, and one token works on every app's API and
MCP server. liveworkspace holds the hash, the name, the read-only flag, the 6-month expiry and the cap (20 per
account). What follows records how livedesign uses them; where it describes livedesign minting, listing or
storing tokens itself, the account-level design below supersedes it.

- **Verifying.** An `lwt_` bearer is checked with liveworkspace (`POST /api/account/internal/tokens/verify`,
  client-credentials) by `createTokenChecker` in `apps/api/src/db/api-tokens.ts`. A verified token is cached for
  a minute per isolate, so a burst of MCP tool calls costs one round trip a minute. A token
  liveworkspace refuses gets `401 invalid_token`; if liveworkspace can't be reached, `503 accounts_unavailable`
  with `Retry-After: 5`.
- **No copy.** livedesign keeps no table of tokens. What hangs off one (workbench pairings and sessions) is
  liveworkspace's too, which reads the token's state at each mint and session check and ends what was paired through
  it when it is revoked ([liveworkspace/docs/workbench.md](../../../../liveworkspace/docs/workbench.md) "Ending access"). `GET /api/tokens/current` answers from the verify response.
- **Minting for an AI tool.** The OAuth exchange (`POST /api/oauth/exchange`) asks liveworkspace to mint the
  token with the person's access token (`POST /api/account/internal/tokens`). A token the MCP then refuses is
  revoked by presenting it to `DELETE /api/tokens/current`.
- **Management** is on liveworkspace.app; this app has no routes for listing, minting or revoking tokens. The Settings dialog's API Tokens row links to liveworkspace.app and
  lists the account's paired workbenches with Unpair.
- **Self-revoke.** `DELETE /api/tokens/current` revokes the presenting token on liveworkspace
  (`POST /api/account/internal/tokens/revoke`) and ends its pairings here.
- **Expiry reminders** are not sent: liveworkspace sends none yet.

### 3.1 Token format

- An opaque secret with a visible prefix for greppability + leak-scanning:
  `lwt_<base64url(32 random bytes)>`. The prefix also disambiguates it from an
  account access token (a JWT) in the same `Authorization: Bearer` header.
- Tokens carried over from the old livediagram.app keep their `lvd_` prefix (`docs/migration.md` step 1 at the
  monorepo root): liveworkspace holds them exactly as it holds `lwt_` ones, so every check here that reads the
  prefix (`isApiTokenFormat` and `hasApiTokenPrefix` from `@liveworkspace/api-kit`, re-exported by api-schema)
  takes `lvd_` beside `lwt_`: the api routes a `Bearer lvd_…` to the token path, and the CLI accepts one. Nothing
  mints `lvd_`.
- Shown **once** at creation, on liveworkspace.app; never retrievable again.
- Stored **hashed** by liveworkspace's accounts service, never in plaintext.

### 3.2 Storage

livedesign stores no tokens. liveworkspace's accounts service keeps each one (its hash, name, read-only flag,
expiry and the per-account cap), as the head of §3 says.

**Lifetime — fixed 6 months.** Every token expires six months after it is made. There are no never-expires tokens
and no shorter, user-chosen lifetime: a long-lived credential that never lapses is the thing we don't want sitting
in someone's CI config forever. An expired token is refused exactly like a revoked one. **Rotation is manual**:
mint a fresh token before the old one lapses.

### 3.3 Resolution

A token authenticates as a third identity path, resolved once in `fetch`
alongside the account access token + the guest token:

1. An account access token in `Authorization: Bearer`, when it verifies.
2. Else `Authorization: Bearer lwt_…` (or `lvd_…`, §3.1) → checked with liveworkspace (cached for a minute per isolate, `apps/api/src/db/api-tokens.ts`)
   → the request's owner is the token's account. (A token and a JWT can't both be the bearer.) An `lwt_`
   bearer liveworkspace refuses (unknown, revoked or expired), or one too short to be a token at all (cut short or
   mistyped when pasted), is refused there and then with `401 invalid_token` and `WWW-Authenticate: Bearer
error="invalid_token"`, on every route: it never falls through to the guest
   path or to no owner, so a script holding a dead token is told so.
3. Else a liveworkspace guest token in the same header (see
   [§4](#4-guests-and-grants)). Tokens never resolve to a guest id, so this path
   is for the first-party app only; it grants no token.

The resolved owner flows through the **same** `gateRead` / `gateEdit` checks, on the index's grant, that every
route already enforces, so a token can only touch what its account can. No route changes for authorization; only
the identity source changes.

### 3.4 Access — full read + write, with an optional read-only flag

> **Specified, not built:** the read-only flag becomes a token level (view, participate or edit), one vocabulary with
> share links ([Share roles](../013-workspace/share-roles.md#api-tokens)). Read-only tokens become view tokens; the
> rest become edit tokens.

A token grants its owner's **full** access — read AND write, the same surface
the app has — **unless** it was minted **read-only** (the one scope that
exists): a read-only flag on the token that, when set, restricts the
token to `GET`/`HEAD`; the api worker rejects every write it presents at a
single dispatch choke point with `403 read_only_token`
([MCP server §4.11](mcp-server.md)). The same choke point refuses it the one read that is a
credential rather than content: `GET /api/designs/:id/share`, whose links and password would let it
open an edit link. Read-only tokens are minted through the MCP
consent screen (a "read-only access" checkbox), giving a cautious user a way to
let an AI tool VIEW their designs without granting edit. There is still no
finer-grained scope vocabulary (per-resource, per-verb); that remains deferred
([§7](#7-out-of-scope-for-now)) — `read_only` is a single boolean, not a general
scopes system.

**Team content counts as "the same surface".** A token's owner is always a
signed-in account ([§3.3](#33-resolution)), and both credentials — session JWT and
token — are server-verified, so the token identity feeds the same
team-membership checks the session does (`RouteContext.verifiedUserId`, used by
`gateRead`/`gateEdit` and the team-scoped design/folder verbs). Concretely: a
token can read and edit the designs in the shared libraries of the teams its
owner has joined ([Team shared designs](../013-workspace/team-shared-designs.md)), and can `GET` the
teams surface (list its teams, team detail, a team's library). Without this, a
design filed into a team was invisible to every external integration — the
personal `GET /designs` excludes team designs by design.

**Administration stays interactive-session-only.** Every teams MUTATION
(create, invite, role change, join/accept/leave, invite links, team deletion)
plus token management (on liveworkspace.app) and account deletion
require a verified signed-in **session** (`accountUserId`), never a token. Boundary
rationale: a leaked token already exposes the owner's content (that's §3.4's
deal, revocable + 6-month-capped), but it must not be able to escalate — mint
further credentials, grant other people membership, or destroy the account.

**Deleting goes to the Trash, with an explicit way past it.** A token's
`DELETE /api/designs/<id>` moves the design to the [Trash](../013-workspace/trash.md)
like every other delete; `DELETE /api/designs/<id>?permanent=true` deletes it
for good at once (and purges one already in the Trash). The Trash routes
(`GET /api/trash`, `POST /api/trash/<id>/restore`, `DELETE /api/trash/<id>`)
are token-usable with the same delete authority; a read-only token may list the
Trash but not restore or purge. The MCP server, by contrast, offers no permanent
delete at all ([MCP server §4.9](mcp-server.md)).

### 3.5 Rate limiting

Key the existing `WRITE_RATE_LIMITER` on the token id (not just the owner) so a
runaway integration is throttled independently of the owner's interactive app
use, and add a read limiter for token reads. Per-IP limits stay as the outer
backstop.

### 3.6 Management — the Settings dialog's API Tokens category

> **Superseded**: tokens are managed on liveworkspace.app (see the head of §3). This section records the manager livedesign had.

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
AI Tools category's **Manage API Tokens** link row (which replaced the old
read-only token list there), and the timeline's token cards and their
**Open API Tokens** menu verb ([Timeline](../013-workspace/timeline.md)).
Mail, which cannot open a dialog, links at the `?settings=tokens` deep link
(`/explorer?settings=tokens`), which opens the Explorer with Settings on the
category.

**Guests** see the category with the manager replaced by
"Sign in to create API tokens." and a **Sign In** link (see the Settings
sign-in rule in [User preferences](../007-editor/user-preferences.md)).

Behind it, a new `GET/POST/DELETE /api/tokens` surface, **gated exactly like
the team routes** ([Teams](../013-workspace/teams.md)): it requires a verified account
identity and rejects a guest (guest-token) caller outright (`401`/`403`,
mirroring `routes/teams.ts`) — so the manager is inert for guests, the
same way the rest of the signed-in surface is. A token can only ever be minted
by, and act as, a signed-in account. Creation returns the secret **once**
(shown in the manager to copy, never retrievable again); the row then shows only
the public id + metadata. Revoke is immediate (the lookup filters
`revoked = 0`). The category states the fixed 6-month expiry ([§3.2](#32-storage))
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
user's data, tokens included: `DELETE /api/account` ([`routes/account.ts`](../../../apps/api/src/routes/account.ts))
must delete the owner's `api_tokens` rows in the same cascade as their designs
/ folders / themes, so no credential outlives the account.

### 3.6a A token's view of itself

A token may read and revoke **itself**, which escalates nothing, so the [CLI](cli.md) can show who it is and sign
out cleanly:

- `GET /api/tokens/current`: the account id and display name, the token's name, its role and `expiresAt`.
- `DELETE /api/tokens/current`: revokes the presenting token (204).
- A session or guest has no token to describe and is refused `403 not_a_token`; a revoked token is refused at the
  front door like any dead token (§3.3).

Every other `/api/tokens` path is a 404 (management is on liveworkspace.app; see the head of §3).

### 3.7 Without sign-in

API tokens are gated on **auth being enabled**, exactly as teams and sign-in
are ([Teams](../013-workspace/teams.md), [Auth + guest access](../014-identity/auth-and-guest-access.md)). A
deployment that hasn't configured sign-in runs in pure-guest mode, and in that
mode the feature is **absent end to end** — there is no API Tokens category to
open and no way to mint one:

- **Frontend** — the live app always offers sign-in, so the Settings API Tokens
  category is listed; for a guest it says why it is empty and links to sign in,
  and signing in there settles as a guest again.
- **Backend** — the `/api/tokens` routes require a verified account identity, and
  with `ACCOUNTS_URL` or `API_RESOURCE` unset the worker resolves no account identity at all
  ([`auth/accounts.ts`](../../../apps/api/src/auth/accounts.ts) returns null), so the
  routes reject every caller. Belt and suspenders: even if the UI were somehow
  reached, token creation / use is impossible without auth configured.

So enabling tokens is opt-in with auth, and disabling auth removes them
cleanly — no orphaned page, no half-working endpoint. This takes nothing away
from a guest-only deployment, because the whole canvas / guest model stays fully
available without an account ([Auth + guest access](../014-identity/auth-and-guest-access.md)). No new
dependency beyond the optional sign-in that teams already need.

## 4. Guests and grants

**A guest is a liveworkspace guest** ([Auth + guest access](../014-identity/auth-and-guest-access.md)
"Hybrid identity"; liveworkspace/docs/accounts.md "Guests"). The editor fetches
a year-long guest token from the accounts site through the api's
`GET /api/auth/guest` handoff, keeps it in `localStorage` under
`livedesign:v2:guest-token`, and sends it as `Authorization: Bearer`, exactly
like an account's access token. The api verifies it locally against the
accounts Worker's published keys and this API's audience, so a guest's identity
is as hard to forge as an account's, and nothing a collaborator can read (a
`guest_…` id, an account `sub`) acts as either.

**Every request about one design carries the index's grant on it.** Designs live
on the liveworkspace index (place, sharing, Trash), with each design's content in
its own Durable Object ([API app](api.md)). The index answers who may do what to
a design as a ten-minute grant naming the design, the level and the tab
(liveworkspace/docs/one-explorer-contracts.md "Grants"). The editor holds it,
renews it a minute before it lapses, and sends it as `X-Index-Grant`
(`apps/live/lib/api/design-grants.ts`); the api checks it offline, or fetches one
for the caller when none was sent (`apps/api/src/routes/design-grant.ts`). The
grant is the whole of what a caller may do to a design: an account, a guest, an
API token's account and a link visitor are all held to it.

**A guest who signs up keeps what they made.** The accounts site merges the
guest into the account, and the index tells each app
(`POST /api/internal/people/:guest/merge`). The guest's designs are index items,
so they move with the index; livedesign moves the guest's images in the media
service to the account.

## 5. Input validation (prerequisite — shipped)

Opening the API magnifies the cost of weak input handling, so the validation
hardening landed first:

- **Structural schema validation** — `isValidElement` / `isValidTab`
  (`packages/design/src/validate.ts`) vet the element/tab discriminant,
  required fields, endpoints, array bounds + unique ids. The design routes run
  incoming tabs (create-seed + tab PUT) through `isValidTab` and reject
  malformed trees with `400`.
- **Size caps** — a global Content-Length body cap, per-tab byte cap, and
  name / theme-definition / participant / share-password caps
  (`apps/api/src/limits.ts`); a per-frame cap in the realtime room. Design
  and tab names are shortened to the 60-character name cap rather than
  rejected (`apps/api/src/names.ts`, [Tab and design name length](../006-design/name-length.md)).
- **Already solid** (pre-existing): every SQL statement is parameterized; session JWT
  verification; share-link expiry + constant-time password compare + per-IP
  brute-force limiter; WS-upgrade auth; realtime role re-stamping + op-rate cap.

## 6. Rollout

1. ✅ Input hardening (done).
2. ✅ **Verified identities only ([§2](#2-who-the-api-accepts), [§4](#4-guests-and-grants)).**
   Guests are liveworkspace guests with their own token, every design request
   is decided by the index's grant, and no raw owner id reaches a collaborator:
   the realtime room gives each socket a random presence id and the change log
   that once listed participant ids is gone.

3. ✅ `api_tokens` table + migration (`expires_at` fixed to +6 months) + token
   mint/verify (`auth/`), signed-in-only `/api/tokens` routes (the team-route
   gate, [Teams](../013-workspace/teams.md)).
4. ✅ The **Settings API Tokens category** (`SettingsTokensRow`) — the management
   UI ([§3.6](#36-management--the-settings-dialogs-api-tokens-category)); it
   replaced the original Explorer "API tokens" page
   ([§3.7](#37-without-sign-in)).
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
     requirement in `docs/development/architecture.md` (tokens need sign-in, like teams).
   - ✅ Public API reference for the existing routes. Two layers, both
     shipped: the machine-readable `GET /api/openapi.json`
     ([API documentation (OpenAPI)](api-documentation.md)), and a human-facing **Developers**
     category in the help centre ([Help app](../018-help/help-app.md)) whose API
     reference links out to it. The `account-and-data/api-tokens` article
     cross-links the reference as the next step after minting a token.

## 7. Out of scope (for now)

Finer-grained scopes — per-design / per-folder grants, per-verb permissions —
plus webhooks and any billing or quota tiers (the product has no paid tier —
[Open source + distribution](../002-project-scope/open-source-and-business-model.md)). (The one scope that DID land is
the **read-only** flag, [§3.4](#34-access--full-read--write-with-an-optional-read-only-flag);
OAuth / third-party app authorization landed in [MCP server](mcp-server.md).)
Every full token inherits the owner's read+write access; finer grants come
later if demand appears.
