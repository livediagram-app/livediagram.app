# Photo store

Where a [photo](photo-pages.md)'s pixels live, how they reach everyone, and how long they are kept. A photo's
**layer stack** is part of its tab (`Tab.photos`), small and synced layer by layer; its **pixels** are **tiles**:
pictures of 512 x 512 pixels each, kept in the **photo blob store** by content and named in the stack by id.

## Domain language

| Term               | Means                                                                                                                               | Never called    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **tile**           | A 512 x 512 square of a layer's or a mask's pixels, at whole multiples of 512 from the layer's origin.                              | chunk, block    |
| **tile map**       | A layer's or mask's tiles by place (`"col.row"` to a blob id); a place absent holds nothing.                                        | manifest, index |
| **source**         | An optional whole picture under a pixel layer's tiles (the picture a photo was opened from), drawn where the tile map has no entry. | base image      |
| **blob**           | One stored file of the photo blob store: a tile, a source or a preview, named by its content.                                       | object, asset   |
| **blob id**        | A blob's name: the first 16 bytes of the SHA-256 of its bytes, base64url, 22 characters.                                            | key, hash       |
| **preview**        | A flattened copy of the composite, at most 2048 px on its longer side, for views made off the editor.                               | thumbnail       |
| **blob ref**       | A row saying a tab may read a blob: the tab named it, or a copy carried it.                                                         | grant, link     |
| **pending upload** | A blob a commit named that is not yet stored; the tab's save waits for it.                                                          | queue           |

## What is stored where

- **`Tab.photos`**: `Record<pageId, Photo>`, one entry per photo page. `Photo = { width, height, layers, preview?,
rev? }`: the pixel size, the layer stack ([Photo layers](photo-layers.md)), the preview's blob id, and a counter
  raised on each commit (for previews). Read defensively by `photosOf(tab)`; a photo whose page is gone is dropped
  on the next page edit.
- **A pixel layer's pixels**: `pixels: { tiles: TileMap, source?: { blob, width, height } }`; a mask's the same,
  its tiles grey (one channel used). A tile entry `""` is a cleared tile (transparent, or for a mask black), over
  the source. A tile map holds at most 40 million pixels' worth of places (a 512 tile is 262,144 pixels).
- **Tiles are PNGs** (lossless, 8 bits a channel, RGBA; a mask's grey), sources are the picture as opened (PNG,
  JPEG or WebP, its EXIF already stripped in the browser), previews WebP at quality 85.
- **One decoded tile, many places**: the browser keeps one decoded copy per blob id, so tiles that read the same (every
  white tile of a blank photo) are one array in memory until painted. A loaded tile is held copy-on-write: the first
  paint on it copies it, never painting every place that shares it.
