# Live embeds: blueprint

Derived from [Live embeds](../live-embeds.md) and [the workbench's live embed tickets](../../011-workbench/workbench.md#live-embed-tickets).
Work Tracker 930.

## Domain and naming

| Term          | Identifier                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------- |
| live embed    | an Embed element (`type: 'video'`) with `embedProvider: 'live'`                              |
| host          | the item holding the element; `hostId` in the picker                                         |
| target        | the item shown; `liveItem` on the element                                                    |
| link          | `liveItem: { app: LiveEmbedApp; itemId: string }` (`@liveworkspace/element-model/live-item`) |
| snapshot      | `liveName` and `livePoster` on the element                                                   |
| embed ticket  | a workbench ticket on the embed pairing, minted by `POST embed-tickets`                      |
| embed pairing | a `wb_pairings` row with `token_id = EMBED_TOKEN_ID` (`'embed'`)                             |
| embed session | a view-level workbench session on the embed pairing                                          |
| slot          | one of the page's `LIVE_EMBEDS_MAX` places (`live-embed-slots.ts`)                           |

## Data and persistence

- `liveItem`, `liveName`, `livePoster` are stored fields of the Embed element in livediagram, livedocuments and
  livedesign (`element-fields.ts`), declared on each `VideoElement`, and in each api's generated OpenAPI schemas.
- Validation, in each host's `validate.ts` `boxedIssue` `case 'video'`: `firstFieldIssue(el, LIVE_EMBED_CHECKS)`.
  - `liveItem`: an object of exactly `app` (one of `LIVE_EMBED_APPS`) and `itemId` (`^[A-Za-z0-9_-]{1,64}$`).
  - `liveName`: a string of at most `LIVE_NAME_MAX` (200).
  - `livePoster`: `data:image/(webp|jpeg|png);base64,<base64>`, non-empty, at most `LIVE_POSTER_MAX_CHARS`.
- `EMBED_PROVIDERS` (model-core) gains `live`, labelled "Live Embed".
- Choosing writes `withLiveEmbedChoice(el, choice)`: `embedProvider: 'live'`, the new `liveItem` and `liveName`, the
  new `livePoster` or none, and no `link`. History-committed through each host's `useElementLinks.applyLiveEmbed`.
- The workbench store gains no table. `embedPairing({ personId, app, origin, now })` inserts the embed pairing
  (`ON CONFLICT (app, token_id, origin) DO NOTHING`, scope `item`, name `EMBED_PAIRING_NAME`) and returns it.
  `sweepLapsed` deletes embed pairings with no ticket and no session left, so a store holding only lapsed embed rows
  drops itself.

## Interfaces and contracts

`POST /api/account/workbench/embed-tickets` (each app's `/api/workbench/embed-tickets`, forwarded whole):

| Case                                                                     | Answer                                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| no bearer, or a bearer that is no person                                 | `401 sign_in_required`                                           |
| an API token (`lwt_`, `lvd_`) or a workbench session (`lvw_`)            | `403 token_required`                                             |
| over the person's limit                                                  | `429 rate_limited`                                               |
| body not a JSON object                                                   | `400 bad_request`                                                |
| `target` not one of the four apps                                        | `400 invalid_value`                                              |
| `itemId` not 1 to 64 characters                                          | `400 invalid_value`                                              |
| `origin` not an app's in this environment (loopback http in development) | `400 invalid_origin`                                             |
| the reader's own grant: none / trashed / no answer                       | `404 not_found` / `410 <noun>_trashed` / `503 index_unavailable` |
| minted                                                                   | `201 { ticket, path, expiresAt }`                                |

- `path` is `/embed/workbench?d=<itemId>`; the client takes only a path starting `/embed/workbench?`.
- The host frames `liveEmbedFramePath(path)`: the path with `live=1` (`LIVE_EMBED_FRAME_PARAM`) added
  (`packages/workbench/src/lib/editor-surface.ts`). Each target app's workbench page reads it with
  `workbenchSurfaceOf(search)`: `'live-embed'` with the flag, else `'workbench'`. `surfaceFlags('live-embed')` is
  `embedMode` and `workbenchMode` both on, `appChrome` off: the share embed's look (EmbedChrome, no header, footer,
  tab bar, panels, tours, Quick Style or Map, Hand tool, read-only open) over the workbench's session and load. The
  editor's `Session·Opened` is not counted for it (the host counts `Canvas·Used·LiveEmbed`).
- `EmbedChrome` draws its Open in <App> badge only with a share code, so a live embed's frame (none) shows the tab
  switcher alone; livediagram's canvas lands on Fit to Screen in any embed (`embedMode`), never the phone focus.
- Redeem (`POST sessions` at the target app) uses `sessionTokenFacts`: for `EMBED_TOKEN_ID`, read-only and no expiry
  of its own, so the role is `view` and the session lasts `LIVE_EMBED_SESSION_TTL_MS`.
- The app's session check (`POST internal/workbench/session`) uses `sessionTokenFacts` likewise: `level: 'view'`.
- `GET pairings` leaves out embed pairings before the dead-token clean-up.
- Client (`packages/workbench/src/components/live-embed/`):
  - `requestLiveEmbedTicket(item, origin)`: `{ ok: true, ticket, path, expiresAt }`, or `{ ok: false, reason }` with
    `no-access` (no bearer, 401, 403, 404), `gone` (410), `failed` (anything else, a network error, a bad body).
  - Frame messages, from `frame.contentWindow` at `liveEmbedOrigin(app, host)` only, typed `<app>:<name>`:
    `hello` answered with `hello-ack { name: hostName }` and `theme { colourScheme }`; `renew` with
    `ticket { ticket }` or the refusal's state; `ended { reason }` taken as `trashed` gone, `revoked`/`refused` no
    access, anything else failed. Every send targets that origin.
  - `parseLiveEmbedShareLink(text)`: `new URL` of the trimmed text (at most 2,048 characters), the app from
    `appOfAnyOrigin`, the path equal to the app's `sharePath` path, the code from its query key, `^[A-Za-z0-9_-]{1,128}$`.

## Behaviour and state

The face (`LiveEmbedView`), from `liveItem`, the slot and the frame hook:

| State     | When                                                            | Shows                                                                                                                 |
| --------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| empty     | no `liveItem`, no poster                                        | "Double-click to choose a file" (or "No file chosen yet")                                                             |
| frozen    | no `liveItem`, a poster (a Community copy)                      | the poster alone                                                                                                      |
| idle      | a link, no slot (off screen, over the cap, nested)              | snapshot, name chip, Open                                                                                             |
| loading   | a slot, ticket asked                                            | snapshot, chip with a pulse                                                                                           |
| live      | a ticket: the frame mounted, `ready` after hello                | frame fading in over the snapshot, Live chip, Use the file, Open                                                      |
| no-access | refusal 401/403/404, `ended` revoked/refused, a renewal refused | obscured snapshot (`data-snapshot="obscured"`, `blur-xl`), lock, "Ask its owner to share it with you.", Open in <App> |
| gone      | 410, `ended` trashed                                            | "This file is no longer there."                                                                                       |
| failed    | anything else                                                   | "<name> could not be shown just now.", Try Again                                                                      |

- no-access, gone and failed give the slot back (`settledWithoutFrame`) and stand until the link changes or Try Again.
- Leaving the slot drops a live frame; the next slot asks a new ticket.
- Use the file resets whenever the frame is not live.
- Nested: `window.parent !== window` at mount keeps the slot unwanted for the page's life.

The slot (`useLiveEmbedSlot`): an IntersectionObserver at thresholds `[0, LIVE_EMBED_VISIBLE_RATIO]`; on-screen after
`LIVE_EMBED_SETTLE_MS` of visibility, off-screen after `LIVE_EMBED_UNLOAD_MS` of none; while on screen and wanted it
asks `liveEmbedSlots.request` and releases on change or unmount.

The picker (`LiveEmbedPicker`): Paste a Share Link (Add), Find a file, Connected (the first
`LIVE_PICKER_CONNECTED_MAX` of `connectedTargets(tabs)`, each `getItem`, failures left out), Recent
(`useRecentFiles`, the host and the connected left out). One busy row at a time; the host or a non-target app's file
is blocked with its reason. Choosing captures the poster and calls `onChoose` then `onClose`.

## Errors and edge cases

- A share link with a password: "This link has a password. Open it once in its app, then choose it from Recent."
- A pasted link to the host: "This is the file you are in."
- A preview that is missing, empty, undrawable or over the cap after four encodings: no poster; the face draws the
  app's logo card, exports draw the embed's plain card.
- A renewal after the reader lost access: the frame goes and the face shows no-access.
- Two files embedding each other: the inner one is nested and never frames.
- An answer arriving after unmount or a link change: dropped.

## Security and trust

- Mint: only the person's own access or guest token; the reader's own index grant; level always `view`.
- Origin binding: the ticket's pairing origin is the host page's origin; the target page sends only to it and accepts
  only its parent there; the host hears only its own frame at the target origin.
- No pass code in content: the element holds `{ app, itemId }`; a pasted code is held in the field only until resolve
  and cleared; validation refuses any other key on `liveItem`.
- Posters are raster data URLs only (no SVG): no script can ride in.
- Community: `redactElementsForCommunity` drops `liveItem`.
- Frame sandbox: `allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox`, no top
  navigation; `referrerpolicy="no-referrer"`.
- Rate limit: `WORKBENCH_LIMITER` key `workbench-embed:<personId>`.

## Performance and limits

- At most `LIVE_EMBEDS_MAX` (3) frames per page; none off screen; none nested.
- Mint: two store calls (`embedPairing`, `mintTicket`) and one index call; redeem and check as any workbench ticket.
- Poster: one preview fetch and one canvas draw per choice, at most 480 px on the longer side, at most 60,000
  characters stored per element.
- The picker is loaded on demand (`next/dynamic`); the face is in the canvas bundle.

## Observability

- `[workbench] embed-refused { reason, kind }` for every refusal; `[workbench] embed-ticket-minted { app, itemId,
originHost, kind }`.
- Telemetry: `Element·Added·LiveEmbed`, `Canvas·Used·LiveEmbed`.

## Testing

| Rule                                                                              | Test                                                             |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| own access, view level, origin, guests, refusals, limit, pairing hidden and swept | accounts `workbench.test.ts` "live embed tickets"                |
| field checks                                                                      | element-model `live-item.test.ts`, each host's validate tests    |
| Community drops the link                                                          | community `redact.test.ts`                                       |
| ticket client                                                                     | `live-embed-ticket.test.ts`                                      |
| slots and on-screen loading                                                       | `live-embed-slots.test.ts`, `useLiveEmbedSlot.test.tsx`          |
| frame messages, renewal, ended                                                    | `useLiveEmbedFrame.test.tsx`                                     |
| the frame flag and the item-only look                                             | `editor-surface.test.ts`, each target's `WorkbenchPage.test.tsx` |
| every face state, inert frame, nesting                                            | `LiveEmbedView.test.tsx`                                         |
| choosing, pasting, code dropped                                                   | `choose-live-embed.test.ts`, `LiveEmbedPicker.test.tsx`          |
| poster sizing and encoding                                                        | `live-poster.test.ts`                                            |
| addresses and share links                                                         | `live-embed-target.test.ts`                                      |
| exports draw the poster                                                           | each host's `svg-render` export test                             |

## Constants and configuration

| Constant                    | Value      | Where                      | Safe range        |
| --------------------------- | ---------- | -------------------------- | ----------------- |
| `LIVE_EMBEDS_MAX`           | 3          | live-embed-slots.ts        | 1 to 6            |
| `LIVE_EMBED_VISIBLE_RATIO`  | 0.1        | useLiveEmbedSlot.ts        | 0.01 to 0.5       |
| `LIVE_EMBED_SETTLE_MS`      | 400        | useLiveEmbedSlot.ts        | 100 to 1,000      |
| `LIVE_EMBED_UNLOAD_MS`      | 2,000      | useLiveEmbedSlot.ts        | 500 to 10,000     |
| `LIVE_EMBED_SESSION_TTL_MS` | 30 minutes | accounts route-kit.ts      | 5 to 60 minutes   |
| `LIVE_NAME_MAX`             | 200        | element-model live-item.ts | as the index's    |
| `LIVE_POSTER_MAX_EDGE`      | 480        | element-model live-item.ts | 240 to 960        |
| `LIVE_POSTER_MAX_CHARS`     | 60,000     | element-model live-item.ts | 20,000 to 120,000 |
| `LIVE_PICKER_CONNECTED_MAX` | 8          | LiveEmbedPicker.tsx        | 1 to 50           |
| `EMBED_TOKEN_ID`            | `embed`    | accounts store-types.ts    | fixed             |

## Presentation and UX

- Tile: Media, embed group, "Live Embed", after Website, the window-with-a-live-dot art.
- Face: the snapshot fills the element (`object-cover`); a glass name chip bottom left (app logo, name, Live dot);
  controls in a row above the element's top left on hover or focus (Use the file, Open), counter-scaled by
  `useCanvasZoom` to 28 px on screen; the host's Embed wrapper drops its `overflow-hidden` for a live embed so the row
  shows, the face clipping itself to the radius; state cards centred
  on frosted glass.
- Picker: the shared Dialog, "Choose a File", subtitle on everyone's own access; Connect list rows and ink.

## Accessibility

- Every control is a button or link with an accessible name matching its tooltip; Use the file is `aria-pressed`.
- State cards are `role="status"`; the loading pulse is labelled "Opening <name>".
- The frame is titled with the file's name; motion respects reduced motion.
- The paste field reports its error through `aria-invalid` and `aria-describedby`.

## Web Experience

- No frame and no ticket before the element is on screen: the host's LCP and INP are unchanged by an embed below the
  fold. The frame fades in over a poster of the same box, so it shifts nothing (CLS 0).
