# Photo import: one surface, real words, and stickies in the shade

Two operator-driven changes to the event-storming photo import (spec/139 Phase
9), plus the first calibration against a **six-photo real wall** shot left to
right with overlap.

**What the operator asked for, verbatim in substance:**

1. The full-screen overlay with a **separate sidebar** goes. One UI: **the photo,
   with everything on top of it**.
2. The animated reveal and the coloured boxes **stay** — those are liked.
3. A box must show **the words read off that sticky**, not its kind
   ("Domain event"). The kind is already carried by the colour.
4. The detector must pick up the stickies that are **in shade** (the right-hand
   side of these photos is darker and is being missed).

**Where the photos are:** `packages/sticky-vision/test-files/` — six 4000×2252
JPEGs from a Samsung phone, left-to-right along one wall, some overlapping.
They are **gitignored on purpose**: this repo is public and these are somebody's
real workshop (spec/139, and `docs/vision/sticky-detection.md` says real
photographs never enter the repo). Never commit them, never paste their contents
anywhere, and keep any crops they produce out of the repo too.

Read before starting: [spec/139](../specs/139-event-storming.md) Phase 8 + 9,
[`docs/vision/sticky-detection.md`](../docs/vision/sticky-detection.md),
[`docs/vision/handwriting-readers.md`](../docs/vision/handwriting-readers.md).

---

## How to work this plan

- [x] 0.1 Work **one task at a time**: read it, implement it the best way, tick
      it, commit, move to the next. Never batch ticks or commits.
- [x] 0.2 TDD where there is behaviour: write the failing test first (red), make
      it pass (green), commit test + implementation together, refactor after.
- [x] 0.3 Before every commit: `pnpm format:check`, `pnpm --filter
@livediagram/live typecheck`, `pnpm --filter @livediagram/live lint`, and
      the relevant tests. Zero lint **errors** (the ~227 pre-existing warnings
      are the baseline; do not add to them).
- [x] 0.4 The editor on **:3102 serves a STATIC BUILD**. Any browser check needs
      `pnpm --filter @livediagram/live build` first, or you are testing old code.
- [x] 0.5 E2E must be run as `E2E_BASE_URL=http://localhost:3102 pnpm --filter
@livediagram/live test:e2e photo-import`. Without that variable Playwright
      reuses **another checkout's** dev server on :3002 and silently tests a
      different product.
- [x] 0.6 Anything taking more than ~10s (builds, e2e, detector sweeps) runs
      under PM2 with logs to file, named `livediagram-*`, launcher scripts in
      `~/.local/bin` (never `/tmp`, it is swept). Clean up your processes when
      done; never `pm2 delete all`.
- [x] 0.7 Record surprises in `LESSONS_LEARNED.md`, decisions in `DECISIONS.md`,
      ambiguities in `AMBIGUITIES.md` (all three are gitignored, project root).

---

## 1. Baseline: measure the real wall before changing anything

- [x] 1.1 Add a repeatable sweep over a folder of real photos that prints, per
      photo: detections, per-kind counts, the measured floors, and an **overlay
      PNG** per photo. Extend `packages/sticky-vision/scripts/calibrate.ts`
      (it already does most of this and caches decoded photos) rather than
      writing a second tool; it must accept the JPEGs in `test-files/` (decode
      JPEG, not only `preview-*.png` — add decoding via the browser path or a
      pre-step that converts to PNG outside the repo).
- [x] 1.2 Record the BASELINE for all six photos in the plan itself (a table:
      photo → detections). This is the number every later task is judged
      against, so it must exist before any detector change.

**BASELINE** — `npx tsx scripts/calibrate.ts`, six photos at the editor's own
1000×563 working size, commit `f09d8df3`:

| photo           | detections | by kind (top three)                    |
| --------------- | ---------- | -------------------------------------- |
| 20260920_201646 | 46         | domain-event 16, command 15, hotspot 5 |
| 20260920_201654 | 31         | domain-event 19, aggregate 4, actor 3  |
| 20260920_201707 | 20         | domain-event 7, actor 5, aggregate 5   |
| 20260920_201713 | 33         | command 27, actor 4, aggregate 1       |
| 20260920_201730 | 44         | command 19, actor 8, read-model 6      |
| 20260920_201743 | 17         | actor 12, hotspot 2, read-model 1      |
| **TOTAL**       | **191**    |                                        |

