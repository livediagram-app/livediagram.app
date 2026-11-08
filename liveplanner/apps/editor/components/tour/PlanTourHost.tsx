'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useAssignRef, useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import {
  markPlanTracksSeen,
  PLAN_TOUR_RELAUNCH_EVENT,
  planTrackSeen,
  type BoardSheetTrack,
} from '@/lib/plan-tour';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { boardRoot, visiblePlanWork } from './plan-tour-steps';
import { PracticeSheetDialog } from './PracticeSheetDialog';
import { PracticeSprint, type SprintEnd } from './PracticeSprint';
import { TOUR_OFFER_RANK, useOfferTour } from '@liveworkspace/workbench/components/tour/tour-offer';

// The track as the footer button names it: "Start Boards Tour".
const BUTTON_NAME: Record<BoardSheetTrack, string> = { boards: 'Boards', sheets: 'Sheets' };

// The tour subject's element: a board or a Sheet (docs/specs/026-plan/plan-tour.md "Domain language").
type PlanWork = { type: string; shape?: string; id: string };
const isBoard = (el: PlanWork) => el.type === 'shape' && el.shape === 'plan-board';
const isSheet = (el: PlanWork) => el.type === 'shape' && el.shape === 'plan-sheet';

// A run: the track, the board it runs on (Boards), and the tab it started on. `n` remounts a run started afresh.
type Run = { track: BoardSheetTrack; boardId: string | null; tabId: string; n: number };

// Orchestrates the Plan tour's Boards and Sheets tracks (docs/specs/026-plan/plan-tour.md). Mounted once in
// EditorView. While the person can work on a tab with a board or Sheet on it, it offers the tour on the footer's Start
// Tour button ("Start Boards Tour", "Start Sheets Tour": a track not yet taken first, Boards between equals); a press
// there, or the Settings row, starts it: the Practice Sprint on the board the person sees, or Five Small Wins on a
// practice sheet of its own. It never starts or prompts on its own.
export function PlanTourHost() {
  const ctx = useEditorContext();
  const [run, setRun] = useState<Run | null>(null);
  const active = run !== null;
  const runs = useRef(0);

  // One tour at a time: publish this one while it is on screen, and start nothing while another is.
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'plan';
  useEffect(() => {
    setActiveTour('plan', active);
  }, [active]);
  useEffect(() => () => setActiveTour('plan', false), []);

  const canWork =
    ctx.hydrated &&
    !ctx.anyWelcomeOpen &&
    !ctx.isReadOnly &&
    !ctx.embedMode &&
    ctx.activeTab.locked !== true;

  // The plan work on the open tab: the tour is offered only once there is a board or Sheet to show, so an empty
  // tab is started first (Start Planning), never talked over, and a Dashboard has its own track.
  const elements = ctx.activeTab.elements as readonly PlanWork[];
  const boardIds = elements.filter(isBoard).map((el) => el.id);
  const sheetIds = elements.filter(isSheet).map((el) => el.id);
  const tracks: BoardSheetTrack[] = [
    ...(boardIds.length > 0 ? (['boards'] as const) : []),
    ...(sheetIds.length > 0 ? (['sheets'] as const) : []),
  ];
  const offerTrack =
    tracks.find((t) => !planTrackSeen(ctx.userPreferences, t)) ?? tracks[0] ?? null;
  const seen = tracks.every((t) => planTrackSeen(ctx.userPreferences, t));

  // Records `answered` as taken, onto the freshest preferences, not this render's: the whole blob is written.
  const markTaken = (answered: BoardSheetTrack[]) => {
    const next = rebaseUserPreferences(
      ctx.userPreferences,
      markPlanTracksSeen(ctx.userPreferences, answered),
    );
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
  };
  const markTakenRef = useLatest(markTaken);

  // However a run ends, its track is taken (it was already, from its start; the write is idempotent).
  const runRef = useRef<Run | null>(null);
  useAssignRef(runRef, run);
  const end = useCallback(
    (outcome: 'completed' | 'skipped') => {
      const now = runRef.current;
      if (!now) return;
      // Once: a finish's own end and the effect seeing the tab change after it must not both count.
      runRef.current = null;
      markTakenRef.current([now.track]);
      debugLog('[plan-tour] end', { outcome, track: now.track });
      track('UI', 'Ended', outcome === 'completed' ? 'PlanTourCompleted' : 'PlanTourSkipped');
      setRun(null);
    },
    [markTakenRef],
  );
  const onSprintEnd = useCallback((e: SprintEnd) => end(e.outcome), [end]);

  // A press: the board the person sees, read from what is drawn, then the track on offer.
  const start = () => {
    if (active || otherTour || !offerTrack) return;
    const boardId = visiblePlanWork(boardIds, boardRoot);
    debugLog('[plan-tour] start', { track: offerTrack });
    runs.current += 1;
    setRun({ track: offerTrack, boardId, tabId: ctx.activeTab.id, n: runs.current });
    track('UI', 'Started', 'PlanTour');
    // Taken as it starts, so a reload mid-tour does not put it back on the button.
    if (!planTrackSeen(ctx.userPreferences, offerTrack)) markTaken([offerTrack]);
  };
  const canStart = canWork && offerTrack !== null;
  useOfferTour(
    'plan',
    canStart && offerTrack
      ? {
          name: BUTTON_NAME[offerTrack],
          rank: TOUR_OFFER_RANK.mode,
          start,
          onShown: () => track('UI', 'Opened', 'PlanTourOffer'),
          seen,
        }
      : null,
  );

  // Settings rerun (the Tours › "Boards Tour" or "Sheets Tour" row, turned on from off + closed): runs the tour once a
  // board or Sheet is open; elsewhere the footer button is there when one is.
  const startRef = useLatest(start);
  const canStartRef = useLatest(canStart);
  useEffect(() => {
    const onRelaunch = () => {
      if (canStartRef.current) startRef.current();
    };
    window.addEventListener(PLAN_TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(PLAN_TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [canStartRef, startRef]);

  // Ends as skipped when the tour can no longer run where it started: edit rights gone, another tab opened (a kept
  // practice sheet opens its new tab once the run has ended), or the board deleted.
  const boardGone = run?.boardId != null && !elements.some((el) => el.id === run.boardId);
  const leftTab = run !== null && run.tabId !== ctx.activeTab.id;
  useEffect(() => {
    if (run && (!canWork || leftTab || boardGone)) end('skipped');
  }, [run, canWork, leftTab, boardGone, end]);

  if (!run || !canWork || leftTab) return null;
  if (run.track === 'sheets')
    return <PracticeSheetDialog key={run.n} onEnd={(e) => end(e.outcome)} />;
  return run.boardId && !boardGone ? (
    <PracticeSprint key={run.n} boardId={run.boardId} onEnd={onSprintEnd} />
  ) : null;
}
