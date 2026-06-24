# 61 — Public API and API tokens

**Status: proposed (design only — not yet implemented).** This spec sequences
opening the REST API to external, programmatic callers. The input-validation
hardening it depends on has shipped (see [§5](#5-input-validation-prerequisite-shipped)); the
token auth model below is the part awaiting sign-off before any code.

## 1. Goal

Let people call the livediagram API from their own scripts / integrations with
a long-lived **API token**, not just from the first-party web app. Read their
diagrams, create/update them, manage folders — the same surface the app uses,
under an explicit, revocable credential.

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
  owner_id      TEXT NOT NULL,        -- the Clerk userId OR guest id this token acts as
  token_hash    TEXT NOT NULL UNIQUE, -- SHA-256 of the secret
  name          TEXT,                 -- user label ("CI bot")
  scopes        TEXT NOT NULL,        -- 'read' | 'read,write' (see 3.4)
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER,
  expires_at    INTEGER,              -- NULL = no expiry
  revoked       INTEGER NOT NULL DEFAULT 0
)
```

Indexed on `token_hash` (lookup) and `owner_id` (listing).

### 3.3 Resolution

A token authenticates as a third identity path, resolved once in `fetch`
alongside Clerk + the guest header:

1. `Authorization: Bearer lvd_…` → hash → look up a non-revoked, non-expired
   row → the request's owner id is the row's `owner_id`; stamp `last_used_at`.
2. Else the existing Clerk JWT path.
3. Else the guest `X-Owner-Id` path — **only for first-party requests** (see
   [§4](#4-x-owner-id-trust-change)).

The resolved owner id flows through the **same** `gateRead` / `gateEdit` /
ownership checks every route already enforces — so a token can only touch what
its `owner_id` owns. No route changes for authorization; only the identity
source changes.

### 3.4 Scopes

Start coarse: `read` (GET only) and `write` (POST/PUT/DELETE). The dispatcher
already classifies writes (`isWrite` in `index.ts`); a write under a read-only
token returns `403`. Per-resource / per-diagram scopes are future work
([§7](#7-out-of-scope-for-now)).

### 3.5 Rate limiting

Key the existing `WRITE_RATE_LIMITER` on the token id (not just the owner) so a
runaway integration is throttled independently of the owner's interactive app
use, and add a read limiter for token reads. Per-IP limits stay as the outer
backstop.

### 3.6 Management

Users create / name / revoke tokens in account settings (signed-in users) — a
new `GET/POST/DELETE /api/tokens` surface, Clerk-gated (you can't mint a token
with a bare guest header). Creation returns the secret once. Revoke is
immediate (the lookup filters `revoked = 0`).

### 3.7 Self-hosting

Tokens are owner-scoped and work whether the owner id is a Clerk `sub` or a
guest id, so a self-host without Clerk can still issue tokens against guest
identities. No SaaS dependency.

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

(b) is the heavier change — every guest write now signs — but it's the one that
actually closes the harvested-id escalation, and the live app already obtains
its signature, so wiring it onto REST requests is incremental. API tokens
([§3](#3-design-api-tokens)) are a parallel server-verifiable credential for
external callers.

**Compatibility:** `verifyOwnerId` returns true when `GUEST_ID_HMAC_SECRET` is
unset, so self-hosts without the secret are unaffected (they opt out of the
guard, as today). Where the secret IS set, legacy guests minted before signing
([spec/04](04-auth-and-guest-access.md) transition, `routes/migrate.ts`) must
re-mint a signed id (or migrate) before their writes are accepted — a one-time
grace to design at implementation so existing guests aren't locked out.

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
   grace). Defence-in-depth: also stop emitting the raw owner id where a
   collaborator can read it — redact `participantId` in the change-log read for
   non-owners, and consider a room-scoped presence id — so a leaked id is
   harder to obtain even before the signature check rejects its use.
3. `api_tokens` table + migration + token mint/verify (`auth/`), Clerk-gated
   management routes.
4. Wire token resolution into `resolveOwner`; enforce scopes.
5. Public API docs (the surface is the existing routes; document them).

## 7. Out of scope (for now)

Per-diagram / per-folder scopes, OAuth / third-party app authorization,
webhooks, and any billing or quota tiers (the product has no paid tier —
[spec/03](03-open-source-and-business-model.md)). Tokens inherit the owner's
full access; finer grants come later if demand appears.