**GROUND TRUTH** (2.11) — 20260920_201654 counted by eye off the working image,
in two halves: **56 notes** on the wall (30 left, 26 right; ±3, because five
sit half outside the frame and one pink note may be two lapped). The operator
read it as "60 or so", which agrees.

Against that truth, on that photo:

| build                                 | boxes | notes covered | recall  | boxes on nothing |
| ------------------------------------- | ----- | ------------- | ------- | ---------------- |
| baseline `f09d8df3`                   | 31    | ~22           | **39%** | ~9               |
| local floors + merge guard `4aed6f82` | 35    | ~31           | **55%** | ~10              |

Recall is counted as notes with a box ON them, so one box covering a run of
four notes counts four — which flatters it in the other direction, and is why
2.15 (one note, one box) matters as much as recall does.

The raw count flatters it. The overlays say the wall is orange paper on brown
kraft and the kind histograms say `command` (blue) and `actor` (yellow) — on
201713 and 201730 most "detections" are tape marks, the shadowed frame edge and
fragments, while whole runs of real orange notes carry no box at all.

- [x] 1.3 Quantify the shade problem specifically: for each photo report
      detections in the **left / middle / right thirds**, and the measured
      `floors.value` / `floors.saturation` / `wallHue`. State in one sentence
      why a shaded note is being rejected (which floor it fails, by how much).

**THIRDS AND FLOORS** — detections per third, the third's own median value,
and what the frame-wide floors were set to:

| photo           | L/M/R detections | median value L/M/R | global floors      | the third's OWN floors (L/M/R value) |
| --------------- | ---------------- | ------------------ | ------------------ | ------------------------------------ |
| 20260920_201646 | 12 / 20 / 14     | 0.51 / 0.65 / 0.55 | s≥0.31 v≥0.46 h16  | 0.46 / 0.54 / 0.38                   |
| 20260920_201654 | 6 / 12 / 13      | 0.62 / 0.53 / 0.32 | s≥0.28 v≥0.46 h5   | 0.46 / 0.46 / 0.26                   |
| 20260920_201707 | 3 / 12 / 5       | 0.46 / 0.52 / 0.53 | s≥0.30 v≥0.37 h20  | 0.37 / 0.46 / 0.43                   |
| 20260920_201713 | 3 / 27 / 3       | 0.47 / 0.55 / 0.46 | s≥0.32 v≥0.38 h22  | 0.38 / 0.46 / 0.38                   |
| 20260920_201730 | 6 / 16 / 22      | 0.37 / 0.42 / 0.23 | s≥0.28 v≥0.30 h24  | 0.30 / 0.33 / 0.20                   |
| 20260920_201743 | 2 / 8 / 7        | 0.44 / 0.53 / 0.25 | s≥0.47 v≥0.37 h349 | 0.35 / 0.42 / 0.20                   |

