# Avatar speech blueprint

Derived from [Avatar mode](../avatar-mode.md) "The Avatar Panel" (the button and popover) and "Speech bubbles",
and from [Avatar tour](../avatar-tour.md).

## Files

| File                                                   | Role                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `packages/api-schema/src/avatar-say.ts`                | `AvatarSayOp`, the limits, `parseAvatarSay`, `countWords`, `clampSayText`                         |
| `packages/api-schema/src/room-messages.ts`             | `avatar-say` in `PRESENCE_OP_KINDS`                                                               |
| `apps/api/src/document-room.ts`                        | Drops a Viewer's `avatar-say`, and one `parseAvatarSay` refuses                                   |
| `apps/live/lib/avatar-speech.ts`                       | Pure: `flightMs`, `bubbleMotion`, `admitBubble`, `headPoint`, `SeenIds`                           |
| `apps/live/lib/avatar-speech-store.ts`                 | The bubbles on screen: `addOwnBubble`, `receivePeerSay`, `useSpeechBubbles`, `resetSpeechBubbles` |
| `apps/live/hooks/canvas/useAvatarSpeech.ts`            | Composer state, cooldown, the floating bubbles, send and receive                                  |
| `apps/live/components/canvas/AvatarSpeechLayer.tsx`    | The composer and the bubbles, in canvas space at reading size; the live region                    |
| `apps/live/components/canvas/AvatarSpeechBubble.tsx`   | One bubble's look (tail, name, text), shared by the composer and a floating bubble                |
| `apps/live/components/canvas/AvatarClusterButton.tsx`  | The Avatar button in the bottom-right cluster                                                     |
| `apps/live/components/panels/AvatarPanel.tsx`          | The panel, now a popover, with Send a Message                                                     |
| `apps/live/components/panels/AvatarMessagePopover.tsx` | The panel's message popover                                                                       |
| `apps/live/hooks/collab/useEditorBroadcast.ts`         | `broadcastAvatarSay`                                                                              |
| `apps/live/app/document/[id]/useRoomConnection.ts`     | Routes a received `avatar-say` to the speech hook                                                 |
| `apps/live/components/tour/avatar-tour-steps.ts`       | The tour's steps                                                                                  |
| `apps/live/components/tour/AvatarTourHost.tsx`         | Orchestrates the tour, as `DrawTourHost`                                                          |
| `apps/live/components/tour/AvatarTourArt.tsx`          | The welcome card's illustration                                                                   |
| `apps/live/lib/avatar-tour.ts`                         | The relaunch event                                                                                |

## Domain and naming

| Term           | Identifier           | Meaning                                                                    |
| -------------- | -------------------- | -------------------------------------------------------------------------- |
| Message        | `text`               | What someone typed, after `clampSayText`                                   |
| Composer       | `composer`           | The open text box above your own head (`{ open: boolean; draft: string }`) |
| Bubble         | `SpeechBubble`       | `{ id, from, name, colour, text, x, y, tabId, bornAt, flightMs, own }`     |
| Speaking       | `canSpeak`           | The session `can` speak: an Editor or a Participant, in Avatar mode        |
| Say op         | `AvatarSayOp`        | `{ kind: 'avatar-say', tabId, id, text, x, y }`                            |
| Head point     | `headPoint`          | Where a bubble starts: above the speaker's head, in canvas coordinates     |
| Avatar popover | `DockPanel` `avatar` | The Avatar panel open over its button                                      |

Synonyms banned: "chat", "comment" (a different feature), "emote".

## Behaviour and state

### Composer

States: `closed` → `open` (Enter, or the tour never) → `closed` (Escape; send; blur while empty). Guards:

- Opens only when `active && canSpeak && !composer.open && !modalOpen && !isTypingTarget(e.target)`, on a plain
  `Enter` (no modifier, not a repeat). `preventDefault` so no other Enter handler sees it.
- While open, the composer's input is a typing target, so `useAvatarKeys` and every editor shortcut ignore keys.
- `Enter` in the composer sends; `Shift+Enter` also sends (no newlines); `Escape` closes and drops the draft
  (`stopPropagation`, so the mode itself is not left).
- Input is filtered by `clampSayText(draft, { refuse: true })`: a change that would pass either limit is refused
  (the previous draft kept); a paste is clamped to the limit instead. Newlines become spaces.
