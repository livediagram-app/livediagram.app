'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { newItemId } from '@liveplanner/items';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import {
  markPlanTracksSeen,
  PLAN_TOUR_RELAUNCH_EVENT,
  planTrackSeen,
  type BoardSheetTrack,
  writeLeftover,
} from '@/lib/plan-tour';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import {
  boardRoot,
  firstCardOn,
  needsReveal,
  planTourSteps,
  planTourStepTelemetryType,
  type PlanTourApi,
  sheetRoot,
  visiblePlanWork,
} from './plan-tour-steps';
import { TourStage } from './TourStage';
import {
  useTourEngine,
  type TourOutcome,
} from '@liveworkspace/workbench/components/tour/useTourEngine';
import { TOUR_OFFER_RANK, useOfferTour } from '@liveworkspace/workbench/components/tour/tour-offer';

// The Boards track's example card's title.
const TOUR_CARD_TITLE = 'Your First Card';

// Each track's cards name it, never the mode (docs/specs/026-plan/plan-tour.md "The steps").
const BOARDS_TOUR_COPY = { helpHref: '/help/plan/planning-basics/' };
const SHEETS_TOUR_COPY = { helpHref: '/help/plan/sheets/' };
const TRACK_NAME: Record<BoardSheetTrack, string> = {
  boards: 'Boards tour',
  sheets: 'Sheets tour',
};
// The track as the footer button names it: "Start Boards Tour".
const BUTTON_NAME: Record<BoardSheetTrack, string> = { boards: 'Boards', sheets: 'Sheets' };

// The tour subject's element: a board or a Sheet (docs/specs/026-plan/plan-tour.md "Domain language").
type PlanWork = { type: string; shape?: string; id: string };
const isBoard = (el: PlanWork) => el.type === 'shape' && el.shape === 'plan-board';
const isSheet = (el: PlanWork) => el.type === 'shape' && el.shape === 'plan-sheet';

// What the tour runs on, fixed when it starts: the board and the Sheet on the open tab the person sees
// (visiblePlanWork: a maximised or tab-filling one, else one on screen, else the first).
type Subject = { boardId: string | null; sheetId: string | null };
const NO_SUBJECT: Subject = { boardId: null, sheetId: null };

