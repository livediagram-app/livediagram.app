# Images: blueprint

Derived from [Image element + per-owner gallery](../images.md). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                 | Role                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/document/src/element-types.ts`             | `ImageElement`                                                          |
| `packages/document/src/factories.ts`                 | `createImage`: the 200×150 placeholder, `aspectLocked: true`            |
| `packages/document/src/validate.ts`                  | Structural check of an image element in a tab body                      |
| `packages/document/src/svg-render-describe.ts`       | `describeBoxedExport`: image `ExportShape` with `href` / fit / radius   |
| `packages/document/src/svg-render.ts`                | `svgImageShape`: clipped `<image>` over a white backing rect            |
| `packages/api-schema/src/image-limits.ts`            | `MAX_IMAGE_BYTES`, `ACCEPTED_IMAGE_TYPES` and their derived copy        |
| `packages/api-schema/src/image-sniff.ts`             | `sniffImageType`: magic-number table                                    |
| `packages/api-schema/src/embed-images.ts`            | `embedTabImages`, `tabImageIds`: server-side data-URL inlining          |
| `packages/api-schema/src/sha256.ts`                  | `sha256Hex`, shared by editor and worker                                |
| `packages/api-schema/src/index.ts`                   | `ImageSummary`                                                          |
| `apps/api/migrations/0014_images.sql`                | `images` table and its two indexes                                      |
| `apps/api/src/routes/images.ts`                      | `handleImages`: the five `/api/images*` routes                          |
| `apps/api/src/db/images.ts`                          | D1 access, `unusedImageIds`, `deleteOldUnusedImages`                    |
| `apps/api/src/image-row.ts`                          | `imageRowToSummary`                                                     |
| `apps/api/src/image-sniff.ts`, `image-strip.ts`      | Upload boundary: sniff re-export, `stripJpegMetadata`                   |
| `apps/api/src/index.ts`                              | Pre-dispatch size gate, write limiter, `scheduled()` sweep              |
| `apps/api/src/thumbnail.ts`                          | `loadEmbeddedImages` for the preview and live image                     |
| `apps/api/wrangler.toml`                             | `IMAGES` bucket (production and `[env.staging]`), cron, caps comment    |
| `apps/live/lib/api/images.ts`                        | `apiListImages`, `apiUploadImage`, `apiDeleteImage`, `apiImageUsage`, … |
| `apps/live/lib/upload-image.ts`                      | `uploadImageFile`, `addImageFileForDocument`, `ImageUploadError`        |
| `apps/live/hooks/canvas/useEditorImages.ts`          | Picker state, attach, detach, place-from-gallery                        |
| `apps/live/hooks/canvas/useClipboard.ts`             | `pasteImageFile`: Cmd/Ctrl+V image paste                                |
| `apps/live/hooks/persistence/useImageBlobUrl.ts`     | Authenticated fetch to a revocable blob URL                             |
| `apps/live/components/canvas/ImageElementView.tsx`   | Canvas face: placeholder, loading, broken, bitmap                       |
| `apps/live/components/panels/ImagePicker.tsx`        | Upload / Gallery modal, lazy via `EditorElementDialogs.tsx`             |
| `apps/live/components/canvas/ImageDropZone.tsx`      | Drop, paste, file-input zone shared with the Explorer gallery           |
| `apps/live/lib/export-tab-images.ts`                 | `loadTabImages`: client export prefetch                                 |
| `apps/live/components/palette/palette-tile-defs.tsx` | `tools:image` tile (`needsImage: true`, shortcut `9`)                   |
| `apps/live/app/document/[id]/useElementCreation.ts`  | `addImage`: arms the draw gesture                                       |
| `apps/live/hooks/canvas/useShapeDrawing.ts`          | Commit of the draw: telemetry, opens the picker                         |

Out of this blueprint, cited where they touch images: Offline Mode data-URI embedding
(`apps/live/lib/offline/offline-images.ts`, [Offline Mode](../../006-document/offline-mode.md)), the
Explorer gallery (`apps/live/components/panels/GalleryPane.tsx`,
[Folders](../../013-workspace/folders.md)), account deletion and guest migration
(`apps/api/src/db/account.ts`), and the mcp embedder (`apps/mcp/src/image-result.ts`).

## Domain and naming

| Term             | Identifier                                 | Meaning                                                    |
| ---------------- | ------------------------------------------ | ---------------------------------------------------------- |
| Image element    | `ImageElement` (`type: 'image'`)           | Boxed element that shows one bitmap                        |
| Image id         | `ImageElement.imageId: string \| null`     | `images.id` = R2 key; a `data:` URI offline; null = empty  |
| Placeholder      | `imageId === null`                         | The empty, dashed state awaiting a pick                    |
| Gallery          | rows of `images` for one `owner_id`        | Every image one owner has uploaded                         |
| Image summary    | `ImageSummary`                             | Wire DTO of one gallery row                                |
| Dedupe key       | `(owner_id, sha256)`                       | SHA-256 of the uploaded (pre-strip) bytes, per owner       |
| Soft cap         | `IMAGE_MAX_PER_OWNER`, `IMAGE_MAX_BYTES_…` | Optional per-owner count and byte ceilings                 |
| Metadata strip   | `stripJpegMetadata`                        | Byte-level removal of APPn and COM segments from a JPEG    |
| Reference        | an `ImageElement.imageId` equal to the id  | What makes an image "used" by a tab                        |
| Unused image     | returned by `unusedImageIds`               | Candidate no tab body references                           |
| Retention sweep  | `deleteOldUnusedImages`                    | Daily reaping of unused images past the floor              |
| Embed budget     | `IMAGE_EMBED_BUDGET_BYTES`                 | Raw bytes one server-side snapshot may inline              |
| Export image map | `ExportImageMap`                           | `imageId → { href, image }` prefetched for a client export |
| Images available | `env.IMAGES !== undefined`                 | The deployment has an R2 binding                           |

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
7. **Activity.** Setting `imageId` from null logs `Set image on <name>`; setting it to null logs
   `Cleared image on <name>` (`summarizeEdits` in `change-summaries.ts`). `[QB4]`

### Upload (`POST /api/images`)

Guards run in this order; the first failure answers.

1. `env.IMAGES` absent → 503 `images_unavailable`.
2. Pre-dispatch in `index.ts`: read-only token → 403; `Content-Length > MAX_IMAGE_BYTES` →
   413 `payload_too_large`; `WRITE_RATE_LIMITER` exhausted → 429 `rate_limited`.
3. No resolved owner → 400 (`requireOwner`, D33).
4. `Content-Type` (lower-cased) not in `ACCEPTED_IMAGE_TYPES` → 415 `unsupported_type`.
5. `Content-Length` missing, non-finite or `<= 0` → 400; `> MAX_IMAGE_BYTES` → 413
   `file_too_large` (unreachable behind step 2 while both caps are equal).
6. `X-Image-Sha256` matches `/^[0-9a-f]{64}$/` and a row exists at `(owner, sha)` → 200
   `{ image, deduped: true }`, body unread.
7. Soft caps, only when at least one is set: one `imageTotalsByOwner` query; `count >= maxImages`
   → 403 `gallery_full` `reason: 'count'`; `bytes + Content-Length > maxBytes` → 403
   `gallery_full` `reason: 'bytes'` (D35).
8. `X-Image-Width` / `X-Image-Height` not finite and positive → 400 (D38: trusted, not decoded).
9. Body read; `byteLength > MAX_IMAGE_BYTES` → 413 `file_too_large`.
10. `sniffImageType(first 16 bytes)` null or not equal to the declared type → 415
    `unsupported_type`.
11. `sha256Hex(body)`; a row at `(owner, sha)` → 200 `{ image, deduped: true }` (D37).
12. JPEG only: `stripJpegMetadata`; a throw → 415 `malformed_jpeg`, nothing stored (D36).
13. `id = crypto.randomUUID()`; `IMAGES.put(id, stored, { httpMetadata: { contentType },
customMetadata: { ownerId, originalName } })`; then `insertImage`. `[QB10]`
14. `waitUntil(recordImageUploaded(env, owner))` ([Timeline](../../013-workspace/timeline.md));
    200 `{ image, deduped: false }`.

Invariants:

- **I1:** every stored object's bytes sniff as its row's `content_type`, which is in
  `ACCEPTED_IMAGE_TYPES`.
- **I2:** no stored JPEG carries an APP0 to APP15 or COM segment.
- **I3:** at most one row per `(owner_id, sha256)` (unique index).
- **I4:** a row's R2 key equals `images.id`.

### Read (`GET /api/images/:id`)

1. No row → 404. The caller's resolved owner equals the row's `owner_id` → allowed.
2. Otherwise, with `?d=<documentId>`: the document exists, `gateGrant` returns a grant, and
   `documentReferencesImage(d, id, grant.tabScope)` is true → allowed. A tab-scoped visitor
   counts only their tab ([Tab-scoped share links](../../013-workspace/tab-scoped-share-links.md)).
   `[QB8]`
3. Not allowed, or no R2 object → 404. Allowed → the bytes, `Content-Type` from the object,
   `Cache-Control: private, max-age=86400`.

### Delete, list, usage

- `DELETE /api/images/:id`: owner only; no row → 200 `{ ok: true }`; another owner → 403
  (D34); else `IMAGES.delete(id)` then `deleteImage`, 200 `{ ok: true }`.
- `GET /api/images`: owner only; `listImagesByOwner`, newest first.
- `GET /api/images/usage`: owner only; `imageUsageByOwner` joins the owner's `documents →
document_tabs → tabs`, parses each body, attributes each image once per document. An
  unparseable body is skipped.

### Retention sweep

`scheduled()` on `0 3 * * *` calls `scheduleSweep(ctx, env, 'image', 'images', now -
UNUSED_IMAGE_RETENTION_MS, deleteOldUnusedImages)`.

1. `env.IMAGES` absent → return 0.
2. Candidates: `SELECT id FROM images WHERE created_at < cutoff`. None → 0.
3. Scan: pages of `SCAN_PAGE` tab rows by `rowid`, prefiltered by `data LIKE '%"imageId"%'`
   (D39); each page narrows the candidates through `unusedImageIds`; stop when none remain or a
   page is short.
4. `unusedImageIds`: a parsed body removes every candidate its image elements reference. An
   unparseable body keeps every candidate whose id occurs in its raw text. `[QB6]`
5. Delete in chunks of `IMAGE_DELETE_CHUNK`: `IMAGES.delete(chunk)` first, then one `DB.batch`
   of row deletes. Return the count.

### Client export and server snapshot

- Client: `loadTabImages` takes the distinct ids of the tab, uses a `data:` id as is, otherwise
  `apiFetchImageDataUrl` with `documentId` and `shareCode`, decodes each to an
  `HTMLImageElement`, concurrently, with no budget (D45). A failure skips that id.
- `describeBoxedExport`: `radius = BORDER_RADIUS_PX[borderRadius]` or 4, `objectFit ??
'contain'`, `href = resolveImageHref?.(imageId)`; the alt-text label only when `href` is
  absent. SVG: `svgImageShape`; PNG / PDF: `drawImageElement` in `export-tab-canvas-draw.ts`.
- Server: `loadEmbeddedImages` reads each id from `IMAGES` through `embedTabImages` with
  `totalBudgetBytes: IMAGE_EMBED_BUDGET_BYTES`, in document order, one at a time; an image that
  does not fit is skipped and later smaller ones may still fit (D44). Only ids with a row in
  `images` are read. `[QB7]`

### Availability

- `env.IMAGES` absent: every `/api/images*` route answers 503 `images_unavailable`; the sweep and
  the snapshot embed are no-ops.
- The editor learns availability from `GET /api/capabilities` (`imagesEnabled`) and withholds
  `onAddImage`, which hides every `needsImage` tile (`tools:image`, avatar, hero) and the `9`
  shortcut. `[QB1]`

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

// apps/api/src/db/images.ts
export function unusedImageIds(candidateIds: string[], tabBodies: string[]): string[];
export function deleteOldUnusedImages(env: Env, cutoff: number): Promise<number>;

// apps/live/lib/upload-image.ts
export function uploadImageFile(ownerId: string, file: File): Promise<UploadResult>;
export function addImageFileForDocument(
  ownerId: string,
  documentId: string | null,
  file: File,
): Promise<UploadResult>;
```

