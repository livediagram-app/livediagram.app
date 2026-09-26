# Experiments, group B: separation

Telling touching notes apart, for the bar of
plans/0007-event-storming-photo-95.md:
no box may hold two labelled notes. Plan:
plans/0006-event-storming-photo-95-experiments.md
(B1–B5). The judge is the sweep over the eight labelled walls
(`packages/sticky-vision/scripts/calibrate.ts`); `scripts/merged.ts` says
what each merged box is and why it is merged.

Every table gives, per wall, **F1 / recall without actors / merged boxes**.

## Where it started, and what was wrong

Baseline `a02e321c`: TOTAL F1 83.7%, merged 40, 0/8 walls pass.

| wall             | F1  | rec-A | merged |
| ---------------- | --- | ----- | ------ |
| 201646           | 80  | 90    | 4      |
| 201654           | 94  | 94    | 4      |
| 201707           | 81  | 83    | 2      |
| 201713           | 92  | 94    | 0      |
| 201730 (shade)   | 88  | 88    | 2      |
| 201743 (night)   | 42  | 54    | 1      |
| wall-panorama    | 72  | 62    | 10     |
| whiteboard-dense | 91  | 86    | 17     |

What the 40 merged boxes were, before anything changed:

- **25 of 62 fragment merges joined two labelled notes.** `mergeFragments`
  glued any two same-colour pieces a pen stroke apart whose union was solid:
  two narrow actors side by side, or two notes with a hairline gap, make a
  solid square exactly one note in size, which no length rule then cuts.
- **Most pairs are 1.3–1.6 notes long**, under the splitter's 1.8 cut ratio,
  and the close (radius ≈ 4% of a note) has filled the seam in the mask.
