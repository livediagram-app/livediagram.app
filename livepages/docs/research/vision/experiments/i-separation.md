# Experiments, group I: separation, round 3

Telling touching notes apart, third round, for the bar of
plans/0007-event-storming-photo-95.md:
no box may hold two labelled notes. Plan:
plans/0006-event-storming-photo-95-experiments.md
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

## I2: small pads at their own scale (kept: thin boxes only)

**Hypothesis.** The panorama's lattice of small actors is cut on the wall's
33 px grid; at the actors' own scale (19–22 px) the seams between them are
plain in the brightness (a dark line of shadow and a bright line of the next
note's top edge, 20–30 levels, `region.ts` and a luminance dump). The
question is how to know, blob by blob, that a blob is made of small notes.

**The colour's own note size (rejected).** `fitBoxes` knows each colour's
note size (`estimateNoteSizes`: 19 px for the panorama's actor yellow). In a
scratch copy of `boxes.ts`:

| variant                                                                 | TOTAL | prec | merged | panorama F1 / prec / rec-A / m |
| ----------------------------------------------------------------------- | ----- | ---- | ------ | ------------------------------ |
| reference (I1)                                                          | 91.6  | 94   | 28     | 84 / 90 / 81 / 11              |
| the splitter at the colour's size                                       | 88.0  | 88   | 23     | 69 / 63 / 83 / 3               |
| the seam cut at the colour's size                                       | 91.5  | 93   | 25     | 83 / 86 / 81 / 8               |
| …only when the wall's size finds no cut and every piece ≤ 1.25–1.6 long | 91.6  | 94   | 28     | 84 / 90 / 81 / 11              |

The panorama's yellow is also its big actors (34–40 px) and its yellow
notes: at the colour's size they are diced (37 spurious boxes on the
panorama). The seam cut at the colour's size finds no note more; its merged
boxes fall only because they are cut into pieces too small to match
anything (12×12, 36×18). Asking the pieces to be squarish refuses every cut.

**The necks, regrown less far (rejected: a knife edge).** With the erosion
at 5 px on the panorama, the regrowth steps give (TOTAL / merged, panorama
F1 / rec-A / merged): 7 steps 90.8 / 23 (76 / 72 / 6), 8 steps 91.6 / 26
(84 / 83 / 9), 9 steps 91.4 / 27, 10 steps (today's 2×) 91.6 / 28. Filling
holes smaller than (0.3–0.5 note)² before eroding lowers every one of them.
One step either way swings the panorama by ten points of recall: no plateau.

**Rule (kept).** The box says it itself: a box thinner than
`THIN_FRACTION` = 0.7 of the wall's note is a column (or row) of notes about
as long as it is thin, so `findSeam` measures it against its own thickness
instead of the wall's note (the piece floor, the span and the step span all
scale with it).

| THIN_FRACTION | 0.55 | 0.6  | 0.65 | 0.7  | 0.75 | 0.8  | 0.85 |
| ------------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| TOTAL         | 91.6 | 91.7 | 91.8 | 91.8 | 91.8 | 91.6 | 91.6 |
| merged        | 28   | 27   | 26   | 26   | 26   | 27   | 27   |

From 0.8 the whiteboard loses a note (its notes are 19 px, a thin piece
there is a note). At 0.7:

| wall             | F1 / prec / rec-A / merged |
| ---------------- | -------------------------- |
| 201646           | 84 / 80 / 93 / 1           |
| 201654           | 99 / 100 / 98 / 3          |
| 201707           | 95 / 95 / 95 / 0           |
| 201713           | 95 / 96 / 94 / 0           |
| 201730 (shade)   | 93 / 94 / 92 / 2           |
| 201743 (night)   | 80 / 82 / 77 / 2           |
| wall-panorama    | 86 / 91 / 83 / 9           |
| whiteboard-dense | 94 / 97 / 91 / 9           |
| **TOTAL**        | **91.8 / 94 / 26**         |

What moved: the two columns I1 made of the lattice's first six notes (19×35
and 20×38, two actors each) are parted, four notes found. Nothing else on
any wall moves.

