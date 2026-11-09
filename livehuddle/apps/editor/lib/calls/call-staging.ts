// A proximity call's stage and hands for one scene (docs/specs/012-collaboration/meeting-rooms-and-stage.md "The
// stage", "Raise hand"): who speaks from a stage, whether your own hand is let speak, the stage you stand on that
// bars you, and how many hands a speaker sees. Pure over the scene and what the room stamped; the call applies it.
import type { AccessLevel } from '@livehuddle/api-schema';
import type { CallScene } from './call-config';
import { callHands, callKeys, callLetByMe, callLevels } from './calls-store';
import {
  barringStage,
  letSpeakers,
  letterMay,
  mayLetSpeakSelf,
  staging,
  type Letter,
  type StageHands,
} from './stage';
import type { StageSpeakers } from '@livehuddle/document';
import type { CallZoning } from './zones';

export type StagedScene = {
  // Everyone's room, with the staging when anyone speaks from a stage.
  zoning: CallZoning;
  // The hands let speak, and whether yours is.
  hands: StageHands;
  // Who Can Speak of a stage you stand on that bars you, unless your hand is let speak.
  barredBy: StageSpeakers | null;
  // Raised hands on the tab not yet let speak.
  handsUp: number;
};

/**
 * Stage the scene: `zoned` is everyone's room, `level` your own, `letter` whoever let your hand speak (null for
 * nobody), followed as a person across their reconnect. Reads the hands, the let-speaks you sent and the levels the room stamped from the calls store.
 */
export function stageScene(
  scene: CallScene,
  zoned: CallZoning,
  level: AccessLevel,
  letter: Letter | null,
): StagedScene {
  const levels = callLevels();
  const keys = callKeys();
  const stages = scene.stages ?? [];
  const selfMay = mayLetSpeakSelf(scene.self, level, stages);
  const hands: StageHands = {
    let: letSpeakers(callHands(), scene.walkers, levels, stages, callLetByMe(), selfMay, keys),
    self: letter !== null && letterMay(letter, scene.walkers, levels, stages, keys),
  };
  const stage = staging(scene.self, level, scene.walkers, levels, stages, hands);
  const barredBy = hands.self ? null : barringStage(scene.self, level, stages);
  let handsUp = 0;
  for (const id of callHands().keys()) if (scene.walkers.has(id) && !hands.let.has(id)) handsUp++;
  return { zoning: stage ? { ...zoned, stage } : zoned, hands, barredBy, handsUp };
}
