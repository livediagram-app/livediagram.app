# Photo engine blueprint

Derived from [Photo pages](../photo-pages.md), [Photo layers](../photo-layers.md), [Photo tools](../photo-tools.md),
[Photo adjustments](../photo-adjustments.md) and [Photo store](../photo-store.md). It adds engineering precision,
not design: where a spec is silent the default is in [DEFAULTS.md](DEFAULTS.md).

## Domain and naming

| Spec term      | Identifier                                                         |
| -------------- | ------------------------------------------------------------------ |
| photo page     | `Page` with `kind: 'photo'`, `size: 'photo'`                       |
| photo          | `Photo` (`packages/photo-engine/src/model/types.ts`)               |
| layer          | `PhotoLayer`, discriminated by `layerKind`                         |
| tile map       | `TileMap` (`Record<TileKey, BlobId \| ''>`), `TileKey = "col.row"` |
| layer pixels   | `LayerPixels = { tiles: TileMap; source?: PixelSource }`           |
| blob id        | `BlobId` (22 base64url characters)                                 |
| composite      | `compositePhoto` (CPU), `GlCompositor.render` (GPU)                |
| selection      | `Mask8` (one byte a pixel, with an origin)                         |
| photo tool     | `PhotoToolId` (kebab-case: `brush`, `magic-wand`, `spot-heal`)     |
| adjustment     | `PhotoAdjustment = { id: AdjustmentId; params }`                   |
| filter         | a `FilterDef`'s `id`, `FILTERS` catalogue                          |
| photo session  | `PhotoSession`: one person's editing state of one photo            |
| pending upload | `PhotoUploadQueue` entry                                           |
| photo room op  | `RoomOp` `{ kind: 'photo' }`, `PhotoOp`                            |

"Photo" alone always means a photo page's picture; code for photo pages lives under names containing
`photo-engine`, `photo-editor` or `photo-page`.

## Where the code lives