**Verdict: kept.** TOTAL 91.6 → 91.8, merged 28 → 26. The rows of two actors
left on the panorama (#2, #3, #8: 23–25 px thick, 0.70–0.76 of a note) sit
just above the threshold; 0.75 reaches the thickness but finds no seam in
them.

## I5a: the fringe beside a neighbour of another colour (kept)

**Finding.** Both cross-colour boxes left on the panorama (#0, #5: an orange
event whose box reaches over a pink hotspot's centre) hang on the same
thing: a ring of orange one or two pixels wide around a small yellow note
lapped on the event's foot (`region.ts`), the JPEG's blend of yellow and
wall. Round 2's trim drops such a fringe only where it runs further than the
regrowth reaches (twice the erosion, 10 px there); this one is shorter, so
the event's box grows 9 px down the yellow note's side and takes the
hotspot's centre with it.

**Rule.** In `necks.ts`, paper that touches paper of another colour
(8-connected, in the closed mask) is BESIDE it. The erosion reads all the
paper, as before; the regrowth follows BESIDE paper only while it is
restoring the note's own body, up to `NECK_FRINGE_FREE` = 1.5 erosions from
the core, and not beyond.

| variant                                               | TOTAL | merged | panorama F1 / prec / rec-A / m |
| ----------------------------------------------------- | ----- | ------ | ------------------------------ |
| reference (I2)                                        | 91.8  | 26     | 86 / 91 / 83 / 9               |
| BESIDE paper left out of the region altogether (1 px) | 91.7  | 24     | 85 / 89 / 83 / 7               |
| …2 px                                                 | 90.5  | 21     | 74 / 90 / 70 / 5               |
| …3 px                                                 | 90.3  | 22     | 71 / 88 / 66 / 5               |
| BESIDE only where ≥ 2–3 of the 8 neighbours are other | 91.7  | 24     | 85 / 89 / 83 / 7               |
| erode everything, never regrow into BESIDE            | 91.7  | 24     | 85 / 89 / 83 / 7               |
| …after 1.0–1.4 erosions                               | 91.7  | 24     | 85 / 89 / 83 / 7               |
| …after 1.5–1.6 erosions                               | 91.8  | 24     | 86 / 91 / 83 / 7               |
| …after 1.8 erosions                                   | 91.8  | 25     | 86 / 91 / 83 / 8               |

Leaving BESIDE paper out of the region also narrows every note lapped on
another colour by a pixel and changes which cores the erosion finds, so one
small actor on the panorama (beside a big one) is swapped for a box. Letting
the body regrow into it first keeps the cores as they were. Below 1.5 the
same actor is swapped; from 1.8 one of the two fringes is followed again.

| wall             | F1 / prec / rec-A / merged |
| ---------------- | -------------------------- |
| 201646           | 84 / 80 / 93 / 1           |
| 201654           | 99 / 100 / 98 / 3          |
| 201707           | 95 / 95 / 95 / 0           |
| 201713           | 95 / 96 / 94 / 0           |
| 201730 (shade)   | 93 / 94 / 92 / 2           |
| 201743 (night)   | 80 / 82 / 77 / 2           |
| wall-panorama    | 86 / 91 / 83 / 7           |
| whiteboard-dense | 94 / 97 / 91 / 9           |
| **TOTAL**        | **91.8 / 94 / 24**         |

**Verdict: kept.** Merged 26 → 24 (cross-colour 3 → 1: the one left is a
whiteboard note lapped under a command, 0.7 of it hidden), TOTAL level, no
wall moves otherwise.

## I4: the seam between two pads of one kind (kept)

**Finding.** The panorama's pair #2 (37×25, two actors side by side) shows
no seam in brightness at all: a valley of 5–10 levels, the paper 155–160 on
both sides. Its colours tell it at once: red − green is about 44 on the left
note (an orange-yellow pad) and about 7 on the right (a lemon one). The colour
mask calls both actor yellow.

**Hypothesis.** A note's paper is one colour edge to edge (light changes its
brightness far more than its hue), so a line that splits a box's paper into
two sides of plainly different median colour runs between two pads' notes.

**Probes (rejected).**

| variant (with I1, I2, I5a)                                                         | TOTAL                                                | merged | notes                        |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------- | ------ | ---------------------------- |
| reference                                                                          | 91.8                                                 | 24     |                              |
| a local chroma STEP along the line (the brightness step's windows), from 1.1 notes | 90.4–90.9                                            | 25–26  | 201707 −3 notes, panorama −4 |
| …from 1.3 notes                                                                    | 90.8–91.3                                            | 23–24  | 201707 −2 notes, panorama −4 |
| sides' median colours from the box's pixels (no mask), first line at the maximum   | 92.1 at 28–30, 92.0 at 32, 91.9 at 35–80, 91.5 at 25 | 21–24  | twice the detector's time    |

The local step reads the ink's own colour and the edge of a neighbour. The
region medians work, but a median is equally far apart anywhere that leaves
a majority of each pad on its side, so the "first" line lands at the margin,
and computing medians per line position doubled the sweep's time.

**Rule.** `paper-hue.ts`: `findHueSeam`. `luminanceOf` also carries two
opponent channels (red − green, yellow − blue). Across a box at least
2 × `SEAM_MIN_PIECE` = 1.1 notes long, for every upright line leaving a note
either side, the sides are compared by the median colour of their paper (the
mask's own colour, ink out), from running histograms; the seam goes where the
mean of the lines' median colours differs most among the lines that pass
`HUE_SEAM_MIN_STEP`. `findSeam` falls back to it only when there is no
shadow.

| HUE_SEAM_MIN_STEP | 22–25 | 28   | 30   | 32   | 36–80 |
| ----------------- | ----- | ---- | ---- | ---- | ----- |
| TOTAL             | 91.3  | 91.9 | 91.9 | 91.9 | 91.8  |
| merged            | 24    | 23   | 22   | 23   | 24    |

At 25 and below the seam cuts the first cell of the panorama's lattice of
small actors before its columns are found, and four notes go. The span must
be 1.1 notes unrounded: the rounded margin let 20 px boxes (1.05 notes) be
cut on the whiteboard, which cost it a note. Seam-cut time about +20 ms per
photo.

| wall             | F1 / prec / rec-A / merged |
| ---------------- | -------------------------- |
| 201646           | 84 / 80 / 93 / 1           |
| 201654           | 99 / 100 / 98 / 3          |
| 201707           | 95 / 95 / 95 / 0           |
| 201713           | 95 / 96 / 94 / 0           |
| 201730 (shade)   | 93 / 94 / 92 / 2           |
| 201743 (night)   | 80 / 82 / 77 / 2           |
| wall-panorama    | 87 / 91 / 83 / 5           |
| whiteboard-dense | 94 / 97 / 91 / 9           |
| **TOTAL**        | **91.9 / 94 / 22**         |

**Verdict: kept, with a caution.** TOTAL 91.8 → 91.9, merged 24 → 22, no
wall loses anything, and 28–32 score alike; but the band is narrow, with
harm three levels below it. It is a rule about paper, not about this wall,
and the only pair of pads on these eight walls sits at 33–37; a ninth
labelled wall would say whether 30 holds.

## The brightness step also reads ink (measured, not changed)

Writing a guard test for I4 showed that I1's step also fires beside a
stroke of ink running along the line (the window on one side is ink, the
other paper). Reading the step only between paper and paper (no ink in
either window, and on at least half the line) costs the panorama four notes
(TOTAL 91.8 → 91.3, merged 24 → 25): in a box 1.6 notes long a cut
anywhere between the two notes' centres parts them, and a line of writing
across a column of two actors is such a cut. It stays as it is; the span
(1.6 notes) is the guard.

## I2b: a thin neck part is a column, not a group (kept)

**Hypothesis.** Round 2 takes a blob's neck parts only when every part is at
most 1.4 notes long; a longer part is a group of notes the necks fell
around, better left to the grid over the whole blob. A part THINNER than a
note, though, is a column of small notes (I2), which the seam cut takes
apart at its own scale.

**Rule.** `atNecks` also takes a part thinner than `THIN_FRACTION` of the
note, whatever its length (`noteScaleOf`, shared with the seam cut).

| part taken when thinner than (notes) | 0.6  | 0.65–1.0 |
| ------------------------------------ | ---- | -------- |
| TOTAL                                | 91.9 | 92.0     |
| merged                               | 22   | 22       |

It shares I2's threshold (0.7), inside the plateau. One more actor found on
the panorama (rec-A 83 → 85), nothing else moves.

Also measured: the notch cut at the thin box's own scale (`chords.ts`,
0.6–0.8): no change on any wall.

| wall             | F1 / prec / rec-A / merged |
| ---------------- | -------------------------- |
| 201646           | 84 / 80 / 93 / 1           |
| 201654           | 99 / 100 / 98 / 3          |
| 201707           | 95 / 95 / 95 / 0           |
| 201713           | 95 / 96 / 94 / 0           |
| 201730 (shade)   | 93 / 94 / 92 / 2           |
| 201743 (night)   | 80 / 82 / 77 / 2           |
| wall-panorama    | 88 / 91 / 85 / 5           |
| whiteboard-dense | 94 / 97 / 91 / 9           |
| **TOTAL**        | **92.0 / 94 / 22**         |

**Verdict: kept.** TOTAL 91.9 → 92.0.

## Re-swept, unchanged

- `SEAM_MIN_DEPTH` after I1–I5a: 8 → 91.4, 10 → 91.6, 12 → 91.8, 14–16 →
  91.6 (merged 24–25). 12 stays.
- `THIN_FRACTION` 0.78–0.85, to reach the panorama's rows of two actors
  (23–25 px thick): the rows show no seam (a valley of 5–10 levels) and 0.8
  costs the whiteboard a note.

## Measured for `boxes.ts` (group H)

Two changes in `fitBoxes` pay, measured in a scratch copy (never committed):

- **Seam first, on sprawls.** Run the seam cut over a blob of at least 8 note
  areas BEFORE the splitter's grid, and the grid over its pieces: the grid
  over the panorama's lattice of small actors otherwise lays 31 px cells over
  a 20 px lattice, and every seam cut after it works from misplaced cells.
  TOTAL 92.0 → 92.2 (panorama rec-A 85 → 87), merged 22; 6–10 note areas
  score alike, 5 costs the whiteboard a note, 12 gives the gain back.
- **A seam cut that leaves a sliver is a trim.** When a seam cut's pieces are
  not all paper, and the ones that are not are slivers (thinner than
  `CUT_PIECE_SIZE_RATIO`), keep the paper pieces if each is at least 0.7–0.8
  of a note thick: 201654's lapped pair is parted (merged 22 → 21), nothing
  lost. 0.6 costs 201713 and the panorama a note each; 0.85 parts nothing.
  Letting ANY non-paper piece go (not only slivers) together with the seam
  first scores 92.6 and passes 201713 (99 / 100 / 98), but only by dropping
  the parts of a sprawl the seam cut leaves too big to be a note: notes
  thrown away that happen, on these eight walls, to be found by another
  blob's box. Not a rule to keep; a hint that 201713's sprawl (136×160, fill
  0.48) is where its last misses are.

Together (seam first at 8, sliver trim at 0.8): TOTAL 92.2, merged 21, one
wall passing.

Also measured and rejected, in `split.ts`: skipping the grid for thin pieces
and leaving them to the seam cut (whiteboard −1 note, TOTAL 91.8).

## Where it ended

Kept, in order: I1 `a79bbeb0`, I2 `15a23c16`, I5a `ec72f3dd`, I4 `6e678925`,
I2b `4ddb387c`.

|             | TOTAL | precision | merged | walls passing |
| ----------- | ----- | --------- | ------ | ------------- |
| round start | 90.7  | 93        | 29     | 1 (201707)    |
| round end   | 92.0  | 94        | 22     | 1 (201707)    |

The 22 merged boxes left: 13 inseparable (overlapping labels, for the
operator) and 9 separable:

- **201654 #2**: a lapped pair whose lower note shows 0.52 of itself. The
  seam is found; `boxes.ts` refuses the cut for the sliver (the trim above).
- **201730 #0**: the lower note shows 12–14 px under a 36 px note, and a
  line of writing thins the paper there, so the necks trim its strip off and
  the box left is 1.19 notes, under the seam cut's span.
- **Panorama, four**: the lattice of small actors (a 30×33 grid cell, a big
  actor beside a small one, two rows of two). The seam cut runs after the
  grid, so it inherits the grid's misplaced cells (seam first, above).
- **Whiteboard, three**: a staggered pair inside the 108×257 carpet of flush
  orange events, a 21×21 grid cell 6 px off its pair's seam, and a note
  lapped 0.7 under a command. At 19 px a note, with no pixel of not-paper
  between the notes, these are at the edge of what the photograph gives.

What would come next: the seam cut before the grid on sprawls, and the
sliver trim (both `boxes.ts`); a lattice fit for pads of small notes (a grid
whose pitch and phase are read from the seams, not from the wall's note);
and, for the whiteboard's carpet, the learned boundary model of group E,
which is the one approach here that sees seams at 19 px.

## Integration (the parent session)

On its own branch every step above held. Merged on top of groups G and H —
whose recall changes landed in parallel — three of them no longer did, and
were taken back out; replayed one at a time on the merged branch:

| step added                           | panorama F1 / rec-A / merged | whiteboard merged | 201654 merged | TOTAL merged |
| ------------------------------------ | ---------------------------- | ----------------- | ------------- | ------------ |
| G + H                                | 86 / 89 / 10                 | 10                | 2             | 27           |
| + I1 a step in the paper is a seam   | 86 / 89 / 10                 | 8                 | 2             | 25           |
| + I5a no fringe along another colour | 86 / 89 / 8                  | 8                 | 2             | 23           |
| + I2b a thin neck part is a column   | 85 / 87 / 7                  | 8                 | 3             | 23           |
| (all five, as on the branch)         | 83 / 85 / 6                  | 8                 | 3             | 22           |

Kept: I1 and I5a. Dropped: I2 (thin boxes at their own scale), I4 (a seam
between two pads' colours) and I2b (a thin neck part as a column) — each cost
the panorama recall or precision, or 201654 a merged box, more than the one
merged box it saved. Result on the editor's own pixels: TOTAL F1 93.5,
precision 96%, merged 23, walls passing 2/8 (201707, 201713).
