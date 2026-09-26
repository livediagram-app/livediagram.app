import { EVENT_STORMING_NOTES, type EventStormingNoteKind } from '@livediagram/diagram';
import { classifyRgb, isPaleShade, PALE_SHADE_KINDS } from './classify';
import { localFloorsOf, type PaperFloors } from './floors';
import { greyWorldBalance, type ImageBuffer } from './colour';
import { notStandingOut, STANDOUT_CALIBRATION } from './standout';
import { closePaperMask, labelComponents, type ComponentMask } from './components';
import {
  boxOf,
  estimateNoteSize,
  estimateNoteSizes,
  fitBoxes,
  isPlausibleNote,
  silhouetteOf,
  type Box,
  type DropReason,
  noiseFloorFor,
  NOISE_FLOOR_FRACTION,
} from './boxes';
import { clusterRows } from './rows';
import { luminanceOf } from './seam';
import { dropSurfaces } from './spill';
import { dropBlank } from './texture';
import { findPads } from './pads';
import { noteSizeField } from './size-field';
import { combineWithModel, type HybridRules } from './hybrid';
import type { ModelCues } from './model-cues';

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
  // Told of every box a gate refuses, and which gate: how a sweep traces a
  // missed note to the rule that lost it. Never changes what is found.
  onDrop?: (box: Box, reason: DetectDropReason) => void;
  // What a boundary model saw in this same image, and which of its
  // corrections to apply (see `hybrid.ts`). The model runs elsewhere; the
  // detector only reads its numbers. Absent, the detector is purely classical.
  model?: { cues: ModelCues; rules: HybridRules };
};

export type DetectDropReason =
  DropReason | 'standout' | 'dark-grain' | 'blank' | 'surface' | 'model-background';

// The morphological close's radius: a fraction of the note it is meant to put
// back together, floored so that a very distant wall still gets a pixel of
// reach and capped against the frame so a photo of ONE enormous note cannot
// dilate half the picture.
//
// A fiftieth of a note: one pixel on every labelled wall at the working size
// (notes of 19 to 51px). Two pixels bridges the thin line of shadow between
// flush notes and the gap between a note and a patch of kraft the floors call
// paper, and the run that comes out is cut where the grid falls, not where the
// notes are. Every fraction from 0.01 to 0.029 scores the same; from 0.03 a
// 51px note gets two pixels again.
const CLOSE_NOTE_FRACTION = 0.02;
const CLOSE_MAX_IMAGE_FRACTION = 0.006;

export function closeRadiusFor(noteSize: number, imageSize: number): number {
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
// The pale shade of a kind is a mask class of its own (see `isPaleShade`),
// numbered after the kinds, and reads back as its kind.
const PALE_SHADE_IDS = new Map<EventStormingNoteKind, number>(
  [...PALE_SHADE_KINDS].map((kind, i) => [kind, EVENT_STORMING_NOTES.length + 1 + i]),
);
const KIND_BY_ID = new Map<number, EventStormingNoteKind>([
  ...[...CLASS_IDS].map(([kind, id]): [number, EventStormingNoteKind] => [id, kind]),
  ...[...PALE_SHADE_IDS].map(([kind, id]): [number, EventStormingNoteKind] => [id, kind]),
]);

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
    const id = isPaleShade(data[i]!, data[i + 1]!, data[i + 2]!, c)
      ? PALE_SHADE_IDS.get(c as EventStormingNoteKind)
      : CLASS_IDS.get(c as EventStormingNoteKind);
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
  const noiseFloor = noiseFloorFor(imageSize);
  const blobs = labelComponents(mask).map(boxOf);
  const noteSize = estimateNoteSize(blobs, noiseFloor);
  const classNoteSize = estimateNoteSizes(blobs, noiseFloor);
  // Fuse handwriting-shattered notes back into whole notes before labeling
  // (spec/139 Phase 9): a morphological close by ~a pen stroke, per class —
  // and a pen stroke is a fraction of a NOTE, not of the frame. Photographed
  // close up, a note is 55px and the gap to the note beside it is a handful,
  // so a radius picked off the image welded four notes into a bar.
  const closed = closePaperMask(mask, { radius: closeRadiusFor(noteSize, imageSize) });
  // What the size, area and aspect gates refuse is kept aside: a cluster of
  // it may be a pad of smaller notes (see `findPads`).
  const refused: Box[] = [];
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
    classNoteSize,
    // …and the picture's brightness, so a merged run is cut where the paper
    // edge's shadow actually runs (`cutAtSeam`), not merely where a
    // note-length step falls.
    luminance: luminanceOf(working),
    // …and how big a note is around each point, read off the same raw blobs
    // the wall's size is: a wide photograph's far end, or a pad of small
    // notes, has seams at its own scale.
    sizeField: noteSizeField(
      blobs.filter((b) => isPlausibleNote(b, noiseFloor)),
      noteSize,
    ),
    onDrop: (box, reason) => {
      if (reason === 'area' || reason === 'size-floor' || reason === 'aspect') refused.push(box);
      opts.onDrop?.(box, reason);
    },
  });
  // …and now throw away what is not paper at all.
  //
  // Every box so far is a region that scraped past the colour floor somewhere
  // inside it. A NOTE stands out from the wall it is stuck to: measured across
  // the operator's hand-labelled walls, nine real notes in ten sit at least
  // 0.05 of saturation above the floor where they lie, while half the spurious
  // boxes — tape, a shadow in a paper seam, cardboard, the white strip of
  // ceiling above the paper — sit AT it or below. The notation has no white,
  // grey or brown note, so nothing true is lost by insisting on it.
  // …and a box that is BLANK and EDGELESS is not a note either: a window
  // pane, a patch of bare kraft, the strip above the paper. A note carries
  // writing, or at least shows an edge against its wall (see `dropBlank`).
  const drop = opts.onDrop ?? (() => {});
  const standOut = (list: Box[], grain = true) =>
    list.filter((box) => {
      const why = notStandingOut(working, box, { grain });
      if (why !== null) drop(box, why);
      return why === null;
    });
  const firstPass = standOut(boxes);
  // Pads are judged against the notes that stand out, and must stand out
  // themselves; not for grain, which a note that small cannot show.
  const outstanding = [
    ...firstPass,
    ...standOut(findPads(refused, firstPass, working, noteSize), false),
  ];
  const blankless = dropBlank(working, outstanding);
  if (blankless.length < outstanding.length) {
    const kept = new Set(blankless);
    for (const box of outstanding) if (!kept.has(box)) drop(box, 'blank');
  }
  // …and a box whose colour does not STOP at its edge is a piece of a
  // surface, not a note: a lit face of cardboard, a window pane, bare kraft
  // (see `dropSurfaces`). A note is an object; its paper ends.
  const surfaced = dropSurfaces(working, blankless, (box) => drop(box, 'surface'));
  const standing = opts.model
    ? combineWithModel(surfaced, opts.model.cues, mask, opts.model.rules, (box) =>
        drop(box, 'model-background'),
      )
    : surfaced;
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
