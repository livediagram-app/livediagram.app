'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useAssignRef, useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import {
  BOARD_TRACKS,
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
import { CardTypesTrack } from './CardTypesTrack';
import { BoardSetupTrack } from './BoardSetupTrack';
import { TourStart } from './TourStart';
import { TOUR_OFFER_RANK, useOfferTour } from '@liveworkspace/workbench/components/tour/tour-offer';

// What the footer button offers: a board's tracks ("Start Boards Tour") or the Sheets one.
type Kind = 'boards' | 'sheets';
const BUTTON_NAME: Record<Kind, string> = { boards: 'Boards', sheets: 'Sheets' };
const KIND_TRACKS: Record<Kind, readonly BoardSheetTrack[]> = {
  boards: BOARD_TRACKS,
  sheets: ['sheets'],
};

// A board's tracks on its start panel (plan-tour.md "Starting a tour").
const BOARD_TRACK_COPY: Record<(typeof BOARD_TRACKS)[number], { title: string; line: string }> = {
  boards: {
    title: 'Using a Board',
    line: 'Add, move, open, date and ship cards, on practice cards that never reach your plan.',
  },
  'card-types': {
    title: 'Card Types',
    line: 'Make a kind of card, give it a field, and use it on this board.',
  },
  'board-setup': {
    title: 'Board Setup',
    line: 'Rename a column, set a WIP limit and add a header widget.',
  },
};

// The Started event of each track: the Practice Sprint and Five Small Wins keep the tour's own.
const PICK_EVENT: Record<BoardSheetTrack, string> = {
  boards: 'PlanTour',
  sheets: 'PlanTour',
  'card-types': 'PlanTourCardTypes',
  'board-setup': 'PlanTourBoardSetup',
};

// The tour subject's element: a board or a Sheet (docs/specs/026-plan/plan-tour.md "Domain language").
type PlanWork = { type: string; shape?: string; id: string };
const isBoard = (el: PlanWork) => el.type === 'shape' && el.shape === 'plan-board';
const isSheet = (el: PlanWork) => el.type === 'shape' && el.shape === 'plan-sheet';

// A run: what was offered, the track picked on the start panel (null while it shows), the board it runs on (Boards),
// and the tab it started on. `n` remounts a run started afresh.
type Run = {
  kind: Kind;
  track: BoardSheetTrack | null;
  boardId: string | null;
  tabId: string;
  n: number;
};

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
  const kinds: Kind[] = [
    ...(boardIds.length > 0 ? (['boards'] as const) : []),
    ...(sheetIds.length > 0 ? (['sheets'] as const) : []),
  ];
  // A kind is taken once every track of it is (a board's three).
  const kindSeen = (k: Kind) => KIND_TRACKS[k].every((t) => planTrackSeen(ctx.userPreferences, t));
  const offerKind = kinds.find((k) => !kindSeen(k)) ?? kinds[0] ?? null;
  const seen = kinds.every(kindSeen);

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
      if (now.track) markTakenRef.current([now.track]);
      debugLog('[plan-tour] end', { outcome, track: now.track });
      track('UI', 'Ended', outcome === 'completed' ? 'PlanTourCompleted' : 'PlanTourSkipped');
      setRun(null);
    },
    [markTakenRef],
  );
  const onSprintEnd = useCallback((e: SprintEnd) => end(e.outcome), [end]);

  // A press: the start panel, for the board the person sees (read from what is drawn). Nothing runs until a track is
  // picked there.
  const start = () => {
    if (active || otherTour || !offerKind) return;
    const boardId = visiblePlanWork(boardIds, boardRoot);
    debugLog('[plan-tour] offer', { kind: offerKind });
    runs.current += 1;
    setRun({ kind: offerKind, track: null, boardId, tabId: ctx.activeTab.id, n: runs.current });
    track('UI', 'Opened', 'PlanTourStart');
  };
  // A pick on the start panel: the track runs, and is taken as it starts, so a reload mid-tour does not put it back.
  const pick = (picked: BoardSheetTrack) => {
    const now = runRef.current;
    if (!now) return;
    debugLog('[plan-tour] start', { track: picked });
    setRun({ ...now, track: picked });
    track('UI', 'Started', PICK_EVENT[picked]);
    if (!planTrackSeen(ctx.userPreferences, picked)) markTaken([picked]);
  };
  // Not Now: the panel goes, and the tour stays on offer.
  const close = () => {
    runRef.current = null;
    setRun(null);
  };
  const canStart = canWork && offerKind !== null;
  useOfferTour(
    'plan',
    canStart && offerKind
      ? {
          name: BUTTON_NAME[offerKind],
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
    if (!run || (canWork && !leftTab && !boardGone)) return;
    // The start panel only closes: nothing ran, so nothing is recorded.
    if (run.track === null) {
      runRef.current = null;
      // The panel closes with its ref, as end() does for a run: the tab or rights changed outside it.
      // oxlint-disable-next-line react/set-state-in-effect
      setRun(null);
    } else end('skipped');
  }, [run, canWork, leftTab, boardGone, end]);

  if (!run || !canWork || leftTab) return null;
  if (run.track === null) {
    const taken = (t: BoardSheetTrack) => planTrackSeen(ctx.userPreferences, t);
    return run.kind === 'sheets' ? (
      <TourStart
        key={run.n}
        name="Sheets Tour"
        heading="Five Small Wins"
        line="A practice budget opens in a sheet of its own: type, add up, fill down, format and chart it. Nothing is saved unless you keep it."
        tracks={[{ id: 'sheets', title: 'Five Small Wins', line: '', missions: 5, taken: taken('sheets') }]}
        startLabel="Open the Practice Sheet"
        onPick={pick}
        onClose={close}
      />
    ) : (
      <TourStart
        key={run.n}
        name="Boards Tour"
        heading="What would you like to learn?"
        line="Each track is a few quick missions on this board. Come back for the others any time."
        tracks={BOARD_TRACKS.map((t) => ({ id: t, ...BOARD_TRACK_COPY[t], taken: taken(t) }))}
        onPick={pick}
        onClose={close}
      />
    );
  }
  if (run.track === 'card-types' || run.track === 'board-setup') {
    const Track = run.track === 'card-types' ? CardTypesTrack : BoardSetupTrack;
    return run.boardId && !boardGone ? (
      <Track key={run.n} boardId={run.boardId} onEnd={end} />
    ) : null;
  }
  if (run.track === 'sheets')
    return <PracticeSheetDialog key={run.n} onEnd={(e) => end(e.outcome)} />;
  return run.boardId && !boardGone ? (
    <PracticeSprint key={run.n} boardId={run.boardId} onEnd={onSprintEnd} />
  ) : null;
}