- Send while `now - lastSentAt < SPEECH_COOLDOWN_MS` is held: the send button disables and the hint reads
  "One moment…" until the cooldown passes (a timer re-renders once).
- Leaving the mode, a tab switch, or `canSpeak` turning false closes the composer and drops the draft.

### Sending

`send(text, source)`: trims; empty → close only. Otherwise builds `{ id: crypto.randomUUID(), text, x, y }`
from `headPoint(pos, scale)`, adds an own bubble (`admitBubble`), broadcasts `avatar-say`, sets `lastSentAt`,
closes the composer, tracks `Canvas · Used · AvatarMessage` or `AvatarMessagePanel` by source.

### Bubbles

- `bubbles: SpeechBubble[]`, newest last. `admitBubble(list, bubble, now)` appends and, when the sender already
  has `SPEECH_MAX_PER_PERSON` live, marks their oldest `leavingAt = now` (it then fades in
  `SPEECH_OVERFLOW_FADE_MS`).
- Removed when `now >= bornAt + flightMs` (or `leavingAt + SPEECH_OVERFLOW_FADE_MS`): one timer per bubble.
- `bubbleMotion(elapsed, flightMs, reduced)` → `{ rise, sway, opacity, scale, tail }` in screen px:
  - `rise = reduced ? 0 : (elapsed / 1000) * SPEECH_RISE_PX_PER_S`.
  - `sway = reduced ? 0 : SPEECH_SWAY_PX * sin(2π · elapsed / SPEECH_SWAY_PERIOD_MS)`.
  - `opacity`: 1 until `flightMs · (1 − SPEECH_FADE_FRACTION)`, then linear to 0 at `flightMs`.
  - `scale` (the pop): `reduced ? 1 :` ease-out-back from 0.6 to 1 over `SPEECH_POP_MS`.
  - `tail`: 1 → 0 over `SPEECH_TAIL_FADE_MS` (the bubble detaching).
- One `requestAnimationFrame` loop in `AvatarSpeechLayer`, started in a layout effect that writes the first frame
  before paint, runs while any bubble is shown and writes each bubble's `transform` and `opacity` straight to its
  node (kept by callback refs); it stops when the list empties. A bubble renders at `opacity: 0` until the loop
  places it. No React state per frame. Per frame and bubble the motion is worked out once (card and tail together);
  reduced motion is read once per flight; each bubble is its own component (`FlyingBubble`), so its ref callbacks
  stay the same across the canvas's re-renders and its nodes are never detached and reattached.
- Bubbles draw only for the active tab (`bubble.tabId === activeTabId`). A peer's bubble draws only while its
  speaker's character has been found on this tab (`peers`, empty under a hide-cursors vote): name and colour are
  captured the first time it is, in state adjusted during render, and kept if the speaker walks off. Until then the
  bubble is looked for again each render while it flies (their presence lands a frame after their words, or you open
  their tab a moment later); state changes only when a speaker is newly found, a bubble is new or one has gone.

### Receiving

`receivePeerSay(from, rawOp)` (the store, called by `useRoomConnection`): `parseAvatarSay(rawOp)` (null → drop);
`SeenIds.add(id)` false → drop; then a bubble with `bornAt = now`. The layer resolves its speaker and announces it
(above). A sender who leaves keeps their bubbles until they fade. Leaving the document empties the store
(`resetSpeechBubbles`).

### Panel and button

