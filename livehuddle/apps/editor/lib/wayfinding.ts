// The pure half of the Directory, the Elevator and the Stairs (docs/specs/009-elements/directory.md, elevator.md,
// stairs.md): a space's places (its Rooms, Office Pods and Stages, per tab, named and ordered), where a walk approaches
// each and where a jump lands, who is in which from presence, the floors an Elevator serves and the flights a Stairs
// climbs. No React, no DOM.
import {
  callStages,
  DEFAULT_ROOM_DOOR,
  doorOnRoom,
  isRoomOutline,
  ROOM_BACK_FACE,
  ROOM_WALL,
  roomDoorSpan,
  roomInterior,
  roomZones,
  pieceFacing,
  STAIRS_ENDS,
  stageAt,
  stageTop,
  zoneAt,
  type Element,
  type ShapeElement,
} from '@livehuddle/document';
import { podDoorway } from '@liveworkspace/avatar/pod';
import { doorLine, pointInPolygon } from '@liveworkspace/avatar/room-outline';
import { avatarPadCore } from '@liveworkspace/avatar/pad-art';
import { avatarScale, type AvatarConfig } from '@liveworkspace/avatar/config';
import { AVATAR_SPAWN_GAP, avatarPortraitBox, avatarSpawnBelow } from '@liveworkspace/avatar/walk';
import { facingView, type SeatFacing } from '@liveworkspace/avatar/facing';

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
export type WayTab = {
  id: string;
  name: string;
  elements: readonly Element[];
  /** False for a lazy tab not fetched yet, whose elements are a placeholder (elevator.md "The panel"). */
  loaded?: boolean;
};

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

