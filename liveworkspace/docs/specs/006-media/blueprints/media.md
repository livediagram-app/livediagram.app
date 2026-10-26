# Media and previews: blueprint

Derived from [media.md](../media.md) and [previews.md](../previews.md). The spec decides; this file only adds engineering precision, read from the code. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md). Paths are relative to the repository root.

## Domain and naming

| Term       | Identifier                                        | Meaning                                           |
| ---------- | ------------------------------------------------- | ------------------------------------------------- |
| Image      | `images` row and its R2 object                    | An uploaded picture, owned by whoever uploaded it |
| Owner      | an account id, or `mediaGuestOwner(app, guestId)` | Whose an image is                                 |
| Reference  | `refs` row                                        | A document that places an image                   |
| Preview    | an R2 object under the item                       | An item's picture, drawn by its app               |
| Share door | `/api/share/<code>/image.svg\|image.png\|card`    | A share link's public pictures                    |

## Behaviour and state

One cron, `41 3 * * *`, deletes images that nothing has placed for `UNUSED_IMAGE_AGE_MS`
(`sweepUnusedImages`); with `MEDIA_ENABLED` off it does nothing. Previews are purged with their item
([previews.md "Purging"](../previews.md#purging)), not by the cron.

## Interfaces and contracts

Every media route is under `/api/media/app`, for an app's Worker only, naming the app in `X-Media-App` with
`MEDIA_KEY_<APP>`. Previews are public under `/api/previews`, and each router forwards them and the share doors.

Every route the specs name, with the section that defines it (each checked to have its path's literal in the code):

| Route                                    | Specified in                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/images/<id>?d=`                | [media.md "What lives where"](../../006-media/media.md#what-lives-where)                                                  |
| `POST /app/owners/merge`                 | [media.md "Owners"](../../006-media/media.md#owners)                                                                      |
| `DELETE /app/owners/<owner>`             | [media.md "Owners"](../../006-media/media.md#owners)                                                                      |
| `GET /images?owner=`                     | [media.md "The API"](../../006-media/media.md#the-api)                                                                    |
| `POST /images?owner=`                    | [media.md "The API"](../../006-media/media.md#the-api)                                                                    |
| `GET /images/<id>`                       | [media.md "The API"](../../006-media/media.md#the-api)                                                                    |
| `GET /images/<id>/bytes`                 | [media.md "The API"](../../006-media/media.md#the-api)                                                                    |
| `DELETE /images/<id>?owner=`             | [media.md "The API"](../../006-media/media.md#the-api)                                                                    |
| `GET /usage?owner=`                      | [media.md "The API"](../../006-media/media.md#the-api)                                                                    |
| `POST /refs`                             | [media.md "The API"](../../006-media/media.md#the-api)                                                                    |
| `POST /owners/merge`                     | [media.md "The API"](../../006-media/media.md#the-api)                                                                    |
| `DELETE /owners/<owner>`                 | [media.md "The API"](../../006-media/media.md#the-api)                                                                    |
| `POST /app/refs`                         | [media.md "References"](../../006-media/media.md#references)                                                              |
| `GET /usage`                             | [media.md "Usage"](../../006-media/media.md#usage)                                                                        |
| `GET /api/images/usage`                  | [media.md "Usage"](../../006-media/media.md#usage)                                                                        |
| `GET /items/:id`                         | [previews.md "`GET /api/previews/items/:id?v=<updatedAt>`"](../../006-media/previews.md#get-apipreviewsitemsidvupdatedat) |
| `PUT /app/items/:id/summary`             | [previews.md "Staleness: the index's `updatedAt`"](../../006-media/previews.md#staleness-the-indexs-updatedat)            |
| `DELETE /api/media/app/previews/:itemId` | [previews.md "Purging"](../../006-media/previews.md#purging)                                                              |

## Security and trust

A browser never calls `/api/media`; its app checks access and fetches the bytes. Uploads are sniffed and EXIF is
stripped (`@liveworkspace/media`). Per-owner caps are `IMAGE_MAX_PER_OWNER` and `IMAGE_MAX_BYTES_PER_OWNER`. Secrets are set once per Worker and environment with `wrangler secret put` and survive every deploy; the
`Env fields` line under the Worker's configuration below lists every name the Worker reads, vars and secrets
together (a name not in a `[vars]` table is a secret). App keys are compared in constant time, and each key speaks
only for its own app.

## Performance and limits

A reference report takes at most 500 documents. The costs are in [previews.md "Cost and performance"](../previews.md#cost-and-performance).

## Observability

Every log line the service writes, by its fingerprint (the first literal of the call; `…` marks an interpolation):

| Level   | Fingerprint                                        | Where          |
| ------- | -------------------------------------------------- | -------------- |
| `error` | `[media] R2 delete failed after the row went`      | `routes.ts`    |
| `error` | `[media] R2 delete failed for a deleted owner`     | `routes.ts`    |
| `log`   | `[media] deleted`                                  | `routes.ts`    |
| `log`   | `[media] forgot an owner`                          | `routes.ts`    |
| `log`   | `[media] merged a guest`                           | `routes.ts`    |
| `log`   | `[media] stored`                                   | `routes.ts`    |
| `log`   | `[media] sweep paused: not every app has reported` | `retention.ts` |
| `error` | `[media] sweep tripwire: … of … old i`             | `retention.ts` |
| `error` | `[media] sweep: R2 delete failed`                  | `retention.ts` |
| `log`   | `[media] sweep: deleted … images older th`         | `index.ts`     |
| `warn`  | `[previews] card write failed`                     | `routes.ts`    |
| `warn`  | `[previews] export door failed`                    | `store.ts`     |
| `warn`  | `[previews] index unreachable`                     | `access.ts`    |
| `warn`  | `[previews] share card failed`                     | `routes.ts`    |
| `warn`  | `[previews] write failed`                          | `store.ts`     |

## Files

| File                                                      | Role                                                                                                                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/media/src/config.ts`                  | The Worker's settings                                                                                                                                                                       |
| `liveworkspace/apps/media/src/env.ts`                     |                                                                                                                                                                                             |
| `liveworkspace/apps/media/src/http.ts`                    | Responses for the media API (liveworkspace/docs/specs/006-media/media.md "The API")                                                                                                         |
| `liveworkspace/apps/media/src/images.ts`                  | The images index (liveworkspace/docs/specs/006-media/media.md "Storage"): one row per stored image, its bytes in R2 under the same id.                                                      |
| `liveworkspace/apps/media/src/index.ts`                   | liveworkspace's media service (liveworkspace/docs/specs/006-media/media.md): one Worker holding every app's uploaded images, on liveworkspace.app/api/media, so a person's pictures follow… |
| `liveworkspace/apps/media/src/jpeg-strip.ts`              | JPEG metadata stripper                                                                                                                                                                      |
| `liveworkspace/apps/media/src/previews/access.ts`         | Who may see a preview (liveworkspace/docs/specs/006-media/previews.md): the index decides, with the same rule it applies to the item itself                                                 |
| `liveworkspace/apps/media/src/previews/door.ts`           | The app's export door (liveworkspace/docs/specs/006-media/previews.md "The export door"): the only place an item is drawn                                                                   |
| `liveworkspace/apps/media/src/previews/routes.ts`         | /api/previews (liveworkspace/docs/specs/006-media/previews.md "The addresses"): every app's item pictures, for browsers, on liveworkspace.app and (forwarded by each app's router) on ever… |
| `liveworkspace/apps/media/src/previews/share-card-png.ts` | The share card as a PNG (liveworkspace/docs/specs/006-media/previews.md): link previews draw rasters only, so the card's SVG (./share-card.ts) goes through the shared resvg renderer       |
| `liveworkspace/apps/media/src/previews/share-card.ts`     | The share card (liveworkspace/docs/specs/006-media/previews.md): a link's live-image drawing fitted onto the 1200 x 630 frame every link preview (Slack, Teams, Discord, iMessage, X, Link… |
| `liveworkspace/apps/media/src/previews/store.ts`          | Where previews are kept and when they are fresh (liveworkspace/docs/specs/006-media/previews.md "Storage", "Staleness")                                                                     |
| `liveworkspace/apps/media/src/refs.ts`                    | The references (liveworkspace/docs/specs/006-media/media.md "References"): which images each app's documents place, as each app last reported                                               |
| `liveworkspace/apps/media/src/retention.ts`               | The daily unused-image sweep (liveworkspace/docs/specs/006-media/media.md "Retention")                                                                                                      |
| `liveworkspace/apps/media/src/routes.ts`                  | The media API (`/api/media/app/*`, liveworkspace/docs/specs/006-media/media.md "The API"): what an app's own Worker does with the pictures of the people it has signed in                   |
| `packages/media/src/apps.ts`                              | The apps that keep their pictures in liveworkspace's media service (liveworkspace/docs/specs/006-media/media.md).                                                                           |
| `packages/media/src/client.ts`                            | The media service as an app's Worker calls it (liveworkspace/docs/specs/006-media/media.md "Using it from an app"): one typed method per route, each carrying the app's name and key        |
| `packages/media/src/index.ts`                             | The media service's shared contract (liveworkspace/docs/specs/006-media/media.md): the apps, what an upload may be, whose an image is, the wire shapes, a typed client for the apps' Worke… |
| `packages/media/src/limits.ts`                            | What an upload may be (liveworkspace/docs/specs/006-media/media.md "Uploads")                                                                                                               |
| `packages/media/src/owner.ts`                             | Who an image belongs to (liveworkspace/docs/specs/006-media/media.md "Owners"): the person who uploaded it                                                                                  |
| `packages/media/src/previews.ts`                          | Previews (liveworkspace/docs/specs/006-media/previews.md): every app's item pictures, served once by liveworkspace's media service under /api/previews                                      |
| `packages/media/src/share-page.ts`                        | A share link's page head (liveworkspace/docs/specs/006-media/previews.md "The share page's head"), the same in every app                                                                    |
| `packages/media/src/sniff.ts`                             | Magic-number sniffing for the accepted formats (liveworkspace/docs/specs/006-media/media.md "Uploads")                                                                                      |
| `packages/media/src/usage.ts`                             | The Image Gallery's "Used in" map (liveworkspace/docs/specs/006-media/media.md "Usage"), as every app's api answers `GET /api/images/usage`                                                 |
| `packages/media/src/wire.ts`                              | How the apps' Workers talk to liveworkspace's media service (liveworkspace/docs/specs/006-media/media.md "The API"): where it lives, the headers it reads, and the shapes it takes and giv… |

## Constants and configuration: the Worker

`liveworkspace/apps/media/wrangler.toml`, account `851be7d244b76a6557bcbe6c4ded80f5`, main `src/index.ts`, compatibility date `2026-05-29`.

**Production**

| Setting                         | Value                                                            |
| ------------------------------- | ---------------------------------------------------------------- |
| Worker name                     | `liveworkspace-media`                                            |
| Route                           | `liveworkspace.app/api/media*`                                   |
| Route                           | `liveworkspace.app/api/previews*`                                |
| D1 `MEDIA_DB`                   | `liveworkspace-media`, migrations `migrations`                   |
| R2 `MEDIA`                      | `liveworkspace-media`                                            |
| Service `INDEX`                 | `liveworkspace-index`                                            |
| Crons                           | `41 3 * * *`                                                     |
| Var `IMAGE_MAX_PER_OWNER`       | `100`                                                            |
| Var `IMAGE_MAX_BYTES_PER_OWNER` | `104857600`                                                      |
| Var `INDEX_URL`                 | `https://liveworkspace.app/api/index`                            |
| Var `APP_ORIGIN_LIVEDIAGRAM`    | `https://livediagram-router.liveworkspace-easing509.workers.dev` |
| Var `APP_ORIGIN_LIVEPLANNER`    | `https://liveplanner.app`                                        |
| Var `APP_ORIGIN_LIVEDOCUMENTS`  | `https://livedocuments.app`                                      |
| Var `APP_ORIGIN_LIVEDESIGN`     | `https://livedesign.app`                                         |

**`env.staging`**

| Setting                         | Value                                                                    |
| ------------------------------- | ------------------------------------------------------------------------ |
| Worker name                     | `liveworkspace-media-staging`                                            |
| Route                           | `staging.liveworkspace.app/api/media*`                                   |
| Route                           | `staging.liveworkspace.app/api/previews*`                                |
| D1 `MEDIA_DB`                   | `liveworkspace-media-staging`, migrations `migrations`                   |
| R2 `MEDIA`                      | `liveworkspace-media-staging`                                            |
| Service `INDEX`                 | `liveworkspace-index-staging`                                            |
| Crons                           | `41 3 * * *`                                                             |
| Var `IMAGE_MAX_PER_OWNER`       | `100`                                                                    |
| Var `IMAGE_MAX_BYTES_PER_OWNER` | `104857600`                                                              |
| Var `INDEX_URL`                 | `https://staging.liveworkspace.app/api/index`                            |
| Var `APP_ORIGIN_LIVEDIAGRAM`    | `https://livediagram-router-staging.liveworkspace-easing509.workers.dev` |
| Var `APP_ORIGIN_LIVEPLANNER`    | `https://staging.liveplanner.app`                                        |
| Var `APP_ORIGIN_LIVEDOCUMENTS`  | `https://staging.livedocuments.app`                                      |
| Var `APP_ORIGIN_LIVEDESIGN`     | `https://staging.livedesign.app`                                         |

Env fields (`env.ts`): `APP_ORIGIN_LIVEDESIGN`, `APP_ORIGIN_LIVEDIAGRAM`, `APP_ORIGIN_LIVEDOCUMENTS`, `APP_ORIGIN_LIVEPLANNER`, `IMAGE_MAX_BYTES_PER_OWNER`, `IMAGE_MAX_PER_OWNER`, `INDEX_URL`, `MEDIA_ENABLED`, `MEDIA_KEY_LIVEDESIGN`, `MEDIA_KEY_LIVEDIAGRAM`, `MEDIA_KEY_LIVEDOCUMENTS`, `MEDIA_KEY_LIVEPLANNER`.

## Data and persistence

Migrations, in order:

- `0001_media.sql`

| Table      | Columns                                                                                                       | Created in       |
| ---------- | ------------------------------------------------------------------------------------------------------------- | ---------------- |
| `images`   | `id`, `owner`, `app`, `content_type`, `byte_size`, `width`, `height`, `sha256`, `original_name`, `created_at` | `0001_media.sql` |
| `ref_sync` | `app`, `completed_at`                                                                                         | `0001_media.sql` |
| `refs`     | `app`, `document`, `image_id`                                                                                 | `0001_media.sql` |

## Constants and configuration: named constants

| Constant                        | Value                                                             | File            |
| ------------------------------- | ----------------------------------------------------------------- | --------------- |
| `API_PATH`                      | `MEDIA_API_PATH`                                                  | `config.ts`     |
| `PREVIEWS_PATH`                 | `PREVIEWS_API_PATH`                                               | `config.ts`     |
| `MAX_JSON_BYTES`                | `2 * 1024 * 1024`                                                 | `config.ts`     |
| `UNUSED_IMAGE_AGE_MS`           | `30 * 24 * 60 * 60 * 1000`                                        | `config.ts`     |
| `SWEEP_PAGE`                    | `1000`                                                            | `config.ts`     |
| `SWEEP_TRIPWIRE_RATIO`          | `0.5`                                                             | `config.ts`     |
| `SWEEP_TRIPWIRE_MIN`            | `20`                                                              | `config.ts`     |
| `DOOR_TIMEOUT_MS`               | `15_000`                                                          | `door.ts`       |
| `SHARE_CARD_WIDTH`              | `1200`                                                            | `share-card.ts` |
| `SHARE_CARD_HEIGHT`             | `630`                                                             | `share-card.ts` |
| `SHARE_CARD_MARGIN`             | `48`                                                              | `share-card.ts` |
| `SHARE_CARD_MAX_UPSCALE`        | `2`                                                               | `share-card.ts` |
| `PREVIEWS_PREFIX`               | `'previews/'`                                                     | `store.ts`      |
| `MEDIA_APPS`                    | `(object or list, see file)`                                      | `apps.ts`       |
| `MAX_IMAGE_BYTES`               | `10 * 1024 * 1024`                                                | `limits.ts`     |
| `MAX_IMAGE_MB`                  | `MAX_IMAGE_BYTES / (1024 * 1024)`                                 | `limits.ts`     |
| `ACCEPTED_IMAGE_TYPES`          | `['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const` | `limits.ts`     |
| `ORIGINAL_NAME_MAX`             | `200`                                                             | `limits.ts`     |
| `MEDIA_ID_MAX`                  | `200`                                                             | `limits.ts`     |
| `MEDIA_REFS_SYNC_MAX`           | `500`                                                             | `limits.ts`     |
| `MEDIA_REFS_PER_DOCUMENT_MAX`   | `1000`                                                            | `limits.ts`     |
| `MEDIA_GUEST_PREFIX`            | `'guest:'`                                                        | `owner.ts`      |
| `PREVIEWS_API_PATH`             | `'/api/previews'`                                                 | `previews.ts`   |
| `SHARE_PREVIEW_DOORS`           | `['image.svg', 'image.png', 'card'] as const`                     | `previews.ts`   |
| `PREVIEW_ITEM_CACHE`            | `'private, max-age=86400'`                                        | `previews.ts`   |
| `PREVIEW_PUBLIC_ITEM_CACHE`     | `'private, max-age=30'`                                           | `previews.ts`   |
| `PREVIEW_DENIED_CACHE`          | `'no-store'`                                                      | `previews.ts`   |
| `SHARE_IMAGE_CACHE`             | `'public, max-age=30, stale-while-revalidate=300'`                | `previews.ts`   |
| `SHARE_CARD_CACHE`              | `'public, max-age=300, stale-while-revalidate=3600'`              | `previews.ts`   |
| `PUBLIC_LINK_CACHE`             | `'public, max-age=30'`                                            | `previews.ts`   |
| `BRAND_CARD_REDIRECT_CACHE`     | `'public, max-age=300'`                                           | `previews.ts`   |
| `BRAND_CARD_PATH`               | `'/opengraph-image'`                                              | `previews.ts`   |
| `SHARE_CARD_TIMEOUT_MS`         | `1500`                                                            | `share-page.ts` |
| `GALLERY_USAGE_DOCUMENTS_MAX`   | `200`                                                             | `usage.ts`      |
| `GALLERY_USAGE_READS_IN_FLIGHT` | `8`                                                               | `usage.ts`      |
| `MEDIA_API_PATH`                | `'/api/media'`                                                    | `wire.ts`       |
| `MEDIA_API_URL`                 | `https://liveworkspace.app${MEDIA_API_PATH}`                      | `wire.ts`       |
| `MEDIA_APP_HEADER`              | `'X-Media-App'`                                                   | `wire.ts`       |
| `IMAGE_WIDTH_HEADER`            | `'X-Image-Width'`                                                 | `wire.ts`       |
| `IMAGE_HEIGHT_HEADER`           | `'X-Image-Height'`                                                | `wire.ts`       |
| `IMAGE_NAME_HEADER`             | `'X-Image-Original-Name'`                                         | `wire.ts`       |
| `IMAGE_SHA256_HEADER`           | `'X-Image-Sha256'`                                                | `wire.ts`       |
| `MEDIA_OWNER_HEADER`            | `'X-Media-Owner'`                                                 | `wire.ts`       |

## Testing

9 test files:

- `liveworkspace/apps/media/src/index.test.ts`
- `liveworkspace/apps/media/src/jpeg-strip.test.ts`
- `liveworkspace/apps/media/src/previews/previews.test.ts`
- `liveworkspace/apps/media/src/previews/share-card.test.ts`
- `liveworkspace/apps/media/src/retention.test.ts`
- `packages/media/src/media.test.ts`
- `packages/media/src/previews.test.ts`
- `packages/media/src/share-page.test.ts`
- `packages/media/src/usage.test.ts`
