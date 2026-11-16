# Walkthroughs

A **walkthrough** is a narrated recording of a canvas that someone chose to make: their voice, and their camera when
they turn it on, beside the path the view took through the canvas (pans, zooms, tab changes, slide steps) and their
pointer. It plays back over the live canvas, so a viewer can pause, look around and resume. Each product says how
its editor records and plays one ([livediagram's](../../../../livediagram/docs/specs/012-collaboration/walkthroughs.md)
is the full account; livedocuments, livedesign and liveplanner each have their own). This spec is the platform's
half: where a walkthrough is kept, what it may be, and when it goes.

The media service keeps walkthroughs beside the images, in the same D1 database and R2 bucket, and each app's api
is their only door, as it is for images ([media.md](media.md) "What lives where").

```
packages/media/src/walkthrough.ts        the contract: limits, types, the events' shape, sealing and parsing, sniffing
packages/media/src/walkthrough-door.ts   each app's /api/walkthroughs, once, bound by each app
liveworkspace/apps/media/src/walkthroughs.ts          the service's table and its routes
packages/walkthrough                      @liveworkspace/walkthrough: the recorder, the player and their UI
packages/capture                          @liveworkspace/capture: microphone, camera and the device picker
```

## Calls are never recorded

livehuddle's calls are relayed and never recorded ([the privacy policy](../010-site/site.md#privacy-and-terms-privacy-terms)).
Nothing here changes that: a walkthrough is made only by the person speaking, on purpose, with a Record button,
in the canvas apps (livediagram, livedocuments, livedesign, liveplanner). livehuddle has no walkthroughs, and no
call's sound or picture ever reaches this service. The privacy policy says both, in two separate sentences.

## What a walkthrough is

One walkthrough is two objects and one row:

- **The media**: one audio or video file, as the browser's `MediaRecorder` wrote it. Video when the camera was on
  (the round bubble's picture with the voice), audio when it was off.
- **The events**: one JSON document (`WalkthroughEvents`, below) holding the timeline the player replays.
- **The row** in `walkthroughs`: who recorded it (its **owner**, a media owner as for images: an account id, or
  a guest's hash), the app, the document, its title, length, the media's type and size, whether it had a camera,
  when it was made, and whether its media has arrived (**ready**).

A walkthrough belongs to one document in one app. It is the recorder's, as an image is its uploader's, and the
document's readers are its audience.

### The events

```ts
type WalkthroughEvents = {
  v: 1;
  durationMs: number; // the media's length, at most WALKTHROUGH_MAX_MS
  camera: boolean; // the media is a video of the presenter
  corner: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'; // where the bubble sits
  startTab: string; // the tab the recording began on
  hidden: string[]; // the element ids kept out of it (Hide From Recording)
  fingerprints: Record<string, string>; // each visited tab's content fingerprint at the start
  events: WalkthroughEvent[]; // in time order
};

type WalkthroughEvent =
  | { t: number; k: 'view'; cx: number; cy: number; zoom: number; w: number; h: number }
  | { t: number; k: 'cursor'; x: number; y: number } // canvas coordinates
  | { t: number; k: 'cursor-out' } // the pointer left the canvas, or went over a hidden element
  | { t: number; k: 'point'; id: string } // a press on an element: the player rings it
  | { t: number; k: 'tab'; tab: string }
  | { t: number; k: 'slide'; slide: string | null; label?: string }; // a deck's slide, or null when it ends
```

`t` is milliseconds from the start. A `view` names the canvas point at the centre of the screen, the zoom, and
the canvas's size on screen then, so a player of another size shows the same region (it scales the zoom by the
smaller of the two size ratios). The events carry no element's content, only ids, and only for `point` and
`hidden`.

**Hidden elements stay out.** Sealing (`sealWalkthroughEvents`) runs in the recorder before the upload and again in
the service when the events arrive: every `point` naming a hidden element is dropped, and the recorder writes
`cursor-out` rather than any pointer sample over one. The `hidden` list itself names ids only, so the player can
hide them; it holds no content.

**Edited since recording.** `fingerprints` holds each visited tab's content fingerprint when the recording began
(the app's own; any string up to 128 characters). A player that finds a tab's fingerprint changed says the
walkthrough was **edited since recording** and still plays it over the canvas as it is now.

## Limits

Every number is in `packages/media/src/walkthrough.ts`; the service enforces them, and the recorder stops itself
at the same ones, so a refusal is rare and always says why.

| Constant                          | Value          | Why                                                                                                                                                                                 |
| --------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WALKTHROUGH_MAX_MS`              | 10 minutes     | A walkthrough explains a canvas; past ten minutes it is a meeting. Loom's free tier stops at five.                                                                                  |
| `WALKTHROUGH_VIDEO_BPS`           | 400,000 bits/s | The bubble shows the camera at most 240 px across; 480 x 480 at 400 kbit/s is sharp there.                                                                                          |
| `WALKTHROUGH_AUDIO_BPS`           | 48,000 bits/s  | Opus speech is clear from 32 kbit/s.                                                                                                                                                |
| `WALKTHROUGH_MEDIA_MAX_BYTES`     | 40 MiB         | Ten minutes at both bit rates is 33.6 MB; 40 MiB leaves 25% for an encoder that overshoots, and stays far under the 100 MB a Worker request may carry. Audio alone is about 3.6 MB. |
| `WALKTHROUGH_EVENTS_MAX_BYTES`    | 2 MiB          | The recorder samples the view and the pointer at most 10 times a second each: ten minutes is about 12,000 events, under 700 KB.                                                     |
| `WALKTHROUGH_EVENTS_MAX`          | 20,000         | The same bound counted in events.                                                                                                                                                   |
| `WALKTHROUGH_HIDDEN_MAX`          | 2,000          | Ids in `hidden`.                                                                                                                                                                    |
| `WALKTHROUGH_TITLE_MAX`           | 120 characters | A title.                                                                                                                                                                            |
| `WALKTHROUGHS_PER_DOCUMENT_MAX`   | 50             | A document's list stays one short list.                                                                                                                                             |
| `WALKTHROUGH_MAX_PER_OWNER`       | 50 (a var)     | Per person, across every app.                                                                                                                                                       |
| `WALKTHROUGH_MAX_BYTES_PER_OWNER` | 1 GiB (a var)  | Per person: 25 ten-minute videos, or hundreds with the camera off. At R2's storage price that is about $0.015 a person a month at the very most.                                    |
| `WALKTHROUGH_PENDING_MS`          | 1 hour         | A row whose media never arrived is swept after this.                                                                                                                                |

The two per-person caps are `[vars]` in the service's `wrangler.toml`, as the image caps are, so the owner can
change them without a deploy of code; unset, blank, 0 or garbage is no cap.

The accepted media types are `video/webm`, `video/mp4`, `audio/webm` and `audio/mp4` (Chrome, Edge and Firefox
record WebM; Safari records MP4). The declared type is the recorder's MIME type without its parameters; the
service checks the file's first bytes (WebM's EBML header, MP4's `ftyp` box) against it.

## The service's routes

Under `/api/media/app`, with the app's key ([media.md](media.md) "The API"). A walkthrough is only ever its own
app's: every route answers another app's walkthrough as missing.

| Route                                 | What it does                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /walkthroughs?item=`             | The document's ready walkthroughs, newest first: `{ walkthroughs: [{ walkthrough, owner }] }`                                        |
| `POST /walkthroughs?owner=`           | Start one: `{ item, title, author, mediaType, mediaBytes, events }`, the events stored at once; `201 { walkthrough }`, not yet ready |
| `PUT /walkthroughs/<id>/media?owner=` | Its media, the raw body, exactly `mediaBytes` long and of `mediaType`; then it is ready: `{ walkthrough }`                           |
| `GET /walkthroughs/<id>`              | A ready one, whose it is, and its events: `{ walkthrough, owner, events }`                                                           |
| `GET /walkthroughs/<id>/media`        | Its media's bytes, with their `Content-Type` and `Content-Length`                                                                    |
| `DELETE /walkthroughs/<id>?owner=`    | Its owner deletes it: the row, then both objects                                                                                     |
| `DELETE /walkthroughs/<id>?item=`     | The app deletes it for an Editor of its document (the app has checked); the item must match                                          |
| `DELETE /walkthroughs?item=`          | The document was purged: every walkthrough on it goes. `{ deleted }`                                                                 |

`Walkthrough` on the wire is `{ id, item, title, author, durationMs, mediaType, mediaBytes, camera, createdAt, ready }`.
The owner travels beside it, never in it, so an app decides what its browser is told (only "yours" or not).

### Refusals

Cheapest first, each `{ error }` with what explains it:

1. A body that is not JSON or over the events' cap plus 16 KiB: `400 invalid_body` / `413 events_too_large`.
2. An item id missing or over 200 characters: `400 invalid_item`.
3. A media type not accepted: `415 unsupported_type` with `acceptedTypes`.
4. A media size of 0 or over the cap: `413 file_too_large` with `limitBytes`.
5. Events that don't parse, run past the length cap or past `durationMs`: `400 invalid_events`; longer than ten
   minutes: `413 too_long` with `limitMs`.
6. The document already has 50: `403 item_full` with `limit`.
7. The person's caps: `403 walkthroughs_full` with `reason` (`count` or `bytes`), `limit` and `current`.

The media upload refuses a row that is not the caller's (`403`), one already ready (`409 already_uploaded`), a type
or length that differs from what was declared (`400 media_mismatch`), and bytes whose first bytes are not the declared
container (`415 unsupported_type`, the stored object deleted again).

## Deleting

- **One walkthrough**: its recorder, or an Editor of its document, through the app. The row goes first, then the
  media and the events objects; a failed R2 delete is logged (`[media] walkthrough R2 delete failed`) and leaves
  unreachable bytes, never a row without them.
- **A document purged** from the Trash: the app's purge asks for every walkthrough on it to go, beside its previews.
- **An account deleted**: every walkthrough it recorded, in every app, goes with its images (`DELETE /owners/<owner>`).
- **A guest signs up**: their walkthroughs move to the account with their images (`POST /owners/merge`).
- **An abandoned upload**: the daily sweep deletes rows still not ready an hour after they began, and their objects.

A walkthrough is not swept for age: it stays until someone deletes it or its document goes.

## Each app's door

`/api/walkthroughs` on each canvas app's api, for its own editor (`handleWalkthroughDoor` in
`packages/media/src/walkthrough-door.ts`; each app binds its media owner rule and its document grant):

| Route                                 | Who                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `GET /api/walkthroughs?d=`            | Anyone who may read the whole document: `{ walkthroughs: [{ ...walkthrough, mine }] }` |
| `POST /api/walkthroughs?d=`           | An Editor of the document, as a person (no API token, no workbench session)            |
| `PUT /api/walkthroughs/<id>/media?d=` | The same Editor, for the walkthrough they started                                      |
| `GET /api/walkthroughs/<id>?d=`       | Anyone who may read the whole document: `{ walkthrough, mine, events }`                |
| `GET /api/walkthroughs/<id>/media?d=` | The same: the bytes, `Cache-Control: private`                                          |
| `DELETE /api/walkthroughs/<id>?d=`    | Its recorder, or an Editor of the document                                             |

A tab-scoped link's visitor sees no walkthroughs (one can travel across tabs), nor does a document in the Trash.
A document kept in This Browser has no walkthroughs, since no server holds it. Without a media key every route
answers `503 { error: "walkthroughs_unavailable" }`, and the editor offers none.