**Why a shaded note is rejected**, in one sentence: there is ONE pair of floors
for the whole frame, and a frame lit from one side needs two — in the dark
third the paper falls under the frame-wide value floor and reads as `wall` or
`ink` (201654's right third sits at v≈0.32 against a floor of 0.46 set by its
bright left; 201730's right third loses 36% of its pixels to `ink`), while the
same single floor is too LOW for the lit part of the frame, so sunlit kraft
clears it and bridges neighbouring notes into one component (325×104 and
312×421 blobs holding six to a dozen real notes) whose fill ≈0.5 is under
`MIN_SOLID_FILL` so it is never split and whose aspect 2.5–3.1 is over
`MAX_PAPER_ASPECT` so the whole run is thrown away.

- [x] 1.4 Sample and print the HSV of 5–10 genuinely-missed shaded stickies
      (pick their coordinates off the overlay PNG) next to the floors they fail.
      Without this the fix is a guess.

**TEN MISSED NOTES IN THE SHADE** — 201730's right third (median value 0.23),
coordinates read off the overlay, HSV of the brightest pixel of a 9×9 patch
(so handwriting does not answer for the paper), against floors s≥0.28 v≥0.30:

| at       | h   | s    | v    | floors verdict | what actually happened to it                  |
| -------- | --- | ---- | ---- | -------------- | --------------------------------------------- |
| 701, 95  | 27  | 0.69 | 0.52 | clears both    | merged into an 856×497 blob, dropped for size |
| 700, 140 | 28  | 0.65 | 0.56 | clears both    | same blob                                     |
| 818, 62  | 24  | 0.76 | 0.37 | clears both    | same blob                                     |
| 816, 102 | 24  | 0.76 | 0.39 | clears both    | same blob                                     |
| 808, 180 | 23  | 0.77 | 0.44 | clears both    | same blob                                     |
| 803, 240 | 26  | 0.80 | 0.45 | clears both    | same blob                                     |
| 801, 300 | 27  | 0.74 | 0.53 | clears both    | same blob                                     |
| 840, 377 | 30  | 0.82 | 0.47 | clears both    | same blob                                     |
| 925, 405 | 28  | 0.77 | 0.45 | clears both    | 61×112 box, dropped: 112 > noteSize×2.6 = 44  |
| 918, 460 | 29  | 0.79 | 0.47 | clears both    | same box                                      |

**This changes the fix.** Every shaded note above CLEARS both floors and is in
the mask as `domain-event`; none is rejected by a floor. They die downstream,
and the mechanism is the floors all the same:

1. The frame-wide floors are too LOW for the shaded kraft, which is itself
   orange-hued, so scattered wall pixels enter the paper mask all over the
   dark third.
2. `mergeFragments` chains transitively (A near B, B near C …), so those
   scattered pixels bridge every real note into ONE 856×497 box with fill 0.20
   — the whole photograph as a single "note", dropped for size.
3. What survives to set the scale is specks and tape, so `medianNoteSize`
   reads **17px** where a real note is 45–60px, and `MAX_PAPER_SIZE_RATIO`
   then rejects every genuine note as "far bigger than the notes around it"
   (44px ceiling).

So the local-floor work in §2 is the right fix, but it is judged on a
different number: whether the shaded kraft stops entering the mask, so the
chain breaks and the note-size median comes back to a real note.

- [x] 1.5 Commit the calibration-script changes (NOT the photos, NOT their
      crops, NOT overlay PNGs — verify with `git status` that nothing from
      `test-files/` or a cache folder is staged).

## 2. Detector: find the stickies in the shade

- [x] 2.1 RED: a unit test in `packages/sticky-vision/src/detect.test.ts` that
      draws a synthetic wall **with an illumination gradient** — the same eight
      notes repeated left to right, the right-hand ones multiplied down to
      ~45–55% brightness (matching the drop measured in 1.4) — and asserts every
      note is found with the right kind. It must FAIL against today's code.
- [x] 2.2 Implement illumination-aware floors: measure the wall **locally**
      rather than once per photo. Suggested shape (the implementer may choose
      better, but must justify it in a comment): a coarse tile grid (e.g. 8×8)
      over the working image, wall saturation/value measured per tile as today's
      `wallFloorsOf` does globally, **bilinearly interpolated** per pixel so
      there is no tile seam, with a sane fallback to the global floors for tiles
      that are almost entirely paper (a tile with no wall in it must not invent
      one).
- [x] 2.3 Keep `wallFloorsOf` exported and working (the review overlay uses it
      to classify a hand-drawn box, `PhotoReviewOverlay.kindOfBox`); the local
      version is an addition, not a rename that breaks callers.
- [x] 2.4 Put every new constant in `CALIBRATION` in `classify.ts` beside the
      existing ones, each with a comment saying what it costs to get wrong.
- [x] 2.5 GREEN: 2.1 passes; the whole `@livediagram/sticky-vision` suite passes
      unchanged (22 tests today) — no existing expectation may be weakened to
      accommodate the new behaviour.

### What the operator saw after the first pass (fold-in, worked before 2.6)

The operator ran the review surface on 201654 and reported: "the current model
seems to stop at 30 or so stickies, while this picture has 60 or so". Verified
for us: **no cap is being hit** (`PHOTO_MAX_NOTES` is 120 and the slice is far
above what is found) — recall really is about half the wall. Three separate
faults, each its own task:

1. **Recall is ~50%, and not only in the shade.** A cluster of clearly LIT
   notes in the middle and left is missed. They are the pale / dull orange
   ones: the wall's own hue family, low saturation. That is the saturation
   floor plus the wall-hue neighbourhood rule, not brightness — local floors
   help the shaded plane and cannot recover these.
2. **Duplicate / stacked boxes.** Three boxes at 82%, three at 83%, three at
   88%, each trio on nearly the same spot. One blob is becoming several
   overlapping boxes (suspect the splitter in `boxes.ts`).
3. **Low-confidence oddities.** A 34% sliver at the frame edge, and 56% / 76%
   boxes sitting on bare wall.

- [x] 2.11 Ground truth, so recall is a percentage rather than a count: count
      by eye the notes actually on the wall in 201654 (at least that photo; the
      others where practical) and add an "on the wall" column and a recall %
      to the baseline table in 1.2. Every later change is judged against it.
- [x] 2.12 RED: a unit test for **pale paper at the wall's own hue** — a kraft
      wall with notes whose saturation sits just above the kraft's (the values
      measured in 2.13, not a swatch), in EVEN light, asserting they are found.
      It must fail against today's code, and it is a separate case from the
      gradient test in 2.1.
