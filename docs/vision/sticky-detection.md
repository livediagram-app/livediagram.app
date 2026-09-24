# Finding sticky notes in a photograph

How `@livediagram/sticky-vision` reads a wall, what its constants are and why,
and where it still falls over. Written while calibrating it against three
photographs of a real workshop wall; every number below was moved by that
exercise, and several of the first guesses were badly wrong in instructive ways.

Used by the event-storming photo import (spec/139 Phase 8). Reading the
handwriting on each detected note is a separate reader's job (in-browser OCR
since Phase 9); everything spatial is here, in code, where it is deterministic
and testable.

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

1. **Measure the wall** (`localFloorsOf`, in `floors.ts`). The modal saturation
   and value of the lit pixels, plus the mean hue of the pixels below that
   region's own paper floor. A photograph of a wall is mostly wall, so the mode
   finds it whether it covers 90% of the frame or 55%.

   Measured on a **coarse grid** (eight cells over the long side) and blended
   bilinearly, because a wall with a window at one end is two photographs as
   far as the floors are concerned: one frame-wide pair is at once too high for
   the shaded end, where paper then reads as wall, and too low for the lit end,
   where kraft reads as paper. A cell holding only ONE surface cannot tell wall
   from paper, so it keeps its own value floor (how bright it is there is
   knowable from any surface) but takes the frame's saturation floor unless its
   surface matches the frame's own wall. `wallFloorsOf` still measures the whole
   frame in one go, which is what a caller classifying a single hand-drawn box
   wants.

   Each cell also measures the wall's colour in CIELAB a*b* (`lab.ts`), as the
   mean of the same too-dull-to-be-paper pixels its hue is taken from; not the
   cell's commonest colour, because a cell mostly covered by one note is mostly
   that note. Blown-out pixels (every channel ≥ 250) are left out of every
   measurement: a lamp filling a cell would otherwise set the wall there at full
   brightness.

2. **Classify each pixel** (`classifyRgb`) into a note kind, `wall` or `ink`,
   against hue bands. How saturated a pixel must be to count as paper depends on
   whether it shares the wall's hue, and a pixel AT the wall's hue must also sit
   at least 7 a*b* units from the wall's colour: HSV saturation climbs as kraft
   falls into shade, so shadowed kraft clears the saturation floor, but in a*b*
   it is still the wall. Only those pixels pay for the CIELAB conversion.
3. **Connected components** (`labelComponents`) over that mask: two-pass
   union-find, because a large frame is millions of pixels and a recursive
   flood fill does not survive a phone.