- **About 12 cannot be separated at all against the current labels.** Ten
  label pairs in the truth are nearly coincident (centres less than half the
  smaller label's side apart): two exact duplicates on the whiteboard, a
  pair of actors boxed both as a pair and one by one on 201646, and several
  notes lapped more than half over another. Any note-sized box around one of
  them holds the other's centre.

## Merge gate: never merge two whole notes (kept)

**Hypothesis.** A fragment that handwriting or a shadow cuts from a note is
less than half a note thick; a piece at least that thick is a whole note, and
two whole notes are never one.

**Rule.** `mergeFragments` refuses a union when both sides are at least
`WHOLE_NOTE_SIDE` = 0.45 of the note thick. Plateau: 0.40–0.50 score the
same; 0.55 lets one pair back in.

| wall             | F1       | rec-A | merged |
| ---------------- | -------- | ----- | ------ |
| 201646           | 80       | 90    | 3      |
| 201654           | 96       | 96    | 3      |
| 201707           | 81       | 83    | 2      |
| 201713           | 92       | 96    | 0      |
| 201730 (shade)   | 90       | 88    | 2      |
| 201743 (night)   | 42       | 54    | 1      |
| wall-panorama    | 74       | 62    | 9      |
| whiteboard-dense | 91       | 86    | 17     |
| **TOTAL**        | **84.3** |       | **37** |

**Verdict: kept.** Judging each piece against its colour's own measured
size (smaller for a pad of actors) was measured too and moves nothing: the
panorama's actor pairs are welded into one component before the merge. It
went in with the trim commit by mistake and came out again in the next
commit, since a neutral change is not kept.

## B1: outlines and notches (kept, as a tool)

**Hypothesis.** Two lapped notes leave an outline that turns inwards on both
sides of the seam, which a convex hull shows as two defects.

**Built.** `contour.ts`: Moore-neighbour border tracing (the outer-border
half of Suzuki–Abe), closed RDP simplification, largest region, and
convexity defects.

**Measured** on the closed mask, per detection (two or more notches at a
given depth, as a fraction of the note):

| depth | merged boxes with ≥ 2 notches | single notes with ≥ 2 notches |
| ----- | ----------------------------- | ----------------------------- |
| 0.08  | 12 / 40                       | 63 / 507                      |
| 0.12  | 9 / 40                        | 21 / 507                      |
| 0.16  | 6 / 40                        | 9 / 507                       |

**Verdict.** Notches are rare in merged boxes, because the close fills the
seam in the outline, and not rare enough in single notes to cut on alone.
Notches can be a cut's evidence (B2) but not the whole answer.

## B2: cut along the chord between two notches (kept)

**Rule.** A piece the splitter leaves whole is cut along the chord between
its two deepest notches (≥ 0.12 note deep, chord ≤ 1.3 notes) when both
sides are note-sized (≥ 0.5 note thick, ≥ 0.35 of a note's area), and the
pieces are cut again the same way. A cut stands only if every piece is paper
and solid (`MIN_SOLID_FILL`). Without the solidity bar, 201646 gained two
spurious boxes. Plateau: depth 0.08–0.22, chord ≥ 1.3, side 0.4–0.7, fill
0.5–0.55.

| wall             | F1       | rec-A | merged |
| ---------------- | -------- | ----- | ------ |
| 201646           | 79       | 90    | 2      |
| 201654           | 96       | 96    | 3      |
| 201707           | 81       | 83    | 2      |
| 201713           | 92       | 96    | 0      |
| 201730 (shade)   | 90       | 88    | 2      |
| 201743 (night)   | 42       | 54    | 1      |
| wall-panorama    | 74       | 62    | 9      |
| whiteboard-dense | 93       | 88    | 15     |
| **TOTAL**        | **84.8** |       | **34** |

**Verdict: kept.** 201646 pays for its merge fix with one spurious box (one
note's worth).

## B3: score a cut by the seam's shadow (kept; needs one line in detect.ts)

**Hypothesis.** Flush notes have no notch, but the photograph shows the
upper note's edge and its shadow: a line a little darker than the paper on
both sides, the whole way across. Handwriting is darker still and never
spans the note.

**First probe (rejected metric).** The fraction of pixels along the best
straight line with a max-minus-min valley of 12 levels did not separate
merged (p50 0.66) from single notes (p50 0.69): JPEG noise and ink both pass
it. **Second probe:** mean-based valley, ink (60 levels under the paper)
skipped, MEDIAN along the line. Merged p50 5.6, singles p50 5.7, still
overlapping. On inspection, high-scoring "single" boxes really do contain a
seam: they spill into a neighbour whose centre happens to lie outside them.
So the question is not whether there is a seam, but whether a cut there
leaves a note on each side.

**Rule.** `seam.ts`: the deepest median valley along any line, upright or
leaning up to 8%, at least 0.55 note from either side and at least 12 levels
deep. `cutAtSeam` cuts there, tightens each side onto its paper and recurses.
Applied after B2 with the same paper-and-solid bar. About 20 ms per photo.
Plateau: depth 8–24, piece 0.5–0.7.

| wall             | F1       | rec-A | merged |
| ---------------- | -------- | ----- | ------ |
| 201646           | 79       | 90    | 2      |
| 201654           | 96       | 96    | 3      |
| 201707           | 82       | 85    | 1      |
| 201713           | 92       | 96    | 0      |
| 201730 (shade)   | 89       | 88    | 2      |
| 201743 (night)   | 42       | 54    | 1      |
| wall-panorama    | 73       | 62    | 9      |
| whiteboard-dense | 93       | 89    | 14     |
| **TOTAL**        | **84.8** |       | **32** |

**Verdict: kept**, and it needs `detect.ts` (group D) to hand
`luminanceOf(working)` to `fitBoxes`. That line is not on this branch.
Without it the seam cut does nothing.

## Cut pieces: a lower floor, and slivers trimmed (kept)

**Finding.** 29 missed notes are boxed correctly by the merge and then lost
inside `fitBoxes`, most to the size floor (short side < 0.7 of the note).
Only 4 are dropped by `standsOut`. At the seam of a lapped pair, the note
underneath often shows less than 0.7 of itself.

**Rule.** A notch or seam cut stands when each side is at least
`CUT_PIECE_SIZE_RATIO` = 0.6 of a note thick. A side between 0.6 and 0.7 is
a sliver of the note underneath: it is dropped with the other non-notes, so
the note on top gets its own box instead of one that also holds its
neighbour. Keeping the slivers as notes was measured and is worse (84.5,
merged 30). 0.55 costs the whiteboard four notes. Plateau: 0.575–0.65 score
84.8–85.0.

| wall             | F1       | rec-A | merged |
| ---------------- | -------- | ----- | ------ |
| 201646           | 79       | 90    | 2      |
| 201654           | 96       | 96    | 3      |
| 201707           | 85       | 88    | 0      |
| 201713           | 92       | 96    | 0      |
| 201730 (shade)   | 89       | 88    | 2      |
| 201743 (night)   | 42       | 54    | 1      |
| wall-panorama    | 73       | 62    | 9      |
| whiteboard-dense | 93       | 89    | 12     |
| **TOTAL**        | **85.0** |       | **29** |

(With B3 in place. Without the `detect.ts` line: TOTAL 84.9, merged 32.)

**Verdict: kept.**

## B4: black top-hat seam carving (rejected)

**Hypothesis.** A seam that is not straight (a crooked edge, a note stuck
on at an angle) is found pixel by pixel: a 1×k black top-hat marks pixels
darker than the brightest paper within 3 px on both sides. Carving those out
of the box's paper and relabelling separates notes along a seam of any
shape.

After B3, carving each piece (depth 12):

| wall             | F1       | rec-A | merged |
| ---------------- | -------- | ----- | ------ |
| 201646           | 78       | 90    | 2      |
| 201654           | 96       | 96    | 3      |
| 201707           | 82       | 85    | 1      |
| 201713           | 92       | 96    | 0      |
| 201730 (shade)   | 89       | 88    | 2      |
| 201743 (night)   | 42       | 54    | 1      |
| wall-panorama    | 76       | 62    | 10     |
| whiteboard-dense | 93       | 89    | 14     |
| **TOTAL**        | **85.0** |       | **33** |

It touches three boxes: two panorama actors found, one merged box more, one
spurious box on 201646. Depths 12–30, reach 2–4 and piece area 0.25–0.35
give exactly this result. Carving large blobs (≥ 2 note areas) BEFORE the
splitter is worse: TOTAL 84.4, merged 45 (whiteboard 14 → 21).

**Verdict: rejected.** Merged rises, and it adds nothing B3 does not
already do.

## B5: note-size-seeded, ink-masked compact watershed (rejected)

**Rule.** k = round(area ÷ note²) seeds, placed by k-means over the blob's
pixels (farthest-point start). Flood by Sobel steepness, flattened next to
ink, plus 80 per note travelled from the seed.

| variant                           | TOTAL | merged | notes                                                                    |
| --------------------------------- | ----- | ------ | ------------------------------------------------------------------------ |
| B2+B3 (reference)                 | 84.8  | 32     |                                                                          |
| watershed instead of B2+B3        | 84.5  | 34     | 201707 81 → 79                                                           |
| watershed after B2+B3             | 84.5  | 32     |                                                                          |
| watershed instead of the splitter | 83.1  | 49     | 201646 82 and 201654 98 (up), 201707 77, 201730 83, whiteboard merged 20 |

Compactness 20–200 and note area 1.15–1.5 never beat the reference. As a
whole replacement, compactness 200 gives 83.1 / 48, and a larger note area
is steeply worse (1.5: 71.1 / 101).

**Verdict: rejected.** Seeding by area cannot tell a note photographed near
from two notes, which is the question the splitter's dead band exists for.

## Also measured, and rejected

- **Split each colour by its own note size.** Panorama merged 9 → 3, but its
  precision falls from 84% to 56%: yellow is both the big notes and the small
  actors, and the big ones are cut into actor-sized cells. TOTAL 82.4. Using
  the colour's size only for blobs about one of its notes thick (tolerance
  0.1–0.6) still costs the panorama 11 points of precision for one merge
  fixed (TOTAL 84.3–84.4).
- **The size floor (`MIN_PAPER_SIZE_RATIO`) lower**, for group C: at 0.6,
  recall without actors reaches 93 / 98 / 95 / 98 on 201646 / 201654 /
  201707 / 201713, but precision falls from 86% to 81% (TOTAL 83.9). With a
  junk gate that holds precision, this is where recall is.

## Where the rest are (after the kept changes)

The 29 merged boxes by cause (`scripts/merged.ts`):

- **17 inseparable**: one held label's centre lies inside another held
  label's rectangle (201646 1, 201654 2, 201730 1, 201743 1, panorama 2,
  whiteboard 10). Duplicate and nested labels account for most of them;
  the truth needs cleaning before zero merged boxes is reachable.
- **4 cross-colour**: one note's box covers a neighbour of another colour
  (a diagonal chain of yellow actors through a checkerboard of pink, an
  orange note behind an actor).
- **8 same-colour**: four panorama actor pairs in a welded 2-D cluster of
  small yellow notes; two heavily lapped pairs whose lower note shows a
  quarter of itself (201654, 201730); two tiny whiteboard pairs.

Missed notes: 45 sit inside a larger merged blob the splitter did not take
apart (sprawls like 201707's 302×213 component of many notes, cut on an even
grid). 29 are boxed after the merge and lost to the size floor. 6 have no
paper blob at all. 4 are dropped by `standsOut`.
