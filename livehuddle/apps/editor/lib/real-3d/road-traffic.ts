// The Road's traffic (docs/specs/009-elements/road.md "Traffic"): which roads drive, their two lanes (keep right),
// and which cars are on a lane at a moment. Every car comes from the road's id and the time alone, so every viewer
// whose clock agrees sees the same cars with nothing sent. Pure: no three.js, no DOM, nothing allocated per call but
// what the caller hands in.
import { roadKerb, roadRun, type Element } from '@livehuddle/document';
import { CAR_LENGTH } from './models/road';

/** Each lane's timeline is cut into slots this long (s); a slot sets off at most one car. */
export const SLOT_S = 7;
/** The share of slots that set off a car. */
export const DEPART_CHANCE = 0.6;
/** The least time between two cars setting off on a lane (s), so they never bunch or meet. */
export const HEADWAY_S = 2.5;
/** A car's steady speed, canvas px a second (a character walks at 260). */
export const CAR_SPEED = 300;
/** How long a car takes to fade in at its lane's start and out at its end (s). */
export const FADE_S = 0.5;
/** The narrowest lane a car drives in, canvas px. */
export const MIN_LANE = 48;
/** Numbers per car in `laneCars`' output: distance along the lane, fade, tone. */
export const CAR_STRIDE = 3;

/** The cars' colours: a small palette that suits the art. */
export const TRAFFIC_TONES: readonly number[] = [
  0xd94848, // cherry red
  0x4f7fd9, // cornflower blue
  0x7fa77a, // sage green
  0xe8bf3f, // sunflower yellow
  0xf1efe9, // pearl white
  0x5d6673, // slate grey
  0x2f9c95, // teal
];

/** One lane's centre line, in its direction of travel. */
export type RoadLane = { x0: number; y0: number; x1: number; y1: number; length: number };

/** A road the cars drive: its id's seed and its lanes. */
export type TrafficRoad = {
  id: string;
  seed: number;
  box: { x: number; y: number; width: number; height: number };
  lanes: readonly RoadLane[];
};

type Box = { x: number; y: number; width: number; height: number };

/** The road's two lanes, keeping right; none on a road too narrow for a car. */
export function roadLanes(box: Box): RoadLane[] {
  const { x, y, width, height } = box;
  if (width <= 0 || height <= 0) return [];
  const { horizontal, length, across } = roadRun(width, height);
  const kerb = roadKerb(across);
  const lane = (across - 2 * kerb) / 2;
  if (lane < MIN_LANE) return [];
  if (horizontal) {
    const near = y + kerb + lane * 1.5;
    const far = y + kerb + lane / 2;
    return [
      { x0: x, y0: near, x1: x + width, y1: near, length },
      { x0: x + width, y0: far, x1: x, y1: far, length },
    ];
  }
  const left = x + kerb + lane / 2;
  const right = x + kerb + lane * 1.5;
  return [
    { x0: left, y0: y, x1: left, y1: y + height, length },
    { x0: right, y0: y + height, x1: right, y1: y, length },
  ];
}

/** FNV-1a of a road's id: its traffic's seed. */
export function roadSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The slot's own random numbers (mulberry32 steps from the road, lane and slot), read in order. */
let state = 0;
function start(seed: number, lane: number, slot: number): void {
  let h = seed ^ Math.imul(lane + 1, 0x9e3779b1) ^ Math.imul(slot, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  state = (h ^ (h >>> 15)) >>> 0;
}
function next(): number {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * The cars on lane `lane` of a road `length` long at time `t` (seconds since the epoch), written into `out` from
 * `at` (CAR_STRIDE numbers each: the car's middle's distance along the lane, its fade 0..1, its tone's index), at most
 * `room` of them. Returns how many it wrote.
 */
export function laneCars(
  seed: number,
  lane: number,
  length: number,
  t: number,
  out: Float32Array,
  at: number,
  room: number,
): number {
  const travel = (length - CAR_LENGTH) / CAR_SPEED;
  if (travel <= 0 || room <= 0) return 0;
  let n = 0;
  const last = Math.floor(t / SLOT_S);
  for (let k = Math.floor((t - travel) / SLOT_S); k <= last && n < room; k++) {
    start(seed, lane, k);
    if (next() >= DEPART_CHANCE) continue;
    const off = k * SLOT_S + next() * (SLOT_S - HEADWAY_S);
    const tone = Math.floor(next() * TRAFFIC_TONES.length);
    const age = t - off;
    if (age < 0 || age >= travel) continue;
    const o = at + n * CAR_STRIDE;
    out[o] = CAR_LENGTH / 2 + age * CAR_SPEED;
    out[o + 1] = Math.max(0, Math.min(1, age / FADE_S, (travel - age) / FADE_S));
    out[o + 2] = tone;
    n += 1;
  }
  return n;
}

/** Whether a point lies in a room or a corridor's box: indoors, where no car drives. */
function indoors(rooms: readonly Box[], px: number, py: number): boolean {
  return rooms.some((r) => px > r.x && px < r.x + r.width && py > r.y && py < r.y + r.height);
}

/** The roads the cars drive on: every Road out of doors with room for a car in its lanes. */
export function trafficRoads(elements: readonly Element[]): TrafficRoad[] {
  const rooms: Box[] = [];
  const roads: Box[] = [];
  const ids: string[] = [];
  for (const el of elements) {
    if (el.type !== 'shape') continue;
    if (el.shape === 'room' || el.shape === 'corridor') rooms.push(el);
    else if (el.shape === 'road') {
      roads.push(el);
      ids.push(el.id);
    }
  }
  const out: TrafficRoad[] = [];
  roads.forEach((r, i) => {
    if (indoors(rooms, r.x + r.width / 2, r.y + r.height / 2)) return;
    const lanes = roadLanes(r);
    if (lanes.length === 0) return;
    const id = ids[i]!;
    out.push({
      id,
      seed: roadSeed(id),
      box: { x: r.x, y: r.y, width: r.width, height: r.height },
      lanes,
    });
  });
  return out;
}

/** A key that changes only when a driving road does (its id or box), for rebuilding the list. */
export function trafficKey(elements: readonly Element[]): string {
  let key = '';
  for (const el of elements)
    if (
      el.type === 'shape' &&
      (el.shape === 'road' || el.shape === 'room' || el.shape === 'corridor')
    )
      key += `${el.shape}:${el.id}:${el.x},${el.y},${el.width},${el.height};`;
  return key;
}
