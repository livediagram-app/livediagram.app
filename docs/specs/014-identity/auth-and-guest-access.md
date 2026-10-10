# Auth + guest access

## Principle

**The canvas always works without signing in.** A first-time visitor can land on `/new`, create a document, build something real, and only later be asked to sign up. This is intentional — friction-free engagement is the acquisition strategy.

We don't put auth in front of the core experience. We add auth where it _enables_ something the user wants (sharing, syncing, collaborating, paying).

## Three deployment modes

| Mode                 | Configuration                                                                                                                                   | Frontend                                                                                                   | API worker                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Hybrid (production)  | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` set + `CLERK_JWKS_URL` set                                                                                  | ClerkProvider active. Guests + signed-in users coexist.                                                    | Verifies Bearer, falls through to `X-Owner-Id`. |
| Guest-only           | Either env var unset (typical self-host without Clerk per [Open source + distribution](../002-project-scope/open-source-and-business-model.md)) | ClerkProvider becomes pass-through. Auth routes show "not enabled" notice. Editor unchanged.               | Falls through to `X-Owner-Id` on every request. |
| Guest-only (partial) | Frontend has key, api JWKS unset                                                                                                                | ClerkProvider active. Users _can_ sign in, but the api verifies nothing and treats every request as guest. | `X-Owner-Id` only.                              |

The first two are the supported modes. The third is a misconfiguration — useful for debugging, not for prod.

The `clerkEnabled` flag (`apps/live/lib/clerk-config.ts`) is the single source of truth on the frontend. Every Clerk-aware module reads it and picks one of two implementations at module load:

- `ClerkProvider` becomes a pass-through `<>{children}</>`.
- `useClerkApiBootstrap` returns a stable stub (`isSignedIn: false`, `authLoaded: true`, `clerkUserId: null`) without ever touching `useAuth`.
- `AuthControls` renders nothing.
- `/sign-in/`, `/get-started/`, `/sso-callback/` render an `AuthDisabledNotice` with a "Continue as guest" CTA.

Because `NEXT_PUBLIC_*` vars are baked at build time, the choice is a compile-time constant — no per-render cost and Clerk-only code paths can be tree-shaken out of guest-only builds.

**One real Clerk provider per page.** The root layout's `ClerkProvider` is deferred: the app tree consumes `DeferredAuthContext`, and a lazily-loaded `ClerkBridge` mounts the real `@clerk/react` provider as an async chunk. The auth pages (`/sign-in`, `/get-started`, `/sso-callback`) instead wrap themselves in `StaticClerkProvider` (Clerk IS the page there) — so the bridge **stands down on those routes**. Mounting both threw `@clerk/react`'s "multiple ClerkProvider components" and crashed the page right after signing in (bitten by the MCP OAuth consent flow, which routes through `/sign-in`). While it stands down, the deferred provider **resets to the unsettled default**: nothing publishes there, and the email-code sign-in returns with a soft navigation that keeps the provider mounted, so the last published "settled guest" state would otherwise survive into the editor, let it skip the migration wait below, and 404 the open document until a refresh.

## Hybrid identity

The api worker accepts **two equivalent ways** of identifying the request owner, in this order of preference:

1. **Clerk Bearer JWT** — `Authorization: Bearer <token>`. Verified against `env.CLERK_JWKS_URL` in `apps/api/src/auth/clerk.ts` (using `jose`'s `createRemoteJWKSet` + `jwtVerify`). The token's `sub` claim is the owner id.
2. **Guest header** — `X-Owner-Id: <participant-id>`. The participant id is a `crypto.randomUUID()` minted on first visit and persisted in `localStorage` under `livediagram:v2:self-id`. Every other random value the editor rolls for a guest — the display name, the presence colour, an avatar's costume — goes through `apps/live/lib/random.ts`, which draws from `crypto.getRandomValues` rather than `Math.random`. None of it guards a secret, but a weak generator feeding values that read as identity is what static analysis flags, and the strong one is free in every runtime we target.

When both are present the Bearer wins. When verification fails (expired token, missing JWKS URL, etc.) the worker falls through to the guest header, never a 401 of its own, because the guest path must always serve. The fall-through is logged as `[auth] clerk_jwt_rejected reason=<jose code>` (never the token), and `exp` / `nbf` are checked with the same 5 seconds of clock skew Clerk's own backend SDK allows.

**An account id is never a guest credential.** The worker refuses a Clerk id (`user_…`) in `X-Owner-Id` with `401 account_id_not_a_guest_credential` ([Public API and API tokens](../015-api/public-api-and-tokens.md)). The editor holds the same rule from its side (`identityHeaders` in `apps/live/lib/api/core.ts`, shared with the unload beacon): a signed-in client whose `getToken()` resolves null asks once more with `{ skipCache: true }`, and if that is null too it throws `SessionTokenUnavailableError` instead of sending its account id as the guest header. `getToken()` does resolve null now and then on a live session; before the worker refused the shape that null went out as `X-Owner-Id: user_…` unnoticed, and afterwards it showed as "Couldn't save your changes. Check your connection." on a working network. The autosave reports both a 401 and a missing token as `unauthenticated` ([Per-tab storage](../006-document/per-tab-storage.md)).

The two paths coexist forever. A signed-in user can hand a share link to a guest who edits without auth.

## Capability matrix

| Capability                  | Guest                         | Authenticated                         |
| --------------------------- | ----------------------------- | ------------------------------------- |
| Editing the canvas          | ✓                             | ✓                                     |
| Persistence                 | ✓ (per-browser, not per-user) | ✓ (per-account, syncs across devices) |
| Open a share link as viewer | ✓                             | ✓                                     |
| Open a share link as editor | ✓                             | ✓                                     |
| Mint a new share link       | ✓                             | ✓                                     |
| Real-time presence          | ✓ on shared sessions          | ✓                                     |
| Team workspaces             | —                             | ✓ (future)                            |

## Auth surface

Four routes inside `apps/live/`:

- **`/sign-in/`** — email-code, plus an optional Google OAuth button gated on `googleOAuthEnabled` (`apps/live/lib/clerk-config.ts`), which is `clerkEnabled && NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === 'true'`. The button stays hidden unless that env var is set AND the Google SSO connection is enabled in the Clerk dashboard (dev tenants can use Clerk's shared Google credentials; prod needs its own Google Cloud OAuth client registered against Clerk's redirect URI, `https://clerk.<domain>/v1/oauth_callback`). On success (and for an already-signed-in visitor) it lands on the **Explorer** (`/explorer`) by default — a returning user wants to see their existing documents, not the new-document welcome flow — via `POST_AUTH_SIGNIN_DEFAULT` in `components/chrome/auth-shared.tsx`. A valid `?redirect_url` still wins (see below).
- **`/get-started/`** — sign-up (first name + last name + email + 6-digit code), with the same flag-gated Google OAuth button. Same post-auth destination.
- A Google sign-in brings the Google picture along as the user's own avatar ([Profile picture](profile-picture.md)).
- **`?redirect_url=...`** — Clerk's protected-page bounce passes this query param to both routes, and BOTH the email-code AND OAuth paths honour it. Routes are clean now (no `/live` prefix — [Router app](../016-platform/router-app.md)), so a valid `redirect_url` is any **same-origin path**. Two helpers in `components/chrome/auth-shared.tsx` share the same validation (`isSafeInternalPath`): the path must start with a single `/` — NOT `//` or `/\` (the protocol-relative / backslash open-redirect tricks the old `/live`-prefix check guarded against implicitly) — and must not point back at `/sign-in` or `/get-started` (loop guard):
  - `resolvePostAuthDestination(searchParams)` returns the safe path as-is for `router.push` (email-code path) — there's no basePath to strip any more.
  - `resolveOAuthCompleteUrl(searchParams)` returns the same destination for Clerk's `authenticateWithRedirect({ redirectUrlComplete })` (OAuth path) — with clean routing there's no `/live` prefix to re-add, so it just mirrors `resolvePostAuthDestination`.
    When `redirect_url` is missing, unsafe, or pointing at an auth route, each flow falls back to its own default: **sign-in → the Explorer** (`POST_AUTH_SIGNIN_DEFAULT`, `/explorer/recent`), **sign-up → the welcome / new-document flow** (`POST_AUTH_DEFAULT`, `/new`). The default is passed into the shared resolvers, so a valid protected-page bounce still returns a user sent to sign-in OR sign-up, via email-code OR OAuth, back where they came from.
  - **Every in-app trigger builds the param, not just Clerk's bounce.** So a visitor who clicks any "Sign in" / "Create account" affordance returns to the page they were on after auth — not a generic default. The builder half lives beside the resolvers in `components/chrome/auth-shared.tsx`: `authHrefWithReturn(authPath, returnTo)` composes `?redirect_url=<encoded returnTo>` through the **same** `isSafeInternalPath` guard the resolver consumes with (an unsafe or auth-page `returnTo` is dropped, yielding a bare auth href — never a loop or open redirect), and the `useAuthReturnPath()` hook supplies the visitor's live location (path + query + `#t=<tab>` hash, so you land back on the exact tab). Every trigger — the header pill (`AuthControls`), the floating banner + its reasons modal (`SignInBanner` / `SignInReasonsModal`), the Explorer sidebar/pane + guest prompts (`ExplorerSidebar` / `ExplorerPane` / `SignInPrompt`), and the `/join` invite page — uses it. The two auth pages also forward an incoming `redirect_url` across their own sign-in↔sign-up cross-links and email-mismatch bounces, so switching auth mode never drops the destination.
