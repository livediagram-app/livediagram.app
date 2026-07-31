# 127 — Agenda

Status: **implemented**.

An ordered run of segments with minutes against each. Press one and it starts
the tab timer for that long and marks itself the segment the room is in.

## Why

The session button (spec/105) put a single facilitation act on the board and
argued that a board carrying its own script works when the person who built it
isn't the one running it. An agenda is that argument finished: a workshop is
not one five-minute timer, it is six segments in an order, and today the order
lives in the facilitator's head or in a doc nobody on the board can see.

## The element

A **shape kind**, `agenda`. Its `label` is the session's name.

- **`ShapeElement.agendaItems`** — `{ label, minutes }[]`, in order. Bounded in
  `validate.ts`.
- **`ShapeElement.agendaCurrent`** — the index of the running segment, or
  absent for "not started". Shared, so the whole room sees where they are.

## Pressing a segment

Routes through **`startTimer`**, the same entry point the Current Tab menu and
the session button already use — so the edit-role gate, the change-log line and
the telemetry all still happen exactly once, in the one place that owns them
(spec/39, spec/105). It then writes `agendaCurrent`.

Pressing a segment while another is running **replaces** the timer rather than
queueing: an agenda that refuses to move on because the last segment overran is
an agenda nobody uses twice.

There is deliberately **no auto-advance** when a timer expires. A segment
ending is a prompt to a human, not an instruction — the room is mid-sentence,
and a board that silently starts the next timer takes a decision that belongs
to the person facilitating.

## The face

- A header with the session name and the **total** of every segment's minutes,
  which is the number that tells you the plan doesn't fit before you start.
- One row per segment: its name, its minutes, and a press target.
- **Done** segments (index below the current) dim and strike through.
- The **current** segment is highlighted and shows the live remaining time,
  read from the tab timer rather than a second clock of its own.

## Editing

Rows are added / renamed / re-timed / reordered / removed from an **Items**
section in the element's context menu, mirroring the checklist's row editor
(spec/83) and the record's field editor (spec/120) rather than inventing a
third row-editing idiom.
