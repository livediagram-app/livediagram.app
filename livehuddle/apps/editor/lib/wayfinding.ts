// The pure half of the Directory and the Elevator (docs/specs/009-elements/directory.md, elevator.md): a space's
// places (its Rooms, Office Pods and Stages, per tab, named and ordered), where a walk approaches each and where a jump
// lands, who is in which from presence, and the floors an Elevator serves. No React, no DOM.
import {
  callStages,
  DEFAULT_ROOM_DOOR,
  isRoomOutline,
  ROOM_WALL,
  roomDoorSpan,
  roomInterior,
  roomZones,
  stageAt,
  stageTop,
  zoneAt,
  type Element,
  type ShapeElement,
} from '@livehuddle/document';
import { podInterior } from '@liveworkspace/avatar/pod';
import { doorLine, pointInPolygon } from '@liveworkspace/avatar/room-outline';
import { avatarPadCore } from '@liveworkspace/avatar/pad-art';
import { avatarScale } from '@liveworkspace/avatar/config';
import { avatarSpawnBelow } from '@liveworkspace/avatar/walk';

export type WayPoint = { x: number; y: number };
export type WayBox = { x: number; y: number; width: number; height: number };
export type PlaceKind = 'room' | 'pod' | 'stage';

export type SpacePlace = {
  id: string;
  tabId: string;
  kind: PlaceKind;
  name: string;
  /** Just outside the doorway, where a walk heads first; null when the place has no doorway. */
  approach: WayPoint | null;
  /** Just inside the doorway (else the centre, a stage's top): where a walk ends and a jump lands. */
  arrival: WayPoint;
  /** The box the place's own walls stand in (a room's or an Office Pod's), walked round on the way to a doorway on
   * its far side; null for a Stage, which has no walls. */
  bounds: WayBox | null;
};

/** A tab as the wayfinding reads it. */
export type WayTab = { id: string; name: string; elements: readonly Element[] };

const NOUN: Record<PlaceKind, string> = { room: 'Room', pod: 'Office Pod', stage: 'Stage' };
// How far outside and inside a doorway the approach and arrival points sit, in canvas px.
const ROOM_OUT = 32;
const ROOM_IN = 40;
const POD_OUT = 28;
const POD_IN = 24;
const STAGE_OUT = 18;
// The Elevator's name line under its box (ElevatorFace: a 2px margin and an 11px line, leading-tight), which the
// figure stepping out stands below.
const ELEVATOR_NAME = 16;
// How far outside a place's walls box a Walk There goes round it: clear of the walls' reach (a Regular character's
// 12px from a wall line drawn 5px inside the box) with room to spare, and inside the 32px a room's approach sits out.
const ROUND_CLEAR = 28;

function placeKind(el: Element): PlaceKind | null {
  if (el.type !== 'shape') return null;
  if (el.shape === 'room') return 'room';
  if (el.shape === 'office-pod') return 'pod';
  if (el.shape === 'stage') return 'stage';
  return null;
}

/** Reading order: top to bottom, then left to right, then id, so every screen numbers the same. */
function byPosition(a: ShapeElement, b: ShapeElement): number {
  return a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function centre(box: { x: number; y: number; width: number; height: number }): WayPoint {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// A Room Builder room: its outline in canvas px, and the door standing on it if any.
function outlineRoomPoints(
  room: ShapeElement,
  outline: readonly WayPoint[],
  elements: readonly Element[],
): Pick<SpacePlace, 'approach' | 'arrival'> {
  const poly = outline.map((p) => ({
    x: room.x + p.x * room.width,
    y: room.y + p.y * room.height,
  }));
  const mean = {
    x: poly.reduce((s, p) => s + p.x, 0) / poly.length,
    y: poly.reduce((s, p) => s + p.y, 0) / poly.length,
  };
  const inside = pointInPolygon(mean, poly) ? mean : centre(room);
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'door') continue;
    const line = doorLine(el);
    const mid = { x: (line.a.x + line.b.x) / 2, y: (line.a.y + line.b.y) / 2 };
    // A door on this room's outline: its middle within a wall's reach of the room's box.
    if (
      mid.x < room.x - ROOM_WALL ||
      mid.x > room.x + room.width + ROOM_WALL ||
      mid.y < room.y - ROOM_WALL ||
      mid.y > room.y + room.height + ROOM_WALL
    )
      continue;
    const len = Math.hypot(line.b.x - line.a.x, line.b.y - line.a.y) || 1;
    const nx = -(line.b.y - line.a.y) / len;
    const ny = (line.b.x - line.a.x) / len;
    const probe = { x: mid.x + nx * ROOM_IN, y: mid.y + ny * ROOM_IN };
    const sign = pointInPolygon(probe, poly) ? 1 : -1;
    return {
      approach: { x: mid.x - sign * nx * ROOM_OUT, y: mid.y - sign * ny * ROOM_OUT },
      arrival: { x: mid.x + sign * nx * ROOM_IN, y: mid.y + sign * ny * ROOM_IN },
    };
  }
  return { approach: null, arrival: inside };
}

