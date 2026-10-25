# Media

Every liveworkspace app keeps the images people upload in one service, whose API is
**liveworkspace.app/api/media**. The images are indexed in its own D1 database and stored in its own R2
bucket. Because a signed-in person is the same liveworkspace account in every app, their gallery
follows them: a picture uploaded in livediagram can be placed in livedocuments or livedesign without
uploading it again.

```
packages/media               @liveworkspace/media: apps, upload limits, sniffing, guest owners, wire shapes, a client
liveworkspace/apps/media     the API Worker (@liveworkspace/media-service) and its D1 migrations
```

The service starts empty. Nothing was carried over from the apps' own image buckets.

## What lives where

The service holds the **pictures**; each app holds the **documents** and decides who sees what.

| The service (liveworkspace)                                  | The app                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------- |
| The bytes, in R2, and one row per image                      | The documents, their tabs, and which images each tab places          |
| Whose each image is: the person who uploaded it              | Who may read a document: its owner, team, share links, tab scope     |
| Dedupe, the per-person caps, EXIF stripping, the type checks | Placement grants: which documents may serve another person's picture |
| Which documents, in which apps, place each image             | Reporting those references to the service                            |
| The daily sweep of images nothing places                     | Serving the bytes to the people it lets in                           |
| Moving a guest's images to their account on sign-up          | Telling the service when a guest signs up or an account is deleted   |

A browser never calls the service. It asks its app, the way it always has (`GET /api/images/<id>?d=`
on livediagram), and the app checks access exactly as before: the image's owner reads it directly;
anyone else needs to be able to read a document that places it, and that document must be allowed to
serve it (its owner owns the image, or it holds a placement grant). Only then does the app fetch the
bytes from the service and send them on, with its own `Cache-Control: private`.

## Owners

An image belongs to the person who uploaded it, whichever app they were in.

- **A signed-in person** is their liveworkspace account id, the same in every app.
- **A guest** has no account, and their app's guest id is their credential, so it never leaves the app.
  The app sends `mediaGuestOwner(app, guestId)` instead: `guest:` and a SHA-256 of the app and the guest
  id. A guest's images therefore stay in the app they were added in.
- **Signing up** moves a guest's images to the account (`POST /app/owners/merge`), except an image whose
  bytes the account already holds, which stays on the guest so every reference to its id keeps working.
- **Deleting an account** deletes every image it uploaded, in every app (`DELETE /app/owners/<owner>`).

## The API

Every route is under `/api/media/app` and is for an app's own Worker, never a browser. Each request names
the app in `X-Media-App` and carries that app's key as `Authorization: Bearer <key>`, checked in constant
time; a key speaks only for its own app. Answers are JSON except the bytes; errors are `{ "error" }`.
`@liveworkspace/media`'s `createMediaClient` wraps each route.

| Route                        | What it does                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `GET /images?owner=`         | The owner's gallery from every app, newest first: `{ images: MediaImage[] }`        |
| `POST /images?owner=`        | Upload (below): `{ image, deduped }`                                                |
| `GET /images/<id>`           | The image and whose it is: `{ image, owner }`                                       |
| `GET /images/<id>/bytes`     | The bytes, with their `Content-Type` and the owner in `X-Media-Owner`               |
| `DELETE /images/<id>?owner=` | Its owner deletes it, row then bytes. Documents that place it show a broken picture |
| `GET /usage?owner=`          | Which documents, in which apps, place each of the owner's images: `{ usage }`       |
| `POST /refs`                 | `{ documents: [{ document, images }], complete? }`, at most 500 documents (below)   |
| `POST /owners/merge`         | `{ from, to }`: a guest signed up. `{ moved, kept }`                                |
| `DELETE /owners/<owner>`     | An account deleted: every image it uploaded goes. `{ deleted }`                     |

`MediaImage` is `{ id, contentType, byteSize, width, height, originalName?, createdAt, app }`, `app` being
where it was uploaded. The owner and the hash never appear in it. The bytes route names the owner in a
header so an app can apply its "the image's owner owns this document" rule from the one request.

Any app may read any image's bytes: reuse across the suite depends on it, and each app guards its own
doors. Without a bucket every route answers `503 { error: "media_unavailable" }`; with `MEDIA_ENABLED`
set to `false`, `0` or `off`, every route answers 404.

## Uploads

The body is the file's raw bytes. Headers: `Content-Type`, `Content-Length`, `X-Image-Width`,
`X-Image-Height`, optionally `X-Image-Original-Name` (percent-encoded, cut to 200 characters) and
`X-Image-Sha256`. The service refuses, cheapest first:

1. A declared type not in `ACCEPTED_IMAGE_TYPES` (PNG, JPEG, WebP, GIF; never SVG): `415 unsupported_type`
   with `acceptedTypes`.
