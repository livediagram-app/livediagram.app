// The Receptionist's day (docs/specs/008-canvas/receptionist.md "His day"): where the receptionist is, on every screen alike, with
// nothing sent. Time is cut into legs of RECEPTIONIST_LEG_MS; each leg's stop comes from his pad's id and the leg's number
// through the office dog's seeded generator (pet-wander.ts), so any two clocks that agree to a second agree on the Receptionist.
// Each leg he walks from the last leg's stop to this one, round the walls (the walk's own route finder), then does the
// stop's thing for the rest of the leg. Pure: no React, no DOM, no clock of its own (the caller passes `now`).

import { hashId, seeded, type Element } from '@livehuddle/document';
import { drinkFrom, roomInterior, type DrinkKind } from '@livehuddle/avatar/office-geometry';
import { findWalkPath, type NavGrid } from '@livehuddle/avatar/pathing';
import type { AvatarFacing } from '@livehuddle/avatar/walk';
import type { AvatarReactionKind } from '@livehuddle/avatar/reactions';

/** One leg of his day: he sets off at its start, strolls to its stop, then does the stop's thing. */
export const RECEPTIONIST_LEG_MS = 16_000;
/** His stroll, in canvas px a second: calmer than a person's walk. */
export const RECEPTIONIST_SPEED = 120;
/** How far round a pad in no room he wanders, and how far he walks from his pad to any stop. */
export const RECEPTIONIST_RADIUS = 480;
/** Every this many legs he goes back to stand by his pad (the last leg of each run). */
export const RECEPTIONIST_HOME_EVERY = 4;
/** How many floor spots a leg tries before he goes home instead. */
export const RECEPTIONIST_TRIES = 12;
/** How long a greeting keeps him by the pad once he gets there. */
export const RECEPTIONIST_GREET_MS = 10_000;
/** How far beside the pad's edge he stands, and how far in front of a piece. */
const BESIDE_PAD = 28;
const BEFORE_PIECE = 18;
/** How far inside a room's front wall he stops when he walks you into it. */
const ROOM_FRONT = 36;
/** How far his feet keep off his room's walls when he picks a floor spot. */
const RECEPTIONIST_INSET = 40;
/** The share of legs spent at a piece rather than on the open floor, when his area has pieces to visit. */
const PIECE_SHARE = 0.7;
/** The flourishes he does on the open floor. */
const FLOURISHES: readonly AvatarReactionKind[] = ['dance', 'spin', 'cheer', 'jumping-jacks'];

type Box = { x: number; y: number; width: number; height: number };
export type Point = { x: number; y: number };

/** What he does at a stop. */
export type ReceptionistActivity =
  'home' | 'drink' | 'admire' | 'browse' | 'pat' | 'desk' | 'flourish';

export type ReceptionistStop = {
  at: Point;
  activity: ReceptionistActivity;
  // Which way he faces once there: toward the piece, or down the canvas at his pad.
  face: AvatarFacing;
  // The drink a machine gives him, held until he next sets off.
  drink?: DrinkKind;
  // The open floor's flourish.
  flourish?: AvatarReactionKind;
};

/** Where his day happens: his pad, the area he keeps to, the stops in it, and the route grid round its walls. */
export type ReceptionistWorld = {
  padId: string;
  pad: Box;
  home: ReceptionistStop;
  area: { kind: 'box'; box: Box } | { kind: 'circle'; at: Point; r: number };
  stops: readonly ReceptionistStop[];
  // A spot just inside each other room's floor, by its front wall: where Rooms and Meetings walks you.
  rooms: readonly Point[];
  grid: NavGrid | null;
};

// The pieces he has something to do at, by kind.
const PIECE_ACTIVITY: Partial<Record<string, ReceptionistActivity>> = {
  plant: 'admire',
  bookshelf: 'browse',
  'pet-bed': 'pat',
  'reception-desk': 'desk',
};

const middle = (b: Box): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const holds = (b: Box, p: Point) =>
  p.x > b.x && p.x < b.x + b.width && p.y > b.y && p.y < b.y + b.height;
const inArea = (area: ReceptionistWorld['area'], p: Point) =>
  area.kind === 'box' ? holds(area.box, p) : Math.hypot(p.x - area.at.x, p.y - area.at.y) <= area.r;

/** The length of a walk through `route`, starting at `from`. */
export function routeLength(from: Point, route: readonly Point[]): number {
  let total = 0;
  let at = from;
  for (const p of route) {
    total += Math.hypot(p.x - at.x, p.y - at.y);
    at = p;
  }
  return total;
}

