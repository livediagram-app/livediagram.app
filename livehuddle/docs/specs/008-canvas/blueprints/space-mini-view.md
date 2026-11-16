# Space mini view blueprint

Derived from [Avatar mode](../avatar-mode.md) "The mini view" (Work Tracker 908), with the knock's half from
[Knock](../../012-collaboration/knock.md) "Being knocked" and the hands' from [Meeting rooms and the
stage](../../012-collaboration/meeting-rooms-and-stage.md) "Raise hand".

## Files

| File                                                          | Role                                                                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `apps/editor/lib/mini-view/mini-view-window.ts`               | The one window: `miniViewSupported`, `openMiniView`, `closeMiniView`, `toggleMiniView`, `useMiniViewWindow`, `focusSpace` |
| `apps/editor/lib/mini-view/mini-view-styles.ts`               | `mirrorDocumentLook`: the opener's stylesheets, `<html>` classes and theme copied into the window                         |
| `apps/editor/lib/mini-view/mini-view-knock.ts`                | The knock on show: `showMiniKnock`, `clearMiniKnock`, `useMiniKnock`, `resetMiniKnock`                                    |
| `apps/editor/lib/mini-view/mini-view-people.ts`               | Pure: `miniViewPeople` (the rows and groups), `miniPeopleKey` (their by-value key)                                        |
| `apps/editor/components/calls/mini-view/MiniViewHost.tsx`     | Mounted by the characters layer: renders the mini view into the window (its own root) while open; closes it on unmount    |
| `apps/editor/components/calls/mini-view/MiniView.tsx`         | The window's content: header, knock, groups                                                                               |
| `apps/editor/components/calls/mini-view/MiniViewRow.tsx`      | One row: `MiniBust`, name, status, hand, bars                                                                             |
| `apps/editor/components/calls/mini-view/MiniViewControls.tsx` | Your microphone and camera at the window's foot, the Call dock's own buttons (Work Tracker 992)                           |
| `apps/editor/components/calls/MicAndCameraSegments.tsx`       | The dock's microphone (live and preview) and Camera buttons, shared by the dock and the mini view                         |
| `apps/editor/test/fake-pip-window.ts`                         | The tests' stand-in window and API (`fakePipWindow`, `installPip`, `removePip`)                                           |
| `apps/editor/components/calls/PopOutSegment.tsx`              | The Call dock's Pop Out                                                                                                   |
| `apps/editor/components/calls/CallDock.tsx`                   | Draws Pop Out last, handing it whether a share is on                                                                      |
| `apps/editor/components/calls/CallStripGroup.tsx`             | `callGroupShows(self, actions)`: the group's own early returns as one predicate                                           |
| `apps/editor/lib/office/useMeetingPieces.ts`                  | Shows a knock that reaches you in the mini view too, and clears it on an answer from either place                         |
| `packages/icons` (monorepo)                                   | `lucidePictureInPicture2`, vendored                                                                                       |

## Domain and naming

| Term          | Identifier      | Meaning                                                                 |
| ------------- | --------------- | ----------------------------------------------------------------------- |
| Mini view     | `miniView`      | The Document Picture-in-Picture window and what it shows; one a tab     |
| Pop Out       | `PopOutSegment` | The Call dock's button that opens or closes it                          |
| Mini person   | `MiniPerson`    | `{ id, name, color, config, status, self }`: a row's facts, no position |
| Group         | `MiniGroup`     | `{ id: 'near' \| 'space', people: MiniPerson[] }`                       |
| Mini knock    | `MiniKnock`     | `{ from, name, answer(value) }`: the knock on show                      |
| Back to Space | `focusSpace`    | `window.focus()` on the opener, from a press in the window              |

Synonyms banned: "PiP" in copy (the code may say `pip` for the window object), "popup", "floating panel".

## Behaviour and state

### The window (`mini-view-window.ts`)

A module store: `win: Window | null`, with `createListeners`.

