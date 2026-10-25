# Images: blueprint

Derived from [Image element + per-owner gallery](../images.md). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                    | Role                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/document/src/element-types.ts`                | `ImageElement`                                                          |
| `packages/document/src/factories.ts`                    | `createImage`: the 200×150 placeholder, `aspectLocked: true`            |
| `packages/document/src/validate.ts`                     | Structural check of an image element in a tab body                      |
| `packages/document/src/svg-render-describe.ts`          | `describeBoxedExport`: image `ExportShape` with `href` / fit / radius   |
| `packages/document/src/svg-render.ts`                   | Image branch: `svgImageShape`, else the dashed placeholder rect         |
| `packages/document/src/svg-render-image-icon.ts`        | `svgImageShape`: clipped `<image>` over a white backing rect            |
| `../packages/api-schema/src/image-limits.ts`            | `MAX_IMAGE_BYTES`, `ACCEPTED_IMAGE_TYPES` for the editor's own gate     |
| `../packages/api-schema/src/image-sniff.ts`             | `sniffImageType`: labels embedded bytes whose stored type is missing    |
| `packages/api-schema/src/embed-images.ts`               | `embedTabImages`, `tabImageIds`: server-side data-URL inlining          |
| `../packages/api-schema/src/sha256.ts`                  | `sha256Hex`, shared by editor and worker                                |
| `packages/api-schema/src/index.ts`                      | `ImageSummary`                                                          |
| `packages/media` (`@liveworkspace/media`)               | Limits, sniffing, guest owners, wire shapes, `createMediaClient`        |
| `liveworkspace/apps/media`                              | The media service: bytes, gallery rows, dedupe, caps, JPEG strip, sweep |
| `../liveworkspace/apps/media/migrations/0001_media.sql` | The media service's `images`, `refs` and `ref_sync`                     |
| `apps/api/src/media.ts`                                 | The service client, owner naming, the per-isolate owner memo            |
| `apps/api/src/routes/images.ts`                         | `handleImages`: the five `/api/images*` routes; `originalNameOf`        |
| `apps/api/src/routes/images.ts`                         | `usageOf`: `GET /api/images/usage`                                      |
| `apps/api/src/db/image-grants.ts`                       | `documentMayServeImage`, `servableImageIds`, in the document's SQLite   |
| `apps/api/src/index.ts`                                 | Pre-dispatch size gate, write limiter                                   |
| `apps/api/src/document-room/document-outbox.ts`         | Sends a document's image set to the service as it changes               |
| `apps/api/src/thumbnail.ts`                             | `loadEmbeddedImages` for the drawing the export door gives the previews |
| `apps/api/wrangler.toml`                                | `MEDIA_KEY` note (no bucket of its own)                                 |
| `apps/api/hosted-vars.json`                             | Hosted livediagram.app's `MEDIA_URL` per environment                    |
| `apps/editor/lib/api/images.ts`                         | `apiListImages`, `apiUploadImage`, `apiDeleteImage`, `apiImageUsage`, … |
| `apps/editor/lib/upload-image.ts`                       | `uploadImageFile`, `addImageFileForDocument`, `ImageUploadError`        |
| `apps/editor/hooks/canvas/useEditorImages.ts`           | Picker state, attach, detach, place-from-gallery                        |
| `apps/editor/hooks/canvas/useClipboard.ts`              | `pasteImageFile`: Cmd/Ctrl+V image paste                                |
| `apps/editor/hooks/persistence/useImageBlobUrl.ts`      | Authenticated fetch to a revocable blob URL                             |
| `apps/editor/components/canvas/ImageElementView.tsx`    | Canvas face: placeholder, loading, broken, bitmap                       |
| `apps/editor/components/canvas/ImageEmptyFace.tsx`      | Empty placeholder: empty state + Select Image button                    |
| `apps/editor/components/panels/ImagePicker.tsx`         | Upload / Gallery modal, lazy via `EditorElementDialogs.tsx`             |
| `apps/editor/components/canvas/ImageDropZone.tsx`       | Drop, paste, file-input zone shared with the Explorer gallery           |
| `apps/editor/lib/export-tab-images.ts`                  | `loadTabImages`: client export prefetch                                 |
| `apps/editor/components/palette/palette-tile-defs.tsx`  | `tools:image` tile (`needsImage: true`, shortcut `9`)                   |
| `apps/editor/app/document/[id]/useElementCreation.ts`   | `addImage`: arms the draw gesture                                       |
| `apps/editor/hooks/canvas/useShapeDrawing.ts`           | Commit of the draw: telemetry, selects the placeholder (no picker)      |

Out of this blueprint, cited where they touch images: the reference index and the retention sweep
([Image reference index](image-reference-index.md)), Offline Mode data-URI embedding
(`apps/editor/lib/offline/offline-images.ts`, [Offline Mode](../../006-document/offline-mode.md)), the
import pipeline (`apps/editor/lib/import-images/`,
[Import image pipeline](../../020-import-export/import-image-pipeline.md)), the Explorer gallery
(`../packages/explorer/src/library/GalleryPane.tsx`, [Folders](../../013-workspace/folders.md)),
account deletion and the guest merge (`apps/api/src/db/account.ts`,
[Owner-keyed data](../../015-api/api.md#owner-keyed-data)), the Trash
([Trash](../../013-workspace/trash.md)), and the mcp embedder (`apps/mcp/src/image-result.ts`).

## Domain and naming

| Term             | Identifier                                 | Meaning                                                                                |
| ---------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| Image element    | `ImageElement` (`type: 'image'`)           | Boxed element that shows one bitmap                                                    |
| Image id         | `ImageElement.imageId: string \| null`     | The media service's image id; a `data:` URI offline; null = empty                      |
| Placeholder      | `imageId === null`                         | The empty, dashed state awaiting a pick                                                |
| Media service    | `mediaClient(env)` (`MediaClient`)         | liveworkspace's image store; null without `MEDIA_KEY`                                  |
| Media owner      | `mediaOwner(owner)`                        | The owner as the service knows them: an account id as is, a guest as `mediaGuestOwner` |
| Gallery          | `media.list(mediaOwner(owner))`            | Every image one owner has uploaded, in any app                                         |
| Image summary    | `ImageSummary` (`imageSummary`)            | Wire DTO of one gallery row; the service's `app` dropped                               |
| Owner memo       | `mediaImageOwner`, `image_owners`          | Whose each image is, as the service answered; `''` = unknown to the service            |
| Dedupe key       | `(owner, sha256)` in the service           | SHA-256 of the uploaded (pre-strip) bytes, per owner, across apps                      |
| Caps             | `IMAGE_MAX_PER_OWNER`, `IMAGE_MAX_BYTES_…` | The service's per-person count and byte ceilings, across apps                          |
| Metadata strip   | `stripJpegMetadata` (service)              | Byte-level removal of APPn and COM segments from a JPEG                                |
| Reference        | row of `image_refs` naming the id          | A tab places the image; see the index blueprint                                        |
| Retention sweep  | the service's sweep                        | Daily reaping of images no document in any app places                                  |
| Embed budget     | `IMAGE_EMBED_BUDGET_BYTES`                 | Raw bytes one server-side snapshot may inline                                          |
| Export image map | `ExportImageMap`                           | `imageId → { href, image }` prefetched for a client export                             |
| Images available | `mediaClient(env) !== null`                | The deployment has `MEDIA_KEY`                                                         |

Banned synonyms: "asset", "upload" as a noun for the stored row (say image), "photo" in code, "GC"
(say retention sweep), "thumbnail" for a gallery tile (thumbnail is the document snapshot).

## Behaviour and state

### Element lifecycle

States of one element: **placeholder** (`imageId === null`) → **attached** (`imageId` set) →
**placeholder** again on detach. Rendering adds the transient states of `useImageBlobUrl`:
`idle` (no id), `loading`, `ready`, `broken`. The blob URL is revoked on unmount and on an `imageId`
change (D46).

1. **Create.** `addImage` arms `beginDraw({ type: 'image' })` unless `editsBlocked` or
   `imagesBlocked` (embed mode, D42). A tap drops `createImage` (200×150, D49); a drag sizes
   it. `commitDraw` tracks `track('Element', 'Added', 'Image')` and calls
   `openImagePickerFor(id)`. Shortcut `9` does the same while `onAddImage` is supplied.
2. **Attach.** `applyImageToElement(id, image)` commits `imageId`, `naturalWidth`,
   `naturalHeight` and `alt: el.alt ?? image.originalName` (D41), then closes the picker.
3. **Detach.** "Remove from element" calls `removeImageFromElement(id)`: `imageId: null`,
   `naturalWidth` / `naturalHeight` dropped, width and height kept. The gallery row is untouched.
4. **Place from gallery or paste.** `addImageFromGallery` drops a new element at the viewport
   centre, 240 px on its longer side (D40), pre-attached, selected, tracked `Added / Image`.
   `pasteImageFile` uploads first (renaming a nameless or `image.png` paste to
   `pasted-<ms>.<ext>`, D43), then places.
5. **Resize.** Constrained when `aspectLocked === true` or Shift is held; the ratio held is the
   box's ratio at drag start (`resolveBoxedResize` in `boxed-drag-resolve.ts`). `[QB2]`
6. **Reset to natural size.** A context-menu action sets width and height to `naturalWidth` /
   `naturalHeight` about the element's centre, disabled when either is absent. `[QB3]`
7. **Activity.** Retired: the Set / Cleared image entries went with the Activity panel
   (removed 2026-10-03). `[QB4]`

### Upload (`POST /api/images`)

Guards run in this order; the first failure answers. Steps 1 to 6 are this api's; 7 is the media
service's ([media.md](../../../../../liveworkspace/docs/media.md) "Uploads"), whose refusals are passed
on as sent (`serviceAnswer`).

1. No media service → 503 `images_unavailable`.
2. Pre-dispatch in `index.ts`: read-only token → 403; `Content-Length > MAX_IMAGE_BYTES` →
   413 `payload_too_large`; `WRITE_RATE_LIMITER` exhausted → 429 `rate_limited`.
3. No resolved owner → 400 (`requireOwner`, D33).
4. `Content-Type` (lower-cased) not in `ACCEPTED_IMAGE_TYPES` → 415 `unsupported_type`
   `{ acceptedTypes }`.
5. `Content-Length` missing, non-finite or `<= 0` → 400; `> MAX_IMAGE_BYTES` → 413
   `file_too_large` (unreachable behind step 2 while both caps are equal).
6. `X-Image-Sha256` is kept only when the caller is not a workbench session (`ctx.workbench`) nor
   an API token (`ctx.token`) and it matches `/^[0-9a-f]{64}$/` (E4a). The body is read whole;
   `byteLength > MAX_IMAGE_BYTES` → 413 `file_too_large`.
7. `media.upload({ owner: mediaOwner(owner), bytes, contentType, byteSize, width, height,
originalName: originalNameOf(...), sha256 })`. The service answers a known hash without the
   body, then checks the caps (403 `gallery_full` `{ reason, limit, current }`), the dimensions
   (400 `invalid_dimensions`), sniffs (415 `unsupported_type`), dedupes on the body's hash, strips a
   JPEG (415 `malformed_jpeg`) and inserts with the caps repeated in the statement (403, or 409
   `upload_conflict`). A 401 or 5xx from it → 503 `images_unavailable`, logged.
8. `rememberMediaOwner(image.id, mediaOwner(owner))`.
9. Not deduped: `waitUntil(reportImagesUploaded(index, owner))`
   ([Timeline](../../013-workspace/timeline.md)). 200 `{ image: imageSummary(image), deduped }`.

Invariants:

- **I1 to I5** (bytes sniff as their type, no JPEG metadata, one image per owner and hash, the
  caps hold after any insert) are the service's.
- **I6:** every image this api uploads or lists is remembered (per isolate) under its owner as the
  service names them.

### Read (`GET /api/images/:id`)

1. `mediaImageOwner(media, id, caller)`: the isolate's memo (at most 2,000 ids), else one `media.get(id)`
   remembered (`''` when the service has no such image; a guest image of
   the caller's own comes back under the caller's guest id). No owner → 404. Not a document-scope
   workbench session, and the caller's resolved owner equals it → allowed.
2. Otherwise, with `?d=<documentId>` (for a document-scope workbench session, only its own
   document): `resolveDocumentGrant` returns the index's grant, then one RPC,
   `documentRoom(env, d).servesImage(id, grant.tab)`, answers from the document's own SQLite that it
   places the image ([Image reference index](image-reference-index.md#readers)) and may serve it
   (ownership, the owner's live entitlement or a [placement grant](../images.md#placement-grants)) → allowed; a placed but unservable image logs
   `[images] not servable by document`. A tab-scoped visitor counts only
   their tab ([Tab-scoped share links](../../013-workspace/tab-scoped-share-links.md)). `[QB8]`
3. Not allowed, or `media.bytes(id)` has no body → 404. Allowed → the bytes, `Content-Type` as
   the service stored it, `X-Content-Type-Options: nosniff`, `Cache-Control: private,