- `DockPanel` gains `'avatar'` (width 256, the panel's). `AvatarClusterButton` shows while `canvasTool ===
'avatar'`, before the Session strip, after Undo / Redo. `handleDockButtonClick('avatar', button, true)`.
- `useCanvasChromePanels` closes the `avatar` popover when the tool changes away from Avatar. The Avatar panel
  renders only as that popover (`asPopover`, `dismissOnOutside`), never in a corner; `'avatar'` leaves `PanelId`
  and a stored layout naming it is read like any unknown id.
- `AvatarPanel` gains `onSendMessage?: () => void` (absent for a Viewer: no button). Pressing it swaps the
  panel's body for `AvatarMessagePopover` in place (same popover, same anchor); Cancel swaps back; Send calls
  `send(text, 'panel')` and closes the dock popover.

### Tour

As the Draw tour's host (`DrawTourHost`), with: armed on entering Avatar mode; `canWork` without the
`isReadOnly` and lock gates; steps filtered by `{ canSpeak, mobile }`; `prepare` of `character` clicks the Avatar
button when the popover is closed and waits for `avatar-character`; `prepare` of `push` closes the popover;
`cleanup` on leaving closes the popover if the tour opened it. Ends as skipped when the mode is left or the tab
changes.

## Interfaces and contracts

```ts
// packages/api-schema/src/avatar-say.ts
export const AVATAR_SAY_MAX_WORDS = 50;
export const AVATAR_SAY_MAX_CHARS = 300;
export type AvatarSayOp = {
  kind: 'avatar-say';
  tabId: string;
  id: string;
  text: string;
  x: number;
  y: number;
};
export function countWords(text: string): number; // runs of non-space
export function clampSayText(text: string): string; // newlines → spaces, ≤ 50 words, ≤ 300 chars
export function parseAvatarSay(op: unknown): AvatarSayOp | null;
```

`parseAvatarSay` rejections (each returns null): not an object; `kind` wrong; `tabId` or `id` not a non-empty
string ≤ 64 chars; `text` not a string, empty after trim, or over `AVATAR_SAY_MAX_CHARS`; `x` or `y` not finite.
An over-50-word text that fits the characters is clamped, not rejected.

## Data and persistence

Nothing is persisted: no document field, no D1 row, no catch-up log entry, no localStorage. `avatarTourSeen` is
the one new stored value, a synced user preference.

## Errors and edge cases

| #   | Case                                    | Handling                                                  |
| --- | --------------------------------------- | --------------------------------------------------------- |
| E1  | Enter while typing in a field elsewhere | Ignored (`isTypingTarget`)                                |
| E1a | Enter on a focused button, row or tour  | Left to it (`isEnterActivatedTarget`)                     |
| E2  | Enter with a dialog open                | Ignored (`anyModalOpen`)                                  |
| E3  | Paste of 2,000 characters               | Clamped to the limits                                     |
| E4  | Send during the cooldown                | Held, "One moment…"                                       |
| E5  | Composer open, mode left / tab switched | Closed, draft dropped                                     |
| E6  | Peer op for another tab                 | Not drawn until its speaker is found on the open tab      |
| E7  | Same id twice                           | Second dropped (`SeenIds`, capped at 200)                 |
| E8  | Peer floods ops                         | Room op-rate cap, then three bubbles per person on screen |
| E9  | Viewer sends by a modified client       | Room drops it                                             |
| E10 | Markup in the text                      | Rendered as text                                          |
| E11 | Not in a shared room (no share link)    | Own bubble only; nothing sent                             |
| E12 | Hide-cursors vote                       | Nothing sent, nothing drawn                               |

## Security and trust

The text is user content from other people: rendered only as a React text node, never `dangerouslySetInnerHTML`,
never a link. Trust boundary: the room checks the role and the shape; the receiver re-parses and re-clamps.
Abuse: the room's per-socket frame cap, the client cooldown, and the per-person on-screen cap.

## Performance and limits

- Worst case on screen: 3 bubbles × peers; the room caps at its participant limit. Per frame the loop does one
  `bubbleMotion` and two style writes per bubble: O(bubbles), no layout reads, no React render.
- The loop is off whenever there are no bubbles. Removal timers are cleared on unmount.
- The op is at most ~400 bytes.

## Presentation and UX

- Bubble: white (slate-900 dark) card, `rounded-2xl`, 1.5px border and tail in the speaker's avatar colour (the brand
  when there is none), shadow, max width 240px, 13px text, padding 8px 12px, a 10px tail centred at the bottom. The
  speaker's name, yours included, sits under the text: 10px semibold in the same colour.
- Send button: the speaker's colour through `IDENTITY_FILL` + `identityVars` (never an inline background, so dark
  mode deepens it under the white glyph), slate while it cannot send.
- Composer: the same card with an auto-growing textarea (one line to start, up to 5), placeholder "Say
  something…", a 28px round send button with the paper-plane glyph, in your colour while it can send; a single line is padded to the
  button's height so the text sits level with it, and the counter `43 / 50` (amber at 50) under
  the text. Pops in with `animate-dialog-in`.
- Button: `ClusterPopoverButton` with label "Avatar", hover title "Avatar", description "Dress your character,
  react, and say something." (Viewer: "Dress your character and react.").
- Panel's button: full-width secondary `Button` "Send a Message", `kbd` "Enter" on a desktop.
- Message popover: title "Send a Message", textarea (4 rows), counter, Cancel and Send (primary, disabled while
  empty or cooling down).

## Accessibility

- Composer textarea `aria-label="Message"`; send button `aria-label="Send message"`.
- Floating bubbles are `aria-hidden`; one visually hidden `aria-live="polite"` region announces peers' messages
  as "Name says: text".
- Reduced motion: no pop, sway or rise (`bubbleMotion` with `reduced`).
- Contrast: text slate-800 on white, slate-100 on slate-900; the presence colour is only a border and the name,
  never the text's only cue.

## Web Experience

The layer loads (`next/dynamic`) the first time a bubble or the composer is needed, the panel with the tool panels
(`loadToolPanels`), the tour host once Avatar mode is first entered. The first-load script gains only the op wiring,
the store and the hook. No layout shift: everything is absolutely positioned over the
canvas. INP: Enter opens the composer in one render.

## Observability

`debugLog('[avatar-say] send' | 'receive' | 'drop', { reason })` at each decision (drop reasons: `parse`,
`seen`, `tab`, `hidden`, `cooldown`).

## Testing

| Rule                                 | Test                                                     |
| ------------------------------------ | -------------------------------------------------------- |
| Limits, word count, clamp            | `packages/api-schema/src/avatar-say.test.ts`             |
| Parser rejections                    | same                                                     |
| Presence classification              | `room-messages` tests: `avatar-say` is presence          |
| Room drops a Viewer's op             | `apps/api` document-room role test                       |
| Flight time, motion, cap, seen ids   | `apps/live/lib/avatar-speech.test.ts`                    |
| Enter opens; Escape cancels; send    | `apps/live/hooks/canvas/useAvatarSpeech.test.tsx`        |
| Viewer cannot open                   | same                                                     |
| Composer and bubbles render          | `apps/live/components/canvas/AvatarSpeechLayer.test.tsx` |
| Panel button and message popover     | `AvatarPanel.test.tsx`, `AvatarMessagePopover.test.tsx`  |
| Avatar button shows only in the mode | `AvatarClusterButton.test.tsx`                           |
| Tour steps filter, telemetry tokens  | `avatar-tour-steps.test.ts`, `AvatarTourHost.test.tsx`   |

## Constants and configuration

| Constant                    | Value | Provenance                                | Safe range |
| --------------------------- | ----- | ----------------------------------------- | ---------- |
| `AVATAR_SAY_MAX_WORDS`      | 50    | The user's limit                          | fixed      |
| `AVATAR_SAY_MAX_CHARS`      | 300   | 50 words × 6 characters (D107)            | 250–400    |
| `SPEECH_COUNTER_FROM_WORDS` | 40    | Spec                                      | 30–49      |
| `SPEECH_BASE_MS`            | 4000  | Spec                                      | fixed      |
| `SPEECH_PER_WORD_MS`        | 150   | Spec                                      | fixed      |
| `SPEECH_MAX_MS`             | 10000 | Spec                                      | fixed      |
| `SPEECH_RISE_PX_PER_S`      | 18    | Spec                                      | 10–30      |
| `SPEECH_SWAY_PX`            | 6     | D108                                      | 0–12       |
| `SPEECH_SWAY_PERIOD_MS`     | 2400  | D108                                      | 1500–4000  |
| `SPEECH_FADE_FRACTION`      | 1/3   | Spec                                      | fixed      |
| `SPEECH_POP_MS`             | 220   | D109                                      | 150–300    |
| `SPEECH_TAIL_FADE_MS`       | 400   | D109                                      | 200–600    |
| `SPEECH_COOLDOWN_MS`        | 1500  | Spec                                      | fixed      |
| `SPEECH_MAX_PER_PERSON`     | 3     | Spec                                      | fixed      |
| `SPEECH_OVERFLOW_FADE_MS`   | 300   | D110                                      | 200–500    |
| `SPEECH_SEEN_IDS_CAP`       | 200   | D110                                      | 100–1000   |
| `SPEECH_HEAD_GAP`           | 8     | D111: canvas px above the head at scale 1 | 4–16       |
