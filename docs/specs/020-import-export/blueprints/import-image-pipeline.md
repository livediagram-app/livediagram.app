# Import image pipeline: blueprint

Derived from [Import image pipeline](../import-image-pipeline.md). The spec decides; this file only
adds engineering precision. Defaults are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file (all under `apps/live/lib/import-images/`):

| File              | Role                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `constants.ts`    | Every number the pipeline uses, named                                                          |
| `types.ts`        | Sources, hints, outcomes, failures, requests, the report                                       |
| `source.ts`       | `readImportImageSource`: a source to bytes + MIME type, or a failure                           |
| `policy.ts`       | `planImageEncoding`, `fallbackOutputType`: the pure encoding decisions                         |
| `prepare.ts`      | `prepareImportImage`: decode, plan, encode, pick, cap, through an injected `ImageCodec`        |
| `upload-error.ts` | `failureFromUploadError`: an upload rejection to a named failure                               |
| `session.ts`      | `createImportImageSession`: concurrency, offline budget, short-circuit, logging                |
| `attach.ts`       | `attachImportImages`: key dedupe, element patching, progress, the report                       |
| `report.ts`       | `emptyImportImageReport`, `describeImportImageReport`: tallies and the dialog copy             |
| `browser.ts`      | `browserImageCodec`, `createBrowserImportImageSession`: the DOM codec + the api/offline wiring |
| `index.ts`        | Public surface for importers                                                                   |

Only `browser.ts` touches the DOM or the network; every other module runs in Node under Vitest.

## Domain and naming

| Term           | Identifier              | Meaning                                                                                                                 |
| -------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Image source   | `ImportImageSource`     | Bytes found in an imported file: `{ kind: 'data-url', dataUrl }` or `{ kind: 'blob', blob }`, each with optional `name` |
| Display hint   | `DisplayHint`           | `{ width, height }` of the element the image fills (canvas units)                                                       |
| Image request  | `ImportImageRequest`    | `{ elementId, key, source: ImportImageSource \| null, hint? }`; `null` source is `missing-bytes`                        |
| Import session | `ImportImageSession`    | Per-import state; `store(source, hint?)`                                                                                |
| Stored image   | `StoredImportImage`     | `{ ok: true, imageId, width, height, kind }`                                                                            |
| Stored kind    | `StoredImportImageKind` | `'uploaded' \| 'deduped' \| 'embedded'`                                                                                 |
| Named failure  | `ImportImageFailure`    | One of `IMPORT_IMAGE_FAILURES` (below)                                                                                  |
| Outcome        | `ImportImageOutcome`    | `StoredImportImage \| { ok: false, failure }`                                                                           |
| Prepared image | `PreparedImportImage`   | `{ blob, mimeType: AcceptedImageType, width, height }`, ready to store                                                  |
| Encoding plan  | `EncodingPlan`          | `{ action: 'keep' } \| { action: 'encode', width, height, keepIfSmaller }`                                              |
| Codec          | `ImageCodec`            | `decode(blob, mimeType)`, `encode(decoded, width, height, type, quality)`                                               |
| Report         | `ImportImageReport`     | `{ imported, deduped, placeholders: Partial<Record<ImportImageFailure, number>> }`                                      |
| Progress       | `ImportImageProgress`   | `{ done, total }`, per distinct key                                                                                     |

"Image" is canonical in identifiers and copy. "Picture", "file" (for the image) and "asset" are
not used. `IMPORT_IMAGE_FAILURES`, in this order (the order the report lists them):
`missing-bytes`, `unsupported`, `too-large`, `gallery-full`, `images-unavailable`,
`offline-budget`, `upload-failed`.

## Constants and configuration

