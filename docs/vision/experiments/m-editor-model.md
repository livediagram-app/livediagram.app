# Experiments, group M: the boundary model in the editor

Group J ([j-hybrid.md](j-hybrid.md)) showed the classical detector corrected by
group E's learned boundary model scores TOTAL 95.5 against 94.1 in Node. This
group puts that hybrid into the editor's photo import, in the browser, and
proves the boxes the running editor shows are the sweep's boxes. Plan:
[plans/event-storming-photo-95-experiments.md](../../../plans/event-storming-photo-95-experiments.md)
(M). J's "What wiring it into the editor needs" is the specification.

Tables give, per wall, **precision / recall without actors / merged boxes**;
TOTAL is F1 / merged.

## The short answer

The editor now runs the hybrid: TOTAL **94.1 → 95.5** in the editor, merged
**20 → 16** (no real merge left), 2/8 walls, and every box the review shows
sits where Node's hybrid puts it (largest offset 0.0003 px, on WASM and on
WebGPU). With the weights blocked the editor falls back to the classical
detector and equals the classical sweep, box for box. The editor's own chunks
grow by 1.1 KB gzip; the model's runtime (361 KB brotli on WASM, the WASM
binary and the weights included) is fetched only by a worker, only when a
photo import starts.

## The design

```text
picker opens ──► warmBoundaryModel() ──► Worker (lazy chunk)
                                           ├─ tfjs-core, tfjs-layers
                                           ├─ WebGPU backend, if an adapter exists
                                           │   else WASM backend, one thread
                                           └─ weights.bin (hashed asset), model.json
photo chosen ──► detectAndCrop
                  ├─ working image (1000 px)
                  ├─ boundaryCuesFor(image)  ──► worker: pad → predict → crop → cuesOf
                  │     ok: cues             ◄──
                  │     or a reason (no-worker, no-backend, load-failed,
                  │                  inference-failed, timeout 8 s)
                  └─ detectStickies(image, { model: { cues, rules: HYBRID_RULES } })
                     or detectStickies(image) alone, with the reason logged
```

- `packages/sticky-model/src/index.ts` is the browser-safe entry: cues,
  decode, mask and `stride.ts` (RGBA to RGB floats, edge-repeated padding to
  the U-Net's stride of 16, the crop back). The Node inference frames the
  photo through the same `stride.ts`, so the two cannot drift.
- `sticky-vision`'s `index.ts` exports `hybrid.ts` and `model-cues.ts`.
- `apps/live/lib/photo-model/`: `protocol.ts` (the closed backend and failure
  vocabularies, the messages), `client.ts` (one worker per page; every failure
  resolves to a reason, a runtime that could not load stays failed for the
  page), `boundary.worker.ts`, `runtime.ts` (backend choice, weights),
  `telemetry.ts`, `weights/` (`quantise.ts --min-elements 0` over E's
  `synth-v1`: synthetic-only, 83 KB).
- `photo-detect.ts` asks for the cues and passes them on; `PhotoDetection`
  carries `detector` (`hybrid` + backend, or `classical` + reason).
- Telemetry: `AI`·`Used`·`PhotoDetectHybridWebGpu | PhotoDetectHybridWasm |
PhotoDetectClassical{NoWorker|NoBackend|LoadFailed|InferenceFailed|Timeout}`,
  once per photo.
- The review marks the overlay `data-detector` and each box `data-kind`, which
  the e2e suite and the editor sweep read.

## M5: the editor's boxes equal the sweep's (kept)

`packages/sticky-model/scripts/hybrid/editor-sweep.ts` drives a built editor
(`E2E_BASE_URL`, the e2e stack) through /new → Event storming → Add from photo
for each labelled wall, reads each `[data-testid^=note-box-]` style as
fractions of the photo, scores them with the classical sweep's `score`, then
runs Node's hybrid on the same pixels and the shipped weights and compares
box by box (id, kind, and position to 0.01 px).

| wall             | editor, WASM       | editor, WebGPU     | `sweep.ts --kept`  |
| ---------------- | ------------------ | ------------------ | ------------------ |
| 201646           | 98 / 100 / 1       | 98 / 100 / 1       | 98 / 100 / 1       |
| 201654           | 98 / 98 / 2        | 98 / 98 / 2        | 98 / 98 / 2        |
| 201707           | 98 / 100 / 0       | 98 / 100 / 0       | 98 / 100 / 0       |
| 201713           | 98 / 100 / 0       | 98 / 100 / 0       | 98 / 100 / 0       |
| 201730 (shade)   | 94 / 94 / 2        | 94 / 94 / 2        | 94 / 94 / 2        |
| 201743 (night)   | 95 / 85 / 2        | 95 / 85 / 2        | 95 / 85 / 2        |
| wall-panorama    | 95 / 96 / 1        | 95 / 96 / 1        | 95 / 96 / 1        |
| whiteboard-dense | 97 / 93 / 8        | 97 / 93 / 8        | 97 / 93 / 8        |
| **TOTAL**        | **95.5 / 16**, 2/8 | **95.5 / 16**, 2/8 | **95.5 / 16**, 2/8 |

0 boxes differ from Node on either backend; the largest offset is 0.0003 px,
the CSS percentage's own rounding. With `--no-model` (the weights request
aborted) the editor logs `classical (load-failed)` and scores TOTAL 94.1 /
20, equal box for box to the classical detector.