- `miniViewSupported(scope = globalThis)`: `typeof scope.documentPictureInPicture?.requestWindow === 'function'`.
  `PopOutSegment` reads it through `useSyncExternalStore` with a server snapshot of `false`, so the static export
  renders no button and hydration agrees.
- `openMiniView()`: returns at once when `win` is set or a request is in flight (`opening`). Otherwise
  `await documentPictureInPicture.requestWindow({ width: MINI_VIEW_WIDTH, height: MINI_VIEW_HEIGHT })`, then
  `mirrorDocumentLook(document, pip.document)`, `pip.document.title = MINI_VIEW_TITLE`, one `pagehide` listener that
  calls `forget()`, `win = pip`, notify, then `track('Canvas', 'Used', 'SpaceMiniView')`. A refusal (no user
  activation, the browser's own refusal) leaves `win` null and logs `[mini-view] open refused` with the error's name.
- `closeMiniView()`: `win?.close()` and `forget()`. `forget()` removes the `pagehide` listener, sets `win = null` and
  notifies; a second call is a no-op.
- `toggleMiniView()`: close when open, else open. Pop Out calls it from its click, so the request carries the click's
  user activation.
- `focusSpace()`: `window.focus()`. Called from a press inside the window, which the browsers allow to focus the
  opener.

### The host (`MiniViewHost`)

`memo`, mounted once in `CanvasCharactersLayer` beside the call's layers, given the coarse rows, your name, colour,
costume and status, and whether you are on Do Not Disturb. It subscribes to `useMiniViewWindow()`; with no window it
returns null before any work. With one, it reads who you hear on its own (`callSelf().heard` through
`useSyncExternalStore`, so a level change does not wake it), works out the people through `keyedMiniPeople` (one per
host, kept in `useState`: `miniViewPeople` behind `miniPeopleKey`) and renders the memoised `<MiniView>` into
`win.document.body` through a root of its own (below). Its unmount (leaving the document) calls
`closeMiniView()`. Leaving Avatar mode does not unmount it.

The window gets a React root of its own (`createRoot(win.document.body)`, made when the window opens and unmounted
after the commit that drops it), never a portal: a portal's events travel the React tree, so a press in the window
would reach the canvas's capture handlers above the characters layer and walk your character to where the press
landed in the window. The host renders `<MiniView>` into that root whenever the count, the groups, the tab or Do Not
Disturb change.

### The people (`mini-view-people.ts`)

`miniViewPeople({ self, rows, heard })` → `{ count, groups }`:

- `self` (always present) first in the first group, `self: true`, named **You**.
- Every row (a peer with a character on the active tab, as the canvas draws them) becomes a `MiniPerson`, its
  `config` from `peerAvatarConfig(row.avatar.config)` and its `status` from `parseAvatarStatus(row.avatar.status)`.
- `heard` non-empty: `near` holds you and the heard rows, `space` the rest; empty: one `space` group with everyone.
  An empty group is left out.
- Each group's peers sort by `name.localeCompare(other, undefined, { sensitivity: 'base' })`, then by id.
- `miniPeopleKey` joins, per person, `id|name|color|gender|hair|hairColour|status`, and the heard ids:
  `keyedMiniPeople`'s key, so a coarse tick that only moved someone gives the same key and the same result object.

### Rows (`MiniView`, `MiniViewRow`)

`MiniView` (memoised) subscribes to `useCallSelf` (your level, hand, `canSpeak`), `useCallPeers` (levels), `useCallHands` (hands) and `useMiniKnock`. `useStaleClock` (exported from `TalkingBars`)
moves a level to 0 when stale, as on the canvas. Per row:

- **Speaking**: a peer's `levelNow(peer) > 0`, unless `doNotDisturb`; your own `self.level > 0` while `micOn(self)`
  and `canSpeak`.
- **Hand**: a peer's `hands.get(id)` on the active tab: amber hand, or the brand microphone when `letSpeak` is set;
  yours from `self.hand` (`raised` or `speaking`).
- Bars: `barHeight(level)` from `TalkingBars`, three bars, the middle one full, the outer ones at 60%.

### Your controls (`MiniViewControls`, Work Tracker 992)

The last child of `MiniView`'s column, `shrink-0`. It reads `useCallSelf` and `useCallActions` and draws nothing
without actions or without `canSpeak`. Inside `CallNames` (true: named) and `CallHoverCards` (false), it draws
`miniMicSegment(self, actions)` and, while `selfCamera(self) === 'on'`, `CameraSegment`:

- `miniMicSegment`: live (`available` and `phase === 'live'`) → `LiveMicSegment`, the dock's microphone; no call
  (`!available`, the kill switch's pause, or `phase === 'error'`) → `PreviewMicSegment` (null without
  `canPreviewMic`); `off` or `joining` in a call → null.
- With neither button the bar draws nothing (`empty:hidden`), so no empty footer.
- `CallHoverCards` (in `CallSegment.tsx`, default true): false passes `disabled` to each `HoverCard`, so no card
  is drawn in the opener's document; the hidden description stays for `aria-describedby`.

### Knocks (`mini-view-knock.ts`)

A module store holding at most one `MiniKnock`. `showMiniKnock(k)` replaces any knock on show and (re)starts a timer
of `TOAST_ANSWER_TIMEOUT_MS` that clears it. `clearMiniKnock(from)` clears it only when it is that person's (a later
knock from someone else stays). In `useMeetingPieces`, the knock handler calls `showMiniKnock` with the same
`answer` the toast's buttons call; `answer` now also calls `clearMiniKnock(from)`, and the mini view's buttons call
`answer`, which dismisses the toast. So one answer, from either place, clears both.

