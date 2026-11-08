// Where the Receptionist is at a moment (docs/specs/008-canvas/receptionist.md): his day (receptionist-day.ts), unless a detour has him.
// A detour is a walk to somewhere and a wait there: a greeting by his pad when somebody arrives on it, or coming over
// to talk to you (on your screen only). When a detour ends he picks his day up from where he stands. Pure: the caller
// holds the detour and passes `now`.

import { reactionDuration, type AvatarReactionKind } from '@liveworkspace/avatar/reactions';
import type { DrinkKind } from '@liveworkspace/avatar/office-geometry';
import type { AvatarFacing } from '@liveworkspace/avatar/walk';
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
const BEHIND_DESK = 40;
/** A flourish or a pat comes round again this often while he stands at its stop. */
const ENCORE_MS = 5_000;
/** The canvas px of walking per stride frame, as a person's walk. */
const STRIDE_PX = 20;

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
  const route = receptionistRoute(world.grid, from, stop.at) ?? [stop.at];
  const walk = alongRoute(from, route, now - setOff);
  const stepFrame = Math.floor(walk.travelled / STRIDE_PX) % 2;
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
    at: stop.at,
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
        stepFrame: Math.floor(walk.travelled / STRIDE_PX) % 2,
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
  const route = receptionistRoute(world.grid, from, to) ?? [to];
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
  const mid = pad.y + pad.height / 2;
  const left = at.x < pad.x + pad.width / 2;
  const to = left
    ? { x: pad.x - BESIDE_PAD, y: mid }
    : { x: pad.x + pad.width + BESIDE_PAD, y: mid };
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

/**
 * Somebody rang a reception bell: he walks round behind that desk, faces whoever rang, waves, and stays
 * RECEPTIONIST_GREET_MS (until his bubble closes, when it was you). Behind the desk when he can get there, else
 * beside its front. Null when he cannot reach it at all (walled off).
 */
export function bellDetour(
  world: ReceptionistWorld,
  now: number,
  current: ReceptionistDetour | null,
  desk: { x: number; y: number; width: number; height: number },
  // Finds a route to a spot (tests stand in for the walls).
  routeTo?: (to: Point) => Point[] | null,
): ReceptionistDetour | null {
  const from = receptionistPose(world, now, current).at;
  const route = routeTo ?? ((to: Point) => receptionistRoute(world.grid, from, to));
  // A quarter in from its left, clear of the Welcome bubble over its middle.
  const behind = desk.x + desk.width / 4;
  const spots: { at: Point; face: AvatarFacing }[] = [
    { at: { x: behind, y: desk.y - BEHIND_DESK }, face: 'down' },
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