- **`packages/photo-engine`** (`@livedesign/photo-engine`, pure TypeScript, no DOM, no dependencies; runs in the
  browser, workers, the api worker and Node tests):
  - `model/`: `types.ts` (`packages/photo-engine/src/model/types.ts`), `ids.ts` (`newLayerId`, `tileKey`,
    `blobIdOf(bytes)` via `crypto.subtle`), `parse.ts` (`photosOf`, `parsePhoto`, `parseLayer`), `ops.ts`
    (`diffPhoto`, `applyPhotoOps`, `parsePhotoOps`), `blob-ids.ts` (`photoBlobIdsOf`), `stack.ts` (tree walks),
    `edits.ts` (pure stack operations), `blend-modes.ts` (`BLEND_MODES`), `names.ts`, `limits.ts`.
  - `raster/`: `raster.ts` (`Raster = { width, height, data: Uint8ClampedArray }`, straight RGBA), `tiles.ts`
    (`TiledRaster`: copy-on-write tiles, a dirty set, `load` and `unload` for stored changes, which never mark
    dirty), `mask.ts` (`Mask8`).
  - `colour/`: `colour.ts` (sRGB, HSL, HSV, luma, hex), `blend.ts` (`blendChannel`, `blendRgb`, `blendSpan`,
    `behindSpan`, `clearSpan`, `HARD_MIX_GIVE`).
  - `composite/`: `composite.ts` (`compositePhoto(photo, pixels, rect, opts)`, `compositeAll`, `layerTree`,
    `soloed`, clipping, and dissolve's `dissolveSeed` and `dissolveNoise`), `effects.ts`.
  - `adjust/`: `catalogue.ts` (`ADJUSTMENTS`), `params.ts`, `lut.ts`, `levels.ts` (Levels, Curves, and
    `autoTone`, `autoContrast`, `autoColour`), `tone.ts`, `colour-adjust.ts`, `shadows-highlights.ts`.
  - `filters/`: `catalogue.ts` (`FILTERS`), `types.ts`, `helpers.ts`, `kernel.ts`, and the categories
    `blur.ts`, `sharpen-noise.ts`, `stylize-pixelate.ts`, `distort.ts`, `render-enhance-other.ts`.
  - `select/`: `shapes.ts`, `flood.ts` (`floodSelect`, `colourRange`, `antiAliasEdge`), `modify.ts`,
    `distance.ts`, `grabcut.ts`, `maxflow.ts`, `gmm.ts`, `livewire.ts`, `quick-select.ts` (`quickSelect`,
    `refineEdge`), `outline.ts` (marching-ants contours).
  - `paint/`: `tip.ts`, `stroke.ts` (`StrokeEngine`), `smoothing.ts`, `dab-tools.ts`, `fill.ts` (the bucket),
    `gradient.ts`, `shapes.ts`, `red-eye.ts`, `poisson.ts`, `patchmatch.ts`.
  - `transform/`: `resample.ts`, `matrix.ts`, `warp.ts` (`transformRaster`), `geometry.ts` (rotate, flip, crop,
    canvas size, trim), `box.ts` (the transform box's grabs, skew and perspective included).
  - `psd/`: `read.ts`, `write.ts`, `model.ts`, `convert.ts`, `blend-keys.ts`, `rle.ts`.
  - `encode/`: `png-stream.ts` (a streaming PNG encoder over `CompressionStream`, for exports past a canvas's
    size), `png-decode.ts`.
  - `histogram.ts`.
- **`packages/design`**: `Tab.photos?: Record<string, Photo>` (the type re-exported from the engine), `PageKind`
  gains `'photo'`, `PageSizeId` gains `'photo'`; `parsePageFields`, `pageKindOf`, `pageDimensions` (the `fit`
  sides), `pageLabel`, `pageMargin` (0), `withPages` (a removed photo page's photo is dropped), `newPhotoPage`,
  `photoSheetSides(width, height)`.
- **`packages/api-schema`**: the `photo` room op in `room-messages.ts` (`MUTATION_OP_KINDS`), `photo-frames.ts`
  (`tabPhotoOps(before, after)`), the blob-batch framing (`photo-blob-batch.ts`: `encodeBlobBatch`,
  `decodeBlobBatch`), and the route DTOs.
- **`apps/api`**: the `photo_blob_refs` table in the design's schema (`design-schema.ts`); `src/db/photo-blobs.ts`; `src/routes/photo-blob-routes.ts`
  (dispatched from `design-subresource-routes.ts`); the design's own daily upkeep, which drops unnamed photo blobs (`src/design-room/design-room.ts`); copy support in
  the design copy path; `PHOTO_MAX_BYTES_PER_TAB` in `types.ts`, `.env.example`, `hosted-vars.json`; the
  thumbnail renderer's photo preview embed.
- **`apps/live`**:
  - `lib/photo-editor/`, loaded only once a photo page is laid out (`runtime.ts`, exposed as
    `PhotoEditorView.runtime`; `app/design/[id]/photo-lazy-load.test.ts` keeps it out of first-load JS):
    - The session and its pixels: `session.ts` (`PhotoSession`), `pixels-store.ts` (decoded tiles by blob id,
      the memory budget), `blob-client.ts`, `offline-blobs.ts`, `upload-queue.ts`, `content-cache.ts` (fills,
      text and effects drawn for the compositor), `text-raster.ts`, `thumbnails.ts`, `preview.ts`.
    - The worker: `photo.worker.ts` with `worker-tasks.ts` (encode, decode, filter, subject, quick select,
      refine, content-aware fill) and `photo-worker-client.ts`.
      A worker gets copies of a task's buffers until it has answered once, and has them moved after; a
      worker that never loads (offline, a chunk gone after a deploy) leaves the page the buffers to run the task.
    - Drawing: `apps/live/lib/photo-editor/gl/gl-compositor.ts` and `apps/live/lib/photo-editor/gl/shaders.ts` (WebGL 2), `cpu-view.ts` (the fallback),
      `surface-painter.ts` (which one draws, and when), `sliced-composite.ts` (a main-thread composite in
      bands, for merges), `view-options.ts` (the pixel grid).
    - Edits: `layer-ops.ts`, `image-ops.ts`, `apply-ops.ts`, `edit-ops.ts`, `mask-ops.ts`, `selection-ops.ts`,
      `selection-mask.ts`, `select-and-mask.ts`, `clipboard.ts`, `rasterize-element.ts`, `start-photo.ts`.
    - Commands and state: `photo-actions.ts` (`PHOTO_ACTIONS`, every menu entry and chord), `photo-commands.ts`
      (the command palette), `photo-dialog-store.ts`, `photo-history.ts`, `photo-focus.ts`, `photo-pointer.ts`
      (the pointer's place and `photoPress`), `photo-announce.ts`, `lock-shake.ts`.
    - Tools: `tool-state.ts` (colours, options, persisted), `tool-option-fields.ts`, `brush-presets.ts`,
      `gradient-edit.ts`, `adjustment-fields.ts`, `adjust-auto.ts`, `neutral-pick.ts`, and `tools/` (one
      handler per tool family: `paint-tools.ts`, `select-tools.ts`, `fill-tools.ts`, `shape-tools.ts`,
      `move-tool.ts`, `transform-tool.ts`, `crop-tool.ts`, `text-tool.ts`, with `tool-context.ts`,
      `tool-handler.ts`, `held-keys.ts`, `lift.ts`).
    - Export: `photo-export.ts`.
  - `components/photo/`: `PhotoPagesLayer.tsx` and `PhotoSurface.tsx` (the page's canvas), `PhotoChrome.tsx`,
    `PhotoCanvasOverlays.tsx` and `PhotoToolOverlay.tsx` (presses, the cursor, marching ants, boxes),
    `PhotoToolsRail.tsx` (the photo tools: `placement="strip"` in the palette strip, `"row"` on a phone), `PhotoColours.tsx`, `PhotoToolOptionsBody.tsx` (with `PhotoPhoneOptions.tsx` and `PhotoTransformOptions.tsx`), `PhotoBrushPresets.tsx`,
    `PhotoGradientField.tsx`, `PhotoTitleBar.tsx`, `PhotoPanel.tsx` with `PhotoPanelParts.tsx`,
    `PhotoLayersTab.tsx`, `PhotoLayerRow.tsx` (rows restack by the shared `useRowPointerDrag` the canvas's `useLayerRowDrag` also runs on), `PhotoBlendPicker.tsx`, `PhotoAdjustTab.tsx`,
    `AdjustmentEditor.tsx`, `CurvesEditor.tsx`, `PhotoEffectsEditor.tsx`, `PhotoTextEditor.tsx`, the dialogs
    (`PhotoDialogs.tsx`, `PhotoSizeDialogs.tsx`, `PhotoEditDialogs.tsx`, `PhotoApplyDialogs.tsx`,
    `SelectAndMaskDialog.tsx`, `PlacePictureDialog.tsx`, `FilterPreview.tsx`), `PhotoExportPanel.tsx`,
    `StartPhotoCard.tsx`, `RasterThumb.tsx`, and the hooks `usePhotoShortcuts.ts`, `usePhotoHistogram.ts`,
    `usePhotoDropPaste.ts`, `usePhotoPreviewUrl.ts`, `useApplyPreview.ts`.
  - `hooks/editor/`: `usePhotoEditor.ts` (the photo page in focus, its session's lifecycle, the
    `PhotoEditorView`), `usePhotoFraming.ts` (framed beside its chrome once the tools show, `rail-shown.ts`),
    `usePhotoPresence.ts` (over the shared `hooks/collab/usePresenceHolds.ts`).
  - `apps/live/components/canvas/usePhotoStripTools.tsx`: the photo tools handed to `ToolbarPalette` (`photoTools`) in place
    of its categories, or at a Participant's strip end; a selection mode picked puts the photo tool down.

### The model

```ts
type BlobId = string; // /^[A-Za-z0-9_-]{22}$/
type TileKey = `${number}.${number}`; // col.row, each 0..15
type TileMap = Record<TileKey, BlobId | ''>;
type PixelSource = { blob: BlobId; width: number; height: number };
type LayerPixels = { tiles: TileMap; source?: PixelSource };
type BlendMode = (typeof BLEND_MODES)[number]; // 'normal' | 'dissolve' | ... | 'luminosity' | 'pass-through'
type LayerLocks = { transparency?: true; pixels?: true; position?: true; all?: true };
type LayerMask = {
  pixels: LayerPixels;
  enabled?: false;
  linked?: false;
  offset?: { x: number; y: number };
};
type LayerEffects = { shadow?: Shadow; glow?: Glow; stroke?: Stroke; overlay?: Overlay };
type LayerBase = {
  id: string;
  name: string;
  visible?: false;
  opacity?: number;
  blend?: BlendMode;
  locks?: LayerLocks;
  clip?: true;
  parent?: string;
  mask?: LayerMask;
};
type PixelLayer = LayerBase & {
  layerKind: 'pixel';
  pixels: LayerPixels;
  offset?: Point;
  effects?: LayerEffects;
};
type AdjustmentLayer = LayerBase & { layerKind: 'adjustment'; adjustment: PhotoAdjustment };
type FillLayer = LayerBase & { layerKind: 'fill'; fill: SolidFill | GradientFill };
type TextLayer = LayerBase & { layerKind: 'text'; text: TextSpec; effects?: LayerEffects };
type GroupLayer = LayerBase & { layerKind: 'group'; collapsed?: true };
type PhotoLayer = PixelLayer | AdjustmentLayer | FillLayer | TextLayer | GroupLayer;
type Photo = {
  width: number;
  height: number;
  layers: PhotoLayer[];
  preview?: BlobId;
  rev?: number;
};
```

- Stack order is array order, bottom first; a group's children are contiguous **below** it in the array (the group
  entry sits directly above its last child), so a stack walk is one pass with a group stack.
  `normaliseStack(layers)` restores the invariant after any edit (children moved under their group, in their
  relative order; a cycle or a depth past 5 clears the offending `parent`).
- Ids: `ly-` and 8 hex digits (`newLayerId(taken)`).
- `rev` rises by 1 on every commit; the preview remake is keyed by it.

### The session

`PhotoSession` (one per photo page in focus, per person) holds:

- `photo` (the last committed `Photo`), `layers` (`Map<layerId, LoadedLayer>`: its `TiledRaster` and its mask's,
  loaded from the tile maps through `PixelsStore`), `active` (layer id), `target` (`'layer' | 'mask'`),
  `selection` (`Mask8 | null`), `lastSelection`, `floating` (lifted pixels and their offset, or null), `transform`
  (the box and its matrix, or null), `stroke` (`StrokeEngine`, or null), `dirty` (tile keys per layer since the
  last commit).
- Gestures: each tool is a `ToolHandler` (`down`, `move`, `up`, `key`, `cancel`). A press the handler takes
  sets `photoPress` until its release; while it is set, no command chord and no tool letter runs
  (`usePhotoShortcuts`), and the tool's own Enter and Escape still reach it. Putting the tool down (another
  tool, the photo left) cancels its gesture. A cancelled gesture puts back the raster taken before it
  (`restorePixels`).
- **Incoming changes** (`setPhoto`): every tile a peer changed loads (changed keys only), except the tiles this
  session's own change has not finished with: dirty in the raster (painted) or taken by a commit not yet made
  (`committing`). Those are `held`, logged, and this person's commit, the later, wins them. A peer's tiles since
  the raster's last commit or restore (`peerKeys`) are applied again onto a restored raster.
- **Commit** (`commitPixels`): from the dirty tiles, encode each (worker), compute blob ids, build the new tile maps,
  produce the next `Photo` (`rev + 1`), hand the new blobs to the `PhotoUploadQueue`, and call the editor's
  `commitTabs` with the tab's `photos[pageId]` replaced (one undo step, labelled for History).

### Undo and History

- The tab's undo history holds whole `Photo` values. On undo or redo the session diffs its `photo` with the tab's:
  each layer whose tile map changed reloads only the changed tiles from `PixelsStore` (which holds every blob of
  every photo step still in the history, pinned: `PixelsStore.pin(stepPhotoIds)`).
- `photo-history.ts` keeps this person's photo commits by page (label, the tab history index), at most 50; the History
  tab jumps by calling undo or redo the needed number of times.

### Live sync

- `tabPhotoOps(before, after)`: per page in either, `removed` when gone; else `size` when the size changed, `put`
  for each layer added or changed (compared by reference first, then by `JSON.stringify`), `remove` for each layer
  gone, `order` when the id sequence changed, `preview` when the preview changed; framed under 200,000 characters.
- `applyPhotoOps(photo, ops)`: `size` sets width and height; `put` replaces the layer by id or, new, inserts it
  above its stored neighbour (`after` id carried in the op: the layer under it at the sender) else on top;
  `remove` drops it (and its group's children); `order` reorders the named ids into the order given, keeping
  unnamed ones after the named one they followed; `preview` sets it. Then `normaliseStack`.
- The live editor: `tab-broadcast-ops.ts` adds `photos` to `META_SKIP` and `tabPhotoOps` to every path;
  `wholeTabOp` strips `photos` (they follow as `photo` ops); `room-op-apply.ts` applies `photo` ops;
  `mergeRemoteTab` keeps the local `photos` through a whole-tab op.

### Upload queue and the save gate

- `PhotoUploadQueue` per tab: `enqueue(blobs)`, `pending(): boolean`, `whenSettled(): Promise<void>`; drains in
  batches (64 blobs or 24 MB, two in flight), asking `photo-blobs-held` first; retries at 2, 4, 8, 16 s; then `failed` until
  `retry()`.
- The tab autosave awaits `queue.whenSettled()` before sending a tab whose
  photos changed; other tabs are never held.

### Pixels in memory

- `PixelsStore`: decoded tiles (`Uint8ClampedArray`, 1 MB each) by blob id, LRU within
  `TILE_CACHE_BYTES_DESKTOP` (512 MB) or `TILE_CACHE_BYTES_COARSE` (128 MB, a coarse pointer), pinned ones never evicted; fetches through
  `blob-client` (or `offline-blobs`), decodes in the photo worker (`createImageBitmap` + `OffscreenCanvas`
  `getImageData`), dedupes in-flight loads.
- Sources decode once to a `TiledRaster` slice per tile key on demand.

### The GPU compositor

- WebGL 2, one context per photo surface (`apps/live/lib/photo-editor/gl/gl-compositor.ts`): an RGBA8 texture per (layer, tile),
  mipmapped (`LINEAR_MIPMAP_LINEAR` down, `NEAREST` up from `HARD_EDGES_FROM` screen px a photo px, `LINEAR`
  under it), uploaded again only when its tile changed; the least recently drawn go past `GPU_TILE_BYTES_DESKTOP`, or `GPU_TILE_BYTES_COARSE` on a coarse pointer (`apps/live/lib/photo-editor/coarse-pointer.ts`).
- Each frame: per layer in stack order, its visible tiles drawn into a layer buffer (with mask and clip), then a
  full-screen blend pass onto the accumulator with the blend mode's GLSL (`apps/live/lib/photo-editor/gl/shaders.ts`, the same formulas as
  `blend.ts`, `HARD_MIX_GIVE` included), opacity and dissolve noise; adjustment layers run on the accumulator
  through their mask from baked tables (a 256 x 1 table per channel, or a `LUT3D_SIZE` cube), each sampler on a
  unit of its own (`ADJUST_UNITS`), the unused ones bound to 1 x 1 stand-ins; groups push a buffer. Every pass
  samples straight (`FULL_VS`): the frame is flipped once, at present.
- Fills, text layers and layers with effects are drawn by the CPU (`content-cache.ts`) and uploaded as tiles.
- Fallback: without WebGL 2 (or on context loss until restored) `cpu-view.ts` composites the visible rect with
  `compositePhoto` at up to `CPU_FRAME_PIXELS`, on the main thread, throttled to 15 frames a second.

## Interfaces and contracts

- `photosOf(tab): Record<string, Photo>`; `parsePhoto(v): Photo | undefined` (width and height integers 1 to 8192,
  area at most 40,000,000, else undefined); `parseLayer(v)`: drops malformed optional fields, refuses a layer
  without a valid id or kind.
- `parsePhotoOps(v): PhotoOp[] | undefined`: undefined for anything malformed (the receiver changes nothing).
- Room op validation in the api room (`room-internal.ts`): `photo` frames at most 256,000 characters; `pageId`
  matches the page id pattern; a sender without edit is refused (`MUTATION_OP_KINDS`).
- Blob batch: `encodeBlobBatch(entries: { id, type, bytes }[]): Uint8Array`; `decodeBlobBatch(bytes):
{ id, type, bytes }[] | 'bad_batch'`.
- Route responses: `{ has: BlobId[] }`, `{ stored: BlobId[] }`, `{ adopted: BlobId[] }`; errors
  `{ error: 'bad_batch' | 'blob_mismatch' | 'unsupported-type' | 'photo_full' | 'photos_unavailable' | 'too_many' }`.
- `compositePhoto(photo, pixels: (layerId, target) => TiledRaster | undefined, rect, { text?: TextRasterizer })`:
  the composite of `rect` (photo pixels) as a `Raster`.
- Filters and adjustments: `ADJUSTMENTS[id] = { id, name, defaults, isIdentity(params), lut?(params), apply(raster,
params) }`; `FILTERS[id] = { id, name, category, params: ParamSpec[], margin(params), run(src, params, ctx) }`
  where `ctx = { signal?: AbortSignal; progress?: (0..1) => void; seed: number; foreground; background }`.

## Data and persistence

- `Tab.photos` is stored in the tab body (`tabs.data`, in the design's own SQLite). Each layer's tile maps are small: 610 tile keys at most.
- `photo_blob_refs (tab_id TEXT NOT NULL, blob_id TEXT NOT NULL, created_at INTEGER NOT NULL, content_type TEXT
NOT NULL, byte_size INTEGER NOT NULL, PRIMARY KEY (tab_id, blob_id)) WITHOUT ROWID`, index `photo_blob_refs_blob
(blob_id)`, in the design's own SQLite (`design-schema.ts`): which blobs each tab may read, and what each is (type
  and size, for the read and the tab's cap, `tabPhotoBytes`).
- R2 (`PHOTO_BLOBS`): the bytes at `photo/<blob id>`, metadata `{ contentType }`, shared between designs by content;
  and an empty marker `photo-refs/<blob id>/<design id>` for each design that holds a ref to it. A design writes its
  marker before its first ref (`markBlobsHeld`, `recordBlobs`), and removes it once its last ref goes;
  `releaseBlobs` deletes the bytes when no marker is left.
- **Retention.** The design's daily upkeep (`design-room.ts`) runs `sweepDesignPhotoBlobs`: for up to
  `PHOTO_SWEEP_TABS` tabs with refs older than `PHOTO_SWEEP_GRACE_MS`, the refs its saved body no longer names go
  (every ref of a tab no longer linked); a body that will not parse keeps every blob. The blobs the design no longer
  holds are then released. A ref made again is renewed, so the grace starts over. A purged design releases every
  blob it held (`designBlobIds`).
- Snapshot and restore: the tab body is the snapshot; blobs are content-addressed and immutable.
- Migration: none for existing tabs (`photos` absent). A future engine change to tile size bumps a `v` on
  `LayerPixels` (absent is v1, 512).

## Errors and edge cases

| Case                                             | Handling                                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| A tile blob 404s (not uploaded yet)              | Retried after 1, 2, 4, 8 s; meanwhile the tile draws transparent with no error shown         |
| A tile blob fails for good                       | The tile draws the checkerboard; `[photo] tile-missing` logged once per blob                 |
| WebGL context lost                               | CPU view until `webglcontextrestored`; textures re-uploaded                                  |
| Photo larger than the pixel cap (opened, PSD)    | Scaled down to fit (pictures) or refused (PSD) with the spec's toasts                        |
| Painting on a hidden or locked layer             | Refused with the spec's toasts                                                               |
| A remote change to the layer being painted       | Queued, applied after the commit                                                             |
| The photo's page deleted while a session is open | The session ends, its pending commit dropped                                                 |
| Upload fails four times                          | Save indicator "Couldn't save the photo" with Retry; other edits wait                        |
| Tab cap reached                                  | Toast "This photo has reached its storage limit." The commit stays local until removed       |
| Memory budget exceeded by pins                   | Oldest history steps beyond 50 fall off first; a toast if the photo alone exceeds the budget |
| A filter on an empty selection                   | No edit, toast "Nothing is selected."                                                        |
| Undo during `stroking` / `transforming`          | Ignored until the state ends (the stroke commits first)                                      |
| Text layer with a font not loaded                | Drawn when the font loads; until then in the app's sans                                      |

## Security and trust

- Blobs are readable only through a tab the caller can read (`gateRead` with the tab), writable only by an editor
  of it (`gateEdit`); refs need the bytes (no id-only claim). Adopt requires read on the source tab now.
- Bytes are sniffed by magic number; no SVG or other active content is accepted; served with
  `X-Content-Type-Options: nosniff`.
- The batch decoder bounds every length against the body before reading.
- EXIF: a source picture, a JPEG included, is re-encoded in the browser before upload (decoding drops metadata).

## Performance and limits

Budgets (Apple M1, Chrome; Node for pure modules), each held by `engine.perf.test.ts` with an allowance
(`PHOTO_PERF_ALLOWANCE`, 2 by default, for a loaded CI machine). Measured on 2026-10-19 in Node on the build
machine (the fastest of three runs; a scaled budget where the test runs a smaller case):

| Operation                                             | Budget            | Measured  |
| ----------------------------------------------------- | ----------------- | --------- |
| One 100 px soft dab into a stroke buffer              | 0.3 ms            | < 0.1 ms  |
| Stroke apply of a 512 tile (normal mode, selection)   | 3 ms              | not timed |
| CPU composite of a 512 tile, 10 layers (3 Multiply)   | 20 ms             | 21.0 ms   |
| GPU frame, 20 layers, 2560 x 1440                     | 6 ms              | not timed |
| LUT adjustment on 12 MP                               | 60 ms             | 30.5 ms   |
| Gaussian blur r=10 on 4096 x 4096 (worker)            | 1.5 s (375 ms 2K) | 399 ms 2K |
| Spot heal of a 150 px blob (PatchMatch, 5 iterations) | 400 ms            | 332 ms    |
| GrabCut Subject at 1024 x 768                         | 3 s (750 ms half) | 311 ms    |
| Magic wand flood on 12 MP                             | 150 ms            | 112 ms    |
| PNG encode of one 512 tile (worker)                   | 20 ms             | not timed |
| `tabPhotoOps` for a 100-layer photo with one change   | 2 ms              | < 0.1 ms  |
| A merge's composite, 8192 x 8192, main thread         | no frame > 16 ms  | D19 bands |

Limits: pixel cap 8192 (desktop) / 4096 (coarse); area 40,000,000; 100 layers; 10 photo pages a tab; 50 history
steps; tile cache 512 MB / 128 MB; GPU textures within 768 MB / 192 MB (LRU by tile, offscreen first).

## Presentation and UX

As the specs state. Sizes: rail 44 px wide (tile 36), options flyout 360 px wide, Photo panel 360 px wide, layer rows
48 px, thumbnails 40 px. Chrome surfaces and tokens from `@livedesign/ui` (`Button`, `Select`, `Tooltip`,
`HoverCard`, the segmented control, `MenuRow`), the shared colour picker for every colour, the app's empty states.

## Accessibility

As [Photo tools](../photo-tools.md) "Accessibility": `role="toolbar"` rail with roving tab index; options are
labelled inputs; the Layers list is a `listbox` with `aria-multiselectable`, rows `option`s with the stated names;
dialogs are the app's `Dialog`; contrast of chrome text 4.5:1 in both themes; reduced motion stills the ants.

## Web Experience

- **LCP**: nothing of the photo editor is in the editor's first-load JavaScript: `PhotoSurface`, the rail, the panel
  and the engine load by dynamic import the first time a photo page is laid out; filters and smart selections
  run in the photo worker (only the Filter dialog's 160 px preview square runs on the main thread).
- **INP**: pointer handlers do only dab placement and a GPU upload per frame; encoding, filters, GrabCut and
  PatchMatch run in workers; commits yield before `commitTabs`; a merge of a photo
  over `COMPOSITE_AT_ONCE_PX` composites in `COMPOSITE_BAND_ROWS` bands, yielding every `COMPOSITE_SLICE_MS`.
- **CLS**: the rail, options flyout and panel float over the canvas (absolute), never shifting it.

## Observability

Log fingerprints (`debugLog`, `console.info`, unless stated): `[photo] session-open`, `[photo] commit <label>
tiles=<n>`, `[photo] commit failed` (warn), `[photo] upload-batch n=<n> bytes=<b>`, `[photo] upload-failed`
(warn), `[photo] tile-missing` (warn), `[photo] preview-missing` (warn), `[photo] gl-lost` (warn),
`[photo] gl-unavailable`, `[photo] remote-tiles-held`, `[photo] frame-wait`, `[photo] framed`, `[photo] clipboard` (warn), `[photo-blobs] refused
<reason>` (api), `[photo-blobs] sweep` with its counts (api), `[photo-blobs] release failed` (api,
error).

## Testing

Every spec rule maps to a test file:

- Model: `parse.test.ts` (each field's bounds, malformed input), `ops.test.ts` (diff/apply round trip, concurrent
  different-layer merge, same-layer last wins, order with unknown ids, the blob ids a photo names),
  `stack-edits.test.ts` (the tree and every layer operation).
- Pixels: `raster.test.ts`, `blend.test.ts` (every mode at reference points against W3C and Photoshop formulas),
  `composite.test.ts` (groups, pass-through, clipping, masks, adjustments, opacity, dissolve determinism),
  `adjust.test.ts` and `filters.test.ts` (each against reference values and its identity defaults),
  `select.test.ts`, `paint.test.ts`, `transform.test.ts`, `box.test.ts`, `psd.test.ts` (write then read round
  trip; no fixture from another editor yet), `png-decode.test.ts` (the streaming encoder decodes back), and
  `engine.perf.test.ts` for the budget table.
- Design: `page.test.ts` photo kind parsing and label; `withPages` dropping a removed page's photo.
- Api: `photo-blob-routes.test.ts` (each refusal, dedupe, cap, adopt, read gate, tab-scoped visitor),
  `db/photo-blobs.test.ts` (refs, markers, release and the sweep against real SQLite), copy carries refs, `room` refuses a Participant's `photo` op.
- Live: `upload-queue.test.ts`, `session-active.test.ts` (the active layer), `session-remote.test.ts` (a peer's
  tiles held on unfinished work, taken up on cancel), `photo-ops.test.ts`, `photo-tools.test.ts`,
  `photo-actions.test.ts`, `tools/*.test.ts`, `selection-ops.test.ts`, `select-and-mask.test.ts`,
  `sliced-composite.test.ts`, `pixels-store.test.ts`, `blob-client.test.ts`, `apps/live/lib/photo-editor/gl/shaders.test.ts`,
  `tab-broadcast-ops` and `room-op-apply` photo cases, component tests for the rail, options flyout, Layers tab,
  Adjust tab, History tab, dialogs, start card and shortcuts (`usePhotoShortcuts.test.ts`, the press guard),
  `no-memo-guard.test.ts` (every component that reads the session opts out of the compiler's memo), share
  roles (`editor-capabilities` photo flags). E2E: `photo-gpu-parity.spec.ts` (the GPU against the CPU over 73
  scenarios and two views: at most 6 levels a channel, 12 for Hard Mix, Posterize and Threshold, whose steps
  amplify a rounding). The make-paint-reload flow is covered by unit tests over the real session and store, and
  was walked in a browser with two clients; it has no e2e spec yet.

## Constants and configuration

| Constant                                               | Value           | Provenance                                  | Safe range     |
| ------------------------------------------------------ | --------------- | ------------------------------------------- | -------------- |
| `PHOTO_TILE`                                           | 512             | Store spec                                  | 256 to 1024    |
| `PHOTO_PIXEL_CAP`                                      | 8192            | Pages spec (desktop)                        | 4096 to 16384  |
| `PHOTO_PIXEL_CAP_COARSE`                               | 4096            | Pages spec (phone)                          | 2048 to 8192   |
| `PHOTO_MAX_AREA`                                       | 40,000,000      | Pages spec                                  | ≤ cap²         |
| `PHOTO_SHEET_MAX`                                      | 2048            | Pages spec (sheet's longer side, canvas px) | 1024 to 4096   |
| `PHOTO_MAX_LAYERS`                                     | 100             | Pages spec                                  | 20 to 200      |
| `PHOTO_MAX_PAGES`                                      | 10              | Pages spec                                  | 1 to 20        |
| `PHOTO_HISTORY_STEPS`                                  | 50              | Pages spec                                  | 10 to 200      |
| `PHOTO_PREVIEW_MAX`                                    | 2048            | Store spec                                  | 512 to 4096    |
| `PHOTO_PREVIEW_DELAY_MS`                               | 3000            | Store spec                                  | 1000 to 10000  |
| `PHOTO_FRAME_CHARS`                                    | 200,000         | Store spec, under the room's 256K           | ≤ 240,000      |
| `PHOTO_BATCH_BLOBS`                                    | 64              | Store spec                                  | 8 to 128       |
| `PHOTO_BATCH_BYTES`                                    | 24 MB           | Store spec, under Workers' 100 MB body      | ≤ 90 MB        |
| `PHOTO_BLOB_MAX_BYTES`                                 | 10 MB           | Store spec                                  | ≤ 25 MB        |
| `TILE_CACHE_BYTES_DESKTOP` / `TILE_CACHE_BYTES_COARSE` | 512 MB / 128 MB | Store spec                                  | 64 MB to 2 GB  |
| `GPU_TILE_BYTES_DESKTOP` / `GPU_TILE_BYTES_COARSE`     | 768 MB / 192 MB | This blueprint's limits                     | 128 MB to 2 GB |
| `PHOTO_SWEEP_GRACE_MS`                                 | 86,400,000      | Store spec                                  | ≥ 3,600,000    |
| `PHOTO_SWEEP_TABS` (`apps/api/src/db/photo-blobs.ts`)  | 200             | Store spec                                  | per run budget |
| `PHOTO_ADJUST_COMMIT_MS`                               | 500             | Adjustments spec                            | 200 to 2000    |
| `PHOTO_TEXT_MAX`                                       | 2000            | Layers spec                                 | ≤ 10,000       |
| `PHOTO_MAX_GROUP_DEPTH`                                | 5               | Layers spec                                 | 2 to 10        |
| `PHOTO_LAYER_NAME_MAX`                                 | 60              | Layers spec                                 | 30 to 120      |
| `PHOTO_HAS_MAX_IDS`                                    | 500             | Store spec (one `has` ask)                  | 100 to 2000    |
| `PHOTO_ADOPT_MAX_IDS`                                  | 2000            | Store spec (one adoption)                   | 500 to 5000    |
| `PHOTO_DEFAULT_WIDTH` / `PHOTO_DEFAULT_HEIGHT`         | 1920 / 1080     | Pages spec (a new blank photo)              | any            |
| `HARD_EDGES_FROM`                                      | 4               | Pages spec (hard pixel edges)               | 2 to 8         |
| `PIXEL_GRID_FROM`                                      | 8               | Pages spec (the pixel grid)                 | 4 to 16        |
| `PHOTO_PIXEL_ZOOM_MAX`                                 | 32              | Pages spec (zoom past the canvas's ceiling) | 16 to 64       |
| `HARD_MIX_GIVE`                                        | 0.5 / 255       | D18                                         | ≤ 1 / 255      |
| `COMPOSITE_BAND_ROWS`                                  | 256             | D19                                         | 64 to 1024     |
| `COMPOSITE_SLICE_MS`                                   | 12              | D19, under a 16 ms frame                    | 4 to 16        |
| `COMPOSITE_AT_ONCE_PX`                                 | 1,048,576       | D19                                         | ≤ 4 MP         |
| `CPU_FRAME_PIXELS`                                     | 1,000,000       | D9                                          | 250K to 4M     |
| `PHOTO_FRAME_WAIT_MS`                                  | 1500            | D20                                         | 500 to 3000    |
| `OWN_PRESETS_MAX`                                      | 24              | D21                                         | 8 to 100       |
| `STOP_REMOVE_PX`                                       | 28              | D22                                         | 16 to 48       |
| `REFINE_EDGE_RADIUS`                                   | 6               | D23                                         | 2 to 16        |
| `PRECISE_CURSOR_PX`                                    | 4               | D24                                         | 2 to 8         |
| `CONTENT_AWARE_MIN_REACH`                              | 32              | D25                                         | 16 to 128      |

`PHOTO_MAX_BYTES_PER_TAB`: api env, decimal bytes, hosted 536870912.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md).
