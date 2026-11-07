// A dragger's preview on the wire (docs/specs/008-canvas/drag-preview.md "Live movement for
// collaborators"): one patch per element the gesture changes, geometry only, so a collaborator can
// draw the movement live. Presence: relayed unordered, never logged, never replayed.

import type { ArrowElement, Endpoint } from '@livediagram/document';

// docs/specs/008-canvas/blueprints/DEFAULTS.md D71: past this, a gesture sends no patches and
// collaborators see it on release.
export const DRAG_PREVIEW_MAX_ELEMENTS = 200;

export type DragPreviewPatch = {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  from?: Endpoint;
  to?: Endpoint;
  curveOffset?: ArrowElement['curveOffset'];
  elbowOffset?: ArrowElement['elbowOffset'];
  curvePoints?: ArrowElement['curvePoints'];
  labelOffset?: ArrowElement['labelOffset'];
};

export const DRAG_PREVIEW_BOX_FIELDS = ['x', 'y', 'width', 'height', 'rotation'] as const;
export const DRAG_PREVIEW_ARROW_FIELDS = [
  'from',
  'to',
  'curveOffset',
  'elbowOffset',
  'curvePoints',
  'labelOffset',
] as const;

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const delta = (v: unknown) => obj(v) && num(v.dx) && num(v.dy);

function endpoint(v: unknown): Endpoint | null {
  if (!obj(v)) return null;
  if (v.kind === 'free' && num(v.x) && num(v.y)) return { kind: 'free', x: v.x, y: v.y };
  if (v.kind === 'pinned' && typeof v.elementId === 'string' && typeof v.anchor === 'string')
    return {
      kind: 'pinned',
      elementId: v.elementId,
      anchor: v.anchor as Extract<Endpoint, { kind: 'pinned' }>['anchor'],
    };
  if (v.kind === 'on-arrow' && typeof v.arrowId === 'string' && num(v.t))
    return { kind: 'on-arrow', arrowId: v.arrowId, t: v.t };
  return null;
}

// The patches a received op carries, or null when it is malformed or too large (the whole op is then
// dropped). Fields that are not geometry are left out.
export function parseDragPreviewPatches(raw: unknown): DragPreviewPatch[] | null {
  if (!Array.isArray(raw) || raw.length > DRAG_PREVIEW_MAX_ELEMENTS) return null;
  const out: DragPreviewPatch[] = [];
  for (const item of raw) {
    if (!obj(item) || typeof item.id !== 'string') return null;
    const patch: DragPreviewPatch = { id: item.id };
    for (const k of DRAG_PREVIEW_BOX_FIELDS) {
      if (item[k] === undefined) continue;
      if (!num(item[k])) return null;
      patch[k] = item[k];
    }
    for (const k of ['from', 'to'] as const) {
      if (item[k] === undefined) continue;
      const end = endpoint(item[k]);
      if (!end) return null;
      patch[k] = end;
    }
    for (const k of ['curveOffset', 'elbowOffset'] as const) {
      if (item[k] === undefined) continue;
      if (!delta(item[k])) return null;
      const d = item[k] as { dx: number; dy: number };
      patch[k] = { dx: d.dx, dy: d.dy };
    }
    if (item.curvePoints !== undefined) {
      if (!Array.isArray(item.curvePoints) || !item.curvePoints.every(delta)) return null;
      patch.curvePoints = (item.curvePoints as { dx: number; dy: number }[]).map((d) => ({
        dx: d.dx,
        dy: d.dy,
      }));
    }
    if (item.labelOffset !== undefined) {
      const l = item.labelOffset;
      if (!obj(l) || !num(l.t) || !num(l.offset)) return null;
      patch.labelOffset = { t: l.t, offset: l.offset };
    }
    out.push(patch);
  }
  return out;
}

// docs/specs/008-canvas/blueprints/DEFAULTS.md D127: the most riding ids one ride names. 5,000 element ids
// (36-character UUIDs) fit in the room's 256 KiB message; past it collaborators see that gesture on release.
export const DRAG_PREVIEW_MAX_RIDE_IDS = 5000;
// The longest element id a ride names; a longer one drops the op.
const MAX_RIDE_ID_LEN = 200;

// A very large move on the wire (docs/specs/008-canvas/drag-preview.md "Live movement for collaborators"): the
// one offset most of its elements ride, from where the gesture found them, instead of a patch each. `ids`, the
// elements riding it, comes on the gesture's first message, when the set changes, and at least once a second
// (DRAG_PREVIEW_RIDE_IDS_MS); a message without it moves the ids last named. `patches` are the changed elements
// that do not ride it, at most DRAG_PREVIEW_MAX_ELEMENTS.
export type DragPreviewRide = {
  dx: number;
  dy: number;
  ids?: string[];
  patches: DragPreviewPatch[];
};

// The ride a received op carries, or null when it is malformed or too large (the whole op is then dropped).
export function parseDragPreviewRide(raw: unknown): DragPreviewRide | null {
  if (!obj(raw) || !num(raw.dx) || !num(raw.dy)) return null;
  const patches = parseDragPreviewPatches(raw.patches ?? []);
  if (!patches) return null;
  const ride: DragPreviewRide = { dx: raw.dx, dy: raw.dy, patches };
  if (raw.ids !== undefined) {
    const ids = raw.ids;
    if (
      !Array.isArray(ids) ||
      ids.length > DRAG_PREVIEW_MAX_RIDE_IDS ||
      !ids.every((id) => typeof id === 'string' && id.length <= MAX_RIDE_ID_LEN)
    )
      return null;
    ride.ids = ids as string[];
  }
  return ride;
}
