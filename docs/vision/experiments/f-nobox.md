# Experiments F: paper found, no box made

Group F of [the experiment plan](../../../plans/event-storming-photo-95-experiments.md),
round 2: notes whose paper IS in the colour mask but for which no box survives.
It owns `boxes.ts`, `standout.ts`, `texture.ts` and `detect.ts`, and added
`narrow.ts` and `pads.ts`. Tools: `scripts/nobox.ts` (which gate drops each such
note) and `scripts/gate-diff.ts` (which boxes a change adds and removes).

Every number is from `npx tsx scripts/calibrate.ts` on the eight labelled walls
(645 notes). Per-wall cells read **F1 / precision / recall without actors /
merged boxes**.

## Baseline (commit `7221bf26`)

TOTAL F1 88.7%, precision 94%, recall 84%, 29 merged, 1/8 walls pass (201713).

| wall             | F1 / prec / rec-A / merged |
| ---------------- | -------------------------- |
| 201646           | 81 / 80 / 90 / 2           |
| 201654           | 97 / 98 / 98 / 3           |
| 201707           | 93 / 93 / 93 / 2           |
| 201713           | 97 / 98 / 96 / 0           |
| 201730 (shade)   | 92 / 96 / 90 / 2           |
| 201743 (night)   | 58 / 71 / 51 / 1           |
| wall-panorama    | 77 / 95 / 62 / 9           |
| whiteboard-dense | 92 / 96 / 88 / 10          |

## F0: the trace (kept, commit `9764afab`)

`fitBoxes` and `detectStickies` take an optional `onDrop(box, reason)` tracer,
naming the gate: `noise`, `area`, `aspect`, `too-big`, `size-floor`, `fill`,
`piece-small`, `rescue` (in `fitBoxes`), then `standout`, `dark-grain`, `blank`.
Behaviour unchanged (88.7). `scripts/nobox.ts` runs it and, for every missed note
with paper under it and no detection over it, names the gate of the dropped box
that best overlaps the note.

The 54 "paper-no-box" notes, by gate:

| gate       | notes | where                                                                             |
| ---------- | ----- | --------------------------------------------------------------------------------- |
| size-floor | 28    | night 6, panorama 7, whiteboard 10, one each on 201646/654/707/713/730            |
| area       | 7     | all night: a far board of 14px notes                                              |
| aspect     | 7     | pairs of notes fused into a strip; two single notes photographed short            |
| fill       | 6     | a box holding its note and part of a neighbour; one dark pink note in deep shade  |
| standout   | 4     | three pale whiteboard notes (standout 0.07–0.12 on the label itself); a fused row |
| noise      | 1     | a partial on the whiteboard                                                       |
| rescue     | 1     | two narrow night notes stacked into one column                                    |
| dark-grain | 0     |                                                                                   |
| blank      | 0     |                                                                                   |

