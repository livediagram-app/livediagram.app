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
5. **Footer**: Our Apps (each app's logo, linking to its site), Platform (Product Comparison and the telemetry dashboard) and Legal (the
   privacy policy and terms).

The illustrations are drawn in the page (HTML and SVG with the apps' own logos), not images. Their
ambient motion (the current along the lines, drifting cursors, the cards settling) is in
`app/landing-motion.css`, paced as content, and stops for reduced motion.

### Privacy and terms (`/privacy`, `/terms`)

One privacy policy and one set of terms for liveworkspace and every app in it, linked from the
footer. They were built from the apps' own policies, which said the same things app by app; a
feature only one app has (livediagram's Google Drive mirror, its Offline Mode) says which. Both share `components/LegalPage.tsx`, and their date and contact
form are in `lib/legal.ts`. Change them when what an app stores or who it uses changes.

### Product Comparison (`/alternatives`, `/alternatives/<slug>`)

Every app's comparison with another tool, and comparisons of the whole suite with one: a hub grouped
by what answers each competitor, and one static page per competitor in the colours of the app it
speaks for. The apps' own `/alternatives` addresses redirect here. See
[comparison-pages.md](comparison-pages.md).

### Telemetry (`/telemetry`)

The public dashboard for every app's anonymous events, all apps at once or one at a time
(`?app=livediagram.app`): [telemetry.md](telemetry.md). Each app's filter shows that app's logo
as its own header does, the prism and the wordmark in the app's accent. It reads its numbers from
`/api/telemetry/summary`. Its styles (and each sending app's shared UI, which its views render) are in
their own stylesheet, `app/telemetry/telemetry.css`, so the other pages don't carry them.

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
- **Your apps**: a link to each app's own Settings (`<app>/explorer?settings=editor`), where
  everything that only means something in an editor lives (its scale, panels and the rest).

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

## Behaviour

- No analytics. The one cookie is the accounts session, set by the accounts API when someone
  signs in. Every page asks the accounts API whether someone is signed in; the dashboard and the
  account pages also call their APIs. All of it is on this origin.
- Light and dark, following the device (the shared appearance boot script).
- Works at phone width with a 16px gutter. Tap targets are 44px on touch screens.
- The front door and the dashboard are indexable: title, description, canonical, Open Graph,
  `robots.txt` and `sitemap.xml`.

## Hosting

One Worker, `liveworkspace-site`, static assets only, on the route `liveworkspace.app/*` (and
`www.`). The APIs' routes are more specific, so Cloudflare sends `/api/auth/*` and the two
`.well-known` discovery documents to the accounts Worker, `/api/telemetry/*` to the telemetry
Worker, and everything else here. Security headers come from `public/_headers`.

## Running it locally

```sh
corepack pnpm dev:workspace           # from the repo root: http://localhost:3000
```

That runs the site's dev server on 3000 and both APIs behind it (accounts on 8787, telemetry on
8790; first-time setup for each is in [the README](../README.md#local-development) and
[telemetry.md](telemetry.md#running-it-locally)). The dev server forwards `/api/auth/*`,
`/.well-known/*` and `/api/telemetry/*` to them (`next.config.ts`), so the whole site works from
one origin, as it does in production. Run `corepack pnpm dev:site` for the pages alone.

## Not done yet

- **The apps' own policies** still live in each app's help centre; they should point here instead.
