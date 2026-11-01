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
apps/status        the hourly status checks and their history, /api/status* (status.md)
apps/drive         Google Drive sync for every app, /api/drive* (drive.md)
apps/redirect      the bare liveworkspace.app's page loads, one 301 to www. ("Hosting")
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
share-intent links with no SDKs or tracking, and Copy link, all for `https://www.liveworkspace.app`.
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
- **Signed in**: an avatar of the account's Google picture where it has one ([accounts.md](../003-accounts/accounts.md#profile-pictures): `user.image` from `/get-session`, an app's `<prefix>account_picture` cookie), over its initials, which show whenever there is no picture or it fails to load (always two letters: the first
  letters of the first and last names (the full name, where the account has one), else a single name's first two, on a disc of the account's presence colour, set in Settings › Profile:
  a palette colour in its deep shade, a custom one as it is when white reads on it at AA and otherwise
  mixed with black until it does (`color-mix(in oklab, <colour> 55%, black)`, which always does). With
  none (Automatic), the deep shade of a presence colour picked from the name, so the same person has the
  same colour in every app. The colour comes with the session (`user.color` from `/get-session`; an
  app's `<prefix>account_colour` cookie, [accounts.md](../003-accounts/accounts.md#an-apps-signed-in-cookies)), and a
  new pick in Settings › Profile repaints this header at once) and its first
  name (or full name, or email; the name hides on a phone), opening a menu
  (`components/AccountControl.tsx`): the name again over "Your account", **Explorer** (this site's own
  `/explorer`, every app's work at once, [The Explorer](#the-explorer-explorer)), **Settings**, which opens the
  Settings panel ([below](#settings)) in place over whatever page this is, without leaving it, and **Sign Out**
  (its hint under it: "Every app in this browser"), which ends the liveworkspace session here and with it every
  app's session in this browser ([accounts.md](../003-accounts/accounts.md#signing-out)). API tokens are a category
  of the panel, not a menu item.

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
away already. On an app's own pages Sign out is the app's, and it signs out of every app in the browser just the same, through the accounts site's hop. A marketing page learns who is signed in from the app's readable cookies,
`<prefix>signed_in` and `<prefix>account` (the name), and makes no request for it
([accounts.md](../003-accounts/accounts.md#an-apps-signed-in-cookies)). There a guest's Sign in is the app's own
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
   shimmer, "live" in the app's deep shade on light and its own 400 on dark, which reads at AA on a dark card where its 500
   accent does not (`components/landing/AppLogo.tsx`). The copy is
   `lib/apps.ts`; tests require it for every app and that white text on each deep accent passes
   WCAG AA. On a dark page, text in an app's colour (a link, a name, a card's call to action, here and on every
   page of the site) is its light shade, `light` in `@liveworkspace/sites` (its brand-400), which passes AA on every
   dark surface; the accent itself does not for each app (liveplanner's violet-500 is 4.1:1 on slate-900).
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
   comparisons, the telemetry dashboard and Status) and Legal (the
   privacy policy, Terms of Use, Report a Vulnerability and Licences). Report a Vulnerability opens the repository's
   security policy on GitHub (`SECURITY_POLICY_URL`,
   [Vulnerability disclosure](../001-platform-scope/vulnerability-disclosure.md)). Every footer, here and in each app, labels the
   terms "Terms of Use" from one constant, `TERMS_LABEL` in `@liveworkspace/sites`.

The illustrations are drawn in the page (HTML and SVG with the apps' own logos), not images. Their
ambient motion (the current along the lines, drifting cursors, the cards settling) is in
`app/landing-motion.css`, paced as content, and stops for reduced motion.

### Privacy and terms (`/privacy`, `/terms`)

One privacy policy and one set of terms for liveworkspace and every app in it, linked from the
footer. They were built from the apps' own policies, which said the same things app by app; a
feature only some apps have (livediagram's sticky-note reader, liveplanner's live sessions) says which;
Google Drive sync and Offline Mode are every app's. Every app is MIT-licensed, and the terms say so app by app. Both share
`components/LegalPage.tsx`, and their date and contact form are in `lib/legal.ts`. Change them when what an app stores or who it uses changes.
The privacy policy's Security section and the terms' Acceptable use send a vulnerability to the private advisory
form (`SECURITY_ADVISORY_URL`), never the contact form
([Vulnerability disclosure](../001-platform-scope/vulnerability-disclosure.md)).

### Security reporting (`/.well-known/security.txt`)

The site serves liveworkspace.app's [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) file from
`app/.well-known/security.txt/route.ts`, built at build time by `securityTxt` in `@liveworkspace/sites/security`, the
same builder every app's marketing site uses. Its `Policy` is the repository's security policy on GitHub
(`SECURITY_POLICY_URL`), since every app's policy agrees and this site has no help centre of its own. The fields and
why are in [Vulnerability disclosure](../001-platform-scope/vulnerability-disclosure.md#securitytxt-on-every-site).

### Help (`/help/google-drive`)

Each app keeps its own help centre; a feature that is the platform's, the same in every app, is explained once here
instead. That is Google Drive sync (drive.md): `/help/google-drive`, one page in the site's own chrome, listed
in the sitemap. Settings › Account › Cloud Sync links to it, and each app's help has a short **Google Drive**
article under Account and Data (`/help/account-and-data/google-drive/`) that points here, so the apps' search,
links and old addresses still find it. Change it when drive.md changes what a person sees.

### Licences (`/licences`)

The third-party licences of this website and the platform's services (accounts, Community, index,
media, status, telemetry), linked from the footer and listed in the sitemap. It is each product's page
([Third-party licences](../../../../livediagram/docs/specs/002-project-scope/third-party-licences.md)) on
liveworkspace's own tables: the same generator (`@liveworkspace/licences`) and page body
(`@liveworkspace/marketing-site`), with the site's apps, overrides and embedded works in
`apps/site/lib/licences/`. The site's build regenerates it before `next build` and checks the export
after; its intro links each app's own page. Each app's declared dependencies are tested to appear
(`apps/site/lib/licences/licences.test.ts`).

### Comparison (`/compare`)

Each app compares itself with the tools it answers on its own site, at `/alternatives` and
`/alternatives/<slug>` ([@liveworkspace/comparisons](../../../../packages/comparisons/README.md)). This page
only points at them: a card per app (its logo, its pitch and **See how <app> compares**, in its deep
accent), linked from the footer as **Comparison**. It has no data of its own, so a comparison
added in an app needs nothing here.

The comparisons lived here for a while, so every old address redirects permanently from
`public/_redirects`: `/alternatives` to `/compare`, each `/alternatives/<slug>` to the same slug on the
app that speaks for it (`https://www.livediagram.app/alternatives/miro`, say), and any other
`/alternatives/*` to `/compare`. `lib/comparison-redirects.test.ts` pins every one.

### Telemetry (`/telemetry`)

The public dashboard for every app's anonymous events, all apps at once or one at a time
(`?app=livediagram.app`): [telemetry.md](../008-telemetry/telemetry.md). Each app's filter shows that app's logo
as its own header does, the prism and the wordmark in the app's accent. It reads its numbers from
`/api/telemetry/summary`. Its styles (and each sending app's shared UI, which its views render) are in
their own stylesheet, `app/telemetry/telemetry.css`, so the other pages don't carry them.

### Status (`/status`)

One status page for liveworkspace and every app, linked from this site's footer and from every app's footer
as **Status** (`@liveworkspace/ui` SiteFooter, `${PLATFORM_SITE.url}/status`, so a dev server links to the local
site). The apps had a page each at `/status`, a static list that said "Operational" whatever happened; those
pages are gone, and each app's router sends its old `/status` here permanently, to the app's own group
(`/status#livediagram`, `statusPageUrl` in `@liveworkspace/sites/workspace-proxy`).

The page shows two kinds of check side by side. **Live checks** run from the visitor's browser, so they show what
_this visitor_ sees, now. **Hourly checks** run on Cloudflare, from the status Worker ([status.md](../009-status/status.md)), and are
kept for 90 days, so the page can show the last one, a bar per day and recent incidents. Both check the same services,
from one list, `@liveworkspace/status`, so they never drift. Every check is an endpoint the service already answers,
chosen to be cheap (no database read where one can be avoided, or one the edge caches):

| Group         | Service            | Check                                              | Up when                      |
| ------------- | ------------------ | -------------------------------------------------- | ---------------------------- |
| liveworkspace | Website            | `HEAD /robots.txt`                                 | 200                          |
|               | Accounts & sign-in | `GET /.well-known/openid-configuration`            | 200, JSON                    |
|               | Explorer index     | `GET /api/index/jwks`                              | 200, JSON                    |
|               | Community          | `GET /api/community/facets?app=livediagram.app`    | 200, JSON (edge cached)      |
|               | Telemetry          | `OPTIONS /api/telemetry/events`                    | 204 (no database)            |
|               | Media & previews   | `GET /api/previews`                                | 404 JSON from the Worker     |
| each app      | API                | `GET <app>/api/capabilities` (no auth, CORS `*`)   | 200, JSON                    |
|               | Realtime rooms     | none of its own: the rooms are the API Worker's    | as the API                   |
|               | Router             | none of its own: every check below goes through it | any check through it answers |
|               | Editor             | `HEAD <app>/icon.svg`                              | the browser reaches it       |
|               | Marketing site     | `HEAD <app>/robots.txt`                            | the browser reaches it       |
|               | Help centre        | `HEAD <app>/help/robots.txt`                       | the browser reaches it       |
|               | Community pages    | `HEAD <app>/community/` (livediagram only)         | the browser reaches it       |
|               | MCP server         | `GET mcp.<app>/health` (CORS `*`)                  | 200, JSON                    |

liveworkspace's own checks are on this origin, so the page reads their answers. Each app's API and MCP server
answer any origin (CORS `*`), so those are read too. An app's pages send no CORS headers, so the browser can only
learn that the site answered (an opaque `no-cors` request), not what it said: the page calls that **Reached**
and says so in the legend, rather than claiming more. The Media Worker answers only the apps' Workers, so its
check is that the Worker itself answers (its JSON 404, which the site's own 404 page never is). Realtime and the
router have no check of their own, and the page says which check stands for them. On staging the apps are their
`staging.` addresses and the MCP servers aren't checked; on a dev server, each app's router port and its MCP
Worker's port.

The hourly checks can read every answer, so the pages a browser can only call **Reached** get a true state there
(up on a 2xx or 3xx).

Each service shows its state as an icon and a word, never colour alone: **Operational** (answered as expected),
**Slow** (answered, after more than 1.5 s), **Down** (no answer in 10 s, a network error, or an answer it shouldn't
give), **Checking**, and **Reached** for the pages above. Beside it: how long the answer took, what it was
(`HTTP 200`, `Reached`, `Through the API`; where a bare code would mislead, what it means instead: Media's expected
404 reads "Answers; storage not checked", Telemetry's 204 "Answers; database not checked") and a strip of the checks made since the page was opened (at most 30
each, kept in memory and gone on reload).

Under that, each service shows its stored history, from one `GET /api/status/history` on load:

- **liveworkspace's last check**, by a cloud icon, under this visit's (by a person icon), in the same columns: how
  long it took, its answer and its state as an icon and a word.
- **90 days** as a bar per day, oldest on the left, with when the run was ("Checked by liveworkspace 23 min ago")
  and the uptime over them (`99.98% over 90 days`) under it. A bar's colour and height
  both say its worst state (tall for up, middle for slow, short for down, a faint stub for a day without checks), and
  hovering, focusing or tapping the strip shows the day: its date, uptime, worst state as an icon and a word, and its
  incidents. To assistive tech the strip is one image with a summary in words ("99.98% up over 90 days; 2 days with
  incidents, the last on 12 October").

Below the groups, **Recent incidents** lists the last 90 days' outages (at most 50), newest first; a slow hour is no
incident, and shows only in its day's bar. Each: the service under its group's logo, **Down** as an icon and a word,
when it began, how long it lasted (or **Ongoing**), and the
first error. The latest 10 show, and **Show all** the rest. The realtime rooms take the API's check, so their
incidents would repeat the API's and are left out of the list (their bars still show them). With none, it says so.

The stored history is read again every 5 minutes while the tab is visible; it changes once an hour, so nothing reads
it faster. When the Worker can't be reached or has nothing yet (a dev server without it, the hour after a first
deploy), the page shows its live checks alone and says so quietly, once, above the groups.

On top, the overall state (all operational, some slow, or some down), how many services answered, the median
answer time, when the last round finished and when the next may run. A round runs once on load; after that the page
never checks on its own, and **Check now** runs the next. Each round asks every service at once, so after one ends
**Check now** rests for 30 seconds, showing the seconds left in words and on the ring, so that an open tab or a
restless finger can't load the services. The rest is the browser's only (a reload starts afresh, with its one round).
A change of overall state is announced politely to screen readers. A legend explains every state.

Groups: liveworkspace first (its wordmark), then each app in `@liveworkspace/sites` order under its own logo,
never a coloured dot, each with its own summary and an anchor (`#livediagram`). Under the summary, a jump link per
group carries the group's state as the rows do, an icon and words ("All up", "1 slow", "2 down"), never a dot. The page follows the site's
landing design: the tinted radial hero, rounded cards, light and dark, a 16px gutter on a phone. Its motion (the
live pulse, the strip settling, the countdown ring) is in `app/status/status-motion.css`, paced as content, and
stops for reduced motion.

**What it costs**: one round is 6 requests on liveworkspace.app and up to 6 per app (23 for four apps, with
livediagram's Community pages; 29 in all),
every one a `HEAD`, an `OPTIONS` or a small JSON `GET` with `cache: no-store`, and only while someone has the page
open and visible. The history is one more request on load and one every 5 minutes, cached for 2 minutes: 7.4 KB, under 1 KB
gzipped, for every service over 90 days ([status.md](../009-status/status.md#performance)). The strips and cards are memoised,
so the countdown's one-second tick doesn't redraw 35 strips of 90 bars. The catalogue is
`@liveworkspace/status`; the browser's checks `lib/status/probe.ts`, the stored history's reader
`lib/status/history.ts`.

### The Explorer (`/explorer/…`)

Every app's work, in one place: the shared Explorer (`@liveworkspace/explorer`, [one-explorer.md](../004-index/one-explorer.md)),
built once here. It is shown here and, through each switched-on app's router, at that app's own `/explorer`
([below](#on-an-apps-own-address)). A link from elsewhere comes here with `?from=<app>` (`explorerUrl` in
`@liveworkspace/sites`). Its parts are `components/explorer/` and `lib/explorer/`.

- **Who it reads as.** The index is asked with a short-lived token from `GET /api/auth/workspace-token`: the
  signed-in account's, or this browser's guest's ([accounts.md](../003-accounts/accounts.md)). Signing out here asks again.
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
  On the Explorer, the switcher keeps you on the Explorer: another app's row opens that app's Explorer at the same
  view, liveworkspace's row liveworkspace.app's ([site-switcher.md](site-switcher.md#on-an-explorer-page)).
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
- **Search.** The bar's Search and Cmd/Ctrl+K or Cmd/Ctrl+. open the Search panel (`@liveworkspace/explorer/search-panel`, loaded
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
  `/new?template=` ([one-explorer.md](../004-index/one-explorer.md) "What you can make, on Home's hero").
- **Previews.** Every app's items have one, from liveworkspace's previews on the page's own origin
  (`/api/previews/items/<id>?v=<updatedAt>`, [previews.md](../006-media/previews.md)), asked with the person's workspace token
  and the item's share code. They are asked for only as a card nears the screen or a row is pointed at, at most
  4 at a time, once per item version, and kept as up to 200 blob URLs, least recently used out. The answer is
  cached by the browser for a day per version. An item the index says is empty shows its kind's icon, with no
  request.
- **Names.** Owners and who did what are named through `/api/account/people`, gathered into one request per
  beat (at most 100 ids) and kept in one bounded cache. A guest is named too: the route answers this
  browser's guest cookie, rate limited ([accounts.md](../003-accounts/accounts.md)).
- **Sharing.** The Share dialog makes and revokes passes through the index, and its extras come from the item's
  app's registry entry (`share` in `APP_ITEMS`): the tab picker (the item's tabs, read once per open from the
  app's `tabsPath` with the workspace token: the tabs alone, id, name and kind, where the app serves them, as
  liveplanner does), the embed code and the live image. Its help links go to the app's
  help on sharing.
- **Guests.** A guest sees a sign-in banner at the foot of the page, with Sign In, Learn More (why an account
  helps, loaded on first press) and a close this browser remembers, one for every app.
- **Home's banner.** Closing it is the person's `homeBanner` setting, a common one kept in `all`
  (`PATCH /api/account/settings`; read with the app's scopes, an app's old copy counting until `all` has one,
  [accounts.md](../003-accounts/accounts.md#common-settings)), so it stays closed in every app's Home and editor too, and the
  other way round.
  A guest's close is kept in this browser.
- **Telemetry.** What people use here counts for the app the page shows, or `liveworkspace.app` on All Apps,
  batched and only with the person's consent ([telemetry.md](../008-telemetry/telemetry.md#the-explorer-on-liveworkspaceapp)).
- **The Inbox.** Plan cards wear their type's glyph, and its empty state points at liveplanner's help on actions.
- **Teams.** Made, run and answered here ([one-explorer.md](../004-index/one-explorer.md#teams-are-run-in-the-explorer)): the
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
(`@liveworkspace/sites/workspace-proxy`, [one-explorer.md](../004-index/one-explorer.md#the-explorer-on-each-apps-address)).
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
  bar, the account menu, `?settings=`). Its Profile's Name and Colour is set in place there, over the app's token
  (`/api/workspace/account/profile`); its Sign-in Methods and API Tokens rows link to the panel on liveworkspace.app
  (`/explorer?settings=profile`, `?settings=tokens`, `workspaceHref`), where the session that runs them lives.
- **This Browser** comes from the app's list in localStorage (`@liveworkspace/explorer/this-browser`), heard as it
  changes.
- **The Inbox's This Browser rows** come from the app's snapshot in localStorage
  (`liveworkspace:this-browser-inbox:<app>`, [one-explorer.md](../004-index/one-explorer.md#the-explorer-on-each-apps-address)),
  listed only when it names the person reading (`lib/explorer/inbox.tsx` `localInboxHost`) and heard as it changes.
  Each opens in the app's editor on this origin, like any of the app's items. On liveworkspace.app there are none:
  the snapshot is on the app's origin.
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
pages are `noindex`. Cmd/Ctrl+K and Cmd/Ctrl+. open the Search panel (`useSearchShortcut` from
`@liveworkspace/explorer/search-shortcut`), the same two chords as the editors' command palette. They stand aside while
the person is typing (a text field, a text area, a select or editable text) and while a dialog is open (anything
marked `aria-modal`, the Search panel itself included), so a chord typed into a field or a dialog stays there.

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
([one-explorer.md](../004-index/one-explorer.md#teams-are-run-in-the-explorer)). The old addresses go there, permanently
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
  pushed pane's name takes its place, and the pane opens under the shared back bar (`BackBar`, `@liveworkspace/ui`) to
  the screen that pushed it, the pane's name as its chip. Opened for no app, the title is **Settings** alone.
- **The switch.** Opened for an app, the header has the Explorer's switch: the app's logo and name, and **All** with
  liveworkspace's logo. The app's side shows, signed in, the **Account** group and the **Common** settings that app
  has (below), then the app's own group, from its plain-data catalogue (`@liveworkspace/settings/catalogues/<app>`,
  [accounts.md](../003-accounts/accounts.md#scopes)): the account's and the shared settings shape that app as much as its own do,
  so they are never hidden behind All. Only the other apps' groups are left out. It is drawn in the app's own Settings
  view: its rail with category tiles and nested sub-categories, panes, sections, collapsed sections, section notes,
  search, the phone's push layout and back bar. An editor's own rows draw at once and the rest join them when read. A read that fails leaves the editor's own rows in place,
  with a note and Try again for the rest.
  A guest's side is the app's settings alone. The footer only says where settings are saved: it has no link into the
  app's own Settings (a "More in <app> Settings" link was removed on 25 October 2026); what only makes sense inside
  the editor (appearance, shortcuts, the editors' shared chrome such as UI scale) is in the editor's own Settings.
  Opened for no app, the panel is All alone, with no switch. The side last chosen is kept in this browser
  (`liveworkspace:settings-scope:v1`); a link that names one wins.
- **All.** Every setting, in one set of categories (merged on 25 October 2026; before, All listed Common and then
  a group per app). The rail has **Account** first, under its heading (liveworkspace's logo), a single-open
  accordion laid out as a category row (the same padding, icon column and type size) that eases open and shut,
  starts open only when it holds the current pane, and opens for a search so no hit is hidden. Under it, set off by
  a rule (on a phone, a card of their own), every other category, with no heading and no per-app groups: one
  **Editor** (with Draw, Pages and Presenting under it), one **Tours**, one **Explorer**, Layers, Map, Collaborate
  and Quick Style, and so on, whichever apps have them. Account holds what belongs to the person in every app, the `all`
  scope ([accounts.md](../003-accounts/accounts.md#settings)) and the profile: **Profile** (the display name and presence colour
  collaborators see, with a preview of their cursor and avatar, `ProfileEditor` in `@liveworkspace/settings-ui`; the apps' one palette
  `PRESENCE_COLOURS`, plus Automatic; leaving the name empty shows the name they signed up with), under it
  **Notifications** (the apps' in-editor notes, and each email that can be turned off: comments, mentions, actions
  assigned, invitation answers, tips and check-ins, milestones) and **API Tokens** (making a token, seeing its
  secret once with room to copy it, and revoking one, the AI tools connected in an app among them,
  `components/settings/TokensPanel.tsx`, its own chunk fetched when the category is first shown; on an app's
  address a link to the same category on liveworkspace.app, since tokens are the session's), then
  **Privacy** (anonymous usage events) and **Accessibility** (Reduce Motion). The switches are plain data in
  `@liveworkspace/settings/account`, worded as the apps' own Settings word them; the shared keys that only mean
  something in an editor (UI scale, panel opacity and the rest) are left to that editor's own rows.
  - **How the categories merge** (`mergeAppCategories`, `packages/settings-ui/src/merge-categories.ts`). The
    sources are the common settings (every editor setting two or more apps have, `COMMON_SETTING_KEYS`,
    [accounts.md](../003-accounts/accounts.md#common-settings), built from the apps' catalogues by `commonCatalogue` in
    `@liveworkspace/settings/common`, worded as the apps word them), then each app's own settings, the app the
    panel was opened for first, then the rest in the apps' order. A category is merged with another of the same
    place: its name under its parent's ("Editor", "Editor › Draw", "Panels › Layers"), so two apps' Editor are
    one, and a sub-category nests under the merged parent the same way. A category only one app has is listed
    once, under its own name (livediagram's Canvases, liveplanner's Plans). A category placed only by some apps
    goes after the one before it in that app's list. One left with no rows is left out, and a sub-category whose
    parent is left out stands at the top level by a short name (Layers, Map). Where the apps file a common
    setting differently, the platform's place is used: Show Home Banner sits under each app's own Documents,
    Plans or Designs, and under **Explorer** here.
  - **Inside a merged category**, the shared rows come first, with no sub-heading: each common setting once,
    which reads `all`, falling back to an app's old copy as `joinSettings` does, and writes `all`; and any row two
    or more apps keep in their own scopes under the same key, with the same control and the same wording, also
    once: it shows the first app's value, and a change is written to each of those apps' scopes, through each
    app's own row, exactly as the per-app rows would. Then each app's own rows under a small sub-heading with the
    app's Living Prism and name (never a coloured dot), with that app's sections, section notes and closed
    sections inside it. Rows that share a key but not their wording (livediagram's "Someone Joins My Canvas" and
    livedocuments' "Someone Joins My Document", `notifyDocumentJoin`) mean something different enough to want
    one and not the other, so each stays under its own app.
  - **Ids.** The Account section's ids are prefixed with its heading's (`account:notifications`); the merged
    categories' with `apps:` and their place (`apps:editor`, `apps:editor/draw`); rows keep their source's
    (`common:alignmentGuides`, `livediagram.app:tourWelcome`), so two apps' rows never collide. Every category
    also answers to the ids it was built from, the old per-app layout's (`common:editor`,
    `livediagram.app:tours`) and its bare one (`editor`, `notifications`): a category remembered from before
    the merge, a deep link and a link row or readout line that names an old id all land on the merged
    category. The merge is linear in rows and categories, rebuilt only when what it reads changes (40,000 rows
    in about 30 ms; the four apps' catalogues in under 1 ms, with the rest of the panel's model).
- **The Account section shows once.** Each editor's own Settings has Account, Notifications, API Tokens, Privacy
  and Accessibility categories of its own, and each app's catalogue an Account › Notifications. In All they are
  folded into the Account section rather than listed again under the app: the app's rows the Account section
  doesn't already have (its Trash, Cloud Sync and Delete Account; its own email switches, such as "Someone Joins My
  Canvas"; its own accessibility rows) join the Account category of the same name, under the app's sub-heading
  (its Living Prism and name, as in the merged categories), and the editor's identity row gives way to the
  Profile's header. Every category id is unique in the panel,
  and no category name the Account section uses appears under an app (pinned by
  `packages/settings-ui/src/no-duplicates.test.tsx`, for every app's catalogue and an editor's own shape).
- **Profile** (the Account section's first category, `packages/settings-ui/src/profile/`), laid out as the old
  livediagram Profile page was, richer: grouped cards under headings, in the app's brand colour, light and dark.
  - **The header card**: a banner in the brand's tint with a drawing of a canvas where the person's cursor and
    name tag sit in their presence colour, their avatar (their Google picture where they have one, else initials on their colour,
    Automatic as the name's own colour, as the account menu paints it), their display name, email, **liveworkspace account** and when they
    joined. Every host passes what it knows (`AccountHost.identity`): the site its session, the Explorer on an
    app's address the app's session, an editor its signed-in user.
  - **Name and Colour**: the display name and presence colour with the preview of their cursor and avatar, edited
    in place wherever the panel opens, never a link away: one editor (`ProfileEditor`,
    `packages/settings-ui/src/profile/ProfileEditor.tsx`) fed by the host's `AccountHost.profile`, which loads the
    profile and saves a patch (`{ name }` or `{ color }`, null clearing either). liveworkspace.app's host goes over
    its session (`/api/account/profile`); the Explorer on an app's address and each editor's over the app's token
    through the app's router (`/api/workspace/account/profile`, the bearer door, [accounts.md](../003-accounts/accounts.md#profiles)).
    There is no link-out for it: `AccountHost` has no profile address to link to. A saved colour repaints the host's
    own avatar at once (the header's, or in an editor its cursor, name tag and presence avatar in the room, with the
    name), with no reload.
  - **Sign-in Methods** and **Where You’re Signed In**, two sections (on liveworkspace.app, `AccountHost.security`): the methods (an emailed code to
    the account's address, always; Google, **Connected** or **Connect**, when the deployment has Google), and
    **Where You're Signed In** (each session's browser and system, when it was last active, **This device** for the
    current one, **Sign Out** of any other and **Sign Out Everywhere Else**), from Better Auth's own
    `/list-sessions`, `/revoke-session`, `/revoke-other-sessions`, `/list-accounts` and `/link-social` on this origin.
    Signing another device out signs its apps out too ([accounts.md](../003-accounts/accounts.md#signing-out)).
    Either section that can't be read says so with **Try again**.
    On an app's address and in an editor, a link to the same section on liveworkspace.app.
  - **Your Account**: **Sign Out** where the host can sign out (`AccountHost.onSignOut`), and, in an editor's All, the
    editor's Trash, Cloud Sync and Delete Account, folded in as above.
  - **A guest** (an editor's own Settings, the Explorer on an app's address): Profile shows the header card as a
    guest (their name, Guest, and their colour where the app has one) with **Sign in** and **Create account**, and
    says what an account adds, rather than empty rows.
  - **Show My Google Picture**, in Name and Colour, for an account with a Google picture: on by default; off, others
    see the initials ([accounts.md](../003-accounts/accounts.md#profile-pictures)). The header card's avatar is the picture
    (`PictureDisc`), over the initials it falls back to.
  - Not here, on purpose: uploading a picture (the picture is Google's or none); an email change, passwords and passkeys (accounts sign in with an emailed code or Google only, and the accounts
    Worker has no change-email flow); deleting the account from liveworkspace.app (closing an account goes through
    an app's server, `/api/auth/delete-account`, so its data goes with it; the site has no such door).
- **Addresses.** `/explorer?settings=<section>` opens the panel there, on liveworkspace.app or an app's address:
  `?settings=<app>` on that app (`?settings=all` on All); `profile`, `notifications`, `privacy`, `accessibility` and
  `tokens` open All on that Account category, which is where every email's unsubscribe link lands. The address drops
  `?settings=` as the panel closes, so the Explorer is left as it was.
- **Loading.** The panel's All view and catalogue view are their own chunk, fetched when the panel first opens (or
  the pointer heads for Settings); each app's catalogue is its own chunk too. The app's side reads that app's scopes
  once (`GET /api/account/settings/:app`, which answers `all` too); All reads each app's once, and the `all` scope
  comes with them, so it costs no request of its own. The profile is read when its category is first shown
  (`GET /api/account/profile`, or `/api/workspace/account/profile` on an app's address and in an editor): one
  request per opening of Profile, then one `PATCH` per change. What is read is kept for the page's lifetime (`settingsStore` in
  `lib/app-settings.ts`), so opening the panel again, or switching sides, costs nothing.
- **Saving.** Each change is shown at once and written alone, as a patch of just its key: an app's row to the app's
  scope (`PATCH /api/account/settings/:app` `{ app }`), an Account switch, a Common row or a common setting's row on
  an app's side to `all` (`PATCH /api/account/settings` `{ all }`; a field of an object, a Presenting option say,
  writes the object with the rest kept, the old copy filling in where `all` has none); put back with a note if the write fails (to what the server last took, so two refused changes in a row never leave the first one showing); a slider saves on release, as in the app. The profile's name is
  saved once typing pauses (800 ms), when the field is left, or as the page closes, never per keystroke; its colour
  at once. Each change is counted as the app's own Settings counts it (`lib/settings-telemetry.ts`); a common
  setting's row in the name of the app its wording came from (the app the panel was opened for when it has the
  setting), since it is one write to `all`; a merged row over several apps' own scopes once for each app it writes. An app picks a
  change up the next time it opens: each app reads its settings once per load, and the server's copy wins over its
  cached one.
- **On an app's address** (the Explorer there) the panel is the same, over `/api/workspace/account/settings…` with
  the app's token; its Profile header is the app's session's, its Name and Colour is set in place over the same
  token (`/api/workspace/account/profile`), and its Sign-in Methods and API Tokens rows link to liveworkspace.app,
  since sessions and tokens are the session's.
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
(`components/account/`). What they do is in [sign-in.md](../003-accounts/sign-in.md#the-sign-in-and-registration-pages).

They are static like every other page. An app's OAuth request rides in their query, signed by the
accounts Worker, and goes back to it with each step. On arrival they ask the Worker for this
deployment's options (`GET /api/auth/sign-in-options`: the Turnstile site key, whether Google is
set up, and the name length), so one build serves production and staging. Turnstile is the one
script from another origin; the Trusted Types boot allows it. The pages are kept out of search
and send no Referer, since the address carries the signed request.

**Under an app's own address.** For an app's sign-in the same pages are served at
`livediagram.app/sign-in` (and `/sign-up`, `/consent`) by the app's router
([accounts.md](../003-accounts/accounts.md#signing-in-on-the-apps-own-address)). There they call the accounts API at
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
  Settings panel also call their APIs. All of it is on this origin, but for Status, which also checks each
  app's own addresses ([Status](#status-status)).
- Light and dark, following the device (the shared appearance boot script).
- Works at phone width with a 16px gutter. Tap targets are 44px on touch screens.
- The front door, Comparison, the dashboard, Status and the privacy policy and terms are indexable: title, description, canonical,
  Open Graph, `robots.txt` and `sitemap.xml`. Every other page's title names the page and then the site
  (`Status · liveworkspace`), the same in its Open Graph and X cards, so a search result or a tab never reads
  "Status" alone.

## Installing

liveworkspace.app installs to a home screen like each app does
([push.md "The app side"](../003-accounts/push.md#the-app-side)), so an installed liveworkspace can show phone
notifications from every app:

- `/manifest.webmanifest` (`app/manifest.ts`, `installManifest` from `@liveworkspace/marketing-site/lib/install`):
  `liveworkspace`, standalone, `id` and `scope` `/`, starting at `/explorer`, with the scalable mark and 256 and 512
  pixel PNGs drawn from it at build (`app/liveworkspace-icon-256.png/route.tsx`, `…-512.png`, `lib/install-icon.tsx`),
  and an opaque 180 pixel Apple tile (`app/apple-icon.tsx`). Every page links it. Served on an app's address, the
  Explorer's link is relative, so it names that app's manifest there, and installing from there installs the app.
- `/push-worker.js` (`app/push-worker.js/route.ts`): the push-only service worker every site serves, registered only
  when someone turns phone notifications on, with no fetch handler.

## Hosting

One Worker, `liveworkspace-site`, static assets only, on the custom domains `www.liveworkspace.app` and
`liveworkspace.app` (`staging.` for staging), so a deploy creates their DNS records and certificates. The APIs are
path routes on the same hosts, which win over a custom domain, so Cloudflare sends `/api/auth/*`, `/api/account/*` and
the two `.well-known` discovery documents to the accounts Worker, `/api/index*` to the index, `/api/media*` and
`/api/previews*` to media, `/api/telemetry*` to telemetry, `/api/community*` to the Community, `/api/status*` to
the status Worker, `/api/drive*` to Drive, and everything else here. Every API has the same routes on both hosts.
Security headers come from `public/_headers`. `/.well-known/security.txt` is the site's (accounts' routes name only its two
discovery documents), and the bare-domain redirect leaves `/.well-known/*` alone, so both hosts answer it.

Every page enforces Trusted Types with the policies every app shares (`@liveworkspace/trusted-types`;
livediagram/docs/specs/016-platform/trusted-types.md). Each app's router passes these same headers through for the
Explorer and the sign-in pages, so they hold on every app's address too. The boot script allows the site's own build
under its asset prefix, `/_liveworkspace/_next/`. `trusted-types-guard.test.ts` holds every sink, the header and the
boot to this, and `pnpm test:e2e` (after `pnpm build`) opens every Explorer view and the main pages in Chromium under
the real header, failing on any Trusted Types refusal.

### www. is the address

Every product and the platform live on their `www.` host, APIs included: `https://www.liveworkspace.app/api/auth`,
`https://www.liveplanner.app/api`. Every URL we generate (the OAuth issuer, discovery documents, emails, links, the
clients' and CLIs' defaults) names `www.`. The bare domains only redirect page loads, and keep answering everything
else for clients that still use them.

On `liveworkspace.app` that redirect is its own small Worker, `liveworkspace-redirect` (`apps/redirect`), on the
route `liveworkspace.app/*`. The APIs' more specific routes still win, so it only sees what the site would have:

- A `GET` or `HEAD` page load answers one `301` to the same path and query on `https://www.liveworkspace.app`,
  cached for a day (`public, max-age=86400`), as each app's router does for its own bare domain.
- Never redirected: `/api/*`, `/.well-known/*`, any other method, a WebSocket upgrade, and a request an app's router
  forwarded (it carries `X-Liveworkspace-Proxy`; the router fetches with `redirect: 'manual'`, so a 301 would take
  the visitor off the app's address). Those go to the site Worker as before, through a service binding. A redirect
  never carries `Authorization` across, because nothing that sends one is redirected.
- A visit that still carries the old host-only cookies (the session, `dont_remember` and the `lw_guest` guest
  cookie) moves them in the same hop: each is set again on `Domain=liveworkspace.app`, same value, so `www.` reads it.
  Nothing is cleared: where a browser keeps both copies, they hold the same value, and accounts reads the one it
  signed (own-cookies.ts). That answer is `Cache-Control: no-store`, so a browser asks again until it has moved.
  Nobody is signed out and no guest loses their things ([accounts.md](../003-accounts/accounts.md) "The move to www.").
- Staging and local development have one host each, so nothing there redirects; the Worker answers only
  `liveworkspace.app` itself.

It deploys after accounts and the site (`.github/scripts/ci-plan.mjs` puts it with the routers), so `www.` already
answers every API when the first page load is sent there.

## Running it locally

```sh
corepack pnpm dev:workspace           # from the repo root: http://localhost:3000
```

That runs the site's dev server on 3000 and the seven services behind it (accounts on 8787, telemetry on 8790, the
Community on 8791, media on 8792, the index on 8793, status on 3010, Drive on 3011; first-time setup for each is in
[the README](../../../README.md#local-development) and the API's own doc). The dev server forwards `/api/auth/*`,
`/api/account/*`, the two `.well-known` discovery documents, `/api/index/*`, `/api/previews/*`, `/api/telemetry/*`, `/api/community/*`,
`/api/status*` and `/api/drive/*` to them (`next.config.ts`), so the whole site works from one origin, as it does in production. Run `corepack pnpm dev:site` for the pages alone.

## Known gaps

- **The apps' own policies** live in each app's help centre as well; they should point here instead.
