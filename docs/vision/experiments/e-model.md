# Experiment group E: a learned boundary model

Can a tiny learned model find the sticky notes on our eight labelled walls
better than the classical pipeline (`packages/sticky-vision`), above all
where notes touch? Code: [`packages/sticky-model`](../../../packages/sticky-model/README.md).
Plan: [event-storming-photo-95-experiments.md](../../../plans/event-storming-photo-95-experiments.md),
group E. Bar: [event-storming-photo-95.md](../../../plans/event-storming-photo-95.md).

Every number here comes from the same scorer and bar as the classical sweep
(`sticky-vision/scripts/truth.ts`: `score`, `meetsBar`), on the same 1000px
working images, against the truth as it stood on the day (645 notes: two
duplicate whiteboard labels were removed upstream during the run, so the
classical baseline is re-measured below rather than quoted).

## The short answer

Yes on quality, no on the bar, and the bar's merged count needs a second
look. The model is **84 859 parameters (331 KB fp32)**.

- A small U-Net trained on **procedurally generated walls only** (it never
  saw a real one) scores **TOTAL F1 92.0% against the classical 83.5%** (92.3% retrained from another seed) and
  raises every one of the eight walls. It passes the bar on 2 walls with one
  seed and none with the other, so those passes are not to be relied on.
- The synthetic walls are the reason: the same network trained on the real
  walls alone (leave-one-wall-out) scores 82.5%, below the classical
  pipeline, and fine-tuning the synthetic model on them adds nothing.
- It **merges almost nothing**: 1 box on all eight walls matches no label and
  holds two, against the classical detector's 9.
