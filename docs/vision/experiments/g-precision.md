# Experiments, group G: precision, round 3

Group G of [the experiment plan](../../../plans/event-storming-photo-95-experiments.md):
precision to 95% on every wall. Owned files: `src/standout.ts`,
`src/texture.ts`; added `src/spill.ts` and `scripts/spurious.ts`. Earlier
rounds on the same ground: [c-junk.md](c-junk.md) (the dark-grain and blank
gates) and [f-nobox.md](f-nobox.md).

Every number is from `npx tsx scripts/calibrate.ts` on the eight labelled walls
(645 notes), scored on the editor's own pixels. Per-wall cells read
**precision / F1 / recall without actors / merged boxes**.

## Baseline (commit `71bb6eed`)

TOTAL F1 90.7%, precision 93%, recall 88%, 29 merged, 1/8 walls pass (201707).

| wall             | prec / F1 / rec-A / merged |
| ---------------- | -------------------------- |
| 201646           | 82 / 85 / 93 / 1           |
| 201654           | 100 / 99 / 98 / 3          |
| 201707           | 95 / 95 / 95 / 0           |
| 201713           | 96 / 95 / 94 / 0           |
| 201730 (shade)   | 94 / 93 / 92 / 2           |
| 201743 (night)   | 82 / 80 / 77 / 2           |
| wall-panorama    | 88 / 80 / 77 / 10          |
| whiteboard-dense | 96 / 93 / 89 / 11          |

## G0: what every spurious box IS

`scripts/spurious.ts` puts each spurious box (a detection matching no label)
in one class by where it lies against the labels, and writes a magnified crop
of it (box in red, labels dotted white) to the temp directory. Every crop and
both overlays were looked at; the classes below are what the pictures show.

| wall             | spurious | what they are                                                                                                                                                                                                                                                                                           |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 201646           | 9        | **3 cardboard**: the lit top face of a cardboard box in front of the wall, classed orange. **1 print**: a pink band printed on the same box. **2 note + cardboard**: a note's box run down onto the box top. **2 halves** of one wide lilac note. **1 fragment** of a note another box already matches. |
| 201654           | 0        |                                                                                                                                                                                                                                                                                                         |
| 201707           | 2        | **2 straddles**: a box over the corners of two notes and the wall between.                                                                                                                                                                                                                              |
| 201713           | 2        | **2 fragments** of one note the detector misses (its top and its bottom).                                                                                                                                                                                                                               |
| 201730 (shade)   | 3        | **2 straddles** (a note and half its neighbour). **1 real note with no label**: pink, cut by the right edge of the frame (A2 reported it).                                                                                                                                                              |
| 201743 (night)   | 7        | **3 window panes** (night sky and the dark glass below it, classed blue). **1 bare kraft** in the racket's shadow. **2 racket**: its white handle and base, lit by the window, classed blue. **1 jar lid** (red) on the shelf.                                                                          |
| wall-panorama    | 8        | **2 halves** of one wide lilac note. **1 fragment** of a pale pink note. **1 duplicate**: a second box over a note already matched. **1 pad box** over an actor. **3 merged** pairs of small actors.                                                                                                    |
| whiteboard-dense | 9        | **2 identical duplicates** of matched notes. **2 offset** and **1 fragment** boxes over notes the sprawl's grid cut across. **2 merged** pairs. **2 offset** boxes (cells over two notes).                                                                                                              |

Of 40 spurious boxes, **12 are not paper** (201646 4, night 7, and 201730's
unlabelled note, which is paper the truth does not list). The other 28 are
**paper**: halves, fragments, straddles, duplicates and merged boxes, which
are separation and assembly faults (groups I and H), not junk:

- **Halves of wide notes** (201646's lilac note, the panorama's lilac note):
  the length splitter cuts a 1.7:1 note in two (`split.ts`).
- **Identical duplicate boxes** (whiteboard 50,336 and 69,336; panorama
  733,105): traced, `splitOversized` on a sprawling blob (whiteboard: the
  component at 0,231, 108×257) returns grid cells that cover a SEPARATE
  component lying inside its bounding box (at 50,336, 38×19), which is cut
  into the same two cells again. The whiteboard's offset chain (70,451 /
  81,452 / 89,452) is the same fault. For `split.ts` / `necks.ts` (group I).
  Measured as a symptom fix (drop a box identical to another, overlap ≥ 0.95
  of the smaller): TOTAL +0.2 (panorama 88 → 90, whiteboard 96 → 97); at 0.9
  it swallows a real note on 201646 by keeping the larger of two. The root
  cause is the split, not the gate.
- **Fragments of a note found nowhere else** (201713's two, the panorama's
  pale pink): the note is missed and a piece of it survives. Separation or,
  for the pale pink, classification (only part of the pale paper is in the
  mask).
- **Straddles** (201707, 201730): a box between two notes; fitting.

So on four of the eight walls precision is entirely a separation or assembly
matter; only 201646 and the night wall have junk worth gating.

## G1: a higher standout bar (rejected)

