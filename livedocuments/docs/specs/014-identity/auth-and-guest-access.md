# Auth + guest access

## Principle

**The canvas always works without signing in.** A first-time visitor can land on `/new`, create a document, build something real, and only later be asked to sign up. This is intentional — friction-free engagement is the acquisition strategy.

We don't put auth in front of the core experience. We add auth where it _enables_ something the user wants (sharing, syncing, collaborating, paying).

## Three deployment modes

| Mode                 | Configuration                                                                                                                        | Frontend                                                                                                    | API worker                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Hybrid (production)  | `NEXT_PUBLIC_SIGN_IN_ENABLED=true` + the api's `ACCOUNTS_URL`, `API_RESOURCE`, `ACCOUNTS_CLIENT_ID`, `ACCOUNTS_CLIENT_SECRET`        | The accounts bridge asks for the session. Guests + signed-in users coexist.                                 | Verifies Bearer, falls through to `X-Owner-Id`. |
| Guest-only           | The flag unset (local dev without sign-in, per [Open source + distribution](../002-project-scope/open-source-and-business-model.md)) | No bridge. Auth routes show "not enabled" notice. Editor unchanged.                                         | Falls through to `X-Owner-Id` on every request. |
| Guest-only (partial) | Frontend flag on, api unconfigured                                                                                                   | `/api/auth/*` answers 404 `sign_in_not_configured`, so every visitor settles as a guest and cannot sign in. | `X-Owner-Id` only.                              |

The first two are the supported modes. The third is a misconfiguration — useful for debugging, not for prod.

The `signInEnabled` flag (`apps/editor/lib/auth-config.ts`) is the single source of truth on the frontend. Every sign-in-aware module reads it (or `sessionsEnabled`, which also counts the test-only e2e bridge) and picks one of two implementations at module load:

- `AuthProvider` mounts no bridge, so the deferred auth context settles as a guest.
- `useAccountBootstrap` returns a stable stub (`isSignedIn: false`, `authLoaded: true`, `accountUserId: null`).
- `AuthControls` renders nothing.
- `/sign-in/` and `/get-started/` render an `AuthDisabledNotice` with a "Continue as guest" CTA.

Because `NEXT_PUBLIC_*` vars are baked at build time, the choice is a compile-time constant — no per-render cost and sign-in-only code paths can be tree-shaken out of guest-only builds.

**At most one session request per page load.** The root layout's `AuthProvider` is deferred: the app tree consumes `DeferredAuthContext`, and a lazily-loaded `AccountsBridge` (`apps/editor/components/providers/AccountsBridge.tsx`, an async chunk) asks the api for the session with one `POST /api/auth/token` and publishes the result. A browser without the `lp_signed_in` hint ([below](#who-is-a-guest-before-sign-in-answers)) has no session to find, so it settles as a guest at once and asks nothing: a guest's page load makes no auth request. It holds the access token in memory only, reuses it until a minute before it expires, and shares one refresh among concurrent asks (each refresh rotates the refresh token, so two at once would race). Signing in and out are full-page visits, so no state from before signing in survives into the signed-in page.

## Signing in

livedocuments has no sign-in form of its own. People sign in to their **liveworkspace account** on the accounts site (`liveworkspace.app`, an OAuth 2.1 / OpenID Connect provider shared by the liveworkspace apps), by emailed code, and come back signed in. The api worker is the OAuth client (`apps/api/src/routes/auth.ts`), so the client secret and the refresh token never reach page script:

1. **`GET /api/auth/sign-in?return_to=<path>`** sends the browser to the accounts site's authorize endpoint with PKCE (S256), a random `state`, and this API's resource (`API_RESOURCE`) so the access token is minted for livedocuments alone. The verifier, state and return path ride a 10-minute HttpOnly `lp_pkce` cookie scoped to `/api/auth`.
2. **`GET /api/auth/callback`** checks `state` against the cookie, swaps the code for tokens with the client secret, keeps the refresh token in an HttpOnly, `SameSite=Strict` `lp_refresh` cookie scoped to `/api/auth`, sets the readable `lp_signed_in=1` hint ([below](#who-is-a-guest-before-sign-in-answers)), counts the sign-in once (`reportSignIn`, [Telemetry](../017-telemetry/telemetry.md)), and returns to the safe path. A mismatched or missing state lands on `/sign-in?error=expired`, a failed swap on `/sign-in?error=failed`.
3. **`POST /api/auth/token`** turns the refresh cookie into a fresh access token and the account (`{ id, email, name }`, from the id token), rotating the cookie. No cookie answers `401 { signedIn: false }`; a refused refresh clears both cookies.
4. **`POST /api/auth/sign-out`** clears both cookies. It ends the livedocuments session only: the accounts site keeps its own, so the next sign-in may not ask for a code.

Every response is `Cache-Control: no-store`, and the routes are rate limited per network. Locally, behind the router, `AUTH_ORIGIN=http://localhost:3300` makes the callback come back through the router; the accounts Worker must list `<origin>/api/auth/callback` as a redirect URI for each origin.

## Hybrid identity

The api worker accepts **two equivalent ways** of identifying the request owner, in this order of preference:

1. **Account access token** — `Authorization: Bearer <token>`. Verified in `apps/api/src/auth/accounts.ts` with `createVerifier` from `@liveworkspace/auth-client`: a local signature check against the accounts Worker's published keys (`${ACCOUNTS_URL}/api/auth/jwks`, cached per isolate), plus its issuer (`${ACCOUNTS_URL}/api/auth`) and this API's own audience (`API_RESOURCE`), so a token minted for another liveworkspace app is refused. The token's `sub` claim is the owner id; its `email` is trusted only when `email_verified` is true.
2. **Guest header** — `X-Owner-Id: <participant-id>`. The participant id is a `crypto.randomUUID()` minted on first visit and persisted in `localStorage` under `livedocuments:v2:self-id`. Every other random value the editor rolls for a guest — the display name and the presence colour — goes through `apps/editor/lib/random.ts`, which draws from `crypto.getRandomValues` rather than `Math.random`. None of it guards a secret, but a weak generator feeding values that read as identity is what static analysis flags, and the strong one is free in every runtime we target.

When both are present the Bearer wins. When verification fails (expired token, wrong audience, sign-in not configured, etc.) the worker falls through to the guest header, never a 401 of its own, because the guest path must always serve. The fall-through is logged as `[auth] access_token_rejected` (never the token).

**An account id is never a guest credential.** The worker refuses an account id (`user_…`; accounts carried over from Clerk kept their ids) in `X-Owner-Id` with `401 account_id_not_a_guest_credential` ([Public API and API tokens](../015-api/public-api-and-tokens.md)). The editor holds the same rule from its side (`identityHeaders` in `apps/editor/lib/api/core.ts`, shared with the unload beacon): a signed-in client whose `getToken()` resolves null asks once more with `{ skipCache: true }`, and if that is null too it throws `SessionTokenUnavailableError` instead of sending its account id as the guest header. `getToken()` does resolve null now and then on a live session; before the worker refused the shape that null went out as `X-Owner-Id: user_…` unnoticed, and afterwards it showed as "Couldn't save your changes. Check your connection." on a working network. The autosave reports both a 401 and a missing token as `unauthenticated` ([Per-tab storage](../006-document/per-tab-storage.md)).

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

Three routes inside `apps/editor/`:

- **`/sign-in/`** and **`/get-started/`** (`components/chrome/AuthHandoff.tsx`) hand the visitor straight to `/api/auth/sign-in`, which goes on to the accounts site. The accounts site signs new and returning people in alike, so the two routes differ only in where they land afterwards: **sign-in → the Explorer** (`POST_AUTH_SIGNIN_DEFAULT`), **sign-up → the welcome / new-document flow** (`POST_AUTH_DEFAULT`, `/new`). The hand-off uses `location.replace`, so Back from the accounts site skips the interstitial. When `/api/auth/callback` sends the browser back with `?error=expired` or `?error=failed`, the page shows what went wrong with a **Try again** link instead of redirecting.
- **`?redirect_url=...`** — the return destination. Routes are clean (no `/live` prefix — [Router app](../016-platform/router-app.md)), so a valid `redirect_url` is any **same-origin path**. `resolvePostAuthDestination(searchParams, default)` in `components/chrome/auth-shared.tsx` validates it (`isSafeInternalPath`): the path must start with a single `/` — NOT `//` or `/\` (the protocol-relative / backslash open-redirect tricks) — and must not point back at `/sign-in` or `/get-started` (loop guard). Missing, unsafe or auth-page values fall back to the per-route default. `accountsSignInUrl(destination)` carries it to the api as `return_to`, and the api checks it again (`safeReturnPath`) before it redirects anywhere.
  - **Every in-app trigger builds the param.** So a visitor who clicks any "Sign in" / "Create account" affordance returns to the page they were on after auth — not a generic default. `authHrefWithReturn(authPath, returnTo)` composes `?redirect_url=<encoded returnTo>` through the **same** `isSafeInternalPath` guard (an unsafe or auth-page `returnTo` is dropped, yielding a bare auth href — never a loop or open redirect), and the `useAuthReturnPath()` hook supplies the visitor's live location (path + query + `#t=<tab>` hash, so you land back on the exact tab). Every trigger — the header pill (`AuthControls`), the floating banner + its reasons modal (`SignInBanner` / `SignInReasonsModal`), the Explorer sidebar/pane + guest prompts (`ExplorerSidebar` / `ExplorerPane` / `SignInPrompt`), and the `/join` invite page — uses it.
- **`/explorer/`**: standalone full-page Explorer (item #12). Open to both guests and signed-in users: the owner id resolves the same way every other surface in the editor app does (the account id when signed in, the `livedocuments:v2:self-id` localStorage UUID otherwise), so a guest sees the documents + folders + Image Gallery their per-browser id owns. Reached from the AuthControls dropdown's "Explorer" menu item (the same label [Editor app](../007-editor/editor-app.md) uses for the mobile entry point). Signed-out visitors get the same "Sign in" CTA as everywhere else (AuthControls in the page header), the page itself doesn't gate. Guest data is per-browser by definition (no cross-device sync until they sign up and migrate).

The shared card chrome lives in `apps/editor/components/chrome/auth-shared.tsx` so the two pages don't drift.

### The look: Night Band

Every account and connect page (`/sign-in`, `/get-started`, the OAuth consent and device pages and
the workbench pairing page) stands on one frame, `AuthStage` (`apps/editor/components/chrome/AuthStage.tsx`), modelled on
the marketing site's "No Catch" night section:

- **Header.** The brand at the top left. On `/sign-in` and `/get-started` a **"Not now, keep going as a guest"** link
  sits at the top right, because the canvas never needs an account. It goes back to the page's `?redirect_url` when
  that is safe and is not itself a signed-in-only page (`/oauth/*`, `/workbench/*`), and to `/new` otherwise
  (`guestReturnHref`). The connect pages have no guest link: they only work signed in.
- **The card.** A near-opaque card (no backdrop blur, so the lines moving behind it never make it repaint) holding the page's title (the `h1`), an optional line under it, the error or notice, and its action (on
  `/sign-in` after a failed hand-off, **Try again**).
- **The pitch.** Beside the card, an eyebrow, a heading and its promise rows (four on the account pages, three on the connect pages), each a tinted icon, a coloured lead
  and a line. The account pages say what an account adds ("No catch": every device, teams to create and join, AI tools, 0 paywalls); the connect
  pages say what connecting means ("Connect": live, your call, revoke any time). The pitch holds no controls.
- **Decorative lines keep drawing** behind the content on wide screens, in any direction: four slots each take a
  random route that enters through one edge and leaves through another, bending across the stage on the way
  (`randomTrace`, `components/chrome/auth-lines.ts`). A route draws in, holds, then trails off the far edge over 14
  seconds, and its slot takes a fresh route the moment it ends; the first round starts the slots a quarter cycle apart,
  so a new line is always on its way. Routes are chosen in the browser after mount. They are hidden from assistive
  technology and absent below the `lg` breakpoint. Under reduced motion (the OS setting or the person's own preference)
  two fixed routes through the margins stand still, fully drawn, and nothing moves.
- **The entrance** draws the page in a beat at a time, at the marketing hero's pace
  ([Motion](../004-interface-design/motion.md#content-pacing)): the header, eyebrow and heading rise in, the card lands
  with a slight tilt and overshoot like a shape dropped on the canvas, the promise rows slide in like stickies being
  placed and each row's icon pops once its row has landed. Everything has settled by about 660ms; under reduced motion
  the page simply appears.
- **Large screens.** From `2xl` the frame widens to 88rem, the pitch heading grows, the promise rows sit in a
  two-by-two grid and the card gains room; from 1920px the whole frame (not the lines) is zoomed 1.2 times, and 1.35
  times from 2400px, so a big monitor is filled at a readable size rather than left with a small island.
- **Both themes.** Dark mode wears the Midnight palette (the root carries `data-palette="midnight"` while the frame is
  mounted, as on the Explorer; [Colour scheme](../004-interface-design/color-scheme.md#explorer-midnight)), so the
  page is the night section itself. Light mode is the same layout on a pale dotted ground (`slate-100`) with a white
  card and the darker accent inks (`emerald-700`, `brand-700`, `amber-700`), all at WCAG 2.2 AA. Small text that
  sits on the bare ground (the eyebrow, the guest link) is `brand-800`, so it holds 4.5:1 even over a grid dot.
- **Phone first.** Below `lg` the card comes first and the pitch follows it, stacked, compact and full width with a
  16px gutter; at `lg` and up the pitch takes the left column and the card the right. The card is first in the DOM at
  every width, so the form is what a screen reader and the Tab key reach first.
- **Interstitials** (the redirecting card) use the same frame with no pitch, the card centred, so a
  hand-off between pages never flashes a different ground.

Signed-in status surfaces in the editor header via `<AuthControls>` (initial bubble + Sign out menu). Signed-out users see a "Sign in" link in the same slot. Neither blocks the editor — they're purely informational.

## Identity display name

A signed-in user's participant `name` is driven by their liveworkspace account's name (split at its first space into `firstName + lastName`, falling back to the email's local part when the account has no name; `namesOf` in `AccountsBridge.tsx`). On every editor mount we seed the participant record with the current account name, and re-`PUT` it whenever it has drifted from the persisted value — so renaming yourself on the accounts site propagates to everything that reads the participant row on the next load.

Two welcome-modal rules follow from that:

- **Owner on their own document**: the identity-only welcome screen never opens. The user's identity is already settled by their account; prompting them to pick a display name on a document they own would be noise.
- **Visitor on someone else's document (signed in)**: the welcome screen still opens (it carries the "you're joining X's document" context), but the "Your name" input is `readOnly` and the shuffle button hides. Visitors who _are_ signed in can't masquerade under a different display name on a host's document.

Guests see the legacy behaviour in both cases — first-load identity prompt, fully editable name, shuffle button present.

The join prompt is **independent of share role**: both **edit-role and view-role** visitors get it. A viewer's display name is broadcast to everyone else (cursor label, the tab presence stack, comments), so they need a chance to set it before joining rather than appearing under a random default. The identity card only writes the visitor's **own** participant row (`PUT /api/participants/:id`, authorised on `owner === id`, not on document-edit rights), so confirming a name never hits a `403` even for a read-only viewer. The card's edit-only affordances (template grid, theme grid) don't render in identity mode, so there's nothing a viewer could trigger that they lack permission for.

## Guest → account migration

When a guest signs up, the documents they built as a guest **migrate into their account** rather than being lost. They've already invested effort — losing it on sign-up would be the opposite of friction-free.

Mechanism (see also [API app — `POST /api/migrate`](../015-api/api.md)):

1. Every page that talks to the api mounts `useAccountBootstrap`, which watches `isSignedIn + accountUserId` from the deferred auth context.
2. The first time both are truthy AND `livedocuments:v2:self-id` is still in `localStorage` AND the stored id differs from the account id, the page calls `POST /api/migrate { guestOwnerId: <localStorage id>, guestSignature: <localStorage signature> }` with the account access token.
3. The worker (signed-in only, no `X-Owner-Id` fallback for this endpoint) **verifies the guest id's HMAC signature** (possession proof — see "Signed guest ids" below) and then moves every guest-holdable row from the guest id to the account id: documents, folders, shared-with-you visits, favourites, preferences, custom themes, images, the participant row, the timeline and the Activity index. [Owner-keyed data](../015-api/api.md#owner-keyed-data) is the one list of those tables, with how each handles a row the account already has. Where both identities hold the same row, the account's copy wins, as the more recent and authoritative one; an image whose bytes the account already uploaded stays at the guest id so formerly-guest documents keep resolving it ([Image element + per-owner gallery](../009-elements/images.md)). Tables keyed on `document_id` follow their document for free.
4. On success the page removes the localStorage key. The migration is idempotent — a retry with the same `guestOwnerId` simply moves zero rows.
5. **Owner data waits for the migration.** Until the migration settles, `authLoaded` stays false, so no page reads or writes as the account id while the guest's rows still belong to the guest id. Otherwise the document that was open when the user signed in loads as the account id before it has moved, and the editor shows "document does not exist" instead of the document. The migration runs once per page load, however many components mount the hook. A failed migration settles too (the guest id stays in `localStorage`, so the next load retries), and a migration still pending after `GUEST_MIGRATION_WAIT_MS` (10 s) stops holding the page, so a hung request never blocks the editor. The pending state is an external store (`subscribeGuestMigration` in `apps/editor/lib/guest-migration.ts`): settling notifies every mount, which is what releases `authLoaded`.

The participant row moves too, so a guest who picked a name and colour keeps them. A signed-in user's name then follows their account on the next load when it carries one, and an account that already had a participant row keeps its own. Leaving the guest row behind would strand a name the user typed under an id nobody holds, out of reach of a later account deletion.

### Signed guest ids (migrate possession proof)

A guest's `X-Owner-Id` is a bearer value that **leaks**: it rides in document DTOs and realtime presence frames. Without a possession proof, `POST /api/migrate` trusted a body-supplied `guestOwnerId` outright, so anyone who merely _observed_ a victim's guest id could reassign all of that guest's documents / folders / images into their own account. To close this, guest ids are HMAC-signed:

- **Server-minted.** When `GUEST_ID_HMAC_SECRET` is set, the editor app calls `POST /api/guest-id` during identity bootstrap; the worker **generates** the id and returns it with its HMAC signature (`auth/owner-signature.ts`). Because the server chooses the id, a caller can only ever hold a signature for an id the server handed _them_ — never for an id observed elsewhere. The signature is cached in `localStorage` under `livedocuments:v2:self-sig` and is **never** returned in any DTO or presence frame; only the bare id is.
- **Signed before the first owner-scoped call, on every entry path.** Every page a guest can arrive on first (`/` and `/new`, the Explorer, the editor, the team invite `/join`) resolves the guest's identity through the signed mint (`ensureSignedGuestIdentity`, shared as the `useSignedGuestId` hook) and makes no owner-scoped api call until it has. A local unsigned id is only the offline fallback. Once enforcement is armed, a path that skipped it refuses a first-time visitor: `/new` once minted a local unsigned id, and with enforcement armed on 2026-10-06 a new visitor from the landing page could not create a document until it was un-armed the same day.
- **Verified on migrate.** `POST /api/migrate` requires a valid signature for the source guest id before reassigning ownership. Knowing the id is no longer enough.
- **Defence in depth.** The owner's id is not returned to non-owner readers at all: `redactDocumentForReader` (`apps/api/src/redact-document.ts`) blanks it on **both** doors that hand out a document DTO — the share resolver (`GET /api/share/<code>`) and the document fetch (`GET /api/documents/<id>`). The second one mattered and was missed for a while: the share resolver was fixed as "the easiest observation vector" while the raw fetch kept returning the id intact to the same audience, because `canReadDocument` admits any valid share code, view or edit — a view-only visitor has to be able to open the document. One redaction guarding one of two doors is not defence in depth, so the rule now lives in one module with its own tests and both call sites use it. Blanking costs non-owners nothing: the client reads `ownerId` only to compute `isOwner` (correctly false for a blank) and `resolveOwnerBadge` already falls back to the owner's name + colour. The same function nulls the document's primary `shareCode` for non-owners: it is the document's oldest link of any role, so a view-link visitor who received it held an edit link. Visitors already hold the code they arrived with, and only the owner manages links.
- **Optional.** When `GUEST_ID_HMAC_SECRET` is unset, signing is disabled and migrate keeps its legacy unsigned behaviour — fine for local dev. Production sets the secret (provisioned like the sign-in secrets, from the GitHub secret of the same name; staging takes its own value from `GUEST_ID_HMAC_SECRET_STAGING`, which must differ or a guest id minted on staging would be claimable on production).

  **This is the switch that closes the hole, and for a long time nobody threw it.** The signing code shipped 2026-06-08 deliberately inert — "until the secret is configured in prod this is behaviourally a no-op" — and the secret was never set, so production ran the legacy unsigned migrate for months while the spec above described a protection that wasn't active. Worth stating plainly because the failure was invisible from the code: every file read as though the guard were on. If you are auditing this, **check the deployment, not the source** — `POST /api/guest-id` returning `"ownerSig": null` means signing is off, whatever this spec says. Note also that the secret alone is what protects `/api/migrate`; `GUEST_SIG_ENFORCE_AFTER` ([Public API and API tokens §4](../015-api/public-api-and-tokens.md)) is a separate, later switch covering the ordinary REST routes, and it can't do anything while the secret is missing.

- **Legacy upgrade.** A guest created before signing shipped has an unsigned id and so can't satisfy the check. On the next editor load the bootstrap mints a signed id and migrates the old data onto it via a guest→guest migrate (flow 2, authenticated by the old id as `X-Owner-Id` — the same bearer credential every guest request uses; if it fails the old id is kept so nothing is orphaned). **Residual:** this guest→guest step is only bearer-authenticated, so a legacy (pre-signing) id that an attacker already captured via presence could be claimed during the transition window. Once enforcement is armed, this step stays open only to an id whose participant row predates `GUEST_SIGNING_LIVE_AT` (production: 2026-09-25 12:00 UTC, when signing actually started), so a returning legacy guest still keeps their documents while an id minted signed cannot be moved without its signature. New guests are never exposed; the window shrinks to nothing as legacy ids age out, and both DTO leak paths are now closed (see "Defence in depth" above — one of them only recently, so don't read the earlier wording as meaning the leak was ever fully shut).
- **A refused upgrade adopts the signed id.** The worker refuses (`403`) an unsigned upgrade from an id that is not pre-signing once enforcement is armed; that id's server data is unreachable already, so the browser adopts the signed id instead of keeping one it can never use. The usual source is a local id minted when the first mint never landed (offline, or a navigation that cut the request short). Offline documents carry no guest id, so none are lost. An upgrade that cannot reach the worker still keeps the old id and retries on the next load.
- **An interrupted upgrade resumes; it never mints again.** The bootstrap records the pending upgrade (the old id, the minted id and its signature, under `livedocuments:v2:pending-signed-id`) **before** it asks the worker to move the data, and adopts the new id only once the move has succeeded. A reload or a closed tab can land between the two: the worker has already moved the data while the browser still holds the old id. The next load finds the pending record and repeats the move for that same pair (a second move of already-moved data changes nothing), then adopts the recorded id. Minting a fresh id instead would strand the data under the one the browser never kept, and every later save of that document would answer 403. The record is cleared once adopted, and ignored when it no longer starts from the id this browser holds. The row the move writes for the new id is stamped with the time of the move, never the legacy date: a new id that inherited it would itself count as legacy and could be moved by anyone holding it, without its signature.
- **One tab upgrades at a time.** Two tabs opened together on a legacy id would each mint a signed id and each move the data, and the tab whose identity lands in storage last could hold an id the data no longer sits under. The bootstrap therefore runs under the Web Lock `livedocuments-guest-upgrade` (`apps/editor/lib/guest-identity.ts`) and reads storage only once it holds the lock, so the second tab adopts the signed identity the first one wrote instead of minting its own. A browser without `navigator.locks` resolves unserialised, as before.

## Deleting an account

Settings > Account > Delete Account deletes the whole account: the person's livedocuments data and their **liveworkspace account**, which closes it in every liveworkspace app. Then it ends the session:

1. **Delete the server data, then close the account** (`DELETE /api/account`, [API](../015-api/api.md)). The worker removes documents, folders, the participant row and the rest of the [owner-keyed data](../015-api/api.md#owner-keyed-data), then asks the accounts Worker to close the account (`closeAccount` from `@liveworkspace/auth-client`: `POST /api/auth/delete-account` with this app's client credentials and the caller's access token). Closing it removes the account's sessions, its Google link, and every app's refresh tokens. The response clears the refresh cookie.
2. **End the session** (`POST /api/auth/sign-out`), then a full load to the landing page.

The data goes first: closed first, an account whose data delete then failed could never be signed in to again to finish it. If closing fails after the data has gone, the worker answers `502 { error: 'account_not_closed' }`, the dialog says the data is gone but the account is not, and the person, still signed in, can ask again (the data delete is idempotent). Signing in again afterwards with the same email or Google account makes a new, empty account.

There is no separate step-up confirmation: the dialog's own confirmation is the gate, and the session that asks is already a verified one.

## Guest documents start local

A guest's new document is **This Browser** by default ([Offline Mode](../006-document/offline-mode.md), [Save Locations](../006-document/save-locations.md#the-default-depends-on-who-is-creating)): saved in this browser, never sent to the server until the guest asks for it.

**Why.** A guest cloud document is keyed to the browser's guest id in `localStorage`. Clearing site data loses that id, and with it every document under it: the server keeps the rows for good, but nobody can reach them again. Many first visits are someone trying the product out, so most of those rows are orphans the moment they are written. A document in This Browser is exactly as durable for a guest (the same clear wipes IndexedDB), costs the server nothing, and opens without a round trip ([Offline Mode → Instant open](../006-document/offline-mode.md#instant-open)).

- **Only with sign-in enabled.** Local first applies in the hybrid mode, where a guest has an account to move to. A guest-only deployment ([Three deployment modes](#three-deployment-modes)) keeps livedocuments as the default: there is no account to come to, so the server is the only place a document is kept beyond the browser, and the operator chose to run one.
- **Signed-in people are unchanged.** Their default stays livedocuments.
- **Moving to the server is always the guest's own act**: Sync Document (from the Share dialog, which explains why first, [Offline Mode → Sharing a document in This Browser](../006-document/offline-mode.md#sharing-a-document-in-this-browser), or the Explorer), or the prompt after signing in (below). No guest document is uploaded silently.
- **Nothing is purged.** Guest cloud documents already on the server stay where they are; this changes where new ones start, not what happens to old ones.

### Who is a guest, before sign-in answers

The session loads deferred, so `/new` cannot wait for the token request without making every create slower. It reads the `lp_signed_in` hint cookie instead (`apps/editor/lib/signed-in-hint.ts`): the api sets it to `1` beside the HttpOnly refresh cookie when a sign-in completes, readable from script and holding no secret, and to `0` on sign-out or when a refresh is refused (`signedInHintOf` in `packages/api-schema/src/signed-in-hint.ts`, shared with the site header's primary link and the Repair page).

- **No hint, or `lp_signed_in=0`**: a guest. The create goes ahead at once, This Browser.
- **`lp_signed_in=1`**: probably signed in. The create waits for auth to settle (as it always has) and then uses the settled answer.
- The hint only decides a default. Every request still authenticates the real way, and a guest whose cookie misleads gets a document in This Browser, the safe direction.

### Moving documents in This Browser after signing in

Signing in never moves a document in This Browser by itself ([Offline Mode → Auth / guest interaction](../006-document/offline-mode.md#auth--guest-interaction)). Instead, once auth has settled signed in (and the guest migrate above has settled), a page that shows the Explorer or the editor checks this browser's documents in This Browser. If there are any, it offers to move them:

- **Move Documents in This Browser to Your Account?** A dialog lists each document in This Browser (name, last edited), every one ticked, with **Move** and **Not Now**.
- **Move** runs Sync Document ([Offline Mode → Save to server](../006-document/offline-mode.md#save-to-server-offline--cloud)) on each ticked document in turn, showing progress. A document that fails stays This Browser and is named in the result; the rest move.
- **Not Now** is remembered for this account in this browser (`livedocuments:v2:local-move-dismissed:<userId>`), with the count of documents in This Browser at the time. The dialog comes back only when that count grows, so a person who keeps a deliberate document in This Browser is not asked again about it.
- The same move is always reachable by hand: **Sync Document** on any document in This Browser.

## Implications for how we build

- UI must never block the canvas behind a sign-in wall.
- Features that genuinely need an account are surfaced as opt-in prompts ("Sign in to keep your documents"), never modal walls.
- The single persistence boundary (`apps/editor/lib/api-client.ts` against the api worker — see [11-api.md](../015-api/api.md)) is the same in guest and authenticated mode. Only the request headers differ: a `localStorage`-minted UUID in `X-Owner-Id` for guests, an account access token in `Authorization` for signed-in users. The api-client's module-level `setTokenProvider` is the single switch.
- Page script never holds the client secret or the refresh token: both live only in the api worker and its HttpOnly cookie, and the access token lives only in memory. See [06-secrets-policy.md](../002-project-scope/secrets-policy.md).
- The api worker's degraded-mode behaviour matters: with `ACCOUNTS_URL` or `API_RESOURCE` unset, every request silently falls through to the guest path. Useful for local dev and for environments where sign-in hasn't been provisioned yet — the editor stays usable.
