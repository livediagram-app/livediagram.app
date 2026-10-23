# Image element + per-owner gallery

Users can drop an image element on the canvas, upload the bytes, and reuse anything they've previously uploaded from a per-owner gallery. Images live in liveworkspace's media service ([liveworkspace/docs/media.md](../../../../liveworkspace/docs/media.md)), which keeps every app's uploads, so a person's gallery follows them across the suite; this api keeps who may see what and serves the bytes. See [Document structure](../006-document/document-structure.md) for the broader element model and [API app](../015-api/api.md) for the API conventions this spec extends.

## Element model

An element kind alongside `ShapeElement` / `TextElement` / `StickyElement` / `ArrowElement` (see [Document structure](../006-document/document-structure.md)). Canonical type in `@livedocuments/document` (declared in `src/element-types.ts` with the other boxed elements, re-exported through the package):

```ts
type ImageElement = {
  id: ElementId;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  // The image's id in the media service. Null when the user has
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
  // Creator + licence credit of a picture picked from Image search
  // (image-search.md); absent for uploads.
  credit?: ImageCredit;
  // Inherited from the boxed-element shared fields:
  locked?: boolean;
  opacity?: number;
  link?: ElementLink;
};
```

`ImageElement` is treated as a boxed element by `isBoxed()`, so move / resize / lock / link / format-painter all work without per-kind branches. `supportsColours()` returns false: images don't carry fill / stroke / text colour fields.

