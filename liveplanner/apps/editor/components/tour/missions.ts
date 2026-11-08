'use client';

// The hands-on tours' missions (docs/specs/026-plan/plan-tour.md "The mission strip"): one thing to do at a time,
// checked from what the person really did, never from a Next button. A mission is done the moment its check passes
// (by any route: a drag, a menu, a key); the strip then shows its lesson until the person presses Next, so it is never
// gone before it is read. Hints climb one press at a time. The tracks own their missions and what a check reads; this is the runner they share.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

// One rung of a mission's hints: words, and optionally the place it means, ringed (a CSS selector, read when shown).
export type MissionHint = { text: string; ring?: () => string | null };

export type Mission<Ctx> = {
  // Telemetry and test id ('move-card' → PlanTourStepMoveCard); fixed, never content.
  id: string;
  // The instruction, short and imperative: "Move one on".
  title: string;
  // One line on what to do and why it matters.
  why: string;
  // What was just learned, shown once it is done.
  lesson: string;
  hints: readonly MissionHint[];
  // The control the mission names (Types, Add card), ringed for as long as it is the mission, as livehuddle's
  // Receptionist rings what he talks about: selectors, the most specific first (the first on screen is ringed), so
  // the ring follows the person in (Types, then Add Card Type, then the editor's name field). A hint's ring wins.
  points?: readonly string[];
  // Done on the page itself (a drag on the board): while a window covers it, the strip says to close it first.
  onPage?: boolean;
  // Whether the person has done it, read from the track's live state.
  done: (ctx: Ctx) => boolean;
};

export type MissionPhase = 'doing' | 'lesson' | 'finish';

export type MissionRun<Ctx> = {
  mission: Mission<Ctx> | null;
  index: number;
  count: number;
  phase: MissionPhase;
  // How many hints are showing (0: none yet).
  hintLevel: number;
  // The hint rung on show, if any.
  hint: MissionHint | null;
  // Whether another hint is left to show.
  moreHints: boolean;
  showHint: () => void;
  // From a lesson, on to the next mission (or the finish after the last).
  next: () => void;
};

// Runs `missions` in order against `ctx` while `active`: each is checked whenever ctx changes; once done its lesson
// shows until `next`, then the next starts (one already done shows its lesson straight away), and after the last the
// phase is 'finish'. `onView` fires once as each mission starts (a restart shows them again).
export function useMissions<Ctx>({
  missions,
  ctx,
  active,
  onView,
}: {
  missions: readonly Mission<Ctx>[];
  ctx: Ctx;
  active: boolean;
  onView?: (mission: Mission<Ctx>) => void;
}): MissionRun<Ctx> {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<MissionPhase>(missions.length === 0 ? 'finish' : 'doing');
  const [hintLevel, setHintLevel] = useState(0);
  const onViewRef = useLatest(onView);

  // A fresh run (turned on, or new missions) starts at the first mission: reset as it renders, not after.
  const [runOf, setRunOf] = useState({ missions, active });
  if (runOf.missions !== missions || runOf.active !== active) {
    setRunOf({ missions, active });
    if (active) {
      setIndex(0);
      setHintLevel(0);
      setPhase(missions.length === 0 ? 'finish' : 'doing');
    }
  }

  const mission = active && phase !== 'finish' ? (missions[index] ?? null) : null;

  // The check: the current mission, whenever what it reads changes; done, its lesson shows.
  if (mission !== null && phase === 'doing' && mission.done(ctx)) setPhase('lesson');

  // Each mission's view, once as it starts.
  const viewed = useRef<Mission<Ctx> | null>(null);
  useEffect(() => {
    if (!active) {
      viewed.current = null;
      return;
    }
    if (phase !== 'doing' || !mission || viewed.current === mission) return;
    viewed.current = mission;
    onViewRef.current?.(mission);
  }, [active, phase, mission, onViewRef]);

  // The lesson, then (on Next) the next mission or the finish.
  const next = useCallback(() => {
    if (phase !== 'lesson') return;
    setHintLevel(0);
    if (index + 1 < missions.length) {
      setIndex(index + 1);
      setPhase('doing');
    } else setPhase('finish');
  }, [phase, index, missions.length]);

  const hints = mission?.hints ?? [];
  const showHint = useCallback(
    () => setHintLevel((level) => Math.min(level + 1, hints.length)),
    [hints.length],
  );
  return {
    mission,
    index,
    count: missions.length,
    phase: active ? phase : 'doing',
    hintLevel,
    hint: phase === 'doing' && hintLevel > 0 ? (hints[hintLevel - 1] ?? null) : null,
    moreHints: phase === 'doing' && hintLevel < hints.length,
    showHint,
    next,
  };
}
