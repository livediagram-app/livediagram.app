import { clamp, EVENT_STORMING_NOTES } from '@livediagram/diagram';
import type { DetectedSticky, Truth } from '@livediagram/sticky-vision';

// Correcting the boxes on a photograph under review (docs/specs/021-event-storming/event-storming.md Phase 9): move,
// resize, change kind, and reopen a saved label. Pure, in WORKING-image
// pixels — the space the detector found the boxes in — so the overlay only
// converts the pointer into that space and hands the result back.

type Frame = { width: number; height: number };
export type Corner = 'nw' | 'ne' | 'sw' | 'se';

// The smallest box there can be: enough of the photo to classify its paper.
const MIN_SIDE_PX = 4;

// A dragged box stays whole on the photo: it stops at the edge rather than
// hanging off it, where its crop would be cut from nothing.
export function moveBox(box: DetectedSticky, dx: number, dy: number, frame: Frame): DetectedSticky {
  return {
    ...box,
    x: Math.round(clamp(box.x + dx, 0, frame.width - box.w)),
    y: Math.round(clamp(box.y + dy, 0, frame.height - box.h)),
  };
}

// Drag one corner; the opposite corner stays put. A corner dragged past its
// opposite stops a few pixels short of it instead of turning the box inside
// out, which is what a person dragging too far means.
export function resizeBox(
  box: DetectedSticky,
  corner: Corner,
  dx: number,
  dy: number,
  frame: Frame,
): DetectedSticky {
  let left = box.x;
  let top = box.y;
  let right = box.x + box.w;
  let bottom = box.y + box.h;
  if (corner === 'nw' || corner === 'sw') left = clamp(left + dx, 0, right - MIN_SIDE_PX);
  else right = clamp(right + dx, left + MIN_SIDE_PX, frame.width);
  if (corner === 'nw' || corner === 'ne') top = clamp(top + dy, 0, bottom - MIN_SIDE_PX);
  else bottom = clamp(bottom + dy, top + MIN_SIDE_PX, frame.height);
  return {
    ...box,
    x: Math.round(left),
    y: Math.round(top),
    w: Math.round(right - left),
    h: Math.round(bottom - top),
  };
}

const SIZE_OF = new Map(EVENT_STORMING_NOTES.map((n) => [n.kind as string, n.size]));

// A new kind brings its own silhouette with it: a policy lands wide, an actor
// small, whatever the note it replaced was.
export function withKind(box: DetectedSticky, kind: string): DetectedSticky {
  return {
    ...box,
    kind: kind as DetectedSticky['kind'],
    size: SIZE_OF.get(kind) ?? box.size,
  };
}

// A label's boxes get ids far below anything else on the surface: detected
// boxes are the reader's crop ids (0, 1, 2…), drawn boxes count down from -1.
const LABEL_ID_BASE = -100_000;

// A saved label, back on the photo it describes, ready to correct. The words
// come back too, keyed by the new ids. Refused, by name, for another photo —
// labels are named after the photograph, and one laid over the wrong wall is
// fifty wrong boxes that look plausible.
export function boxesFromLabel(
  label: Truth,
  photoName: string,
  frame: Frame,
): { boxes: DetectedSticky[]; words: Map<number, string> } {
  if (typeof label?.photo !== 'string' || !Array.isArray(label.notes)) {
    throw new Error('That file is not a saved label.');
  }
  const stem = photoName.replace(/\.[^.]+$/, '');
  if (label.photo !== stem) {
    throw new Error(`That label is for "${label.photo}", and this photo is "${stem}".`);
  }
  const words = new Map<number, string>();
  const boxes = label.notes.map((note, at): DetectedSticky => {
    const id = LABEL_ID_BASE - at;
    if (note.text) words.set(id, note.text);
    return withKind(
      {
        id,
        kind: 'domain-event',
        size: 'square',
        x: Math.round(note.x * frame.width),
        y: Math.round(note.y * frame.height),
        w: Math.round(note.w * frame.width),
        h: Math.round(note.h * frame.height),
        row: 0,
        order: at,
        confidence: 1,
      },
      note.kind,
    );
  });
  return { boxes, words };
}
