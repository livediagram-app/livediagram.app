# liveworkspace.app

liveworkspace.app is one static website. Every page is in it: the front door that says what
liveworkspace is and sends people on to the app that fits their work, the public telemetry
dashboard, and the sign-in, registration and consent pages every app sends people to. The apps
(livediagram.app, liveplanner.app, livedocuments.app, livedesign.app) each keep their own marketing site for the
detail.

```
apps/site          the website (a Next static export, Cloudflare static assets)
apps/accounts      the accounts API, /api/auth/* and /api/account/* (accounts.md)
apps/index         the index, /api/index/* (the Explorer's lists)
apps/media         media, /api/media/* and /api/previews/* (previews.md)
apps/telemetry     the telemetry API, /api/telemetry/* (telemetry.md)
apps/community     the Community API, /api/community/* (community.md)
```

The APIs are Workers on more specific routes of the same origin, so the pages call them as
`/api/auth/…`, `/api/index/…` and so on, with no cross-site requests.

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

- **Signed out**: the same control, as **Guest**: a neutral disc with a person glyph (not a presence colour, so it
  never passes for someone), the word "Guest" (hidden on a phone) and the chevron, opening "Guest" over "Not signed
  in", then **Sign in**, the menu's primary, which opens `/sign-in` with the page to come back to
  (`?return=/telemetry`, say), and **Create account** (`/sign-up`, with the same `?return=`). Once signed in, the
  page goes back there. Only a path on this site is followed, so the link can't send anyone elsewhere. A guest has
  no settings on liveworkspace.app (see the Explorer's bottom bar), so the menu here offers none.
- **Signed in**: an avatar of the account's initials (accounts keep no pictures: always two letters: the first
  letters of the first and last names (the full name, where the account has one), else a single name's first two, on a disc of the account's presence colour, set in Settings › Profile:
  a palette colour in its deep shade, a custom one as it is when white reads on it at AA and otherwise
  mixed with black until it does (`color-mix(in oklab, <colour> 55%, black)`, which always does). With
  none (Automatic), the deep shade of a presence colour picked from the name, so the same person has the
  same colour in every app. The colour comes with the session (`user.color` from `/get-session`; an
  app's `<prefix>account_colour` cookie, [accounts.md](accounts.md#an-apps-signed-in-cookies)), and a
  new pick in Settings › Profile repaints this header at once) and its first
  name (or full name, or email; the name hides on a phone), opening a menu
  (`components/AccountControl.tsx`): the name again over "Your account", **Explorer** (this site's own
  `/explorer`, every app's work at once, [The Explorer](#the-explorer-explorer)), **Settings**, which opens the
  Settings panel ([below](#settings)) in place over whatever page this is, without leaving it, and **Sign out**,
  which ends the liveworkspace session here. It doesn't sign anyone out of an app: each app holds its own
  tokens. API tokens are a category of the panel, not a menu item.

The site is static, so the control asks the accounts API (`GET /api/auth/get-session`, on this
origin, with the session cookie) once the page is up. Until it hears, it keeps the Guest button's place, invisible,
so the bar doesn't jump. The sign-in pages leave it out: they are the sign-in.

The menu is one component, `AccountMenu` in `@liveworkspace/account-menu` (`packages/account-menu`), signed in or
as Guest (its `guest` prop: where Sign in and Create account go, and Settings where a guest has some), and
every place that shows the account control uses it: this header, the Explorer on an app's address
(`components/explorer/AppAccountControl.tsx`), and each app's marketing header (its `SiteHeader`, through the
package's `AppAccountMenu`). Each passes in its own UI package's menu hooks (`useMenuButton`, `useMenu`,
`useClickOutside`), so the keyboard and focus behaviour is the one every app's menus have, and says what
Settings and Sign out do. **Settings never leaves the address the person is on**: signed in or as a guest, it is a
button (`onOpenSettings`, with `onPrepareSettings` fetching the panel's code when the pointer or focus reaches it)
wherever the surface has the panel: this site's header (its own lazily loaded panel), and the Explorer, here and on
an app's address (the Explorer's panel). A surface with no panel of its own, an app's marketing page, links instead
to that app's own Explorer on the same address with the panel open (`/explorer?settings=all`, `settingsHref`). Only
liveworkspace.app's header adds **Explorer** (`explorerHref`): on an app's address the app's own Explorer is a click
away already. On an app's own pages Sign out is the app's. A marketing page learns who is signed in from the app's readable cookies,
`<prefix>signed_in` and `<prefix>account` (the name), and makes no request for it
([accounts.md](accounts.md#an-apps-signed-in-cookies)). There a guest's Sign in is the app's own
(`/api/auth/sign-in?return_to=<the page>`) and Create account the same with `&screen=sign-up`, and the Guest button
is a stand-in from the package's light entry (`DeferredAccountMenu` in `@liveworkspace/account-menu/placeholder`):
the menu's code is fetched only when the pointer or focus reaches it, and a press made before it arrives opens the
menu once it has, so a visitor who never touches it costs no request.

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
feature only some apps have (livediagram's Google Drive mirror, liveplanner's live sessions) says which;
Offline Mode is every app's. Every app is MIT-licensed, and the terms say so app by app. Both share
`components/LegalPage.tsx`, and their date and contact form are in `lib/legal.ts`. Change them when what an app stores or who it uses changes.

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
- **Which app.** The app the person came from: `?from=`, then the referrer. The page wears that app's colours (its
  brand ramp, light and dark) and opens filtered to its items, with **All Apps** one click away. The switch reads the
  app's own name ("livediagram") and **All Apps**, each with its logo: the app's prism in its accent, and
  liveworkspace's own for All Apps (the apps' Explorer panels do the same). Someone who came straight here (the
  account menu's **Explorer**, a bookmark, a page of this site) is in no app: they see every app's items, Home and
  Recent included, in liveworkspace's own colours. The last app used here (kept in this browser) only picks what
  **New** makes and whose welcome and hero Home shows; it no longer filters the lists.
- **The header.** The liveworkspace logo (with the site switcher), a slanted hairline with equal space either
  side, then the app's logo, which leads back to the app. On a phone, where there is less room, only the app's
  logo shows (the liveworkspace logo shows when no app is). The search field sits in the middle (on Home the hero holds it), the account control on
  the right. Someone who came straight here sees no app logo.
- **The bottom bar.** As the apps' own Explorers had it: a bar stuck to the foot of the page
  (`components/explorer/ExplorerBottomBar.tsx`), its controls on the right: **Search**, **Settings** and
  **Appearance** (Light, Dark or the system's, the site's one switch, `SiteAppearanceToggle`), each named beside its
  icon on a wide screen (`md` up) and an icon alone on a narrow one. Their hover cards open upward, above the bar. Settings shows for a person signed in, and
  opens the Settings panel ([below](#settings)) in a dialog over the Explorer, without leaving the page: filtered to
  the app the person came from (All one click away), or on All from no app. On an app's address it shows for a
  guest too, named for the app ("liveplanner Settings"), and opens that app's settings as kept in this browser
  ([Settings](#settings), "A guest"); the account menu's **Settings**, signed in or as a guest, opens the same
  panel the bar does. On liveworkspace.app a guest
  sees no Settings: a guest's settings live in each app's own storage on the app's address, which this origin
  can't read, and the platform keeps no device settings of its own beyond Appearance, already on the bar. Its code,
  and the app's catalogue, are fetched when the button is pointed at. The toasts and a guest's sign-in banner stand
  above the bar.
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
- **What you can make.** Home's hero pictures the kinds of work the filtered app makes (one per app under All
  Apps), drawn by the Explorer itself from `@liveworkspace/ui/work-art`, so nothing is loaded for them. Each starts
  its template in its app: the page hands the Explorer `templateHref` (`lib/explorer/host.ts`), the app's own
  `/new?template=` ([one-explorer.md](one-explorer.md) "What you can make, on Home's hero").
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
- **Home's banner.** Closing it is the person's `homeBanner` setting, a common one kept in `all`
  (`PATCH /api/account/settings`; read with the app's scopes, an app's old copy counting until `all` has one,
  [accounts.md](accounts.md#common-settings)), so it stays closed in every app's Home and editor too, and the
  other way round.
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
- **Addresses handed over.** `?settings=<category>` (every notification email's unsubscribe link, the old
  `/account/settings` and `/account/tokens`, a Search result) opens the Settings panel here, in place, once the
  page knows who is here (`settingsOpening` in `lib/explorer/host.ts`): `notifications`, `profile` (or `account`),
  `tokens`, `privacy` and `accessibility` open All on that Account category, `all` opens All, an app's name
  (`liveplanner`) that app's side, `teams` goes to the Invites, and anything else (an editor's own category) the
  side of the app the person came from. It works on a move inside the Explorer too, not only on arrival. Signed
  out, an Account category asks them to sign in and come back to the same address; on an app's address a guest's
  app side opens as the guest's panel. `?settings=` is dropped from the address as the panel closes.
  `?ended=revoked` says, once, that the link a plan was open through was revoked. `?trashed=<id>&title=` offers Undo
  for an item just moved to the Trash. Each is dropped from the address once read.
- **Retired addresses.** `/explorer/profile` goes to notification settings, `/explorer/activity` to the Inbox,
  `/explorer/generated` to a search for items made by AI, `/explorer/unsorted` and `/explorer/dynamic` to My Work (`/explorer/all`; there is no Unsorted view, since My Work's root already lists what is in no folder), `/explorer/tags` to Home, and `/explorer/offline` to the app's offline view (on an app's
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
  (`appOrigin`); share links are always the app's public site. The Settings panel opens here in place (the bottom
  bar, the account menu, `?settings=`), its Profile and API Tokens rows linking to the panel on liveworkspace.app
  (`/explorer?settings=profile`, `?settings=tokens`, `workspaceHref`), where the session that sets them lives.
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

There are no account pages any more: what belongs to the account rather than to an app (the profile, the emails,
privacy, accessibility and API tokens) is in the Settings panel ([below](#settings)), which opens in place from the
account menu on every surface and from the Explorer's bottom bar. The old addresses stay, because emails and
bookmarks carry them: each is a tiny page that sends the browser on to the Explorer with the panel open on the same
section (`lib/account-redirect.ts`, `replace`, so Back doesn't land on it):

| Old address                                                                             | Goes to                                  |
| --------------------------------------------------------------------------------------- | ---------------------------------------- |
| `/account`, `/account/settings`                                                         | `/explorer?settings=all`                 |
| `/account/settings#profile` (`#notifications`, `#privacy`, `#accessibility`, `#tokens`) | `/explorer?settings=profile` (and so on) |
| `/account/settings?app=<name>` (`?app=all`, `#apps`)                                    | `/explorer?settings=<name>` (`all`)      |
| `/account/tokens`                                                                       | `/explorer?settings=tokens`              |

The panel reads and writes `/api/account/*` on this origin with the session cookie (`lib/account-api.ts`).

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
All"). Here it is `components/settings/SiteSettingsDialog.tsx`, opened by the account menu's **Settings** on any
page of this site (`components/AccountControl.tsx`), and in the Explorer by its bottom bar, its account menu and
`?settings=` ([The Explorer](#the-explorer-explorer)). There is no settings page: `/account/settings` only sends
the browser on to the Explorer with the panel open ([Your account](#your-account-account)).

- **The app's name.** Opened for an app, the header's title reads as that app's: its logo and wordmark ("live" in
  the app's accent), then **Settings** ("liveplanner Settings"), on the front screen of either side of the switch. A
  pushed pane's back bar takes its place. Opened for no app, the title is **Settings** alone.
- **The switch.** Opened for an app, the header has the Explorer's switch: the app's logo and name, and **All** with
  liveworkspace's logo. The app's side shows that app's settings, from its plain-data catalogue
  (`@liveworkspace/settings/catalogues/<app>`, [accounts.md](accounts.md#scopes)), in the app's own Settings view: its
  rail with category tiles and nested sub-categories, panes, sections, collapsed sections, section notes, search,
  the phone's push layout and back bar. Every setting the app uses is there, the common ones (below) included,
  each of those marked **All apps** under its description. Its footer links into the app ("More in <app> Settings", `<app>/explorer/home`)
  for what only makes sense inside the editor (appearance, shortcuts, the editors' shared chrome such as UI scale).
  Opened for no app, the panel is All alone, with no switch. The side last chosen is kept in this browser
  (`liveworkspace:settings-scope:v1`); a link that names one wins.
- **All.** Every setting, grouped under headings in the rail: **Account** first (liveworkspace's logo), then
  **Common** (liveworkspace's logo too), then each app under its name and logo, in the apps' order. Each setting shows
  once. Each heading is a single-open accordion, laid out as a category row (the
  same padding, icon column and type size): only the group holding the current pane starts open, opening one folds
  the other, each eases open and shut, picking a category opens its group, and a search opens them all so no hit is
  hidden. Account holds what belongs to the person in every app, the `all`
  scope ([accounts.md](accounts.md#settings)) and the profile: **Profile** (the display name and presence colour
  collaborators see, with a preview of their cursor and avatar, `ProfileCard.tsx`; the apps' one palette
  `PRESENCE_COLOURS`, plus Automatic; leaving the name empty shows the name they signed up with), under it
  **Notifications** (the apps' in-editor notes, and each email that can be turned off: comments, mentions, actions
  assigned, invitation answers, tips and check-ins, milestones) and **API Tokens** (making a token, seeing its
  secret once with room to copy it, and revoking one, the AI tools connected in an app among them,
  `components/settings/TokensPanel.tsx`, its own chunk fetched when the category is first shown; on an app's
  address a link to the same category on liveworkspace.app, since tokens are the session's), then
  **Privacy** (anonymous usage events) and **Accessibility** (Reduce Motion). The switches are plain data in
  `@liveworkspace/settings/account`, worded as the apps' own Settings word them; the shared keys that only mean
  something in an editor (UI scale, panel opacity and the rest) are left to each app's own group. **Common** holds
  every editor setting two or more apps have (`COMMON_SETTING_KEYS`, [accounts.md](accounts.md#common-settings)),
  once, in the categories the apps file them under: Editor (with Pages and Presenting under it), Explorer, and
  Panels › Collaborate, Layers, Map and Quick Style. It is built from the apps' catalogues (`commonCatalogue` in
  `@liveworkspace/settings/common`), worded as the apps word them. Where the apps file a setting differently, the
  platform's place is used: Show Home Banner sits under each app's own Documents, Plans or Designs, and under
  **Explorer** here. A Common row reads `all`, falling back to an app's old copy as `joinSettings` does, and writes
  `all`. Each app's group then holds only that app's own settings; an app left with none would be left out of the
  rail rather than shown with a note (today each app keeps some of its own). Ids in All are prefixed with their
  heading's (`account:notifications`, `common:editor`, `livediagram.app:editor`), so two apps' categories and rows
  never collide.
- **The Account section shows once.** Each editor's own Settings has Account, Notifications, API Tokens, Privacy
  and Accessibility categories of its own, and each app's catalogue an Account › Notifications. In All they are
  folded into the Account section rather than listed again under the app: the app's rows the Account section
  doesn't already have (its Trash, Cloud Sync and Delete Account; its own email switches, such as "Someone Joins My
  Canvas"; its own accessibility rows) join the Account category of the same name, under a heading with the app's
  name, and the editor's identity row gives way to the Profile's header. Every category id is unique in the panel,
  and no category name the Account section uses appears under an app (pinned by
  `packages/settings-ui/src/no-duplicates.test.tsx`, for every app's catalogue and an editor's own shape).
- **Profile** (the Account section's first category, `packages/settings-ui/src/profile/`), laid out as the old
  livediagram Profile page was, richer: grouped cards under headings, in the app's brand colour, light and dark.
  - **The header card**: a banner in the brand's tint with a drawing of a canvas where the person's cursor and
    name tag sit in their presence colour, their avatar (initials on their colour, Automatic as the name's own
    colour, as the account menu paints it), their display name, email, **liveworkspace account** and when they
    joined. Every host passes what it knows (`AccountHost.identity`): the site its session, the Explorer on an
    app's address the app's session, an editor its signed-in user.
  - **Name and Colour**: the display name and presence colour with the preview of their cursor and avatar
    (`ProfileCard.tsx`) on liveworkspace.app; on an app's address and in an editor, a row with the current name and
    colour and **Edit** on liveworkspace.app, since the profile is the session's.
  - **Sign-in Methods** and **Where You’re Signed In**, two sections (on liveworkspace.app, `AccountHost.security`): the methods (an emailed code to
    the account's address, always; Google, **Connected** or **Connect**, when the deployment has Google), and
    **Where You're Signed In** (each session's browser and system, when it was last active, **This device** for the
    current one, **Sign Out** of any other and **Sign Out Everywhere Else**), from Better Auth's own
    `/list-sessions`, `/revoke-session`, `/revoke-other-sessions`, `/list-accounts` and `/link-social` on this origin.
    On an app's address and in an editor, a link to the same section on liveworkspace.app.
  - **Your Account**: **Sign Out** where the host can sign out (`AccountHost.onSignOut`), and, in an editor's All, the
    editor's Trash, Cloud Sync and Delete Account, folded in as above.
  - **A guest** (an editor's own Settings, the Explorer on an app's address): Profile shows the header card as a
    guest (their name, Guest, and their colour where the app has one) with **Sign in** and **Create account**, and
    says what an account adds, rather than empty rows.
  - Not here, on purpose: a profile picture (removed in `b964b391d`: accounts have none, people show as initials);
    an email change, passwords and passkeys (accounts sign in with an emailed code or Google only, and the accounts
    Worker has no change-email flow); deleting the account from liveworkspace.app (closing an account goes through
    an app's server, `/api/auth/delete-account`, so its data goes with it; the site has no such door yet).
- **Addresses.** `/explorer?settings=<section>` opens the panel there, on liveworkspace.app or an app's address:
  `?settings=<app>` on that app (`?settings=all` on All); `profile`, `notifications`, `privacy`, `accessibility` and
  `tokens` open All on that Account category, which is where every email's unsubscribe link lands. The address drops
  `?settings=` as the panel closes, so the Explorer is left as it was.
- **Loading.** The panel's All view and catalogue view are their own chunk, fetched when the panel first opens (or
  the pointer heads for Settings); each app's catalogue is its own chunk too. The app's side reads that app's scopes
  once (`GET /api/account/settings/:app`, which answers `all` too); All reads each app's once, and the `all` scope
  comes with them, so it costs no request of its own. The profile is read when its category is first shown
  (`GET /api/account/profile`). What is read is kept for the page's lifetime (`settingsStore` in
  `lib/app-settings.ts`), so opening the panel again, or switching sides, costs nothing.
- **Saving.** Each change is shown at once and written alone, as a patch of just its key: an app's row to the app's
  scope (`PATCH /api/account/settings/:app` `{ app }`), an Account switch, a Common row or a common setting's row on
  an app's side to `all` (`PATCH /api/account/settings` `{ all }`; a field of an object, a Presenting option say,
  writes the object with the rest kept, the old copy filling in where `all` has none); put back with a note if the write fails; a slider saves on release, as in the app. The profile's name is
  saved once typing pauses (800 ms), when the field is left, or as the page closes, never per keystroke; its colour
  at once. Each change is counted as the app's own Settings counts it (`lib/settings-telemetry.ts`); a Common row's
  in the name of the app its wording came from (the app the panel was opened for when it has the setting). An app picks a
  change up the next time it opens: each app reads its settings once per load, and the server's copy wins over its
  cached one.
- **On an app's address** (the Explorer there) the panel is the same, over `/api/workspace/account/settings…` with
  the app's token; its Profile header is the app's session's, and its Name and Colour, Sign-in Methods and API
  Tokens rows link to liveworkspace.app, since the profile, sessions and tokens are the
  session's.
- **A guest** (on an app's address only) gets the app's side alone: no switch, no All, no Account section and no
  tokens, but a **Profile** category first, the guest's header card and the way to sign in ([Profile](#settings)). The settings are the ones the app's editor keeps for a guest in this browser, read and written
  by a device store (`createDeviceSettingsStore` in `@liveworkspace/settings-ui`) under the editor's own key and
  shape: one flat JSON object at `<app>:user-preferences:v1` (`DEVICE_PREFERENCES` in
  `@liveworkspace/settings/device`, pinned to each editor's `STORAGE_KEY` by its catalogue test), the `all` keys
  (`ALL_SETTING_KEYS`) and the app's own side by side, as the editor holds them. The panel reads it split into the
  two scopes, as the accounts API answers, and writes only the key a change touches, over the freshest copy, so a
  change made in an open editor tab meanwhile is kept. A write also marks the browser unsynced for the guest
  (`<app>:user-preferences:unsynced`, holding the guest's `guest_<uuid>`), the editor's own mark for a save not yet
  sent: the editor's next load lets this browser's copy win over the server's and sends it on, so the change is
  what the editor shows the next time it opens. Nothing is sent from here. Its footer says the settings are saved in
  this browser and offers **Sign in to keep them on every device** (the app's sign-in, back to the Explorer).
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
  accounts API whether someone is signed in; the dashboard, the Explorer and the
  Settings panel also call their APIs. All of it is on this origin.
- Light and dark, following the device (the shared appearance boot script).
- Works at phone width with a 16px gutter. Tap targets are 44px on touch screens.
- The front door, Comparison, the dashboard and the privacy policy and terms are indexable: title, description, canonical,
  Open Graph, `robots.txt` and `sitemap.xml`.

## Hosting

One Worker, `liveworkspace-site`, static assets only, on the route `liveworkspace.app/*` (and
`www.`). The APIs' routes are more specific, so Cloudflare sends `/api/auth/*`, `/api/account/*` and
the two `.well-known` discovery documents to the accounts Worker, `/api/index*` to the index, `/api/media*` and
`/api/previews*` to media, `/api/telemetry*` to telemetry, `/api/community*` to the Community, and everything else
here. Security headers come from `public/_headers`.

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

That runs the site's dev server on 3000 and the five APIs behind it (accounts on 8787, telemetry on 8790, the
Community on 8791, media on 8792, the index on 8793; first-time setup for each is in
[the README](../README.md#local-development) and the API's own doc). The dev server forwards `/api/auth/*`,
`/api/account/*`, `/.well-known/*`, `/api/index/*`, `/api/previews/*`, `/api/telemetry/*` and `/api/community/*`
to them (`next.config.ts`), so the whole site works from one origin, as it does in production. Run `corepack pnpm dev:site` for the pages alone.

## Not done yet

- **The apps' own policies** still live in each app's help centre; they should point here instead.
