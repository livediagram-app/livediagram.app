# Auth + guest access

## Principle

**The canvas always works without signing in.** A first-time visitor can land on `/new`, create a project, build something real, and only later be asked to sign up. This is intentional: friction-free engagement is the acquisition strategy.

We don't put auth in front of the core experience. We add auth where it _enables_ something the user wants (sharing, syncing, collaborating, paying).

## Sign-in is always offered

Every build of the editor offers sign-in; there is no switch to turn it off. Guests and signed-in people always coexist: the root layout mounts the accounts bridge, the header shows Sign in, and the Explorer and editor show their sign-in nudges.

| The api's accounts settings                                                                     | Frontend                                                                                                                         | API worker                                                         |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `ACCOUNTS_URL`, `API_RESOURCE`, `ACCOUNTS_CLIENT_ID`, `ACCOUNTS_CLIENT_SECRET` set (production) | The accounts bridge asks for the session; a guest fetches a guest token from liveworkspace. Guests and signed-in people coexist. | Verifies the Bearer: an account's access token or a guest's token. |
| Unset (local development without liveworkspace running)                                         | `/api/auth/*` answers 404 `sign_in_not_configured`, so every visitor settles without an identity and cannot sign in.             | No Bearer to verify: every caller is treated as a link visitor.    |