- **The photo blob store**: blobs in R2 (the `PHOTO_BLOBS` bucket, under `photo/<blob id>`; its own bucket, apart
  from the media service's gallery), with an empty marker object `photo-refs/<blob id>/<design id>` for each design
  that holds it, and the **blob refs** in each design's own SQLite (`photo_blob_refs`: tab id, blob id, created at).
  A blob is stored once however many tabs name it.

## The routes

Under a design's tab, on the api worker ([API app](../015-api/api.md)):

| Method | Path                                                  | Gate | Does                                                                                                                                                                                                                                            |
| ------ | ----------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/designs/<id>/tabs/<tabId>/photo-blobs-held`     | edit | Body `{ ids: string[] }` (at most 500): answers `{ has: string[] }`, the ids this tab already holds a ref to.                                                                                                                                   |
| POST   | `/api/designs/<id>/tabs/<tabId>/photo-blobs`          | edit | Body: a **blob batch** (below). Stores each blob, adds the tab's ref, answers `{ stored: string[] }`.                                                                                                                                           |
| POST   | `/api/designs/<id>/tabs/<tabId>/photo-blobs-adopt`    | edit | Body `{ fromDesign, fromTab, ids }` (at most 2000): adds this tab's refs to blobs `fromTab` holds, where the caller may read `fromTab` in `fromDesign`. For duplicating a tab, and layers pasted between tabs. Answers `{ adopted: string[] }`. |
| GET    | `/api/designs/<id>/tabs/<tabId>/photo-blobs/<blobId>` | read | The blob's bytes, its stored content type, `Cache-Control: private, max-age=31536000, immutable`. 404 when the tab holds no ref to it.                                                                                                          |

- **A blob batch** is one request body: a 4-byte big-endian length, then that many bytes of JSON
  `[{ id, type, size }]`, then the blobs' bytes back to back in that order. At most 64 blobs and 24 MB a batch; a
  blob at most 10 MB. The client splits larger sets into several batches, two at a time.
- **Checks**, in order, refusing the whole batch on the first failure: the edit gate (a Viewer, a Participant and a
  token are refused: 403); the frame is well formed (400 `bad_batch`); each `type` is `image/png`, `image/jpeg` or
  `image/webp` and its bytes start with that type's magic number (415 `unsupported-type`); each blob's SHA-256
  matches its id (400 `blob_mismatch`); the tab's stored bytes plus the new ones stay within the tab's cap (403
  `photo_full`, with `limit` and `current`). A blob already stored is not written again, but its bytes are always
  sent and checked: holding a ref means having had the bytes, never just knowing an id.
- **Self-host**: without the `PHOTO_BLOBS` binding every route answers 503 `photos_unavailable`; the editor then offers
  photo pages only in Offline Mode designs ("Photo editing needs image storage on this server."), and hides the
  Photo card elsewhere.
- **Refusals log** `[photo-blobs] refused <reason>` with the design and tab ids, never an owner id.

## Committing an edit

1. A tool or operation ends: the engine knows which tiles changed. Each changed tile is encoded (in a worker) and
   named by its blob id; a tile made fully transparent becomes `""` (no blob).
2. The new layer stack (the changed layers with their new tile maps) is committed to the tab at once, as one tab
   edit (one undo step): the editor shows it, and the History tab lists it.
3. The new blobs are **pending uploads** for the tab: sent in batches (asking `photo-blobs-held` first and skipping
   what the tab already holds). The tab's **save waits** while any are pending, so a save (and the room ops it sends) never
   names a blob the store does not have. A save waiting more than 20 seconds shows the save indicator's "Saving
   photo…" state; a failed batch retries after 2, 4, 8 and 16 seconds, then the indicator shows "Couldn't save the
   photo" with **Retry**, and the tab's other edits wait with it (the tab stays editable).
4. The **preview** is remade a moment (3 seconds) after the last commit to a photo: the composite scaled to fit
   2048 px, encoded, uploaded as a pending upload, and its blob id set on the photo (one tab edit that is not an
   undo step).

## Live sync

- `Tab.photos` never rides a `tab-meta` patch or a whole-tab op's body without its photos merged: it travels as
  **`photo` room ops**, one per changed photo: `{ kind: 'photo', tabId, pageId, ops }` with ops `{ op: 'size',
width, height }`, `{ op: 'put', layer }` (a layer added or changed, whole), `{ op: 'remove', id }`, `{ op: 'order',
ids }` (the stack's order) and `{ op: 'preview', blob }`; or `{ kind: 'photo', tabId, pageId, removed: true }`.
  A frame is at most 200,000 characters; a larger change is several frames applied in order.
- A receiver applies the ops to its photo by layer id: a change to a different layer than its own keeps both; the
  same layer, the incoming one replaces it (the later commit wins). An `order` keeps any layer it does not name in
  its place relative to its neighbours. A `put` for a layer whose photo is gone is dropped.
- A receiver fetches the blobs a layer names as it needs to draw them (the photo in focus: every visible layer's
  tiles in view first; other photo pages: the preview only), from its memory cache (the last 512 MB of decoded
  tiles on a desktop, 128 MB on a phone), else the browser's HTTP cache, else the store.
- The room refuses `photo` ops from a Participant or a Viewer (they are mutations, `MUTATION_OP_KINDS`).

## Undo

- Each commit is one step of the tab's undo history ([Live app](../007-editor/live-app.md) "Undo and redo"), as every edit is: undo puts
  the stack back, tile maps included, so the pixels come back by their blob ids. Up to 50 photo steps of this
  session; older ones fall off.
- The editor keeps the bytes of every blob named by a step still in its history, so an undo never waits on the
  network for its own pixels.
- The server keeps only what tabs name now, plus a day's grace (below): history lives in the session, not the
  store.

## Copies, duplicates and links

- **Copying a design** (Copy to my files, a tab-scoped copy, a Community copy, a template from a design) gives
  every copied tab refs to every blob its source tab held, in the same batch as the copy.
- **Duplicating a tab** in the editor adopts its blobs into the new tab (`photo-blobs-adopt`) before the new tab's first save.
- **A tab shared with another design** ([Tab ↔ design many-to-many](../006-design/tab-design-many-to-many.md)) is a copy
  in each: a body sent to the other designs carries the blobs it names that the sender's tab holds, and each design
  taking it in records refs to them (its marker first), so the bytes stay while any design's tab names them.
- **Layers pasted** from one tab's photo into another's adopt their blobs into the target tab first.

## Offline Mode designs

- An [Offline Mode](../006-design/offline-mode.md) design keeps its photo blobs in this browser (IndexedDB,
  `livedesign-photo-blobs`, by blob id); nothing is uploaded. Its saves never wait.
- **Sync Design** uploads every blob its photos name into the new cloud tabs before their first save; **Take
  Offline** downloads them first. Either refuses (and says so) when a blob cannot be moved.

## Retention

- Daily, in each design's own upkeep (its Durable Object's alarm, `sweepDesignPhotoBlobs` in
  `apps/api/src/db/photo-blobs.ts`): for each tab holding blob refs older than **one day**, the blobs its saved body
  names now are read from it (`photoBlobIdsOf`: every tile, source and preview of `Tab.photos`), and the tab's other
  refs older than a day are removed; a ref whose tab is gone is removed. The blobs the design no longer holds at all
  are released: its markers go, and a blob no design marks any more is deleted from R2 (`releaseBlobs`). A purged
  design releases all of its blobs.
- Bounded: at most 200 tabs a run, resuming the next day; logs `[photo-blobs] sweep` with the counts, and
  `[photo-blobs] release failed` where R2 refuses (bytes kept, never a ref without bytes).
- The day's grace keeps a blob a session's undo or a save in flight still needs. A session open for longer than a
  day re-sends, before its save, any blob of its history it undoes back to.

## Limits

- **Per tab**: `PHOTO_MAX_BYTES_PER_TAB` (decimal bytes, api env; hosted 536,870,912, 512 MB; unset, blank or `0`
  means no limit, the self-host default).
- **Per blob**: 10 MB. **Per batch**: 64 blobs, 24 MB. **`photo-blobs-held`**: 500 ids. **`photo-blobs-adopt`**: 2000 ids.
- **Tab size**: a photo's stack is small (a full 40-megapixel layer's tile map is about 6 KB), well inside the 2 MB
  tab cap at 100 layers.
