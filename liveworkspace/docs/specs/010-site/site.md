# liveworkspace.app

liveworkspace.app is one static website. Every page is in it: the front door that says what
liveworkspace is and sends people on to the app that fits their work, the public telemetry
dashboard, and the sign-in, registration and consent pages every app sends people to. The apps
(livediagram.app, liveplanner.app, livedocuments.app, livedesign.app, livehuddle.app) each keep their own marketing site for the
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
apps/export        Download Your Data, behind accounts only: no route of its own (003-accounts/data-export.md)
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
(the current site highlighted), links to Our Apps, Community (`/community`, every app's posts) and Telemetry, each
with its icon, and the account
control. On a phone the wordmark and the account control show; the footer has the rest. The
Appearance toggle is never in the header: it is on the rail. The sign-in pages served under an app's own
address wear that app's logo in place of the wordmark, linking to the app's home, with that app highlighted in the
switcher (`HeaderLogo`), so the person stays in the app they came from; the page's first render, before it knows its
address, is liveworkspace's.

### The rail

As on the apps' sites, a rail is pinned to the page's right edge (`components/SiteRail.tsx`). On the
home page it starts with a **Share** card: X, LinkedIn, Facebook, WhatsApp and Email, as plain
share-intent links with no SDKs or tracking, and Copy link, all for `https://www.liveworkspace.app`.
Under it, on every page, is the **Appearance** card (Light, Dark, System, as on the apps' sites; the
boot script applies the choice before paint, the address's app's choice on an app's address, see [Behaviour](#behaviour)). The content runs `max-w-7xl` (1280px), so the rail
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

1. **Hero**: "Everything your team makes, live in one workspace", then two short paragraphs, never one block:
   the first names each app in its accent and what it is for (sketch, plan, write it up, make it look right, talk
   it through), the second says one account opens them all and every link opens straight into the work. Under the
   calls to action, three ticked promises: Open source, No sign-up needed, No trackers or ads. Two calls to
   action: **Create your free account** (`/sign-up`, back here after) and **Explore the apps**.
   Signed in, they are hidden. Beside it, the platform's prism
   with the apps' logos round it at the points of a pentagon, each joined to it by a line in its accent, read
   clockwise in the
   order work moves through them, and someone at work in each, drawn as that app shows them: a cursor in
   livediagram, livedocuments and livedesign, a ring and name on the card they hold in liveplanner (whose boards and
   sheets draw no cursors), and a character in livehuddle. Each app there is a link to its
   site that lifts and rings in its accent on hover, and holds still while pointed at. On phones (below
   `sm`) it is left out, and the hero's words, calls to action and promises are centred. **Height:** from `sm`
   it fills the first screen under the 64px header, capped at 72rem and never shorter than its content, the words
   and the prism centred in it (the products' shared `hero-tall` stylesheet from `@liveworkspace/marketing-site`,
   the header's height handed over as `--hero-tall-header`); a phone keeps its content's height. **Paint:** the
   soft glow of each app's colour behind the prism is a radial gradient that fades out on its own, never a CSS
   `filter` blur, and nothing over the art (the app cards, the badge and the calls to action) uses `backdrop-filter`;
   the cards are near-opaque instead. A large blur repainted in tiles, and backdrop layers sampling it, re-rasterise
   when iPad Safari repaints under a touch (a long press, a press-and-drag scroll, a link's lift), and the colours
   broke there. A gradient paints the same in every layer. The legal pages' title glows follow the same rule, and
   `hero-paint-guard.test.ts` holds both.
2. **The apps** (`#apps`): one section per app in `@liveworkspace/sites`, in that order, each with
   its own logo, a tagline, its summary, three things it does, a window onto its work with someone in
   it (a flowchart; a board with a card on the move; an article with its slides; a logo, a wireframe
   and a photo being cropped; a Space's Team Pod, characters round its meeting table, one of them talking inside her
   hearing ring, the Timer on its wall, a teammate walking up from the plants and the Call dock below, with no
   cursor), and a button in its deep accent naming the work: **Start Diagramming**, **Start Planning**, **Start Writing**,
   **Start Designing**, **Start Huddling**. Below `lg` the window sits between the summary and the three things it does.
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
   live by default (people in the work as each app shows them: a cursor on a canvas, a ring on a held card, a
   character in a Space; the words promise real-time collaboration, never a cursor in every app); share by link (the share box); one Explorer for
   everything (full width: the words beside a folder holding a Canvas, a Plan, a Document, a
   Design and a Space, two by two with the Space across the foot); one Inbox; teams across every app; one key for scripts and AI (a token in a
   terminal, checked against every app's API by a script, since there is no liveworkspace CLI); open about data (a public chart, linking `/telemetry`); yours to keep (a sign-in code
   and one close for every app); completely free.
4. **Closing call to action**: "One account. Every app. Always live."
5. **Footer**: Our Apps (each app's logo, linking to its site), Platform (Comparison, which points at each app's
   comparisons, the Community, every app's posts together, the telemetry dashboard and Status) and Legal (the
   privacy policy, Terms of Use, Report a Vulnerability and Licences). Report a Vulnerability opens the repository's
   security policy on GitHub (`SECURITY_POLICY_URL`,
   [Vulnerability disclosure](../001-platform-scope/vulnerability-disclosure.md)). Every footer, here and in each app, labels the
   terms "Terms of Use" from one constant, `TERMS_LABEL` in `@liveworkspace/sites`.

The illustrations are drawn in the page (HTML and SVG with the apps' own logos), not images. Their
ambient motion (the current along the lines, drifting cursors and characters, a hearing ring's ripple, the cards settling) is in
`app/landing-motion.css`, paced as content, and stops for reduced motion.

### Privacy and terms (`/privacy`, `/terms`)

One privacy policy and one set of terms for liveworkspace and every app in it, linked from the
footer. They were built from the apps' own policies, which said the same things app by app; a
feature only some apps have (livediagram's sticky-note reader, liveplanner's live sessions, livehuddle's calls,
the MCP servers every app but livehuddle has) says which; Google Drive sync and Offline Mode are every app's. The
privacy policy covers each platform feature that keeps or sends personal data: the account and its Google picture
([accounts.md "Profile pictures"](../003-accounts/accounts.md#profile-pictures)), teams and their invitations' 28-day
expiry, phone notifications ([push.md](../003-accounts/push.md)), webhooks
([webhooks.md](../004-index/webhooks.md)), Download Your Data ([data-export.md](../003-accounts/data-export.md)), the
Community, telemetry and Drive. livehuddle's part says what its calls do: microphone, camera and screen only on the
person's own press, relayed by Cloudflare Realtime and never recorded, who hears and sees whom, and that avatar
presence is never stored ([livehuddle proximity-audio.md](../../../../livehuddle/docs/specs/012-collaboration/proximity-audio.md)).
The terms have a Calls section saying the same in a sentence, and that calls may be limited to audio or paused (the
[calls kill switch](../../../../livehuddle/docs/specs/016-platform/calls-kill-switch.md)). Every app is MIT-licensed, and the terms say so app by app. Wherever
either page names all the apps (each page's description, the terms' opening and The software), it names every listed
app, five today (livediagram, liveplanner, livedocuments, livedesign and livehuddle), and so do the site's own
description (`app/layout.tsx`) and its install manifest; `app/app-lists.test.ts` fails when a listed app is missing from
any of them. Each listed app has its own part under App by app, if only to say it does nothing beyond the rest. A
sentence about a feature only some apps have (Image search: every app but liveplanner) names just those. Both share
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
in the sitemap. Settings › Profile › Cloud Sync links to it, and each app's help has a short **Google Drive**
article under Account and Data (`/help/account-and-data/google-drive/`) that points here, so the apps' search,
links and old addresses still find it. It names every app's file extension (drive.md "The file"), which
`app/app-lists.test.ts` checks against the listed apps. Change it when drive.md changes what a person sees.

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
|               | MCP server         | `GET mcp.<app>/health` (CORS `*`), apps with one   | 200, JSON                    |

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
404 reads "Answers; storage not checked", Telemetry's 204 "Answers; database not checked"). The browser checks once a visit, so there is no strip of past
checks: the hourly history below is the record.

Under that, each service shows its stored history, from one `GET /api/status/history` on load:

- **liveworkspace's last check**, by a cloud icon, under this visit's (by a person icon), in the same columns: how
  long it took, its answer and its state as an icon and a word.
- **90 days** as a bar per day, oldest on the left, with when the run was ("Checked by liveworkspace 23 min ago"; past a day, in days: "2 days ago")
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
answer time, when the last round finished, and **Uptime**: every service on the page over the stored window
(`99.98%`, "last 90 days, every service" under it, its tooltip and name "99.98% Uptime, Last 90 Days"), from the
history's `uptime.all` ([status.md](../009-status/status.md#the-read-api)): the same pooled measure as the groups'.
It shows the tiles' empty placeholder while the history loads ("reading the history") and when there is none ("no data yet"). One round runs on load, and that is the page's only round: it never checks on its own and has no button
to check again (a reload makes the next). A change of overall state is announced politely to screen readers. A
legend explains every state.

**Uptime**, beside each group's summary, to its left ("99.95% Uptime", then "All 7 up"): the group's uptime over
the stored window, from the history's `uptime.groups`, the share of its services' hourly checks that answered (up or
slow), pooled over the group's services, so it agrees with their bars and their own `99.98% over 90 days`. Two
places at most (`99.5%`, `99.95%`), and `100%` only when every check answered. With no history, or no checks in the
window, the group shows no figure, never a default 100%. The figure and the page's are each focusable, named "99.95%
Uptime, Last 90 Days" (the window in days, from the history), and show those words in the shared tooltip on hover or
focus. On a phone the figure wraps with the summary under the group's logo.

Groups: liveworkspace first (its wordmark), then each app in `@liveworkspace/sites` order under its own logo,
never a coloured dot, each with its own summary and an anchor (`#livediagram`). Under the summary, a jump link per
group carries the group's state as the rows do, an icon and words ("All up", "1 slow", "2 down"), never a dot. The page follows the site's
landing design: the tinted radial hero, rounded cards, light and dark, a 16px gutter on a phone. Its motion (the
live pulse, the cards rising) is in `app/status/status-motion.css`, paced as content, and
stops for reduced motion.

**What it costs**: one round is 6 requests on liveworkspace.app and up to 6 per app (23 for four apps, with
livediagram's Community pages; 29 in all),
every one a `HEAD`, an `OPTIONS` or a small JSON `GET` with `cache: no-store`, and only while someone has the page
open and visible. The history is one more request on load and one every 5 minutes, cached for 2 minutes: 7.4 KB, under 1 KB
gzipped, for every service over 90 days ([status.md](../009-status/status.md#performance)). The strips and cards are memoised,
so the "last checked" line's one-second tick doesn't redraw 35 strips of 90 bars. The uptimes come worked out in the
history answer, so the page does no sums over the days for them. The catalogue is
`@liveworkspace/status`; the browser's checks `lib/status/probe.ts`, the stored history's reader
`lib/status/history.ts`.

### The Explorer (`/explorer/…`)

Every app's work, in one place: the shared Explorer (`@liveworkspace/explorer`, [one-explorer.md](../004-index/one-explorer.md)),
built once here. It is shown here and, through each switched-on app's router, at that app's own `/explorer`
([below](#on-an-apps-own-address)). A link from elsewhere comes here with `?from=<app>` (`explorerUrl` in
`@liveworkspace/sites`). Its parts are `components/explorer/` and `lib/explorer/`.

- **Who it reads as.** The index is asked with a short-lived token from `GET /api/auth/workspace-token`: the
  signed-in account's, or this browser's guest's ([accounts.md](../003-accounts/accounts.md)). Signing out here asks again.
  Until the answer comes (seconds on a slow session) the page shows the Explorer's own skeleton under the header
  (`ExplorerSkeleton`: the sidebar's rows and a pane of cards, pulsing, `aria-busy`), never a blank page; a failed
  answer says so, with the reload to try again.
- **Which app.** The app the person came from: `?from=`, then the referrer. The page wears that app's colours (its
  brand ramp, light and dark) and opens filtered to its items, with **All Apps** one click away. The switch reads the
  app's own name ("livediagram") and **All Apps**, each with its logo: the app's prism in its accent, and
  liveworkspace's own for All Apps (the apps' Explorer panels do the same). Someone who came straight here (the
  account menu's **Explorer**, a bookmark, a page of this site) is in no app: they see every app's items, Home and
  Recent included, in liveworkspace's own colours. The last app used here (kept in this browser) only picks what
  **New** makes and whose welcome and hero Home shows; it no longer filters the lists.
- **The header.** The liveworkspace logo (with the site switcher), a slanted hairline with equal space either
  side, then the app's logo, which leads back to the app. The two logos share one centre line, the header's middle (owner, 2026-11-09: the second "lower than the first one visually"). On a phone, where there is less room, only the app's
  logo shows (the liveworkspace logo shows when no app is). The search field sits in the middle (on Home the hero holds it), the account control on
  the right. Someone who came straight here sees no app logo. On a phone the Explorer's sections bar sits right
  under it, full width, and the two stay stuck to the top together as the page scrolls; the bar names the view on
  screen and opens the sidebar full screen ([one-explorer.md "The sidebar"](../004-index/one-explorer.md#the-sidebar), On a phone).
  On the Explorer, the switcher keeps you on the Explorer: another app's row opens that app's Explorer at the same
  view, liveworkspace's row liveworkspace.app's ([site-switcher.md](site-switcher.md#on-an-explorer-page)).
- **The bottom bar.** As the apps' own Explorers had it: a bar stuck to the foot of the page
  (`components/explorer/ExplorerBottomBar.tsx`), its controls on the right: **Search**, **Settings** and
  **Appearance** (Light, Dark or the system's, the site's one switch, `SiteAppearanceToggle`; on an app's address it is that app's own setting, [Behaviour](#behaviour)), each named beside its
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
  beat (at most 100 ids) and kept in one bounded cache. A request that fails is asked again on its own, twice,
  after 2 and then 8 seconds, so a row that stays on screen still gets its name; after that the name waits for
  the next row that asks for it. A guest is named too: the route answers this
  browser's guest cookie, rate limited ([accounts.md](../003-accounts/accounts.md)).
- **Sharing.** The Share dialog makes and revokes passes through the index, and its extras come from the item's
  app's registry entry (`share` in `APP_ITEMS`): the tab picker (the item's tabs, read once per open from the
  app's `tabsPath` with the workspace token: the tabs alone, id, name and kind, where the app serves them, as
  liveplanner does), the embed code and the live image. Its help links go to the app's
  help on sharing.
- **Guests.** A guest sees a sign-in banner at the foot of the page, with Sign In, Learn More (why an account
  helps, loaded on first press) and a close this browser remembers, one for every app. Learn More's reasons are
  the app's own where the apps differ (`signInReasons(app, words)`, `packages/explorer`): an app with an MCP server
  offers "Connect AI tools" (API tokens and AI assistants over MCP); livehuddle, which has none, offers "Use the
  API" (API tokens for your own scripts) instead.
- **Opening on the Explorer.** With the person's Automatically Open Explorer switch on (`autoOpenExplorer`, common, in
  `all`), the homepage, here and on every app's address, opens the Explorer's Home instead
  ([one-explorer.md](../004-index/one-explorer.md#opening-on-the-explorer)). The Explorer's read of the settings keeps
  the address's `lw_open_explorer` cookie in step; here the root layout's head script reads it, on an app's address
  the app's router.
- **Home's banner.** Closing it is the person's `homeBanner` setting, a common one kept in `all`
  (`PATCH /api/account/settings`; read with the app's scopes, an app's old copy counting until `all` has one,
  [accounts.md](../003-accounts/accounts.md#common-settings)), so it stays closed in every app's Home and editor too, and the
  other way round.
  A guest's close is kept in this browser.
- **Telemetry.** What people use here counts for the app the page shows, or `liveworkspace.app` on All Apps,
  batched and only with the person's consent ([telemetry.md](../008-telemetry/telemetry.md#the-explorer-on-liveworkspaceapp)).
- **The sidebar.** As [one-explorer.md "The sidebar"](../004-index/one-explorer.md#the-sidebar) has it: Overview
  (Home, Inbox, Shared With Me), Spaces, and the Library holding Recent, Timeline, Favourites, Archived and the Trash.
  The current view's rows open themselves (its space and folders, or the Library), and a drag resting on the folded
  Library opens it.
- **Archived.** A row of the sidebar's Library, before the Trash, at `/explorer/archived`
  (`app/explorer/archived/page.tsx`): a person's archived documents from every app, kept out of every other list
  ([one-explorer.md](../004-index/one-explorer.md#archived)). `?move=<id>` there opens Change Folder on that
  document, the editors' way back from their archived card, and `?open=<id>` (a Search panel's result) its archived
  dialog; each is dropped from the address once read. This browser's archived items aren't listed here: this origin
  can't read an app's This Browser store, as This Browser here is a link into the app.
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
  `tokens`, `data`, `privacy` and `accessibility` open All on that Account category (an old `webhooks` opens Profile), `all` opens All, an app's name
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
`lib/explorer/page-app.ts` reads the app from the page's own host (a static page sees no request), or locally from
the `liveworkspace-app` meta an app's E2E stack adds ([one-explorer.md](../004-index/one-explorer.md#the-explorer-on-each-apps-address)), and with it:

- **Who it reads as** (`lib/explorer/app-session.ts`, `lib/explorer/token.ts`): the app's access token from the
  app's `POST /api/auth/token`, one request in flight at a time (it rotates the refresh cookie), else the app's
  guest token under `<app>:v2:guest-token`. The site's own session is not asked on these pages.
- **Account calls** go to `/api/workspace/account/…` with that token (`accountFetch`); the accounts Worker
  checks it against its own keys (`apps/accounts/src/bearer.ts`): names for anyone; for an account, settings (the
  `all` scope and each app's, read and patched, for the Settings panel), and
  its teams, read and run (making, renaming, inviting, roles, the join link, leaving, deleting, answering an
  invitation); nothing else.
- **Signing in.** The app's silent sign-in script is inlined in the Explorer's layout, one per switched-on app
  behind a check of the host (`lib/explorer/silent.ts`), and the page's first token answer lets it ask again when the
  app's hint outlived its session (`retrySilentSignIn`, liveworkspace/docs/specs/003-accounts/accounts.md "A hint that
  outlived its session"); Sign In and Sign Out are the app's
  (`components/explorer/AppAccountControl.tsx`). Teams are run here as on liveworkspace.app; after a change the
  page asks the app for a fresh token (`renewIdentity`), which names them.
- **Links** to the app's items, New, previews, the Library and Import from use the page's own origin
  (`appOrigin`); share links are always the app's public site. The Settings panel opens here in place (the bottom
  bar, the account menu, `?settings=`). Its Profile's Name and Colour is set in place there, over the app's token
  (`/api/workspace/account/profile`), and its Sign-in Methods, Where You're Signed In, API Tokens and Your
  Data draw in place too, over the same token ([Settings](#settings), "On an app's address"), never a link to
  liveworkspace.app. Its search opens Profile and API Tokens in place as well.
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

### The Community (`/community`, `/community/post`)

What people made with the apps, built once here and served at each app's own `/community` by its router, as the
Explorer is ([007-community](../007-community/community.md) "One page for every app" has the whole of it). Its parts
are `app/community/`, `components/community/` and `lib/community/`.

- **Which posts.** On an app's address, that app's posts, with **All Apps** a click away: the switch beside the
  search reads the app's own name and **All Apps**, each with its logo, the Explorer's switch
  (`@liveworkspace/ui` `AppScopeToggle`). It starts on the app every time the page opens. On liveworkspace.app (the
  footer's **Community**) every app's posts, with no switch. My Shares is the app's, on its address only.
- **The header.** The Explorer's (`components/AppPageHeader.tsx`, shared): the liveworkspace logo with the site
  switcher, the slanted hairline and the app's logo, which leads back to the app; the account control on the right
  (the app's session on its address). No search in the middle: the gallery's own search box is the page's. The
  switcher leads each site to its Community ([site-switcher.md](site-switcher.md#on-a-community-page)).
- **Its look.** The page wears the colours of the app whose address it is on (`data-community-app`, the same ramps
  as the Explorer's, `app/app-colours.css`), liveworkspace's slate here; the hero's wash takes the app's colour too.
  The rail (Appearance) and this site's footer follow, the footer's links leading to liveworkspace.app in full on
  an app's address.
- **A post** opens on its own app's address; a link to one here moves there.
- **Search engines.** The gallery is indexable (`Community · liveworkspace`, canonical `/community`, in the
  sitemap). On an app's address the router makes its head the app's own, and fills each post's.

Its styles are in their own stylesheet, `app/community/community.css`, so the other pages don't carry them.

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
  liveworkspace's logo. The two sides are one panel and one set of categories (below): **All** shows every row, and
  the app's side, signed in, shows only the rows that apply to that app (each row's apps, below), and only the
  categories left with any, so a category none of whose settings touch the app is gone from the rail. The Account
  section's rows apply to every app, so the app's side keeps them; another app's own rows (its email switches under
  Notifications, say) are left out. A setting that applies to this app and others shows on both sides as the same
  row, and a change writes to each app it covers, exactly as in All (since 8 November 2026;
  before, the app's side listed a **Common** group and a group under the app's name). Only All draws the apps'
  logos beside each row: on the app's side every row shown applies to that app, so it draws none and no column
  for them, and each name starts at the pane's left edge (since 8 November 2026). The app's own settings come
  from its plain-data catalogue (`@liveworkspace/settings/catalogues/<app>`,
  [accounts.md](../003-accounts/accounts.md#scopes)), or in an editor from its own Settings. It is drawn in the app's own Settings
  view: its rail with category tiles and nested sub-categories, panes, sections, collapsed sections, section notes,
  search, the phone's push layout and back bar. An editor's own rows draw at once and the rest join them when read. A read that fails leaves the editor's own rows in place,
  with a note and Try again for the rest.
  A guest's side is the app's settings alone. The footer only says where settings are saved: it has no link into the
  app's own Settings (a "More in <app> Settings" link was removed on 25 October 2026); what only makes sense inside
  the editor (appearance, shortcuts, the editors' shared chrome such as UI scale) is in the editor's own Settings.
  Opened for no app, the panel is All alone, with no switch. Opened from an app, the panel always starts on that
  app's side; nothing is remembered between opens, and a link that names a side wins.
  In an editor, the common settings its side shows are the ones its own Settings has too, drawn as its own rows, so
  a common setting the editor has is never left out of its side (before 2 November 2026 they were missed whenever
  the editor's own catalogue was not read, which in an editor it never is).
- **A held app.** An app registered before its launch
  ([integrating-an-app.md](../002-architecture/integrating-an-app.md#registered-before-launch); none today, livehuddle
  was until Work Tracker #189) has its own catalogue and scope like any other
  (`@liveworkspace/settings/catalogues/<app>`, its site id), so its editor's panel names it ("<app> Settings", its
  own heading in the rail) and reads and writes its own settings. It is held out of every other list: the panel's apps (`SETTINGS_APP_IDS`) are
  `APP_SITES`' alone, so it is in no other app's All and no `?app=` link here opens it. The panel opened for the held
  app adds it to its own All, first, beside the listed apps. Launch lists it with no change here.
- **All.** Every setting, in one set of categories (merged on 25 October 2026; before, All listed Common and then
  a group per app; app sub-headings inside a category went on 8 November 2026, for the logos beside each row). The
  rail, on desktop and on a phone, lists every category under three small label headings, the pane's section
  heading type (`SETTINGS_LABEL`, uppercase, muted): plain labels, always shown, never folded, and nothing happens on
  a click (until 8 November 2026 the account's categories sat under an **Account** heading that was a single-open
  accordion, with Notifications, API Tokens, Webhooks and Your Data nested under Profile, and the rest under a rule).
  On a phone each label sits over its own card of rows. In order:
  **Account**: **Profile**, **Notifications**, **Privacy**, **Accessibility** and **Your Data**;
  **Apps**: the merged categories (one **Editor**, **Presenting**, **Appearance**, **Keyboard**, **Panels**, one
  **Getting Started** and one **Explorer**, whichever apps have them, in the merge's order);
  **Developers**: **API Tokens** alone. A label none of whose categories are listed (on the app's side,
  say) is left out with them. Each account category is top-level with its own coloured tile
  (`SettingsCategoryTile`: Profile teal, Notifications red, Privacy emerald, Accessibility indigo, Your Data slate,
  API Tokens violet; the line art is the shared bell, key and tray). The account's categories hold what belongs to the person in every app, the
  `all` scope ([accounts.md](../003-accounts/accounts.md#settings)) and the profile: **Profile** (the display name and presence colour
  collaborators see, with a preview of their cursor and avatar, `ProfileEditor` in `@liveworkspace/settings-ui`; the apps' one palette
  `PRESENCE_COLOURS`, plus Automatic; leaving the name empty shows the name they signed up with),
  **Notifications** (the apps' in-editor notes, and each email that can be turned off: comments, mentions, actions
  assigned, invitation answers, tips and check-ins, milestones; an envelope beside every switch under Email and a phone
  beside every switch under Phone, so each says how it reaches you), **Privacy** (anonymous usage events, said in plain words with a **See Every Event** link that opens liveworkspace.app's public /telemetry list in a new tab, so people can look before choosing),
  **Accessibility** (Reduce Motion), **API Tokens** (making a token, seeing its
  secret once with room to copy it, and revoking one, the AI tools connected in an app among them,
  `packages/settings-ui/src/account-panels/tokens/`, its own chunk fetched when the category is first shown),
  and **Your Data** (downloading everything the
  person owns, or a team they run owns, as one zip, `account-panels/data-export/`, its own chunk,
  [data-export.md](../003-accounts/data-export.md#settings)). The switches are plain data in
  `@liveworkspace/settings/account`, worded as the apps' own Settings word them; the shared keys that only mean
  something in an editor (UI scale, panel opacity and the rest) are left to that editor's own rows.
  - **How the categories merge** (`mergeAppCategories`, `packages/settings-ui/src/merge-categories.ts`). The
    sources are the common settings (every editor setting two or more apps have, `COMMON_SETTING_KEYS`,
    [accounts.md](../003-accounts/accounts.md#common-settings), built from the apps' catalogues by `commonCatalogue` in
    `@liveworkspace/settings/common`, worded as the apps word them), then each app's own settings, the app the
    panel was opened for first, then the rest in the apps' order. A category is merged with another of the same
    place: its name under its parent's ("Editor", "Panels › Layers"), so two apps' Editor are
    one, and a sub-category nests under the merged parent the same way. A category only one app has is listed
    once, under its own name. A category placed only by some apps goes after the one before it in that app's list.
    One left with no rows is left out, and a sub-category whose parent is left out stands at the top level by a
    short name. The apps keep no sub-categories today (since 8 November 2026): each panel's settings are a section
    of **Panels** (Layers, Quick Style, Map, Collaborate), each mode's a section of **Editor**, and each app's own
    work category (livediagram's Canvases, liveplanner's Plans, livedocuments' Documents, livedesign's Designs,
    livehuddle's Spaces) is the **Explorer**, holding Show Home Banner and its **Default Folders**. **Tours** is
    named **Getting Started** (its id stays `tours`).
  - **Inside a merged category** there are no app sub-headings: one list, each section once. Each setting is one
    row: each common setting once, which reads `all`, falling back to an app's old copy as `joinSettings` does, and
    writes `all`; and any row two or more apps keep in their own scopes under the same key, with the same control
    and the same wording, also once: it shows the first app's value, and a change is written to each of those apps'
    scopes, through each app's own row, exactly as the per-app rows would. The rows are laid out by section
    (`bySection`, `packages/settings-ui/src/section-order.ts`, below): each section once, holding every app's rows
    filed under that name in the order they came (two apps' **Offer Again** are one section); a section's note is
    the first source's that has one, and a section closed in any app stays closed. Rows that share a key but not their wording (livediagram's
    "Someone Joins My Canvas" and livedocuments' "Someone Joins My Document", `notifyDocumentJoin`) mean something
    different enough to want one and not the other, so each stays its own row with its own app's logo.
  - **Order inside a category** (since 8 November 2026). Every category reads the same in every app and in the
    merge, whichever app the panel was opened for and whichever source brought a section first: the broadest first,
    related settings together, a switch before the settings that depend on it, the rarely used last. The rows with
    no section lead (a category's own broadest settings: Theme, Panel Opacity, Show Home Banner). The sections a
    category holds follow one list, `SECTION_ORDER` in `@liveworkspace/settings/sections`, among the places they
    hold; a section it does not list (the Profile's) keeps the place its first row gave it. Each app's catalogue
    lists its sections in that order too (`sections.test.ts`). The order, category by category:
    - **Editor**: Canvas (Alignment Guides, Auto-Attach Arrows, Element Indicators), Mouse (Quick-Add on Hover,
      Middle-Mouse Pan), then each mode's own: Draw (Dock Position), Pages (Contents), Logo Pages (Logo Guides, then
      its strength and parts beneath it). Before, Common's Pages came before livediagram's Draw.
    - **Presenting**: Slides, Playback, While Presenting.
    - **Appearance**: Theme, then Interface (Button Labels, UI Scale with a slider per part beneath it).
    - **Keyboard**: Keyboard Shortcuts, then All Shortcuts.
    - **Panels**: Panel Opacity, then Layers, Quick Style (the editing panels), Map, then Collaborate (the people);
      each section opens with its panel's Enable switch, its other rows beneath it.
    - **Getting Started**: Offer Again (the mode tours), then Show Me (the element tours, closed).
    - **Explorer**: Show Home Banner, then Default Folders.
    - **Notifications**: In the Editor, Email, Phone. Under Email the emails about your work come first and the
      apps' own after them (Someone Joins My Canvas, Someone Fills In My Form); **Tips and Check-Ins** and
      **Milestones**, the emails from us, close the section (`closesSection`) however many apps add rows.
    - **Profile**: Name and Colour, Time Zone, Sign-in Methods, Where You're Signed In, Cloud Sync, Your Account,
      then an editor's This Browser, and the Danger Zone last: Reset All Settings above Delete Account. Both apply to
      every app, so under All they carry liveworkspace's mark (Reset only where it resets the account's settings).
    - **API Tokens**, **Your Data**: an app's own introduction to the panel (what a token lets your
      scripts and AI tools do, the guide to connecting one) comes first, above the panel (`fold-account.ts`).
  - **No way out of a category** (since 8 November 2026). No row opens another category: a setting is shown in the
    one category it belongs to, never pointed at from another. Accessibility's **UI Scale** link to Appearance went,
    with the link row kind itself (`kind: 'link'`), so one can't come back; UI Scale is Appearance's.
  - **Which apps a setting applies to** (`SettingsRow.apps`, drawn by `packages/settings-ui/src/app-marks.tsx`).
    Every row carries the apps it applies to: a common setting the apps that have it (`commonCatalogue`'s `apps`,
    plus the editor the panel is in where its own Settings has the row, since an editor's own catalogue is never
    read); a merged row every app it writes to; an app's own row that app, or every app when it is over a setting
    every app shares (`allApps`); and every Account row, every app. Under **All** only (the app's side draws none,
    above), to the left of the row's name and description
    sit those apps' logos (each app's Living Prism, 14 px with 2 px between, never overlapping: four overlapping
    prisms read as one blur of colour; at most two across, so three sit two over one and four two by two,
    keeping the column two logos wide and the name its room), in the panel's app order, left-aligned (one logo, or a lone one on the second line, starts at the left) in one column per
    category as wide as its widest cluster, so every name in a category starts at the same place. A row that
    applies to every app the panel lists shows liveworkspace's mark alone, the mark the header's **All** carries,
    rather than five logos. The cluster is named for a screen reader and in the shared tooltip (just the apps'
    names, short so the tooltip stays narrow: "livediagram and liveplanner", "Every App"), and sits above a switch row's stretched click target so
    the tooltip answers the pointer. It is vertically centred on the row's name and description, as a row's own
    leading mark (an avatar, a provider's mark) is, and stays on the name's line when a control wraps below it on a
    phone. A nested row under a switch with the same apps keeps the column but leaves the logos to its switch. The
    words **All apps** under a description are left out wherever the logos are drawn, since the mark says it. Rows
    that are whole panels rather than a row (Profile's header, Name and Colour, Sign-in Methods, API Tokens,
    Your Data) draw no logos: they are the account's, in every app. The logos are the host's
    `renderLogo`, small inline marks drawn only for the rows shown; a row's cluster is memoised on its apps, which
    keep their identity while the row does. While an editor's side loads, its own rows already carry its logo, so
    the names do not shift when the rest arrives.
  - **Where only one app is in play** (the app's side of the switch, a guest's side, a self-hosted or workbench editor where All is not offered,
    liveworkspace.app's view of one app's catalogue alone) the panel draws no logos: each row is that app's, and a
    shared one still says **All apps**.
  - **Ids.** The account's category ids are prefixed with `account:` (`account:notifications`, Profile's
    `account:account`, which also answers to `profile`); the merged
    categories' with `apps:` and their place (`apps:editor`, `apps:panels/layers`); rows keep their source's
    (`common:alignmentGuides`, `livediagram.app:tourWelcome`), so two apps' rows never collide. Every category
    also answers to the ids it was built from, the old per-app layout's (`common:editor`,
    `livediagram.app:tours`) and its bare one (`editor`, `notifications`), and the ids of any category folded into
    it (`aliases` on an app's category: Editor carries `draw` in livediagram and `pages` in livedocuments and
    livedesign, since Draw's and Pages' rows became Editor's sections, and Panels `layers`, `quickStyle`, `map` and
    `collaborate`; these land bare, prefixed, from Common (`common:pages`) and as the merged sub-category they were,
    `apps:editor/draw`, `apps:panels/layers`). An alias written as a path (`/editor/presenting`, `/tours`,
    `/canvases`) is an old place in the merged rail and lands as `apps:editor/presenting`, `apps:tours` and
    `apps:canvases`: Presenting while it sat under Editor, Getting Started while it was Tours, the Explorer while
    each app's work had its own category. A category remembered from before the merge or a deep link that names an
    old id lands on the merged category. On the app's side a category id that another app's rows alone held is gone with them; a link to it
    opens the first category, as any id the panel does not know does. The merge is linear in rows and categories,
    rebuilt only when what it reads changes, the same build for both sides (the app's side passes `only`, which
    keeps a row after it is merged, so a merged row keeps every app's logo there too); the timed budgets on 40,000
    rows and on the five apps' catalogues are in `merge-categories.test.tsx`.
- **Webhooks** are not in Settings (since 8 November 2026): they are set per document, from a document's ⋯ menu in
  the Explorer (**Webhooks**), see [webhooks.md](../004-index/webhooks.md). The old id `webhooks` is an alias of
  Profile, so an old `?settings=webhooks` link opens Profile.
- **Your Data** is one card in the same frame ([data-export.md](../003-accounts/data-export.md#settings)):
  - **The top** says in a line what a download holds and names the apps it covers by their logos (each app's Living
    Prism and wordmark).
  - **Your Data** is a row with the export's state: **Download All My Data** with none; a progress bar and what it is
    doing ("Adding items: 12 of 48", "Adding images", "Finishing") while it is built, with the line that an email
    follows; ready, its size, when it was made and when the link lapses, with **Download** and **Make a New One**;
    failed, why in a red note with **Try Again**; capped, an amber note of how many items were left out.
  - **Your Teams**, for someone who runs a team: one row per team they are an admin of, the same states, with
    **Download Team Data**. A section only someone who runs a team sees.
  - It reads `GET /api/account/data-export` when first shown, and again every 3 seconds while an export is being
    built and the panel is open, never otherwise. A refused emailed link lands here with an amber note saying why
    (the link lapsed, it is for another account, or there is no file any more). Loading shows the card's skeleton;
    a failed read says why with **Try Again**.
  - **Signed in only, as API Tokens are.** On liveworkspace.app over the session; on an app's address and in an
    editor the same card in place, over the app's token; a guest finds the editor's stand-in row, "Sign in to
    download your data." with **Sign In**. The emailed link still downloads from liveworkspace.app.
- **The Account section shows once.** Each editor's own Settings has Account, Notifications, API Tokens, Privacy
  and Accessibility categories of its own, and each app's catalogue an Account › Notifications. In All they are
  folded into the account's categories rather than listed again for the app: the app's rows the account's categories
  doesn't already have (its Cloud Sync, Reset All Settings and Delete Account; its own email switches, such as "Someone Joins My
  Canvas"; its own accessibility rows) join the account's category of the same name, each section once
  (`bySection`), each row with its app's logo beside the Account section's own, which carry liveworkspace's, and
  the editor's identity row gives way to the Profile's header. Every category id is unique in the panel,
  and no category name the account's categories use appears twice (pinned by
  `packages/settings-ui/src/no-duplicates.test.tsx`, for every app's catalogue and an editor's own shape).
- **Profile** (the rail's first category, `packages/settings-ui/src/profile/`), laid out as the old
  livediagram Profile page was, richer: grouped cards under headings, in the app's brand colour, light and dark.
  - **The header card**: a banner in the brand's tint with a drawing of a canvas where the person's cursor and
    name tag sit in their presence colour, their avatar (their Google picture where they have one, else initials on their colour,
    Automatic as the name's own colour, as the account menu paints it), their display name, email (no "liveworkspace account" chip: every account is one) and when they
    joined. Every host passes what it knows (`AccountHost.identity`): the site its session, the Explorer on an
    app's address the app's session, an editor its signed-in user. Where the panel edits the profile, the card's
    display name and colour come from the profile itself (the same read as Name and Colour, one request for both)
    and follow each save at once, so a colour picked below shows in the header straight away.
  - **Name and Colour**: the display name and presence colour with the preview of their cursor and avatar, edited
    in place wherever the panel opens, never a link away: one editor (`ProfileEditor`,
    `packages/settings-ui/src/profile/ProfileEditor.tsx`) fed by the host's `AccountHost.profile`, which loads the
    profile and saves a patch (`{ name }` or `{ color }`, null clearing either). liveworkspace.app's host goes over
    its session (`/api/account/profile`); the Explorer on an app's address and each editor's over the app's token
    through the app's router (`/api/workspace/account/profile`, the bearer door, [accounts.md](../003-accounts/accounts.md#profiles)).
    There is no link-out for it: `AccountHost` has no profile address to link to. A saved colour repaints the host's
    own avatar at once (the header's, or in an editor its cursor, name tag and presence avatar in the room, with the
    name), with no reload.
  - **Time Zone**, its own section after Name and Colour, for an account (`TimeZoneSection`,
    `packages/settings-ui/src/profile/TimeZonePicker.tsx`): the zone the emails that can wait keep to ("Emails that
    can wait arrive in your daytime, weekdays 09:00 to 21:00 here", [accounts.md "The send
    window"](../003-accounts/accounts.md#the-send-window)). One button names the zone in force as its city and
    offset (**Tokyo (GMT+9)**, or **Automatic: London (GMT+0)**); pressed, it opens a searchable list in place under the row: a search field (city,
    region, IANA name or offset, `GMT+5:30`), **Automatic** first with the zone this browser is in, then every zone
    the browser knows (`Intl.supportedValuesOf('timeZone')`, plus the zone kept and the browser's own when the list
    leaves them out; one that is another name for a listed place, such as `Asia/Calcutta` beside `Asia/Kolkata`,
    takes that place's entry under its own name, the zone kept before the browser's, so no place shows twice),
    by offset and then city, each with its region and offset, the one in force checked.
    Arrow keys move, Enter picks, Escape closes and gives focus back to the button; focus moving on to another
    control (Tab) closes it, as a press outside does, so no list is left open behind the field that owned it. A pick is saved at once
    (`PATCH { timeZone }`, or `{ timeZone: null }` for Automatic) through the same `AccountHost.profile`, so on
    every host and door; a refused write puts back what the server last took and says why, as the colour does.
    The list is built the first time it is asked for and kept for the page (one `Intl.DateTimeFormat` per zone,
    about 420, once), and the row's own label needs only the zone in force. The profile reads carry the browser's
    zone, so Automatic follows the browser wherever Settings opens.
  - **Sign-in Methods** and **Where You’re Signed In**, two sections (`AccountHost.security`): the methods (an emailed code to
    the account's address, always; Google, **Connected** or **Connect**, when the deployment has Google), and
    **Where You're Signed In** (each session's browser and system, when it was last active, **This device** for the
    current one, **Sign Out** of any other and **Sign Out Everywhere Else**), from Better Auth's own
    `/list-sessions`, `/revoke-session`, `/revoke-other-sessions`, `/list-accounts` and `/link-social` on this origin.
    Signing another device out signs its apps out too ([accounts.md](../003-accounts/accounts.md#signing-out)).
    Either section that can't be read says so with **Try again**.
    On an app's address and in an editor, the same two sections in place, over the app's token; Google's
    **Connect** goes to Google and comes back to the app with Settings open.
  - **Your Account**: **Sign Out** where the host can sign out (`AccountHost.onSignOut`), and, in an editor's All, the
    editor's Trash, Cloud Sync, Reset All Settings and Delete Account, folded in as above.
  - **Reset All Settings**, an editor's row directly above Delete Account (`ResetSettingsRow`,
    `packages/settings-ui/src/reset-settings/`): **Reset** asks first in place (**Reset Now** and **Keep**, as Revoke
    does), then, for an account, sends one `DELETE /api/account/settings` over the app's token
    ([accounts.md "Resetting every setting"](../003-accounts/accounts.md#resetting-every-setting)): every scope of every
    app back to its defaults, the usage-events choice kept. On success the editor drops its own copy to defaults, the
    page's kept scopes become the server's answer (no read again), and the panel draws itself again from them, so every
    row shows its default at once with no reload; the row says **Settings Reset** for a moment. A refusal leaves
    everything as it was and says so under the row, with **Try Again**. A guest and a self-hosted editor reset only
    the editor's own copy, in that browser, and the row says so. liveworkspace.app's own panel has no
    Danger Zone: as closing an account, resetting goes from an app.
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
  token (`/api/workspace/account/profile`), and so are its Sign-in Methods, Where You're Signed In, API Tokens
  and Your Data: the same panels as here, from `@liveworkspace/settings-ui/account-panels`, each its own
  chunk loaded only when its category is first opened. Nothing in the Account section links away to
  liveworkspace.app (before 8 November 2026 these five were **Manage** and **Open** links to
  `/explorer?settings=profile|tokens|webhooks|data` there). The same holds in every editor's own Settings for a
  signed-in account; a self-hosted editor without liveworkspace accounts shows none of them.
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
- Light and dark, following the device unless the person picked Light or Dark. The pick is stored in this browser
  under the key of the app whose address the page is on, the key that app's own pages use (`livehuddle:v2:ui-mode`
  on livehuddle.app's address, `liveplanner:v2:ui-mode` on liveplanner.app's, and so on), so the Explorer and the
  other pages served there are light or dark as the app is, and the Appearance switch here changes the app's own
  setting. On liveworkspace.app, which is no app's, it is the platform's own key, `livediagram:v2:ui-mode` (the
  key the site has always used; renaming it would reset everyone's pick). Locally an app's whole port block counts
  as its address. A script in the page applies it before first paint (one lookup of the address, one read of
  storage), and the page's Appearance switch reads and writes the same key.
- A page that fails to render never shows the framework's bare error screen. It shows the site's own: the
  title "Something went wrong · liveworkspace", a main landmark holding one card (the shared empty state) with
  the heading "Something went wrong", a line saying nothing was lost, **Try Again** (which renders the page
  again) and **Go to the Home Page**. A failure in the root layout itself gets the same card in a page of its
  own, with `lang`, the stylesheet and the appearance setting, so it is light or dark as the rest of the site.
- A button that starts work it waits for keeps the keyboard while it works (busy, never `disabled`;
  [busy buttons](../../../livediagram/docs/specs/004-interface-design/busy-buttons.md)).
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
Security headers come from `public/_headers`, and so does the build assets' caching: everything under
`/_liveworkspace/_next/static/` is named by its content's hash, so it is `public, max-age=31536000, immutable`, as
each app's router sends for its own build ([Stale builds](../../../../livediagram/docs/specs/016-platform/stale-builds.md)
"Caching rules"); the routers pass the header through on every app's address. Everything else keeps Cloudflare's
`public, max-age=0, must-revalidate`, so a page is checked on every load. `/.well-known/security.txt` is the site's (accounts' routes name only its two
discovery documents), and the bare-domain redirect leaves `/.well-known/*` alone, so both hosts answer it.

Every page enforces Trusted Types with the policies every app shares (`@liveworkspace/trusted-types`;
livediagram/docs/specs/016-platform/trusted-types.md). Each app's router passes these same headers through for the
Explorer and the sign-in pages, so they hold on every app's address too. The boot script allows the site's own build
under its asset prefix, `/_liveworkspace/_next/`. Markup reaches a sink only through the one path every app shares
(livediagram/docs/specs/016-platform/trusted-types.md "One path for markup"): `htmlProps`, `setHtml` or `setSrcdoc`
from `@liveworkspace/trusted-types`, given a `SafeHtml` made by `trustedConstant`, `builtMarkup` or `jsonScript`; the
shared packages under `packages/` hold to the same rule, and the repository's raw HTML guard refuses any other sink.
`trusted-types-guard.test.ts` holds every sink, the header and the boot to this, and `pnpm test:e2e` (after `pnpm build`) opens every Explorer view and the main pages in Chromium under
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