- The official merged count stays high (16–26) because **the labels
  themselves score 29**: a correct box for a note stuck more than half over
  another holds the other note's centre. No detector can reach "merged = 0"
  on six of the eight walls under today's definition (see [the merged
  measure](#the-merged-measure-cannot-reach-zero)).

## Baseline (re-measured, 645 notes)

`npx tsx scripts/score-classical.ts` — the classical detector through the
model's table, with the two supplementary merged columns explained below.

| wall             | prec | recall | F1    | rec-A | merged | real | floor | bar     |
| ---------------- | ---- | ------ | ----- | ----- | ------ | ---- | ----- | ------- |
| 201646           | 76%  | 83%    | 80%   | 90%   | 4      | 0    | 3     | FAIL    |
| 201654           | 98%  | 91%    | 94%   | 94%   | 4      | 1    | 2     | FAIL    |
| 201707           | 79%  | 83%    | 81%   | 83%   | 2      | 1    | 0     | FAIL    |
| 201713           | 89%  | 94%    | 92%   | 94%   | 0      | 0    | 0     | FAIL    |
| 201730 (shade)   | 90%  | 87%    | 88%   | 88%   | 2      | 1    | 2     | FAIL    |
| 201743 (night)   | 36%  | 51%    | 42%   | 54%   | 1      | 0    | 4     | FAIL    |
| wall-panorama    | 85%  | 63%    | 72%   | 62%   | 10     | 2    | 4     | FAIL    |
| whiteboard-dense | 95%  | 87%    | 91%   | 86%   | 13     | 4    | 14    | FAIL    |
| **total**        | 85%  | 82%    | 83.5% |       | 36     | 9    | 29    | **0/8** |

- `real`: merged boxes that match no label (a box that is not a correct
  detection of any single note: a genuine merge).
- `floor`: the merged count when the labels themselves are the detections.

## E1: the synthetic wall generator (kept)

**Hypothesis.** Touching notes are a geometry problem, and geometry can be
drawn with an exact answer: a generator that paints walls AND their masks
gives a model unlimited, perfectly labelled examples of the arrangements the
classical pipeline merges, without any hand labelling.

**What it is** (`packages/sticky-model/src/synth/`, pure TypeScript, no
canvas, a pure function of its seed, ~45 ms a 256px wall on one core):

- backings: kraft, white paper, whiteboard (glare), painted wall, pale blue
  paper; creases and roll joins; value-noise texture and kraft fibres;
- ten paper colours as HSV ranges (orange weighted as on real walls; the pale
  papers included), per-note curl shading, paper edge that is sometimes a
  dark line and sometimes invisible, drop shadows, grain;
- arrangements: lone notes, rows, columns and 2x2/2x3 blocks with gaps, flush
  or lapped (up to 35%), small actor pads beside notes, same colour 65% of
  the time (the case colour cannot split);
- handwriting (looping strokes in lines, kept inside the note), marker lines
  and arrows on the wall, headings, tape (also over notes), cardboard and
  printed sheets;
- the room past the wall's edge and objects standing in front of it, both
  clearing the notes they hide;
- light: exposure, colour cast, gradients, a hard shadow edge, night;
  camera: a random homography (tilt, turn, zoom), blur, noise, gamma;
- the target: note ids warped with the image, then `threeClassMask` (core /
  seam ring of max(2px, 10% of the short side) / background). A note shown
  less than 20% (v3; 30% before) or with no core is seam throughout and not
  counted.

Versions: **v1** as above; **v2** adds loose notes turned up to 45 degrees
(in the room or on the wall) and walls with a second pad at 0.25-0.42 of the
note size; **v3** adds fanned stacks (each note lapped diagonally over the
last) and ink lines drawn right across a note.

## E2 + E3: the model, the decoder, and what moved the numbers

**Model.** A U-Net over the 1000px working image, five scales (widths 16, 24,
40, 64, 96), plain 3x3 convolutions at the two finest scales and
depthwise-separable ones below, BatchNorm + ReLU, bilinear upsampling, softmax
over three classes. **84 859 parameters, 331 KB as fp32** (about 85 KB int8).
Loss: cross-entropy with the seam weighted 3x. Adam, cosine decay 2e-3 to 1e-4,
batches of 16 tiles of 256px, 8000 steps (~30 min on an RTX 4090 through
tfjs-node-gpu; 2 s a step on 28 shared CPU cores).

**Decoder** (`src/decode.ts`). Pixels with core probability at or above `t`
are core; each 4-connected core blob is one note; it is flooded outward
through seam pixels for as far as its own size says the seam reaches
(`grow`), or simply grown back by that width (`core`). Cores under
`minCore` pixels are dropped, then boxes under `minArea` of the wall's median
box area.

Every setting below is chosen from a sweep of t in 0.3-0.6, minCore in
12-100, minArea off/0.2-0.5, and must sit on a plateau.

| experiment                                 | TOTAL F1            | prec | recall | merged   | real  | walls   | verdict      |
| ------------------------------------------ | ------------------- | ---- | ------ | -------- | ----- | ------- | ------------ |
| classical baseline                         | 83.5%               | 85%  | 82%    | 36       | 9     | 0/8     | baseline     |
| v1 synthetic only, no size prior           | 88.8%               | 90%  | 88%    | 25       | -     | 0/8     | superseded   |
| **v1 synthetic only + median size prior**  | **92.0%**           | 97%  | 88%    | 26       | 1     | **2/8** | **kept**     |
| the same, trained again with seed 2        | 92.3%               | 96%  | 89%    | 26       | 1     | 0/8     | noise check  |
| seam loss weight 1.5 (best decode)         | 90.8%               | 96%  | 86%    | 23       | 2     | 1/8     | plateau (f)  |
| seam loss weight 2                         | 91.2%               | 95%  | 88%    | 27       | 3     | 1/8     | plateau (f)  |
| seam loss weight 4.5                       | 91.7%               | 96%  | 88%    | 16       | 0     | 2/8     | plateau (f)  |
| seam loss weight 6                         | 90.5%               | 94%  | 87%    | 21       | 0     | 2/8     | plateau (f)  |
| `core` decode instead of `grow` (best)     | 90.7%               | 95%  | 87%    | 27       | -     | 2/8     | rejected     |
| size prior over 4-16 nearest boxes         | -0.3..+0.7          |      |        |          |       |         | rejected     |
| mean core confidence floor 0.6-0.9, alone  | 90.7% best          | 96%  | 86%    | 25       | 1     | 0/8     | rejected     |
| ... on top of the size prior               | 92.0% best          | 98%  | 87%    | 26       | 1     | 2/8     | rejected     |
| v2 synthetic only                          | 91.6%               | 96%  | 88%    | 16       | 1     | 1/8     | rejected (a) |
| v3 synthetic only                          | 91.3%               | 95%  | 88%    | 16       | 1     | 1/8     | rejected     |
| bigger U-Net (187K params), v1+v2 walls    | 92.0%               | 95%  | 89%    | 23       | 5     | 2/8     | rejected     |
| v1 + leave-one-wall-out real fine-tune     | 92.0%               | 96%  | 88%    | 25       | 1     | 0/8     | rejected     |
| v2 + leave-one-wall-out real fine-tune     | 92.4%               | 96%  | 89%    | 23       | 1     | 1/8     | rejected (b) |
| flip test-time augmentation                | 92.3%               | 97%  | 88%    | 23       | 3     | 2/8     | rejected     |
| inference at 1.25x / 1.5x / 2x             | 91.6 / 92.6 / 91.9% |      |        | 20/18/21 | 3/0/1 | 1/1/2   | rejected (c) |
| slim U-Net (separable at every scale, 59K) | 88.1%               | 93%  | 83%    | 25       | 3     | 1/8     | rejected (d) |
| control: real walls only, leave-one-out    | 82.5%               | 93%  | 74%    | 36       | 9     | 0/8     | (e)          |

(a) v2 moves the F1-against-merged frontier out (at t 0.6, v1 89.2% with 17
merged, v2 91.6% with 16) but is mixed per wall: 201646 and 201654 lower,
panorama and whiteboard higher. (b) +0.4 over its own synthetic start and
within noise of v1 alone, while training on the private walls makes the
weights derived from them. (c) a lone peak across scales, and 2.25x the
compute. (d) about a quarter of the multiply-adds (~2.3 GMAC), for four
points of F1; still 4.6 above the classical pipeline, so it is the phone
option if the full model proves too slow there. (e) the same network and
budget (3000 steps a wall, from scratch) trained on the seven other real walls
and no synthetic ones: below even the classical pipeline, with as many genuine
merges. Seven photographs are not enough to learn from; the synthetic walls
are what the model knows. (f) the seam weight of the loss (3 in the kept
model) checked for a plateau: 2 to 4.5 all land within a point of it, 1.5 and
6 fall away; 3 sits in the middle.

### The kept model, per wall

v1 synthetic only; `grow`, t 0.4, minCore 45, minArea 0.35. Plateau: t
0.3-0.5 x minCore 12-70 x minArea 0.3-0.4 all score 90.5-91.8% TOTAL.

| wall             | prec | recall | F1    | rec-A | actors | merged | real | floor | bar     | classical F1 |
| ---------------- | ---- | ------ | ----- | ----- | ------ | ------ | ---- | ----- | ------- | ------------ |
| 201646           | 95%  | 85%    | 90%   | 93%   | 3/7    | 2      | 0    | 3     | FAIL    | 80%          |
| 201654           | 95%  | 98%    | 96%   | 98%   | 2/2    | 2      | 0    | 2     | FAIL    | 94%          |
| 201707           | 100% | 98%    | 99%   | 98%   | 0/0    | 0      | 0    | 0     | PASS    | 81%          |
| 201713           | 98%  | 98%    | 98%   | 98%   | 0/0    | 0      | 0    | 0     | PASS    | 92%          |
| 201730 (shade)   | 98%  | 92%    | 95%   | 92%   | 1/1    | 2      | 0    | 2     | FAIL    | 88%          |
| 201743 (night)   | 82%  | 56%    | 67%   | 59%   | 0/2    | 2      | 0    | 4     | FAIL    | 42%          |
| wall-panorama    | 95%  | 88%    | 91%   | 85%   | 33/36  | 4      | 0    | 4     | FAIL    | 72%          |
| whiteboard-dense | 99%  | 86%    | 92%   | 86%   | 18/19  | 14     | 1    | 14    | FAIL    | 91%          |
| **total**        | 97%  | 88%    | 92.0% |       |        | 26     | 1    | 29    | **2/8** | 83.5%        |

Every wall's F1 rises; no wall loses a note's worth. The TOTAL is robust
(retrained from another seed: 92.3%), the two passes are NOT: the seed-2
model scores the same walls within a note but gives 201707 and 201713 one
merged box each, and passes none. Merged falls 36 to 26,
and the one genuine merge left (a whiteboard pair) compares with the
classical nine.

## The merged measure cannot reach zero

`score()` calls a box merged when it holds the centres of two labelled
notes. On six walls some labelled notes are stuck more than halfway over
another (offsets of 30-50% of a note in both axes, and a few near-identical
boxes), so the upper note's own, correct box holds the lower note's centre.
Scoring the labels as if they were detections gives **29 merged boxes**
(201646: 3, 201654: 2, 201730: 2, 201743: 4, panorama: 4, whiteboard: 14):
a perfect detector fails the zero-merge bar on those six walls. The model's
official count (16-26) sits below that floor only because it sometimes boxes
the upper note tighter than its label, or misses the lower one.

The `real` column counts merged boxes that match no label, the merges a
reader would call merges. It is the fairer measure of "two notes in one box";
changing the judge is not this group's to do (see the final report).

## What still fails, and why

- **201743 (night)**: 13 of its 41 labels are tiny notes (12-16px) seen
  through the window glass. The model marks most of them as paper, but the
  wall's median-size prior removes them with the other specks; a local prior
  (nearest neighbours' median) keeps them but costs as much elsewhere. Three
  more are turned notes cut by the frame's left edge.
- **whiteboard-dense**: ~13 labels are notes fallen on the dark carpet below
  the board at odd angles, and the rest of the misses sit in a tight lapped
  cluster of 18px notes (the smallest the model is trained on), where it also
  holds its one genuine merge.
- **201646**: a note with a line drawn right across it reads as two notes
  (the drawn line looks like a seam; v3's dividers fix this wall, 80 to 89%,
  but cost precision elsewhere), a tilted actor, and a heavily covered note.

## E4: size, speed, cost to run

- **Size**: 84 859 parameters; 331 KB fp32, ~85 KB int8. The weights are NOT
  committed: they live in `/tmp` (the synthetic-only ones hold nothing derived
  from the private walls and could be; the fine-tuned ones must not be).
- **Compute**: ~9 GMAC per 1000x563 photo, almost all in the plain 3x3
  convolutions at full and half resolution.
- **Node, this machine**: 200-270 ms a photo end to end on CPU (28 cores
  shared, load average ~24) or GPU; the network itself is 5-10 ms on the
  RTX 4090, the rest is JavaScript padding, copying and decoding.
- **Browser (estimate, not measured)**: ~9 GMAC is 50-150 ms on a laptop's
  WebGPU through onnxruntime-web or tfjs-webgpu, and seconds on WASM or a
  phone. The slim variant (~2.3 GMAC) would be roughly a quarter of that; in
  tfjs-node on CPU it is no faster, because the time there is JavaScript.
- **Training**: synthetic data is generated, not stored or hand-labelled;
  ~40 s for 12 000 walls on 16 cores, ~30 min to train on a consumer GPU.
- **Licences**: TensorFlow.js (Apache-2.0) for training and inference; the
  CUDA 11 / cuDNN 8 redistributables used to train are NVIDIA's and never
  shipped; the generator and model are ours (MIT). No weights from anyone
  else; nothing AGPL.

## Verdict

**A learned boundary model beats the classical pipeline on every one of our
eight walls, clearly (TOTAL F1 83.5% to 92.0%; real merges 9 to 1), trained
on synthetic walls alone, and the gain survives retraining from another seed
(92.3%). It does not meet the bar.** Recall (88% overall) is
short on the night wall and the whiteboard, for reasons listed above that
have more to do with what those photos contain (reflections, fallen notes,
18px notes) than with touching notes; and the zero-merge bar is out of any
detector's reach under today's merged definition.

The synthetic walls carry it. Trained on the real walls alone the network is
worse than the classical pipeline (82.5%), and fine-tuning the synthetic model
on the other real walls adds nothing measurable. That is good news for
privacy and for anyone self-hosting: the model that wins can be retrained from
the generator's seeds, with no photograph in its training.

## What to try next

1. Decide the merged measure: count a box as merged only when it matches no
   single label (the `real` column), or when it covers two labels by more than
   half of each. Until then "zero merged" is unattainable on six walls.
2. Put the model in the product behind a flag, as the paper finder in front of
   the classical pipeline's kind, row and reading stages: onnxruntime-web with
   WebGPU, int8, falling back to the classical detector without WebGPU.
3. A slimmer network for phones (see the slim row), then int8 and measure in a
   real browser.
4. Recall on small and loose notes: train with notes down to 10px and on
   dark floors, and find a size rule that keeps a cluster of tiny notes
   without keeping specks (neither a nearest-neighbour prior nor a
   confidence floor did).
5. Fuse with the classical detector: its colour classes are exact where the
   model's cores are unsure (pale paper on white), the model splits what it
   merges.
