# Experiments, group A2: colour, round 2

Part of [the experiment plan](../../../plans/event-storming-photo-95-experiments.md)
towards [the bar](../../../plans/event-storming-photo-95.md), after
[round 1's colour group](a-colour.md). Owned files: `classify.ts`, `floors.ts`,
`lab.ts`, `colour.ts` (and `surface.ts`, `histogram.ts`, split out of
`floors.ts` in round 1). Every number is from `scripts/calibrate.ts`, or from
`scripts/colour-sweep.ts`, which reproduces its summary exactly, on the eight
labelled walls (645 notes).

**Result:** TOTAL F1 88.7% → **90.0%**, precision 94% → 95%, recall 84% → 86%,
merged boxes 29 → 31, walls passing 1/8 → 1/8 (201713). Two rules kept
(A2.1, A2.3); the rest rejected or diagnosed, with their numbers below.
Colour misses (a missed note whose paper is not classified as paper) fall
from **12 to 2**; the no-paper notes of `scripts/merged.ts` from **8 to 0**
(panorama 6, night 1, 201646 1).

| wall             | F1 before | F1 after | rec-A before | rec-A after | prec before | prec after | merged before | merged after |
| ---------------- | --------- | -------- | ------------ | ----------- | ----------- | ---------- | ------------- | ------------ |
| 201646           | 81        | 84       | 90           | 93          | 80          | 83         | 2             | 2            |
| 201654           | 97        | 97       | 98           | 98          | 98          | 98         | 3             | 3            |
| 201707           | 93        | 93       | 93           | 93          | 93          | 93         | 2             | 2            |
| 201713           | 97        | **98**   | 96           | 98          | 98          | 98         | 0             | 0 (PASS)     |
| 201730 (shade)   | 92        | 91       | 90           | 90          | 96          | 94         | 2             | 2            |
| 201743 (night)   | 58        | 64       | 51           | 54          | 71          | 84         | 1             | 1            |
| wall-panorama    | 77        | **82**   | 62           | **74**      | 95          | 95         | 9             | 9            |
| whiteboard-dense | 92        | 93       | 88           | 88          | 96          | 97         | 10            | 12           |
| **TOTAL**        | **88.7**  | **90.0** |              |             | 94          | 95         | **29**        | **31**       |

The two extra merged boxes are on the whiteboard, and they are not colour:
the class masks with and without the rule differ by a pixel or two there, and
the splitter cuts a lapped pair of 19px notes differently (see A2.1). The one
note 201730 loses is a spurious box that is a real, unlabelled note (a pink
note cut by the frame's right edge, now found because its shaded paper is
paper).

## A2.1: pale paper by its CIELAB distance from the wall (kept)

**Hypothesis:** the panorama's pale pink notes on white paper are wall to HSV
(saturation 0.2 to 0.3, within 34° of the white paper's measured hue, so under
the near-hue floor) but clearly apart from the wall in a*b*. A pixel HSV calls
wall should be paper when it is far from the wall in a*b*.

First the ceiling, per pixel (`scripts/rescue-probe.ts`): among lit pixels the
classifier calls wall, how many a Δab ≥ T rescue would turn into paper inside
the colour-missed notes, inside any note, and outside every note.

| wall (raw pixels) | T 10: missed / in-note / off | T 12                | T 14               | T 16             |
| ----------------- | ---------------------------- | ------------------- | ------------------ | ---------------- |
| wall-panorama     | 4903 / 5274 / 19485          | 4187 / 4503 / 14233 | 1326 / 1551 / 6469 | 58 / 119 / 1789  |
| whiteboard-dense  | 149 / 276 / 73               | 142 / 197 / 37      | 132 / 143 / 19     | 49 / 51 / 13     |
| 201743 (night)    | 1287 / 1336 / 7912           | 1027 / 1049 / 3819  | 682 / 697 / 2765   | 638 / 649 / 1740 |

The panorama's pale pinks sit 12 to 15 a*b* units from the wall as the floor
tiles measure it, so the usable band is narrow; off-note pixels are mostly the
cream wall above and below the paper sheet, which forms huge blobs the shape
filters drop. A box-filtered a*b* (radius 3) did not widen the band (panorama
missed pixels at T 12: 4038 against 4187 raw): the limit is the wall
estimate, not pixel noise (see A2.2).

Measured as detections (TOTAL F1 / merged, baseline 88.7 / 29):

| variant                                              | settings → TOTAL / merged                                                                       | verdict                                                                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Δab ≥ T alone                                        | 10: 87.6/39 · 12: 87.8/38 · 14: 88.1/37 · 16: 89.3/29 · 18: 89.0/32 · 20: 89.0/31 · 24: 89.1/32 | Panorama +5 at 12, but the whiteboard loses 11 notes (merged 10 → 17): the blurred rims between its dense notes are rescued too.       |
| … and saturation ≥ 0.10 / 0.15                       | 87.9/38 · 89.1/32                                                                               | Partly curbs the rims.                                                                                                                 |
| … and at least 0.9 / 1.0 / 1.05 of the wall's value  | 89.5/31 · 89.3/31 · 88.5/31                                                                     | The rims and gaps are darker than the wall; pale paper is not. Whiteboard whole again. 201707 and 201713 gain two spurious boxes each. |
| … and off the wall's HSV hue by 10 / 15 / 20°        | 88.8/30 · 89.3/30 · 89.1/30                                                                     | Does not touch the kraft junk.                                                                                                         |
| … and off the wall's a*b* direction by 20 / 30 / 40° | 89.2/30 · 89.2/30 · 89.4/30                                                                     | Nor this.                                                                                                                              |
| **… and never yellow** (T 12, brightness 0.9)        | **89.9 / 31**                                                                                   | **Kept.** The kraft junk was masking tape: a diagonal strip of pale yellow tape has a note-sized bounding box.                         |

The kept rule's plateau (never yellow):

| T \ brightness | 0.8       | 0.9           | 1.0       |
| -------------- | --------- | ------------- | --------- |
| 10             | 88.3 / 36 | 88.4 / 36     | 88.6 / 36 |
| 11             | 89.8 / 32 | 90.0 / 32     | 89.5 / 32 |
| **12**         | 89.8 / 31 | **89.9 / 31** | 89.7 / 31 |
| 13             | 89.2 / 31 | 89.2 / 31     | 89.2 / 31 |
| 14             | 89.1 / 30 | 89.1 / 30     | 89.1 / 30 |
| 16             | 88.7 / 29 | 88.7 / 29     | 88.8 / 30 |

Brightness is flat from 0.8 to 1.1. T 11 to 14 all beat the baseline; at 13
the pale pinks start to be found as half-notes, at 16 they are lost, and at
10 the whiteboard's dense orange notes weld through their rims. 12 sits one
step inside both edges. What the rule finds: the panorama's six pale notes
(the whole "no paper" group of `merged.ts`), the night wall's lilac note
under tungsten, and a pink hotspot on 201646; four spurious boxes fewer on the
night wall.

Floors now carry the wall's modal value (`wallValue`), blended like the other
floors. The cheap tests run first, so only a lit pixel with a paper hue pays
for CIELAB: the eight walls take 1876 ms against 1727 before (+9%).

Commit `28dfeb67`.

## A2.2: a purer wall colour (rejected)

**Hypothesis:** the wall's a*b* is the mean of every pixel under the paper
floor, which includes pale paper itself; measured from the wall's own
population it would be purer, and the pale notes further from it. The unit
test that drives A2.1 shows the effect: a pale pink note covering half a floor
tile pulls the tile's wall colour halfway to the note.

| variant (with A2.1)                                          | TOTAL / merged          |
| ------------------------------------------------------------ | ----------------------- |
| current: mean a*b* under the paper floor                     | 89.9 / 31               |
| only pixels below the tile's Otsu split when it is bimodal   | 89.7 / 31               |
| only pixels within 0.04 / 0.06 / 0.08 of the saturation mode | 89.2 / 31 · 89.2 · 89.3 |
| within 0.03 / 0.05 of the mode of the DULL pixels            | 89.3 / 32 · 89.2 / 32   |
| … a window both sides of that mode                           | 88.0 / 34               |
| the tile's wall saturation from its lower Otsu population    | 89.5 / 34               |

None beats the current estimate, and they cannot be told apart from the
at-hue rule it also feeds (`WALL_HUE_MIN_LAB_DISTANCE`), which was tuned on
it. The panorama's worst tile shows why no per-tile statistic can do it: it
holds three populations (white paper at s≈0.09, five pale pink notes at
s≈0.30, red and yellow notes at s≈0.97), its saturation MODE is the red
paper, so its floor is 0.57 and its "wall" is pale pink. The wall is a
minority of that tile. Rejected; recorded in "what to try next".

## A2.3: no hue gap between green and blue (kept)

**Hypothesis:** the read-model band stopped at 175 and the command band
starts at 185; paper in between was nobody's. The pale mint read model on
201713 measures h 173 to 182.

| read-model band ends at | 175 (before) | 180       | 185       |
| ----------------------- | ------------ | --------- | --------- |
| TOTAL / merged          | 89.9 / 31    | 90.0 / 31 | 90.0 / 31 |
| 201713 matched          | 52 / 54      | 53 / 54   | 53 / 54   |

Extending command down to 180 or 175 instead: 89.8 and 89.6. Kept at 185,
where blue begins: nothing else moves. Commit `fb627afa`.

## A2.4: the night wall under tungsten, with a window in frame (diagnosed)

**Finding: the night wall's recall is not the classifier's.** After A2.1 none
of its 20 misses is a colour miss; every one has its paper in the mask, most
as one clean component each:

- 13 are notes seen through the window, about 15px against the wall's 41px
  note: the size floor drops them (group F).
- 5 are the foreshortened column at the left edge, 24 to 28px wide: under
  `MIN_PAPER_SIZE_RATIO`, and the top two touch end to end (F, B2).
- 1 is an inseparable merged pair, 1 is a note lying flat (44×20).

The kinds are right under tungsten (orange paper L43 to 64, a*b* chroma 45 to
52, kraft a8 b17), and a note's paper is one kind (the "own" share equals the
paper share on every missed note). What colour could still win there is
precision: of four spurious boxes, two are the night sky in the window (blue,
h 215 to 218, read as command), one is lit kraft in a tile that straddles the
kraft and the dark room, one the racket's white base lit by the window.