4. **Fit boxes** (`fitBoxes`): merge fragments to a fixed point, drop noise,
   measure the note size, drop specks, split runs, drop non-paper shapes.

   **The note is measured BEFORE anything is fused** (`estimateNoteSize`, from
   the raw blobs: plausible ones only — bigger than the noise floor, more than
   half filled, not a strip), and the morphological close is then sized from
   the NOTE (`closeRadiusFor`). Sizing the close off the frame instead is what
   welded whole rows together on a close-up photograph, where the gaps between
   notes are a few pixels; the median note was then taken from the welds and
   every size-dependent rule downstream was working from a number wrong by a
   factor of two. With fewer than three plausible blobs there is nothing to
   measure and the frame-derived radius stands.

   Four more things make this survivable on a real wall, where notes are
   lapped edge to edge:
   - the merge never joins two **whole notes**: a piece at least 0.45 of a
     note thick is not a fragment, and two narrow actors a pen stroke apart
     are otherwise a solid square exactly one note in size;
   - the merge is **reversible** — a box that fails the shape filters hands
     back the pieces it was assembled from, instead of taking six real notes
     down with it;
   - a cut is made with the **mask** in hand: snapped to the emptiest line near
     the even step, and each cell tightened back onto the paper actually inside
     it, which is what turns a row of notes that SAGS (half its bounding box is
     wall) into notes rather than tall slices. **One axis at a time**, tightening
     between cuts (`split.ts`): the old rule asked an axis to be long against
     the note AND against the box's other side, and a square 2×2 block of four
     notes is never long against itself — so four notes stayed one note with
     four people's words concatenated. The seam between two notes is PREFERRED,
     not required; requiring a visible gap cost fifteen points of recall,
     because lapped paper has no gap. Seams are read from the RAW mask, since
     the close erases them;
   - a piece the length rule leaves whole (two lapped notes are often only 1.3
     to 1.6 notes long) is cut along the chord between two **notches** of its
     outline (`chords.ts`, over `contour.ts`), or along the **seam's
     shadow**: a line a little darker than the paper on both sides, the whole
     way across, with ink left out and scored by its median so handwriting
     cannot pose as one (`seam.ts`; it needs the photograph's brightness,
     which `detectStickies` does not yet hand it, so in the product the
     seam cut is inactive: see [experiments/f-nobox.md](experiments/f-nobox.md)).
     A cut stands when every piece is paper and solid, and a side thinner
     than a note (0.6 to 0.7 of one) is a sliver of the note underneath,
     dropped so it no longer inflates its neighbour's box;
   - a block too square for any cutting rule is **rescued**: its region is
     eroded until the notes come apart at their seams, relabelled, and each
     piece grown back — up to three times, and only solid pieces are kept, or a
     sunlit patch of wall yields a hundred note-sized scraps;
   - a whole component (not a cut piece) a note long but thinner than the
     size floor is a **narrow note** (`narrow.ts`): an actor, a note half
     under its neighbour, a note seen at a slant. At least half a note thick
     and 0.9 of one long, and ONE note: two small squares the close fused
     into a column still show a line of wall across their middle in the raw
     mask. A cut piece that thin keeps the ordinary floor, being a sliver.

   What the size, area and aspect gates refuse is not thrown away yet: a
   **pad of small notes** (`pads.ts`) — a far board in the photograph, a pad
   of smaller stationery — comes as a CLUSTER of like-sized, square, solid
   boxes, where scraps come alone. At least three siblings, linked one to the
   next (small kept notes count), none clipped by the frame, none over a kept
   note. A refused box beside a pad and at least 1.75 times as long as wide is
   pad notes the close fused into a row: it is cut by the pad's own note
   length (the median long side of the pad boxes near it) and each square
   joins the pad only as a sibling of it, never as a pad of its own, which
   is what a strip of tape cut into squares would be. Which gate dropped
   what is reported through `detectStickies(image, { onDrop })`.