Without the accounts site there is no guest identity either, so an api without accounts settings keeps projects in This Browser and opens shared plans through their links; anything the index must record (a cloud plan, the Explorer's lists) needs liveworkspace.

`../packages/workbench/src/lib/auth-config.ts` keeps one build-time switch, `e2eAuthEnabled` (`NEXT_PUBLIC_E2E_AUTH=1`, test builds only), which swaps the accounts bridge for the e2e bridge; a real build never sets it, so the bridge is never bundled.

**At most one session request per page load.** The root layout's `AuthProvider` is deferred: the app tree consumes `DeferredAuthContext`, and a lazily-loaded `AccountsBridge` (`apps/editor/components/providers/AccountsBridge.tsx`, an async chunk) asks the api for the session with one `POST /api/auth/token` and publishes the result. A browser without the `lp_signed_in` hint ([below](#who-is-a-guest-before-sign-in-answers)) has no session to find, so it settles as a guest at once and asks nothing: a guest's page load makes no auth request. It holds the access token in memory only, reuses it until a minute before it expires, and shares one refresh among concurrent asks (each refresh rotates the refresh token, so two at once would race). Signing in and out are full-page visits, so no state from before signing in survives into the signed-in page.

## Signing in

liveplanner has no sign-in form of its own. People sign in to their **liveworkspace account** on the accounts site (`liveworkspace.app`, an OAuth 2.1 / OpenID Connect provider shared by the liveworkspace apps), with Google or by emailed code, and come back signed in. The sign-in and registration pages are served on liveplanner.app's own address by its router ([Router app](../016-platform/router-app.md#signing-in-on-liveplannerapp)), so the address stays liveplanner.app throughout but for one momentary hop to liveworkspace.app that gives it the liveworkspace session, so the other apps sign in without a click ([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md) "Signing in on the app's own address"). The api worker is the OAuth client (`apps/api/src/routes/auth.ts`), so the client secret and the refresh token never reach page script:

1. **`GET /api/auth/sign-in?return_to=<path>`** (with `&screen=sign-up` from `/get-started`, which adds `prompt=create` so the accounts site opens its registration page) sends the browser to the accounts site's authorize endpoint with PKCE (S256), a random `state`, and this API's resource (`API_RESOURCE`) so the access token is minted for liveplanner alone. The verifier, state and return path ride a 10-minute HttpOnly `lp_pkce` cookie scoped to `/api/auth`.
2. **`GET /api/auth/callback`** checks `state` against the cookie, swaps the code for tokens with the client secret, keeps the refresh token in an HttpOnly, `SameSite=Strict` `lp_refresh` cookie scoped to `/api/auth`, sets the readable `lp_signed_in=1` hint and `lp_account` name ([below](#the-account-name-cookie)) ([below](#who-is-a-guest-before-sign-in-answers)), records the account's sighting at the accounts Worker and counts the sign-in once (`reportSignIn`, [Telemetry](../017-telemetry/telemetry.md)), clears the `lp_signed_out` mark ([below](#signing-in-without-a-click)), and returns to the safe path. A mismatched or missing state lands on `/sign-in?error=expired`, a failed swap on `/sign-in?error=failed`.
3. **`POST /api/auth/token`** turns the refresh cookie into a fresh access token and the account (`{ id, email, givenName, familyName, name }`, from the id token), rotating the cookie and setting the name cookie afresh. No cookie answers `401 { signedIn: false }`; a refused refresh clears both cookies and the name.
4. **`POST /api/auth/sign-out`** clears both cookies and the name, and sets the readable `lp_signed_out=1` mark (the whole site, 400 days), so [signing in without a click](#signing-in-without-a-click) never undoes the sign-out; the next sign-in here clears it. It signs the person out everywhere in this browser: with the refresh cookie in hand it first asks the accounts site to end the liveworkspace session it came from, and with it every app's session from that session (`endAccountsSession` from `@liveworkspace/auth-client`), then answers `{ signedIn: false, next }`. The page goes to `next`, one full-page hop through liveworkspace.app (`endSessionUrl`) that clears the liveworkspace cookie and comes back to `?return=` (the landing page from the account menu), or straight there when `next` is null. The next Sign in, here or in any app, asks for an email code or Google, so another account can be chosen ([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md#signing-out) "Signing out", which also says what another app's open tab does).

Every response is `Cache-Control: no-store`, and the routes are rate limited per network. Locally, behind the router, `AUTH_ORIGIN=http://localhost:3200` makes the callback come back through the router; the accounts Worker must list `<origin>/api/auth/callback` as a redirect URI for each origin.

### Signing in without a click

Someone signed in to liveworkspace (in another app, or on liveworkspace.app) who opens liveplanner with no session here is signed in by the page itself. liveplanner can't see the liveworkspace session from script (that would need another site's cookies, which Safari and Chrome withhold), so it takes one quick full-page bounce through the accounts site ([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md) "Signing in without a click"; the code is `@liveworkspace/auth-client/silent`):

1. An inline script first in `<head>` (`SILENT_SIGN_IN_BOOT_SCRIPT`, `apps/editor/app/pre-hydration-scripts.ts`) runs before anything renders. With no `lp_signed_in=1` hint it marks the tab's `sessionStorage`, stops the page loading (so nothing signed-out paints and no app code starts) and goes to **`GET /api/auth/silent?return=<path?query#hash>`**.
2. That route sends the browser to the accounts site's authorize with `prompt=none`, keeping the PKCE verifier and the return address in its own HttpOnly `lp_silent_pkce` cookie (a clicked sign-in in another tab keeps `lp_pkce`) and setting a two-minute readable `lp_silent` guard. The accounts site answers at once, never with a page: a code when there is a session, `error=login_required` when not.
3. **`GET /api/auth/callback`** knows the bounce by its cookie's `state`. With a code it signs in exactly as step 2 above does; with an error, or a failed swap, it does nothing. Either way it goes back to the same path, query and hash.

It never bounces more than once per tab, nor in any tab within two minutes of the last bounce (`lp_silent`); with a session here; after the person signed out of liveplanner (`lp_signed_out=1`); inside a frame (embeds, the workbench); for a crawler or an automated browser (`navigator.webdriver`, which keeps the e2e suites unbounced); on `/sign-in`, `/get-started`, `/auth/*`, `/embed/*`, `/workbench/*`, `/form/*` (a form link's respondents) or a share link (`?s=`); or when the API isn't on the page's own origin (an app's dev server on its own port). The AI-tool consent and device pages (`/oauth/*`) do bounce: they only work signed in, so someone signed in to liveworkspace who arrives there from an AI tool or the CLI with no session here is signed in on the way, never shown a Sign in step that one click would pass straight through. The bounce comes back to the same address, so the request's `session` (or the device code) is kept. The route refuses the bounce for the signed-out mark and the guard too, and whatever goes wrong (no sign-in configured, rate limited) it goes straight back to the page, never to an error.

**The cost** is one bounce per new tab for anyone without a session here: four extra requests (the stopped page, the route, the accounts site, the callback). Measured locally against the dev stacks it adds about 85 ms to a signed-in person's first load and about 50 ms to a guest's; later loads in the tab add nothing. A guest's things still become the account's: the accounts site merges a guest at a sign-in that finds its session already there, as at any other ([Guest → account](#guest--account)).

## Hybrid identity

Every caller is a **person** liveworkspace knows: an account or a guest, the same id in every liveworkspace app ([one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Guests"). The api worker reads one header, `Authorization: Bearer <token>`, and checks it in `apps/api/src/auth/accounts.ts` with `createVerifier` from `@liveworkspace/auth-client`: a local signature check against the accounts Worker's published keys (`${ACCOUNTS_URL}/api/auth/jwks`, cached per isolate), plus its issuer (`${ACCOUNTS_URL}/api/auth`) and this API's own audience (`API_RESOURCE`), so a token minted for another liveworkspace app is refused.

1. **Account access token.** Its `sub` claim is the owner id (`user_…`); its `email` is trusted only when `email_verified` is true. Its `teams` claim lists the account's teams ([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md) "Teams").
2. **Guest token.** `kind: "guest"`, `sub: guest_<uuid>`, valid for a year, minted by the accounts site ([Guests](#guests) below). Its `sub` is the owner id.

A Bearer that fails verification (expired, wrong audience, sign-in not configured) is not an error of its own: the request goes on with no identity, as a link visitor's does, and the fall-through is logged as `[auth] access_token_rejected` (never the token). API tokens (`lwt_…`) and workbench sessions have their own paths ([Public API and API tokens](../015-api/public-api-and-tokens.md)).

**Access is the index's.** Who may open a plan, and at what level, is decided by liveworkspace's index and carried as a short-lived grant: the editor fetches one for the plan it opens and sends it as `X-Index-Grant` on REST, and as the `?t=` ticket on the room's WebSocket ([API](../015-api/api.md) "Access").

**An account id is never sent without its token.** The editor's `identityHeaders` (`apps/editor/lib/api/core.ts`, shared with the unload beacon) sends the account's access token, else the guest's token, else nothing. A signed-in client whose `getToken()` resolves null asks once more with `{ skipCache: true }`, and if that is null too it throws `SessionTokenUnavailableError` rather than going out as nobody. The autosave reports both a 401 and a missing token as `unauthenticated` ([Per-tab storage](../006-project/per-tab-storage.md)).

The two kinds of person coexist forever. A signed-in user can hand a share link to a guest, or to someone with no identity at all, who edits at the link's level.

## Guests

A guest's identity is liveworkspace's, so the same guest reaches the same things in every app.

1. The first time a page needs an identity (`ensureGuestToken`, `apps/editor/lib/guest-token.ts`), it records a random `state` and where to come back to in `sessionStorage` and sends the browser to `GET /api/auth/guest?state=`. The api worker checks the `state` (`isGuestHandoffState`), adds this app's accounts client and resource and redirects to the accounts site's `/api/auth/guest` (`guestHandoffUrl`, both from `@liveworkspace/auth-client`) ([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md) "Guests").
2. The accounts site reads or sets its long-lived `lw_guest` cookie and redirects to `/auth/guest#guest_token=<jwt>&state=<state>`. The fragment keeps the token out of logs.
3. `/auth/guest` (`apps/editor/app/auth/guest/`) checks the `state`, keeps the token in `localStorage` under `liveplanner:v2:guest-token`, and returns to the page it came from (a same-site path only). Every request then carries it as the Bearer, exactly as an account's access token is.

- **Refreshed before it runs out.** A kept token with fewer than 30 days left (`GUEST_TOKEN_REFRESH_BEFORE_MS`) is replaced by the same handoff on the next page load that needs it.
- **Never a loop.** A handoff that comes back without a token (no accounts site, or a deployment without one, which answers `#error=guest_not_configured`) is remembered for five minutes, and the page carries on without an identity in the meantime, with a stand-in id for this page load only.
- **No redirect for a link.** Opening a plan through a share link or an embed needs no identity: the share code is enough for the index to grant what the link allows.
- **A new guest is counted once.** A guest token for a guest this browser has not had reports `Participant·Created` ([Telemetry](../017-telemetry/telemetry.md)).
- The other random values the editor rolls for a guest (the display name, the presence colour, an avatar's costume) go through `../packages/workbench/src/lib/random.ts`, which draws from `crypto.getRandomValues` rather than `Math.random`.

## Capability matrix

| Capability                  | Guest                                | Authenticated                           |
| --------------------------- | ------------------------------------ | --------------------------------------- |
| Editing the canvas          | ✓                                    | ✓                                       |
| Persistence                 | ✓ (per guest, kept by liveworkspace) | ✓ (per-account, syncs across devices)   |
| Open a share link as viewer | ✓                                    | ✓                                       |
| Open a share link as editor | ✓                                    | ✓                                       |
| Mint a new share link       | ✓                                    | ✓                                       |
| Real-time presence          | ✓ on shared sessions                 | ✓                                       |
| Team libraries              | None                                 | ✓ (teams are made on liveworkspace.app) |

## Auth surface

Four routes inside `apps/editor/`:

- **`/sign-in/`** and **`/get-started/`** (`components/chrome/AuthHandoff.tsx`) hand the visitor straight to `/api/auth/sign-in`, which goes on to the accounts site. `/sign-in` opens its sign-in page (Continue with Google, or email then a code) and `/get-started` its registration page (Continue with Google, or first name, last name, email, then a code); someone who signs in without a name yet is asked for one after the code. They land in different places afterwards: **sign-in → the Explorer** (`POST_AUTH_SIGNIN_DEFAULT`), **sign-up → the welcome / new-project flow** (`POST_AUTH_DEFAULT`, `/new`). The hand-off uses `location.replace`, so Back from the accounts site skips the interstitial. When `/api/auth/callback` sends the browser back with `?error=expired` or `?error=failed`, the page shows what went wrong with a **Try again** link instead of redirecting.
- **`?redirect_url=...`**: the return destination. Routes are clean (no `/live` prefix; [Router app](../016-platform/router-app.md)), so a valid `redirect_url` is any **same-origin path**. `resolvePostAuthDestination(searchParams, default)` in `components/chrome/auth-shared.tsx` validates it (`isPostAuthPath`, from `@liveworkspace/auth-client/return-path`, the one return-path check every app and liveworkspace.app share): the path must start with a single `/` (NOT `//`), with no `\` or control character anywhere (the protocol-relative / backslash / dropped-tab open-redirect tricks); it must come out of the browser's normalising unchanged, and must not point back at `/sign-in` or `/get-started` (loop guard). Missing, unsafe or auth-page values fall back to the per-route default. `accountsSignInUrl(destination)` carries it to the api as `return_to`, and the api checks it again (`safeReturnPath`, the same shared check with the Explorer as its fallback, which also refuses a control character, a space or DEL, since the browser drops those and `/<tab>/evil.example` would land on `//evil.example`) before it redirects anywhere.
  - **Every in-app trigger builds the param.** So a visitor who clicks any "Sign in" / "Create account" affordance returns to the page they were on after auth, not a generic default. `authHrefWithReturn(authPath, returnTo)` composes `?redirect_url=<encoded returnTo>` through the **same** `isPostAuthPath` guard (an unsafe or auth-page `returnTo` is dropped, yielding a bare auth href, never a loop or open redirect), and the `useAuthReturnPath()` hook supplies the visitor's live location (path + query + `#t=<tab>` hash, so you land back on the exact tab). Every trigger (the header pill (`AuthControls`), the floating banner + its reasons modal (`SignInBanner` / `SignInReasonsModal`), and the guest prompts (`SignInPrompt`)) uses it.
- **`/explorer/`**: the full-page Explorer, the shared `@liveworkspace/explorer` ([Explorer structure](../013-workspace/explorer-structure.md)). Open to guests and signed-in people alike: it waits for the person (the account, or the guest token, fetching one on a first visit) before it asks the index for anything, then lists what that person can reach in every liveworkspace app. Signed-out visitors get the same "Sign in" CTA as everywhere else (AuthControls in the page header); the page itself doesn't gate.
- **`/auth/guest`**: where the guest handoff comes back to ([Guests](#guests)). It keeps the token and returns to the page that asked.

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
- **The pitch.** Beside the card, an eyebrow, a heading and its promise rows (four on the account pages, three on the
  connect pages), one row under another at every width. Each row is a tinted icon, one title in its tone's colour and
  a line under it, as on liveworkspace.app's sign-in pitch (`liveworkspace/apps/site/components/account/Pitch.tsx`):
  the title stands alone, with no lead word or second title beside it. The account pages say what an account adds
  ("No catch": your plans sync on every device, create and join teams, connect your AI assistant, still completely
  free); the connect pages say what connecting means ("Connect": changes show live, you approve every connection,
  revoke access any time). The pitch holds no controls. Its frame is shared by every editor, `AuthPitch`
  (`../packages/workbench/src/components/chrome/AuthPitch.tsx`); the rows are this app's
  (`apps/editor/components/chrome/auth-pitches.tsx`).
- **Decorative lines keep drawing** behind the content on wide screens, in any direction: four slots each take a
  random route that enters through one edge and leaves through another, bending across the stage on the way
  (`randomTrace`, `../packages/workbench/src/components/chrome/auth-lines.ts`). A route draws in, holds, then trails off the far edge over 14
  seconds, and its slot takes a fresh route the moment it ends; the first round starts the slots a quarter cycle apart,
  so a new line is always on its way. Routes are chosen in the browser after mount. They are hidden from assistive
  technology and absent below the `lg` breakpoint. Under reduced motion (the OS setting or the person's own preference)
  two fixed routes through the margins stand still, fully drawn, and nothing moves.
- **The entrance** draws the page in a beat at a time, at the marketing hero's pace
  ([Motion](../004-interface-design/motion.md#content-pacing)): the header, eyebrow and heading rise in, the card lands
  with a slight tilt and overshoot like a shape dropped on the canvas, the promise rows slide in like stickies being
  placed and each row's icon pops once its row has landed. Everything has settled by about 660ms; under reduced motion
  the page simply appears.
- **Large screens.** From `2xl` the frame widens to 88rem, the pitch heading grows, the promise rows stay one per
  row and the card gains room; from 1920px the whole frame (not the lines) is zoomed 1.2 times, and 1.35
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

Signed-in status surfaces in the editor header via `<AuthControls>` (the account's Google picture over its initial,
[Profile pictures](profile-and-email-notifications.md#profile-pictures), + Sign out menu). Signed-out users see a "Sign in" link in the same slot. Neither blocks the editor; they're purely informational.

## Identity display name

A person's participant (display name and presence colour) is their **liveworkspace profile**, one per person across every app (liveworkspace/docs/specs/003-accounts/accounts.md "Profiles"; `apps/api/src/person/profiles.ts`). A signed-in account with no display name of its own shows its liveworkspace account name, so renaming yourself on the accounts site shows on the next read (each api isolate remembers a profile for up to a minute); a name set in any app, or in Settings › Profile, wins over it and shows in every app. The editor never overwrites a stored name with the account name. On a first visit with no profile at all it seeds one: the account name when signed in (split at its first space into `firstName + lastName`, falling back to the email's local part; `namesOf` in `AccountsBridge.tsx`), a random placeholder for a guest (`resolve-participant.ts`).

Two welcome-modal rules follow from that:

- **Owner on their own project**: the identity-only welcome screen never opens. The user's identity is already settled by their account; prompting them to pick a display name on a project they own would be noise.
- **Visitor on someone else's project (signed in)**: the welcome screen still opens (it carries the "you're joining X's project" context), but the "Your name" input is `readOnly` and the shuffle button hides. Visitors who _are_ signed in can't masquerade under a different display name on a host's project.

Guests see the legacy behaviour in both cases: first-load identity prompt, fully editable name, shuffle button present.

The join prompt is **independent of share role**: both **edit-role and view-role** visitors get it. A viewer's display name is broadcast to everyone else (cursor label, the tab presence stack, comments), so they need a chance to set it before joining rather than appearing under a random default. The identity card only writes the visitor's **own** profile (`PUT /api/participants/:id`, authorised on `owner === id`, not on project-edit rights), so confirming a name never hits a `403` even for a read-only viewer. The card's edit-only affordances (template grid, theme grid) don't render in identity mode, so there's nothing a viewer could trigger that they lack permission for.

## Guest → account

When a guest signs in or signs up, what they made as a guest **becomes the account's** rather than being lost. The accounts site does it: a session made for a browser carrying the `lw_guest` cookie tells the index, which moves the guest's items, folders, favourites, opens and placement defaults to the account in one batch, and clears the cookie ([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md) "Guests", [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Guests"). A sign-in that finds a liveworkspace session already there, by a click or [without one](#signing-in-without-a-click), makes no new session, so the accounts site does the same at its authorize step. liveplanner takes no part and makes no call: the next page load lists the plans under the account.

- The guest's settings and display identity (name and colour) live in the accounts database under the guest id, and the same sign-in hook moves them to the account: a key, name or colour the account already has keeps the account's, the guest's fill the gaps, then the guest's are deleted ([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md) "Settings", "Profiles"). A signed-in person's name then follows their account.
- What a guest added to a plan as a Participant stays the guest's addition ([Share roles](../013-workspace/share-roles.md) "Integrity").
- The guest token is spent once signed in: `useAccountBootstrap` removes it from `localStorage`, so a later signed-out visit fetches a fresh guest from the accounts site, whose cookie was cleared by the merge.

## Deleting an account

Settings > Account > Delete Account deletes the whole account: the person's liveplanner data and their **liveworkspace account**, which closes it in every liveworkspace app. Then it ends the session:

The dialog says so before anything else: it deletes the liveworkspace account and **everything the person owns in every liveworkspace app**, not only liveplanner. It lists what goes (every canvas, plan, document and design, the Trash included; folders, settings and API tokens; teams they run alone), says it signs them out everywhere and can't be undone, and that plans in This Browser stay on the device. Closing the account purges every app's items through the index ([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md#closing-an-account)), so naming only this app's would understate it.

1. **Confirm with a code emailed to the account.** After the person types their email, **Email Me a Code** (`POST /api/account/deletion-code`, [API](../015-api/api.md)) has the accounts Worker email a 6-digit code to the account's own address, the same kind of code that signs in ([liveworkspace/docs/specs/003-accounts/sign-in.md](../../../../liveworkspace/docs/specs/003-accounts/sign-in.md#closing-an-account)). The dialog then asks for it in the sign-in page's six boxes (`CodeDigits` from `@liveworkspace/ui`), with **Resend Code**, and **Delete Account** sends it with the delete. Being signed in is not enough on its own: someone at a machine left signed in can't delete the account without the inbox.
2. **Check the code, delete the server data, then close the account** (`DELETE /api/account { code }`, [API](../015-api/api.md)). The worker first checks the code with the accounts Worker (`confirmDeletionCode` from `@liveworkspace/auth-client`) and deletes nothing unless it is right: no code is `400 code_required`, a wrong or expired one `403 invalid_code`, the third wrong one `403 too_many_attempts` (the code is gone; ask for a new one), too many tries a minute `429 rate_limited`. Then it deletes the person's own plans for good through the index (up to 1,000 a request; a person with more is answered 409 `plans_remaining` and asks again), and the rest of the [owner-keyed data](../015-api/api.md#owner-keyed-data), then asks the accounts Worker to close the account (which deletes the settings, name and colour and sightings it keeps for every app) (`closeAccount` from `@liveworkspace/auth-client`: `POST /api/auth/delete-account` with this app's client credentials, the caller's access token and the code, which the accounts Worker checks again and spends). Closing it removes the account's sessions, its Google link, and every app's refresh tokens. The response clears the refresh cookie.
3. **End the session** (`POST /api/auth/sign-out`), then a full load to the landing page.

The data goes first: closed first, an account whose data delete then failed could never be signed in to again to finish it. If closing fails after the data has gone, the worker answers `502 { error: 'account_not_closed' }`, the dialog says the data is gone but the account is not, and the person, still signed in, can ask again (the data delete is idempotent). Signing in again afterwards with the same email or Google account makes a new, empty account.

The emailed code is the step-up, and it is checked on the servers, by this app's worker and again by the accounts Worker, so no client can skip it. Asking again after `account_not_closed` uses the same code while it lasts (10 minutes); after that the person asks for a new one.

## Guest projects start local

A guest's new project is **This Browser** by default ([Offline Mode](../006-project/offline-mode.md), [Save Locations](../006-project/save-locations.md#the-default-depends-on-who-is-creating)): saved in this browser, never sent to the server until the guest asks for it.

**Why.** Many first visits are someone trying the product out. A guest cloud project is an index item under the guest's liveworkspace identity ([Guests](#guests)), and a guest who never signs in leaves it on the server for good, unreached once they clear the site data that holds their guest token. A project in This Browser is exactly as durable for a guest (the same clear wipes IndexedDB), costs the server nothing, and opens without a round trip ([Offline Mode → Instant open](../006-project/offline-mode.md#instant-open)). It is not hidden for it: the shared Explorer lists this browser's projects beside the index's, in its This Browser row and view and in Jump Back In ([liveworkspace/docs/specs/004-index/one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md)). (Between October 23 and 25, 2026 every new project started on liveplanner, a guest's included, because a project in This Browser did not show in the Explorer then.)

- **Signed-in people are unchanged.** Their default stays liveplanner.
- **A `/new?folder=` / `?team=` link stays on liveplanner**: it names a place on the server, so the create goes there whoever is creating.
- **Moving to the server is always the guest's own act**: Sync Project (from the Share dialog, which explains why first, [Offline Mode → Sharing a project in This Browser](../006-project/offline-mode.md#sharing-a-project-in-this-browser), or the Explorer), or the prompt after signing in (below). No guest project is uploaded silently. A project synced as a guest is then a guest cloud project, and moves to the account at sign-in with the rest ([Guest → account](#guest--account)).
- **Nothing is purged.** Guest cloud projects already on the server stay where they are; this changes where new ones start, not what happens to old ones.

### Who is a guest, before sign-in answers

The session loads deferred, so `/new` cannot wait for the token request without making every create slower. It reads the `lp_signed_in` hint cookie instead (`apps/editor/lib/signed-in-hint.ts`): the api sets it to `1` beside the HttpOnly refresh cookie when a sign-in completes, readable from script and holding no secret, and to `0` on sign-out or when a refresh is refused (`signedInHintOf` in `packages/api-schema/src/signed-in-hint.ts`, shared with the site header's primary link and the Repair page). The same hint tells the page whether a session is worth asking for at all: a browser without it settles as a guest at once.

- **No hint, or `lp_signed_in=0`**: a guest. The create goes ahead at once, This Browser, without waiting for the guest token or the participant.
- **`lp_signed_in=1`**: probably signed in. The create waits for auth to settle and then uses the settled answer.
- **The consent and device pages** (`/oauth/*`) read the hint the same way. With `lp_signed_in=1` they show their
  loading line until the session itself answers, up to 15 seconds, rather than taking the page's 5-second give-up on
  sign-in as signed out: a slow session would otherwise show a signed-in person "Sign in to connect", and the click
  would sign them straight in. Only the session's own answer that there is no one, or no hint, shows the Sign in step
  (`signInGateOf`, `../packages/workbench/src/hooks/auth/useSignInGate.ts`).
- The hint only decides a default. Every request still authenticates the real way, and a guest whose cookie misleads gets a project in This Browser, the safe direction.

### The account name cookie

Beside the hint, the api keeps `lp_account`: the signed-in account's name as a header shows it (its given name,
else its full name, else its email; at most 64 characters, URI-encoded), readable from script, the whole site, for as
long as the hint (`@liveworkspace/auth-client/account-name`). It is set wherever the hint is set to `1` (a sign-in, a
silent sign-in, and every token refresh, so a renamed account shows its new name after the next refresh) and cleared
wherever the hint goes to `0` (sign-out, a refused refresh, closing the account). Like the hint it holds no secret and
authenticates nothing: it is only the name the marketing header's account menu shows
([Marketing site](../019-marketing/marketing-site.md), "Header"), so a public page can say who is signed in without
asking the api.

### Moving projects in This Browser after signing in

Signing in never moves a project in This Browser by itself ([Offline Mode → Auth / guest interaction](../006-project/offline-mode.md#auth--guest-interaction)). Instead, once auth has settled signed in, a page that shows the Explorer or the editor checks this browser's projects in This Browser. If there are any, it offers to move them:

- **Move Projects in This Browser to Your Account?** A dialog lists each project in This Browser (name, last edited), every one ticked, with **Move** and **Not Now**.
- **Move** runs Sync Project ([Offline Mode → Save to server](../006-project/offline-mode.md#save-to-server-offline--cloud)) on each ticked project in turn, showing progress. A project that fails stays This Browser and is named in the result; the rest move.
- **Not Now** is remembered for this account in this browser (`liveplanner:v2:local-move-dismissed:<userId>`), with the count of projects in This Browser at the time. The dialog comes back only when that count grows, so a person who keeps a deliberate project in This Browser is not asked again about it.
- The same move is always reachable by hand: **Sync Project** on any project in This Browser.

## Implications for how we build

- UI must never block the canvas behind a sign-in wall.
- Features that genuinely need an account are surfaced as opt-in prompts ("Sign in to keep your projects"), never modal walls.
- The single persistence boundary (`apps/editor/lib/api-client.ts` against the api worker; see [11-api.md](../015-api/api.md)) is the same in guest and authenticated mode. Only the Bearer differs: a guest token for guests, an account access token for signed-in users. The api-client's module-level `setTokenProvider` is the single switch.
- Page script never holds the client secret or the refresh token: both live only in the api worker and its HttpOnly cookie, and the access token lives only in memory. See [06-secrets-policy.md](../002-project-scope/secrets-policy.md).
- The api worker's degraded-mode behaviour matters: with `ACCOUNTS_URL` or `API_RESOURCE` unset, no Bearer verifies, and every request is answered as a link visitor's. Useful for local dev and for environments where sign-in hasn't been provisioned yet, so the editor stays usable.
