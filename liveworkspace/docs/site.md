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
- **Signed in**: an avatar of the account's initials (accounts keep no pictures) and its first
  name (or full name, or email; the name hides on a phone), opening a menu
  (`components/AccountControl.tsx`): the name again, **Teams**, **API tokens** and **Settings** (the
  [Your account](#your-account-account) pages), and **Sign out**, which ends
  the liveworkspace session here. It doesn't sign anyone out of an app: each app holds its own
  tokens.

The site is static, so the control asks the accounts API (`GET /api/auth/get-session`, on this
origin, with the session cookie) once the page is up. Until it hears, it keeps its place empty,
so the bar doesn't jump. The sign-in pages leave it out: they are the sign-in.

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
   and a photo being cropped), and **Open <app>** in its deep accent. Below `lg` the window sits between the summary and the three things it does.
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
5. **Footer**: Our Apps (each app's logo, linking to its site), Platform (Product Comparison, which points at each app's
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

### Product Comparison (`/compare`)

Each app compares itself with the tools it answers on its own site, at `/alternatives` and
`/alternatives/<slug>` ([@liveworkspace/comparisons](../../packages/comparisons/README.md)). This page
only points at them: a card per app (its logo, its pitch and **See how <app> compares**, in its deep
accent), linked from the footer as **Product Comparison**. It has no data of its own, so a comparison
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
  to its items, with **All Apps** one click away. Someone who came straight here sees every app's items in
  liveworkspace's own colours.
- **The header.** The liveworkspace logo (with the site switcher), a hairline, then the app's logo, which leads
  back to the app. The search field sits in the middle (on Home the hero holds it), the account control on
  the right. Someone who came straight here sees no app logo.
- **Links.** Each item opens in its own app, at the address the sites registry (`APP_ITEMS`) gives: its base
  URL, item path and share path. **New** goes to the app's new-item route, with the folder or team it was made
  from. Help links go to the app's help centre.
- **First run.** An empty Home shows the app's welcome and starts, from that app's templates manifest
  (`@<app>/templates/welcome.json`, loaded only when Home is empty).
- **Hero art.** The picture on the right of Home's hero is the app's own, from its hero manifest
  (`@<app>/templates/hero.json`, generated from the components the app's Home draws), drawn by the Explorer's
  `HeroArt` as React elements (no HTML parsed, only boxes and shapes). It is loaded once per page, only on Home
  with the hero shown and room for it (`lg` and up); an app that ships none (all but liveplanner and livedocuments today) shows none.
- **Previews.** Real previews where the app serves one (`previewPath` in the registry; liveplanner's plan
  snapshot), asked with the person's workspace token and the item's share code. They are asked for only as a
  card nears the screen or a row is pointed at, at most 4 at a time, once per item version, and kept as up to
  200 blob URLs, least recently used out. The app's answer is cached by the browser for a day per version.
  Other apps' items show their kind's icon, with no request.
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
- **Appearance.** Light, dark or the system's, from the header beside the account control (the site's one
  switch, `SiteAppearanceToggle`).
- **Telemetry.** What people use here counts for the app the page shows, or `liveworkspace.app` on All Apps,
  batched and only with the person's consent ([telemetry.md](telemetry.md#the-explorer-on-liveworkspaceapp)).
- **The Inbox.** Plan cards wear their type's glyph, and its empty state points at liveplanner's help on actions.
- **This Browser.** Here, a row in the sidebar opens the app's own offline view (`offlinePath`), since what a
  browser keeps belongs to that app's origin. On the app's address the Explorer lists it itself (below).
- **Addresses handed over.** `?settings=<category>` (every notification email's unsubscribe link) goes to the
  matching account page: notifications to `/account/settings#notifications`, an app's own settings to
  `/account/settings?app=<app>`. `?ended=revoked` says, once, that the link a plan was open through was revoked.
  `?trashed=<id>&title=` offers Undo for an item just moved to the Trash. Each is dropped from the address once
  read.
- **Retired addresses.** `/explorer/profile` goes to notification settings, `/explorer/activity` to the Inbox,
  `/explorer/generated` to a search for items made by AI, `/explorer/dynamic` to All, `/explorer/invites` to
  `/account/teams`, `/explorer/tags` to Home, and `/explorer/offline` to the app's offline view (on an app's
  address, This Browser's own view).

#### On an app's own address

The same page, served by the app's router at `<app>.app/explorer/…` with the address unchanged
(`@liveworkspace/sites/workspace-proxy`, [one-explorer.md](one-explorer.md#the-explorer-on-each-apps-address)).
`lib/explorer/page-app.ts` reads the app from the page's own host (a static page sees no request), and with it:

- **Who it reads as** (`lib/explorer/app-session.ts`, `lib/explorer/token.ts`): the app's access token from the
  app's `POST /api/auth/token`, one request in flight at a time (it rotates the refresh cookie), else the app's
  guest token under `<app>:v2:guest-token`. The site's own session is not asked on these pages.
- **Account reads** go to `/api/workspace/account/…` with that token (`accountFetch`); the accounts Worker
  checks it against its own keys (`apps/accounts/src/bearer.ts`): names for anyone, teams, members and settings
  for an account, nothing else.
- **Signing in.** The app's silent sign-in script is inlined in the Explorer's layout, one per switched-on app
  behind a check of the host (`lib/explorer/silent.ts`); Sign In and Sign Out are the app's
  (`components/explorer/AppAccountControl.tsx`). New Team waits for liveworkspace.app's Teams page.
- **Links** to the app's items, New, previews, the Library and Import from use the page's own origin
  (`appOrigin`); account, teams and settings pages go to liveworkspace.app (`workspaceHref`); share links are
  always the app's public site.
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
pages are `noindex`. Cmd/Ctrl+K moves to the search field.

### Your account (`/account/…`)

Where a signed-in person runs what belongs to their account rather than to an app
([accounts.md](accounts.md)): `/account/teams`, `/account/tokens` (making an API token, seeing it
once, and revoking it, the AI tools connected in an app among them) and `/account/settings`. Each is
a tab of the same frame (`components/settings/AccountShell.tsx`). `/account` opens the teams.
Signed out, the pages ask them to sign in and come back. They read and write
`/api/account/*` on this origin with the session cookie (`lib/account-api.ts`), and are kept out of
search.

**Settings**, `/account/settings` (`components/settings/SettingsPanel.tsx` and `ProfileCard.tsx`,
the catalogue in `lib/account-settings.ts`): what belongs to the person in every app, the `all` scope
of their settings and their profile ([accounts.md](accounts.md#settings)). Every email that can be
turned off links here, so someone signed out signs in and comes back.

- **Profile**: the display name and presence colour collaborators see in every app, with a preview
  of their cursor and avatar. The colours are the apps' one palette (`PRESENCE_COLOURS` in
  `@liveworkspace/settings`), plus Automatic (no colour of their own, so each app picks); dark mode
  paints each in the palette's deeper shade, as the apps do.
  Leaving the name empty shows the name they signed up with.
- **Notifications**: each email that can be turned off (comments, mentions, actions assigned,
  invitation answers, tips and check-ins, milestones) and the apps' in-editor notes, worded as in the
  apps' own Settings.
- **Privacy and accessibility**: anonymous usage events, and Reduce Motion.
- **Your apps**: a card per app that opens that app's own settings in a dialog on this page
  (`components/settings/AppSettingsDialog.tsx`, `lib/app-settings.ts`): the settings in the app's
  scope, with the labels, descriptions, sections and order of the app's own Settings, from its
  plain-data catalogue (`@liveworkspace/settings/catalogues/<app>`, [accounts.md](accounts.md#scopes)).
  It has the app's switches, choices, sliders and groups of switches, hides a nested row while its
  switch is off as the app does, and leaves the shared settings to the cards above. What only makes
  sense inside the editor (appearance, shortcuts, the shared editor chrome such as UI scale and your
  colours, lists such as tours seen) stays in the app: the dialog ends with "More in <app> Settings"
  and a link to it (`<app>/explorer?settings=editor`). `?app=<name>` opens a dialog as the page
  loads, and the address follows the open dialog. The dialog traps focus, closes on Escape, a click
  outside or its close button, gives focus back to its card, and is a sheet from the bottom at phone
  width. Its code and each app's catalogue load only when one first opens (or the pointer reaches
  its card); the app's settings are read once when its dialog first opens
  (`GET /api/account/settings/:app`) and kept for the page's lifetime. Each change is shown at once and
  written alone as a patch of just its key in the app's scope (`PATCH { app }`), and put back with a
  note if the write fails; a slider saves once it rests. The app picks the change up the next time
  it opens: each app reads its settings once per load, and the server's copy wins over its cached
  one, and it only ever sends back the keys it changed itself.

The page reads the settings and the profile once each as it opens. Each switch and colour is shown
changed at once and written alone (one `PATCH`), and put back with a note if the write fails. The
name is saved once typing pauses (800 ms), when the field is left, or as the page closes, never per
keystroke.

**Teams** (`components/teams/`, the logic in `lib/teams.ts`):

- **The list**, `/account/teams`: invitations waiting for them first (team, organisation, member
  count, who invited them; **Join team** opens the team, **Decline**), then "Your teams", one
  rounded-3xl card per team: its tile (initials in a tone of its own), name, your role in a pill,
  organisation, member count, how many invitations are waiting, and the first four members'
  initials with "+N" for the rest, each disc ringed in the card's colour so the overlapping
  initials read. The whole card opens the team. One request fills the page: the list answer
  carries each team's counts and first four members (one query in the accounts API, however many
  teams). With no teams, an illustrated empty state offers **Create your first team**.
- **New team** opens a popover beside the button, not a page: the name (focused as it opens) and an
  optional organisation. **Create team** makes it and opens its page. Escape, Cancel or a click
  outside closes it and gives focus back to the button; Tab stays inside while it's open.
- **A team's page**, `/account/teams/<id>`: the apps' breadcrumb bar from their export screens
  ("All teams", the team named in a chip; copied from livediagram's `BackBar`, a link here), then
  the team's tile, name, organisation, members and your role. **Members** (role select and Remove
  for admins; the only admin's own role is pinned) and **Pending invitations** (waiting ones with
  Withdraw, then any declined or expired, with Clear). In the side column, for admins: **Invite
  people** (address and Member / Admin), **Invite by link** (turn on, copy, when it ends, a new link,
  turn off), **Name and organisation**; for everyone, **Leave** (hidden for the only admin while
  others remain, with why) and, for admins, **Delete team**, each confirmed once. Leaving or
  deleting goes back to the list. People are shown by name, or an invited address read as one
  (anna.smith@… is "Anna Smith"), with the address beneath.
- The site is static, so every team page is one exported file (`app/account/teams/[id]`, at the
  placeholder id `team`); `public/_redirects` serves it for any `/account/teams/:id` and the page
  reads the id from the address. Links to it are plain anchors, so no client router asks for
  per-team files.
- **`/join?token=…`**: a team's join link. It shows the team; signed in, **Join** adds them and opens
  it; signed out, **Sign in to join** or **Create an account** come back to the same link; someone
  already in it goes straight to the team; an off or expired link says so.
- **`/join/decline?token=…`**: an invitation email's Decline link, signed in or not. Opening it only
  reads; the **Decline invitation** button declines. It also says when the invitation was already
  declined, has expired, was already accepted, or isn't valid.

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
- The front door, Product Comparison and the dashboard are indexable: title, description, canonical,
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
