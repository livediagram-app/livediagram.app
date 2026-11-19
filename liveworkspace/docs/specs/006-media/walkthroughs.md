# Walkthroughs

A **walkthrough** is a narrated recording of a canvas that someone chose to make: their voice, and their camera when
they turn it on, beside the path the view took through the canvas (pans, zooms, tab changes, slide steps) and their
pointer. It plays back over the live canvas, so a viewer can pause, look around and resume. Each product says how
its editor records and plays one ([livediagram's](../../../../livediagram/docs/specs/012-collaboration/walkthroughs.md)
is the full account; livedocuments, livedesign and liveplanner each have their own). This spec is the platform's
half: where a walkthrough is kept, what it may be, and when it goes.

**A video of the screen** (owner, 2026-11-17: "I expected it to be an actual video that recorded my screen while
talking"). A new walkthrough is a **screen recording**: the browser tab as a video, with the presenter's voice, and their
camera bubble filmed into it when the camera is on. It plays anywhere as a video, and can be shared by a public link
(below). Walkthroughs recorded before keep their **replay** (the events over the live canvas, as this spec describes
under "The events"), so nothing already recorded stops playing. "Screen recordings" below says what changed.

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

### Recording without a camera

Sound alone is the easy path (owner, 2026-11-17). The recording dock's **Camera** is an on/off switch beside the
microphone, **off** until the person turns it on, and the browser remembers it per browser (Browser Storage, key
`liveworkspace:walkthrough-camera`, `on` or `off`; storage that throws reads as off and keeps nothing). While it is
off the recorder asks the browser for the microphone alone (`getUserMedia({ audio, video: false })`), so no camera
permission is asked; turning it on asks for the camera and shows its device list. A sound-only walkthrough has no
camera bubble while recording and plays back with no video frame. In its place the player shows the **voice chip**, in
the recorded corner: a small pill holding the presenter's initial in a small round avatar, their name ("You" for your
own; none when the list has no name for them) and four level bars that move while it plays and rest while it is
paused. It is a fraction of the camera bubble's size and a different shape, so it never reads as an empty camera
(Work Tracker 1208; it replaces the camera-sized round mark with the initial). A camera that won't start turns the switch off for that recording only, says "The camera
couldn't start, so this walkthrough records sound only." and records sound; the remembered choice stays on. No
camera at all (the default camera answers `NotFoundError`) is not a failure: the switch stays on, its list says
**No Camera Found** (disabled) and the recording is sound alone; turning the switch off and on, or a camera plugged in,
tries again.

### The device pickers

`DevicePicker` (`@liveworkspace/capture`) draws the microphone and the camera lists by one rule, so they never
differ (owner, 2026-11-17):

| The list                                                       | Shows                                                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Devices to pick                                                | **Default**, then each device's name; enabled                                                                 |
| None, because the browser hides them until the page is allowed | "Not allowed yet" and **Allow Microphone** / **Allow Camera**, which asks the browser (its permission prompt) |
| None at all                                                    | **No Microphone Found** / **No Camera Found**; disabled                                                       |

The camera's off is the switch, never an entry in its list (there is no "No Camera" option). A browser "hides them
until allowed" when it lists the kind with no device id (Chrome before permission); `listDevices` reports that as
`locked`.

### What an app can hide

In every canvas app an element is anything marked `data-element-id` inside the canvas
content (`data-canvas-content`). An app whose tabs draw other things over the canvas (liveplanner's Board and
Dashboard tabs, laid over it rather than in it) names them to `@liveworkspace/walkthrough` as **hideable marks**:
further attributes whose value is the id of a thing that can be hidden (liveplanner's `data-plan-card` and
`data-dashboard-widget`, the latter on a filled Dashboard slot alone, so an empty slot can't be picked), wherever under
the canvas root they are drawn. Picking, the presenter's and the viewer's
hiding, the pointer's `cursor-out` and the player's press rings all read them like `data-element-id`, and a `point`
may name one. The app also says whether the tab showing has **anything to hide** at all: where it has nothing (a
liveplanner Sheet or Form tab, an empty canvas, a Board tab whose filter leaves no card showing), the set-up leaves Hide From Recording out rather than offering a mode
in which no press can do anything. An app that says neither (livediagram, livedocuments, livedesign) hides canvas
elements alone and always offers the control, as before.

**True to time** (owner, 2026-11-17). The recorder never reads the microphone straight: its sound goes through Web
Audio first (`steadyAudio`, `@liveworkspace/capture`, on the context the Record press started), then to MediaRecorder
with the camera's video as it is. Read straight, some USB microphones record about a quarter too long, slowed and
garbled (an NZXT USB mic in Brave: 5 s came out 6.36 s, whatever the processing); through Web Audio the same mic
records 4.98 s.

**On no speaker's clock** (Work Tracker 1314, 2026-11-19). A Web Audio context runs on its output device's clock, so a
recording routed through it is only as true as the speakers or headphones it plays to: the slow sound came back on prod
with the same fix in place. The context the Record press starts (`primeAudio`, which the recorder and the level meter
share) and the recorder's own fallback (`recordingContext`, `@liveworkspace/capture`) therefore ask for no output
device at all (`sinkId: { type: 'none' }`, so the browser clocks it by wall time) at 48 kHz, Opus's own rate, so a
Bluetooth headset that opens at 16 kHz never narrows it. A browser that refuses either is asked again without the
rate, then with no options, so a recording is never lost or silent for it (Firefox and Safari ignore the sink and keep
their default). Nothing is played through this context; it only feeds the recorder and the meter. The microphone's
own constraints are unchanged: measured in Chromium, a context at 16, 24, 44.1 or 48 kHz fed by a 16, 44.1 or 48 kHz
source records 4.98 s of 5 s at true pitch, so a rate mismatch alone does not slow a recording. Opening a Bluetooth
headset's microphone still switches it to its call profile, which narrows the sound before the browser has it.

**Chosen before, never during** (owner, 2026-11-17). Hide From Recording is in the set-up alone: the recording bar
has only the clock, the level, Discard and Finish, so what a walkthrough hides is settled before it starts.

**The set-up** (owner, 2026-11-17) opens from Record Walkthrough in Tools as a popover beside it (a drawer on a phone,
as Add Webhook does): the microphone and camera, the **Mic Level** meter (filled from -65 dBFS, just above a silent room
after the browser's noise suppression, to -15 dBFS, a shout: talking fills half to four fifths), the bubble's corner,
Hide From Recording and Start Recording. A press outside it, Escape, or Tools closing lets the devices go; one
outside while picking what to hide does not. Start Recording closes Tools for the count. Walkthroughs in Tools closes on
a press outside like any tool (owner, 2026-11-17: only Slide Deck stays open while you work), except while picking
what to hide, whose presses land on the canvas.

**Picking steps aside** (Work Tracker 1287). While picking what to hide, Tools and the set-up both step out of the
way, so every part of the tab can be pressed (Tools covered a Dashboard tab's right-hand slots and a board's right-hand
columns). Tools stays open but out of sight (the tool's `stepAside`, footer-tools-menu.md "Sizes"), and the set-up gives
way to the **picking bar**: "Press elements to hide them", the hidden count, **Hide Selection** and **Done**, a slim card
where the recording bar goes (under the palette strip, in the palette tray's slot; at the bottom centre of the canvas
without a strip). Done, or Escape, ends picking and brings Tools and the set-up back as they were, the devices still
open.

**Edited since recording.** `fingerprints` holds each visited tab's content fingerprint when the recording began
(the app's own; any string up to 128 characters). A player that finds a tab's fingerprint changed says the
walkthrough was **edited since recording** and still plays it over the canvas as it is now.

## Screen recordings

- **Recording.** Start Recording asks the browser to share **this tab** (`getDisplayMedia` with `preferCurrentTab`,
  `selfBrowserSurface: 'include'`, `displaySurface: 'browser'`, no system audio), the browser's own prompt, once per
  recording, inside the press. Refused, or a browser without it (Safari, phones), the set-up says "Your browser
  didn't share this tab, so nothing was recorded." and stays open; nothing is recorded. Shared, the count runs and
  `MediaRecorder` records the tab's video track with the microphone's sound (through `steadyAudio`) as one WebM.
  The camera, when on, is the round bubble on screen, filmed with the rest. Without the camera there is no bubble
  (the voice chip is a replay's). The browser's own "sharing this tab" bar shows while it records. Stopping
  the share from the browser's bar is Finish.
- **What it films.** The whole tab as the presenter sees it. **Hide From Recording** hides the chosen elements on the
  presenter's own screen for the length of the recording (fully, not the faded presenter view a replay used), so the
  video never holds them. The recording bar, the count and the set-up stay out of the canvas's way but are in the
  tab, so they are filmed; the bar is small.
- **Saving.** Finish saves at once, named "Walkthrough of <tab>" (no naming step: owner, 2026-11-17); the save card
  shows only while it uploads, or to say why it couldn't (with Download a Copy). Renaming is in the list.
- **Events.** A screen recording stores `{ v: 1, screen: true, durationMs, camera, corner, startTab, hidden: [],
fingerprints: {}, events: [] }`: the length and nothing to replay. `screen` marks it; the player plays the video.
- **Playing.** Pressing one in the list opens the **video player**: a popover over the editor (a sheet on a phone)
  with the video, its title, who and when, **Share** (its owner or an Editor; it opens the Public Link popover, and
  reads **Shared** while the link is on), **Full Screen**, and the browser's own controls (play, seek, speed). Tools
  closes first. The same `VideoDialog` plays one from the Explorer's library. A replay (no `screen`) plays as before.

### Each walkthrough's menu

Each row in the Walkthroughs list ends in a **⋯** (shown on hover and on a phone always) with:

- **Rename**: the title edits in place in the row (Enter or a press away saves, Escape cancels; at most 120
  characters; blank keeps the old). Its owner, or an Editor of the document.
- **Share** (screen recordings only): a popover beside the row with **Public Link** on or off. On, it shows the link
  (`https://www.liveworkspace.app/walkthrough?c=<code>`, the code 22 random URL-safe characters; the site is a static export, so one page reads the code from the address) and **Copy Link**; off,
  the link stops working at once and a new one is made next time. Anyone with the link watches the video, its title
  and who made it, and nothing else: not the canvas, not the document's name. Its owner, or an Editor.
- **Delete**: asks first, as before.

The public page lives on liveworkspace.app (platform first): `/walkthrough?c=<code>` shows the video full width on the
site's plain page, its title and "by <author>", with "Made with <app>" linking to the app. It is `noindex` and sends no Referer. A code
that is off or unknown says **Walkthrough Not Found**.

## Limits

Every number is in `packages/media/src/walkthrough.ts`; the service enforces them, and the recorder stops itself
at the same ones, so a refusal is rare and always says why.

| Constant                          | Value            | Why                                                                                                                                                         |
| --------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WALKTHROUGH_MAX_MS`              | 10 minutes       | A walkthrough explains a canvas; past ten minutes it is a meeting. Loom's free tier stops at five.                                                          |
| `WALKTHROUGH_VIDEO_BPS`           | 1,000,000 bits/s | A screen recording: a canvas's lines and text stay sharp at 1080p, mostly still frames. (A replay's camera bubble was 400 kbit/s.)                          |
| `WALKTHROUGH_AUDIO_BPS`           | 48,000 bits/s    | Opus speech is clear from 32 kbit/s.                                                                                                                        |
| `WALKTHROUGH_MEDIA_MAX_BYTES`     | 90 MiB           | Ten minutes at both bit rates is 78.6 MB; 90 MiB (94.4 MB) leaves 20% for an encoder that overshoots and stays under the 100 MB a Worker request may carry. |
| `WALKTHROUGH_EVENTS_MAX_BYTES`    | 2 MiB            | The recorder samples the view and the pointer at most 10 times a second each: ten minutes is about 12,000 events, under 700 KB.                             |
| `WALKTHROUGH_EVENTS_MAX`          | 20,000           | The same bound counted in events.                                                                                                                           |
| `WALKTHROUGH_HIDDEN_MAX`          | 2,000            | Ids in `hidden`.                                                                                                                                            |
| `WALKTHROUGH_TITLE_MAX`           | 120 characters   | A title.                                                                                                                                                    |
| `WALKTHROUGHS_PER_DOCUMENT_MAX`   | 50               | A document's list stays one short list.                                                                                                                     |
| `WALKTHROUGH_MAX_PER_OWNER`       | 50 (a var)       | Per person, across every app.                                                                                                                               |
| `WALKTHROUGH_MAX_BYTES_PER_OWNER` | 1 GiB (a var)    | Per person: 25 ten-minute videos, or hundreds with the camera off. At R2's storage price that is about $0.015 a person a month at the very most.            |
| `WALKTHROUGH_PENDING_MS`          | 1 hour           | A row whose media never arrived is swept after this.                                                                                                        |

The two per-person caps are `[vars]` in the service's `wrangler.toml`, as the image caps are, so the owner can
change them without a deploy of code; unset, blank, 0 or garbage is no cap.

The accepted media types are `video/webm`, `video/mp4`, `audio/webm` and `audio/mp4` (Chrome, Edge and Firefox
record WebM; Safari records MP4). The declared type is the recorder's MIME type without its parameters; the
service checks the file's first bytes (WebM's EBML header, MP4's `ftyp` box) against it.

## The service's routes

Under `/api/media/app`, with the app's key ([media.md](media.md) "The API"). A walkthrough is only ever its own
app's: every route answers another app's walkthrough as missing.

| Route                                                | What it does                                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /walkthroughs?item=`                            | The document's ready walkthroughs, newest first: `{ walkthroughs: [{ walkthrough, owner }] }`                                        |
| `GET /walkthroughs?owner=`                           | A person's own ready walkthroughs in the app, newest first (at most 200), for the Explorer's library: the same shape                 |
| `POST /walkthroughs?owner=`                          | Start one: `{ item, title, author, mediaType, mediaBytes, events }`, the events stored at once; `201 { walkthrough }`, not yet ready |
| `PUT /walkthroughs/<id>/media?owner=`                | Its media, the raw body, exactly `mediaBytes` long and of `mediaType`; then it is ready: `{ walkthrough }`                           |
| `GET /walkthroughs/<id>`                             | A ready one, whose it is, and its events: `{ walkthrough, owner, events }`                                                           |
| `GET /walkthroughs/<id>/media`                       | Its media's bytes, with their `Content-Type` and `Content-Length`                                                                    |
| `DELETE /walkthroughs/<id>?owner=`                   | Its owner deletes it: the row, then both objects                                                                                     |
| `DELETE /walkthroughs/<id>?item=`                    | The app deletes it for an Editor of its document (the app has checked); the item must match                                          |
| `PATCH /walkthroughs/<id>?owner=` or `?item=`        | Rename it: `{ title }` (1 to 120 characters after trimming): `{ walkthrough }`. Owner, or the app for an Editor of the item          |
| `PUT /walkthroughs/<id>/share?owner=` or `?item=`    | Turn its public link on (a screen recording only, else `409 not_screen`): `{ walkthrough }` with `shareCode`                         |
| `DELETE /walkthroughs/<id>/share?owner=` or `?item=` | Turn it off: the code is forgotten. `{ walkthrough }`                                                                                |
| `DELETE /walkthroughs?item=`                         | The document was purged: every walkthrough on it goes. `{ deleted }`                                                                 |

`Walkthrough` on the wire is `{ id, item, title, author, durationMs, mediaType, mediaBytes, camera, screen, shareCode,
createdAt, ready }` (`shareCode` null while its link is off).

**The public door** (no app key; the liveworkspace site calls it): `GET /api/media/walkthroughs/shared/<code>` answers
`{ title, author, app, durationMs, mediaType, createdAt }` for a ready screen recording whose link is on, else 404;
`GET /api/media/walkthroughs/shared/<code>/media` its bytes, with `Range` support so a video seeks, `Cache-Control:
private, no-store` (a link turned off stops at once).
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

## Telemetry

Each canvas editor counts, under its own app and from the shared package, which of these happened (never a title, an
id, a length or a size):

| Event                             | When                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| `Walkthrough·Started`             | A recording began, after the count                                                         |
| `Walkthrough·Created`             | It was saved                                                                               |
| `Walkthrough·Abandoned`           | A recording that had begun was thrown away unsaved, from the dock or the save card         |
| `Walkthrough·Refused·TooLong`     | The recording reached ten minutes and stopped itself, or the service refused a long save   |
| `Walkthrough·Refused·TooLarge`    | The recording reached the size limit and stopped itself, or the service refused a big save |
| `Walkthrough·Refused·ItemFull`    | A save was turned away: the document already has its most walkthroughs                     |
| `Walkthrough·Refused·AccountFull` | A save was turned away: the person's walkthroughs or space are used up                     |
| `Walkthrough·Played`              | A saved walkthrough was opened to play                                                     |
| `Walkthrough·Deleted`             | A saved walkthrough was deleted                                                            |

Closing set-up or the count is not an abandon: nothing had been recorded. A limit that stops a recording counts once,
and a save the service refuses for any other reason (a forbidden caller, an outage) counts nothing.

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
| `GET /api/walkthroughs?mine=1`        | A person, as themselves: their own, on every item, each with its `item`                |
| `POST /api/walkthroughs?d=`           | An Editor of the document, as a person (no API token, no workbench session)            |
| `PUT /api/walkthroughs/<id>/media?d=` | The same Editor, for the walkthrough they started                                      |
| `GET /api/walkthroughs/<id>?d=`       | Anyone who may read the whole document: `{ walkthrough, mine, events }`                |
| `GET /api/walkthroughs/<id>/media?d=` | The same: the bytes, `Cache-Control: private`                                          |
| `DELETE /api/walkthroughs/<id>?d=`    | Its recorder, or an Editor of the document                                             |

A tab-scoped link's visitor sees no walkthroughs (one can travel across tabs), nor does a document in the Trash.
A document kept Offline has no walkthroughs, since no server holds it. Without a media key every route
answers `503 { error: "walkthroughs_unavailable" }`, and the editor offers none.

## The Explorer's Walkthroughs

Every app with walkthroughs (livediagram, livedesign, livedocuments, liveplanner) has a **Walkthroughs** page in the
Explorer's Library (owner, 2026-11-17), beside the Image Gallery and Shape Libraries, at `/explorer/walkthroughs`, and a
Walkthroughs tab in the editor panel's Library, where the cards are small tiles three to a row (the box with its Play and
length, the title under it; the item and date in its tooltip), and one playing widens to the whole row so its controls
have room (owner, 2026-11-17). It lists every walkthrough the person recorded in that app, newest
first (`GET /api/walkthroughs?mine=1`), as cards in a grid:

- **The preview box** (16:9): a soft brand gradient with the recorder's initial (a camera icon for one with video), its
  length as a chip, and a large Play button. Pressing it loads the media (with the person's token, as a blob, so the
  bytes never sit behind a public address) and plays it in the same centred modal as the editor's Tools (owner,
  2026-11-17): the shared `VideoDialog` (`@liveworkspace/ui`), with its title, length and date, **Share** for a screen
  recording (the same Public Link popover), **Full Screen** and **Close**. The card stays as it is. One plays at a time.
- **Under it**: the title, the item it was recorded on (its name from the index, a link that opens the item; "An item
  you can no longer open" when the index has none), and when it was recorded with its size.
- **Delete** (a bin on the card) asks in a confirm popover ("Delete this walkthrough? It can't be undone."), then
  deletes it for good (`DELETE /api/walkthroughs/<id>?d=<item>`), the media and events with it.
- Empty, the page says "No walkthroughs yet" with a line on recording one from Tools on any item. While it loads,
  skeleton cards in the grid's shape.

liveworkspace.app's Explorer shows the page for the app it is on, read by the workspace token as the other Library
pages are. The sites registry's `walkthroughsPath` (`/api/walkthroughs`, null where an app has none) says which apps
have it.
