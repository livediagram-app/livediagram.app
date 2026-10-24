# Images: blueprint

Derived from [Image element + per-owner gallery](../images.md). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                 | Role                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| `packages/design/src/element-types.ts`               | `ImageElement`                                                               |
| `packages/design/src/factories.ts`                   | `createImage`: the 200×150 placeholder, `aspectLocked: true`                 |
| `packages/design/src/validate.ts`                    | Structural check of an image element in a tab body                           |
| `packages/design/src/svg-render-describe.ts`         | `describeBoxedExport`: image `ExportShape` with `href` / fit / radius        |
| `packages/design/src/svg-render.ts`                  | Image branch: `svgImageShape`, else the dashed placeholder rect              |
| `packages/design/src/svg-render-image-icon.ts`       | `svgImageShape`: clipped `<image>` over a white backing rect                 |
| `packages/api-schema/src/image-limits.ts`            | `MAX_IMAGE_BYTES`, `ACCEPTED_IMAGE_TYPES` and their derived copy             |
| `packages/api-schema/src/image-sniff.ts`             | `sniffImageType`: magic-number table                                         |
| `packages/api-schema/src/embed-images.ts`            | `embedTabImages`, `tabImageIds`: server-side data-URL inlining               |
| `packages/api-schema/src/sha256.ts`                  | `sha256Hex`, shared by editor and worker                                     |
| `packages/api-schema/src/index.ts`                   | `ImageSummary`                                                               |
| `apps/api/src/design-room/design-schema.ts`          | `image_owners`; the `outbox` keys that carry references to the media service |
| `apps/api/src/routes/images.ts`                      | `handleImages`: the five `/api/images*` routes; `originalNameOf`             |
| `apps/api/src/media.ts`                              | The media service client, image owners, the reference push                   |
| `apps/api/src/routes/images.ts` `imageUsage`         | The usage map, from the media service                                        |
| `apps/api/src/db/image-grants.ts`                    | `designServesImage`, `servableImageIds`: the share read's gate               |
| `apps/api/src/index.ts`                              | Size gate, write limiter, `scheduled()`: `announceMediaRefs`                 |
| `apps/api/src/thumbnail.ts`                          | `loadEmbeddedImages` for the preview and live image                          |
| `apps/api/wrangler.toml`                             | The daily `0 3 * * *` cron, `MEDIA_KEY` comment                              |
| `apps/api/hosted-vars.json`                          | Hosted livedesign.app's `MEDIA_URL`, per environment                         |
| `apps/live/lib/api/images.ts`                        | `apiListImages`, `apiUploadImage`, `apiDeleteImage`, `apiImageUsage`, …      |
| `apps/live/lib/upload-image.ts`                      | `uploadImageFile`, `addImageFileForDesign`, `ImageUploadError`               |
| `apps/live/hooks/canvas/useEditorImages.ts`          | Picker state, attach, detach, place-from-gallery                             |
| `apps/live/hooks/canvas/useClipboard.ts`             | `pasteImageFile`: Cmd/Ctrl+V image paste                                     |
| `apps/live/hooks/persistence/useImageBlobUrl.ts`     | Authenticated fetch to a revocable blob URL                                  |
| `apps/live/components/canvas/ImageElementView.tsx`   | Canvas face: placeholder, loading, broken, bitmap                            |
| `apps/live/components/canvas/ImageEmptyFace.tsx`     | Empty placeholder: empty state + Select Image button                         |
| `apps/live/components/panels/ImagePicker.tsx`        | Upload / Gallery modal, lazy via `EditorElementDialogs.tsx`                  |
| `apps/live/components/canvas/ImageDropZone.tsx`      | Drop, paste, file-input zone shared with the Explorer gallery                |
| `apps/live/lib/export-tab-images.ts`                 | `loadTabImages`: client export prefetch                                      |
| `apps/live/components/palette/palette-tile-defs.tsx` | `tools:image` tile (`needsImage: true`, shortcut `9`)                        |
| `apps/live/app/design/[id]/useElementCreation.ts`    | `addImage`: arms the draw gesture                                            |
| `apps/live/hooks/canvas/useShapeDrawing.ts`          | Commit of the draw: telemetry, selects the placeholder (no picker)           |

