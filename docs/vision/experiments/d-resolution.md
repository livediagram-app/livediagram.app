# Experiments, group D: resolution and tiling

Does the detector find small notes better with more pixels per note? The
panorama (3456×1036) at the 1000px working size has notes about 20–32px on
their short side, and the whiteboard's are about 18px. Every threshold in the
detector is relative to the note size it measures, so the working size looked
like a clean lever.

It is not. Measured on the eight labelled walls (647 notes), the detector is
scale-invariant by construction, and the only things more pixels change are
the ones that hurt. 1000px stays.

How to reproduce: `npx tsx scripts/calibrate.ts --edge <px>` in
`packages/sticky-vision` (photos are only ever shrunk, as the editor never
upscales). Time is `detectStickies` alone, in Node on a desktop i7-14700K,
summed over the eight photos; divide by 8 for a photo, and expect a mid-range
phone to be several times slower.

Baseline at 1000px: TOTAL F1 83.7% (precision 85%, recall 82%), 40 merged
boxes, 0/8 walls pass.

## D1: sweep the working size

**Hypothesis.** With thresholds relative to the note, more pixels per note
give cleaner paper edges and seams, so small notes are found and lapped notes
are cut apart more often.

### Per-wall F1 by working size (long edge, px)

| wall             | 600  | 800  | 900  | 1000     | 1100 | 1200 | 1500 | 2000 | 2500 |
| ---------------- | ---- | ---- | ---- | -------- | ---- | ---- | ---- | ---- | ---- |
| 201646           | 79   | 82   | 80   | 80       | 81   | 85   | 78   | 84   | 79   |
| 201654           | 93   | 94   | 95   | 94       | 95   | 95   | 95   | 93   | 96   |
| 201707           | 86   | 87   | 82   | 81       | 83   | 80   | 78   | 77   | 75   |
| 201713           | 91   | 89   | 89   | 92       | 92   | 91   | 90   | 93   | 88   |
| 201730 (shade)   | 91   | 92   | 90   | 88       | 85   | 91   | 87   | 90   | 82   |
| 201743 (night)   | 12   | 3    | 23   | 42       | 43   | 40   | 45   | 42   | 46   |
| wall-panorama    | 70   | 71   | 68   | 72       | 72   | 71   | 73   | 72   | 70   |
| whiteboard-dense | 91   | 90   | 90   | 91       | 91   | 89   | 87   | 87   | 87   |
| **TOTAL F1**     | 77.4 | 73.9 | 78.9 | **83.7** | 83.7 | 82.7 | 81.7 | 81.7 | 80.6 |
| precision        | 74%  | 69%  | 77%  | 85%      | 85%  | 85%  | 84%  | 84%  | 83%  |
| recall           | 81%  | 80%  | 81%  | 82%      | 82%  | 81%  | 79%  | 79%  | 78%  |
| merged           | 39   | 45   | 46   | 40       | 43   | 47   | 53   | 49   | 57   |
| ms, 8 photos     | 596  | 1043 | 1260 | 1544     | 1739 | 2325 | 3185 | 5116 | 7690 |
| ms per photo     | 75   | 130  | 158  | 193      | 217  | 291  | 398  | 640  | 961  |

The whiteboard photo is only 1386px wide, so from 1500 up it is measured at
its own size. The panorama is 3456px, so it really is measured larger at
every step.

### The bar's measures at the four planned sizes

| wall             | 1000: prec / rec-A / merged | 1500         | 2000         | 2500         |
| ---------------- | --------------------------- | ------------ | ------------ | ------------ |
| 201646           | 76 / 90 / 4                 | 74 / 90 / 4  | 83 / 93 / 4  | 74 / 93 / 4  |
| 201654           | 98 / 94 / 4                 | 96 / 98 / 4  | 93 / 96 / 4  | 98 / 98 / 4  |
| 201707           | 79 / 83 / 2                 | 78 / 78 / 3  | 76 / 78 / 2  | 77 / 73 / 4  |
| 201713           | 89 / 94 / 0                 | 88 / 93 / 1  | 90 / 96 / 0  | 86 / 91 / 1  |
| 201730 (shade)   | 90 / 88 / 2                 | 87 / 88 / 2  | 90 / 90 / 2  | 79 / 87 / 2  |
| 201743 (night)   | 36 / 54 / 1                 | 39 / 56 / 2  | 35 / 54 / 2  | 38 / 59 / 2  |
| wall-panorama    | 85 / 62 / 10                | 84 / 62 / 13 | 82 / 62 / 11 | 85 / 62 / 16 |
| whiteboard-dense | 96 / 86 / 17                | 95 / 78 / 24 | 95 / 78 / 24 | 95 / 78 / 24 |