Three of 201646's cardboard boxes stand out at 0.18 to 0.19, just over the
0.15 bar; the notes' 2nd percentile is 0.22.

| STANDOUT_SATURATION | 0.13 | 0.15 (current) | 0.17 | 0.19 | 0.20 | 0.21 | 0.23 |
| ------------------- | ---- | -------------- | ---- | ---- | ---- | ---- | ---- |
| TOTAL               | 90.6 | 90.7           | 90.3 | 90.0 | 90.2 | 90.1 | 89.7 |

From 0.17, 201654 and the whiteboard each lose a note (rec-A 98 → 96, 89 →
87), and from 0.19 201713 loses two (94 → 91). The pale notes that stand out
by only a little are real. Unchanged.

## G2: the blank gate against the window panes (rejected)

The two night panes are blank (value spread 0.41–0.42 of the frame's median
box) and edgeless (weakest side 0.003–0.006), just over the blank ratio
of 0.3. The whiteboard's small notes sit as low (0.35–0.44 of their frame, weakest side 0.014–0.05).

| ratio \ edge | 0.01 | 0.02 | 0.05 (current) |
| ------------ | ---- | ---- | -------------- |
| 0.30         |      |      | 90.7           |
| 0.35         | 90.2 | 90.5 | 90.7           |
| 0.40         | 90.2 | 90.4 | 90.6           |
| 0.45         | 90.3 | 90.5 | 90.7           |
| 0.50         | 90.4 | 90.5 | 90.6           |

At 0.45–0.5 the night wall gains 2 to 4 points of precision and the
whiteboard loses a note; nowhere does the TOTAL rise. Unchanged.

## G3: a note is an object, its colour stops at its edge (kept, needs wiring)

**Hypothesis.** A sticky note is an object: grow its paper colour outwards
from its sides and it runs out at once. A box cut out of a SURFACE (a window
pane of night sky, a patch of bare kraft, the top of a cardboard box) runs on
into that surface. A missed neighbour of the same colour is at most a note's
worth; a surface is several. Paper held by another box does not count, so a
flush row of found notes of one colour spills nothing.

**Measure** (`spillOf`, `src/spill.ts`): from the box's median CIELAB colour
(interior, inset 15%), flood-fill 4-connected through pixels within ΔE of it
and not inside any other box, within 3 box sizes of the box; spill = pixels
reached ÷ box area.

Distribution (before any rule), per ΔE and threshold, **notes / junk / paper**
dropped:

| ΔE \ spill ≥ | 1.25  | 1.5   | 1.75  | 2     | 2.5   |
| ------------ | ----- | ----- | ----- | ----- | ----- |
| 10           | 0/4/2 | 0/4/1 | 0/4/1 | 0/4/0 | 0/3/0 |
| 12           | 0/4/2 | 0/4/2 | 0/4/1 | 0/4/1 | 0/4/0 |
| 14           | 1/6/4 | 0/6/4 | 0/5/3 | 0/5/3 | 0/5/3 |
| 16           | 7/7/4 | 5/7/4 | 4/6/4 | 3/6/4 | 3/6/3 |

The most any labelled note spills at ΔE 14 is 1.42 of its box (201707: a note
flush against an unfound one of its colour); panes, bare kraft and cardboard
spill 1.6 to 25. From ΔE 16 the palest whiteboard notes leak into the board.

**Rule** (`dropSurfaces`): drop a box that spills more than 1.75 of its area at
ΔE 14; judged again after each drop, because two boxes cut from one surface
shield each other (201646's cardboard end, 0,355, is walled in by the next
cardboard box until that one goes).

| ΔE \ spill | 1.5  | 1.75     | 2    | 2.5  |
| ---------- | ---- | -------- | ---- | ---- |
| 12         | 91.2 | 91.2     |      |      |
| 13         |      | 91.2     | 91.2 |      |
| 13.25      |      | 91.3     |      |      |
| 13.5       |      | 91.4     |      |      |
| 13.75      |      | 91.4     |      |      |
| **14**     | 91.5 | **91.4** | 91.4 | 91.4 |
| 14.5       |      | 91.4     |      |      |
| 15         |      | 91.3     | 91.3 |      |
| 16         |      | 91.1     |      |      |

Reach 2 and 4 score the same as 3 (91.4). ΔE 12 to 14.5 lose no note on any
wall; 15 costs one 15px note of the night wall's far board (blurred into its
unfound neighbours), 16 a panorama note too. Spill 1.5 adds one panorama
fragment but sits nearer the notes' 1.42; 1.75 is kept.