Resizing aspect-locks by default (the image's `naturalWidth:naturalHeight` ratio) so the user doesn't accidentally squash the picture. Shift does not break the lock: it only constrains a resize whose lock is off, matching the existing aspect-lock toggle convention. To stretch an image freely, turn its aspect lock off.

## Storage

- **The media service** holds the bytes, one row per image, the dedupe (per person and bytes, across every app), the per-person caps and the EXIF stripping ([media.md](../../../../liveworkspace/docs/media.md) "Uploads"). The api calls it with `MEDIA_KEY` (`apps/api/src/media.ts`); a guest's id never leaves this api, which names a guest to the service by a hash of it.
- **`media_images`** (in `apps/api/migrations/0001_livedocuments_baseline.sql`): whose each image is, as this api names owners, for every image it has met: one uploaded here, one listed in someone's gallery here, or one a document asked for (asked of the service once, and remembered, `''` for an id it doesn't know). The [placement grants](#placement-grants) read it.
- **The `livedocuments-images` bucket** (`livedocuments-images-staging` on staging) keeps document snapshots and share cards (`thumb/`, `og/`), never an uploaded image.

## Accepted formats and limits

### Format whitelist

| MIME                                     | Verdict | Why                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image/png`                              | ✓       | Canonical for screenshots + UI mocks + anything needing transparency. Universal browser support in `<img>`.                                                                                                                                                                                                                                                                                          |
| `image/jpeg`                             | ✓       | Phone photos + any user export from another tool. Universal browser support in `<img>`. EXIF / JFIF / ICC / comment markers are stripped by the media service before it stores the bytes (see [Storage](#storage)) so GPS + camera-serial metadata never leaks to share-link visitors.                                                                                                               |
| `image/webp`                             | ✓       | Modern format the user might paste straight from a screenshot tool; ~30 % smaller than PNG / JPEG at the same quality. Supported in every browser livedocuments targets (Chrome 32+, Firefox 65+, Safari 14+).                                                                                                                                                                                       |
| `image/gif`                              | ✓       | Animated screen recordings + diagrams referencing existing memes / annotations. Renders fine via `<img>`; animation plays automatically. No special handling.                                                                                                                                                                                                                                        |
| `image/svg+xml`                          | ✗       | SVG is XML and can carry inline `<script>`, `foreignObject`, external `<image href>`, and `xlink:href` payloads that bypass `<img>`'s sandbox or fire side-effect network requests. Serving user-uploaded SVG would be an XSS / SSRF surface unless every upload were sanitised server-side, which is out of scope. Rejected with a "convert to PNG and re-upload" hint in the picker error message. |
| `image/avif`                             | ✗       | Best modern compression but Safari support landed only late 2022; a non-trivial subset of share-link visitors still on older Safari would see broken images. Revisit when the support baseline shifts.                                                                                                                                                                                               |
| `image/heic` / `image/heif`              | ✗       | iPhone photo default. No native `<img>` support outside Safari. Rejected with a "save as JPEG and re-upload" hint.                                                                                                                                                                                                                                                                                   |
| `image/bmp` / `image/tiff` / `image/ico` | ✗       | Not canvas-grade; uncompressed BMP can be 50 MB for a screen-sized image. Rejected.                                                                                                                                                                                                                                                                                                                  |

Server-side enforcement: the upload endpoint checks `Content-Type` against the whitelist + sniffs the first ~16 bytes against the expected magic numbers, so a malicious client can't slip an SVG through by lying about its `Content-Type`. Rejected requests return 415 with `{ error: 'unsupported-type', acceptedTypes: [...] }` so the client can rebuild its picker error copy without hardcoding the list.

### Size cap

- **Per-file cap: 10 MB.** Sits comfortably above typical phone JPEGs (2–4 MB) and 4K screenshots (~3–6 MB as PNG), while staying well below the Workers request-body limit (100 MB). Going higher hurts the picker UX (long uploads on slow networks) without serving real diagram content; canvas images render at thumbnail or modest sizes, so an 8K original is wasted bytes.
- **Per-person cap: 100 images and 100 MB, across every app**, kept by the media service. When either is reached the upload answers 403 with `{ error: "gallery_full", reason: "count" | "bytes", limit, current }`, passed on as the service sent it, so the client can render an accurate message.
- Enforcement order on POST: this api checks the declared type and `Content-Length` against the per-file cap first, so a refused file never leaves the worker; the service then answers an early `X-Image-Sha256` dedupe without the body (sent only for the owner's own editor or a guest: a [workbench session](../013-workspace/workbench-embeds.md) or an API token uploads the body, which still dedupes on its real hash, because the shortcut would otherwise hand them the matching gallery row for nothing more than a hash), checks the caps, sniffs the bytes and stores them. The caps ride inside the row's insert, so uploads racing each other (the [Import image pipeline](../020-import-export/import-image-pipeline.md) sends three at once) cannot together pass one; a refused insert answers the same 403, or 409 `{ error: "upload_conflict" }` when the gallery has room again by then, and the client may retry.

## API endpoints

Extends the routes in [API app](../015-api/api.md). All JSON except where noted.

| Method | Path                | Auth          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------ | ------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/images`       | owner         | List the owner's gallery, newest first: every image they uploaded in any liveworkspace app, from the media service. Returns `{ images: ImageSummary[] }` where `ImageSummary = { id, contentType, byteSize, width, height, originalName?, createdAt }`. Each listed image is remembered in `media_images` as the owner's, so a document of theirs placing one uploaded in another app serves it. Drives the "Pick from gallery" tab of the upload modal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| POST   | `/api/images`       | owner         | Body: raw bytes. Headers: `Content-Type: <accepted>`, `Content-Length`, `X-Image-Sha256: <hex>`, `X-Image-Width: <px>`, `X-Image-Height: <px>`, optional `X-Image-Original-Name`. Client computes the sha + reads dimensions before posting. This api checks the declared type and length, then hands the upload to the media service, which answers an existing image of the same owner and bytes (from any app) without storing it again. The image is remembered in `media_images` as the uploader's. Returns `{ image: ImageSummary, deduped: boolean }`, or the service's refusal as it sent it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| GET    | `/api/images/:id`   | owner / share | Returns the image bytes. Authorisation checks, in order: (1) the image's owner (from `media_images`, else asked of the media service once and remembered) matches the caller's resolved owner; (2) the query param `?d=<documentId>` is present, the caller has read access to document `d` (owner or a valid X-Share-Code for it), AND one of document `d`'s tabs references image `id` (a tab-scoped visitor's tab only, [Tab-scoped share links](../013-workspace/tab-scoped-share-links.md)), answered by the document itself from its [reference index](#reference-index) without reading a tab body (`placesImage`, so an image placed a moment ago serves at once), AND document `d` may serve it: the image's owner owns `d`, the image's owner may place it there right now, or `d` holds a [placement grant](#placement-grants) for it. The two questions run in parallel. Otherwise 404 (no existence leak). Only then are the bytes fetched from the media service and sent on, with `X-Content-Type-Options: nosniff` and `Cache-Control: private, max-age=86400` so each authorised viewer caches their own copy on disk without leaking through a shared CDN. An image's bytes never change under its id, so the cache can't go stale. Bytes are never served unauthenticated; an attacker can't guess UUIDs out of the gallery. |
| DELETE | `/api/images/:id`   | owner         | Deletes the image from the owner's gallery in every app: the media service removes its row, then its bytes, and answers 403 when the caller is not its owner. This api then drops its `media_images` row. Returns 200 even if the image is still referenced by an `ImageElement` in some tab, here or in another app (the renderer's broken-image fallback covers that case). Documented as "deletes from gallery; existing references break."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| GET    | `/api/images/usage` | owner         | Inverse index of which of the owner's documents reference each owned image. Returns `{ usage: Record<imageId, { id, name }[]> }`. One D1 query: the owner's `documents → document_images` (each document's set, pushed from its [reference index](#reference-index)), no tab body read, each document listed once per image. Images with no references are omitted from the map (treat a missing key as "unused"). It lists this app's documents only. Drives the Explorer Image Gallery's "Used in N documents" badge ([Folders](../013-workspace/folders.md)). Answers 503 when this deployment has no media service, so the explorer page renders an empty gallery instead of erroring.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

`ImageSummary` lives in `packages/api-schema/src/index.ts` so the client and server can't drift on the shape.

## Frontend wiring

### Palette

The **Image** entry (`tools:image`) in the Palette's **Media** section (see [Canvas and palette](../008-canvas/canvas-and-palette.md)). Like the other draw-capable tools, picking it arms the draw-to-size gesture: a tap drops a default-size `ImageElement` (`imageId: null`) and a drag sizes it. The new image lands selected as its empty placeholder; no picker opens on its own. Its **Select Image** button, or a double-click, opens the picker when the person is ready (below).

### Placeholder rendering

When `imageId === null`, `<ImageElementView>` (`apps/editor/components/canvas/ImageElementView.tsx`) renders the app's [empty state](../004-interface-design/empty-states.md) on the canvas (`ImageEmptyFace`): a dashed-border box holding the image glyph in a badge with two soft rings, the heading **No image yet**, the line **Upload one, or pick from your gallery.** and a **Select Image** button. The button opens the image picker modal (below), as a double-click anywhere on the box does; a single click on the box selects it, so it can still be moved and resized, while a press on the button never starts a drag or a selection. A hover lifts the badge and tints the outline (held still under reduced motion).

- **Share roles.** An Editor (the document owner, an edit-role visitor) gets the button, the double-click and the hover tint. A Participant or a Viewer, who cannot change the element, sees the badge and **No image yet** only, with no button, no line and no hover tint.
- **Trimmed to the box.** The face is drawn at its regular empty-state size (a 40 px badge, a 13 px heading, a 12 px line, a 28 px button) and grows with the box up to three times that, filling no more than about three fifths of it so the box still reads as a frame. A box too small for the whole face drops the line, then the heading; one too small for the button shows the badge alone, and for an Editor the badge is then the button (named **Select Image**). A round box (`borderRadius: 'full'`, an avatar) fits its face inside the circle's inscribed square (`imageEmptyLayout`).

- **Inked for its paper, never the chrome.** The placeholder, the broken-image state (**Image unavailable**, rose) and the loading skeleton take the surface of the paper the element sits on: its page's where the page has a fill of its own ([Pages](../007-editor/pages-mode.md) "A dark page has light ink"), else the canvas's (`useElementSurface`). The app's light or dark appearance plays no part, so a cream or pastel-gradient page in dark chrome keeps a light box with dark ink, and a Midnight page in light chrome a dark box with light ink.
- **Dressed in the tab's theme.** On a tab whose theme has colours of its own (an element stroke, or a palette for a multi-colour theme), the empty placeholder looks like part of it: the body is the theme's element fill where that fill's lightness matches the paper, else the theme's accent (its element stroke, else its first palette colour) washed toward the paper (a pale tint on light paper, a deep shade on dark); the dashed outline, the badge and the button are the accent; the heading is the theme's element text (else the accent) and the line a softer shade of it; a hover deepens the outline toward the accent. The Default theme, and any theme without colours, leaves elements uncoloured and so keeps the neutral slate placeholder. The broken state stays rose: it is a warning, not content.
- **Opaque body, AA ink, whatever the theme.** Each state's body is opaque, so the ink's contrast is against the body alone and holds over any page fill, gradient or pattern. Where a theme colour falls short, it is pushed toward contrast keeping its hue, as the page re-inking does (`legibleOn`): lightened on a dark body, darkened on a light one, until the heading, the line and the hover outline reach 4.5:1 and the dashed outline and the accent 3:1; the button's label and the badge's glyph are white, the app's near-black or black, whichever reads best on the accent (always at least 4.5:1). The neutral tones are fixed values per surface (`IMAGE_PLACEHOLDER_TONE`, `IMAGE_BROKEN_TONE`, `IMAGE_SKELETON_BODY`), the themed ones derived by `imagePlaceholderTone` (both in `apps/editor/components/canvas/image-placeholder-look.ts`), never Tailwind theme tokens, which the chrome's `.dark` class redefines.
- **Only where the picker opens.** The Select Image button (and the badge as a button) shows only for someone who can pick a picture right now: an Editor, on a tab that is not locked and outside an embed. Everyone else, a Participant (who never places or swaps a picture), a Viewer or anyone on a locked tab, sees the same face with no button, never one that does nothing.
- **In the tab's font.** The face's words are set in the element's font, else the tab's theme font, as its page's text is (the app's sans where neither is set).
- **The broken state is sized to the box.** Its label is a tenth of the box's shorter side, between 10 and 40 canvas px, and the icon twice the label (at least 16 px, at most 40% of the shorter side) (`imagePlaceholderMetrics`). A box too small to hold the label under the icon shows the icon alone and carries the label as its accessible name.
- **Telemetry.** Pressing Select Image tracks `Element / Used / ImagePlaceholder`.

