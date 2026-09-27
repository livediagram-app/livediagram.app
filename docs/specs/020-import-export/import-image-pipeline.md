# Import image pipeline

Every importer that brings a board in from another tool (Excalidraw today; draw.io, Miro and
Microsoft Whiteboard next) meets the same problem: the source file carries image bytes, and a
livediagram image element carries an `imageId` that points into the owner's gallery
([Image element + per-owner gallery](../009-elements/images.md)). The import image pipeline is the
one browser-side path that turns those bytes into a stored image, so every importer migrates
images the same way, under the same limits, with the same named outcomes.

The goal it serves is migration: a person moving 100+ boards in from other tools should see their
images arrive, and when some cannot, see how many and why, never a failed import.

## Where it lives

`apps/live/lib/import-images/`, a folder of small modules, not a package:

- Every consumer is an importer in the live editor (`apps/live/lib/*-import.ts`); no other app
  imports boards.
- It needs the browser: canvas decoding and encoding (`createImageBitmap`, `<canvas>`), the
  editor's authenticated api client (`apiUploadImage`) and the Offline Mode store check. The MCP
  worker has none of these, and uploading from a worker would spend server CPU the browser can
  spend instead.
- The pure parts (encoding policy, outcome tallies, error mapping) are separate modules with no
  DOM, so they are unit-tested in Node and can move to a package unchanged the day a second app
  needs them.

## What goes in

An importer hands the pipeline an **image source**: bytes it found in the file, either as a
`data:` URL (Excalidraw's `files` map, draw.io's embedded styles) or as a `Blob` with a MIME type
(Miro and Whiteboard archives). It may add a **display hint**, the size of the element the image
will fill, used only to pick a sensible raster size for SVG.

The pipeline returns, per source, either a **stored image** (`imageId`, natural width and height,
and whether it was new, a duplicate, or embedded) or a **named failure**. It never throws for a bad
image: a failure leaves the element as an empty placeholder (`imageId: null`) the owner can
click to upload into later.

## The encoding policy

Images are resized and re-encoded **in the browser**, before upload, so the server only stores
and dedupes (hosted is free for everyone; server cost stays near zero).

- **Longest side 2048 px.** A image larger than that on either side is scaled down, keeping its
  aspect ratio. Smaller images are never scaled up.
- **WebP at quality 0.85** is the output format. Re-encoding through a canvas also drops every
  metadata block (EXIF, GPS, ICC, XMP), whatever the source format.
- **Keep the original when it is already good.** A PNG or JPEG within 2048 px is re-encoded, and
  the smaller of the two is uploaded. A WebP within 2048 px is kept as-is (a second lossy pass
  gains little).
- **GIF keeps its animation when it can.** A GIF within 2048 px and within the 10 MB per-file cap
  is uploaded unchanged, so an animated GIF stays animated. A larger one is flattened to its first
  frame and re-encoded as WebP.
- **SVG is rasterised.** The gallery refuses SVG for security, so the pipeline draws it through an
  `<img>` (where scripts never run and external references never load) onto a canvas, at twice the
  larger of its intrinsic size and the display hint, capped at 2048 px (1024 px when neither is
  known), and uploads the WebP. An SVG the browser refuses to draw (for instance one that taints
  the canvas) is a failure, `unsupported`.
- **Anything else the browser can decode** (AVIF, BMP, ICO, HEIC in Safari) is re-encoded to WebP,
  so a format the gallery refuses can still arrive.
- **When the canvas cannot encode WebP** (Safari: a canvas asked for a type it cannot write hands
  back a PNG), WebP comes from a **WASM build of libwebp** instead. Support is detected by the
  type of the blob the canvas returns, never by user agent, and remembered for the page so later
  images skip the wasted canvas attempt. The encoder is fetched on demand, only on such a browser,
  only once, as its own chunk plus one `.wasm` file (the SIMD build where the browser has SIMD,
  about 340 KB, else the plain one, about 280 KB), so it never reaches the editor's first bundle
  and a browser with native WebP never downloads it. See "The WASM WebP encoder" below.
- **When no WebP comes back at all** (the WASM encoder could not load or failed, or the canvas
  cannot be read), the output falls back to JPEG for a JPEG source and PNG for everything else.
  A failed load is retried on the next image rather than remembered.
- A source over **50 MB** is refused before decoding (`too-large`), so one enormous file cannot
  exhaust the tab's memory. An encoded result over the gallery's 10 MB per-file cap is refused
  too.

### The WASM WebP encoder

