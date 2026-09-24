# Experiments, group I: separation, round 3

Telling touching notes apart, third round, for the bar of
[plans/event-storming-photo-95.md](../../../plans/event-storming-photo-95.md):
no box may hold two labelled notes. Plan:
[plans/event-storming-photo-95-experiments.md](../../../plans/event-storming-photo-95-experiments.md)
(I). Rounds 1 and 2 are [b-separation.md](b-separation.md) and
[b2-separation.md](b2-separation.md). The judge is the sweep over the eight
labelled walls (`packages/sticky-vision/scripts/calibrate.ts`), now scored on
the editor's own pixels; `scripts/merged.ts`, `scripts/trace.ts`,
`scripts/region.ts` and `scripts/seam-cuts.ts` are the tools.

The shadow-seam cut is wired: `detect.ts` hands `fitBoxes` the photograph's
brightness, so every number here includes it (round 2's configuration L).

Every table gives, per wall, **F1 / precision / recall without actors /
merged boxes**.

## Where it started

Commit `71bb6eed`.

| wall             | F1 / prec / rec-A / merged |
| ---------------- | -------------------------- |
| 201646           | 85 / 82 / 93 / 1           |
| 201654           | 99 / 100 / 98 / 3          |
| 201707           | 95 / 95 / 95 / 0           |
| 201713           | 95 / 96 / 94 / 0           |
| 201730 (shade)   | 93 / 94 / 92 / 2           |
| 201743 (night)   | 80 / 82 / 77 / 2           |
| wall-panorama    | 80 / 88 / 77 / 10          |
| whiteboard-dense | 93 / 96 / 89 / 11          |
| **TOTAL**        | **90.7 / 93 / 29**         |

One wall passes (201707). The 29 merged boxes (`merged.ts`): 13 inseparable
(overlapping labels, for the operator), 12 same-colour, 4 cross-colour. The
16 separable ones, traced:

- **201654 #2, 201730 #0: lapped slivers.** The lower note shows 0.3–0.6 of
  itself. 201654's seam is found (depth 20), but the sliver side is 0.59 of a
  note, under `CUT_PIECE_SIZE_RATIO` (0.6), so `boxes.ts` refuses the cut.
  201730's strip is 12–14 px deep under a 36 px note; round 2's fringe trim
  shortens the box to 1.19 notes, under the seam cut's span.
- **Whiteboard #2 and #6: flush pairs 1.68–1.74 notes long**, in the
  splitter's dead band. No pixel of not-paper between them (`region.ts`), and
  no shadow line either: the upper note's paper reads about 157, the lower's 175. The seam is a STEP in brightness, not a valley.
- **Whiteboard #1, #7, #8: small pairs** 1.1–1.4 notes on 19 px notes.
- **Panorama, 9 boxes: the actor lattice.** Small actors (19–22 px, the wall's
  note is 33) stuck in columns, alternating with columns of pink hotspots,
  some cells swapped (a checkerboard in places), welded by the close into a
  93×125 blob of actor-yellow. Within a column the actors are flush. The
  wall's note size lays a 31 px grid over a 20 px lattice. The blob's necks
  (erosion 0.15 note, 5 px) wipe out most of the actors, whose closed mask is
  holed by handwriting, so round 2's neck parts leave one core.

## I1: a step in the paper's level is a seam too (kept)

**Hypothesis.** Two flush notes need not cast a shadow on each other: one is
often simply lit differently (a different tilt to the light, a different
pad). The paper's level then steps at the seam, the same way the whole length
of the line. A step is weaker evidence than a valley: the edge of a line of
writing and light falling off across a note make steps too. So it is trusted
only across a box long enough to be two notes.

**Probe, per piece** (the seam cut's input, `seam-cuts.ts` with a step
metric): a step of ≥ 10 levels crosses a single labelled note in 147 pieces
and separates two in 12; restricted to boxes ≥ 1.5 notes long, 16 against 4.
As a detector on its own it is poor, but the probe counts every piece, most
of which the paper-and-solid bar of a cut would refuse anyway. The sweep is
the judge.

**Rule.** `seamDepthAlong` (was `valleyAlong`) also takes the signed median
of (after − before) along the line, from the same windows 2–4 px either
side, ink skipped; across a box at least `STEP_MIN_SPAN` notes long the
line's depth is the larger of the valley and the step's magnitude, judged
against the same `SEAM_MIN_DEPTH` (12).

| STEP_MIN_SPAN | 1.3  | 1.4  | 1.5  | 1.55 | 1.6  | 1.65 | 1.7  | 1.8  |
| ------------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| TOTAL         | 91.0 | 91.5 | 91.5 | 91.5 | 91.6 | 91.6 | 91.0 | 90.7 |
| merged        | 28   | 28   | 28   | 28   | 28   | 28   | 28   | 29   |

At 1.3 201707 loses a note and 201743 one; from 1.4 to 1.55 201730 gains one
spurious box; from 1.7 the whiteboard's pairs (1.68–1.74 notes) are out of
reach. The step's own threshold, at 1.6: 8 levels 91.4 (201743 −1 precision),
9.6 and 12 both 91.6, 16 91.3 / 29.

At 1.6:

| wall             | F1 / prec / rec-A / merged |
| ---------------- | -------------------------- |
| 201646           | 84 / 80 / 93 / 1           |
| 201654           | 99 / 100 / 98 / 3          |
| 201707           | 95 / 95 / 95 / 0           |
| 201713           | 95 / 96 / 94 / 0           |
| 201730 (shade)   | 93 / 94 / 92 / 2           |
| 201743 (night)   | 80 / 82 / 77 / 2           |
| wall-panorama    | 84 / 90 / 81 / 11          |
| whiteboard-dense | 94 / 97 / 91 / 9           |
| **TOTAL**        | **91.6 / 94 / 28**         |

What moved: whiteboard #2 and #6 parted (merged 11 → 9, recall 89 → 91). On
the panorama the 56×38 box over six notes of the lattice (cross-colour) is
cut into two columns of two actors each (merged 10 → 11, but four notes
found: recall 77 → 81). On 201646 a spurious box 49×86 (not a note) is cut
into two spurious boxes (precision 82 → 80, one box's worth).

**Verdict: kept.** TOTAL 90.7 → 91.6, merged 29 → 28, no wall loses more
than one box.