| wall             | before            | after             |
| ---------------- | ----------------- | ----------------- |
| 201646           | 82 / 85 / 93 / 1  | 89 / 88 / 93 / 1  |
| 201654           | 100 / 99 / 98 / 3 | 100 / 99 / 98 / 3 |
| 201707           | 95 / 95 / 95 / 0  | 95 / 95 / 95 / 0  |
| 201713           | 96 / 95 / 94 / 0  | 100 / 97 / 94 / 0 |
| 201730 (shade)   | 94 / 93 / 92 / 2  | 94 / 93 / 92 / 2  |
| 201743 (night)   | 82 / 80 / 77 / 2  | 89 / 83 / 77 / 2  |
| wall-panorama    | 88 / 80 / 77 / 10 | 88 / 80 / 77 / 10 |
| whiteboard-dense | 96 / 93 / 89 / 11 | 96 / 93 / 89 / 11 |
| **TOTAL**        | **90.7**, 93%, 29 | **91.4**, 95%, 29 |

What it drops: 201646's three cardboard boxes and one of its two
note-plus-cardboard boxes, 201713's two fragments of its missed note, and on
the night wall one pane, the bare kraft and the racket handle. No labelled
note. About 30 ms a photo (one CIELAB pass over the frame).

**It needs one call in `detect.ts`** (group H's file), after `dropBlank`:

```ts
const blankless = dropBlank(working, outstanding);
const standing = dropSurfaces(working, blankless, (box) => drop(box, 'surface'));
```

with `'surface'` added to `DetectDropReason` and the blank loop's trace
compared against `blankless`. `spill.ts` and its tests are committed; the call
is not.

## G4: the box's surroundings against the frame's wall (rejected)

**Hypothesis.** The night junk and the cardboard lie OFF the wall: the dull
quarter of their ring (standout's "wall") is not the frame's wall.

Measured as CIELAB a*b* distance between each box's ring and the frame's
median ring: night junk 14 to 21, but the night wall's far board (real notes
seen through the window) 12 to 15, the panorama's actors (ringed by other
notes) up to 47, and 201654's shaded notes 9 to 12. Brightness against the
frame is no better (shaded notes −1.2 to −1.8 stops, as dark as the panes).
Notes stuck on another board are notes; "on the wall" is not the question.

## G5: saturation against the frame's own notes of that kind (rejected)

**Hypothesis.** The cardboard is classed orange but far duller than the
frame's orange notes (0.32–0.34 against a median of 0.53); saturation holds
under shade, unlike brightness.

Relative to its kind's median in the frame, the cardboard sits at 0.61–0.64,
but 201654's dull orange notes sit at 0.45–0.59 and the panorama's pale pinks
(classed orange) at 0.30–0.33. Two kinds of one colour share a class, and a
wall's notes differ in how dull they came off the pad. No threshold separates.

## G6: grain in the light (rejected)

The jar lid (roughness 0.23) and the printed band (0.05) are grained but lit,
so dark grain passes them. Seventeen labelled notes are rougher than 0.06,
and small notes read up to 0.5 (the ink margin leaves little clean interior);
only the lid stands clear, one box on one wall. Not a rule.

## G7: white objects (rejected)

The racket's handle and base stand out only by brightness at saturation
0.12 and 0.17. Seven boxes stand out by brightness alone: those two and five
notes at saturation 0.16 to 0.45 (two mint read models on 201713 at 0.18, a
whiteboard aggregate at 0.16). A saturation floor between 0.163 and 0.166 is
not a plateau.

## Where it ends

Kept: G3 (`dropSurfaces`, commit on this branch; wiring pending). With the
wiring: TOTAL 90.7 → **91.4**, precision 93% → 95%, merged 29, walls passing
1/8 (201707). Precision per target wall: 201646 82 → 89, night 82 → 89,
panorama 88, 201730 94.

What remains (with G3), by what it is:

| wall             | spurious | junk                          | paper (separation, assembly, labels)                         |
| ---------------- | -------- | ----------------------------- | ------------------------------------------------------------ |
| 201646           | 5        | 1 (printed band)              | 2 halves of a wide note, 2 note-plus-box / fragment          |
| 201707           | 2        |                               | 2 straddles                                                  |
| 201730 (shade)   | 3        | (1 real note with no label)   | 2 straddles                                                  |
| 201743 (night)   | 4        | 2 panes, racket base, jar lid |                                                              |
| wall-panorama    | 8        |                               | 2 halves, 1 fragment, 2 duplicates, 3 merged                 |
| whiteboard-dense | 9        |                               | 2 identical duplicates, 4 offset cells, 2 merged, 1 fragment |

Junk is down to 5 boxes (6 with the unlabelled note), each one of a kind on
its wall. Precision to 95% on 201646, the panorama and the whiteboard now
waits on separation: the wide-note halves, the duplicate grid cells, the
merged actor pairs.

## Open questions (other groups' files, and the labels)

- **`detect.ts` (H):** wire `dropSurfaces` (the two lines above).
- **`split.ts` / `necks.ts` (I):** a sprawl's grid cells cover a separate
  component inside its bounding box, which is cut again: identical duplicate
  boxes (3 spurious) and offset chains on the whiteboard.
- **`split.ts` (I):** wide notes (about 1.7:1) are cut in two on 201646 and
  the panorama (4 spurious, 2 missed notes).
- **Labels (operator):** 201730's pink note cut by the right edge (around
  x 974, y 342 at 1000px) has no label and scores as spurious.
