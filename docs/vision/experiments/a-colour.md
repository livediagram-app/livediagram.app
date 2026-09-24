# Experiments, group A: colour and light

Part of [the experiment plan](../../../plans/event-storming-photo-95-experiments.md)
towards [the bar](../../../plans/event-storming-photo-95.md). Owned files:
`classify.ts`, `floors.ts`, `colour.ts`, and the new `lab.ts`, `surface.ts`,
`histogram.ts`. Every number is from `scripts/calibrate.ts` (or
`scripts/colour-sweep.ts`, which reproduces its summary exactly) on the eight
labelled walls, 647 notes.

**Result:** TOTAL F1 83.7% → **85.1%**, merged boxes 40 → 41, walls passing
0/8 → **1/8** (201713). Two rules kept (A2, A6); A3, A4 and A5 rejected with
their numbers below.

| wall             | F1 before | F1 after | rec-A before | rec-A after | merged before | merged after |
| ---------------- | --------- | -------- | ------------ | ----------- | ------------- | ------------ |
| 201646           | 80        | 80       | 90           | 93          | 4             | 5            |
| 201654           | 94        | 95       | 94           | 96          | 4             | 4            |
| 201707           | 81        | 87       | 83           | 90          | 2             | 2            |
| 201713           | 92        | **97**   | 94           | 96          | 0             | 0 (PASS)     |
| 201730 (shade)   | 88        | 90       | 88           | 90          | 2             | 2            |
| 201743 (night)   | 42        | 43       | 54           | 51          | 1             | 1            |
| wall-panorama    | 72        | 72       | 62           | 62          | 10            | 10           |
| whiteboard-dense | 91        | 91       | 86           | 86          | 17            | 17           |
| **TOTAL**        | **83.7**  | **85.1** |              |             | **40**        | **41**       |

## First, what colour can win at all

