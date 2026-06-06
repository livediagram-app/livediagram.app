# Image element + per-owner gallery

Users can drop an image element on the canvas, upload the bytes, and reuse anything they've previously uploaded from a per-owner gallery. Images live in Cloudflare R2, with a D1 table indexing them. See [05-diagram-structure.md](05-diagram-structure.md) for the broader element model and [11-api.md](11-api.md) for the API conventions this spec extends.

## Element model

A fourth element kind alongside `ShapeElement` / `TextElement` / `StickyElement` / `ArrowElement` (see [05](05-diagram-structure.md)). Canonical type in `packages/diagram/src/index.ts`:

```ts
type ImageElement = {
  id: ElementId;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  // R2 object key for the uploaded bytes. Null when the user has
  // dropped a placeholder but not yet picked an image (the canvas
  // renders the empty-state thumbnail in that case). Once set, the
  // element renders `/api/images/<imageId>` via `<img>`.
  imageId: string | null;
  // Captured from the upload's natural dimensions so the renderer
  // can preserve aspect ratio when the user resizes via a corner
  // handle. Not load-bearing for layout (the element's own
  // width/height drive the box); just kept around for the "reset
  // to natural size" affordance and for the aspect-lock default.
  naturalWidth?: number;
  naturalHeight?: number;
  // Optional alt text (accessibility + future export-to-markdown).
  alt?: string;
  // Inherited from the boxed-element shared fields:
  locked?: boolean;
  groupId?: ElementId;
  opacity?: number;
  link?: ElementLink;
};
```

`ImageElement` is treated as a boxed element by `isBoxed()`, so move / resize / lock / group / link / format-painter all work without per-kind branches. `supportsColours()` returns false: images don't carry fill / stroke / text colour fields.