Out of this blueprint, cited where they touch images: the reference index
([Image reference index](image-reference-index.md)), Offline Mode data-URI embedding
(`apps/live/lib/offline/offline-images.ts`, [Offline Mode](../../006-design/offline-mode.md)), the
import pipeline (`apps/live/lib/import-images/`,
[Import image pipeline](../../020-import-export/import-image-pipeline.md)), the Explorer gallery
(`../packages/explorer/src/library/GalleryPane.tsx`, [Folders](../../013-workspace/folders.md)),
the media service itself ([liveworkspace/docs/media.md](../../../../../liveworkspace/docs/media.md): the gallery, dedupe, caps, sniff, JPEG strip and its own sweep), account deletion and guest migration (`apps/api/src/db/account.ts`,
[Owner-keyed data](../../015-api/api.md#owner-keyed-data)), the Trash
([Trash](../../013-workspace/trash.md)), and the mcp embedder (`apps/mcp/src/image-result.ts`).

## Domain and naming

| Term             | Identifier                             | Meaning                                                     |
| ---------------- | -------------------------------------- | ----------------------------------------------------------- |
| Image element    | `ImageElement` (`type: 'image'`)       | Boxed element that shows one bitmap                         |
| Image id         | `ImageElement.imageId: string \| null` | The media service's id; a `data:` URI offline; null = empty |
| Placeholder      | `imageId === null`                     | The empty, dashed state awaiting a pick                     |
| Gallery          | `media.list(owner)`                    | Every image one person has uploaded, from every app         |
| Image summary    | `ImageSummary`                         | Wire DTO of one gallery image (the service's, minus `app`)  |
| Image owner      | `image_owners.owner_id` (the design's) | Whose an image is, as the media service names owners        |
| Media owner      | `mediaOwner(owner)`                    | The owner as the service knows them; a guest id is hashed   |
| Dedupe key       | person and `sha256`, in the service    | SHA-256 of the uploaded (pre-strip) bytes, per person       |
| Gallery cap      | the service's, 100 images and 100 MB   | Per-person count and byte ceilings, across every app        |
| Metadata strip   | the service's JPEG strip               | Byte-level removal of APPn and COM segments from a JPEG     |
| Reference        | row of `image_refs` naming the id      | A tab places the image; see the index blueprint             |
| Reference outbox | the design's `outbox` media key        | The design's images changed since the service last heard    |
| Retention sweep  | the media service's                    | Daily reaping of unplaced images, for every app             |
| Embed budget     | `IMAGE_EMBED_BUDGET_BYTES`             | Raw bytes one server-side snapshot may inline               |
| Export image map | `ExportImageMap`                       | `imageId → { href, image }` prefetched for a client export  |
| Images available | `mediaClient(env) !== null`            | The deployment has `MEDIA_KEY` for the media service        |

Banned synonyms: "asset", "upload" as a noun for the stored row (say image), "photo" in code, "GC"
(say retention sweep), "thumbnail" for a gallery tile (thumbnail is the design snapshot).

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

Guards run in this order; the first failure answers.

1. `MEDIA_KEY` unset (`mediaClient(env)` null) → 503 `images_unavailable`.
2. Pre-dispatch in `index.ts`: read-only token → 403; `Content-Length > MAX_IMAGE_BYTES` →
   413 `payload_too_large`; `WRITE_RATE_LIMITER` exhausted → 429 `rate_limited`.
3. No resolved owner → 400 (`requireOwner`, D33).
4. `Content-Type` (lower-cased) not in `ACCEPTED_IMAGE_TYPES` → 415 `unsupported_type`.
5. `Content-Length` missing, non-finite or `<= 0` → 400; `> MAX_IMAGE_BYTES` → 413
   `file_too_large` (unreachable behind step 2 while both caps are equal). Steps 4 and 5 run here,
   so a refused file never leaves the worker.
6. The hash shortcut: only when the caller is not a workbench session (`ctx.workbench`) or an
   API token (`ctx.token`) and `X-Image-Sha256` matches `/^[0-9a-f]{64}$/` is it sent on as
   `sha256`; a workbench or token caller's header is dropped, so the service dedupes on the body's
   real hash (E4a).
7. Body read; `byteLength > MAX_IMAGE_BYTES` → 413 `file_too_large`.
8. `media.upload({ owner: mediaOwner(owner), bytes, contentType, byteSize, width, height,
originalName: originalNameOf(X-Image-Original-Name), sha256 })`. The service answers the hash
   dedupe, checks the caps, sniffs the bytes against the declared type, strips a JPEG's metadata,
   hashes, dedupes and stores, with the caps inside the row's insert so racing uploads cannot
   together pass one ([media.md](../../../../../liveworkspace/docs/media.md) "Uploads"). Its
   refusals pass on as sent (403 `gallery_full` `{ reason, limit, current }`, 409
   `upload_conflict`, 415 `unsupported_type` / `malformed_jpeg`, 400), except a 401 (this api's key
   refused) or a 5xx, which log `[images] media service answered` and answer 503
   `images_unavailable`.
9. `rememberMediaImages(env, owner, [image.id])`: the image is recorded as the uploader's, under
   the owner id this api uses (a guest's own id, never its hash).
10. Unless deduped, `waitUntil(recordImageUploaded(env, owner))`
    ([Timeline](../../013-workspace/timeline.md)); 200 `{ image, deduped }`.

Invariants:

- **I1 to I3** (sniffed type in `ACCEPTED_IMAGE_TYPES`, no JPEG APPn or COM segment, one image per
  person and bytes) and the caps are the media service's.
- **I4:** a guest id never reaches the service; it sees `mediaOwner(guestId)`, a one-way hash.
- **I5:** an `image_owners` row names the owner as the service does (an account id, or a guest's
  one-way hash), or `''` for an id the service does not know.

### Read (`GET /api/images/:id`)

1. `mediaImageOwnerFor(media, id, caller)`: asked of the service and remembered per isolate for
   a minute (`''` when it has no such image) → no owner → 404. The caller's resolved
   owner equals it, and the caller is not a design-scope workbench session → allowed.
2. Otherwise, with `?d=<designId>`: the index grants the caller the design (never one in the
   Trash), and `designServesImage(d, id, grant.tabScope)` is true → allowed:
   the design places the image and may serve it (its owner owns `d`, or `d` holds a placement
   grant). The reference is read from the index
   ([Image reference index](image-reference-index.md#readers)). A tab-scoped visitor counts only
   their tab ([Tab-scoped share links](../../013-workspace/tab-scoped-share-links.md)). `[QB8]`
3. Not allowed, or no bytes at the service → 404. Allowed → `media.bytes(id)`, `Content-Type`
   the service's stored (sniffed) type, `Cache-Control: private, max-age=86400`,
   `X-Content-Type-Options: nosniff`.

### Delete, list, usage

- `DELETE /api/images/:id`: owner only; `media.remove(mediaOwner(owner), id)`. The service checks
  the image is theirs (another owner's → 403, D34) and answers ok for one already gone; then 200
  `{ ok: true }`.
- `GET /api/images`: owner only; `media.list(mediaOwner(owner))`, the gallery from every app,
  newest first. Whose an image is is the service's answer, so a design of theirs placing an image
  uploaded in another app serves it.
- `GET /api/images/usage`: owner only; `imageUsage` reads the service's references for the
  owner's images (`media.usage`), keeps this app's designs and names each from the index (at most
  `IMAGE_USAGE_DESIGNS_MAX`, 200), no tab body read, each design once per image. A design in the Trash still counts
  ([Trash](../../013-workspace/trash.md)).

### Retention

Images in the media service are swept by the service once every app has told it which images
its designs place ([media.md](../../../../../liveworkspace/docs/media.md) "Retention"). The
reference index's writers change `image_refs` in the design's own SQLite, whose triggers queue a
media key in the design's `outbox` in the same transaction (a tab linked in or out too); the
design's alarm sends its whole set (`pushDesignMediaRefs`, `complete: true`), and keeps the key to
retry when the service refuses. A purged design is sent an empty set (`forgetDesignMediaRefs`).
`scheduled()` on `0 3 * * *` says `complete` daily even when nothing changed
(`announceMediaRefs`). Without `MEDIA_KEY` nothing is sent. The api keeps no image bytes of its
own and sweeps nothing. A null or `data:` id references nothing.

### Client export and server snapshot

- Client: `loadTabImages` takes the distinct ids of the tab, uses a `data:` id as is, otherwise
  `apiFetchImageDataUrl` with `designId` and `shareCode`, decodes each to an
  `HTMLImageElement`, concurrently, with no budget (D45). A failure skips that id.
- `describeBoxedExport`: `radius = BORDER_RADIUS_PX[borderRadius]` or 4, `objectFit ??
'contain'`, `href = resolveImageHref?.(imageId)`; the alt-text label only when `href` is
  absent. SVG: `svgImageShape`; PNG / PDF: `drawImageElement` in `export-tab-canvas-draw.ts`.
- Server: `loadEmbeddedImages` reads each id with `media.bytes(id)` through `embedTabImages` with
  `totalBudgetBytes: IMAGE_EMBED_BUDGET_BYTES`, in document order, one at a time; an image that
  does not fit is skipped and later smaller ones may still fit (D44). Only ids the design may
  serve (`servableImageIds`, one query for the tab) are read; none without `MEDIA_KEY`. `[QB7]`

### Availability

- `MEDIA_KEY` unset: every `/api/images*` route answers 503 `images_unavailable` (as when the
  service refuses the key or is down), the snapshot embed reads nothing, and no references are
  sent.
- The editor withholds `onAddImage` when the deployment has no images, which hides every
  `needsImage` tile (`tools:image`, avatar, hero) and the `9` shortcut. It learns this from
  `GET /api/capabilities` through the proposed field `imagesEnabled` `[QB1]`; the endpoint
  reports only `emailEnabled` and the CLI fields.

## Interfaces and contracts

```ts
// packages/design/src/element-types.ts (image-specific fields)
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

// apps/api/src/media.ts
export function mediaClient(env: Pick<Env, 'MEDIA_KEY' | 'MEDIA_URL'>): MediaClient | null;
export function mediaOwner(owner: string): Promise<string>; // a guest id → a one-way hash
export function imageSummary(image: MediaImage): ImageSummary; // drops `app`
export function mediaImageOwnerFor(
  client: MediaClient,
  id: string,
  caller: string | null,
  now?: number,
): Promise<string | null>;
export function pushDesignMediaRefs(
  env: DesignEnv,
  designId: string,
  images?: readonly string[],
): Promise<void>;
export function announceMediaRefs(env: Env): Promise<void>;

// apps/api/src/db/image-grants.ts
export function designServesImage(
  env: DesignEnv,
  designId: string,
  imageId: string,
  onlyTabId?: string | null,
): Promise<boolean>;

// apps/api/src/routes/images.ts: the file's own name, decoded, cut to ORIGINAL_NAME_MAX
export function originalNameOf(header: string | null): string | null;

// apps/live/lib/upload-image.ts
export function uploadImageFile(ownerId: string, file: File): Promise<UploadResult>;
export function addImageFileForDesign(
  ownerId: string,
  designId: string | null,
  file: File,
): Promise<UploadResult>;
```

Routes (error bodies are `{ error: <token>, ... }`, `[QB10]`):

| Route                    | Success                                   | Rejections                                                                                                                                                                                                        |
| ------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/images`        | 200 `{ images: ImageSummary[] }`          | 400 no owner; 503 `images_unavailable`                                                                                                                                                                            |
| `POST /api/images`       | 200 `{ image, deduped }`                  | 400; 403 `gallery_full` `{ reason, limit, current }`; 409 `upload_conflict`; 413 `payload_too_large` / `file_too_large` `{ limitBytes }`; 415 `unsupported_type` `{ acceptedTypes }` / `malformed_jpeg`; 429; 503 |
| `GET /api/images/usage`  | 200 `{ usage: Record<id, {id, name}[]> }` | 400; 503                                                                                                                                                                                                          |
| `GET /api/images/:id`    | 200 bytes                                 | 404 (never 403, no existence leak); 503                                                                                                                                                                           |
| `DELETE /api/images/:id` | 200 `{ ok: true }`                        | 400; 403 not the owner; 429; 503                                                                                                                                                                                  |

Upload request headers: `Content-Type`, `Content-Length`, `X-Image-Sha256` (optional, 64 lower
hex), `X-Image-Width`, `X-Image-Height`, `X-Image-Original-Name` (optional).

Client mapping (`UPLOAD_ERROR_MESSAGES`): `gallery_full`, `unsupported_type`, `file_too_large`,
`images_unavailable` map to fixed copy; `payload_too_large`, `malformed_jpeg` and
`upload_conflict` show the raw `ApiError` message (GB6). The import pipeline maps the same
tokens separately through `failureFromUploadError` (GB6). `apiListImages` and `apiImageUsage`
read a 503 as `null` and `{}`.

## Data and persistence

- **The media service** keeps each image (bytes, type, size, dimensions, `sha256`, original name,
  owner, app) and the gallery, across every app
  ([media.md](../../../../../liveworkspace/docs/media.md)).
- **`image_owners`**, in the design's own SQLite (`design-room/design-schema.ts`): `image_id`
  TEXT PK, `owner_id` TEXT (as the service names the owner, or `''` for an id it does not know),
  `WITHOUT ROWID`. Learned once per image when the design first judges it; read by the placement
  grants.
- **The design's `outbox`**: a media key, queued by the `image_refs` and `design_tabs` triggers
  and deleted once the alarm's push lands.
- **Design previews** are liveworkspace's media service's
  ([Design SVG snapshots](../../006-design/design-snapshots.md)); no image bytes are kept here.
- **Tab body**: the element fields above, validated by `validate.ts` (`imageId` string or null).
- **Never on the wire**: the owner and the service's `app` (`imageSummary`).
- **Snapshot / restore**: a tab snapshot carries only `imageId`; restoring an element whose image
  was deleted renders **broken**. Undo restores the prior `imageId`.
- **Account deletion** ([Owner-keyed data](../../015-api/api.md#owner-keyed-data)): first
  `media.forgetOwner(mediaOwner(owner))`, which deletes the person's images from every app (a
  failure throws, leaving the account whole to delete again). An image a surviving shared tab still
  places in another owner's design goes too; that element renders **broken** (D142).
  **Guest to account**: the index's merge notice has the api call `media.mergeOwner(guest,
account)` (`mergeMediaOwner`; idempotent, and a failure keeps the notice to ask again), so every
  guest image they place keeps serving.
- **Trash**: a trashed design keeps its tabs, so its images stay referenced until the purge
  ([Trash](../../013-workspace/trash.md)); its share link grants no image read meanwhile.
- **Reference index**: `image_refs` is derived from tab bodies and owned by the
  [Image reference index](image-reference-index.md) blueprint.
- **Offline designs** hold `data:` URIs in `imageId`; Take Offline and Sync Design convert
  ([Offline Mode](../../006-design/offline-mode.md)).
- **Schema**: the design's schema (`design-schema.ts`) creates `image_owners`, `image_grants`
  and the outbox triggers; `image_refs` belongs to the index blueprint.

## Errors and edge cases

| #   | Case                                              | Handling                                                                                           |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| E1  | SVG, HTML or other bytes declared as PNG          | Sniff mismatch, 415 `unsupported_type`                                                             |
| E2  | Truncated or malformed JPEG                       | The service answers 415 `malformed_jpeg`; nothing stored                                           |
| E3  | Lying `Content-Length`                            | Body re-checked after read, 413                                                                    |
| E4  | Forged `X-Image-Sha256`                           | The service's early dedupe is per person; a stored body's hash is its own                          |
| E4a | Workbench or token probing the gallery by hash    | Header ignored for them; the body is read and hashed, so a hash alone never names a gallery row    |
| E5  | Same bytes uploaded concurrently                  | The service answers the existing image, `deduped: true`                                            |
| E5a | Racing uploads that together pass a cap           | The service refuses the later insert: 403 `gallery_full`, or 409 when room returned                |
| E6  | Service refuses the key or is down                | 401 or 5xx logged `[images] media service answered`; 503 `images_unavailable`                      |
| E7  | Image uploaded in another app, placed here        | First read asks the service whose it is and remembers it; served by the owner's designs and grants |
| E8  | Delete of a referenced image                      | 200; references render **broken**                                                                  |
| E9  | Referenced id the service does not have           | Read 404 (remembered as `''`); canvas **broken**; export and snapshot keep the placeholder         |
| E10 | Snapshot images over the budget                   | Placeholder for each that does not fit                                                             |
| E11 | Offline `data:` id sent to the api                | Not servable, placeholder in snapshots; canvas and client export use it directly                   |
| E12 | Reference edge cases                              | [Image reference index](image-reference-index.md#errors-and-edge-cases)                            |
| E13 | Share read of a design in the Trash               | `getDesign` misses it; 404                                                                         |
| E15 | Picker opened while the tab is locked / view role | `openImagePickerFor` no-ops; placeholder shows "No image"                                          |
| E16 | Image with zero natural height                    | `readImageDimensions` fails, "Could not read image dimensions."                                    |

## Security and trust

- **Trust boundary.** Every upload header is untrusted. Type and size are checked here, then the
  service sniffs the type and recomputes the hash; width and height are trusted after a positivity check (D38) and affect only layout.
- **Stored XSS.** SVG is never accepted (`ACCEPTED_IMAGE_TYPES`); served bytes carry their sniffed
  type. An `imageId` is written into export SVG as `href` and must be XML-escaped; `validate.ts`
  admits only a uuid or a `data:image/(png|jpeg|gif|webp);base64,` URI (GB1).
- **Read authorisation.** Owner, or a reader of a design that references the id. Knowing an id
  is therefore a read capability: ids travel in tab JSON to every reader of that tab. `[QB8]`
- **Server-side embed.** Only ids the design may serve are read, and only from the media
  service, so a tab cannot pull another person's image or any other key into its public live image. `[QB7]`
- **Guest ids.** A guest id is a credential and never leaves this api: the service holds a guest's
  images under `mediaOwner(guestId)`, a one-way hash.
- **Privacy.** The service strips JPEG APPn and COM segments before storage (I2). PNG, WebP and GIF
  pass through (spec, Out of scope).
- **Abuse.** `WRITE_RATE_LIMITER` (300 per 60 s per owner or token) on POST and DELETE; per-file
  cap; the media service's per-person caps (100 images, 100 MB, across every app), enforced
  atomically at its insert; the `images` segment answers only a verified Bearer (an account's,
  a guest's or an API token); read-only tokens cannot write. Uploads are off in embeds (D42).
- **Caching.** `private` only, so no shared cache holds a share-gated image.

## Performance and limits

- Upload: the body read whole (at most 10 MiB) and one request to the service, which does the
  dedupe, caps, sniff, strip and store.
- Read by reference: one service lookup for the owner (remembered a minute per isolate), one
  indexed lookup on `image_refs` in the design's SQLite, then the bytes streamed from the service;
  no tab body is read.
- Reference sync: one outbox key in the transaction that changes a design's images; the
  design's alarm sends its whole set, at most the media contract's per-item cap of ids, in one request.
- Usage: one service request, then one index read per design named, 8 at a time, at most 200;
  deduped in flight on the client (`dedupeInFlight`).
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

| #   | Where                         | Level           | Fingerprint                                                                        |
| --- | ----------------------------- | --------------- | ---------------------------------------------------------------------------------- |
| O1  | Service refused key or failed | `console.error` | `[images] media service answered` + status, body                                   |
| O2  | Upload rejection (GB5)        | `console.warn`  | `[images] rejected reason=<token> owner=<id> type=<ct> bytes=<n>`                  |
| O3  | Upload stored / deduped (GB5) | `console.info`  | `[images] stored id=<id> bytes=<n> stripped=<bool>` / `deduped via=<header\|body>` |
| O4  | Delete (GB5)                  | `console.info`  | `[images] deleted id=<id>`                                                         |
| O5  | Reference sync failed         | `console.error` | `[media] refs sync failed` + status, body                                          |
| O5  | Client upload failure (GB5)   | `console.warn`  | `[image-upload] failed code=<token>`                                               |

O1 exists. O2 to O5 do not; Observability stays unchecked until GB5 lands.

## Testing

| Rule                                                 | Test                                                  | File                                           |
| ---------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| 503 without the media service                        | `503 without the media service (self-host without …)` | `apps/api/src/routes/images.test.ts`           |
| Owner required                                       | `400 listing the gallery with no owner`, usage        | `apps/api/src/routes/images.test.ts`           |
| Gallery is owner-scoped                              | `200 lists the owner-scoped gallery`                  | `apps/api/src/routes/images.test.ts`           |
| Upload, dedupe, guest hash, refusals passed on       | upload tests and `the hash-only dedupe shortcut`      | `apps/api/src/routes/images.test.ts`           |
| Read: owner, share + grant, other app, 404 otherwise | `the byte read` suite                                 | `apps/api/src/routes/images.test.ts`           |
| Tab-scoped read                                      | `asks whether the scoped tab…`                        | `apps/api/src/routes/images.test.ts`           |
| Delete: owner, idempotent, 403                       | three DELETE tests                                    | `apps/api/src/routes/images.test.ts`           |
| Outbox, its push, account delete and merge           | `a design's references`, `the account`                | `apps/api/src/media.test.ts`                   |
| Hosted profile points at each media service          | `turns telemetry on and points each environment…`     | `apps/api/src/hosted-vars.test.ts`             |
| Caps, sniff, strip, dedupe                           | the media service's own tests                         |                                                |
| Whitelist, cap, no SVG                               | `MAX_IMAGE_BYTES`, `ACCEPTED_IMAGE_TYPES`             | `packages/api-schema/src/image-limits.test.ts` |
| Usage and share read from the index                  | `imageUsageByOwner`, `designServesImage`              | apps/api/src/db/images.test.ts (removed)       |
| Snapshot embeds, missing keeps placeholder           | two `drawDesign` tests                                | `apps/api/src/thumbnail.test.ts`               |
| Embed budget in document order                       | `spends a total budget in document order…`            | `packages/api-schema/src/embed-images.test.ts` |
| Export embeds `<image>`, placeholder without href    | `image elements` suite                                | `packages/design/src/svg-render.test.ts`       |
| Client gate: type, size, empty, error mapping        | `uploadImageFile` suites                              | `apps/live/lib/upload-image.test.ts`           |
| Upload headers, 503 → null                           | `apiUploadImage`, `apiListImages` suites              | `apps/live/lib/api-client.test.ts`             |
| Placeholder factory, aspect lock on                  | `createImage drops a 200x150 placeholder…`            | `packages/design/src/factories.test.ts`        |
| No colour controls                                   | `supportsColours covers … freehand; not image`        | `packages/design/src/geometry.test.ts`         |
| Offline data-URI rewrite                             | `offline-images` suites                               | `apps/live/lib/offline/offline-images.test.ts` |
| Palette hides without the media service `[QB1]`      | none                                                  |                                                |
| Set / Cleared image log `[QB4]` (retired)            | n/a                                                   |                                                |
| Picker, placeholder states, paste, export in browser | none (GB8)                                            |                                                |
| Escaped `href`, validated `imageId` (GB1)            | none                                                  |                                                |

## Constants and configuration

| Name                       | Value                                         | Provenance / safe range                                     |
| -------------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| `MAX_IMAGE_BYTES`          | `10 * 1024 * 1024`                            | Spec per-file cap; below the 100 MB Workers body limit      |
| `MAX_IMAGE_MB`             | `10`                                          | Derived, for copy                                           |
| `ACCEPTED_IMAGE_TYPES`     | png, jpeg, webp, gif                          | Spec whitelist; SVG must never join                         |
| `MAX_BODY_BYTES`           | `8 * 1024 * 1024`                             | Non-image write cap in `limits.ts`                          |
| `MEDIA_KEY`                | secret; unset = no images                     | `wrangler secret put`; the service's `MEDIA_KEY_LIVEDESIGN` |
| `MEDIA_URL`                | unset = `https://liveworkspace.app/api/media` | `hosted-vars.json` per environment                          |
| Gallery caps               | 100 images, 100 MB per person                 | The media service's, across every app                       |
| Reference announce cron    | `0 3 * * *`                                   | `wrangler.toml`, production and staging                     |
| `IMAGE_EMBED_BUDGET_BYTES` | `3 * 1024 * 1024`                             | Spec; 1 to 8 MiB keeps snapshots streamable                 |
| Read `Cache-Control`       | `private, max-age=86400`                      | Spec; `private` is load-bearing                             |
| Sniff window               | first 16 bytes, minimum 12                    | Longest signature (WebP) needs 12                           |
| Gallery placement size     | `240` px on the longer side                   | D40; literal `max` in `addImageFromGallery`                 |
| `createImage` size         | 200 × 150                                     | D49                                                         |
| `WRITE_RATE_LIMITER`       | 300 per 60 s                                  | `wrangler.toml`, namespace `1001`                           |
