import { EVENT_STORMING_NOTES, type EventStormingNoteKind } from '@livediagram/diagram';
import { classifyRgb, wallFloorsOf, type PaperFloors } from './classify';
import { greyWorldBalance, type ImageBuffer } from './colour';
import { closePaperMask, labelComponents, type ComponentMask } from './components';
import { fitBoxes, medianNoteSize, silhouetteOf } from './boxes';
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

const CLASS_IDS = new Map<EventStormingNoteKind, number>(
  EVENT_STORMING_NOTES.map((n, i) => [n.kind, i + 1]),
);
const KIND_BY_ID = new Map<number, EventStormingNoteKind>(
  [...CLASS_IDS].map(([kind, id]) => [id, kind]),
);

export function classMaskOf(image: ImageBuffer, floors?: PaperFloors): ComponentMask {
  const { width, height, data } = image;
  // Measured from THIS photograph, because a brown kraft wall and an orange
  // domain event share a hue and differ only in how dull the wall is.
  const paperFloors = floors ?? wallFloorsOf(image);
  const classes = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    // Fully transparent pixels are not paper; a PNG export has plenty.
    if (data[i + 3]! < 128) continue;
    const c = classifyRgb(data[i]!, data[i + 1]!, data[i + 2]!, paperFloors);
    const id = CLASS_IDS.get(c as EventStormingNoteKind);
    if (id !== undefined) classes[p] = id;
  }
  return { width, height, classes };
}

export function detectStickies(image: ImageBuffer, opts: DetectOptions = {}): DetectedSticky[] {
  const working = opts.balance === true ? greyWorldBalance(image) : image;
  const mask = classMaskOf(working);
  // Fuse handwriting-shattered notes back into whole notes before labeling
  // (spec/139 Phase 9): a morphological close by ~a pen stroke, per class.
  const closed = closePaperMask(mask);
  const boxes = fitBoxes(labelComponents(closed), {
    imageSize: Math.max(working.width, working.height),
  });
  if (boxes.length === 0) return [];
  const noteSize = medianNoteSize(boxes);
  return clusterRows(boxes, noteSize).map((box, i) => ({
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
