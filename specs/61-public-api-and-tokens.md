# 61 — Public API and API tokens

**Status: proposed (design only — not yet implemented).** This spec sequences
opening the REST API to external, programmatic callers. The input-validation
hardening it depends on has shipped (see [§5](#5-input-validation-prerequisite-shipped)); the
token auth model below is the part awaiting sign-off before any code.

## 1. Goal

Let **signed-in** people call the livediagram API from their own scripts /
integrations with a long-lived **API token**, not just from the first-party web
app. Read their diagrams, create/update them, manage folders — the same surface
the app uses, under an explicit, revocable credential.

**Signed-in only (gated like teams, [spec/32](32-teams.md)).** API tokens are an
advanced, opt-in feature for users with an account; the canvas, guests, and the
share/realtime flows are unaffected and stay account-free ([spec/04](04-auth-and-guest-access.md)).
A token always acts as a Clerk user; there are **no guest-owned tokens**. This
is a deliberate constraint, not a limitation to apologise for: programmatic API
use is a power-user need, requiring an account for it is reasonable, and it
keeps tokens off the spoofable guest-identity path entirely (the guest REST
hardening in [§4](#4-x-owner-id-trust-change) is a separate track).

This must not weaken the friction-free guest model ([spec/04](04-auth-and-guest-access.md))
or self-hosting ([spec/03](03-open-source-and-business-model.md)).

## 2. Why the API isn't safe to expose as-is — and a current weakness

Today the worker resolves the caller two ways ([spec/04](04-auth-and-guest-access.md)):

- **Clerk JWT** in `Authorization: Bearer <jwt>` — verified (signature, exp,
  optional issuer/audience) in `apps/api/src/auth/clerk.ts`. Sound.
- **Guest path**: an `X-Owner-Id` header carrying a per-browser UUID, **trusted
  verbatim** (`resolveOwner()` in `apps/api/src/index.ts`), with **no
  signature** on the REST path. (The realtime WS upgrade _does_ require an HMAC
  proof, `?g=`; REST does not.)

The guest header is the blocker, and the owner id it carries is **not a secret
in practice.** The obvious REST surfaces are redacted for non-owners — the
shared diagram DTO (`redactOwner`, `routes/share.ts`) and comment author ids on
tab read (`redactCommentAuthorIds`, `routes/diagrams.ts`) — but two surfaces
still expose a collaborator to the owner's id:

- **Realtime presence** — `broadcastPresence` (`diagram-room.ts`) sends every
  connected participant's `id`, unredacted, to all room peers. The participant
  id _is_ the owner id (`apps/live/lib/api/core.ts`: "X-Owner-Id set to the
  current participant's id"). So any co-present collaborator — including a
  **view-only** share visitor who opens the diagram while the owner is
  connected — reads it off a presence frame.
- **Change-log / Activity** — `GET /diagrams/<id>/log` returns each entry's
  `participantId` unredacted to any **edit-access** collaborator (edit-share
  holders, joined team members). A static, reliable harvest.

Because REST trusts `X-Owner-Id` with no signature, a collaborator who harvests
an owner's id can then call the API **as** that owner across ALL their content:
`GET /api/diagrams` lists every diagram the id owns, each then readable /
editable / deletable. So today, **sharing one diagram (or being in a team) can
escalate to impersonating the owner account-wide** — a current cross-object
authorization hole, not merely a future-external concern. It applies to
signed-in owners too: their id is the Clerk `sub`, and the `X-Owner-Id` fallback
accepts it whenever a request carries no Bearer token.

Conclusion: external access needs a real, server-verifiable credential — AND
the bare `X-Owner-Id` trust must be replaced, which also closes the current
escalation above. The fix is [§4](#4-x-owner-id-trust-change).

## 3. Design: API tokens

### 3.1 Token format

- An opaque secret with a visible prefix for greppability + leak-scanning:
  `lvd_<base62 random ≥ 32 bytes>`. The prefix also disambiguates it from a
  Clerk JWT in the same `Authorization: Bearer` header.
- Shown **once** at creation; never retrievable again.
- Stored **hashed** (SHA-256), never in plaintext. Lookup hashes the presented
  token and compares (constant-time, reusing `auth/timing-safe.ts`).

### 3.2 Storage (D1)

A new owner-scoped table, migration with the worker that owns the binding:

```
api_tokens(
  id            TEXT PRIMARY KEY,     -- public token id (for listing / revoke)
  owner_id      TEXT NOT NULL,        -- the Clerk userId this token acts as (never a guest id)
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
alongside Clerk + the guest header:

1. `Authorization: Bearer lvd_…` → hash → look up a non-revoked, non-expired
   row → the request's owner id is the row's `owner_id`; stamp `last_used_at`.
2. Else the existing Clerk JWT path.
3. Else the guest `X-Owner-Id` path — now requiring a valid HMAC signature on
   the header (see [§4](#4-x-owner-id-trust-change)). Tokens never resolve to a
   guest id, so this path is for the first-party app only; it grants no token.

The resolved owner id flows through the **same** `gateRead` / `gateEdit` /
ownership checks every route already enforces — so a token can only touch what
its `owner_id` owns. No route changes for authorization; only the identity
source changes.

### 3.4 Access — full read + write (no scopes yet)

A token grants its owner's **full** access — read AND write, the same surface
the app has. There is **no scope choice and no read-only token** for now: a
read-only mode is a plausible future addition but has no clear use today, so
it's deferred ([§7](#7-out-of-scope-for-now)). Hence no `scopes` column — when
granular access lands it returns with the columns it needs.

### 3.5 Rate limiting

Key the existing `WRITE_RATE_LIMITER` on the token id (not just the owner) so a
runaway integration is throttled independently of the owner's interactive app
use, and add a read limiter for token reads. Per-IP limits stay as the outer
backstop.

### 3.6 Management — a new Explorer library page

Tokens are created / named / revoked from a **new Explorer library section**,
listed in the sidebar nav (`apps/live/app/explorer/ExplorerSidebar.tsx`)
**directly under "Themes"** as its own entry (e.g. "API tokens",
`go({ kind: 'tokens' })`). It renders a `TokensPane` that mirrors `ThemesPane`:
a list of the user's tokens (name, created, expires, last-used) with a
create-token action and a revoke per row. Same pattern, same place users
already manage their other account-scoped library items.

Behind it, a new `GET/POST/DELETE /api/tokens` surface, **gated exactly like
the team routes** ([spec/32](32-teams.md)): it requires a verified Clerk
identity and rejects a guest (`X-Owner-Id`-only) caller outright (`401`/`403`,
mirroring `routes/teams.ts`) — so the section is hidden / inert for guests, the
same way the rest of the signed-in surface is. A token can only ever be minted
by, and act as, a signed-in account. Creation returns the secret **once**
(shown in the pane to copy, never retrievable again); the row then shows only
the public id + metadata. Revoke is immediate (the lookup filters
`revoked = 0`). The pane states the fixed 6-month expiry ([§3.2](#32-storage-d1))
so rotation isn't a surprise.

**Per-account cap: 10.** A `POST /api/tokens` is refused (`409`) once the owner
already has 10 live (non-revoked, non-expired) tokens — enough for any real
integration set, low enough to keep the list + table tidy. Revoking or letting
one expire frees a slot.

**Account deletion removes them.** Deleting an account erases ALL of that
user's data, tokens included: `DELETE /api/account` ([`routes/account.ts`](../apps/api/src/routes/account.ts))
must delete the owner's `api_tokens` rows in the same cascade as their diagrams
/ folders / themes, so no credential outlives the account.

### 3.7 Self-hosting

API tokens are gated on **auth being enabled**, exactly as teams and sign-in
are ([spec/32](32-teams.md), [spec/04](04-auth-and-guest-access.md)). A
self-host that hasn't configured Clerk runs in pure-guest mode, and in that
mode the feature is **absent end to end** — there is no tokens page to open and
no way to mint one:

- **Frontend** — the Explorer "API tokens" section (and any token UI) renders
  only when `clerkEnabled` (`apps/live/lib/clerk-config.ts`, derived from the
  presence of `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`). This is the **same flag**
  that already hides the teams / sign-in sections of the sidebar, so when auth
  is off the section simply isn't in the nav.
- **Backend** — the `/api/tokens` routes require a verified Clerk identity, and
  with `CLERK_JWKS_URL` unset the worker resolves no Clerk identity at all
  ([`auth/clerk.ts`](../apps/api/src/auth/clerk.ts) returns null), so the
  routes reject every caller. Belt and suspenders: even if the UI were somehow
  reached, token creation / use is impossible without auth configured.

So enabling tokens is opt-in with auth, and disabling auth removes them
cleanly — no orphaned page, no half-working endpoint. This takes nothing away
from a guest-only self-host, because the whole canvas / guest model stays fully
available without an account ([spec/04](04-auth-and-guest-access.md)). No new
SaaS dependency beyond the optional Clerk that teams already need.

## 4. `X-Owner-Id` trust change

The bare header must stop being a usable credential — both for external callers
and to close the [§2](#2-why-the-api-isnt-safe-to-expose-as-is--and-a-current-weakness)
escalation. Two options were weighed:

- **(a) First-party origin gate — rejected as the sole fix.** Accept
  `X-Owner-Id` only on same-origin requests via the `Origin` / `Sec-Fetch-Site`
  signals (as telemetry does, `origin-check.ts`). This does **not** stop the
  attack: a non-browser client sets the `Origin` header freely, so a `curl`
  caller forges `Origin: https://livediagram.app` and passes the gate. Origin
  is hygiene, not an authorization boundary.
- **(b) Require an HMAC proof on the header — chosen.** Extend the guest-id
  HMAC already used on the WS upgrade (`?g=`, `auth/owner-signature.ts`) to
  REST: an `X-Owner-Id` request must also carry a valid `X-Owner-Sig` for that
  id, verified against `GUEST_ID_HMAC_SECRET`. The legitimate guest holds its
  signature (minted at `POST /api/guest-id`); a collaborator who merely
  _harvested_ an id (a guest UUID, or a Clerk `sub`) has no valid signature, so
  the spoof is rejected. Signed-in users keep using the Clerk Bearer (a real
  credential) and never the header.

**Explicit guarantee for signed-up users.** Today `resolveOwner()`
(`apps/api/src/index.ts`) is `clerkUserId ?? X-Owner-Id`, with no check binding
the credential _type_ to the owner id — so a caller with no Bearer and
`X-Owner-Id: <a Clerk sub>` is accepted AS that account (verified: the sub leaks
via presence / the change-log, and nothing rejects it). After (b), a Clerk
account's diagrams are reachable **only via a verified Bearer token**: an
`X-Owner-Id` carrying a Clerk `sub` has no guest signature (one is never minted
for a Clerk id), so it is rejected. The post-fix invariant is therefore "once
signed up, your diagrams require your Bearer token; the header can't reach
them" — which is the property to assert in tests.

(b) is the heavier change — every guest write now signs — but it's the one that
actually closes the harvested-id escalation, and the live app already obtains
its signature, so wiring it onto REST requests is incremental. API tokens
([§3](#3-design-api-tokens)) are a parallel server-verifiable credential for
external callers.

**Compatibility — legacy unsigned guests (recommended approach).**
`verifyOwnerId` returns true when `GUEST_ID_HMAC_SECRET` is unset, so self-hosts
without the secret opt out of the guard entirely (as today). Where the secret
IS set, the migration follows from one hard truth: **an unsigned id can't be
retroactively secured** — there is no proof bound to it, so the server cannot
tell its real owner from someone who harvested it (that's exactly why we're
adding signatures). So don't try; bound the window instead and lean on the
self-heal that already exists:

1. The app already, on load, mints a _signed_ id and migrates a legacy unsigned
   id's diagrams onto it (`apps/live/lib/guest-identity.ts` → `apiUpgradeGuestId`).
   Active guests largely hold a signed id already (they migrated when signing
   first shipped, [spec/04](04-auth-and-guest-access.md)).
2. Ship the `X-Owner-Sig` requirement **behind a grace flag / cutoff date.**
   Before the cutoff, an unsigned `X-Owner-Id` is still accepted (today's
   behaviour) so every returning guest self-heals to a signed id; at the
   cutoff, unsigned ids are rejected for writes.
3. **Never delete the orphaned data.** A long-dormant guest who only returns
   after the cutoff finds their old unsigned id rejected, but the diagrams
   still exist server-side under that id — recoverable via the migrate tooling
   / a "sign in to recover" path, so it's a re-auth, never data loss.

The grace window IS the residual exposure (unsigned ids stay spoofable until
migrated) — the same residual [spec/04](04-auth-and-guest-access.md) /
`routes/migrate.ts` already acknowledge — so set the cutoff far enough out
(e.g. 30–90 days after the migrate code is live) that the active-guest
population has rotated to signed ids, and keep it short enough to close the
window. No active user is ever hard-locked.

## 5. Input validation (prerequisite — shipped)

Opening the API magnifies the cost of weak input handling, so the validation
hardening landed first:

- **Structural schema validation** — `isValidElement` / `isValidTab`
  (`packages/diagram/src/validate.ts`) vet the element/tab discriminant,
  required fields, endpoints, array bounds + unique ids. The diagram routes run
  incoming tabs (create-seed + tab PUT) through `isValidTab` and reject
  malformed trees with `400`.
- **Size caps** — a global Content-Length body cap, per-tab byte cap, and
  name / theme-definition / participant / share-password caps
  (`apps/api/src/limits.ts`); a per-frame cap in the realtime room.
- **Already solid** (pre-existing): D1 is fully parameterized; Clerk JWT
  verification; share-link expiry + constant-time password compare + per-IP
  brute-force limiter; WS-upgrade auth; realtime role re-stamping + op-rate cap.

## 6. Rollout

1. ✅ Input hardening (done).
2. **The `X-Owner-Id` HMAC requirement ([§4](#4-x-owner-id-trust-change)).**
   Pulled to the FRONT: it closes the current cross-object escalation in
   [§2](#2-why-the-api-isnt-safe-to-expose-as-is--and-a-current-weakness) and
   is independent of the token work, so it ships first (with the legacy-guest
   grace). **Stop emitting the raw owner id where a collaborator can read it**
   (do this, not just "consider" — shrinking the attack surface is worth it
   even though §4 already neutralises a leaked id, because people WILL probe
   for it):
   - Redact `participantId` in the change-log read for non-owners (the static
     harvest), the same way comment authors and the diagram `ownerId` already
     are.
   - Give each realtime session a **room-scoped ephemeral presence id**
     (random per connection) for the broadcast presence / cursor frames,
     decoupled from the real owner id. Cursor identity + dedup within the room
     use the ephemeral id; the server keeps the real→ephemeral mapping
     internally for its role/identity checks but never broadcasts the owner id.
     This removes the last surface that exposed it.
3. `api_tokens` table + migration (`expires_at` fixed to +6 months) + token
   mint/verify (`auth/`), Clerk-gated `/api/tokens` routes (the team-route
   gate, [spec/32](32-teams.md)).
4. The **Explorer "API tokens" section** under Themes (`TokensPane`, mirroring
   `ThemesPane`) — the management UI ([§3.6](#36-management--a-new-explorer-library-page)),
   rendered only when `clerkEnabled` so it's absent on a no-auth self-host
   ([§3.7](#37-self-hosting)).
5. Wire token resolution into `resolveOwner`; enforce scopes.
6. **Docs + help, shipped WITH the feature** (help articles describe live
   features and must be registered — see the help-centre rule in `CLAUDE.md`,
   so this copy lands when the feature does, not before):
   - A new help article (e.g. `account-and-data/api-tokens`) covering what
     tokens are, creating/revoking them **from the Explorer**, the **6-month
     expiry + manual rotation**, and the **signed-in-only** limitation —
     registered in `apps/help/lib/articles.ts`.
   - Add API tokens to the "what signing in unlocks" list in the
     `account-and-data/signing-in` article (next to teams + cross-device sync).
   - `docs/` updates: note the new `/api/tokens` surface + its account
     requirement in `docs/architecture.md`, and the Clerk-gated nature in
     `docs/self-hosting.md` (tokens need Clerk, like teams).
   - Public API reference for the existing routes (ties in with
     [spec/37](37-api-documentation.md)).

## 7. Out of scope (for now)

Scopes of any kind — a **read-only token**, and per-diagram / per-folder grants
([§3.4](#34-access--full-read--write-no-scopes-yet)) — plus OAuth /
third-party app authorization, webhooks, and any billing or quota tiers (the
product has no paid tier — [spec/03](03-open-source-and-business-model.md)).
Every token inherits the owner's full read+write access; finer grants come
later if demand appears.
