# Walkthroughs: blueprint

Derived from [walkthroughs.md](../walkthroughs.md) and the products' `012-collaboration/walkthroughs.md`. The spec
decides; this file adds engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) as `WLKn`. Paths are relative to the repository root.

| File                                                        | Role                                                                                                                                            |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/media/src/walkthrough.ts`                         | Limits, `Walkthrough`, `WalkthroughEvents`, `sealWalkthroughEvents`, `parseWalkthroughEvents`, `parseWalkthroughStart`, sniffing                |
| `packages/media/src/walkthrough-client.ts`                  | `walkthroughCalls`: the service's routes for `createMediaClient().walkthroughs`                                                                 |
| `packages/media/src/walkthrough-door.ts`                    | `handleWalkthroughDoor`: each app's `/api/walkthroughs`                                                                                         |
| `liveworkspace/apps/media/src/walkthroughs.ts`              | `handleWalkthroughs` (the service's routes), the table's reads and writes, `deleteOwnerWalkthroughs`, `sweepPendingWalkthroughs`                |
| `liveworkspace/apps/media/migrations/0005_walkthroughs.sql` | `walkthroughs`                                                                                                                                  |
| `packages/capture/src/*`                                    | `@liveworkspace/capture`: `MIC_CONSTRAINTS`, `CAMERA_CONSTRAINTS`, `canCapture`, `listDevices`, `useMediaDevices`, `levelMeter`, `DevicePicker` |
| `packages/walkthrough/src/*`                                | `@liveworkspace/walkthrough`: the timeline, the recorder, the browser client, the DOM bridge and the UI                                         |
| `<app>/apps/api/src/routes/walkthroughs.ts`                 | Each app's binding of the door: its media owner, its grant, its Community check                                                                 |

## Domain and naming

| Term        | Identifier                                                    | Meaning                                                               |
| ----------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| Walkthrough | `walkthroughs` row; id `crypto.randomUUID()`                  | One recording on one item                                             |
| Item        | `walkthroughs.item`; `?item=` at the service, `?d=` at an app | The app's document, canvas, plan or design it belongs to              |
| Owner       | `walkthroughs.owner` (a media owner, as `images.owner`)       | Who recorded it                                                       |
| Author      | `walkthroughs.author`                                         | Their display name when they recorded it, at most 80 characters       |
| Media       | R2 `walkthroughs/<id>/media`                                  | The audio or video file                                               |
| Events      | R2 `walkthroughs/<id>/events.json`; `WalkthroughEvents`       | The timeline                                                          |
| Ready       | `walkthroughs.ready` (0, 1)                                   | Its media has arrived; only ready ones are listed or read             |
| Host        | `WalkthroughHost` (`@liveworkspace/walkthrough`)              | What an editor binds: viewport store, tabs, slides, fingerprints, api |

## Behaviour and state

### Starting (`POST /app/walkthroughs?owner=`)

1. `owner` must be an id, else `400 invalid_owner`.
2. `Content-Length` over `WALKTHROUGH_START_MAX_BYTES` (`WALKTHROUGH_EVENTS_MAX_BYTES + 16 KiB`) is `413 events_too_large`;
   the body is read through `readCappedBody` at the same cap.
3. `parseWalkthroughStart` (cheapest first): not an object `400 invalid_body`; `item` not an id `400 invalid_item`;
   `mediaType` not accepted `415 unsupported_type` with `acceptedTypes`; `mediaBytes` not a positive integer or over
   `WALKTHROUGH_MEDIA_MAX_BYTES` `413 file_too_large` with `limitBytes`; `events.durationMs` over `WALKTHROUGH_MAX_MS`
   `413 too_long` with `limitMs`; events that don't parse `400 invalid_events`. The title is trimmed, collapsed and cut
   to 120 characters (empty: "Walkthrough"); the author cut to 80 (empty: null).
4. The item's ready-or-pending count at `WALKTHROUGHS_PER_ITEM_MAX` is `403 item_full` with `limit`.
5. The owner's caps (`WALKTHROUGH_MAX_PER_OWNER`, `WALKTHROUGH_MAX_BYTES_PER_OWNER`, null when unset): `403
walkthroughs_full` with `reason`, `limit`, `current`.
6. The events (sealed) are put at `walkthroughs/<id>/events.json`; then the row is inserted with `ready = 0`, checking
   both caps again in the statement; a refused insert deletes the events and answers the cap.
7. `201 { walkthrough }`, logged `[media] walkthrough started { app, id }`.

### Its media (`PUT /app/walkthroughs/<id>/media?owner=`)

1. No row for this app: `404`. Another owner's: `403`. Ready already: `409 already_uploaded`.
2. `Content-Type` (its base type) must equal `media_type`, and `Content-Length` must equal `media_bytes`, else `400
media_mismatch`. No body: the same.
3. `bucket.put('walkthroughs/<id>/media', request.body, { httpMetadata: { contentType } })`: the runtime holds the
   stream to its declared length, so nothing is buffered.
4. The stored object's first 16 bytes (`bucket.get(key, { range: { offset: 0, length: 16 } })`) must sniff as the
   declared container, else the object is deleted and `415 unsupported_type`. A stored size other than `media_bytes`
   is deleted and `400 media_mismatch`.
5. `ready = 1`; `200 { walkthrough }`, logged `[media] walkthrough stored { app, id, bytes }`.

### Deleting

- One (`DELETE /app/walkthroughs/<id>?owner=` or `?item=`): no row for this app `200 { ok: true }`; neither naming its
  owner or its item `403`; else the row first, then both objects. A failed R2 delete logs
  `[media] walkthrough R2 delete failed` and is not undone.
- An item (`DELETE /app/walkthroughs?item=`): `DELETE … WHERE app AND item RETURNING id`, then the objects; `{ deleted }`.
- An owner (`DELETE /app/owners/<owner>`): `deleteOwnerWalkthroughs` beside the images; the answer's `deleted` still
  counts images only.
- A guest merge moves `walkthroughs.owner` with the images.
- The daily sweep deletes rows with `ready = 0` older than `WALKTHROUGH_PENDING_MS`, and their objects
  (`sweepPendingWalkthroughs`), before the image sweep.

### The editor (`@liveworkspace/walkthrough`)

`useWalkthroughs(host)` holds one state at a time: `idle`, `setup`, `countdown`, `recording`, `review`, `saving`,
`playing`. `idle → setup` (Record Walkthrough), `setup → countdown` (Start Recording, with a microphone),
`countdown → recording` (3 s), `recording → review` (Finish or the ten-minute stop), `review → saving` (Save),
`saving → idle` (stored) or `review` (refused, with its message), any of `setup`, `recording`, `review` `→ idle`
(Discard, confirmed past setup). `idle → playing` (a row), `playing → idle` (close).

Saving sends the media part (`PUT …/media`) through the app's own api funnel with its `uploadProgress` option (`apiFetch(url, init, { uploadProgress })`, which sends that one request by XMLHttpRequest, `xhrFetch` in `@liveworkspace/workbench/lib/api/xhr-fetch`, with the same headers, grant, fence and failure report, since fetch cannot report bytes sent). The events part stays a plain fetch. `review.upload` holds `{ sent, total, leftMs }` while the media goes: `uploadEstimate` (`upload-progress.ts`) works `leftMs` out from the average speed since the media began, null until `ESTIMATE_AFTER_MS` (1 s) and some bytes have passed; the state moves only when the whole percentage changes or `PROGRESS_EVERY_MS` (500 ms) has passed. The save card draws a `role="progressbar"` bar with the percentage, `<sent> of <total> MB` and the time left (`formatTimeLeft`: "About N seconds left" in fives under a minute, "About N minutes left" above, "Less than 5 seconds left"), "Finishing" at 100% while the server stores it. A failure clears `upload`, says why and keeps Download a Copy.

The recorder samples the viewport store on its change, at most every `SAMPLE_MS` (100 ms) per kind, with a trailing
sample so the view at rest is always the last one; the pointer likewise from `pointermove` on the canvas root. A
pointer over `[data-element-id]` in the hidden set, or off `[data-canvas-content]`, is `cursor-out` (once). A
`pointerdown` on an element is a `point` unless it is hidden. Tab and slide changes come from the host's
subscriptions. Fingerprints are read from `host.fingerprint(tab)` for the start tab and each tab on its first visit.

Playback: the media plays in an `<audio>` or `<video>`; each animation frame reads its `currentTime` and applies the
latest `view`, `tab`, `slide` and `cursor` at or before it (binary search). `view` maps to the viewer's canvas size by
`fitView`. A slide showing suspends `view`. Any `wheel` or `pointerdown` on the canvas while playing pauses and sets
`detached`; Resume clears it and re-applies the current state.

Hidden elements are hidden by one `<style>` element: `[data-canvas-content] [data-element-id="<id>"] { visibility:
hidden !important }` per id, through `CSS.escape`; while recording, the presenter's own view draws them at 0.35
opacity inside a dashed rose outline (`hiddenCss(ids, "presenter")`).

Hideable marks (`host.hideable`, `WalkthroughHideable`): `marks` are attributes beside `data-element-id` (liveplanner:
`data-plan-card`, `data-dashboard-slot`) whose value is an id, matched anywhere under the canvas root. `elementIdAt`
takes the nearest element carrying any of them (a card inside a board on the canvas is the card), `onHideableSurface`
lets picking take presses on them outside `[data-canvas-content]`, `hiddenCss` adds `[<mark>="<id>"]` per mark, and
`elementBox` rings the first visible match (`checkVisibility`), passing over a covered copy. `canHide()` is read as
the dock draws: false leaves Hide From Recording out and the picking mode off. `selection()` adds to Hide Selection
(liveplanner: the cards with `data-selected`). A host without `hideable` behaves as before.

The camera switch: `useRecorder` holds `cameraOn` (from `localStorage['liveworkspace:walkthrough-camera'] === 'on'`,
false when absent or throwing) and writes it on each flip; `getUserMedia` gets `video: false` while it is off. A
camera that fails turns it off in state only. `allow(kind)` (the pickers' Allow buttons) asks again by bumping the
open effect's key, turning the camera on for `camera`. `listDevices` sets `locked[kind]` when the kind is listed only
with empty device ids.

## Interfaces and contracts

`Walkthrough` = `{ id, item, title, author: string | null, durationMs, mediaType, mediaBytes, camera, createdAt,
ready }`. The door answers `WalkthroughSummary` = `Walkthrough` without `item` and `ready`, plus `mine: boolean` and
`canDelete: boolean`.

| Door route (app api)                 | Grant                                        | Service call                                    | Answers                                               |
| ------------------------------------ | -------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------- |
| `GET /api/walkthroughs?d=`           | read, whole item, not trashed, not Community | `GET /walkthroughs?item=`                       | `{ walkthroughs: WalkthroughSummary[] }`, `canRecord` |
| `POST /api/walkthroughs?d=`          | edit, a person with an owner                 | `POST /walkthroughs?owner=`                     | `201 { walkthrough }`; the service's refusals         |
| `PUT /api/walkthroughs/:id/media?d=` | edit, the same owner                         | `PUT /walkthroughs/:id/media?owner=` (streamed) | `{ walkthrough }`                                     |
| `GET /api/walkthroughs/:id?d=`       | read, whole item                             | `GET /walkthroughs/:id` (item must equal `d`)   | `{ walkthrough, events }`                             |
| `GET /api/walkthroughs/:id/media?d=` | read, whole item                             | `GET /walkthroughs/:id/media`                   | bytes, `private, max-age=86400`, `nosniff`            |
| `DELETE /api/walkthroughs/:id?d=`    | its owner (any read), or edit                | `DELETE …?owner=` or `?item=`                   | `{ ok: true }`                                        |

Refusals at the door: no `d` `400 missing_item`; no grant, a tab-scoped grant, a Community visit or a trashed item
`404 not_found`; a lower level `403 forbidden`; an API token or a workbench session writing `403 forbidden`; no
service `503 walkthroughs_unavailable`; a service `401` or `5xx` `503 walkthroughs_unavailable`, logged.

## Data and persistence

```sql
CREATE TABLE walkthroughs (
  id TEXT PRIMARY KEY, owner TEXT NOT NULL, app TEXT NOT NULL, item TEXT NOT NULL,
  title TEXT NOT NULL, author TEXT, duration_ms INTEGER NOT NULL, media_type TEXT NOT NULL,
  media_bytes INTEGER NOT NULL, events_bytes INTEGER NOT NULL, camera INTEGER NOT NULL,
  ready INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX walkthroughs_item_idx ON walkthroughs (app, item, created_at DESC);
CREATE INDEX walkthroughs_owner_idx ON walkthroughs (owner);
CREATE INDEX walkthroughs_pending_idx ON walkthroughs (ready, created_at);
```

The owner's bytes count `media_bytes + events_bytes` of every row, pending included, so a run of starts cannot pass
the cap before their media lands.

## Errors and edge cases

| Case                                     | Behaviour                                                      |
| ---------------------------------------- | -------------------------------------------------------------- |
| The browser closes mid-upload            | the row stays pending; swept after an hour                     |
| Media that isn't what it says            | stored, sniffed, deleted, `415`                                |
| A walkthrough of another app named by id | `404` at every route                                           |
| The item purged while one is pending     | the purge deletes pending rows too                             |
| An element deleted after recording       | the player simply has nothing to hide or ring                  |
| A tab deleted after recording            | `tab` events naming it are skipped; the view stays where it is |
| The deck changed after recording         | a `slide` naming a missing slide shows no slide                |
| No microphone permission                 | the dock says so; Start Recording stays disabled               |
| No `MediaRecorder` (an old browser)      | Record Walkthrough is not offered; playing still works         |

## Security and trust

- The service's routes are server to server with the app's key; a walkthrough answers only to its own app.
- Each app's door decides who reads: the index's grant on the whole item, never a tab-scoped link, a Community visit or
  the Trash. Writing is a person's (no API token, no workbench session).
- Media is sniffed after it is stored and before it is ready; it is served `nosniff`, `private`.
- Hidden elements are sealed out of the events twice: in the browser and in the service (`sealWalkthroughEvents`).

## Performance and limits

All in `packages/media/src/walkthrough.ts` (the spec's table). The media streams from the browser through the app's
Worker to R2 without being buffered. The recorder's samples are throttled to 100 ms per kind, so ten minutes is at most
about 12,000 events (0.7 MB of JSON). The player does one binary search per kind per frame (log2 of 20,000 is 15
steps). Hiding is one stylesheet, rewritten only when the hidden set changes.

## Observability

| Level   | Line                                                 |
| ------- | ---------------------------------------------------- |
| `log`   | `[media] walkthrough started { app, id }`            |
| `log`   | `[media] walkthrough stored { app, id, bytes }`      |
| `log`   | `[media] walkthrough deleted { app, id }`            |
| `log`   | `[media] walkthroughs purged { app, deleted }`       |
| `warn`  | `[media] walkthrough refused { app, error }`         |
| `error` | `[media] walkthrough R2 delete failed`               |
| `log`   | `[media] sweep: deleted <n> pending walkthroughs`    |
| `warn`  | `[walkthroughs] door refused { error, status }`      |
| `error` | `[walkthroughs] media service answered { status }`   |
| `warn`  | `[walkthrough] recorder failed { reason }` (browser) |

Telemetry goes through the workbench's bound `track` from `packages/walkthrough/src/telemetry.ts`
(`walkthroughTelemetry`, and `limitOfRefusal`, which names an api refusal code as a limit). The recorder sends Started
when it begins, Refused when the clock or the size check ends it (once, `limitCounted`), Created or Refused when a save
answers, and Abandoned when `close` runs in the recording or review phase; the player sends Played once a walkthrough
is ready; the list sends Deleted once the api deleted one. Each product's `api-schema` names the `Walkthrough`
category and the `Abandoned`, `Refused` and `Played` actions; each canvas editor's manifest pins the pairs, and the
site charts them (`apps/site/app/telemetry/_shared/snapshot-walkthrough-metrics.ts`).

## Testing

| Test                                                                            | Pins                                                                                                                                                            |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/media/src/walkthrough.test.ts`                                        | parse and seal, every refusal, hidden ids stripped, sniffing, titles                                                                                            |
| `packages/media/src/walkthrough-door.test.ts`                                   | every door route and role, Community and tab-scoped visits, the service's refusals passed on                                                                    |
| `liveworkspace/apps/media/src/walkthroughs.test.ts`                             | start, media, list, read, delete by owner and item, purge, caps, per-item cap, sniff, sweep, merge                                                              |
| `packages/capture/src/*.test.ts`                                                | constraints with a device, capture support, device lists and labels, the level meter                                                                            |
| `packages/walkthrough/src/*.test.ts(x)`                                         | the timeline, `fitView`, the recorder's sampling and stop, the client, the UI's states and roles                                                                |
| `packages/walkthrough/src/telemetry.test.ts`, `ui.test.tsx`                     | each event once, the limits, set-up closed counts nothing, a refused save by its code                                                                           |
| `packages/walkthrough/src/upload-progress.test.ts`, `ui.test.tsx`, `io.test.ts` | the estimate and its wording, the save card's bar while the media goes, at the finish and after a failure (Download a Copy), the funnel handed `uploadProgress` |

## Constants and configuration

| Constant                          | Value              | Where                  |
| --------------------------------- | ------------------ | ---------------------- |
| `WALKTHROUGH_MAX_MS`              | `600_000`          | `walkthrough.ts`       |
| `WALKTHROUGH_VIDEO_BPS`           | `400_000`          | `walkthrough.ts`       |
| `WALKTHROUGH_AUDIO_BPS`           | `48_000`           | `walkthrough.ts`       |
| `WALKTHROUGH_MEDIA_MAX_BYTES`     | `40 * 1024 * 1024` | `walkthrough.ts`       |
| `WALKTHROUGH_EVENTS_MAX_BYTES`    | `2 * 1024 * 1024`  | `walkthrough.ts`       |
| `WALKTHROUGH_START_MAX_BYTES`     | events + 16 KiB    | `walkthrough.ts`       |
| `WALKTHROUGH_EVENTS_MAX`          | `20_000`           | `walkthrough.ts`       |
| `WALKTHROUGH_HIDDEN_MAX`          | `2_000`            | `walkthrough.ts`       |
| `WALKTHROUGH_TITLE_MAX`           | `120`              | `walkthrough.ts`       |
| `WALKTHROUGH_AUTHOR_MAX`          | `80`               | `walkthrough.ts`       |
| `WALKTHROUGHS_PER_ITEM_MAX`       | `50`               | `walkthrough.ts`       |
| `WALKTHROUGH_PENDING_MS`          | `3_600_000`        | `walkthrough.ts`       |
| `WALKTHROUGH_MAX_PER_OWNER`       | `"50"`             | the service's `[vars]` |
| `WALKTHROUGH_MAX_BYTES_PER_OWNER` | `"1073741824"`     | the service's `[vars]` |
| `SAMPLE_MS`                       | `100`              | `packages/walkthrough` |
| `COUNTDOWN_MS`                    | `3_000`            | `packages/walkthrough` |
| `ESTIMATE_AFTER_MS`               | `1_000`            | `packages/walkthrough` |
| `PROGRESS_EVERY_MS`               | `500`              | `packages/walkthrough` |
| `SKIP_MS`                         | `5_000`            | `packages/walkthrough` |

## Defaults ledger

- `WLK1`: the per-person caps are 50 walkthroughs and 1 GiB, in both environments.
- `WLK2`: recording is an Editor's; any reader plays; the recorder or an Editor deletes.
- `WLK3`: a tab-scoped link and a Community visit see no walkthroughs.
- `WLK4`: a pending walkthrough is swept after an hour.