Routes (error bodies are `{ error: <token>, ... }`, `[QB10]`):

| Route                    | Success                                   | Rejections                                                                                                                                                                                 |
| ------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/images`        | 200 `{ images: ImageSummary[] }`          | 400 no owner; 503 `images_unavailable`                                                                                                                                                     |
| `POST /api/images`       | 200 `{ image, deduped }`                  | 400; 403 `gallery_full` `{ reason, limit, current }`; 413 `payload_too_large` / `file_too_large` `{ limitBytes }`; 415 `unsupported_type` `{ acceptedTypes }` / `malformed_jpeg`; 429; 503 |
| `GET /api/images/usage`  | 200 `{ usage: Record<id, {id, name}[]> }` | 400; 503                                                                                                                                                                                   |
| `GET /api/images/:id`    | 200 bytes                                 | 404 (never 403, no existence leak); 503                                                                                                                                                    |
| `DELETE /api/images/:id` | 200 `{ ok: true }`                        | 400; 403 not the owner; 429; 503                                                                                                                                                           |

Upload request headers: `Content-Type`, `Content-Length`, `X-Image-Sha256` (optional, 64 lower
hex), `X-Image-Width`, `X-Image-Height`, `X-Image-Original-Name` (optional).

Client mapping (`UPLOAD_ERROR_MESSAGES`): `gallery_full`, `unsupported_type`, `file_too_large`,
`images_unavailable` map to fixed copy; any other token shows the raw `ApiError` message (GB6).
`apiListImages` and `apiImageUsage` read a 503 as `null` and `{}`.

## Data and persistence

- **D1 `images`** (`0014_images.sql`): `id` TEXT PK (uuid v4), `owner_id`, `content_type`,
  `byte_size` (stored, post-strip), `width`, `height` (client-declared), `sha256` (pre-strip hex),
  `original_name` (nullable), `created_at` (ms). `images_owner_sha_idx` unique on
  `(owner_id, sha256)`; `images_owner_created_idx` on `(owner_id, created_at DESC)`.
- **R2 `IMAGES`**: key `images.id`; `httpMetadata.contentType` the sniffed type;
  `customMetadata` `{ ownerId, originalName }`. The same bucket holds document snapshots under
  `thumb/<documentId>` ([Document SVG snapshots](../../006-document/document-snapshots.md)).
- **Tab body**: the element fields above, validated by `validate.ts` (`imageId` string or null).
- **Never on the wire**: `owner_id`, `sha256` (`imageRowToSummary`).
- **Snapshot / restore**: a tab snapshot carries only `imageId`; restoring an element whose image
  was deleted renders **broken**. Revert restores the prior `imageId`.
- **Account deletion**: `IMAGES.delete(ids)` then `DELETE FROM images WHERE owner_id = ?`.
  **Guest to account migration**: `UPDATE OR IGNORE images SET owner_id`; rows that collide on
  the dedupe key stay with the guest id and remain readable by reference.
- **Offline documents** hold `data:` URIs in `imageId`; Take Offline and Sync Document convert
  ([Offline Mode](../../006-document/offline-mode.md)).
- **Migration**: none beyond `0014`.

## Errors and edge cases

| #   | Case                                                | Handling                                                                                             |
| --- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| E1  | SVG, HTML or other bytes declared as PNG            | Sniff mismatch, 415 `unsupported_type`                                                               |
| E2  | Truncated or malformed JPEG                         | 415 `malformed_jpeg`; nothing written                                                                |
| E3  | Lying `Content-Length`                              | Body re-checked after read, 413                                                                      |
| E4  | Forged `X-Image-Sha256`                             | Early dedupe is owner-scoped; body hash re-verified before insert                                    |
| E5  | Same bytes uploaded concurrently                    | Unique index rejects the second insert; its R2 object is deleted and the existing row returned (GB4) |
| E6  | Upload without a valid sha header at a full gallery | Cap check precedes body dedupe: 403 even when the bytes are already stored                           |
| E7  | Cap var `"100abc"`                                  | `parseInt` reads 100; blank, `0`, negative or non-numeric read as no cap                             |
| E8  | Delete of a referenced image                        | 200; references render **broken**                                                                    |
| E9  | Referenced id with no R2 object                     | Read 404; canvas **broken**; export and snapshot keep the placeholder                                |
| E10 | Snapshot images over the budget                     | Placeholder for each that does not fit                                                               |
| E11 | Offline `data:` id sent to the api                  | R2 miss, placeholder in snapshots; canvas and client export use it directly                          |
| E12 | Unparseable tab body in the sweep                   | Keeps every candidate named in its raw text `[QB6]`                                                  |
| E13 | Sweep throws                                        | `image sweep failed` logged; the next day retries                                                    |
| E14 | R2 delete succeeds, D1 batch fails                  | Row survives; next sweep re-deletes (R2 delete is idempotent)                                        |
| E15 | Picker opened while the tab is locked / view role   | `openImagePickerFor` no-ops; placeholder shows "No image"                                            |
| E16 | Image with zero natural height                      | `readImageDimensions` fails, "Could not read image dimensions."                                      |

## Security and trust

- **Trust boundary.** Every upload header is untrusted. Type is sniffed, size re-checked, hash
  recomputed; width and height are trusted after a positivity check (D38) and affect only layout.
- **Stored XSS.** SVG is never accepted (`ACCEPTED_IMAGE_TYPES`); served bytes carry their sniffed
  type. An `imageId` is written into export SVG as `href` and must be XML-escaped; `validate.ts`
  admits only a uuid or a `data:image/(png|jpeg|gif|webp);base64,` URI (GB1).
- **Read authorisation.** Owner, or a reader of a document that references the id. Knowing an id
  is therefore a read capability: ids travel in tab JSON to every reader of that tab. `[QB8]`
- **Server-side embed.** Only ids with an `images` row are read from R2, so a tab cannot pull a
  `thumb/<documentId>` snapshot or any other key into its public live image. `[QB7]`
- **Privacy.** JPEG APPn and COM segments are stripped before storage (I2). PNG, WebP and GIF
  pass through (spec, Out of scope).
- **Abuse.** `WRITE_RATE_LIMITER` (300 per 60 s per owner or token) on POST and DELETE; per-file
  cap; optional per-owner caps `[QB9]`; guest signature enforcement covers the `images` segment
  (`OWNER_SCOPED_SEGMENTS`); read-only tokens cannot write. Uploads are off in embeds (D42).
- **Caching.** `private` only, so no shared cache holds a share-gated image.

## Performance and limits

- Upload: one D1 read for the header dedupe, one grouped totals query when capped, one body hash,
  one linear JPEG walk (`O(n)`, one output buffer of input size), one R2 put, one D1 insert.
  Worst case 10 MiB in memory twice (input plus stripped copy).
- Read by reference: one D1 row plus a scan of the document's tab bodies; `O(tabs × elements)`.
- Usage: one join over all the owner's documents and tabs, parsed in full; deduped in flight on
  the client (`dedupeInFlight`).
- Sweep: candidate ids load at once; tab bodies stream in pages of 200, so memory holds one page
  (at most 200 × `MAX_TAB_BYTES`); deletes in chunks of 1000.
- Snapshot: at most `IMAGE_EMBED_BUDGET_BYTES` raw (about 4 MiB base64) per snapshot, read one
  at a time.
- Client export: every distinct image fetched concurrently and held as a data URL plus a decoded
  image for the export's duration.

## Presentation and UX

- **Placeholder**, editor: dashed slate border, image glyph, "Double-click to upload"; hover
  tints brand. View role: same box, "No image". `[QB10]`
- **Loading**: pulsing slate box with the element's radius. **Broken**: rose box, broken glyph,
  "Image unavailable". **Ready**: bitmap on white in every theme (D47), `objectFit` (default
  `contain`), radius from `borderRadius` (default 4 px) (D48).
- **Picker** (`Dialog`, `size="2xl"`, title "Image"): tabs "Upload" and "Gallery (n)".
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
| O1  | `scheduleSweep`, success      | `console.log`   | `image sweep: deleted <n> images older than <cutoff>`                              |
| O2  | `scheduleSweep`, failure      | `console.error` | `image sweep failed` + error                                                       |
| O3  | Upload rejection (GB5)        | `console.warn`  | `[images] rejected reason=<token> owner=<id> type=<ct> bytes=<n>`                  |
| O4  | Upload stored / deduped (GB5) | `console.info`  | `[images] stored id=<id> bytes=<n> stripped=<bool>` / `deduped via=<header\|body>` |
| O5  | Delete (GB5)                  | `console.info`  | `[images] deleted id=<id>`                                                         |
| O6  | Client upload failure (GB5)   | `console.warn`  | `[image-upload] failed code=<token>`                                               |

O1 and O2 exist. O3 to O6 do not; Observability stays unchecked until GB5 lands.

## Testing

| Rule                                                 | Test                                           | File                                           |
| ---------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| 503 without R2                                       | `503 when the R2 binding is absent`            | `apps/api/src/routes/images.test.ts`           |
| Owner required                                       | `400 listing the gallery with no owner`, usage | `apps/api/src/routes/images.test.ts`           |
| Gallery is owner-scoped                              | `200 lists the owner-scoped gallery`           | `apps/api/src/routes/images.test.ts`           |
| Read: owner, share + reference, 404 otherwise        | four byte-read tests                           | `apps/api/src/routes/images.test.ts`           |
| Tab-scoped read                                      | `asks whether the scoped tab…`                 | `apps/api/src/routes/images.test.ts`           |
| Delete: owner, idempotent, 403                       | three DELETE tests                             | `apps/api/src/routes/images.test.ts`           |
| Upload guard order, caps, dedupe, strip, 415s        | none (GB2)                                     | `apps/api/src/routes/images.test.ts`           |
| Magic-number sniff, SVG rejected                     | `sniffImageType` suite                         | `apps/api/src/image-sniff.test.ts`             |
| JPEG strip (APPn, COM, SOS verbatim, throws)         | `stripJpegMetadata` suite                      | `apps/api/src/image-strip.test.ts`             |
| Summary hides `owner_id` / `sha256`                  | `imageRowToSummary` suite                      | `apps/api/src/image-row.test.ts`               |
| Whitelist, cap, no SVG                               | `MAX_IMAGE_BYTES`, `ACCEPTED_IMAGE_TYPES`      | `packages/api-schema/src/image-limits.test.ts` |
| Store-wide reference scan                            | `unusedImageIds` suite                         | `apps/api/src/db/images.test.ts`               |
| Unparseable body keeps named candidates              | exists with the opposite assertion `[QB6]`     | `apps/api/src/db/images.test.ts`               |
| Sweep order, paging, chunks, no-R2 no-op             | none (GB3)                                     | `apps/api/src/db/images.test.ts`               |
| Snapshot embeds, missing keeps placeholder           | two `getDocumentThumbnailSvg` tests            | `apps/api/src/thumbnail.test.ts`               |
| Embed budget in document order                       | `spends a total budget in document order…`     | `packages/api-schema/src/embed-images.test.ts` |
| Export embeds `<image>`, placeholder without href    | `image elements` suite                         | `packages/document/src/svg-render.test.ts`     |
| Client gate: type, size, empty, error mapping        | `uploadImageFile` suites                       | `apps/live/lib/upload-image.test.ts`           |
| Upload headers, 503 → null                           | `apiUploadImage`, `apiListImages` suites       | `apps/live/lib/api-client.test.ts`             |
| Placeholder factory, aspect lock on                  | `createImage drops a 200x150 placeholder…`     | `packages/document/src/factories.test.ts`      |
| No colour controls                                   | `supportsColours covers … not text or image`   | `packages/document/src/geometry.test.ts`       |
| Offline data-URI rewrite                             | `offline-images` suites                        | `apps/live/lib/offline/offline-images.test.ts` |
| Palette hides without R2 `[QB1]`                     | none                                           |                                                |
| Set / Cleared image log `[QB4]`                      | none                                           |                                                |
| Picker, placeholder states, paste, export in browser | none (GB8)                                     |                                                |
| Escaped `href`, validated `imageId` (GB1)            | none                                           |                                                |

## Constants and configuration

| Name                        | Value                                    | Provenance / safe range                                    |
| --------------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `MAX_IMAGE_BYTES`           | `10 * 1024 * 1024`                       | Spec per-file cap; below the 100 MB Workers body limit     |
| `MAX_IMAGE_MB`              | `10`                                     | Derived, for copy                                          |
| `ACCEPTED_IMAGE_TYPES`      | png, jpeg, webp, gif                     | Spec whitelist; SVG must never join                        |
| `MAX_BODY_BYTES`            | `8 * 1024 * 1024`                        | Non-image write cap in `limits.ts`                         |
| `IMAGE_MAX_PER_OWNER`       | unset (hosted intent `100`)              | `[vars]`; positive integer or unset `[QB9]`                |
| `IMAGE_MAX_BYTES_PER_OWNER` | unset (hosted intent `104857600`)        | `[vars]`; positive integer or unset `[QB9]`                |
| `IMAGE_EMBED_BUDGET_BYTES`  | `3 * 1024 * 1024`                        | Spec; 1 to 8 MiB keeps snapshots streamable                |
| `UNUSED_IMAGE_RETENTION_MS` | `30 * 24 * 60 * 60 * 1000`               | Spec 30-day floor; never below a week                      |
| `IMAGE_DELETE_CHUNK`        | `1000`                                   | R2 `delete()` key limit; must stay ≤ 1000                  |
| `SCAN_PAGE`                 | `200`                                    | Sweep page (D39); bounded by 200 × `MAX_TAB_BYTES` memory  |
| Read `Cache-Control`        | `private, max-age=86400`                 | Spec; `private` is load-bearing                            |
| Sniff window                | first 16 bytes, minimum 12               | Longest signature (WebP) needs 12                          |
| Gallery placement size      | `240` px on the longer side              | D40; literal `max` in `addImageFromGallery`                |
| `createImage` size          | 200 × 150                                | D49                                                        |
| `WRITE_RATE_LIMITER`        | 300 per 60 s                             | `wrangler.toml`, namespace `1001`                          |
| Cron                        | `0 3 * * *`                              | Shared daily trigger, production and staging               |
| Buckets                     | `livediagram-images`, `…-images-staging` | Separate so the staging sweep cannot reap production bytes |