5. **Does it stand out?** (`standsOut`, in `standout.ts`). Colour floors alone
   cannot say what is NOT a note: tape, cardboard, a shadow in a paper seam and
   the strip of ceiling above the paper all pass them somewhere. So each
   candidate is asked of the PICTURE — is the inside different from the ring
   around it, where the wall is the dullest quarter of that ring (on a dense
   wall a note's neighbours are other notes)? More saturated, much brighter
   RELATIVE to the wall, or a different hue; any one is enough, because the
   eight papers differ from a wall in different ways. Hue only counts when
   there is enough saturation for a hue to mean anything. There is NO "paper
   is brighter than its wall" veto: true on kraft, false on a whiteboard,
   where a blue sticky is far darker than the wall — it cost two thirds of the
   blue notes on a real one and, once the fill floor took the cardboard it was
   added for, bought nothing anywhere.

   Standing out is not enough on its own, so `standsOut` also refuses a box
   that is **dark AND grained** (`isDarkGrain`, in `texture.ts`): cardboard,
   furniture, a window frame at night. Roughness is the mean Sobel gradient
   over the interior with the writing masked out, divided by the paper's own
   brightness, so paper reads smooth in the sun and in the shade. The per-box
   surface features and the leave-one-wall-out study behind this gate are in
   [experiments/c-junk.md](experiments/c-junk.md). Pad notes are judged for
   standing out but not for grain: on a note a few pens wide the ink margin
   leaves no clean interior, and its own edges read as grain.

6. **Rows** (`clusterRows`): cluster centre-y, order by centre-x within a row.

## The constants, and what they cost to learn

| Constant                                    | Value             | Why                                                                                                                                                                                           |
| ------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WALL_HUE_NEIGHBOURHOOD_DEG`                | 34                | Brown kraft paper and an orange domain event are the same hue. Near the wall's hue, only saturation separates them.                                                                           |
| `OFF_HUE_MIN_SATURATION`                    | 0.11              | Far from the wall's hue, a pale lilac policy is obviously not the wall. 0.18 lost a whiteboard's greyish aggregates (s≈0.17 as photographed); 0.10–0.12 is the band that holds on every wall. |
| `WALL_HUE_MIN_LAB_DISTANCE`                 | 7                 | At the wall's hue, how far from the wall's a*b* paper sits. Orange on kraft is 30–40, shadowed kraft 2–6; 6 to 10 all lift the kraft walls, 7 costs no wall a note.                           |
| `BLOWN_OUT`                                 | 250               | A pixel with every channel at or above this is clipped and says nothing about the wall. 240–253 score the same.                                                                               |
| `MIN_PAPER_SATURATION`                      | 0.28              | A floor under the measured split, so a white-wall photo does not start calling its own shadows paper.                                                                                         |
| `PEN_STROKE_FRACTION`                       | 0.006             | The gap the merge has to close is a pen stroke, and that is knowable without any statistic — which matters, see below.                                                                        |
| `NOISE_FLOOR_FRACTION`                      | 0.008             | Half the merged boxes on a real photo are 1–5px of sensor noise, sitting exactly where a median would otherwise land.                                                                         |
| `MIN_AREA_FRACTION`                         | 0.35              | A speck, relative to the median note — measured AFTER merging, never before.                                                                                                                  |
| `SPLIT_RATIO` / `SPLIT_KEEP_RATIO`          | 1.8 / 1.4         | Above the notation's widest silhouette (300×180 = 1.67), so a policy is never sawn in half, but below two notes abutting.                                                                     |
| `MIN_SOLID_FILL` / `MIN_PAPER_FILL`         | 0.55 / 0.45       | To CUT a blob it must be convincingly solid; to KEEP one it need only be more paper than holes.                                                                                               |
| `MAX_PAPER_ASPECT` / `MAX_PAPER_SIZE_RATIO` | 2.4 / 2.6         | Masking tape is a thin strip and a radiator is enormous; neither is paper.                                                                                                                    |
| `MIN_PAPER_SIZE_RATIO`                      | 0.7               | Stationery comes in one size: nine notes in ten are within a quarter of the median, half the junk is under three quarters.                                                                    |
| `MIN_CLASS_SIZE_SAMPLE`                     | 10                | A colour needs this many whole notes to be floored against its OWN size (a pad of small actors), not the wall's. Tape had 3 to 7; real small pads 21. Any value 8 to 20 scores the same.      |
| `CLOSE_NOTE_FRACTION`                       | 0.04              | The close repairs handwriting INSIDE a note, so it is sized from the note — capped at 0.6% of the frame.                                                                                      |
| `STANDOUT_SATURATION`                       | 0.15              | How far above its own wall a note sits in saturation. Measured: notes p10 0.04–0.05, junk p50 around zero.                                                                                    |
| `DARK_GRAIN_BRIGHTNESS` / `_ROUGHNESS`      | 0.5 / 0.03        | Dark and grained is the room, not paper. No labelled note is both anywhere in 0.45–0.55 × 0.025–0.035; every leave-one-wall-out fold lands near 0.5 × 0.025 and loses no note.                |
| `WALL_RING_QUANTILE`                        | 0.25              | Which part of the ring around a box IS the wall. On a dense wall the rest of the ring is other notes.                                                                                         |
| `FLOOR_TILES_LONG_SIDE`                     | 8                 | Cells about two notes across. Fewer and a shadow edge falls inside one cell; more and a cell can be all paper.                                                                                |
| `TILE_BIMODAL_STRENGTH`                     | 0.12              | Below this share of its own variance a cell's histogram is one surface, and there is nothing in it to split.                                                                                  |
| `TILE_WALL_TOLERANCE`                       | 0.1               | How far a one-surface cell may sit from the frame's wall and still be taken for wall, on a paper-coloured wall.                                                                               |
| `MERGE_MIN_FILL`                            | 0.3               | The merge is transitive: without a density bar, stray pixels chain every note in the frame into one blob at fill 0.2.                                                                         |
| `SPLIT_BAND_THICKNESS`                      | 2.6               | A blob no thicker than this in notes is a single file of paper, and is cut even when it is not solid.                                                                                         |
| `WHOLE_NOTE_SIDE`                           | 0.45              | Thicker than this (in notes) a piece is a whole note and never merged with another. 0.40–0.50 score the same.                                                                                 |
| `NOTCH_MIN_DEPTH` / `CHORD_MAX_LENGTH`      | 0.12 / 1.3        | A notch deeper than this, a chord no longer than one side of a note. Depths 0.08–0.22 score alike.                                                                                            |
| `SEAM_MIN_DEPTH` / `SEAM_MIN_PIECE`         | 12 / 0.55         | Median valley in luma levels along a seam; each side at least this much of a note. 8–24 and 0.5–0.7 score alike.                                                                              |
| `CUT_PIECE_SIZE_RATIO`                      | 0.6               | Each side of a notch or seam cut at least this thick; between this and `MIN_PAPER_SIZE_RATIO` a side is a sliver, dropped. 0.575–0.65 score alike.                                            |
| `NARROW_SHORT_RATIO` / `_LONG_RATIO`        | 0.5 / 0.9         | A whole narrow note is at least this thick and long, in notes of its colour. 0.45–0.55 × 0.85–0.95 score alike.                                                                               |
| `NARROW_MIN_SEAM`                           | 0.5               | The emptiest raw-mask line across a narrow box's middle, against its mean line: one note keeps 0.6+, a fused pair 0.25 or less. 0.3–0.6 score alike.                                          |
| `PAD_REACH` / `PAD_SIZE_RATIO`              | 3.25 / 1.45       | Pad siblings: centres within this many short sides, sizes within this ratio. Reach 2.75 loses the night wall's far board; 3.5–5 let one scrap in. Ratio 1.3–1.6 score alike.                  |
| `PAD_MIN_NOTES` / `PAD_MAX_SIZE`            | 3 / 0.7           | A pad is at least three boxes, each at most this share of the wall's note.                                                                                                                    |
| `FUSED_MIN_ASPECT` / `FUSED_SIZE_RATIO`     | 1.75 / 1.5        | A refused box this elongated beside a pad is fused pad notes; a cut square joins at this looser size match. 1.6–1.85 and 1.35–1.5 score alike.                                                |
| `RESCUE_ERODE_FRACTION` / `RESCUE_ROUNDS`   | 0.12 / 3          | Deep enough to break the seam between two lapped notes; three passes is where it stops paying.                                                                                                |
| Hue bands                                   | see `classify.ts` | Widened to measured paper, not swatches: real greens read h≈86 where the catalogue's read-model is h≈137.                                                                                     |

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
- **A photograph that is half room.** Measured on the three labelled
  photographs, precision is 76%, 88% and 91%; nearly all of what is left on the
  worst of them is cardboard packaging stacked in front of the wall, in the
  corner of the frame where the photograph stops being a wall and becomes a
  room. An "is it ON the kraft?" gate was measured and rejected: the ring
  around a box, relative to the frame's median brightness, separates weakly
  (notes p05 0.67–0.78, junk p25 0.41 but p50 0.83), so a floor tight enough to
  take the cardboard takes notes in deep shade with it. Fill the frame with the
  wall.
- **Two sizes of note on one wall** are handled for the SMALL ones only. The
  lower size floor is measured per paper colour (a colour with enough whole
  notes gets its own size), which brought a white wall's small actors and
  hotspots back, and a cluster of small notes of ANY colour is kept as a pad.
  A pad whose notes are mostly fused or partial (fewer than three clean
  ones) is not found, and two small squares fused flush with no seam in
  either mask stay one box. Splitting is still measured against the wall's one size:
  measured per colour it lost more than it gained on every labelled wall, so a
  wall where a small pad OUTNUMBERS the big notes will see the big ones cut up.
- **A shade gradient is handled; a shade CLIFF less so.** The floors are
  blended between cell centres, so a shadow edge sharper than about an eighth
  of the frame is averaged across that blend.
- **Working at 1000px, always.** The detector was calibrated at 1000px and the
  working image is scaled there before detection (`PHOTO_MAX_EDGE_PX`). Every
  threshold is relative to the measured note size, so a bigger frame buys no
  accuracy: swept from 600 to 2500px and tiled, nothing beats 1000, and below
  1000 the night wall's note size is mismeasured
  ([experiments](experiments/d-resolution.md)). The handwriting crops are cut from the full-resolution bitmap, so
  reading keeps every pixel. Measured in the browser on three real photos: 20,
  32 and 34 notes.
- **A sticky more than about 60% covered** reads as a fragment of whatever is
  left, or is dropped as a speck.
- **Pale paper at the wall's hue.** The pale yellow aggregate (`#fef9c3`,
  s≈0.23) on a brown kraft wall (h≈41, s≈0.22) is inside the wall-hue
  neighbourhood and below the per-photo saturation floor, so it IS wall to the
  classifier. The visual demo reproduces it: 17 of 18 drawn, the aggregate
  missed. Lowering the floor for yellow would let the kraft in; the honest fix
  is a per-board colour legend, or measuring the wall from a region the author
  points at.
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

