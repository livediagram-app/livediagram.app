# 126 — Keeping a poll's results

Status: **implemented**.

When the host ends a live poll (spec/88), they can keep the tallies as a chart
on the canvas instead of losing them.

## Why

[spec/88](88-live-poll.md) makes the poll leave no trace, and lists the costs
it accepts for that. This closes the one that turned out to hurt: the host asks
the room a question, the room answers, everyone looks at the bars, and then the
result exists nowhere. The board is the record of the session, and the one
number the session produced is the one thing not on it.

The ephemerality itself is still right and is unchanged. What was missing was a
**deliberate act** to promote a result out of it.

## The control

The host's poll panel ends a poll with two buttons rather than one:

- **End poll** — exactly what it did before. Nothing is written anywhere.
- **End & keep results** — ends the poll for everyone AND drops a chart of the
  tallies onto the active tab.

Both are edit-role only and both send the same `poll-end` op, so a participant
sees no difference and no new op kind exists. The capture is done entirely by
the host, from the tallies already in their own memory.

## What it drops

Neither case is a new element kind, which is the point: the thing a poll
produces already has an element that renders, themes, exports and edits it.

### A token poll → a bar chart (spec/53)

- `label` — the poll's question.
- `pieSlices` — one entry per option, `value` = that option's count. Options
  nobody picked are kept at zero, because "nobody chose C" is a result.
- Placed at the centre of the host's viewport and selected on create, like
  every other added element, so it can be moved / themed / exported
  immediately.

The tallies ARE a labelled dataset, and the bar chart already renders, themes,
animates, exports to SVG and imports to Mermaid. A second chart kind would need
every one of those paths rebuilt to show the same bars, and would be worse the
moment someone wants to edit a label or recolour a bar.

### A free-text poll → an opened idea box ([spec/125](125-idea-box.md))

A free-text poll has no tallies to chart — it has a set of short, unattributed
answers, which is exactly what an idea box holds. So it drops one, with the
question as the prompt and the answers as its cards.

It arrives **already open**: the room has just read these answers off the
panel, and a box that landed closed would be hiding what everyone has seen. The
answers keep the poll's own anonymity for free, because the idea box has
nowhere to record an author (spec/125) — and they can be scattered to sticky
notes from there like any other idea.

### Both

An **ordinary undoable element** from the moment it lands. A poll result that
couldn't be undone would be the only un-undoable add on the canvas.

## What does not change

- Nothing is written to D1 **during** the poll, still.
- A host who presses **End poll** leaves no trace, still.
- Late joiners are still not prompted, a reload still drops your answer, and
  the poll still dies with the last connected client (spec/88). This adds one
  door out of the poll; it doesn't reopen the design.