Two ideas measured:

| variant                                                              | TOTAL / merged | verdict                                                                                   |
| -------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------- |
| at-hue test against the NEAREST of the four surrounding tiles' walls | 89.5 / 32      | Night unchanged in F1; 201707 loses two notes: a tile full of paper is somebody's "wall". |
| … and the pale rule against the nearest too                          | 88.8 / 35      | Worse on the panorama and 201707.                                                         |

"Brown is not a note" (cardboard, lit kraft) was measured as a distribution
before a rule: orange notes' median a*b* chroma goes down to 19 to 25 on the
dim kraft walls (201654: 19 to 23), cardboard on 201646 is 16 to 21 at the
same hue angle. They overlap; no rule written.

## A2.5: the colour constants after round 1's merges (no change)

Every group's round-1 change moved the masks' consumers, so each colour
constant was swept again around its value (TOTAL / merged; current 90.0 / 31):

| constant                          | values → TOTAL / merged                                                     |
| --------------------------------- | --------------------------------------------------------------------------- |
| `WALL_HUE_NEIGHBOURHOOD_DEG` 34   | 28: 87.7/37 · 31: 88.3/37 · 37: 90.0/32 · 40: 89.6/31                       |
| `OFF_HUE_MIN_SATURATION` 0.11     | 0.09: 88.1/37 · 0.10: 88.2/38 · 0.12: 90.0/31 · 0.13: 89.2/36               |
| `WALL_HUE_MIN_LAB_DISTANCE` 7     | 5: 88.9/31 · 6: 89.4/32 · 8: 88.9/31 · 9: 88.9/31                           |
| `PALE_YELLOW_MAX_SATURATION` 0.34 | 0.30: 89.9/31 · 0.32: 89.6/30 · 0.36: 90.0/31 · 0.38: 89.6/32               |
| `WALL_SATURATION_MARGIN` 0.14     | 0.10: 89.5 · 0.12: 89.8 · 0.16: 89.8 · 0.18: 89.1 (merged 31 all)           |
| `MIN_PAPER_SATURATION` 0.28       | 0.24: 88.8 · 0.26: 89.2 · 0.30: 89.4 · 0.32: 88.9/30                        |
| `WALL_VALUE_RATIO` 0.7            | 0.6: 87.9/39 · 0.65: 89.4/32 · 0.75: 89.4/31 · 0.8: 88.7/32 · 0.85: 87.3/33 |
| `FLOOR_TILES_LONG_SIDE` 8         | 6: 87.0/42 · 7: 86.7/39 · 9: 86.2/36 · 10: 83.6/34                          |
| `TILE_BIMODAL_STRENGTH` 0.12      | 0.08 to 0.16: 90.0/31, flat                                                 |
| `TILE_WALL_TOLERANCE` 0.1         | 0.06 to 0.14: 90.0/31, flat                                                 |

