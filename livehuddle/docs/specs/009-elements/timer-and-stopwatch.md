# Timer and Stopwatch

Status: **approved** (owner, 2026-11-05: "The Timer button should be removed, and instead have elements we can place in
rooms that are Timer or Stopwatches"). Two placed pieces for a Space's meeting rooms: a **Timer** that counts down from
a length you set, and a **Stopwatch** that counts up. They replace the Session strip's Timer button, which left
livehuddle ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#the-session-strips-timer)). Both are placed
pieces in the palette's **Meeting** category, after the World Clock, and their state is shared live with everyone on
the tab.

## Why

A tab-wide timer button belonged to a workshop: one facilitator, one timebox, the whole board. A Space holds several
rooms at once, each with its own stand-up or call, and each wants its own clock. A timer that is a thing on the wall
of a room can be one per room, is seen where the meeting happens, and needs no button in the corner of everyone's
screen.

## The pieces

| Piece     | Kind        | Default size | Face                                                                |
| --------- | ----------- | ------------ | ------------------------------------------------------------------- |
| Timer     | `timer`     | 128 × 88     | A wall timer: a rounded body with a display showing the time left   |
| Stopwatch | `stopwatch` | 104 × 112    | A round stopwatch with a crown and a display showing the time taken |

- **Placed pieces** ([Placed pieces preview themselves](../010-palette/palette-drag-ghost.md)): a tap places one at its
  size, a drag moves the drop; aspect locked, no resize handles, no typed label (their label is not drawn), they do
  not turn.
- **Walking** ([Avatar mode](../008-canvas/avatar-mode.md)): both are wall pieces, like the
  [World Clock](social-pieces.md#how-each-one-walks): walked past, never blocking, never a destination.
- **Light and dark**: the body is a fixed, real-object drawing (a warm graphite body and a pale display), the same on
  every paper, as a Room Sign's plaque is; the outline is the theme's stroke. The display's digits are dark on the pale
  display in both themes, so they read on any floor.
- **A new piece** is idle: a Timer set to **5 minutes**, a Stopwatch at **0:00**.

## The time

- **Readout**: `m:ss` under an hour, `h:mm:ss` from an hour on, in tabular digits, as large as the display allows.
  A Timer shows the time left, rounded **up** to the second (so it reads 5:00 for the whole first second and reaches
  0:00 exactly at zero); a Stopwatch shows the time taken, rounded **down**.
- **Under the digits** a small word says the state: **Ready** (idle at its full length or at zero taken), **Running**,
  **Paused**, and on a Timer that ran out **Time's Up**.
- **A Timer that runs out** stops at 0:00, its display turns red and **flashes** three times (a 1 s pulse, then a steady
  red); under reduced motion it turns red without flashing. It stays at 0:00 reading Time's Up until somebody resets
  or restarts it.

## The controls

Small pill buttons under the piece, pieces' controls in the [Notice Board](social-pieces.md#notice-board)'s sense: a
press on one is the control's alone, never a selection, a drag, a label edit, an erase or a walk, in every mode,
Avatar mode included, so a meeting run while walking works its clock from the face.

- **Start / Pause**: one button. **Start** runs it from where it stands (resuming a paused one); while running it
  reads **Pause**. On a Timer that ran out it reads **Restart** and runs it again from its full length.
- **Reset**: back to idle, a Timer at its full length, a Stopwatch at 0:00. Shown once it has run (anything but
  Ready).
- **Set** (Timer only): opens the **Timer length** popover above the piece: preset chips **5**, **10**, **15** and
  **25 min**, a minutes field with − and + (1 to 120 minutes), and **Set Timer**. Setting a length resets the Timer to
  it (idle, not running): a new length is a new round. Escape or a press outside closes it.
- **Who sees them**: anyone who may operate it (see Share roles). A Viewer sees the face and its time, with no
  buttons. In a placement preview the face shows its idle time and no buttons.
- **Keyboard**: each control is a real button, in the tab order after the piece; Enter and Space press it. Each has
  an accessible name ("Start Timer", "Pause Stopwatch", "Reset Timer", "Set Timer Length"), and the face is an image
  named by its piece and time ("Timer, 4:12 left, Running"). The time is not a live region: a screen reader reads it
  when asked, never every second.

## The state

Stored on the element as `ShapeElement.pieceTimer`, one shape for both pieces:

```
pieceTimer?: {
  running: boolean;       // counting now
  startedAt: number;      // epoch ms the current run started (0 while not running)
  accumulatedMs: number;  // time counted before the current run
  durationMs: number;     // a Timer's length; 0 on a Stopwatch
}
```

- **Every screen works out the time itself** from its own clock: taken = `accumulatedMs` plus, while running,
  `now - startedAt`; a Timer's left = `durationMs` minus taken, never below 0. Nothing travels per second. Clocks a
  few hundred ms apart show times a few hundred ms apart, which is acceptable for a meeting clock (a
  server-authoritative clock is out of scope).
- **Absent** means idle at the default: a Timer at 5 minutes, a Stopwatch at 0. A piece placed from the palette stores
  nothing until it is first pressed.
- **Bounds**: `durationMs` an integer from 60 000 (1 min) to 7 200 000 (120 min) on a Timer, 0 on a Stopwatch;
  `accumulatedMs` an integer from 0 to 7 days (a Stopwatch left running stops counting at 7 days); `startedAt` a
  finite number ≥ 0. Anything else fails validation and the field is dropped (the piece reads idle).
- **The verbs**, all pure (`office-timers.ts`), each taking the current state and `now`:
  - **start**: `{ running: true, startedAt: now, accumulatedMs, durationMs }`; a Timer that ran out starts again
    from 0 taken.
  - **pause**: `{ running: false, startedAt: 0, accumulatedMs: taken, durationMs }`, a Timer's taken capped at its
    length.
  - **reset**: `{ running: false, startedAt: 0, accumulatedMs: 0, durationMs }`.
  - **set length** (Timer): reset at the new length.

### How a change travels

A press sends **one element delta**, `{ kind: 'piece-timer', state }`, carrying the whole new state, through the same
path as a Notice Board pin ([Collab race hardening](../012-collaboration/collab-race-hardening.md)). Why a delta and
not the normal element update:

- **A Participant operates it.** A Participant may not send a whole-element update for a piece it did not add, and the
  participant content rule keeps the stored piece; a delta is the one channel the room relays from a Participant, and
  the room writes it into the stored tab itself, as it writes a Participant's notes.
- **It is not undoable.** Like a pin, starting a clock is the room's, not one person's edit: no undo entry, and one
  person's undo never stops everyone's timer. A delta never touches history.
- **A move never stops a clock.** A whole-element update (an Editor dragging the Timer while it runs) keeps every
  receiver's own `pieceTimer` (`mergeIncomingElement`), and a change to `pieceTimer` alone sends no element update
  (`elementChangeIsDeltaOnly`), so a stale copy can never undo a press.
- **Last press wins.** The delta replaces the state whole, applied on every screen in the room's order, so two
  people pressing at once land on the same state everywhere (the later press). It applies to a Timer or Stopwatch
  whether or not the piece is locked: locking fixes it in place, it does not freeze its clock. A malformed state, or
  a delta on any other kind, changes nothing.
- **Kept in the ledger.** The room's collaboration ledger keeps each piece's latest `piece-timer` state and seq, so an
  Editor's save snapshotted before a press merges it, and a Participant's press reaches the store.

## The chime

- **When a Timer reaches zero** it plays a gentle two-note chime (synthesised in the browser with Web Audio, about a
  second long, at a low volume; no audio file). Each screen schedules it itself, one timeout per running Timer set for
  its end, so it sounds on time even when the canvas is not repainting; pausing, resetting or a new length cancels it.
- **Who hears it**: a person standing in the Timer's room. A Timer belongs to a room exactly as a
  [Screen](screen-and-room-sign.md#a-pieces-room) does (`meetingPieceRoom`). While you are walking, you hear it when
  your character stands in that room, or when the Timer belongs to no room. When you are not walking you have no
  place in the Space, so you hear every Timer on the tab you are looking at.
- **It plays once per run**, only on a screen that had the tab open when the Timer ran out (a person who opens the tab
  later sees 0:00 and Time's Up, and hears nothing). A browser that refuses sound (nothing pressed on the page yet)
  stays silent; the flash still shows.
- **The flash** shows to everyone whose screen draws the Timer.
- A Stopwatch makes no sound.

## The one ticker

The faces read the time from **one shared ticker** (`lib/timer-ticker.ts`), never an interval of their own:

- It ticks every **250 ms** while at least one running Timer or Stopwatch is drawn, and stops when none is (a paused
  or idle piece does not subscribe).
- It pauses while the browser tab is hidden and ticks at once when it is shown again.
- Each face re-renders only when its own readout changes (once a second), not on every tick: the ticker hands each
  face its formatted time and React keeps the render when the text is the same.

## Export

An SVG or PNG export draws each piece's body and the time its face shows at the moment of the export (a running
Timer's time left then, a paused one's value, an idle one's length), with its state word; no buttons, no flash.

## Share roles

| Role            | Timer and Stopwatch                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------- |
| **Editor**      | Places, moves and deletes them; starts, pauses, resets and sets a length                          |
| **Participant** | Starts, pauses, resets and sets a length (taking part); never places, moves or deletes them       |
| **Viewer**      | Sees the face, the time and the flash, hears the chime; no buttons, and the room drops its deltas |

- The room relays a Participant's `piece-timer` delta (a participation delta) and writes it into the stored tab; a
  Viewer's is dropped. The editor shows the controls on `can.takePart`.
- **The facilitator baton does not gate them.** A Timer belongs to a room, not to the whole session, so a room can run
  its own clock while somebody else facilitates.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- Placing one: `Element · Added · Timer` / `Stopwatch`.
- A press: `Element · Started · Timer` / `Stopwatch` (Start, Restart), `Element · Toggled · TimerPaused` /
  `StopwatchPaused`, `Element · Changed · TimerReset` / `StopwatchReset`, `Element · Changed · TimerLength`. Never the
  length itself.

## Not in scope

- Laps on a Stopwatch, a Timer that counts past zero, adding time to a running Timer (+1 min), custom chime sounds or
  volume, and a server-authoritative clock.
- A Timer seen from the [reader](../008-canvas/avatar-mode.md#the-reader) while walking: the face's own controls work
  while walking, so the reader does not open for them.
