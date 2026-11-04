// The stage (docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage"; blueprint "Behaviour and state
// (part 2)"): who speaks from a stage to the whole tab, which rooms become its audience, and whose bubbles the
// audience does not receive. Pure: the canvas hands it the tab's visible stages, the call works out the staging once
// per scene. Raise hand (the same spec's "Raise hand"; blueprint "Behaviour and state (part 3)") adds the hands let
// speak, each a speaker as if on the stage while whoever let them still may.
import {
  DEFAULT_STAGE_SPEAKERS,
  isStageSpeakers,
  stageTop,
  type StageSpeakers,
} from '@livehuddle/document';
import type { AccessLevel } from '@livehuddle/api-schema';
import type { Point } from './hearing';
import { zoneAt, type CallZone } from './zones';

/** A stage's top as the call reads it, the room it stands in (null: the open), and its two settings. */
export type CallStage = {
  readonly id: string;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly area: number;
  readonly zone: string | null;
  readonly speakers: StageSpeakers;
  readonly cameras: boolean;
};

/**
 * Who is on a live stage, worked out once per scene: whether you speak from one, which walkers do, the rooms that
 * are a live stage's audience (they hear each other by distance), and the speakers whose stage hides their bubbles.
 */
export type CallStaging = {
  readonly self: boolean;
  readonly speakers: ReadonlySet<string>;
  readonly audience: ReadonlySet<string>;
  readonly unseen: ReadonlySet<string>;
};

type StageSource = {
  readonly id: string;
  readonly type: string;
  readonly shape?: string;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly stageSpeakers?: unknown;
  readonly stageCameras?: unknown;
};

/** Every stage among `elements` (the caller passes only what is on visible layers), with the room each stands in. */
export function callStages(
  elements: readonly StageSource[],
  zones: readonly CallZone[],
): CallStage[] {
  const stages: CallStage[] = [];
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'stage') continue;
    const { x, y, width, height } = el;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number'
    ) {
      continue;
    }
    const top = stageTop({ x, y, width, height });
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
export function stageAt(at: Point, stages: readonly CallStage[]): CallStage | null {
  let best: CallStage | null = null;
  for (const s of stages) {
    if (at.x <= s.x0 || at.x >= s.x1 || at.y <= s.y0 || at.y >= s.y1) continue;
    if (!best || s.area < best.area || (s.area === best.area && s.id < best.id)) best = s;
  }
  return best;
}

/** Whether someone at `level` may speak from a stage (the spec's Who Can Speak). No level is a Viewer's. */
export function mayTakeStage(level: AccessLevel | undefined, speakers: StageSpeakers): boolean {
  if (level === 'edit') return true;
  return level === 'participate' && speakers === 'take-part';
}

/**
 * Whether presence `id` may let a raised hand speak: an Editor (the level the room stamped), or a walker on the tab
 * standing on a stage that lets them speak.
 */
export function mayLetSpeak(
  id: string,
  walkers: ReadonlyMap<string, Point>,
  levels: ReadonlyMap<string, AccessLevel>,
  stages: readonly CallStage[],
): boolean {
  const level = levels.get(id);
  if (level === 'edit') return true;
  const at = walkers.get(id);
  const s = at ? stageAt(at, stages) : null;
  return !!s && mayTakeStage(level, s.speakers);
}

/** Whether you yourself may let a raised hand speak: an Editor, or standing on a stage that lets you speak. */
export function mayLetSpeakSelf(
  self: Point | null,
  selfLevel: AccessLevel,
  stages: readonly CallStage[],
): boolean {
  if (selfLevel === 'edit') return true;
  const s = self ? stageAt(self, stages) : null;
  return !!s && mayTakeStage(selfLevel, s.speakers);
}

/** A raised hand as the call reads it: who let it speak, or null. */
type HandSource = { readonly letSpeak: string | null };

/**
 * The walkers let speak now: each whose hand names someone who still may let speak, or whom this browser let speak
 * (`mine`, since a browser cannot recognise its own presence id) while it still may (`selfMay`).
 */
export function letSpeakers(
  hands: ReadonlyMap<string, HandSource>,
  walkers: ReadonlyMap<string, Point>,
  levels: ReadonlyMap<string, AccessLevel>,
  stages: readonly CallStage[],
  mine: ReadonlySet<string>,
  selfMay: boolean,
): ReadonlySet<string> {
  const out = new Set<string>();
  for (const [id, hand] of hands) {
    if (!walkers.has(id)) continue;
    if (selfMay && mine.has(id)) out.add(id);
    else if (hand.letSpeak !== null && mayLetSpeak(hand.letSpeak, walkers, levels, stages))
      out.add(id);
  }
  return out;
}

/** The hands let speak, for `staging`: the walkers', and whether yours is. */
export type StageHands = { readonly let: ReadonlySet<string>; readonly self: boolean };

/**
 * Who speaks from a stage now. Null when nobody does, so a tab whose stages stand empty hears exactly as part 1.
 * `levels` holds each walker's level as the room stamped it on their presence; `selfLevel` is your session's. A hand
 * let speak (`hands`) is a speaker as if on the stage, heard and not seen, adding no audience room.
 */
export function staging(
  self: Point | null,
  selfLevel: AccessLevel,
  walkers: ReadonlyMap<string, Point>,
  levels: ReadonlyMap<string, AccessLevel>,
  stages: readonly CallStage[],
  hands?: StageHands,
): CallStaging | null {
  if (stages.length === 0) return null;
  const speakers = new Set<string>();
  const unseen = new Set<string>();
  const live: CallStage[] = [];
  let mine = false;
  if (self) {
    const s = stageAt(self, stages);
    if (s && mayTakeStage(selfLevel, s.speakers)) {
      mine = true;
      live.push(s);
    } else if (hands?.self) {
      mine = true;
    }
  }
  for (const [id, at] of walkers) {
    const s = stageAt(at, stages);
    if (!s || !mayTakeStage(levels.get(id), s.speakers)) {
      if (!hands?.let.has(id)) continue;
      // Let speak from the floor: heard by the tab, its bubbles kept from the audience.
      speakers.add(id);
      unseen.add(id);
      continue;
    }
    speakers.add(id);
    if (!s.cameras) unseen.add(id);
    live.push(s);
  }
  if (!mine && speakers.size === 0) return null;
  const audience = new Set<string>();
  for (const s of live) if (s.zone !== null) audience.add(s.zone);
  return { self: mine, speakers, audience, unseen };
}

/** The Who Can Speak of a stage you stand on that does not let you speak (the stage line), or null. */
export function barringStage(
  self: Point | null,
  selfLevel: AccessLevel,
  stages: readonly CallStage[],
): StageSpeakers | null {
  const s = self ? stageAt(self, stages) : null;
  return s && !mayTakeStage(selfLevel, s.speakers) ? s.speakers : null;
}
