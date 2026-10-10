# Agenda

Status: **implemented**.

An ordered run of segments with minutes against each. Press one and it starts
the tab timer for that long and marks itself the segment the room is in.

## Why

The session button ([Session button](session-button.md)) put a single facilitation act on the canvas and
argued that a canvas carrying its own script works when the person who built it
isn't the one running it. An agenda is that argument finished: a workshop is
not one five-minute timer, it is six segments in an order, and today the order
lives in the facilitator's head or in a doc nobody on the canvas can see.

## The element

A **shape kind**, `agenda`. Its `label` is the session's name.

- **`ShapeElement.agendaItems`** — `{ label, minutes }[]`, in order. Bounded in
  `validate.ts`.
- **`ShapeElement.agendaCurrent`** — the index of the running segment, or
  absent for "not started". Shared, so the whole room sees where they are.
- **`ShapeElement.agendaTimerStartedAt`** — the `startedAt` of the tab timer
  run that segment started (`TabTimer.startedAt`, minted by `startTimer` and
  kept through pause, resume and extend). Absent when no segment is current.

## The current segment

`agendaCurrent` is an index into the rows, so it is kept true as they change
(`packages/document/src/agenda-current.ts`):

- **Moving a row** carries the current index with it, so the segment the room
  is in stays the one lit.
- **Removing the current row** clears `agendaCurrent` (and its timer stamp);
  removing a row above it shifts it up. An index past the rows, however it got
  there, is cleared on the next edit and drawn as no segment meanwhile.
- **Undo** restoring older rows keeps the current row only if it is still
  there (same name and minutes), where it was or else where it went; otherwise
  it clears. `agendaCurrent` is a live field undo does not take back, so this
  is what stops it pointing at a different row.
- **Reset Agenda**, in the card's own `…` while a segment is current, unsets
  `agendaCurrent` and the stamp: back to "not started". It runs the room, so
  it is the facilitator's ([Facilitator](facilitator.md)). The tab timer is
  left alone; the agenda only stops claiming it.

**The live time is the segment's own countdown only.** The face shows the tab
timer's time left on the current segment only while the tab timer is a
countdown whose `startedAt` matches `agendaTimerStartedAt` (`agendaOwnsTimer`).
Any other timer (a stopwatch, a countdown started from the Timer menu, one
whose length was changed there) is somebody else's clock, and the segment shows
its minutes instead.

## Pressing a segment

Routes through **`startTimer`**, the same entry point the Current Tab menu and
the session button already use — so the edit-role gate and
the telemetry all still happen exactly once, in the one place that owns them
([Session tools (timer + voting)](session-tools.md), [Session button](session-button.md)). It then writes `agendaCurrent`.

Pressing a segment while another is running **replaces** the timer rather than
queueing: an agenda that refuses to move on because the last segment overran is
an agenda nobody uses twice.

There is deliberately **no auto-advance** when a timer expires. A segment
ending is a prompt to a human, not an instruction — the room is mid-sentence,
and a canvas that silently starts the next timer takes a decision that belongs
to the person facilitating.

## The face

Built in the behaviour elements' current direction ([Participant responses](participant-responses.md): the paper kit is being retired; the [Q&A board](qa-board.md) set the look), in the tab theme's accent. It replaced a list of rows over a ruled, creased "folded programme".

- A header with the session name and the **total** of every segment's minutes,
  which is the number that tells you the plan doesn't fit before you start.
- **How far through the session**, as a slim accent bar under the header: the
  finished segments' minutes plus the current one's elapsed time, over the
  total.
- A **stepper**: one row per segment down a rail. Done segments show a check
  and their name struck through, drawn back; upcoming ones a hollow ring and
  their minutes; the **current** one a pulsing accent dot and an expanded row,
  lit in the accent, with the live remaining time large and a bar draining as
  it runs, read from the tab timer rather than a second clock of its own.
- Every segment is the press target that starts it; under the pointer an
  upcoming one shows **Start** with a play glyph in place of its minutes, so
  the row says what the press does. The exception is the **running** segment
  (current, and its own countdown running): a press would restart it, so it is
  inert.
- Each segment's accessible name says its state and what a press does
  (`agendaStepLabel`): "Start Intro, 5 minutes" ahead, "Start Intro again,
  done, 5 minutes" once done, "Restart Intro, current, 5 minutes" when current
  but its countdown is not running, "Intro, running, 5 minutes" while it runs,
  and "Intro, not started, 5 minutes" (or done / current) for a viewer who
  cannot press it.
- **No segments** gets the shared invitation ("No segments yet", "Add them from
  the element's menu, under Segments").
- Motion is canvas motion, in `qa-board.css`, off under reduced motion.

## Editing

Rows are added / renamed / re-timed / reordered / removed from a **Segments**
section in the element's context menu, mirroring the checklist's row editor
([Checklist](../009-elements/checklist.md)) and the record's field editor ([The entity](../009-elements/entity.md)) rather than inventing a
third row-editing idiom.
