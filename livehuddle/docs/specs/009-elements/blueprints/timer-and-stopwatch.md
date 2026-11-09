# Timer and Stopwatch blueprint

Derived from [Timer and Stopwatch](../timer-and-stopwatch.md).

## Files

| File                                                          | Role                                                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/timer-pieces.ts`                       | `PieceTimer`, its bounds and `isPieceTimer`, the verbs, `pieceTimerTaken` / `pieceTimerShown`, the art          |
| `packages/document/src/element-deltas.ts`                     | The `piece-timer` delta: applied on every screen and in the store; kept through whole-element updates           |
| `packages/document/src/collab-ledger.ts`                      | The latest `piece-timer` state per piece, merged into saves and into the stored tab for a Participant           |
| `packages/document/src/comments.ts`                           | `graftLiveTabState` carries `pieceTimer` over an undo or redo, as it carries notes                              |
| `packages/document/src/participant-content.ts`                | A Participant's `el` update never changes `pieceTimer`                                                          |
| `packages/document/src/validate-shape.ts`                     | `pieceTimer` validation                                                                                         |
| `packages/document/src/svg-render-timers.ts`                  | The export: body, time and state word                                                                           |
| `packages/document/src/retired-timer.ts`                      | `dropRetiredTimer`: a stored tab's old `timer` field is dropped on read                                         |
| `packages/api-schema/src/room-messages.ts`                    | `piece-timer` joins `PARTICIPATION_DELTA_KINDS`                                                                 |
| `apps/api/src/document-room-rules.ts`                         | `answersAsSelf` admits a `piece-timer` delta (it names nobody)                                                  |
| `packages/avatar/src/office-geometry.ts`                      | `isWallPieceShape` holds both kinds                                                                             |
| `apps/editor/lib/timer-ticker.ts`                             | The one 250 ms ticker (`useTickerValue`)                                                                        |
| `apps/editor/lib/timer-chime.ts`                              | The Web Audio chime and its per-run scheduling (`useTimerChime`)                                                |
| `apps/editor/lib/office/timer-earshot.ts`                     | Which Timers this viewer hears: the store `useTimerEarshot` writes and `hearsTimer` reads                       |
| `apps/editor/components/canvas/collab/TimerView.tsx`          | The face: body, display, state word, controls                                                                   |
| `apps/editor/components/canvas/collab/TimerLengthPopover.tsx` | The Timer length popover                                                                                        |
| `apps/editor/lib/timer-piece-controls.ts`                     | `can.takePart` and the delta path, written once by the editor host (`useTimerPieceControls`), read by the faces |

## Domain and naming

| Term      | Identifier                       | Meaning                                                   |
| --------- | -------------------------------- | --------------------------------------------------------- |
| Timer     | shape kind `timer`               | Counts down from `durationMs`                             |
| Stopwatch | shape kind `stopwatch`           | Counts up                                                 |
| State     | `PieceTimer`, `pieceTimer`       | `{ running, startedAt, accumulatedMs, durationMs }`       |
| Taken     | `pieceTimerTaken(state, now)`    | `accumulatedMs + (running ? max(0, now - startedAt) : 0)` |
| Shown     | `pieceTimerShown(kind, s, now)`  | Timer: `max(0, durationMs - taken)`; Stopwatch: taken     |
| Ran out   | `pieceTimerRanOut(kind, s, now)` | A Timer whose taken ≥ `durationMs`                        |
| Phase     | `PieceTimerPhase`                | `'ready' \| 'running' \| 'paused' \| 'done'`              |

## Behaviour and state

- **Press**: `TimerView` computes the next state with the verb and `Date.now()`, then calls
  `pressTimerPiece(id, state)` (timer-piece-controls), which sends `{ kind: 'piece-timer', state }` through the
  editor's `applyElementDelta` (`useElementDeltas`) when `can.takePart`: applied locally through
  `tickTabs` (no history), sent as an `el-delta` op.
- **Apply** (`applyElementDelta`): only on a shape whose kind is `timer` or `stopwatch` and a state that passes
  `isPieceTimer` for that kind; same object back when the state equals the stored one. `mergeIncomingElement` keeps the
  receiver's `pieceTimer`; `withoutDeltaFields` leaves it out.
- **Ledger**: `recordElement` stores `timer: { state, seq }` (latest wins); `mergeLedgerIntoTab` re-applies it when
  `seq > since`; `mergeLedgerAnswersIntoTab` carries `timer` beside `reacts` and `notes`.
- **Phase**: `ready` when not running and taken is 0 (or a Timer at full length); `running` while running and not ran
  out; `done` when a Timer ran out (running or not); otherwise `paused`.
- **Chime**: `useTimerChime(id, kind, state)` arms one `setTimeout(left)` while a Timer runs and has not run out, keyed by
  `startedAt|accumulatedMs|durationMs`; on fire, if `hearsTimer(id)`, plays `playChime()`. Cleared on change or unmount.
- **Earshot**: `useTimerEarshot({ elements, zones, inMode, self })` (called beside `useMeetingPieces` in
  `useCanvasCall`) works out each Timer's room with `meetingPieceRoom` when the board changes, and your zone with
  `zoneAt`; it writes `{ inMode, selfZone, rooms }` to the store. `hearsTimer(id)`: `!inMode || room == null || room