### Shown at the size they are seen

A picture is kept whole in the gallery, and exports draw the original, but the editor shows a copy
no larger than a screen can use (`apps/editor/lib/image-display.ts`): at most 2048 px on its longest
side on a phone or tablet (a coarse pointer), 4096 px elsewhere, and 512 px in a gallery tile.
A camera photo or a retina screenshot decodes to 25 to 100 MB of pixels whatever size it is drawn
at, and a phone closes a tab that holds too many, so a slide deck of a dozen screenshots on an
iPhone was closed while moving between its pages.

- **Made once, one at a time.** The copy is made when the picture is first shown, in the browser
  (decoded off the main thread, drawn smaller, saved as JPEG for a JPEG and PNG otherwise, so a
  transparent picture stays transparent), one picture after another so two large decodes never
  overlap. A picture that already fits, a GIF (whose frames a still copy would lose) and a browser
  without `createImageBitmap` show the original.
- **Shared by every view.** The last 24 copies are kept by picture and size, and every view of the
  same copy (an element used twice, a page background and an element) shows it through one URL,
  given back when its last view goes, so the browser decodes it once.
- **Never seen by others.** The copy lives in this browser's memory only; nothing about it is
  uploaded or stored.

### Image picker modal

`apps/editor/components/panels/ImagePicker.tsx`, lazy-loaded via `next/dynamic` (matches the other on-demand modals like `ExportTabDialog` and `ShareDialog`). Three-tab modal:

- **Upload tab.** Drag-and-drop zone + file-input fallback. On drop:
  1. Client checks the file's content type + size against the accepted list / cap.
  2. Client reads the file into an `ArrayBuffer`, computes the SHA-256 via `crypto.subtle.digest`, decodes width/height via a transient `<img>` + `URL.createObjectURL`.
  3. POSTs to `/api/images` with the sha + dimensions in headers. If `deduped: true`, the modal flashes "Already in your gallery" and selects the existing image.
  4. The element's `imageId` is set to the returned id; the modal closes.
- **Gallery tab.** Renders `apiListImages()` as a 4-column grid of thumbnails (re-uses `/api/images/:id` with native `<img>` lazy loading). Hovering a tile surfaces a small "Use" button + a trash icon for delete. Clicking a tile sets the element's `imageId` and closes.
- **Search tab.** Searches openly licensed pictures on Openverse and stores the picked one in the gallery, with a creator credit on the element. See [Image search](image-search.md).

The modal also surfaces the soft-cap usage as a tiny bar at the bottom ("3.2 / 100 MB used") so users see the cap before they hit it.

When the picker is opened for an element that already has an attached image, a **Remove from element** action sits in the modal footer. It clears the element's `imageId` (returning the canvas back to the placeholder state) and drops `naturalWidth` / `naturalHeight` so a later "Reset to natural size" doesn't snap to stale dimensions. The gallery copy is untouched; users can re-attach the same image (or a different one) without re-uploading.

