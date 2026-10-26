# Public API and API tokens

This spec covers how the livedocuments REST API is opened to external, programmatic callers: API tokens (§3), the
trust model they sit in (§2) and the input validation every caller passes (§4). A guest is a liveworkspace guest token,
checked like an account's ([Auth + guest access](../014-identity/auth-and-guest-access.md)).

## 1. Goal

Let **signed-in** people call the livedocuments API from their own scripts /
integrations with a long-lived **API token**, not just from the first-party web
app. Read their documents, create/update them, manage folders — the same surface
the app uses, under an explicit, revocable credential.

**Signed-in only (gated like teams, [Teams](../013-workspace/teams.md)).** API tokens are an
advanced, opt-in feature for users with an account; the canvas, guests, and the
share/realtime flows are unaffected and stay account-free ([Auth + guest access](../014-identity/auth-and-guest-access.md)).
A token always acts as a signed-in account; there are **no guest-owned tokens**. This
is a deliberate constraint, not a limitation to apologise for: programmatic API
use is a power-user need, requiring an account for it is reasonable, and it
keeps tokens apart from guest identity entirely.

This must not weaken the friction-free guest model ([Auth + guest access](../014-identity/auth-and-guest-access.md))
or the no-required-SaaS rule ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)).

## 2. Trust model

