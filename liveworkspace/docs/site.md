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
(the current site highlighted), links to Our Apps, How it fits and Telemetry, the Appearance toggle (Light, Dark, System, as on the
apps' sites; the boot script applies the choice before paint), and the account control. On a phone the wordmark, the Appearance toggle and the account control show; the footer has
the rest.

- **Signed out**: **Sign in**, which opens `/sign-in` with the page to come back to
  (`?return=/telemetry`, say). Once signed in, the page goes back there. Only a path on this site
  is followed, so the link can't send anyone elsewhere.
- **Signed in**: the account's first name (or full name, or email), linking to
  [Your account](#your-account-account), and **Sign out**, which ends
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
   and a photo being cropped), **Open <app>** in its deep accent, and "Signs in with your
   liveworkspace account". Below `lg` the window sits between the summary and the three things it does.
   livedocuments' and livedesign's logos are their own prisms with the wordmark
   drawn here (`components/landing/AppLogo.tsx`), since their Brand colours "live" with a brand scale
   this site doesn't have. The copy is
   `lib/apps.ts`; tests require it for every app and that white text on each deep accent passes
   WCAG AA.
3. **How it fits together** (`#how-it-fits`): the path a piece of work takes, one step per app
   (sketch the idea, plan the work, write it up, make it look right), each a link to its app's New
   page (**Build a diagram**, **Start planning**, **Start writing**, **Start designing**), then
   "share one link", and what every app shares: one account (the large tile, with Create your
   account), live by default, share by link, open about data (linking `/telemetry`), yours to keep
   (closing the account closes it everywhere), completely free (no paywalls or subscriptions).
4. **Closing call to action**: "One account. Every app. Always live."
5. **Footer**: Our Apps (each app's site), Platform (Product Comparison and the telemetry dashboard) and Legal (the
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
([accounts.md](accounts.md)): `/account/teams` (invitations waiting for them, making a team, and each
team's name, members, roles and invitations) and `/account/tokens` (making an API token, seeing it
once, and revoking it, the AI tools connected in an app among them). `/account` opens the teams.
Signed out, the pages ask them to sign in and come back. They read and write
`/api/account/*` on this origin with the session cookie (`lib/account-api.ts`), and are kept out of
search.

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
one origin, as it does in production. Run `corepack pnpm dev:site` for- **The apps' own policies** still live in each app's help centre; they should point here instead.wn site; the
footer links to none.