C's two junk gates drop no labelled note. The size floor is the loss, and its
victims are of two kinds: **narrow but full-length** boxes (short side
0.5–0.68 of the wall's note, long side 0.9–1.4: actors, notes half under a
neighbour, the night wall's slanted left column), and **pads of small notes**
(a far board on the night wall at 0.3 of a note; the panorama's grid of small
pink squares at 0.55–0.6).

## F1: whole narrow notes (kept, commit `542c7125`)

**Hypothesis.** A box a note long and at least half a note thick is a note,
though thinner than the floor; junk slivers are either short, or cut pieces.

**First measure, any box.** `short ≥ 0.5 × floor AND long ≥ 0.95 × floor`:
TOTAL 89.8, but merged 29 → 33, 4 junk. The merged ones are pairs of small
square notes the close fused into a column; the junk includes cut slivers.

**What separates them.** In the RAW mask (before the close) the emptiest line
across the middle of the long axis, against the mean line: every true narrow
note keeps 0.61 or more, the fused pairs and two of the junk 0.00–0.23 (two
flush pairs show no gap in either mask, 0.85 and 0.98). `seamAcross` in
`narrow.ts`.

**Second measure: with the seam test, and only for WHOLE boxes.** Cut pieces
keep the 0.7 floor: B's notch and seam cuts leave 0.6–0.7 slivers of the note
underneath, and with the seam cut wired (see F6) an any-box narrow rule fell to
91% precision.

| variant                          | TOTAL | prec | merged |
| -------------------------------- | ----- | ---- | ------ |
| any box                          | 89.8  | 93   | 33     |
| any box, seam test               | 89.7  | 93   | 31     |
| whole boxes, seam test (kept)    | 89.3  | 94   | 30     |
| not notch/seam pieces, seam test | 89.4  | 93   | 30     |

Kept: whole boxes, seam test. +8 notes, 0 junk, 1 merged (two flush pink squares
on the panorama). Plateau: short 0.45–0.55 × long 0.85–0.95 × seam 0.3–0.6 all
score 89.1–89.4.

| wall             | before            | after             |
| ---------------- | ----------------- | ----------------- |
| 201646           | 81 / 80 / 90 / 2  | 82 / 80 / 90 / 2  |
| 201654           | 97 / 98 / 98 / 3  | 98 / 98 / 98 / 3  |
| 201707           | 93 / 93 / 93 / 2  | 93 / 93 / 93 / 2  |
| 201713           | 97 / 98 / 96 / 0  | 98 / 98 / 98 / 0  |
| 201730 (shade)   | 92 / 96 / 90 / 2  | 93 / 96 / 90 / 2  |
| 201743 (night)   | 58 / 71 / 51 / 1  | 64 / 74 / 59 / 1  |
| wall-panorama    | 77 / 95 / 62 / 9  | 77 / 93 / 62 / 10 |
| whiteboard-dense | 92 / 96 / 88 / 10 | 93 / 96 / 89 / 10 |
| **TOTAL**        | 88.7, 29          | 89.3, 30          |

## F2: pads of small notes (kept, commit `bacda7f6`)

**Hypothesis.** Scraps come alone and in every size; a far board or a pad of
smaller stationery comes as a cluster of like-sized, square, solid boxes.

**Rule** (`pads.ts`). Of the boxes the size and area floors refuse: square
(aspect ≤ 1.5), fill ≥ 0.6, at most 0.7 of the wall's note, not clipped by the
frame, not lying over a kept note. Linked single-linkage when their short sides
are within a ratio and their centres within a reach of the larger short side;
a cluster of three or more is a pad. Small kept notes count as siblings (the
panorama's actors). Pads go through `standsOut` like every box.

- Reach measured on the smaller short side, and overlap judged against
  `fitBoxes`' output: **no change**. The night board's notes sit about 35px
  apart at 11–13px across, and one seed lay inside a box `standsOut` later
  refused.
- Reach on the larger side, overlap judged against the boxes that stand out,
  small kept notes as siblings: +6 notes, 1 junk, TOTAL 89.3 → 89.8.
- Plateau: reach 3–5, size ratio 1.3–1.5, min notes 3 (4: 89.5), max size
  0.6–0.8, fill 0.5–0.7 all score 89.5–89.8.

Night 64 → 68 F1, panorama 77 → 78 (rec-A 62 → 66), 1 whiteboard scrap.

## F3: fused pad notes join a pad (kept, commit `afbe1888`)

**Hypothesis.** Most of the night board's notes are fused into rows and
columns by the close; cut into squares, they are pad notes.

| variant                                               | TOTAL | notes | junk |
| ----------------------------------------------------- | ----- | ----- | ---- |
| cut every refused box into squares of its short side  | 89.2  | +6    | +16  |
| …only from aspect 1.85                                | 89.8  | +5    | +5   |
| squares only JOIN a pad found from clean seeds (kept) | 90.2  | +5    | 0    |

Cutting everywhere halves true narrow notes (aspect about 1.6) and turns a strip
of tape into its own "pad". Joining an existing pad, one sibling after
another, cannot make a pad out of a single strip. The aspect gate's refusals
feed the pads too. Plateau: trigger 1.6–1.85, join size ratio 1.3–1.9 score
90.0–90.2. Night 68 → 71, panorama 78 → 81 (rec-A 66 → 72).

## F4: cut by the pad's note, judge pads without grain (kept, commit `921a758b`)

Three night pad squares were then refused by **dark-grain**: roughness is
scale-dependent, and on a 15px note the ink margin leaves no clean interior
(pad seeds read 0.04–0.06 against ≤ 0.03 for the wall's 40px notes).

| variant                                      | TOTAL | merged | night            |
| -------------------------------------------- | ----- | ------ | ---------------- |
| pads judged without grain                    | 90.4  | 31     | 75 / 77 / 72 / 2 |
| …and fused rows cut by the pad's note (kept) | 90.6  | 30     | 77 / 79 / 74 / 1 |
| fused rows cut by the pad's note alone       | 90.2  | 30     | unchanged        |

The added merged box was a row of three 15px notes, 46×19, cut by its own
height into two squares each holding one and a half notes; aspect cannot tell
it from the panorama's two-note 20×47 column (2.42 against 2.35). The pad's own
note length (median LONG side of the pad boxes near it: seeds are often partial,
so their short sides undersell) cuts both right. Near-pad reach 1.5–6 scores
the same.

## F5: plateau re-check on the combined state (kept, commit `19f01eee`)

Every kept constant nudged both ways on the final state. All within 0.2 of a
point except two edges: `PAD_REACH` 3 sat on a cliff (2.75: 89.7; 3 and 3.25:
90.6; 3.5–5: 90.4, one scrap more), moved to 3.25; `PAD_SIZE_RATIO` 1.3 was the
low edge of a flat 1.3–1.6, moved to 1.45. TOTAL unchanged.

The reach cliff is the night board's geometry (its notes sit about three of
their widths apart) and rests on ONE pad on ONE wall: a second photograph with
a far board would be worth more than any further tuning here.

## Rejected

- **F6: wiring the shadow-seam cut** (B3's `luminance`, one line in
  `detect.ts`). Measured on F2's state: TOTAL 89.8 → 89.6, merged 30 → 26, but
  201713 loses two notes and its PASS (rec-A 98 → 94): the seam cut splits
  single notes about 1.2 of a note long at a false seam. (On the baseline:
  88.7 → 88.5, merged 29 → 25, the same 201713 loss.) Breaks "no wall loses more than one note". Left
  for B2 (`seam.ts`), see Open questions.
- **Lower fill floor** (`MIN_PAPER_FILL` 0.45): 0.42 gains one note on a knife
  edge (89.9), 0.40 gains 0.3 of a point for 3 merged boxes, 0.5 loses 0.3. The
  fill-dropped boxes are mostly a note plus part of its neighbour (fitting, not
  gating). No plateau.
- **Aspect ceiling** (`MAX_PAPER_ASPECT` 2.4): 2.2–2.8 score identically; the
  aspect gate costs no single note that a higher ceiling returns. Its victims
  are pairs.
- **Ring without paper** (standout's wall read only from ring pixels outside
  the paper mask, for pale notes surrounded by notes): 90.6 → 90.3, 201646
  precision 80 → 77, the three pale whiteboard notes still refused. The ring was
  not why they read 0.07–0.12.
- **Hue for paler notes** (`HUE_MIN_SATURATION` 0.2). The three pale whiteboard
  notes stand out only by hue (70 to 120 degrees off the wall) at saturation
  0.10 to 0.19, under the floor. Lowered to 0.10 / 0.12 / 0.15 / 0.17: TOTAL
  90.5 / 90.4 / 90.4 / 90.6; the whiteboard gains up to two notes but kraft junk
  of a slightly different hue comes in on 201646 (precision 80 to 75). A floor
  relative to the wall’s own saturation might separate them, but only one of the
  eight walls is near grey, so it could not be fitted without fitting that wall.

## Where it ends

TOTAL F1 88.7 → **90.6**, precision 94%, recall 84% → 88%, merged 29 → 30,
1/8 walls pass (201713, now 98/98/98). Paper-no-box 54 → 31:

| wall             | before            | after             | paper-no-box |
| ---------------- | ----------------- | ----------------- | ------------ |
| 201646           | 81 / 80 / 90 / 2  | 82 / 80 / 90 / 2  | 2 → 1        |
| 201654           | 97 / 98 / 98 / 3  | 98 / 98 / 98 / 3  | 1 → 0        |
| 201707           | 93 / 93 / 93 / 2  | 93 / 93 / 93 / 2  | 1 → 1        |
| 201713           | 97 / 98 / 96 / 0  | 98 / 98 / 98 / 0  | 1 → 0        |
| 201730 (shade)   | 92 / 96 / 90 / 2  | 93 / 96 / 90 / 2  | 4 → 3        |
| 201743 (night)   | 58 / 71 / 51 / 1  | 77 / 79 / 74 / 1  | 19 → 8       |
| wall-panorama    | 77 / 95 / 62 / 9  | 81 / 94 / 72 / 10 | 8 → 3        |
| whiteboard-dense | 92 / 96 / 88 / 10 | 93 / 96 / 89 / 10 | 18 → 15      |

What the 31 left are, by gate: size-floor 11 (whiteboard 7: PARTIAL boxes, the
paper mask covering only the top of a note, 12px of a 19px note), fill 6 (a note
plus part of its neighbour), aspect 4 (two fused whiteboard pairs, two single
notes photographed short), area 4 and standout 1 (the night board's fused
remainder), standout 3 (pale whiteboard notes, 0.07–0.12 on their own labels),
rescue 1 (two narrow night notes stacked), noise 1.

## Open questions (other groups' files)

- **B2 (`seam.ts`)**: the shadow-seam cut is not wired in `detect.ts`. Wired,
  it takes 4 merged boxes off but cuts two single 201713 notes about 1.2 notes
  long. If B2 tightens the seam's evidence for boxes under about 1.3 notes, the
  one-line wiring (`luminance: luminanceOf(working)` in `fitBoxes`' options) is
  ready in F's file and should be re-measured.
- **B2 (`split.ts`)**: the length splitter counts pieces by the WALL's note, so
  the night wall's column of two narrow 28×56 notes (24×107) is cut into three
  and lost. Counting by the box's own short side for narrow boxes would help.
- **A2 (colour)**: most whiteboard size-floor losses are partial boxes (the
  paper mask covers the top two thirds of a pale note), and the shade wall's
  dark pink hotspot is 30% paper. Those are classification, not gates.
- **Scale-dependent roughness** (`texture.ts`, F's own): `isDarkGrain` reads
  small notes as grained. Pads skip it; a size-normalised roughness would be
  the general fix, but needs junk at pad sizes to fit against.
