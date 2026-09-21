import { EVENT_STORMING_NOTES, type EventStormingNoteKind } from '@livediagram/diagram';
import { classifyRgb } from './classify';
import { localFloorsOf, type PaperFloors } from './floors';
import { greyWorldBalance, type ImageBuffer } from './colour';
import { standsOut, STANDOUT_CALIBRATION } from './standout';
import { closePaperMask, labelComponents, type ComponentMask } from './components';
import { estimateNoteSize, fitBoxes, silhouetteOf } from './boxes';
import { clusterRows } from './rows';

// Finding the stickies in a photograph of a wall (spec/139 Phase 8).
//
// Classical computer vision, on purpose: the notation is COLOUR, and colour is
// something a hue histogram knows exactly and a language model guesses at. It
// is also free, offline, instant, and testable against images the tests draw
// themselves — none of which is true of asking a model where things are.
//
// Pure over a plain RGBA buffer: no DOM, no canvas, no wasm. The browser hands
// it pixels; a test draws them.

export type DetectedSticky = {
  id: number;
  kind: EventStormingNoteKind;
  size: 'square' | 'wide' | 'small';
  // Pixels in the WORKING image the detector was given.
  x: number;
  y: number;
  w: number;
  h: number;
  row: number;
  order: number;
  // How much of the box was actually that colour. A sticky half covered by
  // another reads low, and the draft's badge can say so.
  confidence: number;
};

export type DetectOptions = {
  // Run a grey-world white balance first. DEFAULT OFF, and that is a finding
  // rather than an oversight: on a real workshop wall — brown kraft paper —
  // the balance takes the wall for a neutral surface and "corrects" the brown
  // out of the whole photograph, moving every paper hue with it. Detections on
  // the operator's own walls dropped by three quarters with it on.
  //
  // It is not needed either, because everything below is measured from THIS
  // photograph: the wall's own hue and saturation set the floors, so a warm
  // room moves the wall and the paper together and the comparison still holds.
  // The balance stays available (and tested) for a caller with a genuinely
  // neutral backdrop.
  balance?: boolean;
};

// Sensor noise, as a fraction of the working image's long edge: a property of
// the camera rather than of the wall. Shared with `fitBoxes`, which uses the
// same floor to decide what is too small to be anything.
const NOISE_FLOOR_FRACTION = 0.008;

// The morphological close's radius: a fraction of the note it is meant to put
// back together, floored so that a very distant wall still gets a pixel of
// reach and capped against the frame so a photo of ONE enormous note cannot
// dilate half the picture.
const CLOSE_NOTE_FRACTION = 0.04;
const CLOSE_MAX_IMAGE_FRACTION = 0.006;

function closeRadiusFor(noteSize: number, imageSize: number): number {
  const cap = Math.max(2, Math.round(imageSize * CLOSE_MAX_IMAGE_FRACTION));
  if (noteSize <= 0) return cap;
  return Math.max(1, Math.min(cap, Math.round(noteSize * CLOSE_NOTE_FRACTION)));
}

export const DETECT_CALIBRATION = {
  ...STANDOUT_CALIBRATION,
  NOISE_FLOOR_FRACTION,
  CLOSE_NOTE_FRACTION,
  CLOSE_MAX_IMAGE_FRACTION,
} as const;

const CLASS_IDS = new Map<EventStormingNoteKind, number>(
  EVENT_STORMING_NOTES.map((n, i) => [n.kind, i + 1]),
);
const KIND_BY_ID = new Map<number, EventStormingNoteKind>(
  [...CLASS_IDS].map(([kind, id]) => [id, kind]),
);

export function classMaskOf(image: ImageBuffer, floors?: PaperFloors): ComponentMask {
  const { width, height, data } = image;
  // Measured from THIS photograph, because a brown kraft wall and an orange
  // domain event share a hue and differ only in how dull the wall is — and
  // measured PER REGION of it, because a wall with a window at one end is two
  // different photographs as far as those floors are concerned. A caller that
  // already knows the floors (classifying one hand-drawn box) passes them and
  // they are used everywhere.
  const field = floors ? null : localFloorsOf(image);
  // One scratch object for the whole pass: a fresh one per pixel is four
  // million allocations on a photograph.
  const at: PaperFloors = floors ?? { saturation: 0, value: 0, wallHue: -1 };
  const classes = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    // Fully transparent pixels are not paper; a PNG export has plenty.
    if (data[i + 3]! < 128) continue;
    if (field) field.floorsInto(p % width, (p / width) | 0, at);
    const c = classifyRgb(data[i]!, data[i + 1]!, data[i + 2]!, at);
    const id = CLASS_IDS.get(c as EventStormingNoteKind);
    if (id !== undefined) classes[p] = id;
  }
  return { width, height, classes };
}

