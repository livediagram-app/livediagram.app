# Event-storming photo review

Implements spec/139 Phase 9. The detector first (operator ruling), then the
review overlay + box drawing, then the reader abstraction with the in-browser
OCR spike. Each task lands reviewable on the board.

## 1. Detector hardening (first)

- [x] 1.1 `closePaperMask`: morphological close (dilate then erode by ~a pen stroke) on the paper mask, majority class per closed blob, wired into `detectStickies` before `labelComponents`. TDD with a thick-strokes test that currently fragments.
- [ ] 1.2 Robust note-size estimate follows the closed blobs (verify median no longer lands on fragments); keep speck/too-big thresholds honest against it.
- [ ] 1.3 Re-run `scripts/calibrate.ts` against the operator's wall photos (incl. the 2026-09-17 attachment) and record before/after note counts.

## 2. Review overlay (on the board, before anything lands)

- [ ] 2.1 New `PhotoReviewOverlay` component: the photo with every detected box coloured by kind, tickable, with per-note kind + text editing.
- [ ] 2.2 Wire it into `usePhotoDraft`: after detect+read, show the overlay instead of landing the draft; "Add N notes" lands the ticked ones as the existing `esDraft` draft; Discard/Cancel paths unchanged.
- [ ] 2.3 "No stickies found" and reader-failed states surface inside the overlay (keep the existing toast reasons).

## 3. Draw the misses

- [ ] 3.1 Draw a box on the overlay around an undetected sticky: drag to draw, colour under the box decides kind, crop goes to the reader for text, blank fallback.
- [ ] 3.2 Drawn boxes appear in the same tick list as detected ones and land through the same commit path.

## 4. Reader abstraction + in-browser OCR (no key)

- [ ] 4.1 Extract a `Reader` interface (`read(crops) -> texts`) around the existing `apiAiReadNotes` server path.
- [ ] 4.2 Spike Tesseract.js in-browser on real handwriting crops; measure legible rate vs the server model.
- [ ] 4.3 If Tesseract is not good enough: spike a TrOCR model via transformers.js (WebGPU/WASM); measure again.
- [ ] 4.4 Reader selection: in-browser OCR when no model key, server model when configured (and a fallback chain); photo import works with NO key, blank text wherever unreadable.

## 5. Fold-back

- [ ] 5.1 Rewrite spec/139 Phase 8/9 to match what shipped; drop superseded rulings and stale "no preview" text.
- [ ] 5.2 Update help article + telemetry (`AI / Used / PhotoNotes` already exists; add a review-step event if the schema needs it).
- [ ] 5.3 Delete this plan once complete (the spec survives).