// A rectangular Room's walls' centre line (where roomWalls draws them), corners in canvas px.
function rectWalls(el: ShapeElement): WayPoint[] {
  const half = ROOM_WALL / 2;
  const top = el.y + ROOM_BACK_FACE - half;
  const bottom = el.y + el.height - half;
  const left = el.x + half;
  const right = el.x + el.width - half;
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function centre(box: { x: number; y: number; width: number; height: number }): WayPoint {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// A room whose ways in are Door pieces (a Room Builder room, or a Room with no built-in doorway): its walls' centre
// line in canvas px, and the first door standing on it if any.
function doorPiecePoints(
  room: ShapeElement,
  poly: readonly WayPoint[],
  elements: readonly Element[],
): Pick<SpacePlace, 'approach' | 'arrival'> {
  const mean = {
    x: poly.reduce((s, p) => s + p.x, 0) / poly.length,
    y: poly.reduce((s, p) => s + p.y, 0) / poly.length,
  };
  const inside = pointInPolygon(mean, poly) ? mean : centre(room);
  for (const el of elements) {
    // A door standing on one of this room's walls.
    if (el.type !== 'shape' || !doorOnRoom(el, room)) continue;
    const line = doorLine(el);
    const mid = { x: (line.a.x + line.b.x) / 2, y: (line.a.y + line.b.y) / 2 };
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
  // Through its doorway, wherever the pod faces (docs/specs/009-elements/furniture-facing.md "A turn").
  if (el.shape === 'office-pod') {
    const { at, out } = podDoorway(el);
    return {
      approach: { x: at.x + out.x * POD_OUT, y: at.y + out.y * POD_OUT },
      arrival: { x: at.x - out.x * POD_IN, y: at.y - out.y * POD_IN },
    };
  }
  if (isRoomOutline(el.roomOutline)) {
    const outline = el.roomOutline.map((p) => ({
      x: el.x + p.x * el.width,
      y: el.y + p.y * el.height,
    }));
    return doorPiecePoints(el, outline, elements);
  }
  const inner = roomInterior(el);
  const door = el.roomDoor ?? DEFAULT_ROOM_DOOR;
  const half = ROOM_WALL / 2;
  const along = door === 'n' || door === 's' ? el.width : el.height;
  const span = roomDoorSpan(along, door);
  // No built-in doorway (every new Room, docs/specs/009-elements/office.md "The doorway is a Door"): its Doors.
  if (!span) return doorPiecePoints(el, rectWalls(el), elements);
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
  /** Its tab not fetched yet: its Elevators are not known (elevator.md "The panel" "Floors not opened yet"). */
  loading: boolean;
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

/**
 * The points a Walk There walks to, in order, from the character's feet (docs/specs/009-elements/directory.md
 * "Walk There"): the approach, then the arrival. Each is an ordinary `walkTo`, which routes round the walls in the
 * way (avatar-mode.md "Finding the way"), so a doorway on the far side of the place is reached round its walls. A
 * character already inside the place's walls box walks straight to the arrival, never out and back in.
 */
export function walkThereRoute(
  from: WayPoint,
  place: { approach: WayPoint | null; arrival: WayPoint; bounds?: WayBox | null },
): WayPoint[] {
  const { approach, arrival } = place;
  if (!approach) return [arrival];
  const box = place.bounds;
  if (box && !strictlyInside(approach, box) && strictlyInside(from, box)) return [arrival];
  return [approach, arrival];
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

/** The space's floors (its tabs, in order) and the Elevators on each. */
export function spaceFloors(tabs: readonly WayTab[]): SpaceFloor[] {
  return tabs.map(spaceFloor);
}

function spaceFloor(tab: WayTab): SpaceFloor {
  const elevators = floorElevators(tab.elements);
  const pad = tab.elements.find(
    (el): el is ShapeElement => el.type === 'shape' && el.shape === 'avatar-pad',
  );
  const arrival = elevators[0]?.exit ?? (pad ? avatarPadCore(pad) : middleOf(tab.elements));
  const arrivesAt = elevators[0] ? 'elevator' : pad ? 'pad' : 'middle';
  return {
    tabId: tab.id,
    name: tab.name,
    elevators,
    arrival,
    arrivesAt,
    loading: tab.loaded === false,
  };
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
  /** The character they walk as, when this screen has seen it (the Team Photo Wall's portraits). */
  config?: AvatarConfig;
};

const lookKey = (c: AvatarConfig | undefined) =>
  c ? `${c.gender}.${c.clothing}.${c.hair}.${c.hairColour ?? ''}` : '';

/** A by-value key for a people list: what the Directory shows, so a walk inside one room changes nothing. */
export function peopleKey(people: readonly WayPerson[]): string {
  return people
    .map((p) => `${p.id}|${p.tabId}|${p.placeId ?? ''}|${p.name}|${p.color}|${lookKey(p.config)}`)
    .join('\n');
}

/**
 * Everyone the Directory can place (docs/specs/009-elements/directory.md "The list"): the characters on the current
 * tab, each in the place its feet stand in, then everyone the tab bar has on a tab who is not already listed, in no
 * place (Around on the current tab; on another tab, only that they are there).
 */
export function whoIsWhere(input: {
  activeTabId: string;
  findPlace: (at: WayPoint) => string | null;
  self: { id: string; name: string; color: string; feet: WayPoint | null; config?: AvatarConfig };
  peers: readonly {
    id: string;
    name: string;
    color: string;
    feet: WayPoint;
    config?: AvatarConfig;
  }[];
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
    ...(self.config ? { config: self.config } : null),
  });
  seen.add(self.id);
  for (const peer of peers) {
    if (seen.has(peer.id)) continue;
    seen.add(peer.id);
    out.push({
      id: peer.id,
      name: peer.name,
      color: peer.color,
      tabId: activeTabId,
      placeId: findPlace(peer.feet),
      ...(peer.config ? { config: peer.config } : null),
    });
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

// --- The Signpost --------------------------------------------------------------------------------------------

/** One board of a Signpost: the place it names and the way its arrow points. */
export type SignpostBoard = { place: SpacePlace; dir: 'left' | 'right' };

/** Where a Signpost stands: the foot of its post, the middle of its blocking footprint (office-geometry). */
export function signpostFoot(el: WayBox): WayPoint {
  return { x: el.x + el.width / 2, y: el.y + (el.height * 132) / 144 };
}

/**
 * A Signpost's boards (docs/specs/009-elements/team-pieces.md "Signpost"): the `max` places whose arrival is nearest
 * its foot, nearest first (ties in the Directory's reading order), each pointing right when its arrival lies right of
 * the post. One pass that keeps the best `max`, so a tab of many rooms costs a scan, never a sort.
 */
export function signpostBoards(
  places: readonly SpacePlace[],
  foot: WayPoint,
  max: number,
): SignpostBoard[] {
  if (max <= 0) return [];
  const best: { place: SpacePlace; d: number }[] = [];
  for (const place of places) {
    const d = (place.arrival.x - foot.x) ** 2 + (place.arrival.y - foot.y) ** 2;
    if (best.length === max && d >= best[max - 1]!.d) continue;
    let i = best.length;
    while (i > 0 && best[i - 1]!.d > d) i -= 1;
    best.splice(i, 0, { place, d });
    if (best.length > max) best.pop();
  }
  return best.map(({ place }) => ({
    place,
    dir: place.arrival.x > foot.x ? 'right' : 'left',
  }));
}

// --- The Stairs ----------------------------------------------------------------------------------------------

/** A Stairs as its ends read it: its box and its facing (furniture-facing.md), the flight climbing away from its foot. */
export type StairsBox = WayBox & { chairFacing?: SeatFacing };

// The drawing a Stairs shows at its facing (Down when unset), and whether it is the side mirrored.
const stairsView = (el: StairsBox) =>
  facingView(pieceFacing({ shape: 'stairs', chairFacing: el.chairFacing }));

/**
 * Where a climb ends (docs/specs/009-elements/stairs.md "Taking them", "Turned"): the feet on the flight's top step,
 * wherever the flight climbs to on the drawing its facing shows.
 */
export function stairsTopPoint(el: StairsBox): WayPoint {
  const { view, mirrored } = stairsView(el);
  const { u, v } = STAIRS_ENDS[view].top;
  return { x: el.x + el.width * (mirrored ? 1 - u : u), y: el.y + el.height * v };
}

/**
 * Where the walk off the Stairs ends: in front of their foot, clear of the piece. Facing down the foot is below it,
 * facing up above it, on its side beside it (left, or right when mirrored), level with the flight's middle.
 */
export function stairsFootPoint(el: StairsBox): WayPoint {
  const scale = avatarScale('regular');
  const { view, mirrored } = stairsView(el);
  const ends = STAIRS_ENDS[view];
  if (ends.foot === 'below') return avatarSpawnBelow(el, scale);
  if (ends.foot === 'above') return { x: el.x + el.width / 2, y: el.y - AVATAR_SPAWN_GAP };
  const clear = AVATAR_SPAWN_GAP + avatarPortraitBox(scale).width / 2;
  return {
    x: mirrored ? el.x + el.width + clear : el.x - clear,
    y: el.y + el.height * ends.v,
  };
}

/** Where a flight lands on its floor: the Stairs there (their top step and foot), else the floor's arrival. */
export type StairsLanding =
  | { at: 'stairs'; id: string; top: WayPoint; foot: WayPoint }
  | { at: 'elevator'; id: string; top: null; foot: WayPoint }
  | { at: 'pad' | 'middle'; id?: undefined; top: null; foot: WayPoint };

export type StairsFlight = {
  tabId: string;
  /** The floor's number, from 1 in tab order, as the Elevator panel numbers floors. */
  number: number;
  name: string;
  landing: StairsLanding;
  /** Its tab not fetched yet: its Stairs are not known. */
  loading: boolean;
};

export type StairsFloors = {
  /** This floor's number and name; null when the active tab is not among the tabs. */
  here: { number: number; name: string } | null;
  count: number;
  up: StairsFlight | null;
  down: StairsFlight | null;
};

const isStairs = (el: Element): el is ShapeElement => el.type === 'shape' && el.shape === 'stairs';

/**
 * Where a climb from `from` lands on one floor (docs/specs/009-elements/stairs.md "Floors"): its Stairs nearest
 * `from` by centre (ties in reading order), else where an Elevator ride with nothing picked arrives.
 */
export function stairsLanding(tab: WayTab, from: WayBox): StairsLanding {
  const fx = from.x + from.width / 2;
  const fy = from.y + from.height / 2;
  let best: ShapeElement | null = null;
  let bestD = Infinity;
  for (const el of tab.elements) {
    if (!isStairs(el)) continue;
    const d = (el.x + el.width / 2 - fx) ** 2 + (el.y + el.height / 2 - fy) ** 2;
    if (d < bestD || (d === bestD && best && byPosition(el, best) < 0)) {
      best = el;
      bestD = d;
    }
  }
  if (best)
    return { at: 'stairs', id: best.id, top: stairsTopPoint(best), foot: stairsFootPoint(best) };
  const floor = spaceFloor(tab);
  const lift = floor.elevators[0];
  if (lift) return { at: 'elevator', id: lift.id, top: null, foot: floor.arrival };
  return { at: floor.arrivesAt === 'pad' ? 'pad' : 'middle', top: null, foot: floor.arrival };
}

/**
 * The floors a Stairs climbs to (docs/specs/009-elements/stairs.md "Floors"): the tab after the active one (Up) and
 * the tab before it (Down), each with where it lands. Reads only those two tabs.
 */
export function stairsFlights(
  tabs: readonly WayTab[],
  activeTabId: string,
  from: WayBox,
): StairsFloors {
  const i = tabs.findIndex((t) => t.id === activeTabId);
  const flight = (j: number): StairsFlight | null => {
    const tab = i < 0 || j < 0 ? undefined : tabs[j];
    if (!tab) return null;
    return {
      tabId: tab.id,
      number: j + 1,
      name: tab.name,
      landing: stairsLanding(tab, from),
      loading: tab.loaded === false,
    };
  };
  return {
    here: i < 0 ? null : { number: i + 1, name: tabs[i]!.name },
    count: tabs.length,
    up: flight(i + 1),
    down: flight(i - 1),
  };
}
