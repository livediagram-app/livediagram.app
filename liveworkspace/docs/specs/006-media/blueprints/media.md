# Media and previews: blueprint

Derived from [media.md](../media.md) and [previews.md](../previews.md). The spec decides; this file only adds
engineering precision, read from the code. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `MEDn`. Paths are relative to the repository root.

Scope, by file:

| File                                                      | Role                                                                                                                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/media/src/index.ts`                   | The Worker: `/api/previews*` to `handlePreviews` (404 when off); `/api/media/app*` to `handleApp`; 404 elsewhere; `scheduled` runs the sweep                               |
| `liveworkspace/apps/media/src/config.ts`                  | `API_PATH`, `PREVIEWS_PATH`, `MAX_JSON_BYTES`, `UNUSED_IMAGE_AGE_MS`, `SWEEP_PAGE`, the tripwire                                                                           |
| `liveworkspace/apps/media/src/env.ts`                     | `Env`, `appKey`, `keyedApps`, `mediaEnabled`, `parsePositiveCap`, `appDoor`, `indexAppOf`                                                                                  |
| `liveworkspace/apps/media/src/http.ts`                    | `ok`, `notFound`, `badRequest`, `forbidden`, `unauthorized`, `unavailable`                                                                                                 |
| `liveworkspace/apps/media/src/routes.ts`                  | `handleApp`: images, previews purge, usage, refs, owner merge and delete; `upload`; `originalNameOf`                                                                       |
| `liveworkspace/apps/media/src/images.ts`                  | `images` reads and writes: `listImages`, `getImage`, `findBySha`, `ownerTotals`, `insertImage` (atomic caps), `deleteImageRow`, `usageOf`, `mergeOwner`, `deleteOwnerRows` |
| `liveworkspace/apps/media/src/refs.ts`                    | `syncRefs`, `refsComplete`                                                                                                                                                 |
| `liveworkspace/apps/media/src/retention.ts`               | `sweepUnusedImages`, `sweepTripped`, `reap`                                                                                                                                |
| `liveworkspace/apps/media/src/jpeg-strip.ts`              | `stripJpegMetadata`: drop every APPn and COM segment, keep the image bit-identical                                                                                         |
| `liveworkspace/apps/media/src/previews/routes.ts`         | `handlePreviews`: the item preview and the three share doors                                                                                                               |
| `liveworkspace/apps/media/src/previews/access.ts`         | `reachItem`, `reachLink`: the index decides who sees a preview                                                                                                             |
| `liveworkspace/apps/media/src/previews/store.ts`          | Bucket keys, freshness, `drawing`, `svgText`, `deleteItemPreviews`                                                                                                         |
| `liveworkspace/apps/media/src/previews/door.ts`           | `callDoor`: the app's export door, `DOOR_TIMEOUT_MS`                                                                                                                       |
| `liveworkspace/apps/media/src/previews/share-card.ts`     | `shareCardSvg`: fit a drawing on the 1200 x 630 card                                                                                                                       |
| `liveworkspace/apps/media/src/previews/share-card-png.ts` | `shareCardPng`: resvg, imported on first use                                                                                                                               |
| `liveworkspace/apps/media/scripts/e2e-media.mjs`          | An end-to-end run against a local Worker                                                                                                                                   |
| `liveworkspace/apps/media/migrations/0001_media.sql`      | `images`, `refs`, `ref_sync`                                                                                                                                               |
| `packages/media/src/*`                                    | The contract: `MEDIA_APPS`, limits, `sniffImageType`, owners, wire headers, `createMediaClient`, previews' paths and caches, `createSharePage`, gallery usage              |

## Domain and naming

| Term        | Identifier                                                                              | Meaning                                                                    |
| ----------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| App         | `MediaApp`: `livediagram.app`, `liveplanner.app`, `livedocuments.app`, `livedesign.app` | The four apps; the index's `App` is the name without `.app` (`indexAppOf`) |
| Image       | `images` row; id `crypto.randomUUID()`; R2 key = id                                     | One stored picture                                                         |
| Owner       | account id, or `guest:<sha256(app + "\n" + guestId)>` (`mediaGuestOwner`)               | Who uploaded it                                                            |
| Reference   | `refs (app, document, image_id)`                                                        | A document that places an image, as its app last said                      |
| Complete    | `ref_sync (app, completed_at)`                                                          | The app has reported every document at least once                          |
| Preview     | `previews/<app>/<itemId>/<view>-<tab>.svg`                                              | An item's drawing; `view` `full` or `public`, `tab` `first` or the tab id  |
| Share card  | the same key with `.png`                                                                | The 1200 x 630 raster drawn from the SVG beside it                         |
| Subject     | `Subject { app, itemId, version, tabId, code }`                                         | What one preview is drawn for                                              |
| Export door | `<APP_ORIGIN_<APP>>/api/internal/items/:id/export?format=svg`                           | The only place an item is drawn                                            |

## Behaviour and state

### Upload (`upload`), cheapest refusal first

1. `Content-Type` lowercased must be one of `ACCEPTED_IMAGE_TYPES` (`image/png`, `image/jpeg`, `image/webp`,
   `image/gif`), else `415 { error: 'unsupported_type', acceptedTypes }`.
2. `Content-Length` must be a positive number (`400 missing_length`) and at most `MAX_IMAGE_BYTES` (10 MiB), else
   `413 { error: 'file_too_large', limitBytes }`.
3. `X-Image-Sha256` (64 hex): the owner's image with that hash answers `200 { image, deduped: true }` unread.
4. Caps (`IMAGE_MAX_PER_OWNER`, `IMAGE_MAX_BYTES_PER_OWNER`, each null when unset, blank, 0 or not a number): count
   at the cap, or bytes plus the declared length over it, is `403 { error: 'gallery_full', reason: 'count' | 'bytes',
limit, current }`.
5. `X-Image-Width` and `X-Image-Height` positive integers, else `400 invalid_dimensions`.
6. `X-Image-Original-Name`: percent-decoded when it decodes, cut to `ORIGINAL_NAME_MAX` (200) code points; null when
   absent.
7. Read the body; over 10 MiB is `413`. `sniffImageType` of the first 16 bytes must equal the declared type, else
   `415 unsupported_type` (SVG never passes).
8. SHA-256 of the body as sent; the owner's image with it answers `deduped: true`.
9. A JPEG goes through `stripJpegMetadata`; a malformed one is `415 { error: 'malformed_jpeg' }`.
10. `bucket.put(uuid, stored, { httpMetadata: { contentType }, customMetadata: { owner, app } })`.
11. `insertImage`: `INSERT OR IGNORE … SELECT … WHERE` both caps still hold, in one statement. A throw deletes the
    bytes and rethrows. No row inserted: delete the bytes; the raced image with that hash answers `deduped: true`;
    else a cap answer, else `409 { error: 'upload_conflict' }`.
12. `200 { image: MediaImage, deduped: false }`, logged `[media] stored`.

### Delete

- **One image** (`DELETE /app/images/:id?owner=`): no row is `200 { ok: true }`; another owner's is `403 forbidden`;
  otherwise the row first, then the R2 object (a failed R2 delete is logged, never undone).
- **An owner** (`DELETE /app/owners/:owner`): `DELETE … RETURNING id`, then R2 deletes in pages of 1000.
- **An item's previews** (`DELETE /app/previews/:itemId`): every object under `previews/<caller's app>/<itemId>/`,
  listed and deleted page by page; `200 { deleted }`.

### Guest merge (`mergeOwner`)

`UPDATE images SET owner = to WHERE owner = from AND NOT EXISTS (to holds the same sha256) RETURNING id`; the rest
stay on the guest. `200 { moved, kept }` (ids, sorted); `400 invalid_body` when `from === to` or either is not an id.

### References (`syncRefs`)

Per listed document, in one batch: delete its refs not in the new list, `INSERT OR IGNORE` the new ones (an empty
list clears it). `complete: true` adds the app to `ref_sync` once (`ON CONFLICT DO NOTHING`).

### The daily sweep (`41 3 * * *`)

1. Off or no bucket: nothing.
2. `refsComplete(keyedApps)`: every app with a key must be in `ref_sync`, else log `sweep paused` and stop.
3. Count images older than `UNUSED_IMAGE_AGE_MS` (30 days) and how many of them no ref names.
4. None unplaced: stop. `sweepTripped`: more than `SWEEP_TRIPWIRE_MIN` (20) and over `SWEEP_TRIPWIRE_RATIO` (0.5) of
   the old ones: log an error and reap one page of `SWEEP_PAGE` (1000), oldest first.
5. Otherwise page by id (`id > after`, 1000 at a time) and reap each page.
6. `reap`: `DELETE … WHERE id IN (page) AND NOT placed RETURNING id` (re-checked at that instant), then R2 delete;
   an R2 failure leaves bytes with no row, never a row with no bytes.
7. Logs `[media] sweep: deleted <n> images older than <iso>`.

### A preview (`drawing`)

| Stored object                                                                | Subject     | Effect                                                                                |
| ---------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| present, `v >= version`, no `code`                                           | private     | served from the bucket (`e: '1'` is empty)                                            |
| missing or stale, or a public link (`code`)                                  | any         | `callDoor` with `If-None-Match: exportEtag(av)` when a public link holds one          |
| door `ok`                                                                    |             | the SVG served; stored after the response with `v = max(version, door version)`, `av` |
| door `empty` (`204`)                                                         |             | a zero-byte object stored with `e: '1'`; served as empty                              |
| door `unchanged` (`304`)                                                     |             | the stored object; none stored is unavailable                                         |
| door `not_found` (`404`)                                                     |             | missing                                                                               |
| door `error` (timeout 15 s, no `ETag` version, other status, not configured) | private     | the stale object if any, else unavailable; logged `export door failed`                |
| door `error`                                                                 | public link | unavailable (its app must say yes each time)                                          |

### Who may see it (`access.ts`)

- **Item preview**: `GET <INDEX_URL>/items/:id` through the `INDEX` binding (or fetch), 5 s timeout, with the
  caller's `Authorization`, `X-Share-Code` and `X-Share-Password` only. A 5xx, a throw or bad JSON is unavailable;
  any other non-2xx is denied.
- **Share doors**: an anonymous `GET /share/:code` (nothing recorded). Unknown, revoked, expired, trashed and
  password-gated links are denied. `public` in the answer makes the code the subject's `code`.

### The share doors (`shareDoor`)

- `card`: for a public link the drawing is checked first (missing is 404, unavailable is 503); then
  `{ name: item.title }`, `no-store`.
- `image.svg`: `?tab=` picks a tab; a link confined to one tab refuses another (`404`); empty with no tab is `404`;
  else the SVG.
- `image.png`: empty is a `302` to `/opengraph-image` (`BRAND_CARD_PATH`, relative, cached 300 s); a stored PNG whose
  `av` matches the drawing is served; otherwise `shareCardPng`, stored after the response with `av`; a failure or a
  drawing with no sized root falls back to the brand card.

## Interfaces and contracts

### The media API (`/api/media/app`, app Workers only)

Every request: `X-Media-App: <app>` and `Authorization: Bearer <MEDIA_KEY_<APP>>` (`timingSafeEqual`), else
`401 { error: 'unauthorized' }`; no bucket is `503 { error: 'media_unavailable' }`; off is `404`. Path segments are
percent-decoded (a guest owner arrives as `guest%3A…`). Ids are 1 to `MEDIA_ID_MAX` (200) characters.

| Route                       | Request                                                                                                                            | Answers                                                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /images?owner=`        |                                                                                                                                    | `200 { images: MediaImage[] }`, `created_at DESC, id`; `400 invalid_owner`                                                                 |
| `POST /images?owner=`       | the bytes; `Content-Type`, `Content-Length`, `X-Image-Width`, `X-Image-Height`, optional `X-Image-Original-Name`, `X-Image-Sha256` | `200 { image, deduped }`; `400`, `403 gallery_full`, `409 upload_conflict`, `413`, `415`                                                   |
| `GET /images/:id`           |                                                                                                                                    | `200 { image, owner }`; `404`                                                                                                              |
| `GET /images/:id/bytes`     |                                                                                                                                    | the bytes; `Content-Type`, `Content-Length`, `X-Media-Owner`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`; `404` |
| `DELETE /images/:id?owner=` |                                                                                                                                    | `200 { ok: true }`; `403 forbidden`; `400 invalid_owner`                                                                                   |
| `DELETE /previews/:itemId`  |                                                                                                                                    | `200 { deleted }`                                                                                                                          |
| `GET /usage?owner=`         |                                                                                                                                    | `200 { usage: { [imageId]: [{ app, document }] } }`                                                                                        |
| `POST /refs`                | `{ documents: [{ document, images }], complete? }`, ≤ 500 documents, ≤ 1000 images each, body ≤ 2 MiB                              | `200 { ok: true }`; `400 invalid_body`                                                                                                     |
| `POST /owners/merge`        | `{ from, to }`                                                                                                                     | `200 { moved, kept }`; `400 invalid_body`                                                                                                  |
| `DELETE /owners/:owner`     |                                                                                                                                    | `200 { deleted }`                                                                                                                          |

`MediaImage`: `{ id, contentType, byteSize, width, height, originalName?, createdAt, app }`; never the owner or hash.

### Previews (`/api/previews`, browsers)

Only `GET` and `HEAD` (`405`, `Allow: GET, HEAD`). A bad path is a `404 { error: 'not_found' }` with `no-store`.

| Route                               | Auth                                | Answers                              | Cache                                                                                |
| ----------------------------------- | ----------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------ |
| `GET /items/:id?v=<updatedAt>`      | the caller's token or share headers | SVG; `404` empty or no access; `503` | `private, max-age=86400`; a public link's `private, max-age=30`; denied `no-store`   |
| `GET /share/:code/image.svg[?tab=]` | the code                            | SVG; `404`; `503`                    | `public, max-age=30, stale-while-revalidate=300`; public link `public, max-age=30`   |
| `GET /share/:code/image.png`        | the code                            | PNG; `302` brand card; `404`; `503`  | `public, max-age=300, stale-while-revalidate=3600`; public link `public, max-age=30` |
| `GET /share/:code/card`             | the code                            | `{ name }`; `404`; `503`             | `no-store`                                                                           |

SVGs carry `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com;
font-src https://fonts.gstatic.com; img-src data:; sandbox` and `nosniff`; the share doors add
`Access-Control-Allow-Origin: *`. `503 { error: 'previews_unavailable' }` is `no-store`. Each app's router forwards
`/api/previews/*` and `/api/share/<code>/image.svg|image.png|card` here (`@liveworkspace/sites/workspace-proxy`).

### The export door (each app, `@liveworkspace/index-app`)

`GET /api/internal/items/:id/export?format=svg[&tab=][&code=]`, `Authorization: Bearer <the app's MEDIA_KEY>`,
optional `If-None-Match`. `200` SVG, `204` nothing to draw, `304` unchanged, `404` gone; every answer but `404`
must carry an `ETag` that `etagVersion` reads.

## Data and persistence

| Table      | Key                                   | Columns                                                                                                      | Indexes                                                                                                                                 |
| ---------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `images`   | `id` TEXT PK                          | `owner`, `app`, `content_type`, `byte_size`, `width`, `height`, `sha256`, `original_name` null, `created_at` | `images_owner_sha_idx` UNIQUE `(owner, sha256)`; `images_owner_created_idx (owner, created_at DESC)`; `images_created_idx (created_at)` |
| `refs`     | `(app, document, image_id)`, no rowid | no foreign key: a document may place a deleted image                                                         | `refs_image_idx (image_id)`                                                                                                             |
| `ref_sync` | `app`, no rowid                       | `completed_at`                                                                                               |                                                                                                                                         |

Written by: `images` upload, delete, merge, owner delete, sweep; `refs` `syncRefs`; `ref_sync` a complete sync.
Read by: galleries, dedupe, caps, usage (refs joined to images), the sweep.

R2 (`MEDIA`, `liveworkspace-media`): image bytes at `<uuid>` (`customMetadata { owner, app }`); previews under
`previews/` with `customMetadata { v, av, e? }`. Image ids never hold a slash, so the two never meet.

## Errors and edge cases

| Case                                  | Behaviour                                                      |
| ------------------------------------- | -------------------------------------------------------------- |
| `MEDIA_ENABLED` `false`/`0`/`off`     | every route `404`; the cron does nothing                       |
| No bucket                             | media `503 media_unavailable`; previews `503`; sweep returns 0 |
| The same bytes twice (any app)        | the one image, `deduped: true`                                 |
| Two uploads race the caps             | the insert re-checks atomically; the loser's bytes deleted     |
| A row insert throws                   | the bytes deleted, the error rethrown                          |
| R2 delete fails after the row went    | logged; bytes stay unreferenced                                |
| Not every keyed app has reported      | the sweep pauses                                               |
| A reference gap looks like mass unuse | the tripwire: one page, oldest first, logged as an error       |
| The app cannot draw (timeout, error)  | a stale private picture, else `503`                            |
| No door configured for an app         | its items have no previews (`app_not_configured`)              |
| Share password                        | the share doors answer `404` (an `<img>` can't send one)       |

## Security and trust

- The media API is server to server: no CORS, a key per app, constant-time checks. Any app may read any image's bytes
  (reuse across apps); each app decides who sees them.
- A guest's id never leaves its app: only `mediaGuestOwner`'s hash does, so a guest's images stay in that app.
- Uploads are sniffed against the declared type; SVG is never accepted; JPEG metadata (GPS, serials, comments) is
  stripped before storage; bytes are served `nosniff`.
- Previews: the index decides, with the caller's own credentials; stored SVGs are served under a sandboxing CSP on
  every origin; a public link's app is asked each time, so a withdrawn post stops showing within 30 s.

## Performance and limits

Per-owner caps (both environments): 100 images, 104,857,600 bytes (100 MiB). One D1 statement checks both caps at
insert. A ref sync is two statements per document in one batch. The sweep is bounded by pages of 1000. Previews: one
index read per request (5 s), the app's door only on a miss (15 s), stores after the response. Figures are in
[previews.md "Cost and performance"](../previews.md#cost-and-performance).

## Observability

| Level   | Line                                                                 | Where                |
| ------- | -------------------------------------------------------------------- | -------------------- |
| `log`   | `[media] stored { app, id, bytes }`                                  | `routes.ts`          |
| `log`   | `[media] deleted { app, id }`                                        | `routes.ts`          |
| `log`   | `[media] merged a guest { app, moved, kept }`                        | `routes.ts`          |
| `log`   | `[media] forgot an owner { app, deleted }`                           | `routes.ts`          |
| `error` | `[media] R2 delete failed after the row went`                        | `routes.ts`          |
| `error` | `[media] R2 delete failed for a deleted owner`                       | `routes.ts`          |
| `log`   | `[media] sweep: deleted <n> images older than <iso>`                 | `index.ts`           |
| `log`   | `[media] sweep paused: not every app has reported its documents yet` | `retention.ts`       |
| `error` | `[media] sweep tripwire: <u> of <o> old images unplaced; …`          | `retention.ts`       |
| `error` | `[media] sweep: R2 delete failed`                                    | `retention.ts`       |
| `warn`  | `[previews] index unreachable`                                       | `previews/access.ts` |
| `warn`  | `[previews] export door failed { app, itemId, reason }`              | `previews/store.ts`  |
| `warn`  | `[previews] write failed { key }`                                    | `previews/store.ts`  |
| `warn`  | `[previews] share card failed { itemId }`                            | `previews/routes.ts` |
| `warn`  | `[previews] card write failed { key }`                               | `previews/routes.ts` |

## Testing

| Test                                         | Pins                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/media/src/index.test.ts`               | key auth; off and outside paths; 503 without a bucket; store and list newest first; dedupe across apps; the hash shortcut unread; type, size and dimension refusals; JPEG stripping; caps across apps; bytes with the owner header; one image with owner; owner-only delete; owner delete everywhere; refs per document and usage; malformed sync; guest merge keeping held bytes |
| `apps/media/src/retention.test.ts`           | waits for every keyed app; keeps young and placed images; the tripwire page; no bucket; the tripwire bounds                                                                                                                                                                                                                                                                       |
| `apps/media/src/jpeg-strip.test.ts`          | no SOI unchanged; clean JPEG unchanged; APP0 to APP15 and COM dropped; SOS and scan copied verbatim; RST kept; truncated input throws                                                                                                                                                                                                                                             |
| `apps/media/src/previews/previews.test.ts`   | draw on a miss then serve fresh; the caller's own credentials, no access as missing; redraw after a change; empty items; one-tab links; stale on failure, 503 without; no door; public links asked each time; share image caching and tabs; unknown codes ask no app; one card per drawing and the brand card; the card's name; purge per app                                     |
| `apps/media/src/previews/share-card.test.ts` | fit wide and tall, aspect kept, upscale cap, nested viewBox, the drawing's paint, white fallback, prolog and size-only roots, null with no sized root                                                                                                                                                                                                                             |
| `packages/media/src/media.test.ts`           | every app site listed; SVG never accepted; sniffing; guest hashing; the client's headers and refusals                                                                                                                                                                                                                                                                             |
| `packages/media/src/previews.test.ts`        | the doors match the routers'; item paths keyed by version                                                                                                                                                                                                                                                                                                                         |
| `packages/media/src/share-page.test.ts`      | the share page head: name and card, budgets, fallbacks                                                                                                                                                                                                                                                                                                                            |
| `packages/media/src/usage.test.ts`           | the gallery's usage names, per app, bounded                                                                                                                                                                                                                                                                                                                                       |

## Constants and configuration

| Constant                                     | Value                                                | Where                              | Used by                   |
| -------------------------------------------- | ---------------------------------------------------- | ---------------------------------- | ------------------------- |
| `MEDIA_API_PATH`                             | `'/api/media'`                                       | `packages/media/src/wire.ts`       | routing                   |
| `PREVIEWS_API_PATH`                          | `'/api/previews'`                                    | `packages/media/src/previews.ts`   | routing                   |
| `MEDIA_APP_HEADER`                           | `'X-Media-App'`                                      | `wire.ts`                          | `callerApp`               |
| `IMAGE_WIDTH_HEADER` / `IMAGE_HEIGHT_HEADER` | `'X-Image-Width'` / `'X-Image-Height'`               | `wire.ts`                          | upload                    |
| `IMAGE_NAME_HEADER`                          | `'X-Image-Original-Name'`                            | `wire.ts`                          | upload                    |
| `IMAGE_SHA256_HEADER`                        | `'X-Image-Sha256'`                                   | `wire.ts`                          | upload shortcut           |
| `MEDIA_OWNER_HEADER`                         | `'X-Media-Owner'`                                    | `wire.ts`                          | bytes route               |
| `MAX_IMAGE_BYTES`                            | `10 * 1024 * 1024`                                   | `packages/media/src/limits.ts`     | upload                    |
| `ACCEPTED_IMAGE_TYPES`                       | png, jpeg, webp, gif                                 | `limits.ts`                        | upload                    |
| `ORIGINAL_NAME_MAX`                          | `200`                                                | `limits.ts`                        | `originalNameOf`          |
| `MEDIA_ID_MAX`                               | `200`                                                | `limits.ts`                        | every id                  |
| `MEDIA_REFS_SYNC_MAX`                        | `500`                                                | `limits.ts`                        | `parseRefsSync`           |
| `MEDIA_REFS_PER_DOCUMENT_MAX`                | `1000`                                               | `limits.ts`                        | `parseRefsSync`           |
| `MEDIA_GUEST_PREFIX`                         | `'guest:'`                                           | `owner.ts`                         | guest owners              |
| `MAX_JSON_BYTES`                             | `2 * 1024 * 1024`                                    | `apps/media/src/config.ts`         | `readJson`                |
| `UNUSED_IMAGE_AGE_MS`                        | `30 * 24 * 60 * 60 * 1000`                           | `config.ts`                        | the sweep                 |
| `SWEEP_PAGE`                                 | `1000`                                               | `config.ts`                        | the sweep                 |
| `SWEEP_TRIPWIRE_RATIO` / `_MIN`              | `0.5` / `20`                                         | `config.ts`                        | `sweepTripped`            |
| `INDEX_TIMEOUT_MS`                           | `5_000`                                              | `previews/access.ts`               | the index read            |
| `DOOR_TIMEOUT_MS`                            | `15_000`                                             | `previews/door.ts`                 | the export door           |
| `PREVIEW_ITEM_CACHE`                         | `'private, max-age=86400'`                           | `packages/media/src/previews.ts`   | item previews             |
| `PREVIEW_PUBLIC_ITEM_CACHE`                  | `'private, max-age=30'`                              | `previews.ts`                      | public-link item previews |
| `PREVIEW_DENIED_CACHE`                       | `'no-store'`                                         | `previews.ts`                      | denials                   |
| `SHARE_IMAGE_CACHE`                          | `'public, max-age=30, stale-while-revalidate=300'`   | `previews.ts`                      | live images               |
| `SHARE_CARD_CACHE`                           | `'public, max-age=300, stale-while-revalidate=3600'` | `previews.ts`                      | share cards               |
| `PUBLIC_LINK_CACHE`                          | `'public, max-age=30'`                               | `previews.ts`                      | public links' doors       |
| `BRAND_CARD_REDIRECT_CACHE`                  | `'public, max-age=300'`                              | `previews.ts`                      | the brand redirect        |
| `BRAND_CARD_PATH`                            | `'/opengraph-image'`                                 | `previews.ts`                      | the brand redirect        |
| `SHARE_CARD_WIDTH` / `_HEIGHT`               | `1200` / `630`                                       | `previews/share-card.ts`           | the card                  |
| `SHARE_CARD_MARGIN`                          | `48`                                                 | `share-card.ts`                    | the card                  |
| `SHARE_CARD_MAX_UPSCALE`                     | `2`                                                  | `share-card.ts`                    | the card                  |
| `SHARE_CARD_TIMEOUT_MS`                      | `1500`                                               | `packages/media/src/share-page.ts` | the apps' share page head |
| `GALLERY_USAGE_DOCUMENTS_MAX`                | `200`                                                | `packages/media/src/usage.ts`      | the apps' gallery         |
| `GALLERY_USAGE_READS_IN_FLIGHT`              | `8`                                                  | `usage.ts`                         | the apps' gallery         |

| Setting                     | Production                                                               | Staging                                                                  |
| --------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Name                        | `liveworkspace-media`                                                    | `liveworkspace-media-staging`                                            |
| Routes                      | `liveworkspace.app/api/media*`, `/api/previews*`                         | `staging.liveworkspace.app/api/media*`, `/api/previews*`                 |
| D1 `MEDIA_DB`               | `liveworkspace-media`                                                    | `liveworkspace-media-staging`                                            |
| R2 `MEDIA`                  | `liveworkspace-media`                                                    | `liveworkspace-media-staging`                                            |
| Service `INDEX`             | `liveworkspace-index`                                                    | `liveworkspace-index-staging`                                            |
| Cron                        | `41 3 * * *`                                                             | `41 3 * * *`                                                             |
| `IMAGE_MAX_PER_OWNER`       | `100`                                                                    | `100`                                                                    |
| `IMAGE_MAX_BYTES_PER_OWNER` | `104857600`                                                              | `104857600`                                                              |
| `INDEX_URL`                 | `https://liveworkspace.app/api/index`                                    | `https://staging.liveworkspace.app/api/index`                            |
| `APP_ORIGIN_LIVEDIAGRAM`    | `https://livediagram-router.liveworkspace-easing509.workers.dev`         | `https://livediagram-router-staging.liveworkspace-easing509.workers.dev` |
| `APP_ORIGIN_LIVEPLANNER`    | `https://liveplanner.app`                                                | `https://staging.liveplanner.app`                                        |
| `APP_ORIGIN_LIVEDOCUMENTS`  | `https://livedocuments.app`                                              | `https://staging.livedocuments.app`                                      |
| `APP_ORIGIN_LIVEDESIGN`     | `https://livedesign.app`                                                 | `https://staging.livedesign.app`                                         |
| Secrets                     | `MEDIA_KEY_LIVEDIAGRAM`, `_LIVEPLANNER`, `_LIVEDOCUMENTS`, `_LIVEDESIGN` | the same                                                                 |

`[[rules]]` bundles `.ttf` and `.otf` as data (the card renderer's fonts). Locally (`.dev.vars.example`):
`dev-<app>-media-key`, `INDEX_URL=http://localhost:8793/api/index`, the four app routers on 3100, 3200, 3300, 3400;
`wrangler dev --port 8792`. `MEDIA_ENABLED` is unset (on) everywhere.

## Assets and external resources

R2, D1, the `INDEX` binding, each app's export door, `@liveworkspace/render-png` (resvg wasm, loaded on first card),
Google Fonts referenced from drawn SVGs (allowed by the CSP).

## Defaults ledger

- `MED1`: the same bytes uploaded twice by one owner are one image, answered `deduped: true`.
- `MED2`: when the app can't draw a picture, a stale private picture is served before a `503`.
- `MED3`: the unused-image sweep pauses until every keyed app has reported its references.
