# liveworkspace.app

liveworkspace.app is one static website. Every page is in it: the front door that says what
liveworkspace is and sends people on to the app that fits their work, the public telemetry
dashboard, and the sign-in, registration and consent pages every app sends people to. The apps
(livediagram.app, liveplanner.app) each keep their own marketing site for the detail.

```
apps/site          the website (a Next static export, Cloudflare static assets)
apps/accounts      the accounts API, /api/auth/* (README.md)
apps/telemetry     the telemetry API, /api/telemetry/* (telemetry.md)
```

The two APIs are Workers on more specific routes of the same origin, so the pages call them as
`/api/auth/…` and `/api/telemetry/…` with no cross-site requests.

## Who it's for

- Someone who heard of "liveworkspace" and wants to know what it is.
- Someone on one app who wants to know what the others are (every app's logo links here,
  [site-switcher.md](site-switcher.md)).
- Someone signing in to an app, or reading the telemetry dashboard, who wants the bigger picture.

## The pages

### The header

Every page has the same header: the liveworkspace wordmark, with the site switcher on hover
(the current site highlighted), links to Our Apps and Telemetry, each with its icon, and the account
control. On a phone the wordmark and the account control show; the footer has the rest. The
Appearance toggle is never in the header: it is on the rail.

### The rail

As on the apps' sites, a rail is pinned to the page's right edge (`components/SiteRail.tsx`). On the
home page it starts with a **Share** card: X, LinkedIn, Facebook, WhatsApp and Email, as plain
share-intent links with no SDKs or tracking, and Copy link, all for `https://liveworkspace.app`.
Under it, on every page, is the **Appearance** card (Light, Dark, System, as on the apps' sites; the
boot script applies the choice before paint). The content runs `max-w-7xl` (1280px), so the rail
shows from 1400px, where there is a gutter for it. Below that it is left out: the address is
shareable as it is, and the device's own setting applies through System.

- **Signed out**: **Sign in**, which opens `/sign-in` with the page to come back to
  (`?return=/telemetry`, say). Once signed in, the page goes back there. Only a path on this site
  is followed, so the link can't send anyone elsewhere.