`scripts/colour-misses.ts` asks of every missed note whether its paper is
classified as paper (then the loss is in the boxes) or as wall (then it is the
classifier's). At baseline, of 117 misses:

| wall             | missed | colour | shape |
| ---------------- | ------ | ------ | ----- |
| 201646           | 8      | 1      | 7     |
| 201654           | 5      | 0      | 5     |
| 201707           | 7      | 0      | 7     |
| 201713           | 3      | 1      | 2     |
| 201730 (shade)   | 7      | 0      | 7     |
| 201743 (night)   | 20     | 1      | 19    |
| wall-panorama    | 31     | 7      | 24    |
| whiteboard-dense | 36     | 2      | 34    |

Only **12 of 117** misses are colour misses: seven pale pink notes on the
panorama, two pale aggregates on the whiteboard, a pale green, two pinks. The
shade and the night walls lose NO note to colour; their paper is in the mask
and is lost to merging, splitting and the note-size estimate. What colour can
win is mostly precision: wall and room read as paper, which becomes junk boxes
and welds notes together.

## A1: CIELAB conversion (kept, infrastructure)

**Hypothesis:** the later experiments need a perceptual colour space, fast.

`lab.ts`: sRGB (D65) to CIELAB per pixel (`rgbToLab`, and the non-allocating
`rgbToLabInto`) and per image (`labImageOf`, three `Float32Array` planes, a
256-entry linearisation table), plus CIE76 `deltaE`. Tested against published
reference values; a 1000×750 image converts well inside 150 ms. No detector
change, so no table. Commit `d8054bc3`.

## A2: paper by CIELAB distance from the local wall (kept, as a narrower rule)

**Hypothesis:** judging paper by its CIELAB distance from the local wall,
rather than by HSV saturation floors, finds pale paper on white and on kraft
and rejects wall that HSV lets in.

Each floor tile now also measures the wall's a*b*. Many ways of using it were
measured (TOTAL F1 / merged, baseline 83.7 / 40):

| variant                                                              | settings → TOTAL / merged                                                                                     | verdict                                                                                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Lab replaces HSV (Δab ≥ T)                                           | 10: 84.2/53 · 12: 81.7/52 · 14: 84.3/50 · 16: 85.6/49 · 17: 86.2/49 · 18: 85.9/43 · 20: 85.6/47 · 22: 84.0/45 | Kraft walls gain a lot; the whiteboard loses 12 notes at 18 (pale aggregates sit at Δab 12–17) and 201713 loses 4. No single T serves both. |
| Lab OR HSV                                                           | 14: 83.2/41 · 20: 83.6/42                                                                                     | Brings HSV's kraft leak back. Rejected.                                                                                                     |
| Per-tile Otsu over Δab, clamped                                      | 10–18: 85.3/49 · 12–20: 83.6/44 · 8–18: 84.8/48                                                               | No better than fixed, more complex. Rejected.                                                                                               |
| Discount desaturation towards grey                                   | 12–18: 72–85                                                                                                  | The shadow-is-grey hypothesis was wrong; it loses the blue notes, which on kraft lie beyond neutral. Rejected.                              |
| Discount extra chroma along the wall's hue (ellipse)                 | 0.4–0.8 × 10–16: 65–86.2, merged 46–52                                                                        | Rejected.                                                                                                                                   |
| Lab near the wall hue only, HSV off it                               | 8: 81.6/55 · 12: 83.5/47 · 14: 84.7/45 · 18: 85.3/44                                                          | Rejected.                                                                                                                                   |
| Lab on chromatic walls, HSV on neutral ones                          | best 87.0/42 (T 18, cut 6); neighbours 84.2–86.7, merged 42–47                                                | 201713 −4 notes at the best point; a frame's wall chroma cannot tell the panorama (7.1) from kraft (4.2–8.6). Rejected.                     |
| Tiles whose wall is "foreign" defer to the frame                     | 20: 70.9 · 30: 82.1                                                                                           | Dense note tiles read as foreign. Rejected.                                                                                                 |
| **HSV AND, at the wall's hue, Δab ≥ T** (wall = histogram peak)      | 6: 86.1/41 · 7: 84.9/42 · 8: 84.5/43 · 10: 85.1/44                                                            | Promising, but broke two guard tests: a cell mostly covered by one note has that note as its peak. Replaced by the dull-pixel mean below.   |
| **HSV AND, at the wall's hue, Δab ≥ T** (wall = mean of dull pixels) | 4: 83.5/40 · 5: 83.3/42 · 6: 84.7/42 · **7: 85.0/41** · 8: 80.5/42 · 9: 83.9/42 · 10: 83.8/43 · 12: 80.1/45   | **Kept, T = 7.**                                                                                                                            |

The kept rule, and why it is on a plateau despite the dips at 8 and 12. Per
wall, T from 6 to 12 lifts the five kraft walls every time (201646 80→80–82,
201654 94→95, 201707 81→85–90, 201713 92→95–97, 201730 88→90–91); the
panorama and whiteboard do not move; the dips are the NIGHT wall alone, whose
F1 swings 20–43. That swing is the baseline's, not the rule's: moving the
neighbouring constant `OFF_HUE_MIN_SATURATION` by 0.01 on the UNCHANGED
detector swings the TOTAL 82.8–84.1 (night 35–42), while with the rule at 7 it
holds at 85.4 on both sides. On the night photo the room beyond the wall (a
dark window, furniture) fragments into small blobs that drag the note-size
estimate down, and notes are then sawn against too small a size.

Mechanism, seen in the class masks: on kraft, HSV saturation climbs as the
wall falls into shade, so folds, the fall-off of a lamp and the edge under a
curling sheet clear the saturation floor and read as orange paper. In a*b*
they are 2–6 units from the wall; orange paper is 30–40. The kraft walls'
spurious boxes fall by two thirds (201707 9 → 1, 201713 6 → 1).

Commits `f1f26091` (the rule), `17186992` (floors.ts split into
`surface.ts` and `histogram.ts`, no behaviour change).

**Pale on white, the named target, is not solved by colour alone.** A last
variant rescued pixels HSV rejects at the wall's hue when they sit across the
wall's hue in a*b* (tangential distance ≥ T, walls with a hue direction only):

| T        | 7         | 8         | 9         | 10        | 11        | 12        | 14        |
| -------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- |
| TOTAL    | 85.6 / 45 | 85.3 / 41 | 85.3 / 40 | 85.8 / 41 | 85.0 / 45 | 85.0 / 42 | 85.0 / 42 |
| panorama | 57 found  | 54        | 55        | 57        | 52        | 52        | 52        |

It finds the panorama's pale pink notes (up to five), a pink hotspot on 201646
and one on the night wall. But those notes sit only 10–11 a*b* units across the
wall's hue: at 11 every one is lost again, and below 10 they come back in
part, as half-note boxes that count as junk (panorama precision 85 → 80%). A
cliff one unit above the best value on eight photographs is overfitting.
Rejected. The whiteboard's pale aggregates (Δab 12–17 from a white wall) are
likewise at the limit of a per-pixel test.

## A3: wall-referenced luminance division (rejected)

**Hypothesis:** dividing every pixel by the local wall brightness (the median
value of each cell's too-dull-to-be-paper pixels, blended bilinearly) before
detection evens out the shade on 201730 and the night photo 201743.

Worth saying first: HSV hue and saturation are unchanged by scaling a pixel,
and the value floor is already relative to each cell's wall, so for the HSV
half this only changes the grid. And the diagnosis shows neither target wall
loses a note to colour. Measured anyway (a local, uncommitted hook in
`detect.ts`):

| variant                                 | TOTAL / merged | 201730 (shade) F1 | 201743 (night) F1 |
| --------------------------------------- | -------------- | ----------------- | ----------------- |
| current                                 | 85.0 / 41      | 90                | 43                |
| 8 cells, gain ≤ 3                       | 76.0 / 43      | 88                | 9 (158 boxes)     |
| same, standout on original              | 75.9 / 43      | 88                | 9                 |
| 12 cells                                | 79.9 / 42      | 87                | 22                |
| 16 cells                                | 77.9 / 45      | 88                | 12                |
| gain ≤ 1.5                              | 77.2 / 43      |                   |                   |
| gain ≤ 1.25                             | 82.3 / 44      | 85                | 34                |
| brighten towards the lit wall only, ≤ 2 | 77.5 / 38      |                   |                   |

Monotonic: the less flattening, the better. Brightening the dark room into the
frame's range turns it into a field of junk. **Rejected.**

## A4: CLAHE on L* (rejected)

**Hypothesis:** contrast-limited adaptive histogram equalisation of L*, a*b*
untouched, recovers notes in shade and at night without A3's side effects.
Round trip Lab → sRGB is exact with the enhancement blended out.

| variant                    | TOTAL / merged |
| -------------------------- | -------------- |
| clip 2, 8 tiles            | 83.0 / 43      |
| same, standout on original | 83.0 / 43      |
| clip 1.5, blend 0.5        | 84.1 / 44      |
| clip 3, blend 0.5          | 84.1 / 46      |
| clip 2, 4 tiles            | 76.7 / 42      |
| clip 1.2, blend 0.3        | 84.5 / 42      |

Every setting is below the current 85.0, and the mildest converges on it
(shade 90 = 90, night 42 vs 43). **Rejected.**

## A5: a per-photo a*b* palette (rejected)

**Hypothesis:** kinds learnt from the photograph (peaks of the paper pixels'
a*b* histogram, each named by the HSV kinds voting inside it) give a note one
consistent kind, so it no longer fragments into per-class components.

Ceiling first: only 24 of 647 notes have their paper split between kinds
(< 85% one kind), and 11 of those are among the misses. Measured (local hook):

| variant                                  | TOTAL / merged     |
| ---------------------------------------- | ------------------ |
| every paper pixel to its nearest peak    | 83.4 / 40          |
| … only within 15 a*b*                    | 84.3 / 41          |
| … only within 8                          | 84.5 / 42          |
| peaks need ≥ 3% of paper                 | 82.1 / 41          |
| wider peak suppression                   | 81.3 / 48          |
| only pixels within 4° of a hue-band edge | 85.0 / 43          |
| … 6° / 8° / 12°                          | 84.3 / 84.1 / 84.0 |

A kind too rare to make its own peak (the whiteboard's pale aggregates) is
swallowed by its neighbour's, and two touching notes of different kinds that
become one class weld. At best it ties, with more merged boxes. **Rejected.**

## A6: specular glare (kept, as "blown out")

**Hypothesis:** glare pixels excluded from the floors stop inflating the
wall's brightness on the whiteboard.

Measured first: clipped glare (v ≥ 0.96, s ≤ 0.06) is 0.0–0.3% of any frame,
and no missed note holds any. A looser "bright and colourless" mask
(v ≥ 0.85, s ≤ 0.10) covers 7.5% of the whiteboard, and the 8 missed
whiteboard notes it touches are pale PAPER, which no pixel rule can tell from
sheen:

| glare excluded from the floors        | TOTAL / merged |
| ------------------------------------- | -------------- |
| v ≥ 0.99 / 0.97 / 0.95, s ≤ 0.08      | 85.1 / 41      |
| v ≥ 0.92 / 0.88                       | 84.9 / 41      |
| v ≥ 0.85                              | 85.0 / 44      |
| v ≥ 0.85, s ≤ 0.12                    | 83.7 / 46      |
| every channel ≥ 240 / 245 / 250 / 253 | 85.1 / 41      |
| every channel = 255                   | 85.0 / 41      |

Kept as the principled form: a pixel with every channel ≥ 250 is clipped and
carries no colour, so it is left out of every cell's measurement. The gain is
one junk box on the night wall (its ceiling lamp stops dragging its cells'
floors). The looser form is rejected: it masks pale paper. "Bright and
colourless at v ≥ 0.97" was also rejected because it would erase a white
wall's own evidence (the whiteboard test fixture is v 0.976, s 0.036). Commit
`2de309cf`.

## What colour cannot fix, and what to try next

- **The misses are boxes, not colour.** 105 of 117 misses have their paper in
  the mask. The merged boxes, the sawn notes and the note-size estimate are
  group B's and D's ground.
- **The night wall is unstable at baseline.** Its room (window, furniture)
  fragments into many small blobs that drag the note-size estimate, so any
  small change to the mask swings it by ±10 F1. Next: measure the note size
  only from blobs that stand out from the wall, or restrict detection to the
  WALL REGION (the frame's largest connected wall-coloured surface, plus a
  margin), which would also take the panorama's cream strip and 201646's
  cardboard.
- **Pale paper on white needs a region-level decision.** Per pixel, the pale
  pink and pale yellow notes sit 10–17 a*b* units from a white wall, at the
  noise limit. A region's MEAN colour is far steadier than a pixel's: candidate
  regions from a lower floor, accepted when the region's mean a*b* differs from
  its ring's wall. That is `standout.ts` (group C) territory.

## Tools

- `scripts/colour-sweep.ts "" "NAME=v,…"`: the calibrate summary for many
  settings in one process (1.5 s each), `--pixels` adds the classifier's own
  pixel recall inside labelled notes and junk share outside them.
- `scripts/colour-diff.ts A B [photo]`: notes one setting gains and loses
  against another, lost notes tagged `MERGED` when a box covers two.
- `scripts/colour-misses.ts [photo] --list --mask --overlay`: each miss as
  colour or shape with its CIELAB against its ring; masks and overlays go to
  `/tmp/es95a/`, never the repository.
