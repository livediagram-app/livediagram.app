import { AMBIGUOUS_ID, seamRadiusFor, threeClassMask, type Rect } from '../mask';
import { paintBacking, paintDistractors, paintWallMarks, tape } from './backing';
import { develop, light, randomView, warp } from './camera';
import { layoutNotes } from './layout';
import { paintNote } from './notes';
import { BACKINGS, type Backing } from './palette';
import { planeOf } from './raster';
import { paintRoom } from './room';
import { rngFrom } from './rng';

// A procedurally generated photograph of an event-storming wall, with its
// training mask (experiment E1). Every wall is a pure function of its seed.

export type SyntheticWall = {
  width: number;
  height: number;
  // 8-bit RGB, three bytes per pixel.
  rgb: Uint8Array;
  // CLASS per pixel (background / core / seam).
  classes: Uint8Array;
  // One box per note the photograph shows enough of to count.
  boxes: Rect[];
  noteSize: number;
};

export type SyntheticOptions = { noteSize?: number; backing?: Backing };

// The wall plane is larger than the frame, so the camera can turn and tilt
// without showing an edge that is not there.
const PLANE_MARGIN = 1.2;
// A note the frame shows less of than this (behind a box, off the edge) is
// not asked of the model as a note: its paper is seam, never core.
const MIN_VISIBLE_FRACTION = 0.3;
// The range of note sizes, in output pixels: the real walls at the 1000px
// working size run from ~18px (a dense whiteboard) to ~110px (a close-up).
export const NOTE_SIZE_RANGE: [number, number] = [14, 120];

export function syntheticWall(
  seed: number,
  width: number,
  height: number,
  opts: SyntheticOptions = {},
): SyntheticWall {
  const rng = rngFrom(seed);
  const noteSize = opts.noteSize ?? rng.logRange(...NOTE_SIZE_RANGE);
  const backing = opts.backing ?? rng.pick(BACKINGS);
  const plane = planeOf(Math.ceil(width * PLANE_MARGIN), Math.ceil(height * PLANE_MARGIN));

  paintBacking(plane, rng, backing, noteSize);
  paintWallMarks(plane, rng, noteSize);
  paintDistractors(plane, rng, noteSize);
  const notes = layoutNotes(rng, plane.width, plane.height, noteSize);
  const shadowFall = { dx: rng.range(-0.04, 0.04), dy: rng.range(0.0, 0.08) };
  for (const note of notes) paintNote(plane, rng, note, shadowFall);
  // Tape over the notes themselves: the paper stays a note beneath it.
  const tapes = rng.chance(0.3) ? rng.int(1, 3) : 0;
  for (let i = 0; i < tapes; i += 1) tape(plane, rng, noteSize);
  paintRoom(plane, rng, noteSize);

  const view = randomView(rng, { w: width, h: height }, plane);
  const { rgb: linear, ids } = warp(plane, view, width, height);
  light(linear, width, height, rng);
  const rgb = develop(linear, width, height, rng);

  const { boxes, radius } = visibleNotes(ids, width, notes);
  const classes = threeClassMask(ids, width, height, (id) => radius.get(id) ?? 2);
  return { width, height, rgb, classes, boxes, noteSize };
}

function visibleNotes(
  ids: Int32Array,
  width: number,
  notes: readonly { id: number; w: number; h: number }[],
): { boxes: Rect[]; radius: Map<number, number> } {
  const ext = new Map<number, { x0: number; y0: number; x1: number; y1: number; n: number }>();
  for (let p = 0; p < ids.length; p += 1) {
    const id = ids[p]!;
    if (id <= 0) continue;
    const x = p % width;
    const y = (p - x) / width;
    const e = ext.get(id);
    if (!e) ext.set(id, { x0: x, y0: y, x1: x, y1: y, n: 1 });
    else {
      e.x0 = Math.min(e.x0, x);
      e.y0 = Math.min(e.y0, y);
      e.x1 = Math.max(e.x1, x);
      e.y1 = Math.max(e.y1, y);
      e.n += 1;
    }
  }
  const byId = new Map(notes.map((n) => [n.id, n]));
  const boxes: Rect[] = [];
  const radius = new Map<number, number>();
  const hidden = new Set<number>();
  for (const [id, e] of ext) {
    const note = byId.get(id)!;
    radius.set(id, seamRadiusFor(note.w, note.h));
    if (e.n < MIN_VISIBLE_FRACTION * note.w * note.h) {
      hidden.add(id);
      continue;
    }
    boxes.push({ x: e.x0, y: e.y0, w: e.x1 - e.x0 + 1, h: e.y1 - e.y0 + 1 });
  }
  if (hidden.size > 0) {
    for (let p = 0; p < ids.length; p += 1) if (hidden.has(ids[p]!)) ids[p] = AMBIGUOUS_ID;
  }
  return { boxes, radius };
}
