# Experiments, group O: flat paper

The boundary model (group E, [e-model.md](e-model.md)) learnt photographed
walls: light, noise, paper texture. Group M ([m-editor-model.md](m-editor-model.md))
found that it reads a FLAT, textureless note as background, so the hybrid's
drop rule (J3, [j-hybrid.md](j-hybrid.md)) removes a note the colour found. A
screenshot of a digital board, or a wall drawn in a test, would lose notes.
Pinned by `apps/live/e2e/photo-model.spec.ts` ("a flat drawn note survives
the hybrid", `test.fail`). Plan:
[plans/event-storming-photo-95-experiments.md](../../../plans/event-storming-photo-95-experiments.md)
(round 6, O).

Tables give, per wall, **precision / recall without actors / merged boxes**;
TOTAL is F1 / merged. The bar for this group: the flat-note e2e test passes,
and the hybrid sweep on the eight labelled walls gets worse on NO wall.

## Where it started

Commit `85cfe9c0` (N's pad rule merged): hybrid TOTAL **95.8 / 16**, 2/8
walls, with E's `synth-v1` weights.

## O0: drawn boards, a held-out check (tool, kept)

`packages/sticky-model/scripts/flat/boards.ts` draws 62 flat boards by code
that shares nothing with the training generator: the e2e suite's two walls
exactly, and a grid of notes for each of four canvases (the e2e grey, white,
light grey, dark mode) x five note sizes (36-220 px) x three text styles (none,
typed words, the e2e suite's two marker strokes), in the editor's and a
digital whiteboard's exact fills. `scripts/flat/probe.ts` scores each: notes
drawn, found by the classical detector, found by the hybrid, and the notes the
hybrid LOST that the classical detector had (a note is found by a box at IoU
0.5 or more). 2735 notes; the classical detector finds 2554 (it misses pale
notes on the white canvas, which is its own affair).

With `synth-v1` the hybrid loses **289** of those 2554, the e2e flat note
among them (reproduced in Node exactly as the browser shows it: the blue note's
middle reads 0.99 background, no core). The loss is worst on dark mode (80 of
207 small untexted notes, every one of the 100-220 px ones) and on notes with
no text at all.

## O1: a flat style in the synthetic generator (kept)

**Hypothesis.** The model has never seen a flat note; shown walls drawn the
way a screen draws them, it learns that a flat, textureless rectangle can be
paper.

`src/synth/flat.ts`: a flat canvas (white, light grey, a pale tint, or dark
mode; a dot or line grid sometimes; connectors), notes laid out by the same
`layoutNotes` (rows, blocks, flush, lapped, small pads), upright and on whole
pixels three walls in four, flat fills (an exact digital palette, or the
photographed papers' ranges), an edge that is nothing, a thin darker line or a
small soft shadow, typed words, ruled lines, handwriting or no text, a divider
line sometimes; no light, no texture, no noise; a slight blur one wall in five
(a screenshot scaled on its way in). Notes run to 240 px, past any photograph.

`syntheticWall` draws the style per seed from its own salted stream (share
`FLAT_CHANCE` = 0.2, or `flatChance`), so every photographed wall stays byte
for byte what the photo-only generator drew (pinned by hash in
`flat.test.ts`), and a smaller share's flat walls nest inside a larger one's.
`gen-synth.ts --style photo` therefore regenerates E's `synth-v1` training set
exactly, the control below.

## O2 + O3: retraining, and what it costs the photographs

Every model scored with `sweep.ts --kept` (the settled rules) and the drawn
boards. `diff.ts` lists where a model parts from `synth-v1` on the labelled
walls.

### O2: retrain from the kept recipe (rejected)

E's recipe (seed 1, 12 000 walls, 8000 steps, Adam 2e-3 to 1e-4, seam weight 3) on the mix, against the same recipe retrained on the photo-only walls (the
control: what reseeding alone moves). fp32 weights.

| wall             | synth-v1 (baseline) | control, photo only | flat 0.2     | flat 0.1     |
| ---------------- | ------------------- | ------------------- | ------------ | ------------ |
| 201646           | 98 / 100 / 1        | 98 / 98 / 1         | 93 / 98 / 1  | 98 / 98 / 1  |
| 201654           | 98 / 98 / 2         | 98 / 100 / 2        | 98 / 100 / 2 | 98 / 100 / 2 |
| 201707           | 98 / 100 / 0        | 98 / 100 / 0        | 98 / 100 / 0 | 95 / 100 / 0 |
| 201713           | 98 / 100 / 0        | 98 / 98 / 0         | 98 / 98 / 0  | 98 / 98 / 0  |
| 201730 (shade)   | 94 / 94 / 2         | 93 / 94 / 2         | 91 / 94 / 1  | 94 / 94 / 2  |
| 201743 (night)   | 95 / 90 / 2         | 93 / 90 / 2         | 90 / 90 / 2  | 90 / 87 / 2  |
| wall-panorama    | 95 / 98 / 1         | 95 / 98 / 1         | 94 / 96 / 4  | 96 / 98 / 2  |
| whiteboard-dense | 97 / 93 / 8         | 97 / 94 / 8         | 96 / 92 / 8  | 96 / 92 / 8  |
| **TOTAL**        | **95.8 / 16**       | 95.6 / 16           | 94.5 / 18    | 95.2 / 17    |
| drawn notes lost | 289                 | 43                  | 0            | 0            |

- The control moves every wall by a note either way: the settled rules (J1's
  split at 0.86, J3's drop at 0.97, N2's pad) were swept on `synth-v1`'s own
  probabilities, and a reseeded model lands on the other side of some of them.
  It also keeps the e2e flat note: `synth-v1` losing it was partly its seed.
- Flat walls from scratch cost more than reseeding: 201646, the night wall and
  the panorama (a real merge: the small-actor pair J1 splits) all drop.

**Verdict: rejected.** The flat notes are learnt (0 lost), the photographs pay.

### O3: fine-tune the kept model (rejected)

Starting from `synth-v1`, on the same data. Plain fine-tunes on the 0.2 mix,
then DISTILLATION (`train.ts --teacher`, `src/train/distil.ts`): the flat tiles
learn from their masks, the photographed tiles from `synth-v1`'s own
probabilities, so only what the flat walls ask of the model should move.

| model                                       | TOTAL     | drawn lost | parts from synth-v1 on the eight walls              |
| ------------------------------------------- | --------- | ---------- | --------------------------------------------------- |
| fine-tune, 0.2 mix, 2000 steps, 5e-4        | 95.6 / 16 | 3          | 201654 +1, 201713 -1, 201730 +1 junk, night +2 junk |
| fine-tune, 0.2 mix, 1000 steps, 3e-4        | 95.2 / 17 | 2          | as above, and the panorama pair merged              |
| distil, 1/4 flat, 2000 steps, 5e-4          | 95.3 / 17 | 4          | as above, and the panorama pair merged              |
| distil, 1/8 flat, 1000 steps, 2e-4          | 95.6 / 16 | 2          | 201654 +1, 201713 -1, night +2 junk                 |
| distil, 1/8 flat, light canvases only, 2e-4 | 95.7 / 16 | 2          | night +2 junk, whiteboard -1 junk                   |
| distil, 1/16 flat, light only, 2e-4         | 95.8 / 16 | 6          | night +1 junk, whiteboard -1 junk                   |
| **distil, 1/8 flat, light only, 1e-4**      | 95.8 / 16 | 5          | **none**                                            |
| ... the same, uint8 (what would ship)       | 95.4 / 17 | 4          | night +2 junk, the panorama pair merged             |
| distil, 1/16 flat, light only, 1e-4         | 95.8 / 16 | 7          | night +1 junk, whiteboard -1 junk (uint8 the same)  |
| distil, 1/8 flat, light only, 1e-4, seed 2  | 95.7 / 16 | 4          | night +1 junk (uint8: +2)                           |

The junk on the night wall is the same two boxes every time: window panes
(textured, not flat: 10-16 levels of spread inside) that J3 drops because
`synth-v1` reads their middles as 0.99 and 0.98 background. Every model that
learns flat notes reads them lower (0.85-0.97): learning that a pale, uniform
rectangle on a dark surround can be paper is exactly what lifts a lit pane
at night. Dark-mode canvases pull hardest (dropping them halves the shift);
a lower learning rate pulls less. One setting holds every wall in fp32, at
0.974 / 0.973 against the rule's 0.97, and loses it to uint8 rounding; its
neighbours (a smaller flat share, another seed) do not hold. A lone best
value three thousandths from a threshold is not a plateau.

**Verdict: rejected.** Option 1 cannot hold every wall. What it does show:
the flat notes themselves are easy (1000 gentle steps keep all but a handful
of 2554 drawn notes), and the cost is entirely in the rules' knife edges.

## O6: do not ask the model about a flat image (kept)

**Hypothesis.** A photograph and a drawing are told apart by one number,
before the model runs: a camera leaves almost no two neighbouring pixels
exactly equal, a screen fills whole regions with one colour. A flat image goes
to the classical detector alone, which finds every drawn note the hybrid
would have kept (it is the detector the hybrid corrects).

`isFlatImage` (`sticky-model/src/flatness.ts`): the share of horizontally
neighbouring pixel pairs with exactly equal RGB, flat at 0.6 or more.

| image                                | share of equal neighbours |
| ------------------------------------ | ------------------------- |
| the eight labelled walls             | 0.09-0.30 (whiteboard)    |
| the 62 drawn boards                  | 0.95-1.00                 |
| synthetic flat walls, 256 px (300)   | 0.63-1.00 (median 0.94)   |
| the e2e walls with 3 levels of grain | 0.00                      |

Any threshold from 0.31 to 0.95 splits the two real sets alike; 0.6 sits in
the middle of that plateau, above the densest synthetic flat walls' floor.

The editor (`apps/live/lib/photo-detect.ts`) checks it first: a flat image
logs `[photo-detect] classical (flat-image)`, the review marks the overlay
`classical`, telemetry counts `PhotoDetectClassicalFlatImage`. The Node sweep
and the editor sweep's Node side ask the same question.

| wall             | hybrid sweep (`--kept`) | editor sweep, WASM (port 3302) |
| ---------------- | ----------------------- | ------------------------------ |
| 201646           | 98 / 100 / 1            | 98 / 100 / 1                   |
| 201654           | 98 / 98 / 2             | 98 / 98 / 2                    |
| 201707           | 98 / 100 / 0            | 98 / 100 / 0                   |
| 201713           | 98 / 100 / 0            | 98 / 100 / 0                   |
| 201730 (shade)   | 94 / 94 / 2             | 94 / 94 / 2                    |
| 201743 (night)   | 95 / 90 / 2             | 95 / 90 / 2                    |
| wall-panorama    | 95 / 98 / 1             | 95 / 98 / 1                    |
| whiteboard-dense | 97 / 93 / 8             | 97 / 93 / 8                    |
| **TOTAL**        | **95.8 / 16**, 2/8      | **95.8 / 16**, 2/8             |

Every wall as before (none is flat), 0 boxes differ from Node, largest offset
0.0003 px. Drawn boards: 0 of 2554 notes lost as shipped (every board is
flat). `photo-model.spec.ts` passes all four: the hybrid on a grainy wall, the
classical fall-back with the weights blocked, a flat drawn pair (classical,
both notes; was `test.fail`), and the same pair with grain (the hybrid keeps
both: with 3 levels of grain `synth-v1` sees them). The shipped weights stay
`synth-v1` uint8.

**Verdict: kept.** The walls are untouched by construction; the flat case is
fixed by construction. What it gives up: on a flat board the model's ADD rule
no longer finds the pale notes the classical detector misses on a white
canvas (with a flat-trained model the hybrid found 45-51 more of the 2735
drawn notes than the classical detector). That is the classical detector's own gap, measured here.

## What to try next

1. **The rules' knife edges.** J1 (0.86, margin 0.03) and J3 (0.97, a pane at
   0.98) were swept on one model's probabilities, and any retrained model,
   even `synth-v1`'s own recipe reseeded, crosses them on some wall. Sweeping
   the rules over several models at once (seeds, and the distilled flat
   model) would find settings that hold for a family; then the flat-trained
   model could ship and flat boards get the model's additions too.
2. **Real screenshots.** The drawn boards are code-drawn; a handful of real,
   licence-clean screenshots of digital boards (anti-aliased text, JPEG)
   would check `isFlatImage` where it matters, and the classical detector's
   white-canvas gap.
3. **Photographs of a screen** read as photographs and reach the model; not
   measured.
