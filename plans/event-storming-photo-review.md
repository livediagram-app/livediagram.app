# Event-storming photo review

Implements spec/139 Phase 9. The detector first (operator ruling), then the
review overlay + box drawing, then the in-browser OCR reader. Each task lands
reviewable on the board.

## 1. Detector hardening (first)

- [x] 1.1 `closePaperMask`: morphological close (dilate then erode by ~a pen stroke) on the paper mask, majority class per closed blob, wired into `detectStickies` before `labelComponents`. TDD with a thick-strokes test that currently fragments.
- [ ] 1.2 Robust note-size estimate follows the closed blobs (verify median no longer lands on fragments); keep speck/too-big thresholds honest against it.
- [ ] 1.3 Re-run `scripts/calibrate.ts` against the operator's wall photos (incl. the 2026-09-17 attachment) and record before/after note counts.

## 2. Review overlay (on the board, before anything lands)

The review is a THREE-STEP wizard the author walks through, each step visible:

- **Step 1 · Detect** — the photo with every detected box coloured by kind,
  tickable, and missed notes drawn by hand (task 3). Boxes fade in one at a
  time, max two a second.
- **Step 2 · Read** — the OCR text per note, editable, with legibility marked.
- **Step 3 · Place** — the ticked notes land on the canvas at their reconciled
  lanes/docked positions as the existing `esDraft`, draggable, then Add commits.

- [x] 2.1 New `PhotoReviewOverlay` component: the photo with every detected box coloured by kind, tickable, with per-note kind + text editing.
- [x] 2.2 Wire it into `usePhotoDraft`: after detect, show the overlay immediately; "Add N notes" lands the ticked ones as the existing `esDraft` draft; Discard/Cancel paths unchanged.
- [x] 2.3 "No stickies found" and reader-failed states surface inside the overlay.
- [x] 2.4 Animated detection reveal: one box at a time, max two a second, purely presentational (spec/139 Phase 9).

## 3. Draw the misses

- [x] 3.1 Draw a box on the overlay around an undetected sticky: drag to draw, colour under the box decides kind, blank fallback.
- [x] 3.2 Drawn boxes appear in the same tick list as detected ones and land through the same commit path.

## 4. Reading the handwriting (no key required)

- [x] 4.1 `apps/live/lib/ocr.ts`: `readCropsInBrowser(crops, opts)` with Tesseract.js in WASM — no key, no server, no upload; blank on any failure.
- [x] 4.2 Wire `usePhotoDraft.readWords` to it, replacing `apiAiReadNotes`; drop the AI-key gate on the photo import.
- [x] 4.3 Measure against real handwriting crops: Tesseract and TrOCR-small/base ALL garble sub-20px glyphs; Tesseract reads clear lettering CORRECTLY. Keep Tesseract.
- [x] 4.3b REVERSED by 4.7: measured across a WHOLE wall (28 crops, not hand-picked clear ones) Tesseract reads 1 note in 24 and invents words on every blank crop.
- [x] 4.4 Preprocess each crop (upscale to ~320px short side, grey, PSM single block) and keep the ORIGINAL resolution up to `CROP_MAX_EDGE_PX` 1024.
- [x] 4.5 Verify: clear marker text "Course Classes Added" reads back exactly; e2e green.
- [x] 4.6 DROPPED with Tesseract itself (4.7); the in-browser model's weights come from the HF CDN on first use and are cached, and a deployment that needs offline reading configures a server model.
- [x] 4.7 Bench every candidate reader on one real wall and record it (`docs/vision/handwriting-readers.md`): Tesseract 17% of words, TrOCR 1%, Florence-2 8%, SmolVLM-256M ~80%, a hosted model 99%.
- [x] 4.8 Pluggable reader (`apps/live/lib/reading/`): server model when the api reports one, SmolVLM-256M in the browser when not; one interface, chosen by capability, never a gate on the import.
- [x] 4.10 Open the overlay on the PICK with the photograph in it, then the loader, then the boxes; yield a frame so it paints. A 12-megapixel photo showed nothing at all before this.
- [x] 4.11 Keep the photo up when nothing is found, with the advice in the overlay rather than a toast over a closed dialog.
- [x] 4.9 Prove the model runtime is a LAZY chunk — no editor visitor downloads it, and a static export still builds.

## 5. Fold-back

> **Superseded in part.** `plans/event-storming-photo-surface-and-shade.md`
> replaced this plan's review UI: the overlay's sidebar and per-note list are
> gone, the photograph is the whole surface, and each box carries the words
> read off that sticky rather than its kind. Its detector work (local floors,
> reversible merges, the block rescue) also supersedes the "detector
> hardening" bullets above. What remains open here is 5.2 and 5.3 only.

- [x] 5.1 Rewrite spec/139 Phase 8/9 to match what shipped (overlay, animation, in-browser OCR, box drawing).
- [ ] 5.2 Update help article + telemetry (`AI / Used / PhotoNotes` already exists; add a review-step event if the schema needs it).
- [ ] 5.3 Delete this plan once complete (the spec survives).
