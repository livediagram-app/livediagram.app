// Where calls happen on a tab (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Rooms are calls", "The
// stage"): every Office room's floor as a call, every stage's top and who may speak from it, and which of each a point
// is in. Pure geometry over a tab's visible elements, read by the editor's call (apps/editor/lib/calls) and by the
// api's room when it checks who may hear whom (apps/api/src/calls/call-hearing.ts), so both answer the same.
import { roomInterior } from '@livehuddle/avatar/office-geometry';
import { pointInPolygon, polygonArea } from '@livehuddle/avatar/room-outline';
import { isRoomOutline } from './room-outline-field';
import { podInterior } from '@livehuddle/avatar/pod';
import { isSeatFacing } from '@livehuddle/avatar/facing';
import { boothInterior } from '@livehuddle/avatar/booth';
import { DEFAULT_STAGE_SPEAKERS, isStageSpeakers, stageTop, type StageSpeakers } from './office';

/**
 * A subscribed speaker in the open is let go only beyond this many canvas px, feet to feet (proximity-audio.md
 * "Hearing"): the furthest the open floor ever carries a voice, which the api's hearing check measures from.
 */
export const CALL_RELEASE_RADIUS_PX = 300;

/**
 * A point in canvas px: a character's feet, and the seat they sit on, if any. Only a seated character is in a Phone
 * Booth's call (`CallZone.seat`); someone crossing its floor stays in the room's.
 */
export type CallPoint = {
  readonly x: number;
  readonly y: number;
  readonly seatedOn?: string | null;
};

/** A share level as the calls read it: an Editor's, a Participant's or a Viewer's. */
export type CallLevel = 'edit' | 'participate' | 'view';

/** A room's floor as the call reads it: the box inside its walls' centre lines, and its area for nesting. */
export type CallZone = {
  readonly id: string;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly area: number;
  // A room drawn with the Room Builder (docs/specs/009-elements/room-builder.md): its outline in canvas px, which
  // the point must be inside as well as inside the box.
  readonly polygon?: readonly CallPoint[];
  // A Phone Booth's (docs/specs/009-elements/workday-pieces.md "Phone Booth"): a call only for whoever sits on it,
  // the piece whose id it carries. Feet on its floor without that seat are in the call round it.
  readonly seat?: true;
};

/** A stage's top as the call reads it, the room it stands in (null: the open), and its two settings. */
export type CallStage = CallZone & {
  readonly zone: string | null;
  readonly speakers: StageSpeakers;
  readonly cameras: boolean;
};

/** An element as the calls read it: only rooms and stages count. */
export type CallElementSource = {
  readonly id: string;
  readonly type: string;
  readonly shape?: string;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly roomOutline?: unknown;
  readonly stageSpeakers?: unknown;
  readonly stageCameras?: unknown;
  // A pod's or a phone booth's facing (docs/specs/009-elements/furniture-facing.md): its floor turns with it.
  readonly chairFacing?: unknown;
};

type Box = { x: number; y: number; width: number; height: number };

// The element's box when it is the `shape` asked for and fully placed.
function boxOf(el: CallElementSource, shape: string): Box | null {
  if (el.type !== 'shape' || el.shape !== shape) return null;
  const { x, y, width, height } = el;
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number'
  ) {
    return null;
  }
  return { x, y, width, height };
}

/**
 * Every Office room among `elements` as a zone, and every Office Pod (docs/specs/009-elements/office.md "Office Pod"):
 * the floor inside its walls is a call too, and every Phone Booth (docs/specs/009-elements/workday-pieces.md "Phone
 * Booth"): the booth inside its frame is a call for one. The caller passes only what is on visible layers.
 */
