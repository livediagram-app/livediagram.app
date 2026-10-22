# liveworkspace.app

The front door of the platform: one page that says what liveworkspace is, and sends people on to
the app that fits their work. The apps (livediagram.app, liveplanner.app) each keep their own
marketing site for the detail. This one stays short and points at them.

```
apps/marketing    the site at liveworkspace.app (a Next static export, Cloudflare static assets)
```

## Who it's for

- Someone who heard of "liveworkspace" and wants to know what it is.
- Someone on one app who wants to know what the others are (every app's logo links here,
  [site-switcher.md](site-switcher.md)).
- Someone who landed on accounts.liveworkspace.app or the telemetry dashboard and wants the bigger
  picture.

## The page

1. **Header**: the liveworkspace wordmark, with the site switcher on hover (marked "You're here"),
   and links to Apps, How it fits, and Telemetry.
2. **Hero**: what liveworkspace is in one line: a set of live, real-time apps, each built for one
   kind of work, under one roof. Two calls to action: see the apps (scrolls to them) and the
   telemetry dashboard ("see exactly what we measure").
3. **The apps**: one card per app in `@liveworkspace/sites`, in that order, each with its accent,
   its pitch, three things it does, and one link to its site. A small drawing on each card shows
   what the app makes (a diagram; a board of cards). An app is only listed once it's in
   `@liveworkspace/sites`, and the page's own copy for it (`lib/apps.ts`) is required by a test, so
   a new app can't ship with an empty card.
4. **How it fits**: what every app shares:
   - **Live by default**: everything is real-time and shared by link.
   - **One account**: signing in goes through accounts.liveworkspace.app (email code, no password),
     so one sign-in covers each app that uses it.
   - **Open about data**: no third-party trackers; the anonymous telemetry is public, for every app
     at once or one at a time.
   - **Free to start**: each app works without paying, and the editors work before you sign in.
5. **Footer**: every site again, the telemetry dashboard and accounts, and each app's privacy
   policy (liveworkspace has no policy of its own yet: see "Not done yet").

No sign-in button: signing in only means something inside an app.

## Behaviour

- Static: no client data fetching, no analytics, no cookies. The only script is Next's runtime and
  the site switcher.
- Light and dark, following the device (the shared appearance boot script).
- Works at phone width with a 16px gutter. Tap targets are 44px on touch screens.
- Indexable: title, description, canonical, Open Graph, `robots.txt` and `sitemap.xml`.

## Hosting

One Worker, static assets only, on the route `liveworkspace.app/*` (and `www.`). The telemetry
Worker's route `liveworkspace.app/telemetry*` is more specific, so Cloudflare sends
`/telemetry` there and everything else here. Security headers come from `public/_headers`.

## Not done yet

- **A liveworkspace privacy policy and terms.** Today the footer links to each app's own.
- **livedocuments.app** joins when it ships: a row in `@liveworkspace/sites` and its copy in
  `lib/apps.ts`.