- **Signed in**: an avatar of the account's initials (accounts keep no pictures: always two letters: the first
  letters of the first and last names (the full name, where the account has one), else a single name's first two, on a disc in the deep shade of a presence colour picked from the name, so
  the same person has the same colour in every app) and its first
  name (or full name, or email; the name hides on a phone), opening a menu
  (`components/AccountControl.tsx`): the name again over "Your account", **API tokens** and **Settings** (the
  [Your account](#your-account-account) pages), and **Sign out**, which ends
  the liveworkspace session here. It doesn't sign anyone out of an app: each app holds its own
  tokens.

The site is static, so the control asks the accounts API (`GET /api/auth/get-session`, on this
origin, with the session cookie) once the page is up. Until it hears, it keeps its place empty,
so the bar doesn't jump. The sign-in pages leave it out: they are the sign-in.

The menu is one component, `AccountMenu` in `@liveworkspace/account-menu` (`packages/account-menu`), and
every place that shows a signed-in person uses it: this header, the Explorer on an app's address
(`components/explorer/AppAccountControl.tsx`), and each app's marketing header (its `SiteHeader`, through the
package's `AppAccountMenu`). Each passes in its own UI package's menu hooks (`useMenuButton`, `useMenu`,
`useClickOutside`), so the keyboard and focus behaviour is the one every app's menus have, and says where the
account pages are and what Sign out does. On an app's own pages the pages are liveworkspace.app's, in full,
and Sign out is the app's. A marketing page learns who is signed in from the app's readable cookies,
`<prefix>signed_in` and `<prefix>account` (the name), and makes no request for it
([accounts.md](accounts.md#an-apps-signed-in-cookies)).

### The front door (`/`)

The glue between the apps: what liveworkspace is, each app in its own colours, how a piece of work
moves between them, and the one account that joins them.

1. **Hero**: "Everything your team makes, live in one workspace", one sentence naming each app
   in its accent and what it is for (sketch, plan, write it up, make it look right), and two calls to
   action: **Create your free account** (`/sign-up`, back here after) and **Explore the apps**.
   Signed in, they are hidden. Beside it, the platform's prism
   with each app's logo at a corner, joined to it by a line in its accent, read clockwise in the
   order work moves through them, and a collaborator's cursor at each. Each app there is a link to its
   site that lifts and rings in its accent on hover, and holds still while pointed at. On phones (below
   `sm`) it is left out, and the hero's words, calls to action and promises are centred.
2. **The apps** (`#apps`): one section per app in `@liveworkspace/sites`, in that order, each with
   its own logo, a tagline, its summary, three things it does, a window onto its work with someone in
   it (a flowchart; a board with a card on the move; an article with its slides; a logo, a wireframe
   and a photo being cropped), and a button in its deep accent naming the work: **Start Diagramming**, **Start Planning**, **Start Writing**, **Start Designing**. Below `lg` the window sits between the summary and the three things it does.
   Every logo is the app's own UI package `Brand`, with its hover
   shimmer, "live" pointed at the app's deep and accent colours (`components/landing/AppLogo.tsx`). The copy is
   `lib/apps.ts`; tests require it for every app and that white text on each deep accent passes
   WCAG AA.
3. **What every app shares** (`#what-you-get`, `components/landing/Promises.tsx`): "Different apps,
   the same promises", ten tiles that fill every row, each with a small piece of the product drawn
   in the apps' colours (`components/landing/PromiseArt.tsx`) above its words and no icon: one
   account (the large tile, the sign-in box beside each app signed in, with Create your account);
   live by default (a canvas with people in it); share by link (the share box); one Explorer for
   everything (full width: the words beside a folder holding a Canvas, a Plan, a Document and a
   Design, two by two); one Inbox; teams across every app; one key for scripts and AI (a token in a
   terminal); open about data (a public chart, linking `/telemetry`); yours to keep (a sign-in code
   and one close for every app); completely free.
4. **Closing call to action**: "One account. Every app. Always live."
5. **Footer**: Our Apps (each app's logo, linking to its site), Platform (Comparison, which points at each app's
   comparisons, and the telemetry dashboard) and Legal (the
   privacy policy and terms).

The illustrations are drawn in the page (HTML and SVG with the apps' own logos), not images. Their
ambient motion (the current along the lines, drifting cursors, the cards settling) is in
`app/landing-motion.css`, paced as content, and stops for reduced motion.

### Privacy and terms (`/privacy`, `/terms`)

One privacy policy and one set of terms for liveworkspace and every app in it, linked from the
footer. They were built from the apps' own policies, which said the same things app by app; a
feature only one app has (livediagram's Google Drive mirror, its Offline Mode) says which. Both share `components/LegalPage.tsx`, and their date and contact
form are in `lib/legal.ts`. Change them when what an app stores or who it uses changes.

### Comparison (`/compare`)

Each app compares itself with the tools it answers on its own site, at `/alternatives` and
`/alternatives/<slug>` ([@liveworkspace/comparisons](../../packages/comparisons/README.md)). This page
only points at them: a card per app (its logo, its pitch and **See how <app> compares**, in its deep
accent), linked from the footer as **Comparison**. It has no data of its own, so a comparison
added in an app needs nothing here.

The comparisons lived here for a while, so every old address redirects permanently from
`public/_redirects`: `/alternatives` to `/compare`, each `/alternatives/<slug>` to the same slug on the
app that speaks for it (`https://www.livediagram.app/alternatives/miro`, say), and any other
`/alternatives/*` to `/compare`. `lib/comparison-redirects.test.ts` pins every one.

### Telemetry (`/telemetry`)

The public dashboard for every app's anonymous events, all apps at once or one at a time
(`?app=livediagram.app`): [telemetry.md](telemetry.md). Each app's filter shows that app's logo
as its own header does, the prism and the wordmark in the app's accent. It reads its numbers from
`/api/telemetry/summary`. Its styles (and each sending app's shared UI, which its views render) are in
their own stylesheet, `app/telemetry/telemetry.css`, so the other pages don't carry them.

### The Explorer (`/explorer/…`)

Every app's work, in one place: the shared Explorer (`@liveworkspace/explorer`, [one-explorer.md](one-explorer.md)),
built once here. It is shown here and, through each switched-on app's router, at that app's own `/explorer`
([below](#on-an-apps-own-address)). A link from elsewhere comes here with `?from=<app>` (`explorerUrl` in
`@liveworkspace/sites`). Its parts are `components/explorer/` and `lib/explorer/`.

- **Who it reads as.** The index is asked with a short-lived token from `GET /api/auth/workspace-token`: the
  signed-in account's, or this browser's guest's ([accounts.md](accounts.md)). Signing out here asks again.
- **Which app.** The app the person came from: `?from=`, then the referrer, then the last app used here
  (kept in this browser). The page wears that app's colours (its brand ramp, light and dark) and opens filtered
  to its items, with **All Apps** one click away. The switch reads the app's own name ("livediagram") and **All Apps**, each with its logo: the app's prism in its
  accent, and liveworkspace's own for All Apps (the apps' Explorer panels do the same). Someone who came straight here sees every app's items in
  liveworkspace's own colours.
- **The header.** The liveworkspace logo (with the site switcher), a slanted hairline with equal space either
  side, then the app's logo, which leads back to the app. On a phone, where there is less room, only the app's
  logo shows (the liveworkspace logo shows when no app is). The search field sits in the middle (on Home the hero holds it), the account control on
  the right. Someone who came straight here sees no app logo.
- **The bottom bar.** As the apps' own Explorers had it: a bar stuck to the foot of the page
  (`components/explorer/ExplorerBottomBar.tsx`), its controls on the right: **Search**, **Settings** and
  **Appearance** (Light, Dark or the system's, the site's one switch, `SiteAppearanceToggle`), each named beside its
  icon on a wide screen (`md` up) and an icon alone on a narrow one. Their hover cards open upward, above the bar. Settings shows for a person signed in, and
  opens the Settings panel ([below](#settings)) in a dialog over the Explorer, without leaving the page: filtered to
  the app the person came from (All one click away), or on All from no app. Its code, and the app's catalogue, are
  fetched when the button is pointed at. The toasts and a guest's sign-in banner stand above the bar.
- **Search.** The bar's Search and Cmd/Ctrl+K open the Search panel (`@liveworkspace/explorer/search-panel`, loaded
  only when first opened): one field over the person's items (the index's `search` view, the words in the title or
  folder name, every app's or only the app's as the filter is set), their folders and teams, the Explorer's help
  articles in the app's help centre and, signed in, the sections of their account's settings. Items are asked for
  once the typing pauses (200 ms), the request before cancelled; folders are read once per opening. Each group shows
  at most 8. Picking an item opens it in its app, a folder or team opens it here, help opens in a new tab. The
  header's field stays the filter for the list on screen.
- **Links.** Each item opens in its own app, at the address the sites registry (`APP_ITEMS`) gives: its base
  URL, item path and share path. **New** goes to the app's new-item route, with the folder or team it was made
  from. Help links go to the app's help centre.
- **First run.** An empty Home shows the app's welcome and starts, from that app's templates manifest
  (`@<app>/templates/welcome.json`, loaded only when Home is empty).
- **Hero art.** The picture on the right of Home's hero is the app's own, from its hero manifest
  (`@<app>/templates/hero.json`, generated from the components the app's Home draws), drawn by the Explorer's
  `HeroArt` as React elements (no HTML parsed, only boxes and shapes). It is loaded once per page, only on Home
  with the hero shown and room for it (`lg` and up). Every app ships one.
- **Previews.** Every app's items have one, from liveworkspace's previews on the page's own origin
  (`/api/previews/items/<id>?v=<updatedAt>`, [previews.md](previews.md)), asked with the person's workspace token
  and the item's share code. They are asked for only as a card nears the screen or a row is pointed at, at most
  4 at a time, once per item version, and kept as up to 200 blob URLs, least recently used out. The answer is
  cached by the browser for a day per version. An item the index says is empty shows its kind's icon, with no
  request.
- **Names.** Owners and who did what are named through `/api/account/people`, gathered into one request per
  beat (at most 100 ids) and kept in one bounded cache. A guest is named too: the route answers this
  browser's guest cookie, rate limited ([accounts.md](accounts.md)).
- **Sharing.** The Share dialog makes and revokes passes through the index, and its extras come from the item's
  app's registry entry (`share` in `APP_ITEMS`): the tab picker (the item's tabs, read once per open from the
  app's `tabsPath` with the workspace token: the tabs alone, id, name and kind, where the app serves them, as
  liveplanner does), the embed code and the live image. Its help links go to the app's
  help on sharing.
- **Guests.** A guest sees a sign-in banner at the foot of the page, with Sign In, Learn More (why an account
  helps, loaded on first press) and a close this browser remembers, one for every app.
- **Home's banner.** Closing it is the person's `homeBanner` setting in the app's own scope
  (`/api/account/settings/:app`), so it stays closed in that app's editor too, and the other way round.
  A guest's close is kept in this browser.
- **Telemetry.** What people use here counts for the app the page shows, or `liveworkspace.app` on All Apps,
  batched and only with the person's consent ([telemetry.md](telemetry.md#the-explorer-on-liveworkspaceapp)).
- **The Inbox.** Plan cards wear their type's glyph, and its empty state points at liveplanner's help on actions.
- **Teams.** Made, run and answered here ([one-explorer.md](one-explorer.md#teams-are-run-in-the-explorer)): the
  page hands the Explorer `createTeamsHost({ fetch: accountFetch })` over this origin's `/api/account/teams…`, and
  after a team is made, joined, left or deleted it asks for a fresh workspace token, whose `teams` claim names
  them (`lib/explorer/new-team.ts` `renewIdentity`).
- **This Browser.** Here, a row in the sidebar opens the app's own offline view (`offlinePath`), since what a
  browser keeps belongs to that app's origin. On the app's address the Explorer lists it itself (below).
- **Addresses handed over.** `?settings=<category>` (every notification email's unsubscribe link) goes to the
  Settings panel on `/account/settings`: notifications to `#notifications` (All, on Notifications), the profile to
  `#profile`, privacy to `#privacy`, an app's own settings to `?app=<app>`. `?ended=revoked` says, once, that the link a plan was open through was revoked.
  `?trashed=<id>&title=` offers Undo for an item just moved to the Trash. Each is dropped from the address once
  read.
- **Retired addresses.** `/explorer/profile` goes to notification settings, `/explorer/activity` to the Inbox,
  `/explorer/generated` to a search for items made by AI, `/explorer/dynamic` to All, `/explorer/tags` to Home, and `/explorer/offline` to the app's offline view (on an app's
  address, This Browser's own view).

#### On an app's own address

The same page, served by the app's router at `<app>.app/explorer/…` with the address unchanged
(`@liveworkspace/sites/workspace-proxy`, [one-explorer.md](one-explorer.md#the-explorer-on-each-apps-address)).
`lib/explorer/page-app.ts` reads the app from the page's own host (a static page sees no request), and with it:

- **Who it reads as** (`lib/explorer/app-session.ts`, `lib/explorer/token.ts`): the app's access token from the
  app's `POST /api/auth/token`, one request in flight at a time (it rotates the refresh cookie), else the app's
  guest token under `<app>:v2:guest-token`. The site's own session is not asked on these pages.
- **Account calls** go to `/api/workspace/account/…` with that token (`accountFetch`); the accounts Worker
  checks it against its own keys (`apps/accounts/src/bearer.ts`): names for anyone; for an account, settings (the
  `all` scope and each app's, read and patched, for the Settings panel), and
  its teams, read and run (making, renaming, inviting, roles, the join link, leaving, deleting, answering an
  invitation); nothing else.
- **Signing in.** The app's silent sign-in script is inlined in the Explorer's layout, one per switched-on app
  behind a check of the host (`lib/explorer/silent.ts`); Sign In and Sign Out are the app's
  (`components/explorer/AppAccountControl.tsx`). Teams are run here as on liveworkspace.app; after a change the
  page asks the app for a fresh token (`renewIdentity`), which names them.
- **Links** to the app's items, New, previews, the Library and Import from use the page's own origin
  (`appOrigin`); account and settings pages go to liveworkspace.app (`workspaceHref`); share links are
  always the app's public site. The Settings panel opens here in place, its Profile and API Tokens rows linking to
  liveworkspace.app, where the session that sets them lives.
- **This Browser** comes from the app's list in localStorage (`@liveworkspace/explorer/this-browser`), heard as it
  changes.
- **Telemetry** goes to liveworkspace.app's `/api/telemetry`, always for the app (the service takes a page's
  events only for its own origin).
- **Assets** load from `/_liveworkspace/…` on the same origin, which the router also forwards.

**The hop's cost.** Measured locally against the dev servers (liveplanner's router at :3200, the site at :3000,
medians of 30 interleaved requests and 12 warm page loads): the HTML's time to first byte is 22 ms through the
router against 19 ms direct, and a full load 140 ms against 109 ms, the difference being the dev server's
uncached chunks each taking the extra hop (about 3.5 ms each). In production the hop is one request from the app's
router to liveworkspace.app inside Cloudflare's network, on the HTML and RSC payloads only: the assets are
content-hashed, cached by the browser for a year after the first visit and at the edge before it. If that hop shows
up in the timings, the routers can reach the site through a service binding instead (`routeToWorkspace`'s `fetch`
option), which removes the public round trip.

Its styles are in their own stylesheet, `app/explorer/explorer.css`, so the other pages don't carry them. The
pages are `noindex`. Cmd/Ctrl+K opens the Search panel.

### Your account (`/account/…`)

Where a signed-in person runs what belongs to their account rather than to an app
([accounts.md](accounts.md)): `/account/tokens` (making an API token, seeing it once, and revoking it, the AI
tools connected in an app among them) and `/account/settings`, which opens the Settings panel ([below](#settings)).
Each is a tab of the same frame (`components/settings/AccountShell.tsx`). `/account` opens Settings. Signed out,
the pages ask them to sign in and come back. They read and write `/api/account/*` on this origin with the session
cookie (`lib/account-api.ts`), and are kept out of search. API tokens stay a page of their own: making one shows
its secret once, with room to copy it, which reads better as a page than as a row of a dialog; the panel's API
Tokens row links to it.

Teams are not here: they are made and run in the Explorer, wherever it shows
([one-explorer.md](one-explorer.md#teams-are-run-in-the-explorer)). The old addresses go there, permanently
(`public/_redirects`, pinned by `lib/teams-redirects.test.ts`), so every link already sent keeps landing:

| Old address                            | Goes to                  |
| -------------------------------------- | ------------------------ |
| `/account/teams` (and with a `/`)      | `/explorer/invites`      |
| `/account/teams/<id>` (and with a `/`) | `/explorer/team?id=<id>` |
| `/explorer?settings=teams`             | `/explorer/invites`      |

#### Settings

One Settings panel for every setting the account has: `SettingsPanel` in `@liveworkspace/settings-ui`, the same
one each app's editor opens as its Settings (each app's docs/specs/007-editor/user-preferences.md "This app or
All"). Here it is `components/settings/SiteSettingsDialog.tsx`, opened by `/account/settings`
(`components/settings/SettingsLanding.tsx`) and by the Explorer's Settings button. There is no other settings page:
the old page of cards (Profile, Notifications, Privacy and accessibility, and a "Your apps" card per app opening that
app's dialog) is gone, its parts now the panel's.

- **The switch.** Opened for an app, the header has the Explorer's switch: the app's logo and name, and **All** with
  liveworkspace's logo. The app's side shows that app's settings, from its plain-data catalogue
  (`@liveworkspace/settings/catalogues/<app>`, [accounts.md](accounts.md#scopes)), in the app's own Settings view: its
  rail with category tiles and nested sub-categories, panes, sections, collapsed sections, section notes, search,
  the phone's push layout and back bar. Its footer links into the app ("More in <app> Settings", `<app>/explorer/home`)
  for what only makes sense inside the editor (appearance, shortcuts, the editors' shared chrome such as UI scale).
  Opened for no app, the panel is All alone, with no switch. The side last chosen is kept in this browser
  (`liveworkspace:settings-scope:v1`); a link that names one wins.
- **All.** Every setting, grouped under headings in the rail: **Account** first (liveworkspace's logo), then each app
  under its name and logo, in the apps' order. Each heading is a single-open accordion, laid out as a category row (the
  same padding, icon column and type size): only the group holding the current pane starts open, opening one folds
  the other, each eases open and shut, picking a category opens its group, and a search opens them all so no hit is
  hidden. Account holds what belongs to the person in every app, the `all`
  scope ([accounts.md](accounts.md#settings)) and the profile: **Profile** (the display name and presence colour
  collaborators see, with a preview of their cursor and avatar, `ProfileCard.tsx`; the apps' one palette
  `PRESENCE_COLOURS`, plus Automatic; leaving the name empty shows the name they signed up with), under it
  **Notifications** (the apps' in-editor notes, and each email that can be turned off: comments, mentions, actions
  assigned, invitation answers, tips and check-ins, milestones) and **API Tokens** (a link to `/account/tokens`), then
  **Privacy** (anonymous usage events) and **Accessibility** (Reduce Motion). The switches are plain data in
  `@liveworkspace/settings/account`, worded as the apps' own Settings word them; the shared keys that only mean
  something in an editor (UI scale, panel opacity and the rest) are left to each app's own group. Ids in All are
  prefixed with their heading's (`account:notifications`, `livediagram.app:editor`), so two apps' categories and
  rows never collide.
- **Addresses.** `/account/settings?app=<name>` opens the panel on that app (`?app=all` on All);
  `#profile`, `#notifications`, `#privacy`, `#accessibility` and `#tokens` open All on that Account category, which is
  where every email's unsubscribe link lands. Closing the panel leaves an **Open Settings** button on the page, for the
  same app; the address drops the category it named.
- **Loading.** The panel's All view and catalogue view are their own chunk, fetched when the panel first opens (or
  the pointer heads for Settings); each app's catalogue is its own chunk too. The app's side reads that app's scopes
  once (`GET /api/account/settings/:app`, which answers `all` too); All reads each app's once, and the `all` scope
  comes with them, so it costs no request of its own. The profile is read when its category is first shown
  (`GET /api/account/profile`). What is read is kept for the page's lifetime (`settingsStore` in
  `lib/app-settings.ts`), so opening the panel again, or switching sides, costs nothing.
- **Saving.** Each change is shown at once and written alone, as a patch of just its key: an app's row to the app's
  scope (`PATCH /api/account/settings/:app` `{ app }`), an Account switch to `all` (`PATCH /api/account/settings`
  `{ all }`); put back with a note if the write fails; a slider saves on release, as in the app. The profile's name is
  saved once typing pauses (800 ms), when the field is left, or as the page closes, never per keystroke; its colour
  at once. Each change is counted as the app's own Settings counts it (`lib/settings-telemetry.ts`). An app picks a
  change up the next time it opens: each app reads its settings once per load, and the server's copy wins over its
  cached one.
- **On an app's address** (the Explorer there) the panel is the same, over `/api/workspace/account/settings…` with
  the app's token; its Profile and API Tokens rows link to liveworkspace.app, since the profile and tokens are the
  session's.
- **The frame.** A dialog `60rem` wide on desktop (never more than 92% of the window), one fixed height (`44rem`, less
  on a short window), full screen on a phone; it traps focus, closes on Escape, a click outside or its close button.

**Joining and declining** (`components/teams/`, the logic in `lib/teams.ts`). Two thin landings stay here,
because emails and copied links point at them and the accounts Worker makes them on this origin:

- **`/join?token=…`**: a team's join link. It shows the team; signed in, **Join** adds them and opens the team in
  the Explorer (`/explorer/team?id=<id>`); signed out, **Sign in to join** or **Create an account** come back to
  the same link; someone already in it goes straight to the team; an off or expired link says so.
- **`/join/decline?token=…`**: an invitation email's Decline link, signed in or not. Opening it only
  reads; the **Decline invitation** button declines. It also says when the invitation was already
  declined, has expired, was already accepted, or isn't valid. Its other way out is the Explorer's Invites,
  where the invitation is accepted instead.

### Accounts (`/sign-in`, `/sign-up`, `/consent`)

The pages an app sends people to when they sign in or create an account: livediagram's account
pages in liveworkspace's slate, the card beside what an account adds
(`components/account/`). What they do is in [the accounts README](../README.md#the-sign-in-and-registration-pages).

They are static like every other page. An app's OAuth request rides in their query, signed by the
accounts Worker, and goes back to it with each step. On arrival they ask the Worker for this
deployment's options (`GET /api/auth/sign-in-options`: the Turnstile site key, whether Google is
set up, and the name length), so one build serves production and staging. Turnstile is the one
script from another origin; the Trusted Types boot allows it. The pages are kept out of search
and send no Referer, since the address carries the signed request.

**Under an app's own address.** For an app's sign-in the same pages are served at
`livediagram.app/sign-in` (and `/sign-up`, `/consent`) by the app's router
([accounts.md](accounts.md#signing-in-on-the-apps-own-address)). There they call the accounts API at
`/api/workspace/auth` on that address (`lib/accounts.ts` `accountsApi`), and once signed in make the
one-time hand-off to liveworkspace.app before going back to the app (`afterSignIn`). A sign-in link
on an app's address (`signInHref`) starts at the app's own `/api/auth/sign-in`. "Continue with
Google" goes to liveworkspace.app's own page with the same signed request until the accounts Worker
says Google can come back to the app's address (`googleOnApps`). The build's assets live under
`/_liveworkspace` (`assetPrefix`; `scripts/asset-prefix.mjs` moves the export's `_next` there) so
they never meet an app's own `/_next`, and one build serves both addresses.

## Behaviour

- No analytics. The one cookie is the accounts session, set by the accounts API when someone
  signs in. Served under an app's address, the sign-in pages leave only short-lived `lw_flow.`
  cookies there, on `/api/workspace/auth`, which the hand-off clears. Every page asks the
  accounts API whether someone is signed in; the dashboard and the
  account pages also call their APIs. All of it is on this origin.
- Light and dark, following the device (the shared appearance boot script).
- Works at phone width with a 16px gutter. Tap targets are 44px on touch screens.
- The front door, Comparison and the dashboard are indexable: title, description, canonical,
  Open Graph, `robots.txt` and `sitemap.xml`.

## Hosting

One Worker, `liveworkspace-site`, static assets only, on the route `liveworkspace.app/*` (and
`www.`). The APIs' routes are more specific, so Cloudflare sends `/api/auth/*` and the two
`.well-known` discovery documents to the accounts Worker, `/api/telemetry/*` to the telemetry
Worker, and everything else here. Security headers come from `public/_headers`.

Every page enforces Trusted Types with the policies every app shares (`@liveworkspace/trusted-types`;
livediagram/docs/specs/016-platform/trusted-types.md). Each app's router passes these same headers through for the
Explorer and the sign-in pages, so they hold on every app's address too. The boot script allows the site's own build
under its asset prefix, `/_liveworkspace/_next/`. `trusted-types-guard.test.ts` holds every sink, the header and the
boot to this, and `pnpm test:e2e` (after `pnpm build`) opens every Explorer view and the main pages in Chromium under
the real header, failing on any Trusted Types refusal.

## Running it locally

```sh
corepack pnpm dev:workspace           # from the repo root: http://localhost:3000
```

That runs the site's dev server on 3000 and both APIs behind it (accounts on 8787, telemetry on
8790; first-time setup for each is in [the README](../README.md#local-development) and
[telemetry.md](telemetry.md#running-it-locally)). The dev server forwards `/api/auth/*`,
`/.well-known/*`, `/api/index/*` (the index, 8793) and `/api/telemetry/*` to them (`next.config.ts`), so the whole site works from
one origin, as it does in production. Run `corepack pnpm dev:site` for the pages alone.

## Not done yet

- **The apps' own policies** still live in each app's help centre; they should point here instead.