- **Every caller is verified.** A caller is a verified token (an account's, a guest's, an API token or a workbench
  session) or a link visitor with a share code. No header names an owner: a guest's identity is a signed liveworkspace
  guest token, the same in every app, sent as the Bearer and verified exactly as an account's access token is
  ([Auth + guest access](../014-identity/auth-and-guest-access.md#guests)), so a harvested id is worth nothing.
- **Access is the index's grant.** Who may open a document is decided by liveworkspace's index and carried as a
  short-lived grant; an API token's request gets one fetched for it as its account ([API app](api.md) "Access").
- **The WS upgrade takes only a ticket**: the grant, as `?t=` ([API app](api.md) "Realtime model"). No owner id,
  share code or password rides the upgrade URL.
- **Presence carries no owner id.** The room mints a random presence id per socket and builds each presence entry
  itself (`helloPresence`, `document-room-rules.ts`); a client never supplies or learns one.
- **External callers have a real credential**: API tokens ([§3](#3-design-api-tokens)).

## 3. Design: API tokens

**API tokens belong to the liveworkspace account** ([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md)
"API tokens"). They are made, listed and revoked on liveworkspace.app, and one token works on every app's API and
MCP server. liveworkspace holds the hash, the name, the read-only flag, the 6-month expiry and the cap (20 per
account). What follows is how livedocuments uses them.

- **Verifying.** An `lwt_` bearer is checked with liveworkspace (`POST /api/account/internal/tokens/verify`,
  client-credentials) by `createTokenChecker` in `apps/api/src/db/api-tokens.ts`. A verified token is cached for
  a minute per isolate, so a burst of MCP tool calls costs one round trip a minute. A token
  liveworkspace refuses gets `401 invalid_token`; if liveworkspace can't be reached, `503 accounts_unavailable`
  with `Retry-After: 5`.
- **No copy.** livedocuments keeps no table of tokens. What hangs off one (workbench pairings and sessions) is
  liveworkspace's too, which reads the token's state at each mint and session check and ends what was paired through
  it when it is revoked ([liveworkspace/docs/specs/011-workbench/workbench.md](../../../../liveworkspace/docs/specs/011-workbench/workbench.md) "Ending access"). `GET /api/tokens/current` answers from the verify response.
- **Minting for an AI tool.** The OAuth exchange (`POST /api/oauth/exchange`) asks liveworkspace to mint the
  token with the person's access token (`POST /api/account/internal/tokens`). A token the MCP then refuses is
  revoked by presenting it to `DELETE /api/tokens/current`.
- **Management** is on liveworkspace.app; this app has no routes for listing, minting or revoking tokens. The Settings dialog's API Tokens row links to liveworkspace.app and
  lists the account's paired workbenches with Unpair.
- **Self-revoke.** `DELETE /api/tokens/current` revokes the presenting token on liveworkspace
  (`POST /api/account/internal/tokens/revoke`) and ends its pairings here.
- **Expiry reminders** are liveworkspace's: a week before a token expires, its owner gets one email from the
  accounts Worker's daily run ([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md)).
  livedocuments sends none and shows none on the Timeline.

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
- Stored **hashed** (SHA-256) by liveworkspace, never in plaintext, and looked up there by the hash: the hash
  derives from 256 bits of randomness, so there's no low-entropy value to time-attack (unlike a password) and the
  lookup leaks nothing useful. livedocuments never stores the secret or its hash.

### 3.2 Storage

livedocuments stores no token and has no database to store one in. liveworkspace keeps each token (its hash, owner,
name, read-only flag, expiry and last use) with the account ([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md)
"API tokens"). What hangs off a token, a workbench pairing or session, is liveworkspace's too, which ends it with the token
([Workbench embeds](../013-workspace/workbench-embeds.md)).

**Lifetime — fixed 6 months.** Every token expires at `created_at + 6 months`.
This is a hard maximum AND the only option: `expires_at` is **never null** (no
never-expires tokens) and there is no shorter or user-chosen value: a
long-lived credential that never lapses is the thing we don't want sitting in
someone's CI config forever. `expires_at` is therefore always set and always in
the future at creation, and liveworkspace refuses an
expired token exactly like a revoked one. **Rotation is manual**:
mint a fresh token before the old one lapses. Six months is the ceiling.

### 3.3 Resolution

A token authenticates as an identity path of its own, resolved once in `fetch`
alongside the account access token:

1. An account access token in `Authorization: Bearer`, when it verifies.
2. Else `Authorization: Bearer lwt_…` (or `lvd_…`, §3.1) → checked with liveworkspace (`resolveApiToken`,
   `apps/api/src/db/api-tokens.ts`, the answer remembered a minute per isolate, an unknown token ten seconds) →
   the request's owner id is the token's account. Nothing is read or written here. (A token and a JWT can't both
   be the bearer.) An `lwt_` bearer liveworkspace does not know (unknown, revoked or expired), or one too short to be a token at all (cut short or
   mistyped when pasted), is refused there and then with `401 invalid_token` and `WWW-Authenticate: Bearer
error="invalid_token"`, on every route: it never falls through to the guest
   path or to no owner, so a script holding a dead token is told so.
3. Else a workbench session (`lvw_…`), and else no identity: a link visitor. There is no guest header; a guest
   is a liveworkspace guest token, checked in step 1. Tokens never resolve to a guest id.

The resolved owner id flows through the **same** checks every route already enforces: the index's grant for a
document, fetched for the token's account, so a token can only touch what its account can reach. No route changes for authorization; only the identity
source changes.

### 3.4 Access — full read + write, with an optional read-only flag

A token grants its owner's **full** access — read AND write, the same surface
the app has — **unless** it was minted **read-only** (the one scope that
exists): a `read_only` column that, when set, restricts the
token to `GET`/`HEAD`; the api worker rejects every write it presents at a
single dispatch choke point with `403 read_only_token`
([MCP server §4.11](mcp-server.md)). The same choke point refuses it the one read that is a
credential rather than content: `GET /api/documents/:id/share`, whose links and password would let it
open an edit link. Read-only tokens are minted through the MCP
consent screen (a "read-only access" checkbox), giving a cautious user a way to
let an AI tool VIEW their documents without granting edit. There is no
finer-grained scope vocabulary (per-resource, per-verb, [§5](#5-out-of-scope)): `read_only` is a single boolean,
not a general scopes system.

**Team content counts as "the same surface".** A token's owner is always a
signed-in account ([§3.3](#33-resolution)), and both credentials — session JWT and
token — are server-verified, so the token identity feeds the same
team-membership checks the session does (`RouteContext.verifiedUserId`, used by
`gateRead`/`gateEdit` and the team-scoped document/folder verbs). Concretely: a
token can read and edit the documents in the shared libraries of the teams its
owner has joined ([Team shared documents](../013-workspace/team-shared-documents.md)), and can `GET` the
teams surface (list its teams, team detail, a team's library). The personal `GET /documents` excludes team documents by design.

**Administration stays off tokens.** Team administration, token management and account deletion are
liveworkspace's, behind a signed-in session there, never a token. A leaked token exposes the owner's content (that is
this section's deal, revocable and 6-month-capped), but it cannot escalate: mint further credentials, grant other
people membership, or destroy the account.

**Deleting goes to the Trash, with an explicit way past it.** A token's
`DELETE /api/documents/<id>` moves the document to the [Trash](../013-workspace/trash.md)
like every other delete; `DELETE /api/documents/<id>?permanent=true` deletes it
for good at once (and purges one already in the Trash). The Trash routes
(`GET /api/trash`, `POST /api/trash/<id>/restore`, `DELETE /api/trash[/<id>]`)
are token-usable with the same delete authority; a read-only token may list the
Trash but not restore or purge. The MCP server, by contrast, offers no permanent
delete at all ([MCP server §4.9](mcp-server.md)).

### 3.5 Rate limiting

`WRITE_RATE_LIMITER` is keyed on the token id as well as the owner, so a runaway integration is throttled
independently of the owner's interactive app use, and `API_TOKEN_READ_RATE_LIMITER` limits a token's reads
(`apps/api/wrangler.toml`). Per-IP limits stay as the outer backstop.

### 3.6 Management — the Settings dialog's API Tokens category

Tokens are made, listed and revoked on liveworkspace.app (the head of §3). The **Settings dialog**
([User preferences](../007-editor/user-preferences.md)) has an **API Tokens** sub-category of **Account** (id
`tokens`, `parent: 'account'`, shown as "Account › API Tokens"), reachable from the Explorer and the editor alike. It
holds one row (`kind: 'tokens'`, `apps/editor/components/dialogs/settings/SettingsTokensRow.tsx`):

- The key tile, the row's title and its line on what tokens are for.
- A line saying the tokens belong to the liveworkspace account, so one token works in every liveworkspace app, and a
  **Manage API Tokens** button that opens liveworkspace.app's token page (`manageTokensUrl` from
  `@liveworkspace/workbench/lib/auth-config`).
- A quiet line for people connecting an AI tool: it creates its own token when they approve it, with a link to the
  Connect an AI Tool guide.
- **Paired workbenches** ([Workbench embeds](../013-workspace/workbench-embeds.md#pairing)), read once per account
  (`GET /api/workbench/pairings`) and grouped by token (`SettingsTokenPairings.tsx`): each row the workbench's name
  ("Unnamed workbench" when it sent none), its origin in monospace, "Paired <relative time>", and an **Unpair**
  text button that asks first. With none, nothing extra shows.

**Guests** see the category with the row's body replaced by "Sign in to create API tokens." and a **Sign In** link
(the Settings sign-in rule in [User preferences](../007-editor/user-preferences.md)).

**Links to it open the dialog, never navigate.** Mail, which cannot open a dialog, links at the `?settings=tokens`
deep link (`/explorer?settings=tokens`), which opens the Explorer with Settings on the category.

**Account deletion removes them.** The tokens are the liveworkspace account's, and closing the account there deletes
them, so no credential outlives the account. Their workbench pairings and sessions are liveworkspace's and close with
the account there.

### 3.6a A token's view of itself

A token may read and revoke **itself**, which escalates nothing, so the [CLI](cli.md) can show who it is and sign
out cleanly:

- `GET /api/tokens/current`: the account id and display name, the token's name, its role and `expiresAt`.
- `DELETE /api/tokens/current`: revokes the presenting token (204).
- A session or guest has no token to describe and is refused `403 not_a_token`; a revoked token is refused at the
  front door like any dead token (§3.3).

Every other `/api/tokens` path is a 404 (management is on liveworkspace.app; see the head of §3).

### 3.7 Without sign-in

API tokens need an account, exactly as teams do ([Teams](../013-workspace/teams.md),
[Auth + guest access](../014-identity/auth-and-guest-access.md)). Sign-in is always offered, so the
Settings API Tokens category is always in the list; a guest's says why it is empty and links to sign in.
A deployment that hasn't configured the api's accounts settings takes no token: with `ACCOUNTS_URL` or
`API_RESOURCE` unset the worker resolves no account identity at all
([`auth/accounts.ts`](../../../apps/api/src/auth/accounts.ts) returns null), and has no liveworkspace to check a
token with.

So tokens work exactly when accounts do. This takes nothing away
from a guest-only deployment, because the whole canvas / guest model stays fully
available without an account ([Auth + guest access](../014-identity/auth-and-guest-access.md)). No new
dependency beyond the optional sign-in that teams already need.

## 4. Input validation

An open API magnifies the cost of weak input handling, so every caller's input is validated:

- **Structural schema validation** — `isValidElement` / `isValidTab`
  (`packages/document/src/validate.ts`) vet the element/tab discriminant,
  required fields, endpoints, array bounds + unique ids. The document routes run
  incoming tabs (create-seed + tab PUT) through `isValidTab` and reject
  malformed trees with `400`.
- **Size caps** — a global Content-Length body cap, per-tab byte cap, and
  name / theme-definition / participant / share-password caps
  (`apps/api/src/limits.ts`); a per-frame cap in the realtime room. Document
  and tab names are shortened to the 60-character name cap rather than
  rejected (`apps/api/src/names.ts`, [Tab and document name length](../006-document/name-length.md)).
- **Also**: SQL is fully parameterized; session JWT
  verification; share-link expiry + constant-time password compare + per-IP
  brute-force limiter; WS-upgrade auth; realtime role re-stamping + op-rate cap.

## 5. Out of scope

Finer-grained scopes — per-document / per-folder grants, per-verb permissions —
plus webhooks and any billing or quota tiers (the product has no paid tier,
[Open source + distribution](../002-project-scope/open-source-and-business-model.md)). (The one scope is
the **read-only** flag, [§3.4](#34-access--full-read--write-with-an-optional-read-only-flag);
OAuth and third-party app authorization are in [MCP server](mcp-server.md).)
Every full token inherits the owner's read and write access.