=== selfZone`; with no store written (no calls on this build) everyone hears.
- **Old tab timer**: `dropRetiredTimer` runs in `migrateStoredTab` and on a peer's `tab` op and `tab-meta` patch,
  beside `dropRetiredVote`.

## Interfaces and contracts

- `ElementDelta` gains `{ kind: 'piece-timer'; state: PieceTimer }`.
- `isPieceTimer(v, kind)`: booleans and integers as the spec's bounds; `durationMs === 0` for a Stopwatch.

## Data and persistence

- `pieceTimer` is a content field (`element-fields.ts`), validated in `validate-shape.ts`, carried by duplicate and
  copy (a copied Timer copies its state; a running copy keeps running, as its source does).
- A stored tab's `timer` (the retired Session strip timer) is dropped on read; no data migration.

## Errors and edge cases

- A delta for a deleted element: `applyElementDelta` is never reached (no element), nothing changes.
- Clock jumps backwards: taken never goes below `accumulatedMs` (`max(0, now - startedAt)`).
- A Timer at zero that is paused: phase `done`, Start reads Restart.

## Security and trust

- A `piece-timer` delta is a participation delta: relayed from an Editor or a Participant, dropped from a Viewer
  (`gateClientOp`). It names nobody, so `answersAsSelf` admits it for any Participant. Its state is checked by
  `isPieceTimer` on every screen and in the store, so a hand-crafted frame cannot bloat or break a piece.
- The room's per-socket rate cap applies, as to every mutation.

## Performance and limits

- One ticker for every face: one `setInterval(250)` while ≥ 1 running face subscribes; each tick reads `Date.now()`
  once and calls each subscriber's snapshot (a subtraction and a format); React re-renders a face only when its text
  changes. Hidden tab: no interval.
- One chime timeout per running Timer.

## Presentation and UX

- Display digits: the largest of 30 / 26 px design units that fits; state word 9 units; buttons `PILL` pills under the
  piece (`top-[calc(100%+3px)]`), gap 4 px.
- Done: display `#fecaca` with red digits `#b91c1c`, the `lh-timer-flash` animation (opacity pulse, 3 × 1 s), none
  under reduced motion.

## Accessibility

- The face is `role="img"` with `aria-label` "{Piece}, {time} {left|taken}, {State}"; each button has an accessible
  name; the popover is a dialog labelled "Timer length", Escape closes it and focus returns to Set.

## Observability

- Telemetry per the spec's table. No logs: a refused delta is a no-op on every screen alike.

## Testing

| Rule                                                                                      | Test                                                      |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Verbs, taken / shown / phase, bounds                                                      | `packages/document/src/timer-pieces.test.ts`              |
| Delta applies, refuses malformed, merges keep local; ledger keeps the latest state        | `packages/document/src/timer-piece-deltas.test.ts`        |
| Old tab `timer` dropped                                                                   | `packages/document/src/retired-timer.test.ts`             |
| Export draws the time                                                                     | `packages/document/src/svg-render-timers.test.ts`         |
| Participant relayed, Viewer dropped                                                       | `apps/api/src/share-roles.test.ts`                        |
| Controls per role, face readout, control presses                                          | `apps/editor/components/canvas/collab/TimerView.test.tsx` |
| One interval for any number of faces, stops, hidden; 20 running faces inside a CPU budget | `apps/editor/lib/timer-ticker.test.tsx`                   |
| Chime once at zero, earshot, never late; controls bridge                                  | `apps/editor/lib/timer-chime.test.tsx`                    |
| Earshot rule                                                                              | `apps/editor/lib/office/timer-earshot.test.ts`            |

## Constants and configuration

| Constant                | Value         | Why                                             |
| ----------------------- | ------------- | ----------------------------------------------- |
| `DEFAULT_TIMER_MS`      | 300 000       | 5 minutes, the spec's new Timer                 |
| `TIMER_PRESET_MINUTES`  | 5, 10, 15, 25 | The spec's presets                              |
| `TIMER_MINUTES_MIN/MAX` | 1 / 120       | The old Session strip timer's range             |
| `STOPWATCH_MAX_MS`      | 7 days        | Bounds a forgotten Stopwatch                    |
| `TICK_MS`               | 250           | Four reads a second keeps a 1 s readout on time |

## Defaults ledger

- Default sizes 128 × 88 and 104 × 112: chosen to sit beside the World Clock (168 × 72) at a readable digit size.
