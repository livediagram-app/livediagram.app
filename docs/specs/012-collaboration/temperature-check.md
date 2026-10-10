# Temperature check

Status: **implemented**.

A fist-of-five gauge: everyone in the room registers 1 to 5, and the element
shows the spread and the average as the answers land.

## Why

"How does everyone feel about this?" is the cheapest facilitation move there
is, and on a shared canvas it currently has no home. The rating element
([Rating](../009-elements/rating.md)) looks like the answer and is not: it is **one** score that **one**
person sets, and the next person to touch it overwrites the first. A dot-vote
([Session tools (timer + voting)](session-tools.md)) is per-person but targets whole elements and evaporates with the
session.

## The element

A **shape kind**, `temperature`, on the response primitive
([Per-participant responses](participant-responses.md)). Its `label` is the question.

- **`ShapeElement.responses`** — one reading per participant, `'1'`..`'5'`.
- Nothing else. Five is not configurable: fist-of-five is a named ritual with a
  shared meaning (1 = blocked, 5 = enthusiastic), and a 1-to-7 variant is a
  different instrument wearing the same face.

## It is deliberately never hidden

The opposite choice from the estimate card ([Estimate card](estimate-card.md)),
which hides answers until a reveal. Both choices are right for their instrument:

- An **estimate** is a commitment, and seeing someone else's first ruins it.
- A **temperature check** is a reading of the room, and watching the bars move
  as people answer IS the information. It shows a facilitator when the room has
  finished answering, and it shows a dissenter that they are not alone before
  they have to say so out loud.

So there is no `responsesRevealed` on this kind, and no control to add one.

## The face

Built in the behaviour elements' current direction ([Participant responses](participant-responses.md): the paper kit
is being retired; the [Q&A board](qa-board.md) and [Idea box](idea-box.md) set the look): a flat card, no printed
instrument, and motion that says something happened. It replaced a row of numbered chips over a
graduated gauge plate.

- **Five faces to pick from**, not five numbers. Each button is a face that runs from a frown (1)
  to a beam (5) over its number. Your own pick fills in its colour, lifts, and pops when you choose
  it; pressing another moves it. The value's word (**Blocked, Doubtful, Okay, Keen, All in**, the
  ritual's meaning: 1 = blocked, 5 = enthusiastic) is only the accessible name: printed, it took
  room from the face and added nothing, and a hover card over five obvious faces was noise.
- **One grid.** The faces, the bars and the mood meter share one five-column grid, each column
  capped (88px) and the grid centred, so the buttons are big targets without turning into slabs
  on a wide card, and a value's face, its bar and its point on the meter sit on one centre line.
- **The shape of the room.** A rounded bar per value, height proportional to how many chose it,
  easing to its new height as answers land, with the count over it. A flat 3 across the board and a
  split between 1s and 5s have the same average and mean opposite things, so the bars stay the
  main read. A count that rises after the card first painted pops.
- **The mood meter.** Under the bars, a cool-to-warm gradient track with a glowing marker that
  glides to the average. The track runs from the centre of the first column to the centre of the
  last, so a reading of 4 sits directly under the 4, and a 1 or a 5 rests on the track's end
  inside the card. Under it, the average to one decimal, large, with the respondent count.
- **A new reading.** Once anyone has answered, the card's own `…` offers **Reset Answers** (beside
  the way into the element's settings), which clears every answer into a new round, the same
  `clearResponses` the Done check's Reset everyone and the estimate's New round use. Like them it
  runs the room, so it is the facilitator's ([Facilitator](facilitator.md)), and absent for a
  view-role visitor. With nothing to reset the card shows the shared settings `…` instead.
- **Empty** says "No readings yet" and "Tap the face that fits" over a quiet track with no marker,
  rather than drawing an average of zero, which would read as a very unhappy room.

Colour runs cool-to-warm across the five values in **fixed hues** (blue, cyan, lime, amber, rose),
not the theme's palette: a temperature check that recoloured with the tab theme would read as five
arbitrary bars, and "the low one is the cold one" is the whole glanceable part. The hues and words
live in `@livediagram/document` (`TEMPERATURE_COLORS`, `TEMPERATURE_MOODS`), so the export draws the
same card: the five faces over their numbers (`TEMPERATURE_FACE_MOUTHS`, shared with the canvas), the bars, the gradient track and the average. Everything else
is `tint()` of the element's own colours, so the card holds on any theme and in either appearance,
and every motion collapses under reduced motion. Its durations are canvas motion, so they live in
`qa-board.css` beside the Q&A board's ([Motion](../004-interface-design/motion.md)), not in component classes.