### Imported images

Images an import brings in are
resized in the browser and stored through the same `POST /api/images`, under the same caps, by the
[Import image pipeline](../020-import-export/import-image-pipeline.md). Hitting the per-owner cap
there leaves placeholders and a count, never a failed import.

### Resize behaviour

`naturalWidth` / `naturalHeight` are captured on load so a future "Reset to natural size" affordance can snap back to them — but that menu entry is **not yet wired** (the right-click context menu currently exposes Link / Remove Icon / layer order / Note / Comment only). Aspect lock defaults to true on first paint (the user can explicitly unlock via the Shape accordion's existing aspect-lock toggle, which works on ImageElement the same way it works on shapes).

### Visual export (PNG / SVG / PDF)

The visual tab exporters embed the bitmap so an image / avatar element looks the same in a downloaded file as on the canvas, rather than a dashed placeholder. Because the bytes live behind the authenticated `GET /api/images/<id>` endpoint (a native `<img src>` can't send the owner / share headers), the export **prefetches** each referenced image as a base64 `data:` URL via `apiFetchImageDataUrl` (`apps/editor/lib/export-tab-images.ts` → `loadTabImages`), then threads a `imageId → bytes` map into the renderers:

- **SVG** inlines an `<image>` with the data URL (so the downloaded `.svg` stays self-contained), a per-element `clipPath` for the corner radius (a `full`-radius avatar clamps to a circle), and `preserveAspectRatio` mapping `objectFit` (`cover` → `slice`, `contain` → `meet`), over a white backing rect that matches the on-screen white background.
- **PNG / PDF** `ctx.drawImage` the decoded bitmap into the same rounded, clipped box (data URLs are same-origin, so the canvas isn't tainted and the PDF's `getImageData` read still works).

The decision is centralized in `describeBoxedExport` (`packages/document/src/svg-render-describe.ts`, re-exported through `svg-render.ts`), which carries `href` / `objectFit` / `radius` on the image `ExportShape` and takes an optional `resolveImageHref` resolver. A missing / failed image (or any caller that supplies no resolver) keeps the placeholder, so the snapshot degrades gracefully per-image.

### Preview / live image (server-rendered SVG)

The same `renderElementsToSvg` powers the headless snapshot behind the Explorer **preview** thumbnail (`GET /api/documents/:id/thumbnail`) and the public **live image** (`GET /api/share/:code/image.svg`) — both via `getDocumentThumbnailSvg`, drawn in the document's Durable Object where the content is (`renderDocumentImage`) ([Document SVG snapshots](../006-document/document-snapshots.md), [Live image share link](../013-workspace/live-image-share.md)). That path embeds images too: it runs server-side (no DOM, no fetch-with-auth), so instead of the browser's `apiFetchImageDataUrl` it reads each referenced id that the document [may serve](#placement-grants) from the media service, the same store the byte endpoint reads (an id it may not serve keeps the placeholder), base64-encodes the bytes with their stored content type, and passes the `resolveImageHref` resolver to the renderer. A per-snapshot **embed budget** (`IMAGE_EMBED_BUDGET_BYTES`, 3 MB raw) bounds how much bitmap is inlined so a photo-heavy document can't produce a multi-megabyte cached thumbnail; images past the budget (or unknown to the media service) keep the placeholder. The snapshot is cached in R2 and invalidated by `saved_at`, so swapping an element's image (an edit, which bumps `saved_at`) re-renders with the new bytes.

## Self-host degradation

Images need liveworkspace's media service. To keep [Open source + distribution](../002-project-scope/open-source-and-business-model.md)'s self-host promise intact:

- `apps/api/src/types.ts`: `Env.MEDIA_KEY` is optional. When unset, every `/api/images*` endpoint returns 503 with `{ error: 'images_unavailable' }`, as it does when the service refuses this api's key or is down.
- `apps/editor/components/panels/ImagePicker.tsx`: a 503 response surfaces as a friendly "Image uploads aren't enabled on this deployment" notice instead of a generic error.
- The Image palette entry hides entirely when a probe `GET /api/images` returns 503, so self-hosters without the media service don't see a dead-end button.
- Every call to the service goes through `apps/api/src/media.ts`, so another store could be slotted in from there without changing the client.

## Reference index

Which images a tab places lives in its `tabs.data` body, and that stays the source of truth. `image_refs` is a projection of it that SQL can query without reading a single tab body, so the media service's references, the usage map and share-visitor image reads scale with the number of references, not with the bytes of every tab.

It lives in the document's own SQLite, beside the tabs ([API app, Storage](../015-api/api.md#storage)):

```sql
-- apps/api/src/document-room/document-schema.ts
CREATE TABLE image_refs (
  tab_id   TEXT NOT NULL REFERENCES tabs (id) ON DELETE CASCADE,
  image_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, image_id)
) WITHOUT ROWID;
```

D1 holds each document's whole set, pushed by the document:

```sql
-- apps/api/migrations/0001_livedocuments_baseline.sql
CREATE TABLE document_images (
  document_id TEXT NOT NULL,
  image_id    TEXT NOT NULL,
  PRIMARY KEY (document_id, image_id)
) WITHOUT ROWID;
CREATE INDEX document_images_image_idx ON document_images (image_id);
```

- **What is a reference.** An element in the tab's top-level `elements` array with `type: 'image'` whose `imageId` is a gallery id: a string of 1 to 128 characters that is not a `data:` URI. So is a page's picture: a page in the tab's top-level `pages` array whose `background.fill` has `kind: 'image'` and a gallery `imageId` ([Pages](../007-editor/pages-mode.md) "Image backgrounds"). A placeholder (`imageId: null`) references nothing, and neither does a data URI (an [Offline Mode](../006-document/offline-mode.md) document embeds its bytes that way; it names no gallery row). Undo history and offline copies are not references.
- **Keyed by tab, in the tab's document.** A tab belongs to one document, so its references go with it: the foreign key to `tabs` drops them with the tab. `media_images` is no foreign key: a reference may name another owner's image, one this api has not met yet, or one deleted from its gallery.
- **Maintained in the body's own transaction.** Every write of `tabs.data` carries its index statements in the same batch, one transaction in the document's object, so the index can't drift from the body:
  - **Replace** (`upsertTab`: the autosave, which the realtime room and the MCP server reach through the tab PUT, and the comment / action routes; `seedTabs`: create, JSON import and Offline Mode's Sync Document): delete the tab's references not in the new set, then insert the new set, ignoring ones already there. A save that changes no image writes no index row.
  - **Copy** (`importDocumentCopy`, Copy to my files): the copy's references come from the copied body.
  - **Compare-and-swap** (`swapTabData`, a Participant's write): add only. The swap can lose to a concurrent save, and a delete would then remove references the winner wrote.
  - **Tab removal** (`deleteTabRow`) and **document removal** (the document's object deletes everything it stores): the references go with the tabs.
  - Any new writer of `tabs.data` maintains `image_refs` the same way. A census test fails when SQL writing `tabs` appears outside the known writers.
- **Pushed to D1.** A change to `image_refs`, or a tab added to or removed from the document, keys the document's outbox in the same transaction; the next push (within about a minute) replaces the document's `document_images` rows with its whole set, queues the document for the media service when the set changed, and writes the [placement grants](#placement-grants) the set earns, in one D1 batch (`document-room/document-outbox.ts`).
- **Trash.** A document in the Trash keeps its content, so its references stay live until the purge removes the document. The index needs nothing more for it.

## Placement grants

A reference alone does not let a document serve an image. Image ids are random, but anyone who can read a document sees the ids it places, and once they lose that access the id must not keep working because they wrote it into a document of their own. So a document serves an image only when **the image's owner owns the document**, or the document holds a **placement grant** for it.

```sql
-- apps/api/migrations/0001_livedocuments_baseline.sql
CREATE TABLE image_grants (
  document_id TEXT NOT NULL,
  image_id    TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (document_id, image_id)
) WITHOUT ROWID;
```

- **Served while the image's owner may place it, and granted on the push.** A document serves an image whose owner is at that moment a joined member of the document's team or an edit collaborator of it, so a placement serves at once. The document's push (see [Reference index](#reference-index)) writes a grant for each image of its set whose owner is so entitled at that moment, so the placement keeps serving once the entitlement ends. Entitled means a joined member of the document's team or an edit collaborator of it (a `shared_with` row with role `edit` whose link is still live: a visit through a revoked or expired link earns nothing, [Share roles](../013-workspace/share-roles.md#share-links)). The writer's identity is not needed: the rule asks whether the image's owner was entitled to place it there. An image the document's owner owns needs no grant.
- **An owner change grants what the owner placed.** When a document changes owner (a member leaving a team hands their work on; a team document moved into someone's own library; a guest's documents moving to their new account at sign-up, where an image whose bytes the account already holds stays on the guest id), every image its previous owner placed in it is granted to it in the same batch, since those served only by ownership. It reads the document's set from `document_images`, which lags a placement by up to a minute; an image placed in that window by the document's own owner, just before the owner change, is the one case a grant can miss.
- **Kept when the tie ends.** A grant outlives the membership or link that earned it, so a teammate who leaves, or a collaborator whose link is revoked, does not break the pictures they added for everyone else.
- **Carried by a copy.** `copyDocument` (Copy to my files, a tab-scoped copy) grants the new document every image of the copied tabs that the source document may serve. A copy cannot launder an image its source could not serve.
- **Not earned by pasting an id.** Placing another owner's image in a document that owner has no tie to (a pasted element, an imported file) writes no grant, so that document serves the placeholder. To reuse someone else's picture, copy their document or upload the picture.
- **Whose image it is** comes from `media_images` ([Storage](#storage)), as this api names owners. An image a document asks for that this api has not met yet is looked up in the media service on its first byte read and remembered; until then the rule finds no owner and the document needs a grant. A guest's image uploaded in another app has an owner name no one here has, so it serves only through a grant.
- **Readers.** The byte endpoint (`GET /api/images/:id?d=`, `documentMayServeImage`) and the server-rendered snapshots (preview, live image, tab render; `servableImageIds`) apply the rule; both answer it in one indexed D1 query. The image's owner always reads their own image directly.
- **Removal.** Document removal (`documentRemovalStatements`) deletes the document's grants and its `document_images` rows. A document in the Trash keeps them.
- **Refusals log** `[images] not servable by document` with the document and image ids, never an owner id.

## Retention (unused-image cleanup)

Images are swept by the media service ([media.md](../../../../liveworkspace/docs/media.md) "Retention"): once a day it deletes those older than 30 days that no document in any app places, once every app has told it which images its documents place. This api keeps no image bytes of its own to sweep, and tells the service from the reference index:

- **Queued with the change.** A document's push queues it in `media_ref_outbox` when its set differs from what D1 held, in the same batch as `document_images`, and a removed document that placed images is queued by its removal. A save that changes no image queues nothing.
- **Sent every minute.** The every-minute `* * * * *` cron sends at most 500 queued documents a run (`flushMediaRefs`), each with its whole set, a removed document's as empty. A document queued again while the run was sending stays for the next run.
- **Complete.** A run that empties the queue says `complete`, and so does the daily `0 3 * * *` run when nothing is queued, so a quiet app never holds the service's sweep up.
- **One request's worth per document.** A document placing more than 1,000 images is sent with its first 1,000 and logs `[media] a document places more images than one sync carries`; the gallery cap of 100 makes that unreachable for one owner.
- **Without the service** the queue is dropped on each run: there is nobody to tell.
- **Observability.** A failed send logs `[media] refs sync failed` with the service's answer, and the queue stays for the next run.
- **Tested against the real service.** The queue, the sends and the account calls run against the media service's own Worker over an in-memory database and bucket (`apps/api/src/test-media-service.ts`), and the index, its writers and the push against the real schemas in SQLite (`test-sqlite-d1.ts`).

## Realtime

Image uploads / deletes don't go through the realtime room. The element's `imageId` change is just another field mutation, carried by the existing `update-element` op + the per-tab autosave (see [API app](../015-api/api.md) realtime model). Other participants pull the bytes lazily on next render. There is no "upload progress" broadcast.

## Undo

Setting or clearing an image is one undoable step. Undo restores the prior `imageId` (which may resolve to a still-live image, a deleted one rendering broken, or `null`). Clearing the image doesn't delete the gallery row — gallery management is a separate gesture in the picker modal.

## Agents

An assistant places the user's own pictures through the MCP and the CLI; it never uploads them.

- **Finding a picture.** `list_images` (MCP, [MCP server §4.5b](../015-api/mcp-server.md#45b-list_images)) and
  `image ls` (CLI, [CLI](../015-api/cli.md)) list the caller's gallery (`GET /api/images`): each image's id, name,
  width, height, size and upload time, newest first, filtered by name. The MCP's `image: true` adds a contact sheet
  of the listed images, so an assistant can tell which screenshot is which without names that say so.
- **Placing it.** An `image` element takes the id as `imageId`, with optional `alt` and `objectFit`, on any write
  that takes elements (`create_document`, `add_tab`, `update_document`, a changeset). Before writing, the MCP checks
  every `imageId` the elements carry against the caller's gallery, in one gallery read for the whole call, and
  refuses one that is not there, naming the element and `list_images` (`imageId "…" on element "hero" is not in
your image gallery: list_images lists the pictures you can place`). That keeps the [placement
  grant](#placement-grants) rule honest: an id read from someone else's document would only draw a placeholder for
  everyone, so it is refused where it was typed rather than discovered later as a dashed box.
- **A placeholder on purpose.** An `image` element without `imageId` is the empty "pick an image" placeholder, which
  the user fills in the editor. An assistant laying out a page before the user has uploaded anything places
  captioned placeholders and says so.
- **Seeing it.** The MCP's preview embeds placed images ([Preview / live
  image](#preview--live-image-server-rendered-svg)), so the assistant's own picture of the page shows the
  screenshot, not a box.
- **Why no upload.** A chat assistant cannot hand an attachment's bytes to a tool, and a fetch from a URL would bring
  server-side requests to arbitrary hosts and pictures the user never chose. Pictures reach the gallery through the
  editor (upload, paste, drop or Image search), where the user chooses them.

## Out of scope

- **EXIF on non-JPEG formats.** PNG / WebP / GIF can technically embed XMP / EXIF chunks too. The media service strips only JPEG metadata, because that's where ~all real-world leaks come from (phone-camera output). Stripping the other formats would require per-format chunk parsers; revisit if a leak case surfaces.
- **Image cropping / rotation.** The picker accepts the file as-is. Resize works via the existing canvas handles.
- **Per-image share links.** The same image can be referenced by multiple documents of the same owner; the document-scoped `GET /api/images/:id?d=<documentId>` read endpoint covers cross-document sharing for visitors holding a share code, without any per-image plumbing.
- **CDN / image-optimisation.** Cloudflare's edge cache (via the `immutable` Cache-Control) is the only transform layer. No on-the-fly resize / format conversion. Future: Cloudflare Image Resizing or a custom transform Worker.
- **External-source image clipboard via `navigator.clipboard.read()`.** The Cmd+V image-paste path listens to the browser's native `paste` event and reads `clipboardData.items`, which is permissionless. The picker modal + drag-drop + the `paste` shortcut (Cmd/Ctrl+V on the canvas, image MIME on the clipboard data routes through `uploadImageFile` and lands as a new image element) are the entry paths today; `navigator.clipboard.read()` (which would let us probe the clipboard on a button click without requiring an actual paste gesture) needs the browser's clipboard-read permission prompt and is not used.
- **External-URL images.** No `imageId === 'https://...'` shape. Every image is internal so the bytes survive an upstream taking the source down + don't leak referrer headers. [Image search](image-search.md) copies a picked picture into the gallery for the same reason.
