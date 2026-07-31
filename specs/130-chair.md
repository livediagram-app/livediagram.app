# 130 — Chair

Status: **implemented**.

A Behaviour element an Avatar-mode character **sits down in** when it walks
into one.

## Why

Avatar mode (spec/101) put people inside the diagram and gave them one thing to
do there: walk. A chair gives the room furniture, and furniture is what turns a
space into a place.

It earns its keep the moment a board has more than one: eight chairs around a
table is a seating plan, an attendance display, and a turn-taking device all at
once, drawn with elements the author already knows how to place. "Everyone grab
a seat" is a thing facilitators say, and on this board it becomes literal.

It is also the cheapest possible version of the idea — the walk hook already
fires when a character arrives on top of something, which is exactly how the
portal (spec/104) works.

## The element

A **shape kind**, `chair`, in the palette's **Behaviour** band beside the mode
button, portal, session button, reveal zone and picker.

- Drawn as a chair seen from above-front: a seat, a back, and a shadow, so it
  reads as furniture rather than as a box with a label.
- **`ShapeElement.chairFacing`** — `'n' | 'e' | 's' | 'w'`, which way the seat
  points. Absent = `'n'` (back at the top, sitter facing down the board, toward
  the reader). Set from the element's context menu.
- Its `label` is optional and renders under the chair: "Scribe", "Facilitator",
  "Alex" — a chair that is somebody's chair.
- Otherwise a completely ordinary element: move, resize, rotate, theme, group,
  lock, copy, export.

## Sitting

Walking a character onto a chair seats it, fired **once on arrival** by the
same `useAvatarWalk` mechanism the portal uses (not every frame it stands
there).

- The character **snaps to the chair's seat point** and switches to a seated
  pose — legs forward, body lowered, facing the way the chair faces.
- While seated it **ignores walk targets**: clicking elsewhere on the canvas
  does not drag it out of the chair by accident.
- **Standing up** is any arrow key, or double-clicking the canvas. Both are
  deliberate acts. The seated face also carries a small **Stand** press for
  people using a touch device with no arrow keys.
- A seated character can still **wave and react** (spec/101). Sitting removes
  locomotion, not personality.

## Occupancy is presence, never document state

Who is in a chair rides the existing `avatar` RoomOp, as a new
`seatedOn: elementId | null` on `AvatarPresence`. **Nothing is written to the
diagram.**

This is the rule that makes the feature safe, and it is spec/101's rule
unchanged: everyone's character is authoritative on its owner's machine. So a
chair cannot be left permanently occupied by someone who closed their laptop, a
chair's occupancy cannot conflict between two clients, and no seating state
reaches D1, the change log or undo.

- The chair renders **occupied** — a soft ring in the sitter's presence colour
  and their name under it — derived from the peer presence the canvas already
  receives.
- **Two people can sit in the same chair.** Not an accident: enforcing one
  seat means a lock, a lock means an owner, and an owner means a chair that
  gets stuck. Two overlapping characters is a self-correcting problem that the
  room resolves socially in about a second, and a stuck chair is not.
- A peer who leaves the mode, changes tab or disconnects vacates every chair
  for free, because their presence went away.

## Not in scope

- **No walk-to-the-nearest-free-chair.** Sit where you walked.
- **No table element.** A chair is furniture the room already knows how to
  arrange around whatever the author drew.