- **`/sso-callback/`** — Clerk's `AuthenticateWithRedirectCallback` for the OAuth round-trip.
- **`/explorer/`**: standalone full-page Explorer (item #12). Open to both guests and signed-in users: the owner id resolves the same way every other surface in the live app does (Clerk userId when signed in, the `livediagram:v2:self-id` localStorage UUID otherwise), so a guest sees the documents + folders + Image Gallery their per-browser id owns. Reached from the AuthControls dropdown's "Explorer" menu item (the same label [Live app](../007-editor/live-app.md) uses for the mobile entry point). Signed-out visitors get the same "Sign in" CTA as everywhere else (AuthControls in the page header), the page itself doesn't gate. Guest data is per-browser by definition (no cross-device sync until they sign up and migrate).

The shared card chrome and inputs live in `apps/live/components/chrome/auth-shared.tsx` so the two pages don't drift.

Signed-in status surfaces in the editor header via `<AuthControls>` (initial bubble + Sign out menu). Signed-out users see a "Sign in" link in the same slot. Neither blocks the editor — they're purely informational.

## Identity display name

A signed-in user's participant `name` is driven by their Clerk profile (`firstName + lastName`, falling back to `fullName` then `username`). On every editor mount we seed the participant record with the current Clerk name, and re-`PUT` it whenever it has drifted from the persisted value — so renaming yourself in Clerk propagates to everything that reads the participant row on the next load.

Two welcome-modal rules follow from that:

- **Owner on their own document**: the identity-only welcome screen never opens. The user's identity is already settled by Clerk; prompting them to pick a display name on a document they own would be noise.
- **Visitor on someone else's document (signed in)**: the welcome screen still opens (it carries the "you're joining X's document" context), but the "Your name" input is `readOnly` and the shuffle button hides. Visitors who _are_ signed in can't masquerade under a different display name on a host's document.

Guests see the legacy behaviour in both cases — first-load identity prompt, fully editable name, shuffle button present.

The join prompt is **independent of share role**: both **edit-role and view-role** visitors get it. A viewer's display name is broadcast to everyone else (cursor label, the tab presence stack, comments), so they need a chance to set it before joining rather than appearing under a random default. The identity card only writes the visitor's **own** participant row (`PUT /api/participants/:id`, authorised on `owner === id`, not on document-edit rights), so confirming a name never hits a `403` even for a read-only viewer. The card's edit-only affordances (template grid, theme grid) don't render in identity mode, so there's nothing a viewer could trigger that they lack permission for.

## Guest → account migration

When a guest signs up, the documents they built as a guest **migrate into their account** rather than being lost. They've already invested effort — losing it on sign-up would be the opposite of friction-free.

Mechanism (see also [API app — `POST /api/migrate`](../015-api/api.md)):

1. Every page that talks to the api mounts `useClerkApiBootstrap`, which watches `isSignedIn + clerkUserId` from `useAuth`.
2. The first time both are truthy AND `livediagram:v2:self-id` is still in `localStorage` AND the stored id differs from the Clerk userId, the page calls `POST /api/migrate { guestOwnerId: <localStorage id>, guestSignature: <localStorage signature> }` with the Clerk Bearer token.
3. The worker (Clerk-only auth, no `X-Owner-Id` fallback for this endpoint) **verifies the guest id's HMAC signature** (possession proof — see "Signed guest ids" below) and then moves every guest-holdable row from the guest id to the Clerk userId: documents, folders, shared-with-you visits, favourites, preferences, custom themes, images, the participant row, the timeline and the Activity index. [Owner-keyed data](../015-api/api.md#owner-keyed-data) is the one list of those tables, with how each handles a row the account already has. Where both identities hold the same row, the account's copy wins, as the more recent and authoritative one; an image whose bytes the account already uploaded stays at the guest id so formerly-guest documents keep resolving it ([Image element + per-owner gallery](../009-elements/images.md)). Tables keyed on `document_id` follow their document for free.
4. On success the page removes the localStorage key. The migration is idempotent — a retry with the same `guestOwnerId` simply moves zero rows.
5. **Owner data waits for the migration.** Until the migration settles, `authLoaded` stays false, so no page reads or writes as the Clerk userId while the guest's rows still belong to the guest id. Otherwise the document that was open when the user signed in loads as the Clerk userId before it has moved, and the editor shows "document does not exist" instead of the document. The migration runs once per page load, however many components mount the hook. A failed migration settles too (the guest id stays in `localStorage`, so the next load retries), and a migration still pending after `GUEST_MIGRATION_WAIT_MS` (10 s) stops holding the page, so a hung request never blocks the editor. The pending state is an external store (`subscribeGuestMigration` in `apps/live/lib/guest-migration.ts`): settling notifies every mount, which is what releases `authLoaded`.

The participant row moves too, so a guest who picked a name and colour keeps them. A signed-in user's name then follows their Clerk profile on the next load when it carries one, and an account that already had a participant row keeps its own. Leaving the guest row behind would strand a name the user typed under an id nobody holds, out of reach of a later account deletion.

### Signed guest ids (migrate possession proof)

A guest's `X-Owner-Id` is a bearer value that **leaks**: it rides in document DTOs and realtime presence frames. Without a possession proof, `POST /api/migrate` trusted a body-supplied `guestOwnerId` outright, so anyone who merely _observed_ a victim's guest id could reassign all of that guest's documents / folders / images into their own account. To close this, guest ids are HMAC-signed:

- **Server-minted.** When `GUEST_ID_HMAC_SECRET` is set, the live app calls `POST /api/guest-id` during identity bootstrap; the worker **generates** the id and returns it with its HMAC signature (`auth/owner-signature.ts`). Because the server chooses the id, a caller can only ever hold a signature for an id the server handed _them_ — never for an id observed elsewhere. The signature is cached in `localStorage` under `livediagram:v2:self-sig` and is **never** returned in any DTO or presence frame; only the bare id is.
- **Signed before the first owner-scoped call, on every entry path.** Every page a guest can arrive on first (`/` and `/new`, the Explorer, the editor, the team invite `/join`) resolves the guest's identity through the signed mint (`ensureSignedGuestIdentity`, shared as the `useSignedGuestId` hook) and makes no owner-scoped api call until it has. A local unsigned id is only the offline fallback. Once enforcement is armed, a path that skipped it refuses a first-time visitor: `/new` once minted a local unsigned id, and with enforcement armed on 2026-10-06 a new visitor from the landing page could not create a document until it was un-armed the same day.
- **Verified on migrate.** `POST /api/migrate` requires a valid signature for the source guest id before reassigning ownership. Knowing the id is no longer enough.
- **Defence in depth.** The owner's id is not returned to non-owner readers at all: `redactDocumentForReader` (`apps/api/src/redact-document.ts`) blanks it on **both** doors that hand out a document DTO — the share resolver (`GET /api/share/<code>`) and the document fetch (`GET /api/documents/<id>`). The second one mattered and was missed for a while: the share resolver was fixed as "the easiest observation vector" while the raw fetch kept returning the id intact to the same audience, because `canReadDocument` admits any valid share code, view or edit — a view-only visitor has to be able to open the document. One redaction guarding one of two doors is not defence in depth, so the rule now lives in one module with its own tests and both call sites use it. Blanking costs non-owners nothing: the client reads `ownerId` only to compute `isOwner` (correctly false for a blank) and `resolveOwnerBadge` already falls back to the owner's name + colour. The same function nulls the document's primary `shareCode` for non-owners: it is the document's oldest link of any role, so a view-link visitor who received it held an edit link. Visitors already hold the code they arrived with, and only the owner manages links.
- **Optional (self-host).** When `GUEST_ID_HMAC_SECRET` is unset, signing is disabled and migrate keeps its legacy unsigned behaviour — fine for a single-user self-host. Production sets the secret (provisioned like `CLERK_JWKS_URL`, from the GitHub secret of the same name; staging takes its own value from `GUEST_ID_HMAC_SECRET_STAGING`, which must differ or a guest id minted on staging would be claimable on production).

  **This is the switch that closes the hole, and for a long time nobody threw it.** The signing code shipped 2026-06-08 deliberately inert — "until the secret is configured in prod this is behaviourally a no-op" — and the secret was never set, so production ran the legacy unsigned migrate for months while the spec above described a protection that wasn't active. Worth stating plainly because the failure was invisible from the code: every file read as though the guard were on. If you are auditing this, **check the deployment, not the source** — `POST /api/guest-id` returning `"ownerSig": null` means signing is off, whatever this spec says. Note also that the secret alone is what protects `/api/migrate`; `GUEST_SIG_ENFORCE_AFTER` ([Public API and API tokens §4](../015-api/public-api-and-tokens.md)) is a separate, later switch covering the ordinary REST routes, and it can't do anything while the secret is missing.

- **Legacy upgrade.** A guest created before signing shipped has an unsigned id and so can't satisfy the check. On the next editor load the bootstrap mints a signed id and migrates the old data onto it via a guest→guest migrate (flow 2, authenticated by the old id as `X-Owner-Id` — the same bearer credential every guest request uses; if it fails the old id is kept so nothing is orphaned). **Residual:** this guest→guest step is only bearer-authenticated, so a legacy (pre-signing) id that an attacker already captured via presence could be claimed during the transition window. Once enforcement is armed, this step stays open only to an id whose participant row predates `GUEST_SIGNING_LIVE_AT` (production: 2026-09-25 12:00 UTC, when signing actually started), so a returning legacy guest still keeps their documents while an id minted signed cannot be moved without its signature. New guests are never exposed; the window shrinks to nothing as legacy ids age out, and both DTO leak paths are now closed (see "Defence in depth" above — one of them only recently, so don't read the earlier wording as meaning the leak was ever fully shut).
- **A refused upgrade adopts the signed id.** The worker refuses (`403`) an unsigned upgrade from an id that is not pre-signing once enforcement is armed; that id's server data is unreachable already, so the browser adopts the signed id instead of keeping one it can never use. The usual source is a local id minted when the first mint never landed (offline, or a navigation that cut the request short). Offline documents carry no guest id, so none are lost. An upgrade that cannot reach the worker still keeps the old id and retries on the next load.
- **An interrupted upgrade resumes; it never mints again.** The bootstrap records the pending upgrade (the old id, the minted id and its signature, under `livediagram:v2:pending-signed-id`) **before** it asks the worker to move the data, and adopts the new id only once the move has succeeded. A reload or a closed tab can land between the two: the worker has already moved the data while the browser still holds the old id. The next load finds the pending record and repeats the move for that same pair (a second move of already-moved data changes nothing), then adopts the recorded id. Minting a fresh id instead would strand the data under the one the browser never kept, and every later save of that document would answer 403. The record is cleared once adopted, and ignored when it no longer starts from the id this browser holds. The row the move writes for the new id is stamped with the time of the move, never the legacy date: a new id that inherited it would itself count as legacy and could be moved by anyone holding it, without its signature.

