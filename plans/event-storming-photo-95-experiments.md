# Experiments: every sticky, once

Parent plan: [event-storming-photo-95.md](event-storming-photo-95.md) (the bar).
Inventory: [docs/vision/research.md](../docs/vision/research.md).

Every experiment is judged the same way, in its group's own worktree:

```bash
cd packages/sticky-vision && npx tsx scripts/calibrate.ts   # per-wall table, TOTAL, merged, PASS/FAIL
npx vitest run                                              # the guard tests: never weakened
```

**A change is kept only if** the TOTAL rises (or merged boxes fall), NO wall's
F1 or rec-A drops by more than one note's worth, every guard test passes, and
the setting that won sits on a plateau of equally good values (a lone best
value on eight photos is overfitting). Negative results are recorded as
carefully as positive ones. Every kept change is committed with its table.

Baseline (commit `145171f1`): TOTAL F1 83.7%, merged 40, 0/8 walls pass.

## Groups — parallel, one worktree and branch each

Files are split so groups do not edit the same code. A group that needs to
touch another group's file stops and asks.

### A — colour and light (`classify.ts`, `floors.ts`, `colour.ts`, new `lab.ts`)

- [x] A1 CIELAB conversion (tested, fast: typed arrays, lookup tables).
- [x] A2 Classify paper by CIELAB distance from the LOCAL wall (chroma and
      lightness floors per tile) instead of HSV saturation floors; keep the
      hue bands for the KIND. Measure pale-on-white (whiteboard, panorama) and
      pale-on-kraft recall.
- [x] A3 Wall-referenced luminance division (brightness ÷ local wall
      brightness, coarse grid) before classification. Measure 201730 (shade)
      and 201743 (night).
- [x] A4 CLAHE on L* as an alternative or complement to A3.
- [x] A5 Per-photo a*b* palette from histogram peaks: kinds learnt from the
      photo, catalogue as the prior.
- [x] A6 Specular glare mask (whiteboard): glare pixels excluded from floors.

### B — separation (`split.ts`, new `contour.ts`, `seam.ts`)

- [x] B1 Component outlines (Suzuki–Abe border following) + RDP simplification;
      find reflex (concave) vertices.
- [x] B2 Cut merged blobs along chords between opposing notches, sized by the
      note-size prior; recurse. Measure merged boxes and recall.
- [x] B3 Score every candidate cut by a directional brightness step (the paper
      edge's shadow) along the chord, handwriting masked out; cut only where the
      seam is real.
- [x] B4 Black top-hat (1×k) seam filter to find flush seams with no notch.
- [x] B5 Note-size-seeded, ink-masked compact watershed as an alternative
      splitter; compare with B2+B3.

### C — junk rejection (`standout.ts`, new `texture.ts`)

- [ ] C1 Per-box features: ink-masked substrate gradient variance, LBP
      entropy, contour straightness (RDP vertex count / residual), fill,
      aspect, standout, size ratio.
- [ ] C2 Measure their distributions for NOTE vs JUNK on the eight walls
      (leave-one-wall-out, so the rule is never fitted to the wall it is
      scored on).
- [ ] C3 A gate — hand-written thresholds or a tiny decision tree compiled to
      TypeScript — trained leave-one-wall-out. Measure precision on 201646,
      201707, 201743 without costing recall.

### D — resolution and tiling (`detect.ts`, `scripts/calibrate.ts` options)

- [x] D1 Sweep the working size (1000 / 1500 / 2000 / 2500 px long edge) with
      the relative thresholds as they are now; per-wall table for each; time
      per photo.
- [x] D2 Tiled detection for small notes: detect on overlapping tiles at a
      higher resolution, merge the boxes; compare with D1 on the panorama and
      the whiteboard.
- [x] D3 Decide the working size (or rule: e.g. by estimated note size) and
      what it costs on a phone.

### E — a learned boundary model (new `packages/sticky-model/`, no product code)

- [ ] E1 Procedural synthetic wall generator in TypeScript (canvas): kraft,
      white paper and whiteboard backings; the eight paper colours; lapped and
      2×2 clusters with shadow seams; handwriting strokes; tape and cardboard
      distractors; shade gradients; perspective. Emits image + 3-class mask
      (note core / seam / background) + boxes.
- [ ] E2 A tiny 3-class U-Net (MobileNetV3-small style, ~1–2 MB) trained with
      TensorFlow.js (tfjs-node-gpu if the GPU works, else CPU) on synthetic
      walls, plus tiles of the eight real walls with leave-one-wall-out.
- [ ] E3 Post-process: core components + seam-aware watershed → boxes; score
      with the same sweep (a script that runs the model in node).
- [ ] E4 Report: per-wall table, model size, node inference time, and an
      honest verdict on whether it can beat the classical pipeline.

## Not yet delegated

- **D-FINE-N / RT-DETR fine-tuning**: needs PyTorch, i.e. Python, which the
  house rules forbid. Waiting for the operator.
- **Reading upgrades** (PP-OCRv4 / SmolVLM in the browser, photo-quality
  pre-check): after detection meets the bar; needs word truth.
- **Round 2**: the 21 late research angles (rectangle fitting, seams, light,
  perspective, evaluation, VLM grounding, MCP/CLI) feed new experiments here.

## Merging (the parent session)

- [ ] M1 Merge the groups' winning commits one at a time onto
      `es-photo-lanes-docking`, re-scoring after each (gains interact).
- [ ] M2 Browser run on all eight photos after each merge that changes
      detection.
- [ ] M3 Iterate: a new round of experiments on what still fails, until the
      bar is met or a wall is shown, with numbers, to be beyond what its
      photograph can give.
