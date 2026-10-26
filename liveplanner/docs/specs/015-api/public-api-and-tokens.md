# Public API and API tokens

API tokens (§3) let external, programmatic callers use the REST API, and every input is validated (§5). There is no
guest header (§4): a guest is a liveworkspace guest token, checked like an account's
([Auth + guest access](../014-identity/auth-and-guest-access.md)). API tokens themselves are minted, stored and
revoked by liveworkspace's accounts service ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md));
this app resolves them and enforces what they allow.

## 1. Goal

Let **signed-in** people call the liveplanner API from their own scripts /
integrations with a long-lived **API token**, not just from the first-party web
app. Read their projects, create/update them, manage folders — the same surface
the app uses, under an explicit, revocable credential.

**Signed-in only (gated like teams, [Teams](../013-workspace/teams.md)).** API tokens are an
advanced, opt-in feature for users with an account; the canvas, guests, and the
share/realtime flows are unaffected and stay account-free ([Auth + guest access](../014-identity/auth-and-guest-access.md)).
A token always acts as a signed-in account; there are **no guest-owned tokens**. This
is a deliberate constraint: programmatic API
use is a power-user need, requiring an account for it is reasonable, and a
token never stands for a guest ([§4](#4-no-guest-header)).

This must not weaken the friction-free guest model ([Auth + guest access](../014-identity/auth-and-guest-access.md))
or the degrade-never-break rule ([Business model + licence](../002-project-scope/business-model-and-licence.md)).

## 2. Trust boundaries

- **No guest header.** Every caller is a verified token (an account's, a guest's, an API token or a workbench
  session) or a link visitor with a share code. No header names an owner, and there is no `POST /api/guest-id` or
  `POST /api/migrate` ([§4](#4-no-guest-header)).
- **Access is the index's grant.** Who may open a plan is decided by liveworkspace's index and carried as a
  short-lived grant; an API token's request gets one fetched for it as its account ([API app](api.md) "Access").
- **The WS upgrade takes only a ticket**: the grant, as `?t=` ([API app](api.md) "Realtime model"). No owner id,
  share code or password rides the upgrade URL.
- **Presence carries no owner id.** The room mints a random presence id per socket and builds each presence entry
  itself (`helloPresence`, `project-room-rules.ts`); a client never supplies or learns one.
- **External callers have a real credential**: API tokens ([§3](#3-design-api-tokens)).

## 3. Design: API tokens

**API tokens belong to the liveworkspace account** ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md)
"API tokens"). They are made, listed and revoked on liveworkspace.app, and one token works on every app's API and
MCP server. liveworkspace holds the hash, the name, the read-only flag, the 6-month expiry and the cap (20 per
account). What follows records how liveplanner uses them; where it describes liveplanner minting, listing or
storing tokens itself, the account-level design below supersedes it.

- **Verifying.** An `lwt_` bearer is checked with liveworkspace (`POST /api/account/internal/tokens/verify`,
  client-credentials) by `createTokenChecker` in `apps/api/src/db/api-tokens.ts`. A verified token is cached for
  a minute per isolate, so a burst of MCP tool calls costs one round trip a minute. A token
  liveworkspace refuses gets `401 invalid_token`; if liveworkspace can't be reached, `503 accounts_unavailable`
  with `Retry-After: 5`.
- **No copy.** liveplanner keeps no table of tokens. What hangs off one (workbench pairings and sessions) is
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
  `lwt_<base64url(32 random bytes)>`. The prefix also disambiguates it from a
  account access token (a JWT) in the same `Authorization: Bearer` header.
- Tokens carried over from the old livediagram.app keep their `lvd_` prefix (`docs/migration.md` step 1 at the
  monorepo root): liveworkspace holds them exactly as it holds `lwt_` ones, so every check here that reads the
  prefix (`isApiTokenFormat` and `hasApiTokenPrefix` from `@liveworkspace/api-kit`, re-exported by api-schema)
  takes `lvd_` beside `lwt_`: the api routes a `Bearer lvd_…` to the token path, and the CLI accepts one. Nothing
  mints `lvd_`.
- Shown **once** at creation; never retrievable again.
- Stored **hashed** (SHA-256), never in plaintext. Auth hashes the presented
  token and looks the hash up by its UNIQUE-indexed column — an indexed
  equality lookup, not a per-row compare: the hash derives from 256 bits of
  randomness, so there's no low-entropy value to time-attack (unlike a
  password) and the lookup leaks nothing useful.

### 3.2 Storage (liveworkspace accounts)

liveplanner stores no tokens and has no D1. The table is the liveworkspace accounts service's
([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md)); as first designed, its shape was:

```
api_tokens(
  id            TEXT PRIMARY KEY,     -- public token id (for listing / revoke)
  owner_id      TEXT NOT NULL,        -- the account userId this token acts as (never a guest id)
  token_hash    TEXT NOT NULL UNIQUE, -- SHA-256 of the secret
  name          TEXT,                 -- user label ("CI bot")
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER,
  expires_at    INTEGER NOT NULL,     -- created_at + 6 months; never null, never "forever"
  revoked       INTEGER NOT NULL DEFAULT 0
)
```

Indexed on `token_hash` (lookup) and `owner_id` (listing).

**Lifetime — fixed 6 months.** Every token expires at `created_at + 6 months`.
This is a hard maximum AND the only option: `expires_at` is **never null** (no
never-expires tokens) and there is no shorter / user-chosen value for now — a
long-lived credential that never lapses is the thing we don't want sitting in
someone's CI config forever. `expires_at` is therefore always set and always in
the future at creation; the lookup filters on it (`expires_at > now`) so an
expired token is rejected exactly like a revoked one. **Rotation is manual**:
mint a fresh token before the old one lapses. A configurable or shorter
lifetime can be added later if there's demand; six months is the ceiling
regardless.

### 3.3 Resolution

A token authenticates as a third identity path, resolved once in `fetch`
alongside the account access token + the guest header:

1. An account access token in `Authorization: Bearer`, when it verifies.
2. Else `Authorization: Bearer lwt_…` (or `lvd_…`, §3.1) → checked with liveworkspace (`resolveApiToken` in
   `apps/api/src/db/api-tokens.ts`, cached a minute per isolate) → the request's owner id is the token's account.
   (A token and a JWT can't both be the bearer.) An `lwt_`
   bearer liveworkspace does not accept (unknown, revoked or expired), or one too short to be a token at all (cut short or
   mistyped when pasted), is refused there and then with `401 invalid_token` and `WWW-Authenticate: Bearer
error="invalid_token"`, on every route: it never falls through to the guest
   path or to no owner, so a script holding a dead token is told so.
3. Else a workbench session (`lvw_…`), and else no identity: a link visitor. There is no guest header; a guest
   is a liveworkspace guest token, checked in step 1. Tokens never resolve to a guest id.

The resolved owner id flows through the **same** checks every route already enforces: the index's grant for a
plan, fetched for the token's account, so a token can only touch what its account can reach. No route changes for authorization; only the identity
source changes.

### 3.4 Access — full read + write, with an optional read-only flag

> **Specified, not built:** the read-only flag becomes a token level (view, participate or edit), one vocabulary with
> share links ([Share roles](../013-workspace/share-roles.md#api-tokens)). Read-only tokens become view tokens; the
> rest become edit tokens.

A token grants its owner's **full** access — read AND write, the same surface
the app has — **unless** it was minted **read-only** (the one scope that
exists): a `read_only` column that, when set, restricts the
token to `GET`/`HEAD`; the api worker rejects every write it presents at a
single dispatch choke point with `403 read_only_token`
([MCP server §4.11](mcp-server.md)). The same choke point refuses it the one read that is a
credential rather than content: `GET /api/projects/:id/share`, whose links and password would let it
open an edit link. Read-only tokens are minted through the MCP
consent screen (a "read-only access" checkbox), giving a cautious user a way to
let an AI tool VIEW their projects without granting edit. There is still no
finer-grained scope vocabulary (per-resource, per-verb); that remains deferred
([§7](#7-out-of-scope-for-now)) — `read_only` is a single boolean, not a general
scopes system.

**Team content counts as "the same surface".** A token's owner is always a
signed-in account ([§3.3](#33-resolution)), and both credentials — session JWT and
token — are server-verified, so the token identity feeds the same
team-membership checks the session does (`RouteContext.verifiedUserId`, used by
`gateRead`/`gateEdit` and the team-scoped project/folder verbs). Concretely: a
token can read and edit the projects in the shared libraries of the teams its
owner has joined ([Team shared projects](../013-workspace/team-shared-projects.md)), and can `GET` the
teams surface (list its teams, team detail, a team's library). Without this, a
project filed into a team was invisible to every external integration — the
personal `GET /projects` excludes team projects by design.

**Administration stays interactive-session-only.** Every teams MUTATION
(create, invite, role change, join/accept/leave, invite links, team deletion)
plus account deletion
require a verified signed-in **session** (`accountUserId`), never a token. Boundary
rationale: a leaked token already exposes the owner's content (that's §3.4's
deal, revocable + 6-month-capped), but it must not be able to escalate — mint
further credentials, grant other people membership, or destroy the account.

**Deleting goes to the Trash, with an explicit way past it.** A token's
`DELETE /api/projects/<id>` moves the project to the [Trash](../013-workspace/trash.md)
like every other delete; `DELETE /api/projects/<id>?permanent=true` deletes it
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

> **Superseded**: tokens are managed on liveworkspace.app (see the head of §3). This section records the manager liveplanner had.

Tokens are created, viewed and revoked in the **Settings dialog**
([User preferences](../007-editor/user-preferences.md)), in the **API Tokens**
sub-category of **Account** (id `tokens`, `parent: 'account'`, shown as
"Account › API Tokens"). It is account-scoped like its parent, and the dialog is reachable
from both the Explorer and the editor, so the tokens are too. There is no
Explorer page for them.

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

Minting, listing and revoking are liveworkspace's (the head of §3): this api has no `/api/tokens` routes beyond
`/api/tokens/current` ([§3.6a](#36a-a-tokens-view-of-itself)). A token can only ever be minted by, and act as, a
signed-in account, and the fixed 6-month expiry ([§3.2](#32-storage-liveworkspace-accounts)) is stated where tokens
are made, so rotation isn't a surprise.

**Per-account cap.** liveworkspace caps an account's live tokens (the head of §3) and refuses a mint past it,
the OAuth exchange's included.

**Account deletion removes them.** Tokens are the account's on liveworkspace and close with it, so no credential
outlives the account; `DELETE /api/account` ([`routes/account.ts`](../../../apps/api/src/routes/account.ts)) ends
the person's workbench pairings here.

### 3.6a A token's view of itself

A token may read and revoke **itself**, which escalates nothing, so the [CLI](cli.md) can show who it is and sign
out cleanly:

- `GET /api/tokens/current`: the account id and display name, the token's name, its role and `expiresAt`.
- `DELETE /api/tokens/current`: revokes the presenting token (204).
- A session or guest has no token to describe and is refused `403 not_a_token`; a revoked token is refused at the
  front door like any dead token (§3.3).

Every other `/api/tokens` path is a 404 (management is on liveworkspace.app; see the head of §3).

### 3.7 An api without sign-in

Sign-in is always offered in the editor ([Auth + guest access](../014-identity/auth-and-guest-access.md)), so the
Settings API Tokens category is always listed; a guest sees why it is empty and a Sign In link.

- **Backend** — a token is checked with the liveworkspace accounts Worker, and
  with `ACCOUNTS_URL` or `API_RESOURCE` unset the worker resolves no account identity at all
  ([`auth/accounts.ts`](../../../apps/api/src/auth/accounts.ts) returns null), so no token
  is accepted. Belt and suspenders: even if the UI were somehow
  reached, token creation / use is impossible without auth configured.

So enabling tokens is opt-in with auth, and disabling auth removes them
cleanly — no orphaned page, no half-working endpoint. This takes nothing away
from a guest-only deployment, because the whole canvas / guest model stays fully
available without an account ([Auth + guest access](../014-identity/auth-and-guest-access.md)). No new
dependency beyond the optional sign-in that teams already need.

## 4. No guest header

A guest's identity comes from liveworkspace as a signed guest token, the same in every app, sent as the Bearer and
verified exactly as an account's access token is ([Auth + guest access](../014-identity/auth-and-guest-access.md#guests)).
No request header carries an owner id, so a forged or harvested id is worth nothing without the token, and the token
never leaves the guest's own browser.

## 5. Input validation

Opening the API magnifies the cost of weak input handling, so the validation
hardening landed first:

- **Structural schema validation** — `isValidElement` / `isValidTab`
  (`packages/project/src/validate.ts`) vet the element/tab discriminant,
  required fields, endpoints, array bounds + unique ids. The project routes run
  incoming tabs (create-seed + tab PUT) through `isValidTab` and reject
  malformed trees with `400`.
- **Size caps** — a global Content-Length body cap, per-tab byte cap, and
  name / theme-definition / participant / share-password caps
  (`apps/api/src/limits.ts`); a per-frame cap in the realtime room. Project
  and tab names are shortened to the 60-character name cap rather than
  rejected (`apps/api/src/names.ts`, [Tab and project name length](../006-project/name-length.md)).
- **Throughout**: every SQL statement is parameterised; session JWT
  verification; share-link expiry + constant-time password compare + per-IP
  brute-force limiter; WS-upgrade auth; realtime role re-stamping + op-rate cap.

## 6. Presence ids

The raw owner id is never emitted where a collaborator can read it. Each realtime session gets a **room-scoped
ephemeral presence id**, minted by the room and never supplied by a client (`helloPresence`, `project-room-rules.ts`),
so a joiner cannot announce or impersonate another person's id. Features that match an answer back to a person use
the stable collab key (`ParticipantPresence.key`,
[Per-participant responses](../012-collaboration/participant-responses.md)).

## 7. Out of scope

Finer-grained scopes — per-project / per-folder grants, per-verb permissions —
plus webhooks and any billing or quota tiers (the product has no paid tier —
[Business model + licence](../002-project-scope/business-model-and-licence.md)). (The one scope there is is
the **read-only** flag, [§3.4](#34-access--full-read--write-with-an-optional-read-only-flag);
OAuth / third-party app authorization is in [MCP server](mcp-server.md).)
Every full token inherits the owner's read+write access; finer grants come
later if demand appears.