| Constant                            | Value              | Provenance                             | Safe range       |
| ----------------------------------- | ------------------ | -------------------------------------- | ---------------- |
| `IMPORT_IMAGE_MAX_EDGE_PX`          | `2048`             | Spec: longest side ~2048 px            | 1024 to 4096     |
| `IMPORT_IMAGE_WEBP_QUALITY`         | `0.85`             | Spec                                   | 0.7 to 0.95      |
| `IMPORT_IMAGE_JPEG_QUALITY`         | `0.85`             | D2: matches WebP                       | 0.7 to 0.95      |
| `IMPORT_IMAGE_SVG_RASTER_SCALE`     | `2`                | Spec: twice the larger size            | 1 to 3           |
| `IMPORT_IMAGE_SVG_DEFAULT_EDGE_PX`  | `1024`             | Spec: when neither size is known       | 512 to 2048      |
| `IMPORT_IMAGE_MAX_SOURCE_BYTES`     | `50 * 1024 * 1024` | Spec: 50 MB                            | 10 MB to 100 MB  |
| `IMPORT_IMAGE_CONCURRENCY`          | `3`                | Spec: three in flight                  | 1 to 6           |
| `OFFLINE_IMPORT_EMBED_BUDGET_CHARS` | `8 * 1024 * 1024`  | Spec: 8 MB of `data:` URL text         | 2 MB to 32 MB    |
| `MAX_IMAGE_BYTES` (api-schema)      | `10 MB`            | [Images](../../009-elements/images.md) | shared, not ours |

## Behaviour and state

### `readImportImageSource(source)` → `{ bytes: Uint8Array, mimeType }` or `{ failure }`

1. `data-url`: match `^data:([^;,]*)((?:;[^;,]*)*),(.*)$` (dot matches newlines). No match:
   `unsupported`. `;base64` among the parameters: `atob` the payload (whitespace stripped first,
   D3); a throwing `atob`: `unsupported`. Otherwise: `decodeURIComponent` the payload, then UTF-8
   encode; a throwing decode: `unsupported`. Declared type = the first group, lower-cased.
2. `blob`: bytes = `new Uint8Array(await blob.arrayBuffer())`; declared type = `blob.type`.
3. Zero bytes: `missing-bytes`. More than `IMPORT_IMAGE_MAX_SOURCE_BYTES`: `too-large`. For a data
   URL the length check runs on the payload before decoding (`payload.length * 3 / 4`), so a huge
   string is never decoded.
4. MIME type: `sniffImageType(bytes)` (api-schema) wins when it recognises the bytes; else
   `image/svg+xml` when the first 1 KB, decoded as UTF-8, contains `<svg` (D4); else the declared
   type; else `application/octet-stream`.

### `planImageEncoding({ mimeType, width, height, byteLength, hint })` → `EncodingPlan`

`longest = max(width, height)`; `fits = longest <= IMPORT_IMAGE_MAX_EDGE_PX`.

- `image/svg+xml`: `edge = min(MAX_EDGE, max(longest, hintLongest) * SVG_RASTER_SCALE)`, or
  `SVG_DEFAULT_EDGE` when both are 0. Aspect = `width / height` when both are positive, else the
  hint's, else 1. Encode at the longest side `edge`: `{ action: 'encode', keepIfSmaller: false }`.
- `image/gif`, `fits`, `byteLength <= MAX_IMAGE_BYTES`: `keep`.
- `image/webp`, `fits`, `byteLength <= MAX_IMAGE_BYTES`: `keep`.
- `image/png` or `image/jpeg`, `fits`: encode at the same size, `keepIfSmaller: true`.
- Otherwise: encode at `scale = min(1, MAX_EDGE / longest)`, `keepIfSmaller: false`.

Scaled sizes are `max(1, round(side * scale))`.

`fallbackOutputType(sourceMime)`: `image/jpeg` for `image/jpeg`, else `image/png`.

### `prepareImportImage(bytes, mimeType, hint, codec)` → `PreparedImportImage` or `{ failure }`

1. `decoded = await codec.decode(blob, mimeType)`; `null` or a throw: `unsupported`.
2. `plan = planImageEncoding(...)` with `decoded.width/height`.
3. `keep`: the original blob with its sniffed accepted type.
4. `encode`: `out = await codec.encode(decoded, w, h, 'image/webp', WEBP_QUALITY)`. When
   `out.type !== 'image/webp'`: `out = await codec.encode(decoded, w, h, fallbackOutputType(mime),
quality)`. `null` or a throw: `unsupported`. With `keepIfSmaller` and
   `original.size <= out.size`: the original.
5. `decoded.close()` in a `finally`.
6. The chosen blob's bytes are sniffed: not an accepted type: `unsupported`. Over
   `MAX_IMAGE_BYTES`: `too-large`.

### `failureFromUploadError(error)`

`ApiError` codes: `gallery_full` → `gallery-full`; `unsupported_type`, `malformed_jpeg` →
`unsupported`; `file_too_large` → `too-large`; `images_unavailable` → `images-unavailable`. Status
503 without a code → `images-unavailable`, 413 → `too-large`, 415 → `unsupported`. Anything else
(including a non-`ApiError` throw, such as a network `TypeError`) → `upload-failed`.

