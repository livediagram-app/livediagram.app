# Experiments, group B2: separation, round 2

Telling touching notes apart, second round, for the bar of
[plans/event-storming-photo-95.md](../../../plans/event-storming-photo-95.md):
no box may hold two labelled notes. Plan:
[plans/event-storming-photo-95-experiments.md](../../../plans/event-storming-photo-95-experiments.md)
(B2). Round 1 is [b-separation.md](b-separation.md). The judge is the sweep
over the eight labelled walls (`packages/sticky-vision/scripts/calibrate.ts`);
`scripts/merged.ts` says what each merged box is, and three tools were added
for this round:

- `scripts/trace.ts [photo] [x,y …]`: the blob under a point (or under each
  merged box), and what the splitter, the notch cut and the seam cut make of
  it, in notes, with the seam each piece shows.
- `scripts/seam-cuts.ts`: every seam the seam cut would find, judged against
  the labels (between two notes, or across one).
- `scripts/region.ts <photo> x y w h`: the raw and closed class masks of a
  region, as text.

Every table gives, per wall, **F1 / recall without actors / merged boxes**.

## Two configurations: the seam cut is switched off on the branch

The shadow-seam cut of round 1 (B3, `seam.ts`) reads the photograph's
brightness, and `fitBoxes` only runs it when `detect.ts` hands it
`luminance: luminanceOf(working)`. That line is not in `detect.ts` (group F
owns it), so **on the branch the seam cut does nothing**. Every experiment
here is therefore measured twice:

- **A**: the branch as it is.
- **L**: the same code with that one line added to `detect.ts` (applied only
  in a scratch copy under `/tmp`, never committed).

A change is kept when it helps in L without costing A (or the reverse), under
the usual rule: TOTAL up or merged down, no wall losing more than one note,
guard tests green, and a plateau around the chosen value.

## Where it started

Commit `7221bf26`.

| wall             | A: F1 / rec-A / merged | L: F1 / rec-A / merged |
| ---------------- | ---------------------- | ---------------------- |
| 201646           | 81 / 90 / 2            | 81 / 90 / 2            |
| 201654           | 97 / 98 / 3            | 97 / 98 / 3            |
| 201707           | 93 / 93 / 2            | 93 / 95 / 1            |
| 201713           | 97 / 96 / 0            | 95 / 93 / 0            |
| 201730 (shade)   | 92 / 90 / 2            | 92 / 90 / 1            |
| 201743 (night)   | 58 / 51 / 1            | 57 / 51 / 1            |
| wall-panorama    | 77 / 62 / 9            | 77 / 62 / 9            |
| whiteboard-dense | 92 / 88 / 10           | 93 / 89 / 8            |
| **TOTAL**        | **88.7 / 29**          | **88.5 / 25**          |

A passes 201713 only. In L the seam cut takes four merged boxes apart but
cuts two single notes on 201713 in half, so L is not adoptable as it stands.

What the merged boxes are (A): 13 inseparable (overlapping labels, for the
operator), 4 cross-colour, 12 same-colour. The same-colour ones, traced:

- **Flush same-colour notes with no gap in the mask.** 201707's sprawl of
  orange notes and the whiteboard's grid of orange events are one solid
  region in the RAW mask (`region.ts`): not one pixel of not-paper between
  the notes. Only the brightness shows the seam, so only the seam cut (L)
  can find it, and the splitter's even grid lands where it lands.
- **Small actors on the panorama.** The actor pad there is 19 px against a
  wall note of 34 px. Pairs of actors are 0.7–1.5 wall notes long, which no
  rule sized by the wall's note cuts, and the gap between two of them is a
  broken line of dark pixels that the colour mask calls yellow.
- **Heavily lapped pairs** (201654, 201730) where the lower note shows about
  half of itself.

## R1: a seam needs a box two notes can fill (kept)

**Finding.** `scripts/seam-cuts.ts` on the seam cut's input: of 73 seams
found, 66 cross a SINGLE labelled note (a crease, the curl of the unstuck
edge, a line of writing: horizontal, mostly), and 7 lie between two. Depth,
the share of ink along the line, how much of the line dips, how the seam
stands above its neighbours and the brightness either side of it all
overlap between the two. What separates them is the box: the single notes'
seams sit in boxes 1.05–1.25 notes long across the seam; the separable
pairs' seams in boxes 1.32–1.74 long.