2. A missing length (`400 missing_length`), or one over 10 MB (`413 file_too_large` with `limitBytes`).
3. A known `X-Image-Sha256` answers with the owner's existing image without reading the body. An app
   sends this header only for the owner's own editor or a guest: for an API token or a workbench session
   a bare hash would let them probe the gallery, so they upload the body and still dedupe on its real
   hash.
4. A full gallery: `403 gallery_full` with `reason` (`count` or `bytes`), `limit` and `current`. The caps
   are per person across every app (`IMAGE_MAX_PER_OWNER`, `IMAGE_MAX_BYTES_PER_OWNER`; 100 images and
   100 MB in production and staging).
5. Missing or invalid dimensions: `400 invalid_dimensions`.
6. Bytes whose first bytes aren't the declared format: `415 unsupported_type`. The declared type is never
   trusted alone.

The same owner uploading the same bytes, in any app, gets the one image back (`deduped: true`), keyed on
the hash of the file as picked. A JPEG loses its APPn and comment segments (Exif GPS, camera serial, ICC)
before it is stored, without re-encoding; a malformed one is refused (`415 malformed_jpeg`) rather than
stored with what it should have lost. The row's insert repeats both caps inside the statement, so
uploads racing each other can't together pass one; a refused insert deletes the bytes it just wrote and
answers `gallery_full`, or `409 upload_conflict` when there is room again by then.

## References

Each app reports which images its documents place, so the service can tell an image no app places any
more. `POST /app/refs` replaces each listed document's set; an empty list means it places none or is
gone. The app's own index stays the source of truth (on livediagram, `image_refs` through
`document_tabs`); the service's `refs` table is a copy of it per app and document, with no foreign key
to the images, so a reference to a deleted image is harmless.

`complete: true` says the app has now sent every document it holds at least once. Until every app with
a key has said so, the sweep deletes nothing: an app that hasn't reported reads as placing nothing.

### Usage

An image is **used** when any app's document places it, as the apps last reported. The Explorer's Image
Gallery lists the owner's images from every app, so its "Used in" badge counts every app's documents too:
an image uploaded in livediagram and placed only in a livedocuments document reads "Used in 1 item" in any
app's Gallery, never "Not used". `GET /usage` answers every app's references; each app's
`GET /api/images/usage` names them through the index (one index holds every app's items) with
`@liveworkspace/media`'s `galleryUsage`, as `{ id, name, app }`, keeping its own rule on whose and which
items show (at most 200 named per answer). An item saved only in This Browser has no references: its
pictures are embedded in it, not placed from the gallery, so it never makes a gallery image used.

A document reports its set from its outbox on idle, at most once a minute, so an image placed a moment
ago can read "Not used" until that push lands. The Gallery reads the usage each time it opens.

## Retention

Once a day (03:41 UTC) the service deletes the images that are **older than 30 days** and **placed by no
document in any app**. It keeps bytes whenever in doubt:

- It waits until every app with a key has reported complete (above).
- **Tripwire.** When over half of the old images, and more than 20, look unplaced, the run deletes at
  most one page of 1000, oldest first, and logs `[media] sweep tripwire` as an error. A gap in the
  references looks exactly like that.
- Each page is deleted by a statement that re-checks the references at that instant, rows first, then
  the bytes. A failed R2 delete leaves bytes with no row (storage kept, never a broken picture).

## Configuring an app

| Where      | Setting                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| api Worker | `MEDIA_URL` var (default `https://liveworkspace.app/api/media`), `MEDIA_KEY` secret                   |
| Service    | `MEDIA_KEY_<APP>` secret, the same value: `LIVEDIAGRAM`, `LIVEPLANNER`, `LIVEDOCUMENTS`, `LIVEDESIGN` |

An app without a key can't use the service, and the sweep doesn't wait for it. The same key lets the service ask
the app's export door for a drawing: every app's previews (Explorer thumbnails, live images, share cards) live here
too, under `previews/` in the same bucket ([previews.md](previews.md)), so no app keeps a bucket of pictures.

## Running it locally

```sh
cd liveworkspace/apps/media
cp .dev.vars.example .dev.vars
corepack pnpm db:migrate:local
corepack pnpm dev                     # the API, http://localhost:8792/api/media
```

`corepack pnpm dev:workspace` from the repo root runs it with the other liveworkspace APIs, and
`corepack pnpm dev:media` runs it alone. Point an app's api at it with
`MEDIA_URL=http://localhost:8792/api/media` and `MEDIA_KEY=dev-<app>-media-key` in its `.dev.vars`.

## Deploys

Production `liveworkspace-media` and staging `liveworkspace-media-staging`, on the liveworkspace
Cloudflare account. Each has its own D1 database (`liveworkspace-media`, `liveworkspace-media-staging`)
and R2 bucket of the same name, both in `wrangler.toml`. Apply migrations with
`corepack pnpm db:migrate:remote` (add `--env staging` for staging), then `wrangler deploy`. Give each app
a key with `wrangler secret put MEDIA_KEY_<APP>` (and `--env staging`), and the app's api Worker the same
value as `MEDIA_KEY`.