### Why nothing moves

The detector measures the note size before anything else and sizes every
later rule from it. Measured in 1000px-equivalent pixels, that estimate is
the same at every working size, on every wall but one:

| wall             | 600 | 800 | 900 | 1000 | 1100 | 1200 | 1500 | 2000 | truth p50 |
| ---------------- | --- | --- | --- | ---- | ---- | ---- | ---- | ---- | --------- |
| 201646           | 50  | 51  | 50  | 50   | 51   | 51   | 51   | 51   | 52        |
| 201654           | 45  | 45  | 46  | 46   | 45   | 46   | 45   | 46   | 46        |
| 201707           | 45  | 45  | 50  | 49   | 50   | 50   | 50   | 50   | 46        |
| 201713           | 37  | 36  | 37  | 36   | 37   | 37   | 37   | 37   | 39        |
| 201730           | 37  | 36  | 37  | 36   | 36   | 36   | 37   | 37   | 36        |
| 201743 (night)   | 25  | 23  | 26  | 39   | 39   | 38   | 41   | 41   | 40        |
| wall-panorama    | 33  | 34  | 33  | 34   | 34   | 33   | 33   | 34   | 32        |
| whiteboard-dense | 18  | 19  | 19  | 19   | 19   | 19   | 19   | 19   | 18        |

So the same detector runs at every size, and what more pixels add is detail
the rules then have to fight: JPEG noise, and handwriting that shatters paper
into more fragments. The whiteboard shows it most plainly. At its native
1386px its notes are 25px rather than 18px, and it loses 7 points of recall
and gains 7 merged boxes.

The panorama sits at 60–65% recall at every size. Its losses are not about
pixels. They are pale pink wide notes that no paper class takes, and a tightly
packed grid of small yellow and crimson notes that is welded into bars. Those
belong to colour classification (group A) and splitting (group B).

Two side findings, both outside this group's files:

- **The night wall's note size is mismeasured below 1000px** (23–26 against a
  true 40). Every size-relative rule then runs at half scale and the wall
  yields 116–183 boxes. At 1000px it is only just right, which makes this
  wall's result fragile. `estimateNoteSize` (group B) would be the place to
  harden it.
- **201707 scores better with a smaller note estimate** (45 at 600–800px,
  F1 86–87, against 49–50 and F1 81 above). Its true median is 46. How the
  estimate is taken matters more than the working size does.

**Verdict: rejected.** 1000 is the best TOTAL, and 1100 ties it with 3 more
merged boxes. Larger sizes lose F1 and add merged boxes; smaller ones wreck
the night wall. Time grows with the pixel count: 193 ms a photo at 1000px,
640 ms at 2000px, 961 ms at 2500px, on a desktop.

## D2: tiled detection at a higher resolution

**Hypothesis.** Detect on overlapping tiles of a larger image, so each tile is
as big as the frame the constants were tuned on while the notes get more
pixels. Then combine the boxes.

**Method.** Tiles of `tile` px overlapping by `overlap` (a quarter tile by
default). Every pixel has one owning tile, its core, and each core stops half
an overlap short of the tile's inner edges. A detection is kept only by the
tile that owns its centre, so a note no wider than the overlap is kept exactly
once, whole, and a clipped copy in a neighbour is dropped. Rows and reading
order are then worked out again over the whole wall. Unit-tested, with notes
lying whole inside two tiles and notes hanging over a tile edge.

### Independent tiles: collapse

Each tile measured its own floors and note size.

| config (edge / tile) | TOTAL F1 | precision | recall | merged | ms, 8 photos |
| -------------------- | -------- | --------- | ------ | ------ | ------------ |
| 1000 / 500           | 20.2     | 12%       | 57%    | 20     | 3610         |
| 1500 / 1000          | 68.8     | 59%       | 81%    | 43     | 5112         |
| 2000 / 1000          | 42.2     | 29%       | 75%    | 30     | 13822        |
| 2500 / 1000          | 16.2     | 9%        | 59%    | 23     | 13640        |
| 3500 / 1000          | 6.0      | 3%        | 44%    | 16     | 35804        |

