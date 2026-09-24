# What else could find the stickies: the research inventory

Fifty-four research agents searched the web for ways to meet the bar of
[plans/event-storming-photo-95.md](../../plans/event-storming-photo-95.md):
95% recall and precision on every labelled wall, and no merged boxes, free for
everyone, in the browser, MIT-compatible. This is what came back, de-duplicated
and judged against our MEASURED failures (151 missed notes on eight walls:
merged neighbours first, then size/fill floors, pale paper on white, small
notes among big, shade, and same-coloured junk).

The raw reports are working notes kept out of the repository. Every claim of
gain in them is the agent's estimate; nothing here counts until an experiment
on the eight walls says so.

Coverage: 34 of 54 angles reported in the first round (classical CV, browser
models, prior art, training, runtime, reading). The other 20 — rectangle
fitting and seams, light and perspective, evaluation method, VLM grounding and
the MCP/CLI path — hit a provider quota and run again after it resets; this
page is extended when they land.

## What the reports agree on

Agreement across independent angles is the strongest signal research gives.

| Finding                                                                                                                                                                                                                   | Reports that land on it                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Merged notes are cut at the **concave notches** of the blob's outline (reflex vertices, found by simplifying the contour), confirmed by a **directional brightness step** (the paper edge's shadow) along the cut         | classical-cv ×5, prior-art ×4 (incl. a 3M patent's T-junction idea), browser-models ×2, runtime ×2 |
| Plain distance-transform watershed **cannot** split flush rectangles: two touching rectangles leave no saddle in the distance field. Watershed works only when SEEDED from the known note size                            | watershed, superpixels, counting-dense, academic-papers                                            |
| Classify colour in **CIELAB**, not HSV: pale yellow on white is ΔE≈15–30 and Δb*≈20, where HSV sees a sliver of saturation                                                                                                | colour-clustering, illumination, superpixels, patents                                              |
| Flatten shade by dividing brightness by the **measured local wall** (Zhang & He style background division), never Retinex / grey-world, which turn kraft grey and break orange-vs-kraft                                   | illumination, whiteboard-digitisation, academic-papers, patents                                    |
| Junk (tape, cardboard) differs from paper in **texture and edge straightness**: gradient variance on ink-masked pixels, LBP, contour straightness                                                                         | texture-features, open-source-projects                                                             |
| At 1000px, small notes are 10–18px: **higher working resolution or tiling (SAHI)** for small notes                                                                                                                        | counting-dense, yolo-alternatives, wasm-cv-perf, workers-ai-free                                   |
| A learned model, if any, is a **tiny permissive** one: a 3-class boundary U-Net (~1.2 MB) + watershed, or NMS-free D-FINE-N (Apache, ~4 MB), trained mostly on **procedurally generated walls**, run with onnxruntime-web | browser-models ×3, training ×5, runtime ×3, prior-art ×2                                           |

## Dead ends, and why

- **Open-vocabulary models** (OWLv2, Grounding DINO, Florence-2): 155–235 MB,
  over a gigabyte of memory, seconds to a minute per photo; box-plus-NMS output
  merges touching notes; Florence-2 cannot emit more than about 150 boxes.
  Useful only on an optional desktop path.
- **SAM family as the detector**: slow and unreliable on flush same-colour
  seams. SlimSAM (16 MB) is at most a point-to-segment helper in the review.
- **Superpixels / GrabCut / RAG merging**: colour homogeneity is exactly what
  welds touching notes together.
- **Retinex, homomorphic filtering, grey-world**: destroy the kraft wall's hue.
- **OpenCV.js**: ~8 MB for algorithms that fit in a few KB of TypeScript.
- **Licences**: Ultralytics YOLO (all versions) and YOLO-World are AGPL;
  YOLO-NAS weights are non-commercial; DINO-X is a closed API.
- **Public datasets**: none resemble an event-storming wall closely enough to
  train on; our own labels plus synthetic walls are the data.

## Candidates, by the failure they target

| Target        | Candidate                                                                                                                                                      | Size / speed          | Licence    | Effort            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ---------- | ----------------- |
| Merged notes  | Contour reflex-vertex (notch) partitioning, RDP on component outlines                                                                                          | 0 KB, <2 ms           | ours       | M                 |
| Merged notes  | Directional luminance seam scoring along candidate cuts; black top-hat seam filter                                                                             | 0 KB, <10 ms          | ours       | S–M               |
| Merged notes  | Note-size-seeded, ink-masked compact watershed                                                                                                                 | ~3 KB, ~25 ms         | ours       | M                 |
| Merged notes  | 3-class boundary U-Net (core / seam / background) + watershed, trained on synthetic walls                                                                      | ~1.2 MB, 50–200 ms    | Apache/MIT | L                 |
| Merged notes  | D-FINE-N (NMS-free DETR), 1-class, tiled                                                                                                                       | ~4 MB, ~180 ms WebGPU | Apache     | L (needs PyTorch) |
| Pale on white | CIELAB chroma/lightness floors; ΔE to the local wall; b* gating                                                                                                | 0 KB, ~15 ms          | ours       | M                 |
| Pale on white | Per-photo a*b* palette from histogram peaks                                                                                                                    | 0 KB, ~5 ms           | ours       | M                 |
| Shade, night  | Wall-referenced luminance division (coarse grid)                                                                                                               | 0 KB, ~5 ms           | ours       | S                 |
| Shade, night  | CLAHE on L*                                                                                                                                                    | 0 KB, ~8 ms           | ours       | S                 |
| Junk          | Ink-masked substrate gradient variance, LBP, edge straightness; a small tree trained leave-one-wall-out                                                        | ~2 KB, <1 ms          | ours       | M                 |
| Glare         | Specular mask (V high, S low) exempted from floors                                                                                                             | 0 KB                  | ours       | S                 |
| Small notes   | Higher working resolution (1500–2500px) with the relative thresholds; or tiled detection                                                                       | —                     | ours       | S–M               |
| Reading       | PP-OCRv4 mobile recogniser (2.4 MB, Apache) or SmolVLM-256M in the browser as the free reader; a pre-flight photo-quality check (blur, pixels per note, glare) | 2–250 MB              | Apache     | M                 |

## Where each candidate is tested

[plans/event-storming-photo-95-experiments.md](../../plans/event-storming-photo-95-experiments.md)
turns these into experiments, grouped so they can run in parallel.

Results, one file per group:

- [experiments/a-colour.md](experiments/a-colour.md) - colour and light (A1-A6)
- [experiments/a2-colour.md](experiments/a2-colour.md) - colour, round 2 (A2.1-A2.7)