Every constant is still at its best, so nothing moves. Two are worth knowing
about, because they are sharper than a plateau should be:

- **The floor grid.** Seven or nine tiles instead of eight cost 3.3 to 3.8
  points: the night wall's room turns into 22 to 24 spurious boxes (precision
  84% → 45 to 49%), and the whiteboard loses 10 to 14 notes to merges. The
  whiteboard is near-neutral, so its measured wall HUE is noise (h 50 to 76
  in the top rows, 200 to 230 below), and which tiles apply the near-hue floor
  (0.28) rather than the off-hue floor (0.11) to its orange notes is an
  accident of the grid.
- **The off-hue floor.** 0.10 and 0.13 both cost about two points, the
  whiteboard again (merged 12 → 19 at 0.10).

## A2.6: a floor per kind of paper (rejected)

**Hypothesis:** the off-hue floor (0.11) exists for the palest papers (lilac
policies, greyish aggregates); a vivid paper's blurred rim clears it and welds
dense notes, so vivid kinds should need more.

| off-hue floor for every kind but policy | 0.13      | 0.15      | 0.18      | 0.22      |
| --------------------------------------- | --------- | --------- | --------- | --------- |
| TOTAL / merged                          | 89.2 / 35 | 89.0 / 35 | 88.6 / 36 | 88.1 / 36 |
| … and not the yellows either            |           | 89.4 / 35 | 89.1 / 36 |           |