**Rule.** `findSeam` looks only across a box at least `SEAM_MIN_SPAN` = 1.3
notes long in that direction.

| SEAM_MIN_SPAN | 1.1  | 1.2  | 1.25 | 1.3  | 1.35 | 1.4  | 1.5  |
| ------------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| L: TOTAL      | 88.5 | 88.5 | 88.7 | 88.8 | 88.8 | 88.9 | 88.9 |
| L: merged     | 25   | 25   | 25   | 25   | 26   | 26   | 26   |

A is unchanged at every value (the seam cut is off). At 1.3:

| wall             | L: F1 / rec-A / merged |
| ---------------- | ---------------------- |
| 201646           | 81 / 90 / 2            |
| 201654           | 97 / 98 / 3            |
| 201707           | 93 / 95 / 1            |
| 201713           | 97 / 96 / 0            |
| 201730 (shade)   | 92 / 90 / 1            |
| 201743 (night)   | 57 / 51 / 1            |
| wall-panorama    | 77 / 62 / 9            |
| whiteboard-dense | 93 / 89 / 8            |
| **TOTAL**        | **88.8 / 25**          |

**Verdict: kept.** With it, handing the seam cut its luminance costs no wall
anything and takes merged 29 → 25 (TOTAL 88.7 → 88.8): the `detect.ts` line
is now safe to add (see Open questions).

## Open questions

- **`detect.ts` (group F): hand the seam cut its luminance.** One import and
  one option: `luminance: luminanceOf(working)` in the `fitBoxes` call. Worth
  merged 29 → 25 on its own after R1, and every later seam experiment here
  depends on it.

## R2: part a sprawl at its necks before the grid (kept)

**Hypothesis.** A sprawling blob of one colour is often a checkerboard: notes
of this colour stuck in a grid with another kind between them, touching only
at a corner or along a sliver where one is crooked. The wall's note size
lays an even grid over such a blob that cuts through notes. The joins are far
thinner than a note, so an erosion a fraction of a note deep leaves one core
per note, and each pixel goes back to the core nearest it along the paper.

**Built.** `necks.ts`: erode the blob's own paper by `NECK_ERODE_FRACTION` =
0.15 note, keep cores of at least (0.25 note)², grow them back by
breadth-first search over the paper. `splitOversized` tries it on blobs of
at least `NECK_MIN_AREA` = 2 note areas, before the grid.

**First measurement: every part taken (rejected).** Merged 29 → 37 (A),
TOTAL 88.7 → 87.3. On the panorama the parts were columns of two small
actors (0.9 wall notes tall, which the grid leaves whole), and on the
whiteboard the parts' own grids fell out of step with the notes. The necks
parted groups, not notes.

**Rule.** The parts are taken only when every one is a note: at most
`NECK_MAX_PIECE` = 1.4 notes long. Otherwise the blob goes to the grid whole.

| NECK_MAX_PIECE | 1.2       | 1.3       | 1.4       | 1.5–1.7   | 2.0       | 2.5       |
| -------------- | --------- | --------- | --------- | --------- | --------- | --------- |
| A: TOTAL / m   | 88.7 / 29 | 88.8 / 29 | 88.9 / 29 | 88.8 / 28 | 88.9 / 28 | 88.8 / 29 |
| L: TOTAL / m   | 88.8 / 25 | 88.9 / 25 | 89.0 / 25 | 88.9 / 24 | 89.0 / 24 | 88.9 / 25 |

From 1.5 up one merged box goes, but only because two merged boxes on the
panorama become one box holding three actors, and 201707 loses a wide note
(rec-A 93 → 90). 1.3–1.4 find three notes and lose none. With 1.4, the
other settings: erosion 0.12–0.2 and core 0.15–0.35 score the same (0.1:
88.7 / 89.0); area 1.5–3 the same (1: 88.7, 4: 88.7).