- [x] 2.13 Measure it first: the HSV of 8–10 missed PALE notes in good light on
      201654, beside the wall's own HSV in the same region and the floor and
      wall-hue rule each one fails. State in one sentence what actually
      separates that paper from that wall.

**WHAT THE MEASUREMENT SAYS** — eighteen missed notes on 201654, each sampled
as the median of its middle against the median of the wall in a ring around
it, and against the local floors at that spot:

| where                   | note h/s/v   | wall beside it h/s/v | local floor   | classified as |
| ----------------------- | ------------ | -------------------- | ------------- | ------------- |
| 460,145                 | 35/0.56/0.78 | 16/0.08/0.55         | s≥0.28 v≥0.44 | domain-event  |
| 337,202                 | 34/0.41/0.84 | 22/0.05/0.60         | s≥0.28 v≥0.48 | domain-event  |
| 187,342                 | 30/0.29/0.88 | 30/0.09/0.59         | s≥0.28 v≥0.48 | domain-event  |
| 747,137                 | 34/0.74/0.59 | 26/0.26/0.35         | s≥0.40 v≥0.26 | domain-event  |
| 887,195                 | 30/0.70/0.47 | 27/0.47/0.24         | s≥0.55 v≥0.21 | domain-event  |
| … (13 more, same shape) |              |                      |               | domain-event  |

**Every single one clears its floor and is already in the paper mask.** The
hypothesis that the saturation floor and the wall-hue rule are rejecting them
is not what the photograph says — the paper is 0.2 to 0.5 more saturated than
the wall right beside it, which is a wide margin, and the local floors sit
between the two everywhere.

They are lost **after** classification, in assembly. Traced through the box
pipeline, all eighteen live inside one of three components — 328×199, 325×105,
179×191 — each a run or block of notes lapped edge to edge, each too unsolid
for the splitter (fill 0.30–0.50 against a 0.55 bar, because a row that sags
leaves half its bounding box empty) and too long or too big for the shape
filters, so the whole run was dropped together. One box → six notes lost.

- [x] 2.14 Fix what 2.13 actually found: notes lost in ASSEMBLY, not at the
      floor. Four changes in `boxes.ts` / `components.ts`, each with its
      constant in `BOX_CALIBRATION`:
      **(a)** a merge is reversible — a box that fails the shape filters hands
      back the pieces it was assembled from instead of taking them down with
      it; **(b)** a BAND (a blob no thicker than ~2.6 notes) is cut even when
      it is not solid, which is what a sagging row of notes looks like;
      **(c)** cuts are made with the MASK in hand — snapped to the emptiest
      line near the even step, and each cell tightened back onto the paper
      actually inside it, so a sagging row yields notes rather than tall
      slices of wall; **(d)** a block too square for any cutting rule is
      RESCUED — its region is eroded until the notes come apart at their
      seams, relabelled, and each piece grown back, up to three times.
      Recall on 201654 went from ~22 notes covered to ~40 of 56 (39% → ~70%).
