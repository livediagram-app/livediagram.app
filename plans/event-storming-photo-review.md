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

## 4. In-browser OCR (no key)

- [x] 4.1 `apps/live/lib/ocr.ts`: `readCropsInBrowser(crops, opts)` with Tesseract.js in WASM — no key, no server, no upload; blank on any failure.
- [x] 4.2 Wire `usePhotoDraft.readWords` to it, replacing `apiAiReadNotes`; drop the AI-key gate on the photo import.
- [ ] 4.3 Measure the legible rate on real handwriting crops; if Tesseract is not good enough, spike TrOCR via transformers.js (WebGPU/WASM).

## 5. Fold-back

- [x] 5.1 Rewrite spec/139 Phase 8/9 to match what shipped (overlay, animation, in-browser OCR, box drawing).
- [ ] 5.2 Update help article + telemetry (`AI / Used / PhotoNotes` already exists; add a review-step event if the schema needs it).
- [ ] 5.3 Delete this plan once complete (the spec survives).