`scripts/merged.ts` lists every merged box on the labelled walls with its cause
(inseparable labels, cross-colour, same-colour) and where each missed note
went; the separation experiments and their tables are in
[experiments/b-separation.md](experiments/b-separation.md).

`scripts/nobox.ts` names, for every missed note whose paper is in the mask but
which got no box, the gate that dropped it; `scripts/gate-diff.ts KEY=VALUE…`
lists the boxes a change adds and removes, tagged true, junk or merged, when the
change is behind a temporary environment switch. The gate experiments are in
[experiments/f-nobox.md](experiments/f-nobox.md).

`pnpm demo:sticky-vision` (repo root) bundles the package with esbuild and
serves `demo/sticky-vision/index.html`: a synthetic kraft wall the page draws
itself, detected live, every box overlaid with kind colour, `row · #order` and
confidence, and each miss outlined as a dashed ghost because the page knows what
it drew. "Load a real photo" runs the same pipeline on a photograph.

Real photographs never enter the repo. The unit tests draw their own images and
stay under 200ms.

### Ground truth: precision and recall, not "how many did we find"

A detection COUNT cannot tell a fix from a regression once false positives are
in play — a change that finds two more notes and invents five scores higher on
the count and is a loss. So the sweep scores against hand-labelled notes when
they exist:

- Photographs and labels live **outside this repo**, in the private
  `livediagram-app/vision-model-truths` repository (`event-storming/photos`
  and `event-storming/labels`) — they describe somebody's real workshop wall,
  this repo is public, and hours of hand-labelling must not live on one disk.
  The tools find a checkout at `$VISION_TRUTHS_DIR`, or cloned beside this
  repo as `../vision-model-truths`; with neither, they fall back to
  `packages/sticky-vision/test-files/` and `~/.local/share/eswall-truth/`.
  `$ESWALL_TRUTH_DIR` still overrides the labels folder alone.
- A file is `{ photo, labelledOn: { width, height }, notes: [{ x, y, w, h, kind
}] }`, every box in FRACTIONS of the image so the labels survive any working
  size.
- **The cheap way to make one: correct a review and save it.** Open the editor
  **on localhost** — that is the whole arming rule, because calibration happens
  on the machine the photographs and the sweep are on, and the hosted site
  never shows it. (`?truth=1` / `?truth=0` on any editor URL overrules the
  host in either direction, and is remembered.) Import the photo, then
  do exactly what the import asks of you anyway — untick every box that is not
  a sticky, drag a box around every sticky it missed — and press **Save as
  truth**. The download is a label file named after the photograph. File it
  where the sweep looks:

  ```bash
  pnpm --filter @livediagram/sticky-vision truth:add ~/Downloads/<photo>.json
  ```

  In a `vision-model-truths` checkout it also **commits and pushes** the
  label at once, and warns when there is no photo of that name to score it
  against. It refuses a file whose boxes are not fractions, because pixels would score
  as a total miss and read like a detector regression. The one weakness of
  this path: truth built by correcting the detector inherits its blind spots,
  since a note it never boxed is one you have to notice yourself.

- To make one from a blank slate instead: run the sweep once so the working copy is cached under
  `/tmp/livediagram-sticky-vision/<hash>/work-<photo>.png`, crop it into
  overlapping tiles with a labelled grid drawn over them (25px steps, ImageMagick
  `-draw`), read each note's CENTRE off the grid by eye, and give it a nominal
  size for its kind (square ~52px, wide ~88x52, actor ~28x52 at the 1000px
  working size). Centres are what the match rule uses; sizes only have to be in
  the right order of magnitude.
- A detection matches a label when their centres are within half a note and
  their areas are within 2x (`scripts/truth.ts`). The area half of that rule is
  deliberate: one box over a 2x2 cluster of touching notes scores as one
  spurious box AND four missed notes, which is exactly what it is.
- The summary also measures THE BAR of
  [plans/event-storming-photo-95.md](../../plans/event-storming-photo-95.md):
  recall without the small actors (`rec-A`; actors reported apart), the count
  of MERGED boxes (a box holding the centres of two or more labelled notes),
  and a PASS / FAIL per wall — recall without actors ≥ 95%, precision ≥ 95%,
  no merged box. A TOTAL row sums every labelled note.
- The sweep then prints precision / recall / F1 per photo plus the LISTS — the
  centre of every missed note and every spurious box — and draws the labels as
  a dotted white frame under the detections in the overlay. The lists are the
  useful half: a named missing note is somewhere to go and look.
