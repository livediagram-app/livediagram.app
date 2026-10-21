# Experiments, group J: the classical pipeline plus the learned boundary model

Can the classical detector (`packages/sticky-vision`, colour first, 96%
precise) take the separation of group E's learned boundary model
([e-model.md](e-model.md): a 85K-parameter U-Net trained on synthetic walls
only, which all but eliminated real merges) without giving up its precision?
Decided by the sweep over the eight labelled walls, for the bar of
plans/0007-event-storming-photo-95.md.
Plan: plans/0006-event-storming-photo-95-experiments.md
(J).

Every table gives, per wall, **F1 / precision / recall without actors /
merged boxes**; TOTAL is F1 / merged. "Real" merges are merged boxes that
match no label (see [e-model.md](e-model.md#the-merged-measure-cannot-reach-zero));
the rest are overlapping labels, which no detector can separate.

## The short answer

Yes. TOTAL **94.1 → 95.5**, precision 96 → 97%, recall 92 → 95%, merged
**20 → 16** with **no real merge left** (1 → 0), and no wall loses a note.
Three walls (201646, 201654, wall-panorama) now miss the bar only on
overlapping labels. The weights ship as 83 KB (int8, same score), the lazy
chunk is 141-179 KB brotli, and a photo takes ~20 ms on a desktop GPU through
WebGPU, ~0.35-0.8 s through WASM on a CPU.

## The design

`sticky-vision` stays free of any ML dependency. The model runs elsewhere
(here `packages/sticky-model`, in the product a lazy chunk) and hands over its
**cues** as plain arrays (`model-cues.ts`): one note per core blob (its box
flooded back through the seam, the core's extent, its pixel count, its mean
core probability), and the background probability per pixel.
`combineWithModel` (`hybrid.ts`) is a pure function of the classical boxes,
the cues and the class mask; `detectStickies(image, { model: { cues, rules } })`
calls it once, after the surface gate and before rows are clustered, and only
when a model was given. The kinds still come from the colour: a box the model
adds or splits off takes the most common paper class under it.

Code: `sticky-vision/src/hybrid.ts`, `model-cues.ts`, one call in `detect.ts`;
`sticky-model/src/cues.ts` (probabilities to cues), `src/quantise.ts`,
`scripts/hybrid/` (`walls.ts` caches the model's probabilities under the temp
directory; `probe*.ts`, `sweep.ts`, `quantise.ts`, `browser-bench.ts`).

```bash
cd packages/sticky-model
npx tsx scripts/hybrid/sweep.ts            # the classical table, through the hybrid path
npx tsx scripts/hybrid/sweep.ts --kept     # the kept rules (HYBRID_RULES)
npx tsx scripts/hybrid/sweep.ts --kept --grid split   # or add, drop
npx tsx scripts/hybrid/probe.ts            # what the model sees at each classical failure
```

## Where it started

Commit `454cc334`, on the editor's own pixels. The model alone is E's kept
decode (t 0.4, minCore 45, minArea 0.35) re-scored on the same pixels.

| wall             | classical              | model alone            |
| ---------------- | ---------------------- | ---------------------- |
| 201646           | 95 / 98 / 98 / 1       | 87 / 91 / 90 / 1       |
| 201654           | 98 / 98 / 98 / 2       | 97 / 96 / 98 / 2       |
| 201707           | 99 / 98 / 100 / 0      | 98 / 98 / 98 / 0       |
| 201713           | 98 / 98 / 98 / 0       | 99 / 98 / 100 / 0      |
| 201730 (shade)   | 94 / 94 / 94 / 2       | 95 / 98 / 92 / 2       |
| 201743 (night)   | 86 / 88 / 85 / 2       | 68 / 85 / 59 / 2       |
| wall-panorama    | 91 / 95 / 91 / 5       | 93 / 97 / 91 / 4       |
| whiteboard-dense | 94 / 97 / 91 / 8       | 92 / 98 / 86 / 12      |
| **TOTAL**        | **94.1 / 20** (real 1) | **92.2 / 23** (real 1) |

## J0: what the model sees where the classical detector fails (probe)

`scripts/hybrid/probe.ts`, cues at t 0.4 and minCore 12, per classical
failure:

- **Merged boxes** (20): the four same-colour small-actor pairs on the
  panorama each hold two confident model cores (0.86-0.93); the lapped pair on
  201730 and two whiteboard pairs hold one; the overlapping-label pairs vary.
  But **32 correct boxes also hold two cores**. Most are a real core and a
  speck; five are single notes the model reads as two, with both cores large
  and confident (0.72-0.91): a line drawn across the note looks like a seam.
- **Missed notes** (51): 12 have a model note of the right size on paper with
  no classical box on it; two more are overlapped by a neighbour's box.
- **Spurious boxes** (23): five sit where the model's mean background is
  0.88-1.00 (window panes, a lit strip); the most background any correct box
  shows is 0.94, on the whiteboard, and that box holds a core.

`scripts/hybrid/probe-add.ts` lists J2's candidates (cues at t 0.4): the 12
true ones have mean core confidence 0.65-0.91; of the 73 false ones, five
reach 0.7 and one 0.75 (0.83, at a fifth of the median box), so confidence
and size together separate them.

## J2: add a confident note on paper where no box is (kept)

**Hypothesis.** The classical gates drop real notes the model is sure of;
where the colour says there is paper and no box stands, the model's note is
the box.

**Rule.** A model note with mean core probability ≥ `minConfidence`, area ≥
`minAreaOfMedian` of the median box, whose box is at least `minPaper` paper
in the class mask, and not covered by a box (first: under `maxCover` of its
area under any box; J2b replaces this).

**Sweep** (120 settings, cues t 0.4): every setting scores 94.3-95.1, all at
or above the baseline. The plateau at cover 0.3: confidence 0.7-0.8 × area
0.2-0.4 × paper 0.5-0.7 all 94.4-94.7, merged 20. **Cover 0.4 reaches 94.8
(201713's last note) but adds a box holding two whiteboard notes (a real
merge): rejected.** The cue threshold t then swept under the chosen rule:
0.3-0.4 give 94.6, 0.45-0.6 give 94.7-94.8, 0.7 94.6; the core floor 12-45
changes nothing. Kept t 0.5 (`CUE_OPTIONS`), and at t 0.5 the add plateau is
94.6-94.9 around confidence 0.75, area 0.3, paper 0.5 (paper 0.4-0.6 alike).

| wall             | J2 (conf 0.75, area 0.3, paper 0.5, cover 0.3) |
| ---------------- | ---------------------------------------------- |
| 201646           | 95 / 98 / 98 / 1                               |
| 201654           | 98 / 98 / 98 / 2                               |
| 201707           | 99 / 98 / 100 / 0                              |
| 201713           | 98 / 98 / 98 / 0                               |
| 201730 (shade)   | 94 / 94 / 94 / 2                               |
| 201743 (night)   | 86 / 88 / 85 / 2                               |
| wall-panorama    | 93 / 95 / 96 / 5                               |
| whiteboard-dense | 95 / 97 / 92 / 8                               |
| **TOTAL**        | **94.8 / 20**                                  |

**Verdict: kept** (commit `833dacd5`). Eight notes found, none invented.

## J1: split a box where the model sees two notes (kept, with a thin margin)

**Hypothesis.** The classical merges that remain are pairs whose seam shows
no shadow and no step to the colour; the model, trained on exactly that,
leaves a seam between them.

**Rule.** A box holding the core centres of two or more model notes, each
with mean core probability ≥ `minConfidence` and area ≥ `minAreaOfMedian` of
the median box, becomes those notes' boxes, clipped to it. Specks beside a
sure note are ignored rather than counted.

**Sweep** (on J2):

| confidence | area 0.1 | 0.2  | 0.3  | 0.5  |
| ---------- | -------- | ---- | ---- | ---- |
| 0.70       | 92.4     | 93.8 | 94.5 | 94.8 |
| 0.75       | 93.0     | 93.9 | 94.6 | 94.8 |
| 0.80       | 94.0     | 94.4 | 94.8 | 94.8 |
| 0.85       | 94.9     | 95.1 | 95.1 | 94.8 |
| 0.90       | 95.0     | 95.0 | 95.0 | 94.8 |

Finer, at area 0.2: 0.81 94.5, 0.82 94.8, **0.83 95.1 but 201646 loses a
note** (a note with a line across it split in two), **0.84-0.87 95.1 with
merged 16 and no real merge**, 0.88 94.9 (17), 0.89 95.0 (18), 0.92 94.9 (19):
merges come back one at a time above the plateau, notes are lost at once
below it. Area: 0.1-0.15 94.9, 0.2-0.3 95.1, 0.4 94.8. Against the cue
threshold, the safe floor moves: t 0.45 → 0.85-0.87 hold, t 0.55 → 0.86-0.87,
t 0.6 → none (the mean core confidence rises with t). **0.86 holds at every t
from 0.45 to 0.55.**

The margin is the whole story: every real merge's weaker core reads 0.87 or
more, every single note the model splits 0.84 or less. `probe-split.ts`
looked for a second, physical, separator and found none: the gap between the
two cores is paper in the class mask in both (1.00), and no darker than the
cores in both (merges 0.59-1.78, single notes 0.85-1.16).

| wall             | J2 + J1 (conf 0.86, area 0.25) |
| ---------------- | ------------------------------ |
| 201646           | 95 / 98 / 98 / 1               |
| 201654           | 98 / 98 / 98 / 2               |
| 201707           | 99 / 98 / 100 / 0              |
| 201713           | 98 / 98 / 98 / 0               |
| 201730 (shade)   | 94 / 94 / 94 / 2               |
| 201743 (night)   | 86 / 88 / 85 / 2               |
| wall-panorama    | 95 / 95 / 96 / 1               |
| whiteboard-dense | 95 / 97 / 92 / 8               |
| **TOTAL**        | **95.1 / 16** (real 0)         |

**Verdict: kept** (commit `735317e9`): the four panorama small-actor pairs
are split, the panorama's one merged box left is an overlapping label. The
plateau is real but thin (0.03 of core confidence), on one wall's evidence
each side; a model trained with lines drawn across notes (E's v3) is the way
to widen it, and the first thing to re-measure with a new model.

## J3: drop a box the model sees as background (kept)

**Hypothesis.** Window panes and lit strips pass the colour floors and the
standout gate; the model calls them background.

**Rule.** A box with no model core centre inside it whose middle half has a
mean background probability ≥ `minBackground`.

| minBackground | 0.6  | 0.7  | 0.8  | 0.85 | 0.9  | 0.93 | 0.95 | 0.97 | 0.98 | 0.99 |
| ------------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| TOTAL F1      | 95.2 | 95.2 | 95.4 | 95.4 | 95.4 | 95.3 | 95.4 | 95.4 | 95.4 | 95.3 |
| recall        | 93.3 | 93.3 | 93.8 | 93.8 | 93.8 | 93.8 | 94.0 | 94.0 | 94.0 | 94.0 |

Up to 0.93 it also drops a real note (the task's condition: only at no cost
to recall); 0.95-0.98 drop the same three night-wall boxes and nothing else.
Kept 0.97.

| wall             | J2 + J1 + J3 (0.97) |
| ---------------- | ------------------- |
| 201743 (night)   | 90 / 95 / 85 / 2    |
| every other wall | unchanged           |
| **TOTAL**        | **95.4 / 16**       |

**Verdict: kept** (commit `abdab071`). The night wall is now 95% precise;
its misses are the notes seen through the window glass, 12-16 px, which the
model does see (core 38-47 px) but at a tenth of the median box, where junk
lives too.

## J2b: where a box is, told by centres (kept)

**Hypothesis.** J2's area cap (under 0.3 of the note under any box) hides a
note lapped by a neighbour's box, which is exactly what lapping does; the
cap at 0.4 found one but let in a merge. A box that is that note's business
holds its centre, or sits inside it.

**Rule.** Add when no box holds the note's centre and the note holds no box's
centre; no area cap.

| area cap with the centre test | 0.3  | 0.4  | 0.5  | 0.6  | 0.8  | none |
| ----------------------------- | ---- | ---- | ---- | ---- | ---- | ---- |
| TOTAL F1 (merged 16 in all)   | 95.4 | 95.4 | 95.5 | 95.5 | 95.5 | 95.5 |

Without the cap, the add rule's plateau: confidence 0.7-0.8 × area 0.2-0.4
all 95.3-95.6; paper 0.4-0.6 alike. J1 (0.83-0.87, area 0.2-0.3) and J3
(0.95-0.98) re-checked on top: unchanged.

| wall             | kept: J2b + J1 + J3         | before (classical)          |
| ---------------- | --------------------------- | --------------------------- |
| 201646           | 96 / 98 / 100 / 1           | 95 / 98 / 98 / 1            |
| 201654           | 98 / 98 / 98 / 2            | 98 / 98 / 98 / 2            |
| 201707           | 99 / 98 / 100 / 0           | 99 / 98 / 100 / 0           |
| 201713           | 99 / 98 / 100 / 0           | 98 / 98 / 98 / 0            |
| 201730 (shade)   | 94 / 94 / 94 / 2            | 94 / 94 / 94 / 2            |
| 201743 (night)   | 90 / 95 / 85 / 2            | 86 / 88 / 85 / 2            |
| wall-panorama    | 95 / 95 / 96 / 1            | 91 / 95 / 91 / 5            |
| whiteboard-dense | 95 / 97 / 93 / 8            | 94 / 97 / 91 / 8            |
| **TOTAL**        | **95.5 / 16** (real 0), 2/8 | **94.1 / 20** (real 1), 2/8 |

**Verdict: kept** (commit `0815f9c5`).

What still fails the bar: 201646, 201654 and wall-panorama only on
overlapping labels (merged 1, 2, 1, all "inseparable"); 201730 at 94/94 with
a lapped pair the model also reads as one note; the night wall's notes behind
the glass; the whiteboard's fallen notes and its tight lapped cluster of 18 px
notes (rec-A 93, 8 merged, 6 of them overlapping labels).

## J4: the model in the browser (measured)

**Weights.** `quantiseWeights` writes each tensor as per-tensor affine uint8
in the format TensorFlow.js dequantises on load, so the browser fetches a
quarter of the bytes and runs the same float graph:

| weights                           | weights.bin | gzip  | TOTAL (hybrid) |
| --------------------------------- | ----------- | ----- | -------------- |
| fp32 (E's synth-v1)               | 331 KB      |       | 95.5 / 16      |
| uint8 kernels, small tensors fp32 | 92 KB       | 84 KB | 95.5 / 16      |
| **uint8 everything**              | **83 KB**   |       | **95.5 / 16**  |

The probabilities moved (mean 0.002, at most 0.35 on a pixel); no box did,
the thin J1 margin included. `model.json` is 38 KB, 3 KB gzipped.

**Runtime.** `browser-bench.ts`: TensorFlow.js 4.22 core + layers + one
backend bundled and minified with esbuild, loaded in headless Chromium 153,
timing a 1000×563 ImageData to probabilities back in JavaScript (to floats,
pad to stride 16, predict, crop, read back). Warm is the median of ten runs;
cold is the first (shaders compile). This machine: 28 shared cores under
load, an RTX 4090.

| backend                         | chunk (min / gzip / br) | cold       | warm per photo         |
| ------------------------------- | ----------------------- | ---------- | ---------------------- |
| WebGPU, RTX 4090                | 821 / 210 / 171 KB      | 193-553 ms | **19-22 ms**           |
| WebGL, RTX 4090                 | 876 / 222 / 179 KB      | 2.2-2.6 s  | 171-1463 ms (unsteady) |
| WASM + SIMD, threads (isolated) | 651 / 173 / 141 KB      | 561 ms     | 356 ms                 |
| WASM + SIMD, one thread         | 651 / 173 / 141 KB      | 920 ms     | 765 ms                 |
| WebGL on SwiftShader (no GPU)   | 876 / 222 / 179 KB      | 6.9 s      | 4.0 s                  |
| WebGPU on SwiftShader           | 821 / 210 / 171 KB      | 13.5 s     | 12.9 s                 |
| plain JavaScript (cpu)          | 632 / 172 / 141 KB      | 15.8 s     | 16-26 s                |

The WASM backend also fetches its binary: 415 KB SIMD (133 KB gzip). The
cues and the combination add 11-21 ms of JavaScript per photo (the classical
detector itself is 180-460 ms here). A laptop's integrated GPU is not measured
here; ~9 GMAC a photo suggests a few hundred ms through WebGPU.

**onnxruntime-web** is not measured: converting the Keras model to ONNX needs
`tf2onnx`, a Python tool, which the house rules forbid; a TypeScript exporter
would be its own project.

**Verdict.** Affordable on a GPU (WebGPU: tens of ms, ~170 KB brotli on
first use, cached after), usable on a CPU through WASM (under a second),
unusable through WebGL without a GPU or the plain-JavaScript backend.

## What wiring it into the editor needs (done by group M: [m-editor-model.md](m-editor-model.md))

1. **Ship the weights** as a static asset of `apps/live` (the uint8
   `model.json` + `weights.bin`, ~86 KB). They are synthetic-only: reproducible
   from E's generator and seeds, nothing derived from any photo, MIT.
2. **A browser-safe home for the pure parts.** `packages/sticky-model` depends
   on `tfjs-node` and has no entry file; `cuesOf`, `decode.ts` and `mask.ts`
   (pure) need an entry the editor can import without Node, and the inference
   (`infer.ts`, edge-replicated padding to stride 16) a browser version.
3. **A lazy chunk** (dynamic `import()`) with `@tensorflow/tfjs-core`,
   `-layers` and `-backend-webgpu`, falling back to `-backend-wasm` (single
   thread: cross-origin isolation for threads would constrain the whole app).
   Start loading when the photo dialog opens, so the shader compile overlaps
   the author choosing a photo. New dependencies for `apps/live`.
4. **Run it in a Web Worker** (up to ~0.8 s on WASM), then
   `detectStickies(image, { model: { cues, rules: HYBRID_RULES } })`. Any
   failure (no backend, load error, timeout) falls back to the classical
   detector with a logged reason; never block the import on the model.
5. **Export** `hybrid.ts` and `model-cues.ts` from `sticky-vision`'s
   `index.ts` (not done here: this group changes existing modules only through
   `hybrid.ts` and one call in `detect.ts`).
6. **Telemetry**: which path detected (hybrid / classical) and which backend,
   as closed enum values; and [Event storming](../../../specs/021-event-storming/event-storming.md) Phase 9 to say the model is optional,
   lazy and local, like the detector.

## What to try next

1. **Widen J1's margin with a better model**: E's v3 walls draw lines across
   notes; score v3 (or v1 + v3 lines) through this hybrid, where the classical
   pipeline covers what v3 lost elsewhere.
2. **Settle the merged measure** (E's point, and this doc's): count only
   merges that match no label, or have the operator review the 13 overlapping
   labels; either way 201646, 201654 and wall-panorama would pass, 5/8.
3. **201730's lapped pair and the whiteboard's tight cluster**: both colour
   and model read one note; a model trained with more heavily lapped 18 px
   notes, or amodal completion from the model's seam, is where to look.
4. **Measure a laptop's integrated GPU and a phone** in a real browser before
   the wiring decides WebGPU-or-WASM.
