// The stage (docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage"; blueprint "Behaviour and state
// (part 2)"): who speaks from a stage to the whole tab, which rooms become its audience, and whose bubbles the
// audience does not receive. Pure: the canvas hands it the tab's visible stages, the call works out the staging once
// per scene. Raise hand (the same spec's "Raise hand"; blueprint "Behaviour and state (part 3)") adds the hands let
// speak, each a speaker as if on the stage while whoever let them still may.
import { mayTakeStage, stageAt, type CallStage, type StageSpeakers } from '@livehuddle/document';
import type { AccessLevel } from '@livehuddle/api-schema';
import type { Point } from './hearing';

export { callStages, mayTakeStage, stageAt, type CallStage } from '@livehuddle/document';

/**
 * Who is on a live stage, worked out once per scene: whether you speak from one, which walkers do, and the speakers
 * whose stage hides their bubbles.
 */
export type CallStaging = {
  readonly self: boolean;
  readonly speakers: ReadonlySet<string>;
  readonly unseen: ReadonlySet<string>;
};

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
  let mine = false;
  if (self) {
    const s = stageAt(self, stages);
    if (s && mayTakeStage(selfLevel, s.speakers)) {
      mine = true;
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
  }
  if (!mine && speakers.size === 0) return null;
  return { self: mine, speakers, unseen };
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