A tile that holds only kraft wall, or only paper, has no second surface to
measure its floors against and no notes to measure a note size from. It finds
hundreds of phantom notes: 800 on the night wall at 1000/500, 1325 on 201713
at 3500/1000. The detector is a whole-photograph method: "a photograph of a
wall is mostly wall" is how it finds the wall.

### Tiles sharing the frame's measurements: the same as D1, slower

The frame's floor field, note sizes and size were measured once on the whole
image and handed to every tile.

| config (edge / tile) | TOTAL F1 | merged | panorama F1 | whiteboard F1 / merged | ms, 8 photos |
| -------------------- | -------- | ------ | ----------- | ---------------------- | ------------ |
| 1000 / 300           | 83.4     | 40     | 72          | 91 / 16                | 3510         |
| 1000 / 350           | 83.6     | 43     | 72          | 91 / 20                | 3244         |
| 1000 / 400           | 83.1     | 36     | 72          | 90 / 13                | 3134         |
| 1000 / 450           | 83.9     | 40     | 73          | 91 / 16                | 3599         |
| 1000 / 500           | 84.0     | 41     | 73          | 91 / 17                | 4223         |
| 1000 / 600           | 83.7     | 41     | n/a         | n/a                    | 2964         |
| 1000 / 750           | 83.7     | 40     | n/a         | n/a                    | 2620         |
| 1500 / 1000          | 81.7     | 53     | 73          | 87 / 24                | 6866         |
| 2000 / 1000          | 81.8     | 49     | 71          | 87 / 24                | 16379        |
| 2500 / 1000          | 80.9     | 58     | 70          | 87 / 24                | 16660        |
| 3500 / 1000          | 79.8     | 55     | 70          | 87 / 24                | 37567        |

At each working size this reproduces the whole-frame D1 result to within a
note or two, which is what it has to do: sharing everything, tiling is the
same detector on the same pixels, with component analysis fenced into tiles.
At 1000px the small movements are jitter from where a tile line happens to
fall across a welded cluster. The whiteboard's merged count reads 16, 20, 13,
16, 17 across tile sizes 300 to 500, and tile 400's 13 costs the whiteboard 8
notes of recall. No value sits on a plateau.

**Verdict: rejected.** Independent tiles break the per-photograph statistics
the detector stands on. Shared tiles add nothing to D1 and cost 1.5–3× the
time plus a whole-frame pass. Its one real use, bounding peak memory on a
very large image, does not arise at 1000px. The code was not kept.

## D3: the working size, and what it costs on a phone

**Decision: 1000px on the long edge, unchanged** (`PHOTO_MAX_EDGE_PX`).

- No fixed size beats it (D1), and tiling cannot either (D2).
- **A rule by estimated note size does not work either.** It would have to
  shrink 201707 (best at 600–800px) and must not shrink the night wall (which
  collapses there). Their notes are the same size, 46px and 40px, so no
  note-size rule can tell them apart. The night wall's collapse comes from its
  note-size estimate, not from its note size.
- **Cost.** Detection time is close to linear in pixels: 193 ms per photo at
  1000px against 640 ms at 2000px on a desktop. A mid-range phone runs
  JavaScript several times slower (an estimate, not measured here). That puts
  1000px under a second, while 2000px would be several seconds with four times
  the memory: a 2000×1126 RGBA frame is 9 MB before any masks.

The comments and docs that still said "at 2048 it found a quarter as many"
described a detector with absolute thresholds. They now state the measured
reason instead: `PHOTO_MAX_EDGE_PX`, `apps/live/lib/photo-detect.ts`, spec/139
and [sticky detection](../sticky-detection.md).

## What to try next (outside this group)

- Harden `estimateNoteSize` against handwriting fragments on the night wall
  (it halves below 1000px). The same estimate decides 201707's 5 points.
- The panorama's pale pink notes are a missing colour class, and its grid of
  small notes is a splitting problem. Neither is about resolution.
- The browser's downscale (`drawImage` with `imageSmoothingQuality: 'high'`)
  is not ImageMagick's Lanczos, which the sweep uses. An area-average
  downscale in the package would make the sweep's number exactly the editor's.