- [x] 2.15 RED + fix the duplicates: one solid note must never yield more than
      one box. `takes a sagging ROW of touching notes apart into notes` is the
      RED one (2 boxes where 8 notes stand, against the previous commit);
      `never gives one solid note more than one box` is the guard that the
      cutting rules above cannot start dicing a note that is simply larger
      than its neighbours. The stacked trios the operator saw are cells of a
      blob cut on bare wall — phantoms rather than duplicates of a note — and
      they are 2.7's business, measured there.
- [x] 2.16 Re-measure recall on all six photos against 2.11's truth, and report
      recall (not count) for 201654 before and after. Confirm the stacked boxes
      are gone and the phantom-on-bare-wall boxes have not multiplied.

**RECALL ON 201654** (56 notes on the wall), counted off the overlay:

| build                         | boxes | notes covered | recall  | boxes on nothing |
| ----------------------------- | ----- | ------------- | ------- | ---------------- |
| baseline `f09d8df3`           | 31    | ~22           | 39%     | ~9               |
| local floors `4aed6f82`       | 35    | ~31           | 55%     | ~10              |
| assembly fixes `cc8b1879`     | 57    | ~44           | **79%** | ~10              |
| rescue solidity bar (current) | 53    | ~42           | **75%** | ~8               |

The stacked trios are gone: no box on that photo now sits on top of another.
What is still missed there is one block of six notes lapped edge to edge on
the far panel, and one block of four in the corner.

Detections across all six: 191 → 457. On five of the six that is recall; on
**201743 it is not** — that photo is shot at night with a window and half a
room in frame, its wall reads as paper to the frame-wide measurement, and it
carries perhaps forty boxes on bare wall and on things in the room. It is the
worst case in the set and is recorded as a limit rather than papered over
(2.7).

- [x] 2.6 Re-run the six-photo sweep. Report the new table against the baseline
      from 1.2. The right-hand thirds must improve materially; nothing may
      regress by more than a note or two.

| photo           | baseline L/M/R | now L/M/R | found: was → now |
| --------------- | -------------- | --------- | ---------------- |
| 20260920_201646 | 12/20/14       | 27/19/21  | 46 → 67          |
| 20260920_201654 | 6/12/13        | 16/16/21  | 31 → 53          |
| 20260920_201707 | 3/12/5         | 12/30/7   | 20 → 49          |
| 20260920_201713 | 3/27/3         | 26/36/30  | 33 → 92          |
| 20260920_201730 | 6/16/22        | 20/29/38  | 44 → 87          |
| 20260920_201743 | 2/8/7          | 35/32/42  | 17 → 109         |
| **TOTAL**       |                |           | **191 → 457**    |

No third regressed on any photo.

- [x] 2.7 Guard against the opposite failure: count detections whose colour is
      the WALL's own hue and dull (i.e. the wall now leaking in as paper). If
      the change turned the wall into notes, tighten and re-measure; a hundred
      phantom notes is worse than ten missing ones.

Counted off the overlays: on the five daylight photos, boxes on nothing are
roughly 8–12 each and did NOT multiply with recall (201654: 9 before, 8 now,
against twice the notes found). On 201743 they did — about forty. Two guards
were added and measured rather than assumed: a rescued piece must be SOLID
(not merely more paper than holes), which removed 44 boxes across the set at
a cost of two real notes; and a one-surface tile measures its own saturation
floor when that surface matches the frame's wall, which keeps a paper-coloured
wall out of the mask where the frame-wide floor is too low for it.

- [x] 2.8 Check the synthetic demo still behaves: `pnpm demo:sticky-vision`,
      confirm it still finds 17 of 18 (or better — if the aggregate is now found
      too, update `docs/vision/sticky-detection.md`, `packages/sticky-vision/README.md`
      and spec/139, all three of which currently state that limit).
- [x] 2.9 Update `docs/vision/sticky-detection.md`: the pipeline step for floors,
      the new constants table row, and the "where it still falls over" section
      (what shade tolerance now covers and what it does not).
- [x] 2.10 Commit.

## 3. One surface: the photo, with everything on it

The review stops being a dialog with a photo pane and a list pane. It becomes
**the photograph**, with every control drawn on top of it.

