# Previews

A preview is the picture of an item: the drawing on its first tab (or the one tab a link opens). It shows in the
Explorer's rows and cards, as the live image a share link embeds in a README or a wiki, and as the card a chat app
draws when someone pastes a share link. Every app had its own copy of this (its own bucket, routes, cache and card
renderer). It is one platform capability now, built once, in liveworkspace's media service.

```
liveworkspace/apps/media/src/previews/   the routes, the store, the access check, the share card
packages/media/src/previews.ts           the addresses and cache rules, for the Explorer, routers and apps
packages/media/src/share-page.ts         the share page's head, the same in every app (createSharePage)
packages/index-app/src/internal.ts       the export door each app answers (handlers.export)
```

## Who does what

| The platform (the media Worker)                                    | The app                                              |
| ------------------------------------------------------------------ | ---------------------------------------------------- |
| One address for every app's previews, on every origin              | Drawing an item (or one tab) as SVG, on request      |
| Who may see a preview: the index's access rule, asked per request  | What a public link (a Community post's) may show     |
| When a preview is stale: the index's `updatedAt` for the item      | Its content's own version, answered with the drawing |
| Storing previews (one bucket), serving them with their cache rules | Telling the platform when an item is purged          |
| The share card: the drawing on a 1200 x 630 PNG                    |                                                      |

**Why the media Worker, not a Worker of its own.** It already owns an R2 bucket, serves image bytes, holds a key for
every app and has its own deploys. A previews Worker would add a Worker, a route, a set of keys and a deploy for the
same job. The index was the other candidate (it decides access and knows `updatedAt` without a hop), but it is the
busiest Worker on the platform, and the share card's rasteriser (resvg and two fonts, about 3 MB) would load with
every Explorer list. In media it loads only where cards are drawn, and it leaves all four app APIs.

**Why render on read, in the app.** Only the app can draw its items, and the content is in the item's Durable Object.
Rendering on save would draw on every autosave of every item, viewed or not; rendering on read draws an item at most
once per change, and only if someone looks. The apps had already measured this ([the old snapshot spec][old]), and
the platform keeps it.

[old]: ../../livediagram/docs/specs/006-document/document-snapshots.md

## The addresses

All under `/api/previews` on liveworkspace.app. Each app's router forwards the same paths on its own origin, so a
browser always calls its own origin (no CORS, no preflight), and the old share addresses keep working:

| On any origin                | Forwarded to                          | Who                          |
| ---------------------------- | ------------------------------------- | ---------------------------- |
| `/api/previews/items/:id?v=` | `/api/previews/items/:id`             | person or link (the index's) |
| `/api/share/:code/image.svg` | `/api/previews/share/:code/image.svg` | anyone with the code         |
| `/api/share/:code/image.png` | `/api/previews/share/:code/image.png` | anyone with the code         |
| `/api/share/:code/card`      | `/api/previews/share/:code/card`      | anyone with the code         |

`@liveworkspace/sites/workspace-proxy` (`previewsTargetFor`, `routeToPreviews`) holds the mapping, so the four
routers can't drift. Each router names its environment's origin in `PREVIEWS_ORIGIN` (local `http://127.0.0.1:8792`,
staging `https://staging.liveworkspace.app`, production by default). `/api/share/:code` itself (what a link opens)
stays the app's.

### `GET /api/previews/items/:id?v=<updatedAt>`

The Explorer's preview, for any app's item. The caller sends what the index takes (`Authorization: Bearer` with an
access or guest token, `X-Share-Code` and `X-Share-Password` for an item reached through a link). The platform asks
the index `GET /items/:id` with the same headers, so the preview is never more visible than the item: the same rule,
the same answer, in one indexed read. `v` only keys the browser's cache.

- `200 image/svg+xml`, `Cache-Control: private, max-age=86400`: the URL changes when the item does.
- `404` with the same cache header: nothing to draw (an empty item, a tab with nothing on it). Version-keyed too.
- `404` with `Cache-Control: no-store`: no such item, or no access. Says nothing more.
- A reader whose link is confined to one tab gets that tab's picture, never the first tab's. A reader through a
  public link (a Community post's) gets what the app shows a public link (livediagram: the redacted drawing).

### `GET /api/previews/share/:code/image.svg[?tab=<id>]`

The live image: the link's drawing for a bare `<img>`. The code is the only credential; the index resolves it as an
anonymous visitor would, so an unknown, revoked or expired code, an item in the Trash and an item with a share
password (an `<img>` cannot send one) are all `404`. `?tab=` picks a tab; a link confined to one tab always draws its
own, and asking for another is a `404`. `Cache-Control: public, max-age=30, stale-while-revalidate=300`; a public
link's has no stale window (`public, max-age=30`), so it cannot linger once its post is hidden.

### `GET /api/previews/share/:code/image.png`

The share card: the same drawing, behind the same gate, fitted onto 1200 x 630 with a 48 px margin, grown at most
twice, on the drawing's own paper (`share-card.ts`), rasterised by `@liveworkspace/render-png/worker`.
`public, max-age=300, stale-while-revalidate=3600` (a public link's: `public, max-age=30`). An item with nothing to
draw answers `302` to the app's brand card (`Location: /opengraph-image`, relative, so it lands on the origin the
crawler asked), `public, max-age=300`.

### `GET /api/previews/share/:code/card`

`{ name }`: the item's title, for the app's share page, which writes it into the page's head
(`og:title`, and `og:image` pointing at `image.png`). Answers exactly where the card image does.

## The share page's head

A crawler never runs a page's script, and each app's share page (`/<item>/shared?s=<code>`) is one static shell, so
the app's web Worker rewrites the shell's head before sending it: `createSharePage` in `@liveworkspace/media`, the
same code in every app. The app gives it only its share page's addresses, its untitled name and its pitch. It asks
`GET <PREVIEWS_ORIGIN>/api/previews/share/:code/card` (1.5 s at most, fetched beside the shell, the visitor's address
passed on) and, given `{ name }`, writes the title, description, `og:*` and `twitter:*` tags, the image being
`<the page's origin>/api/previews/share/:code/image.png`. Anything else, and the shell goes out as built with the
brand card. No app's web Worker needs its API bound for this any more.

## Storage

One bucket, the media service's own (`liveworkspace-media`, `liveworkspace-media-staging`), under `previews/`. Image
ids never contain a slash, so the two never meet, and nothing in media lists the bucket.

```
previews/<app>/<itemId>/<view>-<tab>.svg   view: full | public; tab: first | <tabId>
previews/<app>/<itemId>/<view>-<tab>.png   the share card drawn from the SVG beside it
```

Each object carries `v` (the item version it is fresh for), `av` (the app's own content version it was drawn at)
and `e: '1'` for "nothing to draw" (a zero-byte object, so an empty item is asked of its app once per change, not on
every view). A card carries the `av` of the drawing it was made from.

## Staleness: the index's `updatedAt`

The index already learns when an item changes: each item's Durable Object pushes its summary and last save through
its outbox (`PUT /app/items/:id/summary`, at most once a minute), and `updatedAt` moves with it. The Explorer lists
carry `updatedAt` too. So:

- **Fresh** when the stored `v` is at least the item's `updatedAt`: streamed from R2, and the app is not called.
- **Stale or missing**: the app's export door draws it, the platform stores it with
  `v = max(updatedAt, the app's version)` (in `waitUntil`, after the response) and serves it.
- **A public link** (a Community post's) is always asked of its app, conditionally (`If-None-Match: "<av>"`): the
  app says whether the link may still show anything (a hidden post may not) and answers `304` when nothing changed,
  so the drawing is not redrawn. That is one Durable Object call per request on those links, as before.
- **If the app can't be reached**, a stale preview is served rather than none (not for a public link, whose app
  must say yes each time).

A preview can trail an edit by up to the outbox's minute; the Explorer's own `updatedAt` trails the same way, so a
list and its pictures always agree.

## The export door

Each app answers one door in the shared kit (`@liveworkspace/index-app`, `handleInternalItems`):

```
GET <app>/api/internal/items/:id/export?format=svg[&tab=<tabId>][&code=<public link code>]
Authorization: Bearer <INDEX_KEY or MEDIA_KEY>
If-None-Match: "<version>"            optional
```

| Answer | Means                                                                                     |
| ------ | ----------------------------------------------------------------------------------------- |
| `200`  | the file, its `Content-Type`, and `ETag: "<version>"` (the content's last save, epoch ms) |
| `204`  | nothing to draw (`ETag` as above)                                                         |
| `304`  | `If-None-Match` is the current version: unchanged, not drawn                              |
| `404`  | no such item or tab, or a link the app shows nothing through                              |

The app supplies `handlers.export(itemId, { format, tabId, code, ifVersion })`. It is answered in the item's Durable
Object, where the content is: no cache, no bucket, no card. It takes the app's `INDEX_KEY` (the index, and the Drive
mirror after it) or `MEDIA_KEY` (this service); a door with no handler is a `404`. `format` is `svg` today. The Drive
mirror, the next platform feature, adds the formats it exports (the item's own file), on the same door.

Each app's door draws as its old snapshot did: the first tab (or the asked one) with its own DOM-free renderer, its
images inlined from the media service under a 3 MB budget, icons as their glyphs. livediagram's draws a Community
post's link from the redacted tab and refuses one whose post is hidden.

## Purging

When the index purges an item, its app's purge handler tells the platform
(`DELETE /api/media/app/previews/:itemId`, the app's media key, `createMediaClient().deletePreviews`), which deletes
every object under `previews/<app>/<itemId>/`. An app can only delete its own items' previews. A preview the purge
misses is unreachable anyway: every read asks the index first, and a purged item has no row.

## Configuration

| Where          | Setting                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------- |
| media Worker   | route `liveworkspace.app/api/previews*`; `INDEX` service binding and `INDEX_URL`;             |
|                | `APP_ORIGIN_<APP>` (where each app's `/api/internal` is); `MEDIA_KEY_<APP>` (already set)     |
| app api Worker | `MEDIA_KEY` (already set) opens the export door; nothing else                                 |
| app router     | `PREVIEWS_ORIGIN` (unset is production's)                                                     |
| app web Worker | `PREVIEWS_ORIGIN` for the share page's head (unset is production's; staging sets its own)     |
| site (dev)     | `next dev` rewrites `/api/previews/*` to `MEDIA_DEV_ORIGIN` (default `http://localhost:8792`) |

Locally it runs with media (`corepack pnpm dev:media`, port 8792, in `dev:workspace`).

## Cost and performance

- **Nothing runs while nobody looks.** No cron, no render on save, no per-person state. Storage is one SVG per viewed
  item (a few KB to a few hundred), a card per shared item (about 30 to 80 KB), and an empty marker for empty ones.
- **An Explorer page of 50 items** asks for at most 50 previews, 4 at a time, only as cards near the screen, once per
  item version (the browser keeps each a day). Every request is same-origin now: no CORS preflight, which a
  cross-origin request with `Authorization` needed per item before, and livedocuments' items have previews at all.
- **A preview on the hit path** is one index read (a service binding, one D1 lookup by id) and one R2 read. The old
  path also woke the item's Durable Object to learn its last save, and minted and signed a grant.
- **A miss** is one call to the app's door: one Durable Object call, one render, as before.
- **The share card's** rasteriser loads in the media Worker only, on a card miss.

The measured numbers are in the commit that moved previews here.
