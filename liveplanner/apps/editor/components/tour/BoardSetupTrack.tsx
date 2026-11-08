'use client';

// A board's Board Setup track (docs/specs/026-plan/plan-tour.md "Boards: Board Setup"): rename a column, set a WIP
// limit, add a header widget, on the real board through its own controls. The board's setup as it started is kept, so
// the finish can put it all back in one undoable change, or keep it.

import { useMemo, useState } from 'react';
import type { PlanBoardSetup } from '@liveplanner/items';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { helpArticleHref } from '@/lib/help-articles';
import { track } from '@/lib/telemetry';
import { setupChanged, setupMissions, type SetupCtx } from './board-tracks';
import { LearnMore } from './LearnMore';
import { MissionStrip } from './MissionStrip';
import { useMissions } from './missions';
import { planTourStepTelemetryType } from './plan-tour-steps';
import { TrackFinish } from './TrackFinish';

export function BoardSetupTrack({
  boardId,
  onEnd,
}: {
  boardId: string;
  onEnd: (outcome: 'completed' | 'skipped') => void;
}) {
  const ctx = useEditorContext();
  const element = ctx.activeTab.elements.find((e) => e.id === boardId);
  const now = element && 'planBoard' in element ? (element.planBoard as PlanBoardSetup) : null;
  // The board as the track started: what the checks compare with, and what Put It Back restores.
  const [start] = useState(now);
  const missions = useMemo(() => setupMissions(boardId), [boardId]);
  const live: SetupCtx | null = start && now ? { start, now } : null;
  const run = useMissions({
    missions,
    ctx: live as SetupCtx,
    active: live !== null,
    onView: (m) => track('UI', 'View', planTourStepTelemetryType(m.id)),
  });
  if (!start || !now) return null;

  const finish = (keep: boolean) => {
    if (!keep && setupChanged(start, now)) ctx.plan.context.updateBoard(boardId, start);
    if (!keep) track('UI', 'Selected', 'PlanTourPutBack');
    onEnd('completed');
  };
  return (
    <MissionStrip
      name="Board Setup"
      run={run}
      onEnd={() => onEnd('skipped')}
      finish={
        <TrackFinish
          heading="Set up your way."
          line="Keep these changes, or put the board back as it was."
          keepLabel="Keep Changes"
          onKeep={() => finish(true)}
          onPutBack={() => finish(false)}
          learnMore={<LearnMore href={helpArticleHref('planBoards')} />}
        />
      }
    />
  );
}