// Routes and stops are asked for on every drawn frame while he walks, so each is worked out once and kept, per grid
// and per world, a few dozen at most (a leg asks for two stops and one route).
const CACHE_MAX = 64;
const routeCache = new WeakMap<object, Map<string, Point[] | null>>();
const stopCache = new WeakMap<ReceptionistWorld, Map<number, ReceptionistStop>>();
const NO_GRID = {};

function remember<K, V>(map: Map<K, V>, key: K, value: V): V {
  if (map.size >= CACHE_MAX) map.delete(map.keys().next().value as K);
  map.set(key, value);
  return value;
}

/** The route from `from` to `to` round the walls, or null when it cannot get there (the route ends elsewhere). */
export function receptionistRoute(grid: NavGrid | null, from: Point, to: Point): Point[] | null {
  const owner = grid ?? NO_GRID;
  let cache = routeCache.get(owner);
  if (!cache) routeCache.set(owner, (cache = new Map<string, Point[] | null>()));
  const key = `${from.x},${from.y}>${to.x},${to.y}`;
  if (cache.has(key)) return cache.get(key)!;
  const route = findWalkPath(grid, from, to);
  const end = route[route.length - 1]!;
  return remember(cache, key, Math.hypot(end.x - to.x, end.y - to.y) < 1 ? route : null);
}

/** Whether a stop is one he keeps to: inside his area, and within RECEPTIONIST_RADIUS of walking from his pad. */
function reachable(world: Pick<ReceptionistWorld, 'area' | 'grid' | 'home'>, at: Point): boolean {
  if (!inArea(world.area, at)) return false;
  const route = receptionistRoute(world.grid, world.home.at, at);
  return route !== null && routeLength(world.home.at, route) <= RECEPTIONIST_RADIUS;
}

/** The first Avatar Pad in the tab's elements: the Receptionist's pad. */
export function receptionistPad(
  elements: readonly Element[],
): (Box & { id: string; receptionistLeft?: boolean }) | null {
  for (const el of elements) if (el.type === 'shape' && el.shape === 'avatar-pad') return el;
  return null;
}

/**
 * The Receptionist's world on this tab, or null when it has no Avatar Pad or he was asked to leave it. `grid` is the walk's route grid for these walls (null
 * when nothing blocks). His area is the innermost Room whose floor holds the pad's middle, else a circle round it.
 */
export function receptionistWorld(
  elements: readonly Element[],
  grid: NavGrid | null,
): ReceptionistWorld | null {
  const pad = receptionistPad(elements);
  // Asked to leave this pad for good (docs/specs/008-canvas/receptionist.md "Asking him to leave"): no Receptionist.
  if (!pad || pad.receptionistLeft === true) return null;
  const at = middle(pad);
  let room: Box | null = null;
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'room') continue;
    if (!holds(roomInterior(el), at)) continue;
    if (!room || el.width * el.height < room.width * room.height) room = el;
  }
  const floor = room ? roomInterior(room) : null;
  const area: ReceptionistWorld['area'] =
    floor && floor.width > 2 * RECEPTIONIST_INSET && floor.height > 2 * RECEPTIONIST_INSET
      ? {
          kind: 'box',
          box: {
            x: floor.x + RECEPTIONIST_INSET,
            y: floor.y + RECEPTIONIST_INSET,
            width: floor.width - 2 * RECEPTIONIST_INSET,
            height: floor.height - 2 * RECEPTIONIST_INSET,
          },
        }
      : { kind: 'circle', at, r: RECEPTIONIST_RADIUS };
  // He stands beside the pad's right edge, level with its middle, facing down the canvas toward whoever arrives.
  const home: ReceptionistStop = {
    at: { x: pad.x + pad.width + BESIDE_PAD, y: at.y },
    activity: 'home',
    face: 'down',
  };
  const base = { area, grid, home };
  const stops: ReceptionistStop[] = [];
  for (const el of elements) {
    if (el.type !== 'shape') continue;
    const drink = drinkFrom(el.shape);
    const activity: ReceptionistActivity | undefined = drink ? 'drink' : PIECE_ACTIVITY[el.shape];
    if (!activity) continue;
    // In front of the piece, facing it: below its box, across its middle.
    const spot = { x: el.x + el.width / 2, y: el.y + el.height + BEFORE_PIECE };
    if (!reachable(base, spot)) continue;
    stops.push(
      drink ? { at: spot, activity, face: 'up', drink } : { at: spot, activity, face: 'up' },
    );
  }
  const rooms: Point[] = [];
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'room' || el === room) continue;
    const f = roomInterior(el);
    if (holds(f, at)) continue;
    rooms.push({ x: f.x + f.width / 2, y: f.y + f.height - ROOM_FRONT });
  }
  return { padId: pad.id, pad, home, area, stops, rooms, grid };
}

