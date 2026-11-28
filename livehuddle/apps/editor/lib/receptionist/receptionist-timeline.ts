// Where the Receptionist is at a moment (docs/specs/008-canvas/receptionist.md): his day (receptionist-day.ts), unless a detour has him.
// A detour is a walk to somewhere and a wait there: a greeting by his pad when somebody arrives on it, or coming over
// to talk to you (on your screen only). When a detour ends he picks his day up from where he stands. Pure: the caller
// holds the detour and passes `now`.

import { reactionDuration, type AvatarReactionKind } from '@livehuddle/avatar/reactions';
import type { AvatarFacing } from '@livehuddle/avatar/walk';
import { findWalkPath } from '@livehuddle/avatar/pathing';
import { segmentsIntersect } from '@livehuddle/avatar/collision';
import { officeFootprint, type DrinkKind } from '@livehuddle/avatar/office-geometry';
import type { SeatFacing } from '@livehuddle/avatar/facing';
import {
  RECEPTIONIST_GREET_MS,
  RECEPTIONIST_LEG_MS,
  alongRoute,
  msToNextReceptionistLeg,
  receptionistLegAt,
  receptionistRoute,
  receptionistStop,
  routeMs,
  type Point,
  type ReceptionistActivity,
  type ReceptionistWorld,
} from './receptionist-day';

/** How far beside a person he stands to talk, and beside the pad to greet. */
const BESIDE_PERSON = 44;
const BESIDE_PAD = 28;
/** How far behind a reception desk's top edge he stands to answer its bell: clear of its Welcome bubble. */
export const BEHIND_DESK = 40;
/** A flourish or a pat comes round again this often while he stands at its stop. */
const ENCORE_MS = 5_000;
/** The canvas px of walking per walk frame, four frames a cycle, as everyone walks (avatar-mode.md "Walk animation"). */
const STRIDE_PX = 14;

export type ReceptionistDetour = {
  // Greeting an arrival by his pad, talking to you, or answering a reception bell at its desk.
  kind: 'greet' | 'talk' | 'bell';
  startAt: number;
  from: Point;
  route: Point[];
  // Which way he faces once there.
  face: AvatarFacing;
  // When it ends, or null until it is released (a conversation, until it closes).
  until: number | null;
};

export type ReceptionistPose = {
  at: Point;
  facing: AvatarFacing;
  walking: boolean;
  stepFrame: number;
  holding: DrinkKind | null;
  reaction: { kind: AvatarReactionKind; elapsedMs: number } | null;
  activity: ReceptionistActivity | 'greet' | 'talk';
  // Standing at a stop with an encore (a flourish, a pat): the ms until it plays again.
  encoreInMs?: number;
};

/** A reaction played once on arriving and again every ENCORE_MS, or null between plays. */
function encore(kind: AvatarReactionKind, sinceArrivedMs: number): ReceptionistPose['reaction'] {
  const elapsedMs = sinceArrivedMs % ENCORE_MS;
  return elapsedMs < reactionDuration(kind) ? { kind, elapsedMs } : null;
}

/**
 * His day at `now`. `resume` is where a detour left him and when: within that leg he sets off from there at that time
 * rather than from the last leg's stop.
 */
export function receptionistDayPose(
  world: ReceptionistWorld,
  now: number,
  resume: { at: Point; from: number } | null = null,
): ReceptionistPose {
  const n = receptionistLegAt(now);
  const stop = receptionistStop(world, n);
  const resumes = resume !== null && receptionistLegAt(resume.from) === n && resume.from <= now;
  const from = resumes ? resume.at : receptionistStop(world, n - 1).at;
  const setOff = resumes ? resume.from : n * RECEPTIONIST_LEG_MS;
  // A stop he cannot reach from here (a detour left him walled off from it) has him as near as he can get, never
  // walking through the walls.
  const route =
    receptionistRoute(world.grid, from, stop.at) ?? findWalkPath(world.grid, from, stop.at);
  const walk = alongRoute(from, route, now - setOff);
  const stepFrame = Math.floor(walk.travelled / STRIDE_PX) % 4;
  if (walk.walking)
    return {
      at: walk.at,
      facing: walk.facing ?? stop.face,
      walking: true,
      stepFrame,
      holding: null,
      reaction: null,
      activity: stop.activity,
    };
  const since = now - setOff - routeMs(from, route);
  const reaction =
    stop.activity === 'flourish' && stop.flourish
      ? encore(stop.flourish, since)
      : stop.activity === 'pat'
        ? encore('wave', since)
        : null;
  const pose: ReceptionistPose = {
    at: walk.at,
    facing: stop.face,
    walking: false,
    stepFrame: 0,
    holding: stop.drink ?? null,
    reaction,
    activity: stop.activity,
  };
  if (stop.activity === 'flourish' || stop.activity === 'pat')
    pose.encoreInMs = ENCORE_MS - (since % ENCORE_MS);
  return pose;
}