/** Where a walk approaches a place and where it (and a jump) arrives. */
export function placePoints(
  el: ShapeElement,
  elements: readonly Element[],
): Pick<SpacePlace, 'approach' | 'arrival'> {
  if (el.shape === 'stage') {
    const top = stageTop(el);
    return {
      approach: { x: el.x + el.width / 2, y: el.y + el.height + STAGE_OUT },
      arrival: centre(top),
    };
  }
  if (el.shape === 'office-pod') {
    const inner = podInterior(el);
    const front = inner.y + inner.height;
    const x = inner.x + inner.width / 2;
    return { approach: { x, y: front + POD_OUT }, arrival: { x, y: front - POD_IN } };
  }
  if (isRoomOutline(el.roomOutline)) return outlineRoomPoints(el, el.roomOutline, elements);
  const inner = roomInterior(el);
  const door = el.roomDoor ?? DEFAULT_ROOM_DOOR;
  const half = ROOM_WALL / 2;
  const along = door === 'n' || door === 's' ? el.width : el.height;
  const span = roomDoorSpan(along, door);
  if (!span) return { approach: null, arrival: centre(inner) };
  const mid = (span[0] + span[1]) / 2;
  switch (door) {
    case 'n':
      return {
        approach: { x: el.x + mid, y: inner.y - ROOM_OUT },
        arrival: { x: el.x + mid, y: inner.y + ROOM_IN },
      };
    case 'w':
      return {
        approach: { x: el.x + half - ROOM_OUT, y: el.y + mid },
        arrival: { x: el.x + half + ROOM_IN, y: el.y + mid },
      };
    case 'e':
      return {
        approach: { x: el.x + el.width - half + ROOM_OUT, y: el.y + mid },
        arrival: { x: el.x + el.width - half - ROOM_IN, y: el.y + mid },
      };
    default: {
      const front = el.y + el.height - half;
      return {
        approach: { x: el.x + mid, y: front + ROOM_OUT },
        arrival: { x: el.x + mid, y: front - ROOM_IN },
      };
    }
  }
}

/** One tab's places in reading order, an unnamed one named by its position among the unnamed of its kind. */
export function tabPlaces(tabId: string, elements: readonly Element[]): SpacePlace[] {
  const shapes = elements
    .filter((el): el is ShapeElement => placeKind(el) !== null)
    .sort(byPosition);
  const counts: Record<PlaceKind, number> = { room: 0, pod: 0, stage: 0 };
  return shapes.map((el) => {
    const kind = placeKind(el)!;
    const typed = el.label?.trim();
    let name = typed;
    if (!name) {
      counts[kind] += 1;
      name = `${NOUN[kind]} ${counts[kind]}`;
    }
    const bounds =
      kind === 'stage' ? null : { x: el.x, y: el.y, width: el.width, height: el.height };
    return { id: el.id, tabId, kind, name, ...placePoints(el, elements), bounds };
  });
}

/** Every tab's places, in tab order. */
export function spacePlaces(tabs: readonly WayTab[]): { tab: WayTab; places: SpacePlace[] }[] {
  return tabs.map((tab) => ({ tab, places: tabPlaces(tab.id, tab.elements) }));
}

/** The place whose call a point is in (docs/specs/009-elements/directory.md "The list"): a stage's top first. */
export function placeAt(
  at: WayPoint,
  zones: ReturnType<typeof roomZones>,
  stages: ReturnType<typeof callStages>,
): string | null {
  return stageAt(at, stages)?.id ?? zoneAt(at, zones);
}

/** The place finder for one tab's elements: build once per board change, ask per person. */
export function placeFinder(elements: readonly Element[]): (at: WayPoint) => string | null {
  const zones = roomZones(elements);
  const stages = callStages(elements, zones);
  if (zones.length === 0 && stages.length === 0) return () => null;
  return (at) => placeAt(at, zones, stages);
}

