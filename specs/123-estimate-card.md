# 123 — Estimate card

Status: **implemented**.

Planning poker on the canvas: everyone picks a number privately, and the card
reveals every answer at once.

## Why

Estimating out loud anchors — the first number said is the number the room
converges on, and the most senior voice says it. The fix is older than software
and is always the same: everyone commits before anyone sees.

The board already knows how to hide things (the reveal zone, spec/106) and how
to collect one answer per person for a moment (the poll, spec/88). Neither does
this: the reveal zone hides content from **everyone equally**, including its
author, and a poll evaporates. An estimate has to hide your neighbour's answer
while showing you your own, and it has to still be there tomorrow.

## The element

A **shape kind**, `estimate`, on the per-participant response primitive
([spec/122](122-participant-responses.md)). Its `label` is the thing being
estimated, so it edits and exports like any other label.

- **`ShapeElement.estimateScale`** — `'fibonacci'` (1 2 3 5 8 13 21 ?),
  `'tshirt'` (XS S M L XL ?) or `'powers'` (1 2 4 8 16 ?). Absent = fibonacci.
  Every scale ends in `?`, which is a real answer ("I can't size this") and the
  most useful one on the card.
- **`ShapeElement.responses`** — one pick per participant (spec/122).
- **`ShapeElement.responsesRevealed`** — shared, false by default.

## The two states

**Before reveal**, the card shows the scale as a row of pressable chips with
**your own pick raised**, and the room as a count — "4 of 6 in" plus the
avatars of who has answered. Deliberately who, not what: knowing that Sam has
answered is what stops the wait, knowing Sam said 13 is the thing being
prevented. You can change your pick freely; it replaces (spec/122).

**After reveal**, each answer appears under its participant's avatar, with the
**spread** called out — the min and max, or "Unanimous" when there is one
distinct answer. The spread is the reason the ritual exists, so it is the one
derived number the card computes rather than leaving the room to scan for it.

## Reveal and clear

- **Reveal** flips `responsesRevealed` for everyone. It is not gated on
  everyone having answered: a facilitator waiting on someone who stepped away
  needs to move on, and the count already says who is missing.
- **Clear** empties `responses` and un-reveals, for the next story. It is a
  separate press from Reveal and not a mode: the revealed board is the artefact
  of the round, and clearing it is a decision.
- Both are edit-role only, like every write (spec/122).

## What it is not

It does not compute a "team velocity", suggest an answer, or auto-pick the
median. The point of the ritual is the conversation about the spread; a number
the tool picks is a number nobody argues with.