### `createImportImageSession(deps)`

`deps = { offline: boolean, codec, upload(prepared) → { imageId, deduped }, toDataUrl(blob) →
string, log? }`. State:

| State           | Initial | Transition                                                     |
| --------------- | ------- | -------------------------------------------------------------- |
| `inFlight`      | 0       | +1 when a store starts work, −1 when it settles                |
| `queue`         | empty   | stores wait here while `inFlight === IMPORT_IMAGE_CONCURRENCY` |
| `unavailable`   | false   | true after any `images-unavailable` outcome; never resets      |
| `embeddedChars` | 0       | + `dataUrl.length` per embedded image                          |

`store(source, hint?)`:

1. `unavailable`: resolve `{ ok: false, failure: 'images-unavailable' }` at once, no slot taken.
2. Take a slot (FIFO). Then `readImportImageSource` → `prepareImportImage`.
3. Offline: `dataUrl = await toDataUrl(prepared.blob)`. `embeddedChars + dataUrl.length >
OFFLINE_IMPORT_EMBED_BUDGET_CHARS`: `offline-budget` (the budget is not consumed). Else add it
   and resolve `{ ok: true, imageId: dataUrl, kind: 'embedded' }`.
4. Cloud: `await upload(prepared)`; resolve `kind: deduped ? 'deduped' : 'uploaded'`. A throw:
   `failureFromUploadError`; `images-unavailable` sets `unavailable`.
5. Any unexpected throw inside the slot: `upload-failed` (never rejects). Release the slot.
6. `gallery-full` changes no state: later stores still upload (spec).

### `attachImportImages(elements, requests, session, onProgress?)`

1. Group requests by `key`. A key whose first request has a `null` source is `missing-bytes`
   without calling the session.
2. `total` = number of distinct keys with a source; `onProgress({ done: 0, total })` first when
   `total > 0`, then after each settles.