// --- The Elevator --------------------------------------------------------------------------------------------

export type SpaceFloor = {
  tabId: string;
  name: string;
  /** The floor's Elevators in reading order, each with where you step out of it. */
  elevators: { id: string; name: string; exit: WayPoint }[];
  /** Where the floor arrives with no Elevator picked: its first Elevator, else its pad, else its middle. */
  arrival: WayPoint;
  /** What the arrival is, for the panel's words. */
  arrivesAt: 'elevator' | 'pad' | 'middle';
};

/**
 * Where a character steps out of an Elevator (docs/specs/009-elements/elevator.md "Where a floor arrives"): centred in
 * front of its doors, the whole figure below its name, as a Walk In button's entry stands it below the button. The
 * position is the feet, so the figure's height goes in: 36px below the box stood the character over the name.
 */
export function elevatorExitPoint(el: WayBox): WayPoint {
  return avatarSpawnBelow({ ...el, height: el.height + ELEVATOR_NAME }, avatarScale('regular'));
}

// --- Walk There's route --------------------------------------------------------------------------------------

function strictlyInside(p: WayPoint, box: WayBox): boolean {
  return p.x > box.x && p.x < box.x + box.width && p.y > box.y && p.y < box.y + box.height;
}

/** Whether the segment a-b passes through the box's inside (running along an edge or touching a corner does not). */
function crossesBox(a: WayPoint, b: WayPoint, box: WayBox): boolean {
  // Liang-Barsky: clip the segment's parameter range to the box's four slabs, then test the clipped middle.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const slabs: [number, number][] = [
    [-dx, a.x - box.x],
    [dx, box.x + box.width - a.x],
    [-dy, a.y - box.y],
    [dy, box.y + box.height - a.y],
  ];
  for (const [p, q] of slabs) {
    if (p === 0) {
      if (q <= 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 >= t1) return false;
  }
  const mid = (t0 + t1) / 2;
  return strictlyInside({ x: a.x + dx * mid, y: a.y + dy * mid }, box);
}

function pathLength(from: WayPoint, points: readonly WayPoint[]): number {
  let at = from;
  let sum = 0;
  for (const p of points) {
    sum += Math.hypot(p.x - at.x, p.y - at.y);
    at = p;
  }
  return sum;
}

/**
 * The points a Walk There walks through, in order, from the character's feet (docs/specs/009-elements/directory.md
 * "Walk There"): the approach, then the arrival. When the straight line to the approach would cross the place's own
 * walls box (a doorway on its far side, such as a Door on a room's top wall walked to from below), the walk first goes
 * round the outside of the box by the nearer way, through at most two of its corners grown by ROUND_CLEAR: walked
 * straight, it met the near wall head-on and stopped there. A character already inside the box walks straight to the
 * arrival. Any other wall is the ordinary walk's, and still stops it.
 */
export function walkThereRoute(
  from: WayPoint,
  place: { approach: WayPoint | null; arrival: WayPoint; bounds?: WayBox | null },
): WayPoint[] {
  const { approach, arrival } = place;
  if (!approach) return [arrival];
  const box = place.bounds;
  if (!box || strictlyInside(approach, box)) return [approach, arrival];
  if (strictlyInside(from, box)) return [arrival];
  if (!crossesBox(from, approach, box)) return [approach, arrival];
  const g = {
    x: box.x - ROUND_CLEAR,
    y: box.y - ROUND_CLEAR,
    right: box.x + box.width + ROUND_CLEAR,
    bottom: box.y + box.height + ROUND_CLEAR,
  };
  // Ring order, so a corner's neighbours are the ones either side of it.
  const corners: WayPoint[] = [
    { x: g.x, y: g.y },
    { x: g.right, y: g.y },
    { x: g.right, y: g.bottom },
    { x: g.x, y: g.bottom },
  ];
  const clear = (via: readonly WayPoint[]) => {
    let at = from;
    for (const p of [...via, approach]) {
      if (crossesBox(at, p, box)) return false;
      at = p;
    }
    return true;
  };
  let best: { via: WayPoint[]; length: number } | null = null;
  for (let i = 0; i < 4; i++) {
    const first = corners[i]!;
    for (const via of [[first], [first, corners[(i + 1) % 4]!], [first, corners[(i + 3) % 4]!]]) {
      if (!clear(via)) continue;
      const length = pathLength(from, [...via, approach]);
      if (!best || length < best.length) best = { via, length };
    }
  }
  // From outside a box, two corners always reach a point outside it; kept for a degenerate (zero-size) box.
  return best ? [...best.via, approach, arrival] : [approach, arrival];
}