/** Where he is at `now`: the detour while it lasts, else his day, picked up from where the detour left him. */
export function receptionistPose(
  world: ReceptionistWorld,
  now: number,
  detour: ReceptionistDetour | null,
): ReceptionistPose {
  if (!detour) return receptionistDayPose(world, now);
  const walk = alongRoute(detour.from, detour.route, now - detour.startAt);
  if (detour.until === null || now < detour.until) {
    if (walk.walking)
      return {
        at: walk.at,
        facing: walk.facing ?? detour.face,
        walking: true,
        stepFrame: Math.floor(walk.travelled / STRIDE_PX) % 4,
        holding: null,
        reaction: null,
        activity: detourActivity(detour.kind),
      };
    const since = now - detour.startAt - routeMs(detour.from, detour.route);
    const wave = reactionDuration('wave');
    return {
      at: walk.at,
      facing: detour.face,
      walking: false,
      stepFrame: 0,
      holding: null,
      reaction: detour.kind !== 'talk' && since < wave ? { kind: 'wave', elapsedMs: since } : null,
      activity: detourActivity(detour.kind),
    };
  }
  return receptionistDayPose(world, now, { at: walk.at, from: detour.until });
}

/** What he is doing on a detour: at a rung bell he is at the desk, greeting whoever rang. */
function detourActivity(kind: ReceptionistDetour['kind']): 'greet' | 'talk' {
  return kind === 'talk' ? 'talk' : 'greet';
}

/** A detour from wherever he is at `now` to `to`, facing `face` there. */
function detourTo(
  world: ReceptionistWorld,
  now: number,
  current: ReceptionistDetour | null,
  kind: ReceptionistDetour['kind'],
  to: Point,
  face: AvatarFacing,
  holdMs: number | null,
): ReceptionistDetour {
  const from = receptionistPose(world, now, current).at;
  // A spot he cannot reach (beside you in a piece's footprint, behind a wall) has him walk as near as he can get.
  const route = receptionistRoute(world.grid, from, to) ?? findWalkPath(world.grid, from, to);
  const until = holdMs === null ? null : now + routeMs(from, route) + holdMs;
  return { kind, startAt: now, from, route, face, until };
}

/**
 * Somebody appeared on his pad: he walks to beside it, on the side nearest him, turns to face it, waves, and stays
 * RECEPTIONIST_GREET_MS.
 */
export function greetDetour(
  world: ReceptionistWorld,
  now: number,
  current: ReceptionistDetour | null,
): ReceptionistDetour {
  const at = receptionistPose(world, now, current).at;
  const { pad } = world;
  const left = at.x < pad.x + pad.width / 2;
  // Beside the pad on that side, off any water (receptionistWorld's `beside`).
  const to = left ? world.beside.left : world.beside.right;
  return detourTo(world, now, current, 'greet', to, left ? 'right' : 'left', RECEPTIONIST_GREET_MS);
}

/** Coming over to talk to you (your screen only): to beside your feet, on the side nearest him, facing you. */
export function talkDetour(
  world: ReceptionistWorld,
  now: number,
  current: ReceptionistDetour | null,
  you: Point,
): ReceptionistDetour {
  const at = receptionistPose(world, now, current).at;
  const left = at.x < you.x;
  const to = { x: you.x + (left ? -BESIDE_PERSON : BESIDE_PERSON), y: you.y };
  return detourTo(world, now, current, 'talk', to, left ? 'right' : 'left', null);
}

type DeskBox = { x: number; y: number; width: number; height: number };

/**
 * The desk he stands behind, at its bell spot (BEHIND_DESK over its top edge) or nearer, over its width; else null.
 * Its back is usually against a wall, so in the 3D view he is drawn towards the camera there (ReceptionistLayer).
 */
export function deskBehind<D extends DeskBox>(desks: readonly D[], at: Point): D | null {
  return (
    desks.find(
      (d) => at.x >= d.x && at.x <= d.x + d.width && at.y < d.y && d.y - at.y <= BEHIND_DESK + 1,
    ) ?? null
  );
}

/** How far in from the back edge's end each spot behind a desk is tried, as a share of that edge: a quarter in from
 * its left first, clear of the Welcome bubble over its middle, then the other quarter, then its middle. */
const BEHIND_ALONG = [0.25, 0.75, 0.5];
/** How far behind the desk's back edge he stands, tried in turn: his bell spot, then nearer for a wall close behind. */
const BEHIND_DEPTHS = [BEHIND_DESK, BEHIND_DESK / 2 + 4];

/**
 * The spots behind a desk he may stand at, best first, facing its front: its back is the side away from the way its
 * counter faces (docs/specs/009-elements/furniture-facing.md; a desk facing `n`, the default, has its back at the top).
 * Past its back edge first, then, for a desk whose back is against a wall or a piece, the floor inside its box between
 * that edge and the counter's footprint (officeFootprint, the 3D model's while that view draws), halfway across it.
 */