// Orchestrates the Plan tour (docs/specs/026-plan/plan-tour.md, blueprint plan-tour.md). Mounted once in
// EditorView beside TourHost. While the person can work on a tab with a board or Sheet on it, it offers the tour on
// the footer's Start Tour button ("Start Boards Tour", "Start Sheets Tour": a track not yet taken first, Boards
// between equals); a press there, or the Settings row, starts it on the board or Sheet the person sees, the tour
// subject. It changes nothing on it: the steps only point, and the one thing they open is a card's panel. It never
// starts or prompts on its own.
export function PlanTourHost() {
  const ctx = useEditorContext();
  const [subject, setSubject] = useState<Subject>(NO_SUBJECT);

  // The Boards track's example card, while it is on the board (writeQuiet: no undo step, so Undo never brings it
  // back), recorded as a leftover so a reload mid-tour still takes it away (usePlanTourLeftovers).
  const tourCardRef = useRef<string | null>(null);
  const boardSetup = () => {
    const el = ctx.activeTab.elements.find((e) => e.id === subject.boardId);
    return el && 'planBoard' in el ? el.planBoard : undefined;
  };
  const removeTourCard = () => {
    const id = tourCardRef.current;
    if (!id) return;
    tourCardRef.current = null;
    if (ctx.plan.openItemId === id) ctx.plan.closeItem();
    void ctx.plan.writeQuiet({ kind: 'delete', id }, { silent: true });
    writeLeftover(null);
  };
  const removeTourCardRef = useLatest(removeTourCard);
  // Taken away if the tour is torn down under it (the editor closing).
  useEffect(() => () => removeTourCardRef.current(), [removeTourCardRef]);

  const apiRef = useLatest<PlanTourApi>({
    addTourCard: async () => {
      if (tourCardRef.current) return tourCardRef.current;
      const setup = boardSetup();
      const column = setup?.columns[0];
      if (!setup || !column || !ctx.projectId) {
        debugLog('[plan-tour] card not added', {
          setup: !!setup,
          column: !!column,
          projectId: !!ctx.projectId,
        });
        return null;
      }
      const id = newItemId();
      tourCardRef.current = id;
      writeLeftover({ projectId: ctx.projectId, elementId: '', itemIds: [id] });
      const ok = await ctx.plan.writeQuiet(
        {
          kind: 'create',
          creates: [
            {
              id,
              type: setup.addTypes?.[0] ?? 'task',
              fields: { title: TOUR_CARD_TITLE },
              place: { status: column.status },
            },
          ],
        },
        { silent: true },
      );
      if (!ok) {
        debugLog('[plan-tour] card refused');
        tourCardRef.current = null;
        writeLeftover(null);
        return null;
      }
      return id;
    },
    moveTourCard: () => {
      const id = tourCardRef.current;
      const next = boardSetup()?.columns[1];
      if (!id || !next) return;
      void ctx.plan.writeQuiet(
        { kind: 'move', id, move: { status: next.status } },
        { silent: true },
      );
    },
    openTourCard: () => {
      const id = tourCardRef.current ?? firstCardOn(subject.boardId);
      if (id && ctx.plan.openItemId !== id) ctx.plan.showItem(id);
    },
    tourCardId: () => tourCardRef.current,
    boardId: () => subject.boardId,
    sheetElementId: () => subject.sheetId,
    firstCardId: () => firstCardOn(subject.boardId),
    openCard: () => {
      const id = firstCardOn(subject.boardId);
      if (id && ctx.plan.openItemId !== id) ctx.plan.showItem(id);
    },
    closeCard: () => {
      if (ctx.plan.openItemId !== null) ctx.plan.closeItem();
    },
    // A subject on the canvas but out of the window is panned into view (zoomed out only if it is too big to fit,
    // scrollIntoView); one maximised or filling its tab is already on screen. Nothing is placed or moved.
    reveal: (which) => {
      const id = which === 'sheets' ? subject.sheetId : subject.boardId;
      if (!id) return;
      if (!needsReveal(which === 'sheets' ? sheetRoot(id) : boardRoot(id))) return;
      const el = ctx.activeTab.elements.find((e) => e.id === id);
      if (!el || !('width' in el) || !('height' in el)) return;
      ctx.scrollIntoView(el.x, el.y, el.width, el.height);
    },
  });

  // The track the tour runs, fixed when it starts.
  const [tourTrack, setTourTrack] = useState<BoardSheetTrack>('boards');
  const steps = useMemo(() => planTourSteps(tourTrack), [tourTrack]);
  const engine = useTourEngine<PlanTourApi>({
    steps,
    apiRef,
    onStepView: (step) => track('UI', 'View', planTourStepTelemetryType(step.id)),
    onStart: () => track('UI', 'Started', 'PlanTour'),
    onFinish: (outcome) => endTour(outcome),
  });
  const { active } = engine;

  // One tour at a time: publish this one while it is on screen, and start nothing while another is.
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'plan';
  useEffect(() => {
    setActiveTour('plan', active);
  }, [active]);

  const canWork =
    ctx.hydrated &&
    !ctx.anyWelcomeOpen &&
    !ctx.isReadOnly &&
    !ctx.embedMode &&
    ctx.activeTab.locked !== true;

  // The plan work on the open tab: the tour is offered only once there is a board or Sheet to show, so an empty
  // tab is started first (Start Planning), never talked over, and a Dashboard waits for a Board or Sheet tab.
  const elements = ctx.activeTab.elements as readonly PlanWork[];
  const boardIds = elements.filter(isBoard).map((el) => el.id);
  const sheetIds = elements.filter(isSheet).map((el) => el.id);
  // The track the button offers: of the ones with work on the tab, one not yet taken first, Boards between equals.
  const tracks: BoardSheetTrack[] = [
    ...(boardIds.length > 0 ? (['boards'] as const) : []),
    ...(sheetIds.length > 0 ? (['sheets'] as const) : []),
  ];
  const offerTrack =
    tracks.find((t) => !planTrackSeen(ctx.userPreferences, t)) ?? tracks[0] ?? null;

  const endTour = (outcome: TourOutcome) => {
    apiRef.current.closeCard();
    // The example card goes however the tour ended: the board is left as the person had it.
    removeTourCard();
    // Onto the freshest preferences, not this render's: the whole blob is written. The track shown is taken.
    const answered: BoardSheetTrack[] = [tourTrack];
    const next = rebaseUserPreferences(
      ctx.userPreferences,
      markPlanTracksSeen(ctx.userPreferences, answered),
    );
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    debugLog('[plan-tour] end', { outcome, answered });
    track('UI', 'Ended', outcome === 'completed' ? 'PlanTourCompleted' : 'PlanTourSkipped');
  };
  const endTourRef = useLatest(endTour);
  const engineRef = useLatest(engine);

  // A press: the board and Sheet the person sees, read from what is drawn, then the track on offer.
  const start = () => {
    if (active || otherTour || !offerTrack) return;
    const boardId = visiblePlanWork(boardIds, boardRoot);
    const sheetId = visiblePlanWork(sheetIds, sheetRoot);
    debugLog('[plan-tour] start', { track: offerTrack });
    setSubject({ boardId, sheetId });
    setTourTrack(offerTrack);
    engineRef.current.start();
  };
  const canStart = canWork && offerTrack !== null;
  // The footer's Start Tour button: offered whenever the tour could run here, taken or not (it is how it is taken
  // again).
  useOfferTour(
    'plan',
    canStart && offerTrack
      ? {
          name: BUTTON_NAME[offerTrack],
          rank: TOUR_OFFER_RANK.mode,
          start,
          onShown: () => track('UI', 'Opened', 'PlanTourOffer'),
        }
      : null,
  );

  // Settings rerun (the Tours › "Boards Tour" or "Sheets Tour" row, turned on from off + closed): runs the tour once a
  // board or Sheet is open; elsewhere the footer button is there when one is. It places nothing to show: an empty tab
  // offers Start Planning, which makes one.
  const startRef = useLatest(start);
  const canStartRef = useLatest(canStart);
  useEffect(() => {
    const onRelaunch = () => {
      if (canStartRef.current) startRef.current();
    };
    window.addEventListener(PLAN_TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(PLAN_TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [canStartRef, startRef]);

  // Ends as skipped when the tour can no longer run where it started: edit rights gone, Plan left, another
  // tab opened, or the tour subject deleted.
  const activeId = ctx.activeTab.id;
  const subjectId = tourTrack === 'sheets' ? subject.sheetId : subject.boardId;
  const subjectGone = subjectId !== null && !elements.some((el) => el.id === subjectId);
  const startedOnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active) {
      startedOnRef.current = null;
      return;
    }
    startedOnRef.current ??= activeId;
    if (!canWork || startedOnRef.current !== activeId || subjectGone) {
      engineRef.current.stop();
      endTourRef.current('skipped');
    }
  }, [active, canWork, activeId, subjectGone, engineRef, endTourRef]);

  useEffect(() => () => setActiveTour('plan', false), []);

  return (
    <TourStage
      engine={engine}
      ariaPrefix={TRACK_NAME[tourTrack]}
      copy={tourTrack === 'sheets' ? SHEETS_TOUR_COPY : BOARDS_TOUR_COPY}
    />
  );
}