- **Package:** [`@jsquash/webp`](https://github.com/jamsinclair/jSquash) 1.5.0, Squoosh's libwebp
  codec repackaged for the browser; its one dependency is `wasm-feature-detect` (SIMD detection).
- **Licences:** `@jsquash/webp` and `wasm-feature-detect` are Apache-2.0; the libwebp code
  compiled into the `.wasm` is BSD-3-Clause (Google). Both are permissive and compatible with
  livediagram's MIT licence and neither is copyleft. Both ask that their licence and copyright
  notices accompany redistributed copies. The deployed bundles carry no third-party notices yet,
  for this or any other bundled dependency; that gap is repo-wide and open.
- **Quality:** the same 0.85, passed as libwebp's `quality: 85`; everything else is libwebp's
  default (method 4).
- **Proof:** Playwright's WebKit on Linux encodes WebP natively, so the Safari path is proven by
  making the canvas answer WebP requests with PNG, as Safari's does; the same test runs in
  Chromium in CI and in WebKit on demand ([End-to-end smoke tests](../003-system-architecture/e2e-smoke.md)).

Re-encoding is deterministic within one browser, so importing the same file twice uploads the
same bytes and the gallery's SHA-256 dedupe recognises them. Across browsers the WebP bytes may
differ, and the second copy is stored once more.

## Where the image is stored

- **Cloud diagrams** upload through `POST /api/images` with the SHA-256 and dimensions, the same
  call the image picker makes, so the gallery's dedupe, per-file cap and per-owner cap apply
  unchanged. The owner is whoever is importing: a guest's own gallery, or a signed-in account's.
- **Offline Mode diagrams** ([Offline Mode](../006-diagram/offline-mode.md)) never reach the
  server. The resized image is embedded in the element as a `data:` URL, the same shape a picked
  image takes in an offline diagram and the shape Sync Diagram re-homes into the gallery later.
  Embedding is bounded by an **offline import budget of 8 MB** of `data:` URL text per import:
  an image that would go past it stays a placeholder (`offline-budget`), so one import cannot
  bloat the diagram record beyond what autosave handles comfortably.

## Named failures

| Failure              | When                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `missing-bytes`      | The file names an image but does not carry its bytes (an Excalidraw `fileId` absent from `files`).           |
| `unsupported`        | The browser cannot decode the bytes, or the gallery refuses the type (`unsupported_type`, `malformed_jpeg`). |
| `too-large`          | The source is over 50 MB, or the encoded image is over the 10 MB per-file cap (`file_too_large`).            |
| `gallery-full`       | The owner's gallery is at its image-count or byte cap (`gallery_full`, 100 images / 100 MB hosted).          |
| `images-unavailable` | The deployment stores no images (`images_unavailable`: a self-host without R2).                              |
| `offline-budget`     | An Offline Mode import has already embedded 8 MB of images.                                                  |
| `upload-failed`      | Anything else: the network dropped, the server erred.                                                        |

- **After `images-unavailable`** every later image in the same import fails the same way at
  once, without work: the deployment will not change its mind mid-import.
- **After `gallery-full`** the pipeline keeps trying each later image. The server checks the
  SHA-256 dedupe before the cap, so an image the owner already has still lands at no cost;
  images that would grow the gallery fail as `gallery-full` in turn. The server spends one
  indexed lookup and one aggregate query per refusal and never reads the body.
- **After ** (409: the cap refused the insert, yet the gallery had room again by
  the time the server looked, because an image was deleted meanwhile) the pipeline retries that
  image once; a second conflict leaves it a placeholder as .

## One import session

Images are processed through an **import session**, created per import with the owner, the
diagram and whether it is offline. The session holds what must be shared across a file's images:
the concurrency limit (three images in flight at once), the offline budget, and the
`images-unavailable` short-circuit. Within one file, images named by the same key (Excalidraw's
`fileId`) are processed once and every element referencing it shares the outcome.

The session is the seam bulk import will use: many files through one session share one budget and
one short-circuit, and their reports add up, so importing a folder of boards later needs no change
to the pipeline.

## Order: images first, then the tab

An import stores every image first and then replaces the tab once, so the import stays a single
undo step with no half-filled state. While images upload, the Import dialog's footer reports
progress beside its buttons ("Importing images 3 of 12…"), so the buttons never move. The tab changes only when every image has an outcome.

## The report

Each import that meets images returns a **report**, counted per image element on the board:

- **imported**: new images stored (uploaded, or embedded in an offline diagram);
- **already in your gallery**: images the gallery already held (the server deduped them);
- **placeholders**, counted per failure.

An image used on several elements counts once per element, each with its image's outcome, so
the three numbers always add up to the image elements on the board.

The Import dialog shows the report calmly in place of closing: a short summary with the counts,
one plain sentence per failure that occurred, what to do about it, and a Done button. An import
without images closes the dialog as before. Copy per failure:

| Failure              | Sentence                                                                   |
| -------------------- | -------------------------------------------------------------------------- |
| `missing-bytes`      | The file didn't include the image data.                                    |
| `unsupported`        | The image format couldn't be read.                                         |
| `too-large`          | The image was too large to import.                                         |
| `gallery-full`       | Your image gallery is full. Free up space in the Explorer's Image Gallery. |
| `images-unavailable` | This server doesn't store images.                                          |
| `offline-budget`     | This offline diagram reached its image limit for one import.               |
| `upload-failed`      | The upload didn't go through. Check your connection and try again.         |

Every summary that lists placeholders ends with the same way forward: _Double-click a placeholder to add its image._

## Observability

Every image's outcome is logged once as `[import-images]` with the failure name or `stored`,
`deduped` or `embedded`, plus the source MIME type and byte sizes before and after encoding; the
session logs one `[import-images] report` line with the tallies when it finishes.

## Non-goals

- Server-side resizing or format conversion (a Cloudflare Images bill for a free product).
- Fetching images by URL from the source file (an external image link stays out: every image is
  internal, [Image element + per-owner gallery](../009-elements/images.md)).
- Bulk import of many files at once; the session above is where it will plug in.
