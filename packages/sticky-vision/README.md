# @livediagram/sticky-vision

Finds the sticky notes in a photograph of an event-storming wall (spec/139
Phase 8), with classical computer vision. Pure TypeScript over an RGBA buffer:
no DOM, no canvas, no OpenCV, no wasm. The browser hands it pixels; a test
draws them.

## Why not a vision model

Because the notation is COLOUR, and colour is something a hue histogram knows
exactly and a language model guesses at. A model's sense of coordinates is
loose enough that a board laid out from its boxes would need rearranging by
hand, which is the friction the import exists to remove. This is also free,
offline, instant, and testable against images we draw ourselves.

Reading the handwriting on each detected note is a separate job, done by a
reader the caller picks (spec/139 Phase 9: in-browser OCR in the editor). This
package never sees text; it only finds paper.

## The pipeline

1. **Measure the wall.** The floors every later step compares against are
   taken from THIS photograph: the wall's own hue, and the saturation split
   (Otsu) between the wall and the paper on it. A grey-world white balance is
   available (`balance: true`) but OFF by default — on a brown kraft wall it
   takes the wall for neutral and corrects every paper hue along with it.
2. **Classify** every pixel against the notation's own catalogue fills
   (`EVENT_STORMING_NOTES`), into a note kind, the wall, or ink. Hue centres are
   derived from the catalogue; the bands are widened to measured paper. A pixel
   near the wall's hue must clear the wall's saturation floor; one far from it
   needs much less. Actor and aggregate are two degrees apart in hue, so
   saturation is what separates them.
3. **Close the mask** by about a pen stroke (dilate, then erode), per class, so
   a note shattered by handwriting is one blob again.
4. **Connected components** over the closed mask: the pixels that touch and
   say the same thing.
5. **Fit boxes**: drop specks, merge what is still fragmented, and split a blob
   longer than any real silhouette (and solid enough to be paper) into the
   number of notes its length implies.
6. **Rows**: cluster the centre-y values, because a wall sags; order by
   centre-x within each row.

## What it cannot do

- **White and grey paper.** The notation has eight colours and none of them is
  white, so a white sticky is wall.
- **Very dim or strongly coloured light.** The balance fixes a cast; it cannot
  fix a photograph with no neutral surface in it at all, and it cannot undo a
  clipped channel.
- **A sticky more than about 60% covered.** What is left reads as a fragment,
  or is dropped as a speck.
- **Pale paper that shares the wall's hue.** On a brown kraft wall the pale
  yellow aggregate (`#fef9c3`, saturation 0.23) sits at the wall's own hue and
  saturation, so the per-photo floor reads it as wall. The demo below shows
  exactly this: 17 of its 18 drawn notes are found, and the aggregate is the
  one that is not. The pale external-system pink fails the same way.

Every one of those lands as something the author can fix in the review
overlay, or as nothing at all.

## Visual demo

`demo/sticky-vision/` (repo root) is a standalone page that bundles this
package, draws a synthetic kraft wall, runs the detector on it, and overlays
every box with its kind colour, `row · #order` and confidence. Because the
synthetic wall knows what it drew, the page scores itself and outlines each
miss with a dashed ghost. "Load a real photo" runs the same pipeline on a
photograph (decoded with EXIF orientation, scaled to 1000px like the editor).

```sh
pnpm demo:sticky-vision            # bundle, then serve at http://localhost:4199
pnpm demo:sticky-vision:build      # bundle only (esbuild, from source)
```

The bundle is built from source on demand and is not committed.
