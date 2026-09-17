# Finding sticky notes in a photograph

How `@livediagram/sticky-vision` reads a wall, what its constants are and why,
and where it still falls over. Written while calibrating it against three
photographs of a real workshop wall; every number below was moved by that
exercise, and several of the first guesses were badly wrong in instructive ways.

Used by the event-storming photo import (spec/139 Phase 8). The model's only job
there is reading the handwriting on each detected note; everything spatial is
here, in code, where it is deterministic and testable.

## Why classical CV and not a vision model

- **The notation IS colour.** Which kind a note is comes from its paper, and a
  hue histogram knows a hue exactly while a language model estimates it.
- **Models are poor at coordinates.** A board laid out from hallucinated boxes
  needs rearranging by hand, which is the friction the import exists to remove.
- **Privacy falls out of it.** Detect locally and only crops of individual notes
  need to be sent; the room, the whiteboard behind, and whoever is standing in
  front of it stay on the machine that took the photo.
- **It is free and instant**, and it can be tested against images the tests
  draw themselves.

## The pipeline

1. **Measure the wall** (`wallFloorsOf`). The modal saturation and value of the
   lit pixels, plus the mean hue of the dull ones. A photograph of a wall is
   mostly wall, so the mode finds it whether it covers 90% of the frame or 55%.
2. **Classify each pixel** (`classifyHsv`) into a note kind, `wall` or `ink`,
   against hue bands. How saturated a pixel must be to count as paper depends on
   whether it shares the wall's hue.
3. **Connected components** (`labelComponents`) over that mask: two-pass
   union-find, because a large frame is millions of pixels and a recursive
   flood fill does not survive a phone.
4. **Fit boxes** (`fitBoxes`): merge fragments to a fixed point, drop noise,
   measure the note size, drop specks, split runs, drop non-paper shapes.
5. **Rows** (`clusterRows`): cluster centre-y, order by centre-x within a row.

## The constants, and what they cost to learn

| Constant                                    | Value             | Why                                                                                                                       |
| ------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `WALL_HUE_NEIGHBOURHOOD_DEG`                | 34                | Brown kraft paper and an orange domain event are the same hue. Near the wall's hue, only saturation separates them.       |
| `OFF_HUE_MIN_SATURATION`                    | 0.18              | Far from the wall's hue, a pale lilac policy is obviously not the wall. Requiring the full floor everywhere lost them.    |
| `MIN_PAPER_SATURATION`                      | 0.28              | A floor under the measured split, so a white-wall photo does not start calling its own shadows paper.                     |
| `PEN_STROKE_FRACTION`                       | 0.006             | The gap the merge has to close is a pen stroke, and that is knowable without any statistic — which matters, see below.    |
| `NOISE_FLOOR_FRACTION`                      | 0.008             | Half the merged boxes on a real photo are 1–5px of sensor noise, sitting exactly where a median would otherwise land.     |
| `MIN_AREA_FRACTION`                         | 0.35              | A speck, relative to the median note — measured AFTER merging, never before.                                              |
| `SPLIT_RATIO`                               | 1.9               | Above the notation's widest silhouette (300×180 = 1.67), so a policy is never sawn in half, but below two notes abutting. |
| `MIN_SOLID_FILL` / `MIN_PAPER_FILL`         | 0.55 / 0.3        | To CUT a blob it must be convincingly solid; to KEEP one it need only be more paper than holes.                           |
| `MAX_PAPER_ASPECT` / `MAX_PAPER_SIZE_RATIO` | 2.4 / 2.6         | Masking tape is a thin strip and a radiator is enormous; neither is paper.                                                |
| Hue bands                                   | see `classify.ts` | Widened to measured paper, not swatches: real greens read h≈86 where the catalogue's read-model is h≈137.                 |

## Four things that were wrong first, and are worth not repeating

- **Grey-world white balance made it worse.** On a kraft wall it takes the wall
  for a neutral surface and corrects the brown out of the whole photograph,
  moving every paper hue with it. Detections fell by three quarters. It is off
  by default; measuring the wall per photo replaced it.
- **Every statistic taken before merging describes the FRAGMENTS.** Handwriting
  cuts a note into dozens of paper pieces, so fragments outnumber notes twenty
  to one: the median is a fragment, the mode is a fragment, and the
  area-weighted "bulk" is whichever blob happens to be biggest. The merge gap is
  the one quantity knowable without a statistic — a pen stroke — so the merge
  goes first and everything else is measured after it.
- **One giant blob poisons any max-based scale.** A run of three touching notes,
  or a patch of sunlit wall, is bigger than any note; a speck filter scaled off
  the largest blob threw away every real note on one photo.
- **Splitting needs two gates and a solidity check.** Cutting whenever a blob is
  long against the note size diced single notes into four when the note size was
  dragged down by half-notes at the frame edge; cutting only on the blob's own
  aspect could not see a block of touching notes; and cutting a sprawling patch
  of wall invented dozens of notes that were never there.

## Where it still falls over

- **White and grey paper.** The notation has eight colours and none is white, so
  a white sticky reads as wall.
- **A wall corner.** The far, foreshortened plane of a two-plane photo is
  largely missed.
- **Working at 1000px, always.** The detector was calibrated at 1000px and the
  working image is now scaled there before detection (`PHOTO_MAX_EDGE_PX`); at
  2048px it found a quarter as many, and the bigger frame was not buying
  accuracy — the handwriting crops are cut from the full-resolution bitmap, so
  reading keeps every pixel. Measured in the browser on three real photos: 20,
  32 and 34 notes.
- **A sticky more than about 60% covered** reads as a fragment of whatever is
  left, or is dropped as a speck.
- **Per-wall colour conventions.** Every workshop invents its own (the
  calibration wall uses pink for hotspots and green for read models). Today that
  is one global decision plus the draft's Change kind verb; spec/139 lists a
  per-board colour legend as the real answer.

## Working on it

`packages/sticky-vision/scripts/calibrate.ts` is the loop: point it at a folder
of `preview-*.png` wall photos, and it prints per-photo detection counts, the
measured floors, per-kind histograms and a box list, and writes an overlay PNG
per photo so the result can be looked at rather than guessed at. It caches
decoded photos, so a run takes about a second.

Real photographs never enter the repo. The unit tests draw their own images and
stay under 200ms.
