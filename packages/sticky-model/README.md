# @livediagram/sticky-model

An EXPERIMENT (spec/139 Phase 9, group E of
[plans/event-storming-photo-95-experiments.md](../../plans/event-storming-photo-95-experiments.md)):
can a tiny learned boundary model find the sticky notes on a wall better than
the classical pipeline in `@livediagram/sticky-vision`, above all where notes
touch? Results and verdicts:
[docs/vision/experiments/e-model.md](../../docs/vision/experiments/e-model.md).

The editor imports only `src/index.ts`, the browser-safe part (cues, decode,
mask, `stride.ts`): no TensorFlow.js, no Node. It runs the network itself, in a
Web Worker (`apps/live/lib/photo-model/`), on the uint8 weights shipped there
(`scripts/hybrid/quantise.ts --min-elements 0` over the synthetic-only
`synth-v1` model), and hands the cues to `sticky-vision`'s hybrid rules
([docs/vision/experiments/m-editor-model.md](../../docs/vision/experiments/m-editor-model.md)).

## What is in it

- `src/synth/` — a procedural event-storming wall generator (pure TypeScript,
  no canvas): backings, paper colours, rows / columns / 2x2 blocks flush and
  lapped, shadows, curl, handwriting, tape, cardboard, marker lines, the room
  past the wall, loose notes at any angle, light gradients and shadow edges,
  night, perspective, blur and noise. Every wall is a pure function of its seed.
- `src/mask.ts` — the three-class target: note CORE, the SEAM ring round each
  note, background. Touching notes' cores are always two seams apart.
- `src/decode.ts` — model output to boxes: each core blob is a note, flooded
  back through the seam; tiny cores and boxes far below the wall's median
  are dropped.
- `src/stride.ts` — the network's framing, shared by Node and the browser: RGBA
  to RGB floats, edge-repeated padding to the stride of 16, the crop back.
- `src/cues.ts` — probabilities to the plain cues the hybrid rules read.
- `src/train/tile.ts` — training tiles: crop, zoom, the eight flips/turns.
- `scripts/` — shards, the U-Net (TensorFlow.js), training, leave-one-wall-out,
  and scoring with the classical sweep's own scorer and bar.

## Running it

Everything the scripts write (synthetic shards, weights, overlays) goes to
`$STICKY_MODEL_DIR` (default `/tmp/livediagram-sticky-model`), never into the
repo: weights fine-tuned on the private walls are derived from them.

```bash
cd packages/sticky-model
scripts/install-tfjs-node.sh [--gpu]            # once: TensorFlow for Node, outside the repo
npx tsx scripts/preview-synth.ts 16            # contact sheet of synthetic walls
npx tsx scripts/gen-synth.ts --count 12000     # shards of 256px tiles
npx tsx scripts/train.ts --synth <shards> --out <dir> --steps 8000
npx tsx scripts/lowo.ts --init <dir> --synth <shards> --out <lowo-dir> --steps 1500 --lr 5e-4
npx tsx scripts/score.ts --models <dir> --t 0.4 --min-core 45 --min-area 0.35 [--overlay] [--sweep]
```

Scoring reads the private truth (`vision-model-truths`) exactly as
`sticky-vision/scripts/calibrate.ts` does.

### Why TensorFlow is installed separately

`@tensorflow/tfjs-node` and `-gpu` download libtensorflow (hundreds of MB) in
an install script. As workspace dependencies every `pnpm install`, CI
included, would pay for them; so the workspace depends only on the pure
JavaScript `@tensorflow/tfjs` (for types), and `scripts/install-tfjs-node.sh`
puts the native bindings under `$STICKY_MODEL_DIR/tfjs` (override:
`STICKY_MODEL_TF_DIR`), where `scripts/model/tf.ts` loads them from.

### On the GPU

`@tensorflow/tfjs-node-gpu` 4.22 is libtensorflow 2.9, built for CUDA 11 and
cuDNN 8. On a machine with a newer CUDA, unpack NVIDIA's redistributable
archives (cudart, cublas, cufft, curand, cusolver, cusparse 11.8 and cuDNN 8.9
for CUDA 11) into one folder and run through the wrapper:

```bash
STICKY_MODEL_CUDA_LIBS=/path/to/cuda11/lib scripts/with-gpu.sh npx tsx scripts/train.ts ...
```

`scripts/model/fast-grads.ts` re-registers three tfjs gradients (Sum, Mean,
ReLU) whose stock versions fill `ones(x.shape)` in JavaScript every step;
without it a step is six times slower on either backend.
