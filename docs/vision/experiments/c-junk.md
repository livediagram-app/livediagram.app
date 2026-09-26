# Experiments C: junk rejection

Group C of the experiment plan:
raise PRECISION by refusing boxes that are not paper (masking tape, cardboard,
the wall strip above the paper, shadow in paper seams, a window at night)
without costing recall. Code: `packages/sticky-vision/src/texture.ts`,
`src/standout.ts`; tools: `scripts/junk-features.ts`, `scripts/junk-rules.ts`,
`scripts/straightness.ts`.

Every number is from `npx tsx scripts/calibrate.ts` on the eight labelled walls
(647 notes) unless it says "LOWO": leave-one-wall-out, where a rule is fitted on
seven walls and scored on the eighth, for each wall in turn.

## Baseline (commit `a02e321c`)

| wall             | prec | recall | F1   | rec-A | merged |
| ---------------- | ---- | ------ | ---- | ----- | ------ |
| 201646           | 76%  | 83%    | 80%  | 90%   | 4      |
| 201654           | 98%  | 91%    | 94%  | 94%   | 4      |
| 201707           | 79%  | 83%    | 81%  | 83%   | 2      |
| 201713           | 89%  | 94%    | 92%  | 94%   | 0      |
| 201730 (shade)   | 90%  | 87%    | 88%  | 88%   | 2      |
| 201743 (night)   | 36%  | 51%    | 42%  | 54%   | 1      |
| wall-panorama    | 85%  | 63%    | 72%  | 62%   | 10     |
| whiteboard-dense | 96%  | 87%    | 91%  | 86%   | 17     |
| **total**        | 85%  | 82%    | 83.7 |       | 40     |

## C1: per-box features

`scripts/junk-features.ts` runs the detector on every wall and measures every
box it keeps. `src/texture.ts` holds the surface measures:

- **roughness**: mean Sobel gradient over the interior with ink (pixels darker
  than 0.8 of the paper's median) and a 2px margin round it masked out,
  divided by the paper's median brightness;
- **LBP entropy**: 8-neighbour local binary patterns on the same ink-free
  pixels, dead-band 2 grey levels, entropy / 8 bits;
- **edge sides**: per side, the largest-channel difference between a strip
  just inside and one just outside, median over six segments along the side;
  sorted weakest first (`edge0` … `edgeMax`);
- **value spread**: standard deviation of HSV value over the interior;
- **brightness**: median HSV value of the interior;
- **straightness** (`scripts/straightness.ts`): per side, the share of scan
  lines whose strongest step lies within 1.5px of a line fitted through them.

Plus the ones the pipeline already had: standout and its three parts (`dS`,
`dV`, `dH`; `standoutPartsOf`), fill, aspect, size against the frame's median
box, and frame-relative versions (value spread, roughness, brightness, edge
against the frame's median box).

## C2: what a false positive IS

A box that matches no label is not necessarily junk. Split by where it lies:

| wall             | junk (over no note) | paper (over a note: half, offset, merged) |
| ---------------- | ------------------- | ----------------------------------------- |
| 201646           | 9                   | 3                                         |
| 201654           | 0                   | 1                                         |
| 201707           | 0                   | 9                                         |
| 201713           | 1                   | 5                                         |
| 201730           | 0                   | 5                                         |
| 201743           | 35                  | 3                                         |
| wall-panorama    | 5                   | 4                                         |
| whiteboard-dense | 0                   | 10                                        |
| **total**        | **50**              | **40**                                    |

The 40 "paper" boxes are fitting faults (group B's), made of paper: no surface
test can or should refuse them. **201707's precision (79%) is entirely paper**,
so junk rejection cannot lift it; the same holds for 201730 and the
whiteboard. Real junk sits on three walls, and 35 of its 50 boxes on one
(the night wall: window panes, bare kraft, furniture). Paper boxes are left out
of all fitting below.

Distributions, 530 notes against the 50 junk boxes (before any new gate):

| feature    | note p02 | note p05 | note p50 | junk p25 | junk p50 | junk p75 |
| ---------- | -------- | -------- | -------- | -------- | -------- | -------- |
| standout   | 0.23     | 0.26     | 0.59     | 0.27     | 0.55     | 0.75     |
| fill       | 0.56     | 0.60     | 0.85     | 0.61     | 0.79     | 0.96     |
| roughness  | 0.005    | 0.005    | 0.013    | 0.015    | 0.029    | 0.048    |
| LBP        | 0.13     | 0.25     | 0.45     | 0.50     | 0.61     | 0.66     |
| edge1      | 0.014    | 0.026    | 0.125    | 0.009    | 0.016    | 0.041    |
| brightness | 0.41     | 0.49     | 0.80     | 0.38     | 0.42     | 0.57     |
| spread     | 0.038    | 0.045    | 0.092    | 0.017    | 0.047    | 0.114    |
| spread/rel | 0.52     | 0.61     | 1.01     | 0.16     | 0.45     | 1.15     |

No single feature separates: every one-threshold gate set at the other walls'
2nd note percentile loses 10 to 75 notes for 0 to 24 junk boxes. Lapped notes
of one colour have weak sides too (201713 loses 7 notes to `edge1`), and the
whiteboard's small notes are uniform and grainy by other walls' standards.

## C3: gates

### Rejected: a blind rule learner

`scripts/junk-rules.ts` fits rule lists (one or two thresholds per rule,
sequential covering, a note costing four junk boxes, a rule needing junk on two
training walls) LOWO over all features:

| setting                 | junk removed | notes lost | LOWO F1 |
| ----------------------- | ------------ | ---------- | ------- |
| singles, 4 rules        | 7            | 41         | 80.2    |
| pairs, 4 rules          | 22           | 21         | 83.2    |
| pairs, paper left out   | 17           | 16         | 83.3    |
| pairs, after both gates | 7            | 89         | 78.1    |

Every fold's rules describe the walls it saw: the night wall teaches "uniform
and edgeless", which is what the whiteboard's small notes are, and the
whiteboard fold loses 13 to 88 notes. Free search over twenty features on 50
junk boxes overfits; what generalises below are two physically motivated
rule FORMS, with only their thresholds fitted.

### Kept: dark grain (`isDarkGrain`, in `standsOut`)

Hypothesis: paper is smooth once the writing is masked out, lit or shaded;
cardboard, furniture and a window frame are grained, and seen from where the
paper is lit they are darker than paper. Neither half alone is enough (lit
paper shows its fibre, shaded paper is dark).

Rule: brightness < 0.5 AND roughness > 0.03.

- LOWO with the form fixed (support 3): every fold fits 0.023–0.026 × 0.48–0.55
  and loses **no note on any wall**; LOWO F1 85.1 → 86.5 (with the blank gate
  below), the night fold included (13 of its 21 remaining junk boxes).
- Plateau, in the sweep with the blank gate: roughness 0.025–0.035 × brightness
  0.45–0.55 all score 86.2–86.6; 0.04 falls to 86.0.

| wall             | prec    | F1          | rec-A | merged |
| ---------------- | ------- | ----------- | ----- | ------ |
| 201646           | 76 → 80 | 80 → 81     | 90    | 4      |
| 201654           | 98      | 94          | 94    | 4      |
| 201707           | 79      | 81          | 83    | 2      |
| 201713           | 89 → 93 | 92 → 94     | 94    | 0      |
| 201730 (shade)   | 90 → 92 | 88 → 89     | 88    | 2      |
| 201743 (night)   | 36 → 50 | 42 → 51     | 54    | 1      |
| wall-panorama    | 85      | 72          | 62    | 10     |
| whiteboard-dense | 96      | 91          | 86    | 17     |
| **total**        | 85 → 89 | 83.7 → 85.1 |       | 40     |

Risk: brightness is absolute. A darker, noisier photograph than the night wall
(its notes sit at brightness 0.52–0.79, roughness ≤ 0.03) could lose shaded
notes to sensor grain. The eight walls include the night and the shade photo
and lose nothing, but they are the whole evidence.

### Kept, awaiting one line in `detect.ts`: blank and edgeless (`dropBlank`)

Hypothesis: a note carries writing; a window pane, a patch of bare kraft or
the strip above the paper is blank. How much writing shows depends on the
photograph (resolution, sharpness), so blank is judged against the frame's own
boxes: a box whose value spread is under 0.3 of the frame's median box. Blank
alone refuses an unwritten sticky, which is still a note and still has an edge
on every side; so the box must also have a side barely different from beyond
it (weakest-side contrast < 0.05). A frame whose median box shows no writing
(< 0.03) is not judged at all.

- LOWO (spread ratio alone): folds fit 0.30–0.40; 23 junk removed, 1
  whiteboard note lost; with the ratio fixed at 0.3, none lost.
- Plateau: ratio 0.25–0.40 score 84.9–85.3 on its own; edge 0.03–0.10 score the
  same. No labelled note is blank below 0.39 of its frame.
- Guard: without the edge half, the sagging-row test (blank drawn notes) lost
  three notes; with it, all 66 tests pass.

Blank gate alone: total 83.7 → 85.1 (201646 76 → 80%, night 36 → 47%,
panorama 85 → 95% precision; no recall lost). Both gates:

| wall             | prec    | F1          | rec-A | merged |
| ---------------- | ------- | ----------- | ----- | ------ |
| 201646           | 76 → 83 | 80 → 83     | 90    | 4      |
| 201654           | 98      | 94          | 94    | 4      |
| 201707           | 79      | 81          | 83    | 2      |
| 201713           | 89 → 93 | 92 → 94     | 94    | 0      |
| 201730 (shade)   | 90 → 92 | 88 → 89     | 88    | 2      |
| 201743 (night)   | 36 → 68 | 42 → 58     | 54    | 1      |
| wall-panorama    | 85 → 95 | 72 → 75     | 62    | 10     |
| whiteboard-dense | 96      | 91          | 86    | 17     |
| **total**        | 85 → 92 | 83.7 → 86.5 |       | 40     |

The gate needs every box in the frame, so it runs after `standsOut` in
`detectStickies`, which is group D's file: `dropBlank` is committed and
tested, the one-line call is not.

### Rejected: weak standout and edgeless

What is left after both gates: 14 junk boxes (6 on 201646, mostly the faces
of a cardboard box; 8 on the night wall) and 35 paper boxes. "standout < 0.25
AND edge1 < 0.02" takes 5 junk and 1 note; "dS < 0.25 AND edge2 < 0.03" 5 and 0. Both rest on two walls, so no LOWO fold can fit them (each fold sees one),
and at five boxes the gain is a third of a point. Not kept.

### Rejected: edge straightness

Straightness separates on average (median side score: notes 0.74, junk 0.48)
but notes' tail runs low (p05 0.39: handwriting to the edge, lapped notes,
curled corners); as a floor at the notes' p02 it removes 2 junk for 12 notes.

### Rejected: frame-relative roughness and brightness

Dividing roughness and brightness by the frame's median box, meant to make
dark grain photograph-independent, separates worse (best: 12 junk for 5 notes
against 16 for 0 absolute): the frame's median box is itself dark on the night
wall and bright on the whiteboard, so the ratio moves the notes as much as
the junk.

### Rejected: LBP entropy

Junk is higher on average (p50 0.61 against 0.45) but the whiteboard's small
notes sit where the junk does; every LBP rule the learner found cost the
whiteboard 14 to 49 notes.

## Where precision stands, and why the bar is out of this group's reach

After both gates the remaining false positives are 14 junk and 35 paper
boxes. Refusing all 14 junk would take precision to 94%, still short of 95%,
and only 201646 and the night wall have any junk left: on the other six, every
false positive is paper.
The rest of the precision gap is fitting (group B: halves, offsets and merged
boxes), not junk.

## Next

- Wire `dropBlank` (one line in `detectStickies`, after `standsOut`).
- An unwritten sticky in the middle of a crowded patch (no side of its own
  visible) would be dropped by the blank gate; none of the 647 labelled notes
  is one, but a photo of a fresh, unwritten pad would be. Worth a guard photo.
- The remaining cardboard (201646) is smooth, lit and kraft-coloured: a note's
  shadow edge or a box-face geometry cue (a long straight edge running past
  the box) is the next thing to try, with more walls holding junk to fit it on.
- More labelled walls with junk on them: two walls of junk cannot support a
  LOWO fit of anything more specific than the two gates here.