export function roomZones(elements: readonly CallElementSource[]): CallZone[] {
  const zones: CallZone[] = [];
  for (const el of elements) {
    const room = boxOf(el, 'room');
    const pod = room ? null : boxOf(el, 'office-pod');
    const booth = room || pod ? null : boxOf(el, 'phone-booth');
    const box = room ?? pod ?? booth;
    if (!box) continue;
    // A room drawn with the Room Builder (room-builder.md): its floor is its outline.
    if (room && isRoomOutline(el.roomOutline)) {
      const polygon = el.roomOutline.map((p) => ({
        x: room.x + p.x * room.width,
        y: room.y + p.y * room.height,
      }));
      const area = polygonArea(polygon);
      if (area <= 0) continue;
      const xs = polygon.map((p) => p.x);
      const ys = polygon.map((p) => p.y);
      zones.push({
        id: el.id,
        x0: Math.min(...xs),
        y0: Math.min(...ys),
        x1: Math.max(...xs),
        y1: Math.max(...ys),
        area,
        polygon,
      });
      continue;
    }
    const inside = room
      ? roomInterior(room)
      : pod
        ? podInterior({
            ...pod,
            chairFacing: isSeatFacing(el.chairFacing) ? el.chairFacing : undefined,
          })
        : boothInterior(box, isSeatFacing(el.chairFacing) ? el.chairFacing : 'n');
    if (inside.width <= 0 || inside.height <= 0) continue;
    zones.push({
      id: el.id,
      x0: inside.x,
      y0: inside.y,
      x1: inside.x + inside.width,
      y1: inside.y + inside.height,
      area: inside.width * inside.height,
      ...(booth ? { seat: true as const } : {}),
    });
  }
  return zones;
}

/** The smallest box `at` is strictly inside, then the lower id; null for none. */
function innermost<T extends CallZone>(at: CallPoint, boxes: readonly T[]): T | null {
  let best: T | null = null;
  for (const z of boxes) {
    if (at.x <= z.x0 || at.x >= z.x1 || at.y <= z.y0 || at.y >= z.y1) continue;
    if (z.seat && at.seatedOn !== z.id) continue;
    if (z.polygon && !pointInPolygon(at, z.polygon)) continue;
    if (!best || z.area < best.area || (z.area === best.area && z.id < best.id)) best = z;
  }
  return best;
}

/**
 * The room whose call `at` is in: strictly inside its walls' centre lines (feet on the doorway's threshold are still
 * outside), the innermost (smallest) of several, then the lower id; null on the open floor. A Phone Booth counts
 * only for feet seated on it (`at.seatedOn`).
 */
export function zoneAt(at: CallPoint, zones: readonly CallZone[]): string | null {
  return innermost(at, zones)?.id ?? null;
}

/** Every stage among `elements` (the caller passes only what is on visible layers), with the room each stands in. */
export function callStages(
  elements: readonly CallElementSource[],
  zones: readonly CallZone[],
): CallStage[] {
  const stages: CallStage[] = [];
  for (const el of elements) {
    const box = boxOf(el, 'stage');
    if (!box) continue;
    const top = stageTop(box);
    if (top.width <= 0 || top.height <= 0) continue;
    const centre = { x: top.x + top.width / 2, y: top.y + top.height / 2 };
    stages.push({
      id: el.id,
      x0: top.x,
      y0: top.y,
      x1: top.x + top.width,
      y1: top.y + top.height,
      area: top.width * top.height,
      zone: zoneAt(centre, zones),
      speakers: isStageSpeakers(el.stageSpeakers) ? el.stageSpeakers : DEFAULT_STAGE_SPEAKERS,
      cameras: el.stageCameras === true,
    });
  }
  return stages;
}

/** The stage `at` stands on: strictly on its top, the smallest of several, then the lower id; null off every stage. */
export function stageAt(at: CallPoint, stages: readonly CallStage[]): CallStage | null {
  return innermost(at, stages);
}

/** Whether someone at `level` may speak from a stage (the spec's Who Can Speak). No level is a Viewer's. */
export function mayTakeStage(level: CallLevel | undefined, speakers: StageSpeakers): boolean {
  if (level === 'edit') return true;
  return level === 'participate' && speakers === 'take-part';
}