| wall             | A: F1 / rec-A / merged | L: F1 / rec-A / merged |
| ---------------- | ---------------------- | ---------------------- |
| 201646           | 81 / 90 / 2            | 81 / 90 / 2            |
| 201654           | 98 / 98 / 3            | 98 / 98 / 3            |
| 201707           | 94 / 93 / 2            | 94 / 95 / 1            |
| 201713           | 97 / 96 / 0            | 97 / 96 / 0            |
| 201730 (shade)   | 92 / 90 / 2            | 92 / 90 / 1            |
| 201743 (night)   | 58 / 51 / 1            | 57 / 51 / 1            |
| wall-panorama    | 78 / 64 / 9            | 78 / 64 / 9            |
| whiteboard-dense | 92 / 88 / 10           | 93 / 89 / 8            |
| **TOTAL**        | **88.9 / 29**          | **89.0 / 25**          |

What moved: a spurious box gone on 201654 and on 201707 each, one more
panorama note found. About 40 ms more per photo.

**Verdict: kept**, for a small, clean gain. It does not touch the merged
count: those merges are pairs a neck cannot see (flush, or at a smaller
pad's scale).

## R3: trim the fringe a note trails along its neighbour (kept)

**Finding.** Two of the four cross-colour boxes (201646 #1, panorama #1)
were a note whose box ran down the side of a neighbour of another kind. The
raw mask (`region.ts`) shows why: along the edge of a yellow actor lapped
over an orange event, the JPEG blend of yellow and wall reads as orange, a
line of orange one pixel wide running the actor's whole length. The close
joins it to the orange note, and the orange box grows over the actor.

**Rule.** The necks' cores (R2) grow back only `NECK_REGROW` = 2 erosions
far, square by square (8-connected, so the growth matches the square
erosion). Paper further than that from every core is a strip thinner than
a note's edge trailing off it, and is dropped; a blob with one core comes
back trimmed. Applied from `NECK_MIN_AREA` = 1.5 note areas (lowered from 2,
which is above a note with a fringe down one side).

| area \ regrow | 1.75      | 2         | 2.25      | 2.5       |
| ------------- | --------- | --------- | --------- | --------- |
| 1.25          | 88.7 / 26 | 88.9 / 26 | 88.9 / 27 |           |
| 1.5           | 88.7 / 26 | 88.9 / 26 | 88.9 / 27 | 89.0 / 28 |
| 1.75          | 88.8 / 26 | 88.8 / 26 | 88.8 / 27 |           |
| 2 (R2's)      |           | 88.9 / 28 | 88.9 / 28 | 89.0 / 29 |

(A: TOTAL / merged.) Regrowing only once (an exact opening) takes merged to
26 but shaves the panorama's small actors below the size floor (recall 66
→ 60). Regrowth unlimited is R2.

| wall             | A: F1 / rec-A / merged | L: F1 / rec-A / merged |
| ---------------- | ---------------------- | ---------------------- |
| 201646           | 82 / 93 / 1            | 82 / 93 / 1            |
| 201654           | 98 / 98 / 3            | 98 / 98 / 3            |
| 201707           | 94 / 93 / 2            | 94 / 95 / 1            |
| 201713           | 97 / 96 / 0            | 97 / 96 / 0            |
| 201730 (shade)   | 93 / 92 / 2            | 93 / 92 / 2            |
| 201743 (night)   | 57 / 51 / 1            | 57 / 51 / 1            |
| wall-panorama    | 77 / 64 / 7            | 77 / 64 / 7            |
| whiteboard-dense | 92 / 88 / 10           | 93 / 89 / 8            |
| **TOTAL**        | **88.9 / 26**          | **89.1 / 23**          |

What moved (A): cross-colour 4 → 2, one inseparable pair on the panorama
parted, 201646 and 201730 each find one more note; 201743 and the panorama
each gain one spurious box, and the panorama loses one small actor. In L,
201730's lapped pair (which the seam cut parted) is merged again: the
lower note shows a strip 12 px deep below the upper one, the trim takes it
for a fringe, and the box left (1.08 × 1.19 notes) is too short for
`SEAM_MIN_SPAN` while still holding both centres.

**Verdict: kept.** Merged 29 → 26 on the branch, 25 → 23 with luminance,
TOTAL level.