/** The nearest other room's spot to `from`, as the crow flies, or null on a tab with no other room. */
export function nearestRoomSpot(world: ReceptionistWorld, from: Point): Point | null {
  let best: Point | null = null;
  for (const p of world.rooms)
    if (
      !best ||
      Math.hypot(p.x - from.x, p.y - from.y) < Math.hypot(best.x - from.x, best.y - from.y)
    )
      best = p;
  return best;
}

/** The leg `now` falls in. */
export function receptionistLegAt(now: number): number {
  return Math.floor(now / RECEPTIONIST_LEG_MS);
}

/** The ms from `now` until the next leg starts. */
export function msToNextReceptionistLeg(now: number): number {
  return (
    RECEPTIONIST_LEG_MS -
    (((now % RECEPTIONIST_LEG_MS) + RECEPTIONIST_LEG_MS) % RECEPTIONIST_LEG_MS)
  );
}

/** One floor spot in his area from the generator's next two numbers. */
function floorSpot(area: ReceptionistWorld['area'], next: () => number): Point {
  if (area.kind === 'box') {
    const { box } = area;
    return { x: box.x + next() * box.width, y: box.y + next() * box.height };
  }
  const angle = next() * Math.PI * 2;
  const r = Math.sqrt(next()) * area.r;
  return { x: area.at.x + Math.cos(angle) * r, y: area.at.y + Math.sin(angle) * r };
}

/**
 * Where leg `n` takes him: the same pad and leg give the same stop everywhere. Every RECEPTIONIST_HOME_EVERY-th leg is home;
 * otherwise a piece in his area (most legs, when there are any), else a reachable floor spot and its flourish, else
 * home.
 */
export function receptionistStop(world: ReceptionistWorld, n: number): ReceptionistStop {
  let cache = stopCache.get(world);
  if (!cache) stopCache.set(world, (cache = new Map<number, ReceptionistStop>()));
  const known = cache.get(n);
  if (known) return known;
  return remember(cache, n, stopOfLeg(world, n));
}

function stopOfLeg(world: ReceptionistWorld, n: number): ReceptionistStop {
  if (
    ((n % RECEPTIONIST_HOME_EVERY) + RECEPTIONIST_HOME_EVERY) % RECEPTIONIST_HOME_EVERY ===
    RECEPTIONIST_HOME_EVERY - 1
  )
    return world.home;
  const next = seeded(hashId(world.padId) ^ Math.imul(n | 0, 0x9e3779b1));
  if (world.stops.length > 0 && next() < PIECE_SHARE)
    return world.stops[Math.floor(next() * world.stops.length)]!;
  for (let i = 0; i < RECEPTIONIST_TRIES; i += 1) {
    const at = floorSpot(world.area, next);
    if (!reachable(world, at)) continue;
    const flourish = FLOURISHES[Math.floor(next() * FLOURISHES.length)]!;
    return { at, activity: 'flourish', face: 'down', flourish };
  }
  return world.home;
}

/** Where a walk along `route` from `from` has got to after `elapsedMs`, at RECEPTIONIST_SPEED. */
export function alongRoute(
  from: Point,
  route: readonly Point[],
  elapsedMs: number,
): { at: Point; walking: boolean; facing: AvatarFacing | null; travelled: number } {
  let left = Math.max(0, elapsedMs) * (RECEPTIONIST_SPEED / 1000);
  let at = from;
  let facing: AvatarFacing | null = null;
  let travelled = 0;
  for (const p of route) {
    const dx = p.x - at.x;
    const dy = p.y - at.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;
    facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    if (left < len) {
      const t = left / len;
      return {
        at: { x: at.x + dx * t, y: at.y + dy * t },
        walking: true,
        facing,
        travelled: travelled + left,
      };
    }
    left -= len;
    travelled += len;
    at = p;
  }
  return { at, walking: false, facing, travelled };
}

/** How long a walk along `route` from `from` takes, in ms. */
export function routeMs(from: Point, route: readonly Point[]): number {
  return (routeLength(from, route) / RECEPTIONIST_SPEED) * 1000;
}
