# Estimate card

Status: **implemented**.

Planning poker on the canvas: everyone picks a number privately, and the card
reveals every answer at once.

## Why

Estimating out loud anchors — the first number said is the number the room
converges on, and the most senior voice says it. The fix is older than software
and is always the same: everyone commits before anyone sees.

The board already knows how to hide things (the reveal zone, [Reveal zone](../009-elements/reveal-zone.md)) and how
to collect one answer per person for a moment (the poll, [Live poll (ephemeral pulse-check)](live-poll.md)). Neither does
this: the reveal zone hides content from **everyone equally**, including its
author, and a poll evaporates. An estimate has to hide your neighbour's answer
while showing you your own, and it has to still be there tomorrow.

## The element

A **shape kind**, `estimate`, on the per-participant response primitive
([Per-participant responses](participant-responses.md)). Its `label` is the thing being
estimated, so it edits and exports like any other label.

- **`ShapeElement.estimateScale`** — `'fibonacci'` (1 2 3 5 8 13 21 ?),
  `'tshirt'` (XS S M L XL ?) or `'powers'` (1 2 4 8 16 ?). Every scale ends in
  `?`, which is a real answer ("I can't size this") and the most useful one on
  the card. **Absent means not chosen yet** (below), except on a card that
  already holds answers: that is an older card from before the choice existed,
  when absent meant Fibonacci, and it keeps meaning that
  (`estimateScalePending`).
- **`ShapeElement.responses`** — one pick per participant ([Per-participant responses](participant-responses.md)).
- **`ShapeElement.responsesRevealed`** — shared, false by default.

## Choosing a scale

The three scales are the same card with different answers, so the palette has
**one** Estimate tile, not a tile per scale. A new card arrives with no scale
and asks for one on the canvas: **"Choose a scale"** ("Everyone picks privately
from these cards") over the three scales as rows, each with a small fan of three
of its cards, its name, and every value as a quiet line (the values are what is
being chosen between, not the names). Hovering a row washes it in the accent,
fans its cards out and nudges its chevron; nothing jumps. One press sets it, as an ordinary undoable edit that
anyone who can edit may make, and the card becomes the normal estimate card. A
viewer who can't edit sees "Waiting for a scale". The element menu's **Scale**
changes it afterwards, as before.

## The two states

**Before reveal**, the card shows the scale as a row of cards to pick from with
**your own pick lifted**, and the room as a face-down card for each person who
has answered, their avatar on it, over a slim progress bar; the count is the
header's "4/6 answered", shown once. Deliberately who,
not what: knowing that Sam has answered is what stops the wait, knowing Sam said
13 is the thing being prevented. You can change your pick freely; it replaces
([Per-participant responses](participant-responses.md)).

**After reveal**, every card turns face up at once, sorted low to high, each
with its person's avatar, and the **spread** is called out. The spread is the
reason the ritual exists, so it is the one derived thing the card computes
rather than leaving the room to scan for it: "Unanimous · 5" when there is one
distinct answer, "Spread 3 → 13" otherwise (or the answers named, for a t-shirt
round that has no numbers to subtract), and the lowest and highest cards are
ringed, because they are the two people who should talk first.

## Reveal and a new round

- **Reveal** flips `responsesRevealed` for everyone. It is not gated on
  everyone having answered: a facilitator waiting on someone who stepped away
  needs to move on, and the count already says who is missing.
- **New round** empties `responses` and un-reveals, for the next story. It only
  appears once the card is revealed, in Reveal's place: the revealed board is
  the artefact of the round, and clearing it is a decision, not a press made by
  mistake beside Reveal. Before the reveal there is nothing to clear that a
  pick change doesn't already handle.
- Both are edit-role only, like every write ([Per-participant responses](participant-responses.md)).

## The look

Built in the behaviour elements' current direction ([Participant responses](participant-responses.md): the paper
kit is being retired; the [Q&A board](qa-board.md), [Idea box](idea-box.md) and [Temperature check](temperature-check.md) set it). It
replaced a row of number chips over a printed crosshatched card back, a "Shown"
rubber stamp after the reveal, and Reveal / Clear pills side by side.

- **Accent.** The tab theme's accent (the shared accent scope), so an unstyled
  card follows the theme and light / dark like the rest of the board.
- **The scale as cards.** Each value is a portrait card sharing the row's
  width, each capped so a wide card doesn't turn them into slabs. Your pick
  fills in the accent, lifts, and pops; pressing it again withdraws it.
- **Face down, then face up.** Before the reveal each answer is a small
  face-down card in the accent's tint with its person's avatar, over a slim
  progress bar; the count is the header's "4/6 answered", shown once. On the reveal they flip face up in a short
  cascade, sorted low to high.
- **The one action** is the Q&A board's dashed accent bar, at the foot of the
  card under the cards it acts on: **Reveal** with its count as a badge while
  hidden, **New round** once revealed. No hover card on either: the label says
  what it does.
- **Empty**, a quiet line of face-down ghost cards over "No picks yet" and
  "Your pick stays hidden from everyone until the reveal."
- The spread and the value order live in `@livediagram/diagram`
  (`estimateSpread`, `estimateRank`), so the export draws the same card: the
  scale, and once revealed the sorted answers with the spread.
- Durations are canvas motion and live in `qa-board.css`; every motion
  collapses under reduced motion.

## What it is not

It does not compute a "team velocity", suggest an answer, or auto-pick the
median. The point of the ritual is the conversation about the spread; a number
the tool picks is a number nobody argues with.
