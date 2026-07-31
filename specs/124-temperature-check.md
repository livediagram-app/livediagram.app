# 124 — Temperature check

Status: **implemented**.

A fist-of-five gauge: everyone in the room registers 1 to 5, and the element
shows the spread and the average as the answers land.

## Why

"How does everyone feel about this?" is the cheapest facilitation move there
is, and on a shared board it currently has no home. The rating element
(spec/52) looks like the answer and is not: it is **one** score that **one**
person sets, and the next person to touch it overwrites the first. A dot-vote
(spec/39) is per-person but targets whole elements and evaporates with the
session.

## The element

A **shape kind**, `temperature`, on the response primitive
([spec/122](122-participant-responses.md)). Its `label` is the question.

- **`ShapeElement.responses`** — one reading per participant, `'1'`..`'5'`.
- Nothing else. Five is not configurable: fist-of-five is a named ritual with a
  shared meaning (1 = blocked, 5 = enthusiastic), and a 1-to-7 variant is a
  different instrument wearing the same face.

## It is deliberately never hidden

The opposite choice from the estimate card ([spec/123](123-estimate-card.md)),
which hides answers until a reveal. Both choices are right for their instrument:

- An **estimate** is a commitment, and seeing someone else's first ruins it.
- A **temperature check** is a reading of the room, and watching the bars move
  as people answer IS the information. It shows a facilitator when the room has
  finished answering, and it shows a dissenter that they are not alone before
  they have to say so out loud.

So there is no `responsesRevealed` on this kind, and no control to add one.

## The face

- A row of five pressable numbers, **your own reading raised**.
- A bar per value, heights proportional to how many chose it, so the shape of
  the room is readable at a glance — a flat 3 across the board and a split
  between 1s and 5s have the same average and mean opposite things.
- The **average to one decimal**, large, with the respondent count under it.
- Empty state says "No readings yet" rather than drawing an average of zero,
  which would read as a very unhappy room.

Colour runs cool-to-warm across the five bars from the theme's own accent
range, so a low reading looks low without the element hard-coding red.