export function detectStickies(image: ImageBuffer, opts: DetectOptions = {}): DetectedSticky[] {
  const working = opts.balance === true ? greyWorldBalance(image) : image;
  const imageSize = Math.max(working.width, working.height);
  const mask = classMaskOf(working);
  // How big a note is on THIS wall, measured before anything is fused — see
  // `estimateNoteSize`. Everything after this divides by it, including the
  // close that follows, so it cannot be measured after the close.
  const noiseFloor = Math.max(4, Math.round(imageSize * NOISE_FLOOR_FRACTION));
  const noteSize = estimateNoteSize(
    labelComponents(mask).map((c) => ({
      classId: c.classId,
      x: c.minX,
      y: c.minY,
      w: c.maxX - c.minX + 1,
      h: c.maxY - c.minY + 1,
      pixels: c.pixels,
    })),
    noiseFloor,
  );
  // Fuse handwriting-shattered notes back into whole notes before labeling
  // (spec/139 Phase 9): a morphological close by ~a pen stroke, per class —
  // and a pen stroke is a fraction of a NOTE, not of the frame. Photographed
  // close up, a note is 55px and the gap to the note beside it is a handful,
  // so a radius picked off the image welded four notes into a bar.
  const closed = closePaperMask(mask, { radius: closeRadiusFor(noteSize, imageSize) });
  const boxes = fitBoxes(labelComponents(closed), {
    imageSize,
    noteSize,
    // The mask goes with the components: cutting a run of touching notes
    // apart is a question about pixels, not about a bounding box.
    mask: closed,
    // …and the RAW mask goes with it too, because the close is what erases
    // the evidence a cut needs. Two notes lapped over each other are told
    // apart by the seam between them — a paper edge and its shadow, a few
    // pixels of not-paper — and a close wide enough to fuse handwriting is
    // wide enough to fill that seam in. Seams are read before it, boxes are
    // measured after it.
    seams: mask,
  });
  if (boxes.length === 0) return [];
  // …and now throw away what is not paper at all.
  //
  // Every box so far is a region that scraped past the colour floor somewhere
  // inside it. A NOTE stands out from the wall it is stuck to: measured across
  // the operator's hand-labelled walls, nine real notes in ten sit at least
  // 0.05 of saturation above the floor where they lie, while half the spurious
  // boxes — tape, a shadow in a paper seam, cardboard, the white strip of
  // ceiling above the paper — sit AT it or below. The notation has no white,
  // grey or brown note, so nothing true is lost by insisting on it.
  const standing = boxes.filter((box) => standsOut(working, box));
  if (standing.length === 0) return [];
  return clusterRows(standing, noteSize).map((box, i) => ({
    id: i,
    kind: KIND_BY_ID.get(box.classId) ?? 'domain-event',
    size: silhouetteOf(box, noteSize),
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    row: box.row,
    order: box.order,
    // A solid rectangle of paper is 1; handwriting and overlap take it down.
    confidence: Math.min(1, box.pixels / Math.max(1, box.w * box.h)),
  }));
}

// The detector works in working-image pixels; the reconciler wants the image
// normalised to 0..1, so a downscale (or a different phone) means the same
// thing.
export function toNormalised(
  sticky: DetectedSticky,
  image: { width: number; height: number },
): { cx: number; cy: number; w: number; h: number } {
  return {
    cx: (sticky.x + sticky.w / 2) / image.width,
    cy: (sticky.y + sticky.h / 2) / image.height,
    w: sticky.w / image.width,
    h: sticky.h / image.height,
  };
}

// Where to cut each sticky out of the FULL-resolution bitmap: the detector's
// box scaled back up, with a little padding so a letter touching the paper's
// edge is not clipped off.
export function cropRects(
  stickies: DetectedSticky[],
  scale: number,
  padFraction = 0.06,
): { id: number; x: number; y: number; w: number; h: number }[] {
  return stickies.map((s) => {
    const padX = s.w * scale * padFraction;
    const padY = s.h * scale * padFraction;
    return {
      id: s.id,
      x: Math.max(0, Math.round(s.x * scale - padX)),
      y: Math.max(0, Math.round(s.y * scale - padY)),
      w: Math.round(s.w * scale + padX * 2),
      h: Math.round(s.h * scale + padY * 2),
    };
  });
}