max-age=86400`.

### Delete, list, usage

- `DELETE /api/images/:id`: owner only; `media.remove(mediaOwner(owner), id)`: the service
  answers 200 for a missing image, 403 `forbidden` for another owner's (passed on), else deletes
  its row, then its bytes (an R2 failure there is logged by the service and leaves only
  unreachable bytes). Then the memo forgets the id; 200 `{ ok: true }`.
- `GET /api/images`: owner only; `media.list(mediaOwner(owner))`, newest first, from every app;
  `rememberMediaOwner` for the listed ids.
- `GET /api/images/usage`: owner only; `usageOf` asks the service for the owner's references, keeps
  this app's documents and names each from the index ([Image reference index](image-reference-index.md#readers)),
  no tab body read, each document once per image.

### Retention

The media service sweeps its own images; this api reports what its documents place
([spec](../images.md#retention-unused-image-cleanup)):

1. **Key.** A change to a document's `image_refs` keys `images` in its outbox, in the writer's
   transaction (`document-room/document-schema.ts`).
2. **Push.** The room's alarm drains the outbox at most once a minute
   (`document-room/document-outbox.ts`): it writes the placement grants, then `media.syncRefs` sends
   the document's whole set (at most `MEDIA_REFS_PER_DOCUMENT_MAX`, logging past it), replacing what
   the service held. A purged document sends an empty set. Without a client the key is dropped; a
   failed send throws and keeps the key for the next drain.

A null or `data:` id references nothing.

### Client export and server snapshot

- Client: `loadTabImages` takes the distinct ids of the tab, uses a `data:` id as is, otherwise
  `apiFetchImageDataUrl` with `documentId` and `shareCode`, decodes each to an
  `HTMLImageElement`, concurrently, with no budget (D45). A failure skips that id.
- `describeBoxedExport`: `radius = BORDER_RADIUS_PX[borderRadius]` or 4, `objectFit ??
'contain'`, `href = resolveImageHref?.(imageId)`; the alt-text label only when `href` is
  absent. SVG: `svgImageShape`; PNG / PDF: `drawImageElement` in `export-tab-canvas-draw.ts`.
- Server: `loadEmbeddedImages` reads each id with `media.bytes(id)` through `embedTabImages`
  with `totalBudgetBytes: IMAGE_EMBED_BUDGET_BYTES`, in document order, one at a time; an image
  that does not fit is skipped and later smaller ones may still fit (D44). Only ids
  `servableImageIds` returns are read (from the document's `image_owners` and `image_grants`). The
  snapshot is drawn in the document's Durable Object (`renderDocumentImage`). No client: no embed. `[QB7]`

### Availability

- `MEDIA_KEY` absent: every `/api/images*` route answers 503 `images_unavailable`, the snapshot
  embed is a no-op and a document's image key is dropped unsent. The service refusing the key
  (401) or failing (5xx) answers the same 503.
- The editor withholds `onAddImage` when the deployment has no images, which hides every
  `needsImage` tile (`tools:image`, avatar, hero) and the `9` shortcut. It learns this from
  `GET /api/capabilities` through the proposed field `imagesEnabled` `[QB1]`; the endpoint
  reports only `aiEnabled` and `emailEnabled`.

## Interfaces and contracts

```ts
// packages/document/src/element-types.ts (image-specific fields)
export type ImageElement = {
  id: ElementId;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  imageId: string | null;
  naturalWidth?: number;
  naturalHeight?: number;
  objectFit?: 'cover' | 'contain';
  heroCaption?: HeroCaption;
  alt?: string;
  aspectLocked?: boolean;
  borderRadius?: BorderRadius;
  // ...the shared boxed-element fields
};

