# Installable app

livedocuments installs to a phone's or computer's home screen like an app, and an installed livedocuments can show phone
notifications ([Phone notifications](../014-identity/phone-notifications.md)). The platform's half is
[push.md "The app side"](../../../../liveworkspace/docs/specs/003-accounts/push.md#the-app-side).

## The manifest

`/manifest.webmanifest`, served by the marketing app (`app/manifest.ts`, built by `installManifest` in
`@liveworkspace/marketing-site/lib/install`):

- `name` and `short_name` `livedocuments`, `display: standalone`, `id` and `scope` `/`, theme colour `#F59E0B`, a white
  background.
- `start_url` `/explorer`: an installed livedocuments opens on the person's work, never the marketing page. `id` stays `/`,
  so an install made before keeps being the same app.
- Icons: the scalable mark (`/icon.svg`) and `/livedocuments-icon-256.png` and `/livedocuments-icon-512.png`, for any purpose. iOS
  uses the opaque `apple-touch-icon` the pages already link.

Every page on the address links it: the marketing pages (Next.js's own link), the editor (`metadata.manifest`), and
the Explorer, whose liveworkspace.app pages link `/manifest.webmanifest` relatively, which is livedocuments's own here.

## The push-only service worker

`/push-worker.js`, also the marketing app's (`app/push-worker.js/route.ts`, `pushWorkerResponse`):

- Registered only when someone presses Turn On in Settings, never on page load, so no page pays for it.
- It has **no fetch handler**: it answers no request and keeps no offline copy, so the editor still can't start
  without a connection ([Load recovery](../007-editor/load-recovery.md) "Out of scope").
- It shows each push (title, the app's name, the livedocuments icon, its tag) and, on a tap, focuses a window already at the
  link or opens it, on whichever app's address the link is.
- Trusted Types: the `default` policy lets exactly this path, on the page's own origin, reach
  `navigator.serviceWorker.register` ([Trusted Types](trusted-types.md)).

## On iPhone and iPad

Safari gives a page Web Push only once it is on the Home Screen and opened from there. Settings says so in place of
Turn On: Share, then Add to Home Screen, then open livedocuments from the Home Screen.