## Guest documents start local

A guest's new document is **Local only** by default ([Offline Mode](../006-document/offline-mode.md), [Save Locations](../006-document/save-locations.md#the-default-depends-on-who-is-creating)): saved in this browser, never sent to the server until the guest asks for it.

**Why.** A guest cloud document is keyed to the browser's guest id in `localStorage`. Clearing site data loses that id, and with it every document under it: the server keeps the rows for good, but nobody can reach them again. Many first visits are someone trying the product out, so most of those rows are orphans the moment they are written. A Local only document is exactly as durable for a guest (the same clear wipes IndexedDB), costs the server nothing, and opens without a round trip ([Offline Mode → Instant open](../006-document/offline-mode.md#instant-open)).

- **Only with sign-in enabled.** Local first applies in the hybrid mode, where a guest has an account to move to. A guest-only deployment ([Three deployment modes](#three-deployment-modes)) keeps livediagram as the default: there is no account to come to, so the server is the only place a document is kept beyond the browser, and the operator chose to run one.
- **Signed-in people are unchanged.** Their default stays livediagram.
- **Moving to the server is always the guest's own act**: Sync Document (from the Share dialog, which explains why first, [Offline Mode → Sharing a Local only document](../006-document/offline-mode.md#sharing-a-local-only-document), or the Explorer), or the prompt after signing in (below). No guest document is uploaded silently.
- **Nothing is purged.** Guest cloud documents already on the server stay where they are; this changes where new ones start, not what happens to old ones.

### Who is a guest, before Clerk answers

Clerk loads deferred, so `/new` cannot wait for `useAuth` without making every create slower. It reads Clerk's own `__client_uat` cookie instead (`apps/live/lib/signed-in-hint.ts`): clerk-js writes it on the app's origin, readable from script, as `0` when signed out and the last sign-in time when signed in (checked against the dev instance on 2026-10-10: `__client_uat=0` plus a suffixed `__client_uat_<key>` twin, both `httpOnly=false`).

- **No `__client_uat*` cookie, or every one is `0`**: a guest. The create goes ahead at once, Local only.
- **Any non-zero value**: probably signed in. The create waits for auth to settle (as it always has) and then uses the settled answer.
- The hint only decides a default. Every request still authenticates the real way, and a guest whose cookie misleads gets a Local only document, the safe direction.

### Moving Local only documents after signing in

Signing in never moves a Local only document by itself ([Offline Mode → Auth / guest interaction](../006-document/offline-mode.md#auth--guest-interaction)). Instead, once auth has settled signed in (and the guest migrate above has settled), a page that shows the Explorer or the editor checks this browser's Local only documents. If there are any, it offers to move them:

- **Move Local Documents to Your Account?** A dialog lists each Local only document (name, last edited), every one ticked, with **Move** and **Not Now**.
- **Move** runs Sync Document ([Offline Mode → Save to server](../006-document/offline-mode.md#save-to-server-offline--cloud)) on each ticked document in turn, showing progress. A document that fails stays Local only and is named in the result; the rest move.
- **Not Now** is remembered for this account in this browser (`livediagram:v2:local-move-dismissed:<userId>`), with the count of Local only documents at the time. The dialog comes back only when that count grows, so a person who keeps a deliberate Local only document is not asked again about it.
- The same move is always reachable by hand: **Sync Document** on any Local only document.

## Implications for how we build

- UI must never block the canvas behind a sign-in wall.
- Features that genuinely need an account are surfaced as opt-in prompts ("Sign in to keep your documents"), never modal walls.
- The single persistence boundary (`apps/live/lib/api-client.ts` against the api worker — see [11-api.md](../015-api/api.md)) is the same in guest and authenticated mode. Only the request headers differ: a `localStorage`-minted UUID in `X-Owner-Id` for guests, a Clerk JWT in `Authorization` for signed-in users. The api-client's module-level `setTokenProvider` is the single switch.
- Public client code that uses Clerk uses only the **publishable key** (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`), never the secret key. See [06-secrets-policy.md](../002-project-scope/secrets-policy.md).
- The api worker's degraded-mode behaviour matters: with `CLERK_JWKS_URL` unset (no `[vars]` value in `wrangler.toml`), every request silently falls through to the guest path. Useful for local dev and for environments where Clerk hasn't been provisioned yet — the editor stays usable.
