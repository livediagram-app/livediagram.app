# Auth + guest access

## Principle

**The canvas always works without signing in.** A first-time visitor can land on `/live`, create a diagram, build something real, and only later be asked to sign up. This is intentional — friction-free engagement is the acquisition strategy.

We don't put auth in front of the core experience. We add auth where it _enables_ something the user wants (sharing, syncing, collaborating, paying).

## Three deployment modes

| Mode                 | Configuration                                                      | Frontend                                                                                                   | API worker                                      |
| -------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Hybrid (production)  | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` set + `CLERK_JWKS_URL` set     | ClerkProvider active. Guests + signed-in users coexist.                                                    | Verifies Bearer, falls through to `X-Owner-Id`. |
| Guest-only           | Either env var unset (typical self-host without Clerk per spec/03) | ClerkProvider becomes pass-through. Auth routes show "not enabled" notice. Editor unchanged.               | Falls through to `X-Owner-Id` on every request. |
| Guest-only (partial) | Frontend has key, api JWKS unset                                   | ClerkProvider active. Users _can_ sign in, but the api verifies nothing and treats every request as guest. | `X-Owner-Id` only.                              |

The first two are the supported modes. The third is a misconfiguration — useful for debugging, not for prod.

The `clerkEnabled` flag (`apps/live/lib/clerk-config.ts`) is the single source of truth on the frontend. Every Clerk-aware module reads it and picks one of two implementations at module load:

- `ClerkProvider` becomes a pass-through `<>{children}</>`.
- `useClerkApiBootstrap` returns a stable stub (`isSignedIn: false`, `authLoaded: true`, `clerkUserId: null`) without ever touching `useAuth`.
- `AuthControls` renders nothing.
- `/live/sign-in/`, `/live/get-started/`, `/live/sso-callback/` render an `AuthDisabledNotice` with a "Continue as guest" CTA.

Because `NEXT_PUBLIC_*` vars are baked at build time, the choice is a compile-time constant — no per-render cost and Clerk-only code paths can be tree-shaken out of guest-only builds.

## Hybrid identity

The api worker accepts **two equivalent ways** of identifying the request owner, in this order of preference:

1. **Clerk Bearer JWT** — `Authorization: Bearer <token>`. Verified against `env.CLERK_JWKS_URL` in `apps/api/src/auth/clerk.ts` (using `jose`'s `createRemoteJWKSet` + `jwtVerify`). The token's `sub` claim is the owner id.
2. **Guest header** — `X-Owner-Id: <participant-id>`. The participant id is a `crypto.randomUUID()` minted on first visit and persisted in `localStorage` under `livediagram:v2:self-id`.

When both are present the Bearer wins. When verification fails (expired token, missing JWKS URL, etc.) the worker silently falls through to the guest header — never 401, because the guest path must always serve.

The two paths coexist forever. A signed-in user can hand a share link to a guest who edits without auth.

## Capability matrix

| Capability                  | Guest                         | Authenticated                                                       |
| --------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| Editing the canvas          | ✓                             | ✓                                                                   |
| Persistence                 | ✓ (per-browser, not per-user) | ✓ (per-account, syncs across devices)                               |
| Open a share link as viewer | ✓                             | ✓                                                                   |
| Open a share link as editor | ✓                             | ✓                                                                   |
| Mint a new share link       | ✓                             | ✓                                                                   |
| Real-time presence          | ✓ on shared sessions          | ✓                                                                   |
| Team workspaces             | —                             | ✓ (future)                                                          |
| Pro features                | —                             | ✓ (when Pro lands — see [03](03-open-source-and-business-model.md)) |

## Auth surface

Four routes inside `apps/live/`:

- **`/live/sign-in/`** — email-code or Google OAuth. Bounces to `/live/` (which falls through to the welcome flow per [spec/14](14-new-diagram-route.md)) on success. Already-signed-in users get redirected away.
- **`/live/get-started/`** — sign-up (first name + last name + email + 6-digit code, or Google OAuth). Same post-auth destination.
- **`?redirect_url=...`** — Clerk's protected-page bounce passes this query param to both routes, and BOTH the email-code AND OAuth paths honour it. Two helpers in `components/auth-shared.tsx` share the same validation (URL must start with `/live` and must not point back at the auth routes themselves, to avoid loops):
  - `resolvePostAuthDestination(searchParams)` returns a basePath-stripped path for `router.push` (email-code path). The `/live` prefix gets stripped because `router.push` already respects basePath.
  - `resolveOAuthCompleteUrl(searchParams)` returns the full-path form for Clerk's `authenticateWithRedirect({ redirectUrlComplete })` (OAuth path). Clerk navigates the browser directly, so basePath isn't applied automatically and the `/live` prefix has to stay on.
    Both fall back to a "land at the editor home" default when redirect_url is missing, unsafe, or pointing at an auth route. A user sent to sign-in OR sign-up from a protected page, via email-code OR OAuth, lands back where they came from.
- **`/live/sso-callback/`** — Clerk's `AuthenticateWithRedirectCallback` for the OAuth round-trip.
- **`/live/explorer/`**: standalone full-page Explorer (item #12). Open to both guests and signed-in users: the owner id resolves the same way every other surface in the live app does (Clerk userId when signed in, the `livediagram:v2:self-id` localStorage UUID otherwise), so a guest sees the diagrams + folders + Image Gallery their per-browser id owns. Reached from the AuthControls dropdown's "My files" item or the floating Explorer panel's expand affordance. Signed-out visitors get the same "Sign in" CTA as everywhere else (AuthControls in the page header), the page itself doesn't gate. Guest data is per-browser by definition (no cross-device sync until they sign up and migrate).

The shared card chrome and inputs live in `apps/live/components/auth-shared.tsx` so the two pages don't drift.

Signed-in status surfaces in the editor header via `<AuthControls>` (initial bubble + Sign out menu). Signed-out users see a "Sign in" link in the same slot. Neither blocks the editor — they're purely informational.

## Identity display name

A signed-in user's participant `name` is driven by their Clerk profile (`firstName + lastName`, falling back to `fullName` then `username`). On every editor mount we seed the participant record with the current Clerk name, and re-`PUT` it whenever it has drifted from the persisted value — so renaming yourself in Clerk propagates to denormalised activity-log rows on the next load.

Two welcome-modal rules follow from that:

- **Owner on their own diagram**: the identity-only welcome screen never opens. The user's identity is already settled by Clerk; prompting them to pick a display name on a diagram they own would be noise.
- **Visitor on someone else's diagram (signed in)**: the welcome screen still opens (it carries the "you're joining X's diagram" context), but the "Your name" input is `readOnly` and the shuffle button hides. Visitors who _are_ signed in can't masquerade under a different display name on a host's diagram.

Guests see the legacy behaviour in both cases — first-load identity prompt, fully editable name, shuffle button present.

## Guest → account migration

When a guest signs up, the diagrams they built as a guest **migrate into their account** rather than being lost. They've already invested effort — losing it on sign-up would be the opposite of friction-free.

Mechanism (see also [spec/11 — `POST /api/migrate`](11-api.md)):

1. The editor + new-diagram pages mount with a `useEffect` that watches `isSignedIn + clerkUserId` from `useAuth`.
2. The first time both are truthy AND `livediagram:v2:self-id` is still in `localStorage` AND the stored id differs from the Clerk userId, the page calls `POST /api/migrate { guestOwnerId: <localStorage id> }` with the Clerk Bearer token.
3. The worker (Clerk-only auth — no `X-Owner-Id` fallback for this endpoint) reassigns every `diagrams.owner_id`, `folders.owner_id`, AND `shared_with.owner_id` row from the guest id to the Clerk userId. `shared_with` uses `INSERT OR IGNORE` + `DELETE` rather than a straight `UPDATE` because the primary key is `(owner_id, diagram_id)`: if a visitor accepted the same share link both as a guest and (later) signed in as Clerk, both rows already exist and a naive `UPDATE` would raise a PK conflict. The IGNORE keeps the existing Clerk row's role + last_seen (the more recent of the two paths the user actually used). Other tables (`change_log`, `share_links`, `tabs`) link via `diagram_id`, so they cascade for free.
4. On success the page removes the localStorage key. The migration is idempotent — a retry with the same `guestOwnerId` simply moves zero rows.

Participants are not migrated. The participant row is owner-less in the schema; signed-in users get a fresh participant record keyed by their Clerk userId on first save. A guest's name + colour don't survive — small cosmetic regression that's not worth a second endpoint to fix.

## Implications for how we build

- UI must never block the canvas behind a sign-in wall.
- Features that genuinely need an account are surfaced as opt-in prompts ("Sign in to keep your diagrams"), never modal walls.
- The single persistence boundary (`apps/live/lib/api-client.ts` against the api worker — see [11-api.md](11-api.md)) is the same in guest and authenticated mode. Only the request headers differ: a `localStorage`-minted UUID in `X-Owner-Id` for guests, a Clerk JWT in `Authorization` for signed-in users. The api-client's module-level `setTokenProvider` is the single switch.
- Public client code that uses Clerk uses only the **publishable key** (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`), never the secret key. See [06-secrets-policy.md](06-secrets-policy.md).
- The api worker's degraded-mode behaviour matters: with `CLERK_JWKS_URL` unset (no `[vars]` value in `wrangler.toml`), every request silently falls through to the guest path. Useful for local dev and for environments where Clerk hasn't been provisioned yet — the editor stays usable.