// packages/api-schema/src/index.ts
export type ImageSummary = {
  id: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  originalName?: string;
  createdAt: number;
};

// packages/api-schema/src/embed-images.ts
export type EmbedImageSource = (
  imageId: string,
) => Promise<{ bytes: ArrayBuffer; contentType: string | null } | null>;
export type EmbedImageLimits = { maxBytesPerImage?: number; totalBudgetBytes?: number };
export function embedTabImages(
  tab: Pick<Tab, 'elements'>,
  load: EmbedImageSource,
  limits?: EmbedImageLimits,
): Promise<Map<string, string>>;

// apps/api/src/routes/images.ts (GET /api/images/usage)
async function usageOf(
  ctx: RouteContext,
  media: MediaClient,
  owner: string,
): Promise<Record<string, { id: string; name: string }[]>>;

// apps/api/src/db/image-grants.ts
export function documentMayServeImage(
  env: Env,
  documentId: string,
  imageId: string,
): Promise<boolean>;
export function servableImageIds(env: Env, documentId: string, ids: string[]): Promise<Set<string>>;

// apps/api/src/media.ts
export const MEDIA_APP = 'livediagram.app';
export function mediaClient(env: Pick<Env, 'MEDIA_KEY' | 'MEDIA_URL'>): MediaClient | null;
export function mediaOwner(owner: string): Promise<string>;
export function imageSummary(image: MediaImage): ImageSummary;
export function rememberMediaOwner(id: string, owner: string | null): void;
export function mediaImageOwner(
  client: MediaClient,
  id: string,
  caller: string | null,
): Promise<string | null>;