3. Every distinct key calls `session.store(source, hint)` once (the first request's hint);
   all run together and the session limits concurrency.
4. For each request: stored → the element (by `elementId`, `type === 'image'`) gains `imageId`,
   `naturalWidth`, `naturalHeight`; failed → unchanged (`imageId: null`). Other elements pass
   through by reference.
5. Report per request: `uploaded` and `embedded` → `imported`; `deduped` → `deduped`; failure →
   `placeholders[failure] += 1`. Invariant: `imported + deduped + Σ placeholders ===
requests.length`.
6. Log `[import-images] report` with the report.

### `describeImportImageReport(report)` → `{ lines: string[], failures: { failure, count, sentence }[], hint: string | null }`

- `lines`: `"{n} image(s) imported"` when `imported > 0`; `"{n} already in your gallery"` when
  `deduped > 0`; `"{n} left as placeholder(s)"` when placeholders > 0.
- `failures`: in `IMPORT_IMAGE_FAILURES` order, only non-zero, with the spec's sentence.
- `hint`: `"Click a placeholder to add its image."` when placeholders > 0, else `null`.

## Interfaces and contracts

```ts
export type ImageCodec = {
  decode(blob: Blob, mimeType: string): Promise<DecodedImage | null>;
  encode(
    image: DecodedImage,
    width: number,
    height: number,
    type: string,
    quality: number,
  ): Promise<Blob | null>;
};
export type DecodedImage = { width: number; height: number; close(): void };
```

`browserImageCodec`: rasters decode with `createImageBitmap(blob)` (EXIF orientation applied by the
browser); SVG decodes through an `<img>` on an object URL (revoked after load or error), whose
`naturalWidth/Height` may be 0. `encode` draws into an `OffscreenCanvas` when available
(`convertToBlob({ type, quality })`), else a detached `<canvas>` (`toBlob`); a canvas `SecurityError`
resolves `null`. Drawing uses `imageSmoothingQuality = 'high'`.

`createBrowserImportImageSession({ ownerId, diagramId })`: `offline = !!diagramId &&
isOfflineIdSync(diagramId)`; `upload` computes `sha256Hex` and calls `apiUploadImage` with the
prepared type, dimensions and the source `name` as `originalName`; `toDataUrl` is `FileReader`.

Importers depend only on `index.ts`: the types, `attachImportImages`, `createBrowserImportImageSession`
(lazy-imported), `describeImportImageReport`, `emptyImportImageReport`.

## Data and persistence

No new persisted fields. A stored image sets the existing `ImageElement.imageId`, `naturalWidth`,
`naturalHeight`. Cloud: a gallery row + R2 object through the existing endpoint. Offline: the
`data:` URL lives in the tab body in IndexedDB and re-homes on Sync Diagram (existing
`uploadEmbeddedImages`). No migration.

## Errors and edge cases

| Case                                         | Handling                                                  |
| -------------------------------------------- | --------------------------------------------------------- |
| Request with `null` source                   | `missing-bytes`, no session call                          |
| Malformed / non-base64 data URL              | `unsupported`                                             |
| Empty payload                                | `missing-bytes`                                           |
| Source over 50 MB                            | `too-large` before decoding                               |
| Browser cannot decode                        | `unsupported`                                             |
| SVG that taints the canvas                   | encode resolves `null` → `unsupported`                    |
| Browser cannot encode WebP                   | fallback type (JPEG/PNG)                                  |
| Encoded result not an accepted type          | `unsupported`                                             |
| Encoded result over 10 MB                    | `too-large`                                               |
| Upload 403 `gallery_full`                    | `gallery-full`; later stores still try                    |
| Upload 503                                   | `images-unavailable`; later stores short-circuit          |
| Network failure / other status               | `upload-failed`                                           |
| Offline budget exceeded                      | `offline-budget`; smaller later images may still fit (D5) |
| Two elements, one key                        | One store; both elements get its outcome                  |
| Request whose element is missing / not image | Counted in the report, no element patched (D6)            |
| Zero requests                                | No progress calls; report all zeros                       |

## Security and trust

- SVG never reaches the gallery: it is rasterised in an `<img>` context (no script, no external
  fetch), and the server still sniffs every upload.
- Re-encoding drops metadata (EXIF GPS, camera serial); kept originals (WebP, GIF, a smaller
  PNG/JPEG) rely on the server's JPEG stripping, as for picker uploads.
- The 50 MB source cap bounds decode memory per image; concurrency 3 bounds the peak.
- Uploads authenticate as the importing owner; no new endpoint, no new trust boundary.

## Performance and limits

- Peak memory ≈ 3 × (source bytes + decoded RGBA at ≤ 2048² × 4 = 16 MB) ≈ 100 MB worst case.
- Encode of a 2048² canvas to WebP: ~50 to 150 ms on a laptop; 30 images ≈ 2 to 5 s plus upload.
- Hosted server cost per image: one D1 sha lookup, one totals query, one R2 put (new) or none.
- Offline budget caps the tab body growth from one import at 8 MB.

## Observability

- `console.info('[import-images]', outcomeName, { mimeType, sourceBytes, storedBytes, width, height })`
  per store, `outcomeName` ∈ `uploaded | deduped | embedded | <failure>`.
- `console.info('[import-images] report', report)` once per `attachImportImages`.
- Failures that come from a throw also `console.warn('[import-images] error', failure, error)`.

## Testing

| Rule                                                  | Test                                |
| ----------------------------------------------------- | ----------------------------------- |
| Longest side 2048, never upscale                      | `policy.test.ts` scale cases        |
| PNG/JPEG within size: encode, keep if smaller         | `policy.test.ts`, `prepare.test.ts` |
| WebP within size kept                                 | `policy.test.ts`                    |
| GIF kept when it fits, flattened when not             | `policy.test.ts`                    |
| SVG raster size from intrinsic/hint/default           | `policy.test.ts`                    |
| WebP fallback type                                    | `policy.test.ts`, `prepare.test.ts` |
| 50 MB source cap, 10 MB output cap                    | `source.test.ts`, `prepare.test.ts` |
| Data URL parsing, MIME sniff                          | `source.test.ts`                    |
| Upload error mapping                                  | `upload-error.test.ts`              |
| Unavailable short-circuit; cap keeps trying           | `session.test.ts`                   |
| Offline embed + budget                                | `session.test.ts`                   |
| Concurrency never above 3                             | `session.test.ts`                   |
| Key dedupe, element patch, report invariant, progress | `attach.test.ts`                    |
| Report copy                                           | `report.test.ts`                    |

All with a fake `ImageCodec` and fake `upload` / `toDataUrl`; the browser codec is proven end to
end in the running editor.
