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

- [x] C1 Per-box features: ink-masked substrate gradient variance, LBP
      entropy, contour straightness (RDP vertex count / residual), fill,
      aspect, standout, size ratio.
- [x] C2 Measure their distributions for NOTE vs JUNK on the eight walls
      (leave-one-wall-out, so the rule is never fitted to the wall it is
      scored on).
- [x] C3 A gate — hand-written thresholds or a tiny decision tree compiled to
      TypeScript — trained leave-one-wall-out. Measure precision on 201646,
      201707, 201743 without costing recall.
      Result ([c-junk.md](../docs/vision/experiments/c-junk.md)): dark-grain
      gate kept (83.7 → 85.1), blank-and-edgeless gate kept pending one line
      in `detect.ts` (→ 86.5); 201707 has no junk, only paper (B).

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

## Round 2 — after merging A, B, C, D (commit `155d4083` + label dedupe)

Merged so far: A (CIELAB at the wall's hue, glare out of floors), B (never
merge two whole notes, notch cuts, shadow-seam cuts), C (dark-and-grained
gate, blank-and-edgeless gate), D (1000px stays; `--edge` sweep). TOTAL F1
83.7 → **88.7**, precision 85% → 94%, merged 40 → 29, walls passing 0 → 1
(201713). E (learned model) still running.

What still fails, by cause (`scripts/merged.ts`): **paper found but no box
survives** — night 19, whiteboard 18, panorama 8, shade 4; **inside a merged
blob** — panorama 10, whiteboard 5, plus 12 same-colour and 4 cross-colour
merged boxes; **no paper** — panorama 6; and 13 merged boxes that are
overlapping LABELS (for the operator to review, not for the detector).

- [x] F — **no box made** (owns `boxes.ts`, `standout.ts`, `texture.ts`,
      `detect.ts`): trace, per missed note with paper, which gate drops it
      (speck/area, size floor, fill, aspect, split pieces refused, standout,
      dark-grain, blank); fix the gates that drop notes without losing the
      precision C bought. Night and whiteboard first.
      Result ([f-nobox.md](../docs/vision/experiments/f-nobox.md)): 88.7 → 90.6,
      precision 94, merged 29 → 30, paper-no-box 54 → 31.
  - [x] F0 Drop tracer (`onDrop`) and `scripts/nobox.ts`: size floor 28, area 7,
        aspect 7, fill 6, standout 4; dark-grain and blank drop none.
  - [x] F1 Whole narrow notes (raw-mask seam test): 88.7 → 89.3.
  - [x] F2 Pads of small notes: 89.3 → 89.8.
  - [x] F3 Fused pad notes cut to join a pad: 89.8 → 90.2.
  - [x] F4 Cut by the pad's note; pads not judged for grain: 90.2 → 90.6.
  - [x] F5 Plateau re-check; pad reach off its cliff: 90.6.
  - [x] F6 Rejected: seam-cut wiring (201713 loses 2 notes), lower fill floor,
        aspect ceiling, ring without paper, lower hue floor.
- [ ] B2 — **separation, round 2** (owns `split.ts`, `contour.ts`,
      `seam.ts`): sprawling multi-note blobs still cut on an even grid (2-D
      seam search instead), the 12 same-colour merges, the 4 cross-colour ones.
      Results: [b2-separation.md](../docs/vision/experiments/b2-separation.md).
  - [x] R1 A seam only across a box two notes can fill (the seam cut stops
        cutting single notes, so detect.ts can hand it the luminance).
  - [x] R2 Necks: take a sprawling blob apart where its paper narrows to a
        corner or a sliver (checkerboards of two kinds), before the grid.
  - [x] R2b Small-pad pairs: cut at the pad's scale where the paper shows a gap.
  - [x] R3 Cross-colour boxes: trim the colour fringe a note trails along a
        neighbour of another kind (the necks' erosion, grown back only so far).
  - [x] R4 Heavily lapped pairs: trim the sliver of the note underneath.
  - [x] R5 2-D seam search in sprawling blobs (cut where the seams are, not
        where the grid falls).
  - [x] R6 Fold-back: spec/139 Phase 9, sticky-detection.md, results doc.
- [x] A2 — **colour, round 2** (owns `classify.ts`, `floors.ts`, `lab.ts`,
      `colour.ts`): the panorama's no-paper notes (small pink hotspots,
      pale pink), and the night wall's classification.
      Result ([a2-colour.md](../docs/vision/experiments/a2-colour.md)): 88.7 → 90.0,
      merged 29 → 31, no-paper notes 8 → 0.
  - [x] A2.1 Pale paper by its CIELAB distance from the wall (kept).
  - [x] A2.2 A purer wall colour from the wall's own population (rejected).
  - [x] A2.3 No hue gap between green and blue (kept).
  - [x] A2.4 The night wall under tungsten with a window (diagnosed: not colour).
  - [x] A2.5 Re-sweep of the colour constants after round 1 (no change).
  - [x] A2.6 A floor per kind of paper (rejected).
  - [x] A2.7 Pale yellow on a bright wall (rejected).

- **Held back (measured on the merged main branch):** wiring B's shadow-seam
  cut (`luminance: luminanceOf(working)` into `fitBoxes`) takes merged boxes
  29 → 25 but costs 201713 two notes (rec-A 96 → 93, PASS → FAIL). For B2 to
  refine before it is wired.
- **E, first result:** a synthetic-only boundary U-Net (85K params, 340 KB)
  scores TOTAL 92.0 against the original classical 83.5 — 201707 and 201713
  PASS, panorama 72 → 91 — with no real wall seen in training.

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