A higher floor MERGES more, not less: a thinner mask breaks a note into
fragments the box merge then joins across its neighbours. Rejected.

## A2.7: pale yellow on a bright wall (rejected)

A2.1 never rescues yellow, because of masking tape on kraft. Allowing it where
the wall is bright (wall value ≥ 0.6 / 0.7 / 0.8 / 0.85): 90.1 / 90.1 / 90.0 /
90.0, merged 31 throughout. One whiteboard aggregate for a rule that brings
tape back on a bright kraft wall. Rejected.

## What colour cannot fix, and what to try next

- **Colour misses are down to two**, one of them a note the same colour as
  its wall (Δ 5). Of the 93 misses, 91 have their paper in the mask:
  merged clusters of small notes (panorama's right-hand cluster, the
  whiteboard's dense orange blocks, which are one colour, 100% paper and cannot
  be separated by colour at all), and size floors (the night wall's window
  notes and foreshortened column). That is groups F and B2's ground.
- **The wall estimate is a tile statistic, and a tile can be mostly paper.**
  The honest fix is a region-level wall: the frame's largest connected
  wall-coloured surface, measured as a surface rather than as the dull tail of
  each tile's histogram. It would give pale paper a clean reference, and on
  the night wall it would say where the wall ENDS (the window, the room),
  which is where its spurious boxes are. It needs the class mask's connected
  components, i.e. a hook in `detect.ts` (F): see open questions.
- **A near-neutral wall has no hue.** The near-hue / off-hue choice should not
  apply where the wall's a*b* chroma is noise; round 1 measured a frame-level
  switch and found kraft and white walls overlap in chroma (4 to 13 on these
  photos), so it would have to be decided per tile, from the spread of the
  dull pixels' hues rather than their mean.

## Open questions (for other groups)

- **F / `detect.ts`:** a region-level wall (above) needs `classMaskOf` to hand
  the classifier something beyond per-tile floors, or a second pass over the
  mask; `classMaskOf` lives in `detect.ts`. Not attempted.
- **Labels:** 201730 has a real pink note cut by the right edge of the frame
  (around x 974, y 342 at 1000px) with no label; A2.1 finds it and it scores
  as spurious. 201713's two lilac notes side by side at the bottom (around
  x 120 to 300, y 485) carry one label.

## Tools

- `scripts/rescue-probe.ts [radius] [photo]`: per wall, lit pixels the
  classifier calls wall that a Δab ≥ T rescue would turn into paper, inside
  colour-missed notes, inside any note and outside every note.
- `scripts/wall-chroma.ts [photo]`: the wall's a*b* chroma and hue per floor
  tile.
- Round 1's `colour-sweep.ts`, `colour-diff.ts`, `colour-misses.ts` as before.