export function behindDeskSpots(desk: DeskBox & { chairFacing?: SeatFacing }): {
  at: Point;
  face: AvatarFacing;
  // The counter's back, level with the spot: no wall may stand between them.
  back: Point;
}[] {
  const facing = desk.chairFacing ?? 'n';
  const c = officeFootprint({ ...desk, shape: 'reception-desk', chairFacing: facing });
  // How far in from the back edge the counter starts.
  const gap = !c
    ? 0
    : facing === 'n'
      ? c.y - desk.y
      : facing === 's'
        ? desk.y + desk.height - (c.y + c.height)
        : facing === 'e'
          ? desk.x + desk.width - (c.x + c.width)
          : c.x - desk.x;
  const depths = gap > 0 ? [...BEHIND_DEPTHS, -gap / 2] : BEHIND_DEPTHS;
  const out: { at: Point; face: AvatarFacing; back: Point }[] = [];
  for (const depth of depths)
    for (const t of BEHIND_ALONG) {
      const x = desk.x + desk.width * t;
      const y = desk.y + desk.height * t;
      if (facing === 'n')
        out.push({ at: { x, y: desk.y - depth }, face: 'down', back: { x, y: desk.y + gap } });
      else if (facing === 's')
        out.push({
          at: { x, y: desk.y + desk.height + depth },
          face: 'up',
          back: { x, y: desk.y + desk.height - gap },
        });
      else if (facing === 'e')
        out.push({
          at: { x: desk.x + desk.width + depth, y },
          face: 'left',
          back: { x: desk.x + desk.width - gap, y },
        });
      else out.push({ at: { x: desk.x - depth, y }, face: 'right', back: { x: desk.x + gap, y } });
    }
  return out;
}

/**
 * Somebody rang a reception bell: he walks round behind that desk, faces whoever rang, waves, and stays
 * RECEPTIONIST_GREET_MS (until his bubble closes, when it was you). Behind the desk on free floor he can get to (a
 * wall or a piece close behind it passes a spot over for the next, behindDeskSpots), else beside its front. Null
 * when he cannot reach it at all (walled off). A spot counts only when the route ends there, so he never stands in a
 * piece's footprint or a wall.
 */
export function bellDetour(
  world: ReceptionistWorld,
  now: number,
  current: ReceptionistDetour | null,
  desk: DeskBox & { chairFacing?: SeatFacing },
  // Finds a route to a spot (tests stand in for the walls).
  routeTo?: (to: Point) => Point[] | null,
): ReceptionistDetour | null {
  const from = receptionistPose(world, now, current).at;
  const route = routeTo ?? ((to: Point) => receptionistRoute(world.grid, from, to));
  // A wall between a spot and the counter's back has that spot on the wall's far side, outside the room: passed over
  // even when a route round through a door gets there.
  const walls = (world.grid?.fences ?? []).filter((f) => !f.solid);
  const walledOff = (at: Point, back: Point) =>
    walls.some((w) => segmentsIntersect({ a: at, b: back }, w));
  const spots: { at: Point; face: AvatarFacing }[] = [
    ...behindDeskSpots(desk).filter((spot) => !walledOff(spot.at, spot.back)),
    {
      at: { x: desk.x + desk.width + BESIDE_PAD, y: desk.y + desk.height + BESIDE_PAD },
      face: 'left',
    },
    { at: { x: desk.x - BESIDE_PAD, y: desk.y + desk.height + BESIDE_PAD }, face: 'right' },
  ];
  for (const spot of spots)
    if (route(spot.at))
      return detourTo(world, now, current, 'bell', spot.at, spot.face, RECEPTIONIST_GREET_MS);
  return null;
}

/** Walking you to a spot (a room's door) while you talk: he waits there, facing it, until the talk is over. */
export function leadDetour(
  world: ReceptionistWorld,
  now: number,
  current: ReceptionistDetour | null,
  to: Point,
): ReceptionistDetour {
  return detourTo(world, now, current, 'talk', to, 'up', null);
}

/** The talk is over: the detour ends now, and he walks back into his day from where he stands. */
export function releaseDetour(
  detour: ReceptionistDetour | null,
  now: number,
): ReceptionistDetour | null {
  if (!detour || (detour.until !== null && detour.until <= now)) return detour;
  return { ...detour, until: now };
}

/**
 * The ms until his pose next changes while he stands still, or 0 while he walks or plays a reaction (draw every
 * frame). Standing, the next change is the next leg, the detour's end, or the next encore.
 */
export function receptionistNextChangeMs(
  pose: ReceptionistPose,
  now: number,
  detour: ReceptionistDetour | null,
): number {
  if (pose.walking || pose.reaction) return 0;
  let wait = msToNextReceptionistLeg(now);
  if (detour?.until != null && detour.until > now) wait = Math.min(wait, detour.until - now);
  if (pose.encoreInMs !== undefined) wait = Math.min(wait, pose.encoreInMs);
  return Math.max(1, wait);
}
