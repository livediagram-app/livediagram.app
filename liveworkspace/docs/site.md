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
(the current site highlighted), links to Apps, How it fits and Telemetry, the Appearance toggle (Light, Dark, System, as on the
apps' sites; the boot script applies the choice before paint), and the account control. On a phone the wordmark, the Appearance toggle and the account control show; the footer has
the rest.

- **Signed out**: **Sign in**, which opens `/sign-in` with the page to come back to
  (`?return=/telemetry`, say). Once signed in, the page goes back there. Only a path on this site
  is followed, so the link can't send anyone elsewhere.
- **Signed in**: the account's first name (or full name, or email) and **Sign out**, which ends
  the liveworkspace session here. It doesn't sign anyone out of an app: each app holds its own
  tokens.

The site is static, so the control asks the accounts API (`GET /api/auth/get-session`, on this
origin, with the session cookie) once the page is up. Until it hears, it keeps its place empty,
so the bar doesn't jump. The sign-in pages leave it out: they are the sign-in.

### The front door (`/`)

1. **Hero**: what liveworkspace is in one line: a set of live, real-time apps, each built for one
   kind of work, under one roof. Two calls to action: see the apps (scrolls to them) and the
   telemetry dashboard ("see exactly what we measure").
2. **The apps**: one card per app in `@liveworkspace/sites`, in that order, each with its accent,
   its pitch, three things it does, and one link to its site. A small drawing on each card shows
   what the app makes (a diagram; a board of cards). An app is only listed once it's in
   `@liveworkspace/sites`, and the page's own copy for it (`lib/apps.ts`) is required by a test, so
   a new app can't ship with an empty card.
3. **How it fits**: what every app shares:
   - **Live by default**: everything is real-time and shared by link.
   - **One account**: signing in goes through liveworkspace.app (email code or Google, no
     password), so one sign-in covers each app that uses it.
   - **Open about data**: no third-party trackers; the anonymous telemetry is public, for every app
     at once or one at a time.
   - **Free to start**: each app works without paying, and the editors work before you sign in.
4. **Footer**: every site again, the telemetry dashboard, and each app's privacy
   policy (liveworkspace has no policy of its own yet: see "Not done yet").

### Telemetry (`/telemetry`)

The public dashboard for every app's anonymous events, all apps at once or one at a time
(`?app=livediagram.app`): [telemetry.md](telemetry.md). Each app's filter shows that app's logo
as its own header does, the prism and the wordmark in the app's accent. It reads its numbers from
`/api/telemetry/summary`. Its styles (and both apps' shared UI, which its views render) are in
their own stylesheet, `app/telemetry/telemetry.css`, so the other pages don't carry them.

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
corepack pnpm dev:workspace           # from the repo root: http://localhost:3300
```

That runs the site's dev server on 3300 and both APIs behind it (accounts on 8787, telemetry on
8790; first-time setup for each is in [the README](../README.md#local-development) and
[telemetry.md](telemetry.md#running-it-locally)). The dev server forwards `/api/auth/*`,
`/.well-known/*` and `/api/telemetry/*` to them (`next.config.ts`), so the whole site works from
one origin, as it does in production. Run `corepack pnpm dev:site` for the pages alone.

## Not done yet

- **A liveworkspace privacy policy and terms.** Today the footer links to each app's own.
- **livedocuments.app** joins when it ships: a row in `@liveworkspace/sites` and its copy in
  `lib/apps.ts`.
