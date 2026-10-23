# Auth + guest access

## Principle

**The canvas always works without signing in.** A first-time visitor can land on `/new`, create a document, build something real, and only later be asked to sign up. This is intentional — friction-free engagement is the acquisition strategy.

We don't put auth in front of the core experience. We add auth where it _enables_ something the user wants (sharing, syncing, collaborating, paying).

## Three deployment modes

| Mode                | Configuration                                                                                                                                                     | Frontend                                                                                                                                                          | API worker                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Hybrid (production) | `NEXT_PUBLIC_SIGN_IN_ENABLED=true` + the api's `ACCOUNTS_URL`, `API_RESOURCE`, `ACCOUNTS_CLIENT_ID`, `ACCOUNTS_CLIENT_SECRET`                                     | The accounts bridge asks for the session. Guests + signed-in users coexist.                                                                                       | Verifies the Bearer: an account's access token or a guest token. |
| Guest-only          | The flag unset, the api's `ACCOUNTS_*` set (a self-host without sign-in per [Open source + distribution](../002-project-scope/open-source-and-business-model.md)) | No bridge. Auth routes show "not enabled" notice. Guests get their guest token from the accounts site as usual.                                                   | Verifies the guest token's Bearer.                               |
| No accounts site    | The api's `ACCOUNTS_*` unset                                                                                                                                      | `/api/auth/guest` returns straight to `/auth/guest#error=guest_not_configured` and `/api/auth/*` answers 404 `sign_in_not_configured`: visitors have no identity. | Resolves no owner, so no document can be kept on the server.     |

The first two are the supported modes. **Guests need the accounts site too**: a guest's identity is a guest token the liveworkspace accounts site mints ([Guest identity](#guest-identity)), so a deployment without it has no guests. Its visitors can still draw in documents in This Browser, but cannot own a document on the server. That mode suits only a quick local try-out.

The `signInEnabled` flag (`apps/editor/lib/auth-config.ts`) is the single source of truth on the frontend. Every sign-in-aware module reads it (or `sessionsEnabled`, which also counts the test-only e2e bridge) and picks one of two implementations at module load:

- `AuthProvider` mounts no bridge, so the deferred auth context settles as a guest.
- `useAccountBootstrap` returns a stable stub (`isSignedIn: false`, `authLoaded: true`, `accountUserId: null`).
- `AuthControls` renders nothing.
- `/sign-in/` and `/get-started/` render an `AuthDisabledNotice` with a "Continue as guest" CTA.

Because `NEXT_PUBLIC_*` vars are baked at build time, the choice is a compile-time constant — no per-render cost and sign-in-only code paths can be tree-shaken out of guest-only builds.

**At most one session request per page load.** The root layout's `AuthProvider` is deferred: the app tree consumes `DeferredAuthContext`, and a lazily-loaded `AccountsBridge` (`apps/editor/components/providers/AccountsBridge.tsx`, an async chunk) asks the api for the session with one `POST /api/auth/token` and publishes the result. A browser without the `ld_signed_in` hint ([below](#who-is-a-guest-before-sign-in-answers)) has no session to find, so it settles as a guest at once and asks nothing: a guest's page load makes no auth request. It holds the access token in memory only, reuses it until a minute before it expires, and shares one refresh among concurrent asks (each refresh rotates the refresh token, so two at once would race). Signing in and out are full-page visits, so no state from before signing in survives into the signed-in page.

## Signing in

livediagram has no sign-in form of its own. People sign in to their **liveworkspace account** on the accounts site (`liveworkspace.app`, an OAuth 2.1 / OpenID Connect provider shared by the liveworkspace apps), by emailed code, and come back signed in. The sign-in and registration pages are served on livediagram.app's own address by its router ([Router app](../016-platform/router-app.md#signing-in-on-livediagramapp)), so the address stays livediagram.app throughout but for one momentary hop to liveworkspace.app that gives it the liveworkspace session, so the other apps sign in without a click ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Signing in on the app's own address"). The api worker is the OAuth client (`apps/api/src/routes/auth.ts`), so the client secret and the refresh token never reach page script:

1. **`GET /api/auth/sign-in?return_to=<path>`** sends the browser to the accounts site's authorize endpoint with PKCE (S256), a random `state`, and this API's resource (`API_RESOURCE`) so the access token is minted for livediagram alone. The verifier, state and return path ride a 10-minute HttpOnly `ld_pkce` cookie scoped to `/api/auth`.
2. **`GET /api/auth/callback`** checks `state` against the cookie, swaps the code for tokens with the client secret, keeps the refresh token in an HttpOnly, `SameSite=Strict` `ld_refresh` cookie scoped to `/api/auth`, sets the readable `ld_signed_in=1` hint ([below](#who-is-a-guest-before-sign-in-answers)), counts the sign-in once (`reportSignIn`, [Telemetry](../017-telemetry/telemetry.md)), clears the `ld_signed_out` mark ([below](#signing-in-without-a-click)), and returns to the safe path. A mismatched or missing state lands on `/sign-in?error=expired`, a failed swap on `/sign-in?error=failed`.
3. **`POST /api/auth/token`** turns the refresh cookie into a fresh access token and the account (`{ id, email, name }`, from the id token), rotating the cookie. No cookie answers `401 { signedIn: false }`; a refused refresh clears both cookies.
4. **`POST /api/auth/sign-out`** clears both cookies and sets the readable `ld_signed_out=1` mark (the whole site, 400 days), so [signing in without a click](#signing-in-without-a-click) never undoes the sign-out; the next sign-in here clears it. It ends the livediagram session only: the liveworkspace session and the other apps stay signed in, so signing in here again is one click with no code.

Every response is `Cache-Control: no-store`, and the routes are rate limited per network. Locally, behind the router, `AUTH_ORIGIN=http://localhost:3200` makes the callback come back through the router; the accounts Worker must list `<origin>/api/auth/callback` as a redirect URI for each origin.

### Signing in without a click

Someone signed in to liveworkspace (in another app, or on liveworkspace.app) who opens livediagram with no session here is signed in by the page itself. livediagram can't see the liveworkspace session from script (that would need another site's cookies, which Safari and Chrome withhold), so it takes one quick full-page bounce through the accounts site ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Signing in without a click"; the code is `@liveworkspace/auth-client/silent`):

1. An inline script first in `<head>` (`SILENT_SIGN_IN_BOOT_SCRIPT`, `apps/editor/app/pre-hydration-scripts.ts`) runs before anything renders. With no `ld_signed_in=1` hint it marks the tab's `sessionStorage`, stops the page loading (so nothing signed-out paints and no app code starts) and goes to **`GET /api/auth/silent?return=<path?query#hash>`**.
2. That route sends the browser to the accounts site's authorize with `prompt=none`, keeping the PKCE verifier and the return address in its own HttpOnly `ld_silent_pkce` cookie (a clicked sign-in in another tab keeps `ld_pkce`) and setting a two-minute readable `ld_silent` guard. The accounts site answers at once, never with a page: a code when there is a session, `error=login_required` when not.
3. **`GET /api/auth/callback`** knows the bounce by its cookie's `state`. With a code it signs in exactly as step 2 above does; with an error, or a failed swap, it does nothing. Either way it goes back to the same path, query and hash.

It never bounces more than once per tab, nor in any tab within two minutes of the last bounce (`ld_silent`); with a session here; after the person signed out of livediagram (`ld_signed_out=1`); inside a frame (embeds, the workbench); for a crawler or an automated browser (`navigator.webdriver`, which keeps the e2e suites unbounced); on `/sign-in`, `/get-started`, `/auth/*`, `/oauth/*`, `/embed/*`, `/workbench/*` or a share link (`?s=`); or when the API isn't on the page's own origin (an app's dev server on its own port). The route refuses the bounce for the signed-out mark and the guard too, and whatever goes wrong (no sign-in configured, rate limited) it goes straight back to the page, never to an error.

**The cost** is one bounce per new tab for anyone without a session here: four extra requests (the stopped page, the route, the accounts site, the callback). Measured locally against the dev stacks it adds about 85 ms to a signed-in person's first load and about 50 ms to a guest's; later loads in the tab add nothing. A guest's things still become the account's: the accounts site merges a guest at a sign-in that finds its session already there, as at any other ([Guest → account merge](#guest--account-merge)).

## Hybrid identity

Every person the api knows is a liveworkspace identity, and both kinds arrive the same way, as `Authorization: Bearer <token>`:

1. **Account access token.** A signed-in person's token, from the session ([Signing in](#signing-in)). Its `sub` claim is the owner id (`user_…`); its `email` is trusted only when `email_verified` is true.
2. **Guest token.** A guest's token ([Guest identity](#guest-identity)). Its id, `guest_<uuid>`, is the owner id.

Both are verified in `apps/api/src/auth/accounts.ts` with `createPersonVerifier` from `@liveworkspace/auth-client`, which answers a kind (`account` or `guest`): a local signature check against the accounts Worker's published keys (`${ACCOUNTS_URL}/api/auth/jwks`, cached per isolate), plus its issuer (`${ACCOUNTS_URL}/api/auth`) and this API's own audience (`API_RESOURCE`), so a token minted for another liveworkspace app is refused. No request calls the accounts Worker. API tokens (`lwt_…`) and workbench sessions resolve on their own paths ([Public API and API tokens](../015-api/public-api-and-tokens.md)).

When verification fails (expired, forged, minted for another app, or sign-in not configured) the worker resolves no owner, never a 401 of its own: the request goes on as a link visitor's, which a share code can still admit. The refusal is logged as `[auth] access_token_rejected` (never the token).

**An owner id is never a credential.** Only a verified token says who is asking. Knowing someone's id, an account's or a guest's, lets a caller do nothing as them. The editor keeps the rule from its side (`identityHeaders` in `apps/editor/lib/api/core.ts`, shared with the unload beacon): a signed-in client whose `getToken()` resolves null asks once more with `{ skipCache: true }`, and if that is null too it throws `SessionTokenUnavailableError` rather than sending the request with no identity. The autosave reports both a 401 and a missing token as `unauthenticated` ([Per-tab storage](../006-document/per-tab-storage.md)).

**An owner id is not shown to readers either.** `redactDocumentForReader` (`apps/api/src/redact-document.ts`) blanks the document's `ownerId` for anyone who is not its owner, on both doors that hand out a document DTO: the share resolver (`GET /api/share/<code>`) and the document fetch (`GET /api/documents/<id>`). A guest's id is the same in every liveworkspace app, so handing it to a reader would tie the document to that guest everywhere else. Blanking costs non-owners nothing: the client reads `ownerId` only to compute `isOwner` (false for a blank), and `resolveOwnerBadge` falls back to the owner's name and colour. The same function nulls the document's primary `shareCode` for non-owners: it is the document's oldest link of any role, so a view-link visitor who received it would hold an edit link. Visitors already hold the code they arrived with, and only the owner manages links.

The two kinds coexist. A signed-in user can hand a share link to a guest who edits without an account.

## Guest identity

A livediagram guest is liveworkspace's guest ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Guests"): a year-long guest token minted by the liveworkspace accounts site, whose id is `guest_<uuid>`, the same guest in every liveworkspace app. The editor holds it with `createGuestTokens` from `@liveworkspace/index-client/browser` (`apps/editor/lib/guest-token.ts`):

1. **Getting one.** The first time a page needs an identity and this browser has none, it goes to **`GET /api/auth/guest?state=<random>`**. The api sends the browser to the accounts site's guest handoff with this app's client id and resource; the accounts site comes back to the editor page **`/auth/guest`** with `#guest_token=…&state=…` in the fragment, so the token never reaches a server log. The page checks `state` against the one it made and returns to where the visitor was.
2. **Keeping it.** The token is kept in `localStorage` under `livediagram:v2:guest-token`. It is sent as `Authorization: Bearer <guest token>`, exactly as an account's access token is.
3. **Renewing it.** A token with under 30 days left is replaced on the next page load that needs it, through the same handoff.
4. **When the handoff fails.** A failed handoff backs off for 5 minutes, and the page carries on with no identity, as a link visitor. With no accounts site configured, `/api/auth/guest` returns straight to `/auth/guest#error=guest_not_configured` ([Three deployment modes](#three-deployment-modes)).

Every entry path a guest can arrive on first (`/` and `/new`, the Explorer, the editor, the team invite `/join`) resolves the guest's identity (`ensureGuestIdentity`, shared as the `useGuestId` hook) before its first owner-scoped call, so even a first-time visitor's first request carries the Bearer. A guest who already holds a token resolves with no network. **The cost** is one full-page bounce through the accounts site the first time a browser needs a guest, and once a year after that.

Every other random value the editor rolls for a guest (the display name, the presence colour, an avatar's costume) goes through `apps/editor/lib/random.ts`, which draws from `crypto.getRandomValues` rather than `Math.random`. None of it guards a secret, but a weak generator feeding values that read as identity is what static analysis flags, and the strong one is free in every runtime we target.

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
- **`/explorer/`**: standalone full-page Explorer (item #12). Open to both guests and signed-in users: the owner id resolves the same way every other surface in the editor app does (the account id when signed in, the guest token's id otherwise), so a guest sees the documents + folders + Image Gallery their guest owns. Reached from the AuthControls dropdown's "Explorer" menu item (the same label [Editor app](../007-editor/editor-app.md) uses for the mobile entry point). Signed-out visitors get the same "Sign in" CTA as everywhere else (AuthControls in the page header), the page itself doesn't gate. A guest's token lives in one browser, so their data is per-browser (no cross-device sync until they sign up).

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

A person's participant (display name and presence colour) is their **liveworkspace profile**, one per person across every app (liveworkspace/docs/accounts.md "Profiles"; `apps/api/src/liveworkspace/profiles.ts`). A signed-in account with no display name of its own shows its liveworkspace account name, so renaming yourself on the accounts site shows on the next read (each api isolate remembers a profile for up to a minute); a name set in any app wins over it and shows in every app. On a first visit with no profile at all the editor seeds one: the account name when signed in (split at its first space into `firstName + lastName`, falling back to the email's local part; `namesOf` in `AccountsBridge.tsx`), a random placeholder for a guest. Profiles and settings at the accounts Worker are kept under the owner id itself (`user_…` or `guest_<uuid>`), with no mapping. A profile with no colour of its own takes the palette's pick for its id (`colorForKey`, from liveworkspace's presence palette), the same everywhere.

Two welcome-modal rules follow from that:

- **Owner on their own document**: the identity-only welcome screen never opens. The user's identity is already settled by their account; prompting them to pick a display name on a document they own would be noise.
- **Visitor on someone else's document (signed in)**: the welcome screen still opens (it carries the "you're joining X's document" context), but the "Your name" input is `readOnly` and the shuffle button hides. Visitors who _are_ signed in can't masquerade under a different display name on a host's document.

Guests see the legacy behaviour in both cases — first-load identity prompt, fully editable name, shuffle button present.

The join prompt is **independent of share role**: both **edit-role and view-role** visitors get it. A viewer's display name is broadcast to everyone else (cursor label, the tab presence stack, comments), so they need a chance to set it before joining rather than appearing under a random default. The identity card only writes the visitor's **own** profile (`PUT /api/participants/:id`, authorised on `owner === id`, not on document-edit rights), so confirming a name never hits a `403` even for a read-only viewer. The card's edit-only affordances (template grid, theme grid) don't render in identity mode, so there's nothing a viewer could trigger that they lack permission for.

## Guest → account merge

When a guest signs in or signs up, the things they made as a guest **become the account's** rather than being lost. They've already invested effort, and losing it on sign-up would be the opposite of friction-free.

1. **The accounts site merges the guest.** The accounts site knows this browser's guest by its own `lw_guest` cookie (it minted the guest token), and as it signs the person in it merges that guest into the account: their liveworkspace settings and profile ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Guests"). The guest's name and colour are kept where the account has none of its own; the account's own name and colour stay. The guest's preferences fill the keys the account has not set.
2. **The index tells livediagram.** The liveworkspace index calls the app's internal `personMerged(guestId, userId)` hook (`apps/api/src/routes/internal-items.ts`), which moves what livediagram keeps for the guest onto the account: documents, folders, shared-with-you visits, favourites, defaults, the timeline and opens (`migrateOwnerId`, `apps/api/src/db/account.ts`), their images in liveworkspace's media service, their shape libraries, and their Community copier records (`mergeCommunityCopier`). [Owner-keyed data](../015-api/api.md#owner-keyed-data) is the one list of those tables, with how each handles a row the account already has. Where both identities hold the same row, the account's copy wins, as the more recent and authoritative one. Tables keyed on `document_id` follow their document for free. The hook is idempotent, so a retry moves nothing twice.
3. **The editor drops its guest token** once signed in (`useAccountBootstrap`). Nothing in the editor waits for the merge: the move happens between liveworkspace and the api, and the signed-in page reads as the account.

A guest's documents in This Browser are not part of the merge; they stay in the browser until the person moves them ([Moving documents in This Browser after signing in](#moving-documents-in-this-browser-after-signing-in)).

## Deleting an account

Settings > Account > Delete Account deletes the whole account: the person's livediagram data and their **liveworkspace account**, which closes it in every liveworkspace app. Then it ends the session:

1. **Delete the server data, then close the account** (`DELETE /api/account`, [API](../015-api/api.md)). The worker removes documents, folders and the rest of the [owner-keyed data](../015-api/api.md#owner-keyed-data), then asks the accounts Worker to close the account, which takes the person's profile and preferences with it (`closeAccount` from `@liveworkspace/auth-client`: `POST /api/auth/delete-account` with this app's client credentials and the caller's access token). Closing it removes the account's sessions, its Google link, and every app's refresh tokens. The response clears the refresh cookie.
2. **End the session** (`POST /api/auth/sign-out`), then a full load to the landing page.

The data goes first: closed first, an account whose data delete then failed could never be signed in to again to finish it. If closing fails after the data has gone, the worker answers `502 { error: 'account_not_closed' }`, the dialog says the data is gone but the account is not, and the person, still signed in, can ask again (the data delete is idempotent). Signing in again afterwards with the same email or Google account makes a new, empty account.

There is no separate step-up confirmation: the dialog's own confirmation is the gate, and the session that asks is already a verified one.

## Guest documents start local

A guest's new document is **This Browser** by default ([Offline Mode](../006-document/offline-mode.md), [Save Locations](../006-document/save-locations.md#the-default-depends-on-who-is-creating)): saved in this browser, never sent to the server until the guest asks for it.

**Why.** A guest cloud document is keyed to the guest token held in this browser's `localStorage`. Clearing site data loses that token, and with it every document under its guest: the server keeps the rows for good, but nobody can reach them again. Many first visits are someone trying the product out, so most of those rows are orphans the moment they are written. A document in This Browser is exactly as durable for a guest (the same clear wipes IndexedDB), costs the server nothing, and opens without a round trip ([Offline Mode → Instant open](../006-document/offline-mode.md#instant-open)).

- **Only with sign-in enabled.** Local first applies in the hybrid mode, where a guest has an account to move to. A guest-only deployment ([Three deployment modes](#three-deployment-modes)) keeps livediagram as the default: there is no account to come to, so the server is the only place a document is kept beyond the browser, and the operator chose to run one.
- **Signed-in people are unchanged.** Their default stays livediagram.
- **Moving to the server is always the guest's own act**: Sync Document (from the Share dialog, which explains why first, [Offline Mode → Sharing a document in This Browser](../006-document/offline-mode.md#sharing-a-document-in-this-browser), or the Explorer), or the prompt after signing in (below). No guest document is uploaded silently.
- **Nothing is purged.** Guest cloud documents already on the server stay where they are; this changes where new ones start, not what happens to old ones.

### Who is a guest, before sign-in answers

The session loads deferred, so `/new` cannot wait for the token request without making every create slower. It reads the `ld_signed_in` hint cookie instead (`apps/editor/lib/signed-in-hint.ts`): the api sets it to `1` beside the HttpOnly refresh cookie when a sign-in completes, readable from script and holding no secret, and to `0` on sign-out or when a refresh is refused (`signedInHintOf` in `packages/api-schema/src/signed-in-hint.ts`, shared with the site header's primary link and the Repair page).

- **No hint, or `ld_signed_in=0`**: a guest. The create goes ahead at once, This Browser.
- **`ld_signed_in=1`**: probably signed in. The create waits for auth to settle (as it always has) and then uses the settled answer.
- The hint only decides a default. Every request still authenticates the real way, and a guest whose cookie misleads gets a document in This Browser, the safe direction.

### Moving documents in This Browser after signing in

Signing in never moves a document in This Browser by itself ([Offline Mode → Auth / guest interaction](../006-document/offline-mode.md#auth--guest-interaction)). Instead, once auth has settled signed in, a page that shows the Explorer or the editor checks this browser's documents in This Browser. If there are any, it offers to move them:

- **Move Documents in This Browser to Your Account?** A dialog lists each document in This Browser (name, last edited), every one ticked, with **Move** and **Not Now**.
- **Move** runs Sync Document ([Offline Mode → Save to server](../006-document/offline-mode.md#save-to-server-offline--cloud)) on each ticked document in turn, showing progress. A document that fails stays This Browser and is named in the result; the rest move.
- **Not Now** is remembered for this account in this browser (`livediagram:v2:local-move-dismissed:<userId>`), with the count of documents in This Browser at the time. The dialog comes back only when that count grows, so a person who keeps a deliberate document in This Browser is not asked again about it.
- The same move is always reachable by hand: **Sync Document** on any document in This Browser.

## Implications for how we build

- UI must never block the canvas behind a sign-in wall.
- Features that genuinely need an account are surfaced as opt-in prompts ("Sign in to keep your documents"), never modal walls.
- The single persistence boundary (`apps/editor/lib/api-client.ts` against the api worker, see [11-api.md](../015-api/api.md)) is the same in guest and authenticated mode. Both send `Authorization: Bearer`: the guest token from `localStorage` for guests, the in-memory access token for signed-in users. The api-client's module-level `setTokenProvider` is the single switch.
- Page script never holds the client secret or the refresh token: both live only in the api worker and its HttpOnly cookie, and the access token lives only in memory. See [06-secrets-policy.md](../002-project-scope/secrets-policy.md).
- The api worker's degraded-mode behaviour matters: with `ACCOUNTS_URL` or `API_RESOURCE` unset, it resolves no owner for any request, so nobody can keep a document on the server. The editor still opens and documents in This Browser still work, but a real deployment, even a guest-only one, configures the accounts site.