## Interfaces and contracts

- `documentPictureInPicture.requestWindow(options)` is typed locally (`DocumentPictureInPictureLike`), since the DOM
  lib in use does not declare it.
- `MiniViewHost` props: `rows` (the coarse `RemoteAvatarRow[]`), `self` (`MiniSelf`: name, colour, costume, status),
  `tabId` and `doNotDisturb`.
- `PopOutSegment` takes `{ sharing?: boolean }` and draws its own divider first when `sharing` or
  `callGroupShows(self, actions)`.

## Data and persistence

Nothing is stored. The window, the knock on show and every row are memory only; a reload closes the window (the
browser closes it with its opener).

## Errors and edge cases

- **No API**: no Pop Out; the store is never touched.
- **Refused request**: logged, nothing open, Pop Out stays unpressed.
- **Double press while opening**: the in-flight flag drops the second request.
- **The person closes the window**: `pagehide` forgets it; Pop Out unpresses.
- **The opener goes**: the host's unmount closes it; the browser closes it anyway.
- **Nobody else on the tab**: your row alone, under In the Space.
- **Stale level** (a lost stop): the stale clock clears the bars after `VOICE_STALE_MS`, as on the canvas.
- **A knock while closed**: the store holds it; opening within its ten seconds shows it.
- **Stylesheets that cannot be read** (cross-origin): linked by `href` instead of copied.

## Security and trust

The window is the opener's own origin and runs no code of its own: React renders into it from the opener. It shows
only what the canvas already shows this viewer (names, costumes, statuses, levels, hands, knocks addressed to you).
Answers go through the same `answer` as the toast, so the room's checks are unchanged.

## Performance and limits

- Closed: the host's memo compare per coarse tick, then `null`. Pop Out: one `useSyncExternalStore` read.
- Open: `miniPeopleKey` per coarse change (at most 10 a second while someone walks), linear in people (at most
  `ROOM_MAX_CONNECTIONS`); the sort and the rows only when the key changes. Levels re-render the list at most at the
  peers store's `PEER_NOTIFY_MS` (100 ms) while someone talks. No timers but the stale clock and the knock's one.
  Held by a CPU-time test: 1,000 keys over 200 people.