// apps/api/src/routes/images.ts: the decoded, length-capped X-Image-Original-Name
export function originalNameOf(header: string | null): string | null;

// apps/editor/lib/upload-image.ts
export function uploadImageFile(ownerId: string, file: File): Promise<UploadResult>;
export function addImageFileForDocument(
  ownerId: string,
  documentId: string | null,
  file: File,
): Promise<UploadResult>;
```

Routes (error bodies are `{ error: <token>, ... }`, `[QB10]`):

| Route                    | Success                                   | Rejections                                                                                                                                                                                                                                                |
| ------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/images`        | 200 `{ images: ImageSummary[] }`          | 400 no owner; 503 `images_unavailable` (no key, or the service refused it or failed)                                                                                                                                                                      |
| `POST /api/images`       | 200 `{ image, deduped }`                  | 400 (`invalid_dimensions` from the service); 403 `gallery_full` `{ reason, limit, current }`; 409 `upload_conflict`; 413 `payload_too_large` / `file_too_large` `{ limitBytes }`; 415 `unsupported_type` `{ acceptedTypes }` / `malformed_jpeg`; 429; 503 |
| `GET /api/images/usage`  | 200 `{ usage: Record<id, {id, name}[]> }` | 400; 503                                                                                                                                                                                                                                                  |
| `GET /api/images/:id`    | 200 bytes                                 | 404 (never 403, no existence leak); 503                                                                                                                                                                                                                   |
| `DELETE /api/images/:id` | 200 `{ ok: true }`                        | 400; 403 `forbidden` not the owner (the service's); 429; 503                                                                                                                                                                                              |

Upload request headers: `Content-Type`, `Content-Length`, `X-Image-Sha256` (optional, 64 lower
hex), `X-Image-Width`, `X-Image-Height`, `X-Image-Original-Name` (optional).

Client mapping (`UPLOAD_ERROR_MESSAGES`): `gallery_full`, `unsupported_type`, `file_too_large`,
`images_unavailable` map to fixed copy; `payload_too_large`, `malformed_jpeg` and
`upload_conflict` show the raw `ApiError` message (GB6). The import pipeline maps the same
tokens separately through `failureFromUploadError` (GB6). `apiListImages` and `apiImageUsage`
read a 503 as `null` and `{}`.

## Data and persistence

- **Media service** ([media.md](../../../../../liveworkspace/docs/media.md)): one row per image
  (`id`, owner, `app`, type, size, dimensions, hash, name, time) and its bytes in R2, keyed by id.
- **This api keeps no image rows of its own.** Whose an image is lives per isolate in
  `mediaImageOwner`'s memo, and per document in its `image_owners` (an account id, a media guest
  owner, or `''` for an id the service does not know) beside its `image_grants`
  ([Image reference index](image-reference-index.md#data-and-persistence)).
- **No bucket of its own.** The image bytes uploaded before the move are still in the previous Cloudflare
  account's `livediagram-images` bucket, unserved, until they are migrated into the media service; document
  previews are liveworkspace's ([Document SVG snapshots](../../006-document/document-snapshots.md)).
- **Tab body**: the element fields above, validated by `validate.ts` (`imageId` string or null).
- **Never on the wire**: the owner and the hash (`imageSummary` also drops `app`).
- **Snapshot / restore**: a tab snapshot carries only `imageId`; restoring an element whose image
  was deleted renders **broken**. Undo restores the prior `imageId`.
- **Account deletion** ([Owner-keyed data](../../015-api/api.md#owner-keyed-data)): first
  `media.forgetOwner(mediaOwner(owner))`, which deletes every image the owner uploaded in any app
  and throws on failure. An image a surviving shared tab still places, here or in another app,
  renders **broken** (D142).
  **Guest merge**: first `media.mergeOwner(mediaOwner(guest), mediaOwner(account))`, which throws
  on failure (idempotent, so a retry is safe); the service keeps on the guest an image whose bytes
  the account already holds. The index moves the documents themselves.
- **Trash**: a trashed document keeps its content, so its images stay referenced until the purge
  ([Trash](../../013-workspace/trash.md)); its share link grants no image read meanwhile.
- **Reference index**: `image_refs`, in each document's own SQLite, is derived from tab bodies and
  owned by the [Image reference index](image-reference-index.md) blueprint.
- **Offline documents** hold `data:` URIs in `imageId`; Take Offline and Sync Canvas convert
  ([Offline Mode](../../006-document/offline-mode.md)).
- **Schema**: the document's tables are made on first use (`document-room/document-schema.ts`); the
  api has no D1 database and no migrations.

## Errors and edge cases

| #   | Case                                                 | Handling                                                                                        |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| E1  | SVG, HTML or other bytes declared as PNG             | Sniff mismatch, 415 `unsupported_type`                                                          |
| E2  | Truncated or malformed JPEG                          | 415 `malformed_jpeg`; nothing written                                                           |
| E3  | Lying `Content-Length`                               | Body re-checked after read, 413                                                                 |
| E4  | Forged `X-Image-Sha256`                              | The service's early dedupe is owner-scoped; the body hash is recomputed before insert           |
| E4a | Workbench or token probing the gallery by hash       | Header ignored for them; the body is read and hashed, so a hash alone never names a gallery row |
| E5  | Same bytes uploaded concurrently                     | The service's unique index keeps one image; the other answers it `deduped: true`                |
| E5a | Racing uploads that together pass a cap              | The service refuses the later insert and deletes its bytes; 403 `gallery_full`, or 409          |
| E6  | Upload without a valid sha header at a full gallery  | The service checks the caps before body dedupe: 403 even when the bytes are already stored      |
| E7  | Service refuses the key, or fails                    | 401 / 5xx → 503 `images_unavailable`, logged `[images] media service answered`                  |
| E8  | Delete of a referenced image                         | 200; references render **broken**                                                               |
| E9  | Referenced id the service does not know              | `''` remembered, so later reads 404 without asking; canvas **broken**; snapshot placeholder     |
| E10 | Snapshot images over the budget                      | Placeholder for each that does not fit                                                          |
| E11 | Offline `data:` id sent to the api                   | Not servable, placeholder in snapshots; canvas and client export use it directly                |
| E12 | Retention and reference edge cases                   | [Image reference index](image-reference-index.md#errors-and-edge-cases)                         |
| E13 | Share read of a document in the Trash                | The index grants no read; 404                                                                   |
| E14 | Account deletion when the service fails              | `forgetOwner` not ok throws before any row here is touched; the deletion can run again          |
| E18 | Image later known to the service, remembered as `''` | Stays unserved through that document until its `image_owners` row is asked again                |
| E19 | A document placing more than 1,000 images            | First 1,000 sent; logged; the rest could be swept by the service (unreachable under the cap)    |
| E20 | Guest image from another app placed here             | Owner name matches nobody here: served only through a grant                                     |
| E15 | Picker opened while the tab is locked / view role    | `openImagePickerFor` no-ops; placeholder shows "No image"                                       |
| E16 | Image with zero natural height                       | `readImageDimensions` fails, "Could not read image dimensions."                                 |

## Security and trust

- **Trust boundary.** Every upload header is untrusted. Type is sniffed, size re-checked, hash
  recomputed; width and height are trusted after a positivity check (D38) and affect only layout.
- **Stored XSS.** SVG is never accepted (`ACCEPTED_IMAGE_TYPES`); served bytes carry their sniffed
  type. An `imageId` is written into export SVG as `href` and must be XML-escaped; `validate.ts`
  admits only a uuid or a `data:image/(png|jpeg|gif|webp);base64,` URI (GB1).
- **Read authorisation.** Owner, or a reader of a document that references the id. Knowing an id
  is therefore a read capability: ids travel in tab JSON to every reader of that tab. `[QB8]`
- **Server-side embed.** Only ids `servableImageIds` returns are read, and only from the media
  service, so a tab cannot pull another document's image into
  its public live image. `[QB7]`
- **The service key.** `MEDIA_KEY` is a Worker secret, sent only to `MEDIA_URL` as a bearer token;
  it speaks for livediagram.app alone. A guest id never leaves this api: the service sees
  `mediaGuestOwner(app, guestId)`, a SHA-256. Any app may read any image's bytes from the service,
  so this api's gate is the only door to them from livediagram.
- **Privacy.** JPEG APPn and COM segments are stripped by the service before storage. PNG, WebP and GIF
  pass through (spec, Out of scope).
- **Abuse.** `WRITE_RATE_LIMITER` (300 per 60 s per owner or token) on POST and DELETE; per-file
  cap; the service's per-person caps across apps, enforced atomically at insert; the owner comes only from a verified token, a guest's included;
  read-only tokens cannot write. Uploads are off in embeds (D42).
- **Caching.** `private` only, so no shared cache holds a share-gated image.

## Performance and limits

- Upload: the body read whole here (at most 10 MiB in memory), one service request (which does the
  hash, the caps, the strip and the store).
- Read: the owner memo (a miss adds one service `GET`, once per id per isolate), and when read
  through a document one index grant and one call to the document, then one service fetch whose
  body is streamed on, not buffered.
- Gallery list: one service request.
- Saves: the index statements in the body's own transaction, in the document's SQLite; nothing is
  written, and nothing pushed, when the set is unchanged. A changed set costs one push (the grants
  and one service request) within about a minute.
- Usage: one service request and at most `USAGE_DOCUMENTS_MAX` index lookups, ten in flight, no tab
  body read; deduped in flight on the client (`dedupeInFlight`).
- Snapshot: at most `IMAGE_EMBED_BUDGET_BYTES` raw (about 4 MiB base64) per snapshot, read one
  at a time.
- Client export: every distinct image fetched concurrently and held as a data URL plus a decoded
  image for the export's duration.

## Presentation and UX

- **Placeholder** (`ImageEmptyFace`): the empty state on the canvas: dashed outline, badge with
  the image glyph and two rings, "No image yet", "Upload one, or pick from your gallery.", a
  "Select Image" button (opens the picker; stops pointer-down and double-click propagation),
  scaled and trimmed by `imageEmptyLayout`; a lone badge is the button. View role: badge and
  "No image yet", no button, no hover tint. `[QB10]`
- **Loading**: pulsing slate box with the element's radius. **Broken**: rose box, broken glyph,
  "Image unavailable". **Ready**: bitmap on white in every theme (D47), `objectFit` (default
  `contain`), radius from `borderRadius` (default 4 px) (D48).
- **Picker** (`Dialog`, `size="2xl"`, title "Image"): tabs "Upload" and "Gallery" (with a
  count badge once loaded).
  - Upload: `ImageDropZone`, prompt "Drop, paste, or click to choose an image"; paste anywhere
    while open.
  - Gallery: 4-column grid; "Loading…"; empty "No images yet. Drop one in the Upload tab and
    it'll show up here."; a tile click uses it; a trash button deletes after a confirm ("Delete
    image").
  - A dedupe answer flashes "Already in your gallery" before closing. `[QB5]`
  - Footer, when the element has an image: "Detaches the image from this element. The gallery
    copy is kept." and "Remove from element".
  - 503: "Image uploads are not enabled on this deployment." `[QB10]`
- Upload errors render inline under the drop zone with the mapped copy.

## Accessibility

- `<img alt={element.alt ?? ''}>`; `alt` defaults to the file name on attach (D41).
- Picker is a labelled `Dialog` (`ariaLabel="Image picker"`); gallery tiles are buttons labelled
  "Use <name>", delete buttons "Delete <name>".
- The Upload / Gallery switch is a `role="tablist"` with `aria-selected` tabs, and the delete
  button is visible on focus as well as hover (GB7).
- Glyphs are `aria-hidden`. The loading pulse follows the global reduced-motion rule.

## Web experience

- **CLS**: the element box is fixed by `width` / `height` in every state; the skeleton, broken
  and ready states fill the same box.
- **LCP / INP**: the picker is code-split (`next/dynamic`); bytes load after first paint through
  blob URLs; gallery tiles fetch per tile. `ImageElementView` is memoised and
  `imageContext` is stable, so unrelated renders skip it.

## Observability

| #   | Where                          | Level           | Fingerprint                                                                            |
| --- | ------------------------------ | --------------- | -------------------------------------------------------------------------------------- |
| O2  | Upload rejection (GB5)         | `console.warn`  | `[images] rejected reason=<token> owner=<id> type=<ct> bytes=<n>`                      |
| O3  | Upload stored / deduped (GB5)  | `console.info`  | `[images] stored id=<id> bytes=<n> stripped=<bool>` / `deduped via=<header\|body>`     |
| O4  | Delete (GB5)                   | `console.info`  | `[images] deleted id=<id>`                                                             |
| O5  | Client upload failure (GB5)    | `console.warn`  | `[image-upload] failed code=<token>`                                                   |
| O6  | Service refused the key/failed | `console.error` | `[images] media service answered` + status, body                                       |
| O7  | Placed but not servable        | `console.warn`  | `[images] not servable by document` + `{ documentId, imageId }`                        |
| O8  | Reference sync failed          | thrown          | `media refs sync failed: <status>`, kept for the next drain                            |
| O9  | Document over one sync's limit | `console.error` | `[media] a document places more images than one sync carries` + `{ document, images }` |

O6 to O9 exist; the cap, R2 and retention logs are the service's own ([media.md](../../../../../liveworkspace/docs/media.md)). O2 to O5 do not; Observability stays unchecked until GB5 lands.

## Testing

| Rule                                                 | Test                                                      | File                                             |
| ---------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| 503 without the service                              | `503 without the media service…`                          | `apps/api/src/routes/images.test.ts`             |
| Owner required                                       | `400 listing the gallery with no owner`                   | `apps/api/src/routes/images.test.ts`             |
| Gallery from every app, remembered                   | `lists the gallery from every app…`                       | `apps/api/src/routes/images.test.ts`             |
| Upload, dedupe, owner remembered; guest hashed       | `uploads to the service…`, `keeps a guest's id…`          | `apps/api/src/routes/images.test.ts`             |
| Type and size refused before the service             | `refuses an unsupported type or an oversize file…`        | `apps/api/src/routes/images.test.ts`             |
| Service refusals passed on                           | `passes the service's refusals on…`                       | `apps/api/src/routes/images.test.ts`             |
| Hash shortcut only for the owner's editor (E4a)      | `the hash-only dedupe shortcut` suite                     | `apps/api/src/routes/images.test.ts`             |
| Read: owner, unknown id remembered, document gate    | `the byte read` suite                                     | `apps/api/src/routes/images.test.ts`             |
| Read of another app's upload through a document      | `serves an image uploaded in another app…`                | `apps/api/src/routes/images.test.ts`             |
| Workbench session read                               | `under a workbench session` suite                         | `apps/api/src/routes/images.test.ts`             |
| Delete: owner, idempotent, forgotten here            | `DELETE` suite                                            | `apps/api/src/routes/images.test.ts`             |
| A document's set pushed on change, kept on failure   | `a document's images` suite                               | `apps/api/src/media.test.ts`                     |
| Owner asked once per image, forgotten on delete      | `whose an image is` suite                                 | `apps/api/src/media.test.ts`                     |
| Account deletion and guest merge reach the service   | `the account` suite                                       | `apps/api/src/media.test.ts`                     |
| Hosted profile points at the media service           | `turns telemetry on and points each environment…`         | `apps/api/src/hosted-vars.test.ts`               |
| Sniff, strip, caps, dedupe, racing inserts           | the service's suites                                      | `liveworkspace/apps/media/src/*.test.ts`         |
| Whitelist, cap, no SVG                               | `MAX_IMAGE_BYTES`, `ACCEPTED_IMAGE_TYPES`                 | `packages/api-schema/src/image-limits.test.ts`   |
| Usage from the index                                 | `usageOf`                                                 | `apps/api/src/routes/images.test.ts` (`usage`)   |
| Reference index and placement grants                 | [Image reference index](image-reference-index.md#testing) |                                                  |
| Snapshot embeds, missing or unservable placeholder   | three `drawDocument` tests                                | `apps/api/src/thumbnail.test.ts`                 |
| Embed budget in document order                       | `spends a total budget in document order…`                | `packages/api-schema/src/embed-images.test.ts`   |
| Export embeds `<image>`, placeholder without href    | `image elements` suite                                    | `packages/document/src/svg-render.test.ts`       |
| Client gate: type, size, empty, error mapping        | `uploadImageFile` suites                                  | `apps/editor/lib/upload-image.test.ts`           |
| Upload headers, 503 → null                           | `apiUploadImage`, `apiListImages` suites                  | `apps/editor/lib/api-client.test.ts`             |
| Placeholder factory, aspect lock on                  | `createImage drops a 200x150 placeholder…`                | `packages/document/src/factories.test.ts`        |
| No colour controls                                   | `supportsColours covers … freehand; not image`            | `packages/document/src/geometry.test.ts`         |
| Offline data-URI rewrite                             | `offline-images` suites                                   | `apps/editor/lib/offline/offline-images.test.ts` |
| Palette hides without the service `[QB1]`            | none                                                      |                                                  |
| Set / Cleared image log `[QB4]` (retired)            | n/a                                                       |                                                  |
| Picker, placeholder states, paste, export in browser | none (GB8)                                                |                                                  |
| Escaped `href`, validated `imageId` (GB1)            | none                                                      |                                                  |

## Constants and configuration

| Name                          | Value                                    | Provenance / safe range                                     |
| ----------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `MAX_IMAGE_BYTES`             | `10 * 1024 * 1024`                       | Spec per-file cap; below the 100 MB Workers body limit      |
| `MAX_IMAGE_MB`                | `10`                                     | Derived, for copy                                           |
| `ACCEPTED_IMAGE_TYPES`        | png, jpeg, webp, gif                     | Spec whitelist; SVG must never join                         |
| `MAX_BODY_BYTES`              | `8 * 1024 * 1024`                        | Non-image write cap in `limits.ts`                          |
| `MEDIA_URL`                   | `https://liveworkspace.app/api/media`    | Client default; hosted per environment (`hosted-vars.json`) |
| `MEDIA_KEY`                   | secret                                   | Matches the service's `MEDIA_KEY_LIVEDIAGRAM`; unset = off  |
| `MEDIA_APP`                   | `'livediagram.app'`                      | The service's app name for this api                         |
| `MEDIA_REFS_PER_DOCUMENT_MAX` | 1000                                     | `@liveworkspace/media`; ten times the gallery cap           |
| Reference push                | at most once a minute per document       | The room's alarm (`document-room.ts`)                       |
| `IMAGE_EMBED_BUDGET_BYTES`    | `3 * 1024 * 1024`                        | Spec; 1 to 8 MiB keeps snapshots streamable                 |
| Read `Cache-Control`          | `private, max-age=86400`                 | Spec; `private` is load-bearing                             |
| Sniff window                  | first 16 bytes, minimum 12               | Longest signature (WebP) needs 12                           |
| Gallery placement size        | `240` px on the longer side              | D40; literal `max` in `addImageFromGallery`                 |
| `createImage` size            | 200 × 150                                | D49                                                         |
| `WRITE_RATE_LIMITER`          | 300 per 60 s                             | `wrangler.toml`, namespace `1001`                           |
| Buckets                       | `livediagram-images`, `…-images-staging` | Legacy image bytes only; separate per environment           |
