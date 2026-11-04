// The stage (docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage"; blueprint "Behaviour and state
// (part 2)"): who speaks from a stage to the whole tab, which rooms become its audience, and whose bubbles the
// audience does not receive. Pure: the canvas hands it the tab's visible stages, the call works out the staging once
// per scene.
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
 * Who speaks from a stage now. Null when nobody does, so a tab whose stages stand empty hears exactly as part 1.
 * `levels` holds each walker's level as the room stamped it on their presence; `selfLevel` is your session's.
 */
export function staging(
  self: Point | null,
  selfLevel: AccessLevel,
  walkers: ReadonlyMap<string, Point>,
  levels: ReadonlyMap<string, AccessLevel>,
  stages: readonly CallStage[],
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
    }
  }
  for (const [id, at] of walkers) {
    const s = stageAt(at, stages);
    if (!s || !mayTakeStage(levels.get(id), s.speakers)) continue;
    speakers.add(id);
    if (!s.cameras) unseen.add(id);
    live.push(s);
  }
  if (!mine && speakers.size === 0) return null;
  const audience = new Set<string>();
  for (const s of live) if (s.zone !== null) audience.add(s.zone);
  return { self: mine, speakers, audience, unseen };
}
