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

The model still has a job: reading the handwriting on each crop. That is the
thing it is genuinely better at than any code we would write.

## The pipeline

1. **White balance** from the WALL — the least saturated quarter of the image —
   rather than from the whole scene. Plain grey-world assumes the average of an
   image is grey, and a photo of a sticky wall is the case where that is least
   true: half the frame is saturated paper, and "correcting" it drains the
   colour out of the very thing being measured.
2. **Classify** every pixel against the notation's own catalogue fills
   (`EVENT_STORMING_NOTES`), into a note kind, the wall, or ink. Hue centres are
   derived from the catalogue; the bands and floors are calibrated constants.
   Actor and aggregate are two degrees apart in hue, so saturation is what
   separates them.
3. **Connected components** over the class mask: the pixels that touch and say
   the same thing.
4. **Fit boxes**: drop specks, merge the fragments one sticky is cut into by
   the handwriting across it, and split a blob longer than any real silhouette
   into the number of notes its length implies.
5. **Rows**: cluster the centre-y values, because a wall sags; order by
   centre-x within each row.

## What it cannot do

- **White and grey paper.** The notation has eight colours and none of them is
  white, so a white sticky is wall.
- **Very dim or strongly coloured light.** The balance fixes a cast; it cannot
  fix a photograph with no neutral surface in it at all, and it cannot undo a
  clipped channel.
- **A sticky more than about 60% covered.** What is left reads as a fragment,
  or is dropped as a speck.

Every one of those lands as something the author can fix on the canvas: the
import's review is the draft on the board, not a dialog.