**Verdict: kept** (commits `0a9c85c4`, `baecca41`).

## M4: the e2e proof (kept)

`apps/live/e2e/photo-model.spec.ts`, on a wall the test draws:

- the import runs the hybrid: the weights are fetched, the model reports its
  cores from the worker, the overlay says `hybrid`;
- with the weights blocked the classical detector finds every note, and says
  `classical (load-failed)`.

**A limit it found.** On the review-flow suite's drawn walls (flat,
textureless rectangles) the hybrid lost a note: the model reads a flat pale
blue square as background (0.99 over its middle, no core in it), so J3's drop
rule removes a note the colour found. The eight labelled photographs never
show it (the rule drops no labelled note on any of them), but a screenshot of
a digital board would. It is pinned in `photo-model.spec.ts` with `test.fail`,
so it cannot start passing unnoticed; the review-flow tests in
`photo-import.spec.ts` block the model, since what they test is the review.
The rules are group N's and the model group E's; the fix belongs there (a
synthetic "flat digital sticky" style in E's generator), or in a decision on
the drop rule.

## M6: the bundle stays lazy (kept)

Built with `next build` (Turbopack), the pages' initial chunks before (commit
`7eeb87fc`) and after:

| page            | before (raw / gzip) | after (raw / gzip) | TensorFlow.js in them |
| --------------- | ------------------- | ------------------ | --------------------- |
| `/diagram/[id]` | 2161.1 / 637.2 KB   | 2164.3 / 638.3 KB  | none                  |
| `/new`          | 2375.2 / 698.9 KB   | 2378.3 / 700.0 KB  | none                  |

(The TensorFlow.js markers searched for: `WEBGPU_DEFERRED_SUBMIT_BATCH_SIZE`,
`WASM_HAS_MULTITHREAD_SUPPORT`, `CHECK_COMPUTATION_FOR_ERRORS`, `LayersModel`.)
Turbopack compiles `new Worker(new URL('./boundary.worker.ts', import.meta.url))`
into its own chunk group, and resolves `new URL('@tensorflow/tfjs-backend-wasm/
dist/….wasm', import.meta.url)` and the weights to hashed static assets under
`/live/_next/static/media/`, so the router needs no new route.

## M7: ask for an adapter before loading WebGPU (kept)

**Hypothesis.** Headless Chromium, and a browser with a blocklisted driver,
expose `navigator.gpu` with no adapter; the worker then downloads the WebGPU
backend only to fall back.

What the first import fetched (headless, WASM path; the e2e server does not
compress, the columns are what gzip and brotli would send):

| worker fetches        | raw     | gzip   | brotli |
| --------------------- | ------- | ------ | ------ |
| before (WebGPU tried) | 1627 KB | 497 KB | 419 KB |
| after (adapter asked) | 1319 KB | 425 KB | 361 KB |

of which the SIMD WASM binary is 415 / 134 / 104 KB and the weights 83 / 75 /
74 KB. The editor sweep is unchanged on both backends.

**Verdict: kept** (commit `0326c90f`).

## M8: the warm-up and the timeout (measured, kept as designed)

The runtime starts loading when the picker opens; the photo waits at most
`BOUNDARY_TIMEOUT_MS` (8 s) for the cues. A drawn 1000×563 wall, headless,
WASM, the network throttled in DevTools (the e2e server sends the runtime
uncompressed, 1.3 MB, so these are ~3.6× pessimistic), time from choosing the
file to the boxes:

| network (down, latency) | photo chosen at once       | chosen 8 s after the picker opened |
| ----------------------- | -------------------------- | ---------------------------------- |
| none                    | 1.3 s, hybrid              | 1.3 s, hybrid                      |
| 9 Mbit/s, 60 ms         | 3.8 s, hybrid              | 1.9 s, hybrid                      |
| 1.6 Mbit/s, 150 ms      | 8.9 s, classical (timeout) | 2.5 s, hybrid                      |
| 400 kbit/s, 400 ms      | 8.9 s, classical (timeout) | 8.8 s, classical (timeout)         |

The model itself runs 0.8-1.2 s a photo on one WASM thread here (0.2-0.26 s on
WebGPU, an RTX 4090, cold every page). CPU throttling in DevTools slows the
page, not the worker, so it cannot stand in for a slow device. The warm-up is
what turns a slow connection from a fall-back into the hybrid; the timeout is
what keeps a very slow one from holding the review up for more than ~9 s, and
the runtime keeps loading behind it, so the next photo gets the hybrid.

**Verdict: kept as designed.** Whether 8 s is the right wait is a product
call (a shorter one falls back more often on slow connections, a longer one
holds the review); nothing here measured a real phone.

## What to try next

1. **Flat digital notes**: add a flat, textureless style to E's synthetic
   walls (and screenshots of digital boards to the truth), then re-score the
   hybrid; or decide whether the drop rule should need a core-free box to be
   off the class mask's paper as well. Flip the pinned e2e test when it holds.
2. **A real phone and a laptop's integrated GPU**, through the editor sweep
   pointed at a device (`E2E_BASE_URL`), before the timeout is tuned.
3. **Run the classical detector in the worker too**: it is 0.2-0.5 s of main
   thread per photo; with the model already in a worker, moving it is a small
   step and frees the review's first paint.
