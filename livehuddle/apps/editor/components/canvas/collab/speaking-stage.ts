'use client';

// The stage you speak from (docs/specs/012-collaboration/meeting-rooms-and-stage.md "You are told you are on it"): its
// id while you stand on the top of a stage that lets you speak, else null. The stage's On Stage badge reads it to add
// Everyone Can Hear You on your screen alone. A context, so only the stages re-render when it changes, never on a step.
import { createContext, useContext } from 'react';
import type { AccessLevel } from '@livehuddle/api-schema';
import { mayTakeStage, stageAt, type CallStage } from '@/lib/calls/stage';

export const SpeakingStageContext = createContext<string | null>(null);

export function useSpeakingStage(): string | null {
  return useContext(SpeakingStageContext);
}

/** The id of the stage `self` speaks from: on its top, and its Who Can Speak lets `level` speak. */
export function speakingStageId(
  self: { x: number; y: number } | null,
  stages: readonly CallStage[],
  level: AccessLevel,
): string | null {
  if (!self || stages.length === 0) return null;
  const stage = stageAt(self, stages);
  return stage && mayTakeStage(level, stage.speakers) ? stage.id : null;
}