function middleOf(elements: readonly Element[]): WayPoint {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const el of elements) {
    if (!('width' in el) || typeof el.x !== 'number' || typeof el.y !== 'number') continue;
    x0 = Math.min(x0, el.x);
    y0 = Math.min(y0, el.y);
    x1 = Math.max(x1, el.x + el.width);
    y1 = Math.max(y1, el.y + el.height);
  }
  return Number.isFinite(x0) ? { x: (x0 + x1) / 2, y: (y0 + y1) / 2 } : { x: 0, y: 0 };
}

/** The space's floors (its tabs, in order) and the Elevators on each. */
/**
 * A floor's Elevators in reading order, each named (elevator.md "Names"): its label, else "Elevator n" by position
 * among the unnamed on that floor.
 */
export function floorElevators(
  elements: readonly Element[],
): { id: string; name: string; exit: WayPoint }[] {
  let unnamed = 0;
  return elements
    .filter((el): el is ShapeElement => el.type === 'shape' && el.shape === 'elevator')
    .sort(byPosition)
    .map((el) => {
      const typed = el.label?.trim();
      if (!typed) unnamed += 1;
      return { id: el.id, name: typed || `Elevator ${unnamed}`, exit: elevatorExitPoint(el) };
    });
}

/** An Elevator's name on its floor, or null when it is not on the tab. */
export function elevatorName(elements: readonly Element[], id: string): string | null {
  return floorElevators(elements).find((e) => e.id === id)?.name ?? null;
}

export function spaceFloors(tabs: readonly WayTab[]): SpaceFloor[] {
  return tabs.map((tab) => {
    const elevators = floorElevators(tab.elements);
    const pad = tab.elements.find(
      (el): el is ShapeElement => el.type === 'shape' && el.shape === 'avatar-pad',
    );
    const arrival = elevators[0]?.exit ?? (pad ? avatarPadCore(pad) : middleOf(tab.elements));
    const arrivesAt = elevators[0] ? 'elevator' : pad ? 'pad' : 'middle';
    return { tabId: tab.id, name: tab.name, elevators, arrival, arrivesAt };
  });
}

// --- Who is where --------------------------------------------------------------------------------------------

export type WayPerson = {
  id: string;
  name: string;
  color: string;
  tabId: string;
  /** The place they stand in on the current tab; null for Around (or another tab, where it is not known). */
  placeId: string | null;
  self?: boolean;
};

/** A by-value key for a people list: what the Directory shows, so a walk inside one room changes nothing. */
export function peopleKey(people: readonly WayPerson[]): string {
  return people.map((p) => `${p.id}|${p.tabId}|${p.placeId ?? ''}|${p.name}|${p.color}`).join('\n');
}

/**
 * Everyone the Directory can place (docs/specs/009-elements/directory.md "The list"): the characters on the current
 * tab, each in the place its feet stand in, then everyone the tab bar has on a tab who is not already listed, in no
 * place (Around on the current tab; on another tab, only that they are there).
 */
export function whoIsWhere(input: {
  activeTabId: string;
  findPlace: (at: WayPoint) => string | null;
  self: { id: string; name: string; color: string; feet: WayPoint | null };
  peers: readonly { id: string; name: string; color: string; feet: WayPoint }[];
  byTab: ReadonlyMap<string, readonly { id: string; name: string; color: string }[]>;
}): WayPerson[] {
  const { activeTabId, findPlace, self, peers, byTab } = input;
  const out: WayPerson[] = [];
  const seen = new Set<string>();
  out.push({
    id: self.id,
    name: self.name,
    color: self.color,
    tabId: activeTabId,
    placeId: self.feet ? findPlace(self.feet) : null,
    self: true,
  });
  seen.add(self.id);
  for (const peer of peers) {
    if (seen.has(peer.id)) continue;
    seen.add(peer.id);
    out.push({ ...peer, tabId: activeTabId, placeId: findPlace(peer.feet) });
  }
  for (const [tabId, people] of byTab) {
    for (const p of people) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({ id: p.id, name: p.name, color: p.color, tabId, placeId: null });
    }
  }
  return out;
}