- No video, no canvas, no animation frame in the window; the hidden-tab rule (`pickSeen`'s `visible`) is untouched.

## Presentation and UX

- Window: `MINI_VIEW_WIDTH` 320, `MINI_VIEW_HEIGHT` 400. Body: the app's surface (`bg-white` / `dark:bg-slate-900`),
  14 px text, `overflow-y: auto` on the list.
- Header: **In the Space** and the count (`tabular-nums`, slate), **Back to Space** as a small brand-tinted button
  with the arrow-up-right glyph. Pressing the header or a row also calls `focusSpace`.
- Knock: an amber card under the header, "Sam is knocking", **Let In** (solid amber) and **Not Now** (quiet).
- Group headings: 11 px uppercase slate, **Near You** and **In the Space**.
- Row: 40 px high; a 28 px bust (an SVG of `HeadFront` over a shoulders rect in the person's colour, `crispEdges`)
  ringed 2 px in their colour while speaking; the name (truncated); the status dot and label under it, small; at the
  end the hand badge (20 px amber round, the hand glyph) and the bars (three 3 px bars, up to 12 px).
- Controls bar: `border-t` like the header's, `py-2`, the buttons centred with the dock's `gap-0.5`, 36 px and named
  (Mic, Muted, Blocked, Mic Off, Camera), on the window's surface.
- Copy: Pop Out's cards as the spec gives them; **You**; "Nobody else is here yet." under your row when alone.

## Accessibility

- The list is `role="list"`; each row `role="listitem"` with an `aria-label` of name, status, "hand raised" or "let
  speak", and "speaking".
- The knock card is `aria-live="polite"`; its buttons are real buttons with focus rings.
- Back to Space is a button named "Back to Space". Contrast: the status and heading slate meets 4.5:1 on both
  surfaces (`text-slate-600` / `dark:text-slate-300`).
- Reduced motion: nothing animates but the bars' height, which steps with the level and transitions only without
  reduced motion.

## Web Experience

Nothing on page load: the mini view's code is in the characters layer's chunk, a few hundred lines, and renders
nothing until opened. No layout shift: Pop Out takes its place in the dock on first paint of the dock.

## Observability

- `Canvas · Used · SpaceMiniView` on a successful open.
- `console.warn('[mini-view] open refused', name)` on a refused request.

## Testing

| Rule                                                              | Test                                                  |
| ----------------------------------------------------------------- | ----------------------------------------------------- |
| Pop Out only where the API exists                                 | `PopOutSegment.test.tsx`                              |
| Pop Out for an Editor, a Participant and a Viewer; its divider    | `CallDock.test.tsx` "Pop Out"                         |
| Open, close, pagehide, refusal, double press, telemetry           | `mini-view-window.test.ts`                            |
| Styles and theme mirrored                                         | `mini-view-styles.test.ts`                            |
| Groups, order, You, key stable over a move                        | `mini-view-people.test.ts` (with the CPU budget)      |
| Rows: speaking, hand, DND, Viewer's own row, knock answer, focus  | `MiniView.test.tsx`                                   |
| Host draws while open, closes on unmount, keeps presses in window | `MiniViewHost.test.tsx`                               |
| A knock reaches the mini view; an answer clears it                | `mini-view-knock.test.ts`, `useMeetingPieces.test.ts` |
| Your controls: the dock's mic per phase, camera while on, roles   | `MiniViewControls.test.tsx`                           |

## Constants and configuration

| Constant           | Value                     | Why                                                      |
| ------------------ | ------------------------- | -------------------------------------------------------- |
| `MINI_VIEW_WIDTH`  | 320                       | Room for a 28 px bust, a long name and the hand and bars |
| `MINI_VIEW_HEIGHT` | 400                       | Seven rows and the header before it scrolls              |
| `MINI_VIEW_TITLE`  | `'Mini View'`             | The window's title                                       |
| Knock timeout      | `TOAST_ANSWER_TIMEOUT_MS` | The toast's own, so both go together                     |

## Defaults ledger

D132 to D135 in [DEFAULTS.md](DEFAULTS.md).