Resizing aspect-locks by default (the image's `naturalWidth:naturalHeight` ratio) so the user doesn't accidentally squash the picture. Holding Shift during a corner drag breaks the lock, matching the existing aspect-lock toggle convention.

## Storage

- **R2 bucket:** `livediagram-images`. Binding name `IMAGES` in `apps/api/wrangler.toml`. One bucket per environment (preview + production declared separately).
- **D1 table:** `images`, added as `apps/api/migrations/0014_images.sql`:
  ```sql
  CREATE TABLE images (
    id              TEXT PRIMARY KEY,           -- R2 object key (uuid v4)
    owner_id        TEXT NOT NULL,
    content_type    TEXT NOT NULL,              -- 'image/png' etc, narrowed at upload
    byte_size       INTEGER NOT NULL,
    width           INTEGER NOT NULL,
    height          INTEGER NOT NULL,
    sha256          TEXT NOT NULL,              -- hex; (owner_id, sha256) is unique
    original_name   TEXT,                       -- optional, surfaces in the gallery
    created_at      INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX images_owner_sha_idx ON images (owner_id, sha256);
  CREATE INDEX images_owner_created_idx ON images (owner_id, created_at DESC);
  ```
  Per-owner sha index drives dedupe: a second upload of the same bytes by the same owner reuses the existing row without touching R2.
- **R2 object lifecycle:** the object key matches `images.id` so the API layer can read+delete without a separate lookup. Object metadata carries `owner_id` and `content_type` so a future garbage collector can verify orphans without joining D1.
- **EXIF stripping on upload.** The api worker walks the JPEG byte stream and drops every APP1 (Exif), APP0 (JFIF metadata blob), APP2 (ICC profile), and COM (comment) marker segment before writing to R2. Strips GPS coordinates, camera serial, original-filename / software fields, and any other identifying metadata a phone may have embedded. Pure byte-level rewrite (no JPEG decode required): the image content stays bit-identical, only the metadata segments are removed. PNG / WebP / GIF aren't currently stripped (they carry less identifying metadata by convention; revisit if a real-world leak shows up).

## Accepted formats and limits

### Format whitelist

| MIME                                     | Verdict | Why                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image/png`                              | ✓       | Canonical for screenshots + UI mocks + anything needing transparency. Universal browser support in `<img>`.                                                                                                                                                                                                                                                                                          |
| `image/jpeg`                             | ✓       | Phone photos + any user export from another tool. Universal browser support in `<img>`. EXIF / JFIF / ICC / comment markers are stripped server-side before R2 write (see [Storage](#storage)) so GPS + camera-serial metadata never leaks to share-link visitors.                                                                                                                                   |
| `image/webp`                             | ✓       | Modern format the user might paste straight from a screenshot tool; ~30 % smaller than PNG / JPEG at the same quality. Supported in every browser livediagram targets (Chrome 32+, Firefox 65+, Safari 14+).                                                                                                                                                                                         |
| `image/gif`                              | ✓       | Animated screen recordings + diagrams referencing existing memes / annotations. Renders fine via `<img>`; animation plays automatically. No special handling.                                                                                                                                                                                                                                        |
| `image/svg+xml`                          | ✗       | SVG is XML and can carry inline `<script>`, `foreignObject`, external `<image href>`, and `xlink:href` payloads that bypass `<img>`'s sandbox or fire side-effect network requests. Serving user-uploaded SVG would be an XSS / SSRF surface unless every upload were sanitised server-side, which is out of scope. Rejected with a "convert to PNG and re-upload" hint in the picker error message. |
| `image/avif`                             | ✗       | Best modern compression but Safari support landed only late 2022; a non-trivial subset of share-link visitors still on older Safari would see broken images. Revisit when the support baseline shifts.                                                                                                                                                                                               |
| `image/heic` / `image/heif`              | ✗       | iPhone photo default. No native `<img>` support outside Safari. Rejected with a "save as JPEG and re-upload" hint.                                                                                                                                                                                                                                                                                   |
| `image/bmp` / `image/tiff` / `image/ico` | ✗       | Not canvas-grade; uncompressed BMP can be 50 MB for a screen-sized image. Rejected.                                                                                                                                                                                                                                                                                                                  |

Server-side enforcement: the upload endpoint checks `Content-Type` against the whitelist + sniffs the first ~16 bytes against the expected magic numbers, so a malicious client can't slip an SVG through by lying about its `Content-Type`. Rejected requests return 415 with `{ error: 'unsupported-type', acceptedTypes: [...] }` so the client can rebuild its picker error copy without hardcoding the list.

### Size cap

- **Per-file cap: 10 MB.** Sits comfortably above typical phone JPEGs (2–4 MB) and 4K screenshots (~3–6 MB as PNG), while staying well below the Workers request-body limit (100 MB). Going higher hurts the picker UX (long uploads on slow networks) without serving real diagram content; canvas images render at thumbnail or modest sizes, so an 8K original is wasted bytes.
- **Per-owner soft cap: configurable via two env vars** in the api worker, `IMAGE_MAX_PER_OWNER` and `IMAGE_MAX_BYTES_PER_OWNER` (decimal strings, parsed with `parseInt`). Hosted livediagram.app sets them to `100` and `104857600` (100 MB) respectively. Both are optional: unset, blank, `0`, or non-numeric values read as "no limit", which is the OSS self-host default where the operator runs their own storage budget (see [03](03-open-source-and-business-model.md)). When either cap is exceeded the worker returns 403 with `{ error: "gallery-full", reason: "count" | "bytes", limit, current }` so the client can render an accurate message.
- Enforcement order on POST: `Content-Length` against the per-file cap first (rejects oversize uploads before any D1 round-trip), then an early `X-Image-Sha256` dedupe lookup (returns the existing image without parsing the body when the header matches a row at `(owner, sha)`), then per-owner totals against the soft cap (a single grouped `COUNT + SUM(byte_size) WHERE owner_id = ?` query). Only uploads that clear all three actually parse the body and write to R2.

## API endpoints

Added to the existing routes in [11-api.md](11-api.md). All JSON except where noted.

| Method | Path                | Auth          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | ------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/images`       | owner         | List the owner's gallery, newest first. Returns `{ images: ImageSummary[] }` where `ImageSummary = { id, contentType, byteSize, width, height, originalName?, createdAt }`. Drives the "Pick from gallery" tab of the upload modal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| POST   | `/api/images`       | owner         | Body: raw bytes. Headers: `Content-Type: <accepted>`, `Content-Length`, `X-Image-Sha256: <hex>`, `X-Image-Width: <px>`, `X-Image-Height: <px>`, optional `X-Image-Original-Name`. Client computes the sha + reads dimensions before posting. Server checks `(owner_id, sha256)` for an existing row and short-circuits without an R2 write when found. Returns `{ image: ImageSummary, deduped: boolean }`.                                                                                                                                                                                                                                                                                                                         |
| GET    | `/api/images/:id`   | owner / share | Returns the image bytes. Authorisation checks, in order: (1) image's `owner_id` matches the caller's resolved owner; (2) the query param `?d=<diagramId>` is present, the caller has read access to diagram `d` (owner or a valid X-Share-Code for it), AND diagram `d`'s tabs reference image `id` in at least one `ImageElement`. Otherwise 404 (no existence leak). Response carries `Cache-Control: private, max-age=86400` so each authorised viewer caches their own copy on disk without leaking through a shared CDN. The id stays content-addressed via the sha index so the body itself can't go stale within the cache window. Bytes are never served unauthenticated; an attacker can't guess UUIDs out of the gallery. |
| DELETE | `/api/images/:id`   | owner         | Removes the R2 object + the D1 row. Returns 200 even if the image is still referenced by an `ImageElement` in some tab (the renderer's broken-image fallback covers that case). Documented as "deletes from gallery; existing references break."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| GET    | `/api/images/usage` | owner         | Inverse index of which of the owner's diagrams reference each owned image. Returns `{ usage: Record<imageId, { id, name }[]> }`. Single D1 scan: join `diagrams → diagram_tabs → tabs` for the owner, JSON-parse each `tabs.data`, walk the image elements. Images with no references are omitted from the map (treat a missing key as "unused"). Drives the Explorer Image Gallery's "Used in N diagrams" badge ([spec/15](15-folders.md)). Returns `{ usage: {} }` (a 503 to the caller) when the api worker has no R2 binding, so the explorer page renders an empty gallery instead of erroring.                                                                                                                                |

`ImageSummary` is added to `packages/api-schema/src/index.ts` so the client and server can't drift on the shape.

## Frontend wiring

### Palette

A new **Image** entry in the Palette's **Tools** accordion (see [09](09-canvas-and-command-palette.md)). Same staggered-placement + auto-select behaviour as the other Add buttons. Drops a 200 × 150 `ImageElement` with `imageId: null` at the centre of the visible viewport.

### Placeholder rendering

When `imageId === null`, `<ImageElementView>` (new component in `apps/live/components/`) renders a dashed-border box with a centred "image" SVG icon and the text "Click to upload". Clicking opens the image picker modal (below). The placeholder is interactive only for the diagram owner / edit-role share visitor; view-role visitors see the placeholder grayed out and read-only.

### Image picker modal

New `apps/live/components/ImagePicker.tsx`, lazy-loaded via `next/dynamic` (matches the other on-demand modals like `ExportTabDialog` and `ShareDialog`). Two-tab modal:

- **Upload tab.** Drag-and-drop zone + file-input fallback. On drop:
  1. Client checks the file's content type + size against the accepted list / cap.
  2. Client reads the file into an `ArrayBuffer`, computes the SHA-256 via `crypto.subtle.digest`, decodes width/height via a transient `<img>` + `URL.createObjectURL`.
  3. POSTs to `/api/images` with the sha + dimensions in headers. If `deduped: true`, the modal flashes "Already in your gallery" and selects the existing image.
  4. The element's `imageId` is set to the returned id; the modal closes.
- **Gallery tab.** Renders `apiListImages()` as a 4-column grid of thumbnails (re-uses `/api/images/:id` with native `<img>` lazy loading). Hovering a tile surfaces a small "Use" button + a trash icon for delete. Clicking a tile sets the element's `imageId` and closes.

The modal also surfaces the soft-cap usage as a tiny bar at the bottom ("3.2 / 100 MB used") so users see the cap before they hit it.

When the picker is opened for an element that already has an attached image, a **Remove from element** action sits in the modal footer. It clears the element's `imageId` (returning the canvas back to the placeholder state) and drops `naturalWidth` / `naturalHeight` so a later "Reset to natural size" doesn't snap to stale dimensions. The gallery copy is untouched; users can re-attach the same image (or a different one) without re-uploading.

### Resize behaviour

Image elements gain a "Reset to natural size" entry in the right-click context menu, which sets `width = naturalWidth, height = naturalHeight`. Aspect lock defaults to true on first paint (the user can explicitly unlock via the Shape accordion's existing aspect-lock toggle, which works on ImageElement the same way it works on shapes).

## Self-host degradation

R2 is a Cloudflare-only binding. Self-hosters on alternative runtimes (Node, Bun, other edge providers) won't have it. To keep [spec/03](03-open-source-and-business-model.md)'s self-host promise intact:

- `apps/api/src/types.ts`: `Env.IMAGES` is optional. When unbound, every `/api/images*` endpoint returns 503 with `{ error: 'images-unavailable' }`.
- `apps/live/components/ImagePicker.tsx`: a 503 response surfaces as a friendly "Image uploads aren't enabled on this deployment" notice instead of a generic error.
- The Image palette entry hides entirely when a probe `GET /api/images` returns 503, so self-hosters without R2 don't see a dead-end button.
- A future "S3-compatible storage" adapter can land alongside without changing the schema or the client (the R2 calls are wrapped in a thin `apps/api/src/storage/r2.ts` module so a Node-fs / S3 alternative slots in).

## Realtime

Image uploads / deletes don't go through the realtime room. The element's `imageId` change is just another field mutation, carried by the existing `update-element` op + the per-tab autosave (see [11-api.md](11-api.md) realtime model). Other participants pull the bytes lazily on next render. No special "upload progress" broadcast in v1.

## Activity log

`Set image` + `Cleared image` entries land in the change log per [12-activity-and-audit.md](12-activity-and-audit.md). Revert restores the prior `imageId` (which may resolve to a still-live image, a deleted one rendering broken, or `null`). Clearing the image doesn't delete the gallery row — gallery management is a separate gesture in the picker modal.

## Out of scope (for the first slice)

- **EXIF on non-JPEG formats.** PNG / WebP / GIF can technically embed XMP / EXIF chunks too. v1 strips JPEG metadata only because that's where ~all real-world leaks come from (phone-camera output). Stripping the other formats would require per-format chunk parsers; revisit if a leak case surfaces.
- **Image cropping / rotation.** The picker accepts the file as-is. Resize works via the existing canvas handles.
- **Per-image share links.** The same image can be referenced by multiple diagrams of the same owner; the diagram-scoped `GET /api/images/:id?d=<diagramId>` read endpoint covers cross-diagram sharing for visitors holding a share code, without any per-image plumbing.
- **CDN / image-optimisation.** Cloudflare's edge cache (via the `immutable` Cache-Control) is the only transform layer in v1. No on-the-fly resize / format conversion. Future: Cloudflare Image Resizing or a custom transform Worker.
- **External-source image clipboard via `navigator.clipboard.read()`.** v1's Cmd+V image-paste path listens to the browser's native `paste` event and reads `clipboardData.items`, which is permissionless. The picker modal + drag-drop + the `paste` shortcut (Cmd/Ctrl+V on the canvas, image MIME on the clipboard data routes through `uploadImageFile` and lands as a new image element) are the entry paths today; `navigator.clipboard.read()` (which would let us probe the clipboard on a button click without requiring an actual paste gesture) needs the browser's clipboard-read permission prompt and isn't wired.
- **External-URL images.** No `imageId === 'https://...'` shape. Every image is internal so the bytes survive an upstream taking the source down + don't leak referrer headers.