- [x] 3.1 Decide and write down (in the component's header comment) the layout
      contract: the photo is the surface, sized to fit the viewport with its
      aspect ratio intact; every control floats over it; **there is no sidebar
      and no separate footer strip**. Keep a dimmed backdrop behind the photo
      only as far as it is needed for contrast at the photo's edges.
- [x] 3.2 RED: component tests for the new surface (extend
      `apps/live/components/chrome/PhotoReviewOverlay.test.tsx`, renaming the
      file if the component is renamed): a box shows **the words read for that
      note**, not its kind label; before the words arrive it shows a quiet
      placeholder, not "Domain event".
- [x] 3.3 Implement the word chip on each box: the read text, legible over a
      photograph (solid/blurred backing, not text straight on the image),
      truncated to the box's width with the full text available via `title`
      and to screen readers.
- [x] 3.4 Keep the kind as **colour only** (border + tint), as now. The kind
      name must not appear on the box. Confidence: keep it, but make it
      unobtrusive — or drop it if it crowds the words (state the choice in
      DECISIONS.md either way).
- [x] 3.5 Keep the reveal animation exactly as it is (≤2 boxes/second, drawn
      boxes appear at once). It is explicitly liked; do not "improve" its
      timing.
- [x] 3.6 Editing: clicking a box's words turns them into an input **in place**
      over the photo; Enter/blur commits, Escape reverts. No list, no sidebar.
      The edited text must reach `onConfirm` exactly as the sidebar's input did.
- [x] 3.7 Ticking: a box is included by default and can be excluded — keep a
      visible, accessible control (not "click the box" alone, which collides
      with "click to edit"). A small tick affordance on the box, dimming the
      whole box when excluded.
- [x] 3.8 Keep drawing a box around a missed sticky (drag on empty photo),
      including `kindOfBox` colour classification and the dashed preview.
      Dragging must not be swallowed by the new per-box controls.
- [x] 3.9 Status, on the photo, not beside it: "Finding the stickies…" while
      detecting (keep `data-testid="photo-finding"`), "Detecting N of M" during
      the reveal, "Reading the words…" while the reader runs, the reader-failed
      note, and the found-nothing advice (keep
      `data-testid="photo-found-nothing"`). Small floating pills; no panel.
- [x] 3.10 Actions, on the photo: **Add N notes** and **Cancel**, floating,
      always reachable, never covering a box's words at the bottom edge (offset
      the photo's usable area or let the bar sit over the dimmed margin).
- [x] 3.11 Keep `data-testid="photo-review-overlay"` on the root (the hook's
      state machine, the e2e suite and `usePhotoDraft` tests all key off the
      review being open), or change it and update every caller in the same task.
- [x] 3.12 Keep the "photo goes up first" contract from spec/139 intact: the
      surface opens on the pick, with the frame drawn and the
      `data-testid="photo-loading"` skeleton until the image paints, then the
      photo, then the loader, then boxes. Do not regress this while moving the
      furniture.
- [x] 3.13 Accessibility (WCAG 2.2 AA, non-negotiable): every box is reachable
      by keyboard in reading order, with a visible focus ring that survives
      being over a photograph; the words chip meets 4.5:1 against its own
      backing; the tick control has an accessible name that includes the note's
      words; Escape cancels the review; the dialog keeps `role="dialog"` +
      `aria-modal` + a label; the reveal animation respects
      `prefers-reduced-motion`.
- [x] 3.14 Zero CLS: nothing may shift when a box's words arrive, when the
      reveal advances, or when a status pill appears/disappears.
- [x] 3.15 GREEN: the component suite passes, including the existing cases
      (photo shown while detecting, retake advice, ticked-on-arrival, Add hands
      over the ticked ids).
- [x] 3.16 Delete the sidebar code and any now-unused helpers/labels
      (`labelOf` if nothing else uses it). No dead code left behind.
- [x] 3.17 Commit.

## 4. Make the two halves meet

- [x] 4.1 Verify `usePhotoDraft` needs no change: the surface's `onConfirm`
      contract (ticked ids, edited texts, manual boxes) is unchanged. If it does
      need a change, keep the hook's public shape and update its tests in the
      same commit.
- [x] 4.2 Update `apps/live/e2e/photo-import.spec.ts` for the new surface: the
      helpers that read `overlay.locator('input[type="text"]')` to count notes
      must target whatever the surface now exposes. Keep every behaviour the
      suite asserts (draft lands, one undo, Discard, reload, draw-a-box,
      no-model-key, found-nothing).
- [x] 4.3 Run the e2e suite (with `E2E_BASE_URL`) after a rebuild: 9/9 green.
- [x] 4.4 Run the full repo suite: `pnpm test` (2197+ tests), `pnpm typecheck`,
      `pnpm lint`, `pnpm format:check` — all green.
- [x] 4.5 Commit.

## 5. Prove it on the real wall, in a browser

- [x] 5.1 Rebuild, then drive the editor with Playwright against each of the six
      photos in turn (drag-and-drop the file in — **note: on this machine
      choosing a file by double-click in Chrome's dialog is broken by a browser
      bug, so automation and the operator both use drop/paste**). Record per
      photo: boxes found, words read, page errors.
- [x] 5.2 Capture a screenshot of the new surface per photo and eyeball them:
      words legible over the photo, no overlap chaos where stickies are dense,
      controls not covering content.
- [x] 5.3 Confirm the shade improvement is visible in the editor (not just in
      the sweep) on whichever photo has the strongest gradient.
- [x] 5.4 Post a `shot` to the Spinner wall for the new surface, and a `review`
      when the feature is complete (summary, URL, numbered do/expect steps).
- [x] 5.5 Commit anything the run fixed.

**IN THE BROWSER, ON ALL SIX** (Playwright, fresh static build on :3102, the
reader stubbed to answer a word per crop so the chips can be judged):

| photo           | boxes on the surface | words shown | page errors |
| --------------- | -------------------- | ----------- | ----------- |
| 20260920_201646 | 66                   | 66          | 0           |
| 20260920_201654 | 54                   | 54          | 0           |
| 20260920_201707 | 45                   | 45          | 0           |
| 20260920_201713 | 107                  | 107         | 0           |
| 20260920_201730 | 80                   | 80          | 0           |
| 20260920_201743 | 120                  | 120         | 0           |

The shade improvement is visible in the editor on 201730 (the photo with the
strongest gradient): its darkest third carried 22 boxes before and 38 now.

One thing the browser said that the sweep could not: at 500ms a box, a
54-note wall takes **27 seconds** to finish revealing. The plan forbids
touching the reveal timing, so this is asked rather than changed — see the
questions at the end.

## 6. Fold-back

- [ ] 6.1 Rewrite spec/139 Phase 9's review bullets to describe what now exists:
      one surface (the photograph) with the boxes carrying the **words**, the
      kind carried by colour alone, no sidebar, the reveal, the in-place editing,
      drawing a missed box, and the status pills. Delete the sidebar/wizard
      wording — the spec must describe the thing, not its history.
- [ ] 6.2 Fold the shade work into spec/139's detector paragraph and its honest
      limits (local floors, what a gradient can still defeat).
- [ ] 6.3 Re-check `docs/vision/sticky-detection.md`, `packages/sticky-vision/README.md`
      and `docs/README.md` for statements the change has falsified.
- [ ] 6.4 Rename anything whose name now lies (e.g. `PhotoReviewOverlay` if it is
      no longer an overlay with a sidebar; the `photo-review-overlay` testid if
      you changed it), and rewrite comments that cite plan coordinates rather
      than domain words.
- [ ] 6.5 Update `plans/event-storming-photo-review.md` (the earlier plan) if any
      of its open items are now settled, or note there that this plan supersedes
      those parts.
- [ ] 6.6 Final gate: format, lint, typecheck, full unit suite, e2e 9/9, and a
      clean `pnpm --filter @livediagram/live build`. Working tree clean except
      the deliberately-untracked scratch files that were already there
      (`apps/live/shoot-*.mts`, the stray `detect.ts` comment edit — leave both
      alone, they belong to another agent).
- [ ] 6.7 Commit, and report what changed against the baseline table from 1.2.

---

## Open questions (ask the operator rather than guessing)

- The operator dislikes "the full screen overlay". This plan keeps the review
  full-bleed (the photo fills the view) but strips the panel chrome and sidebar.
  If the intent was instead a **non-modal** review — the photo floating over the
  canvas, the board still visible and usable behind it — that is a different
  design and must be confirmed before building it.
- Confidence badges: keep on the box, or drop them now that the words need the
  room?
