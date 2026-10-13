'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useLatest } from '@/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';
import { PLAN_TOUR_RELAUNCH_EVENT, type PlanTourTrack } from '@/lib/plan-tour';
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
  type PlanTourOffer,
  sheetRoot,
  visiblePlanWork,
} from './plan-tour-steps';
import { PlanTourArt } from './PlanTourArt';
import { TourStage } from './TourStage';
import { useTourEngine, type TourOutcome } from './useTourEngine';

// The settle delay before the offer, as the Diagram tour's.
export const OFFER_DELAY_MS = 800;

const PLAN_TOUR_COPY = {
  welcomeEyebrow: 'Plan tour',
  helpHref: '/help/canvas/plan-mode/',
  finish: 'Start Planning',
};

const SHEETS_TOUR_COPY = { ...PLAN_TOUR_COPY, helpHref: '/help/canvas/plan-mode/sheets/' };

// The tour subject's element: a board or a Sheet (docs/specs/026-plan/plan-tour.md "Domain language").
type PlanWork = { type: string; shape?: string; id: string };
const isBoard = (el: PlanWork) => el.type === 'shape' && el.shape === 'plan-board';
const isSheet = (el: PlanWork) => el.type === 'shape' && el.shape === 'plan-sheet';

// What the tour runs on, fixed when it is offered: the board and the Sheet on the open tab the person sees
// (visiblePlanWork: a maximised or tab-filling one, else one on screen, else the first).
type Subject = { boardId: string | null; sheetId: string | null };
const NO_SUBJECT: Subject = { boardId: null, sheetId: null };

// Orchestrates the Plan tour (docs/specs/026-plan/plan-tour.md, blueprint plan-tour.md). Mounted once in
// EditorView beside TourHost; renders nothing until a person who has not seen it is in Plan mode with an
// editor they can use and a board or Sheet on the open tab, no other tour is on screen, and the settle delay
// has passed, or the Settings row asks for a rerun (which waits for a board or Sheet the same way). It runs on
// that board or Sheet, the tour subject, and changes nothing on it: the steps only point, and the one thing
// they open is a card's panel. Its welcome card names the track, or asks which when the tab has both.
export function PlanTourHost() {
  const ctx = useEditorContext();
  const [subject, setSubject] = useState<Subject>(NO_SUBJECT);

  const apiRef = useLatest<PlanTourApi>({
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

  // The track (picked on a choice card, else the one on offer), what the welcome card offers, and whether the
  // board has a card for the card steps.
  const [tourTrack, setTourTrack] = useState<PlanTourTrack>('boards');
  const [offerKind, setOfferKind] = useState<PlanTourOffer>('boards');
  const [hasCards, setHasCards] = useState(true);
  const steps = useMemo(
    () => planTourSteps(tourTrack, { offer: offerKind, hasCards }),
    [tourTrack, offerKind, hasCards],
  );
  const engine = useTourEngine<PlanTourApi>({
    steps,
    apiRef,
    onStepView: (step) => track('UI', 'View', planTourStepTelemetryType(step.id)),
    onStart: () => track('UI', 'Started', 'PlanTour'),
    onFinish: (outcome) => endTour(outcome),
  });
  const { active } = engine;

  // One tour at a time: publish this one while it is on screen.
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'plan';
  useEffect(() => {
    setActiveTour('plan', active);
  }, [active]);

  const inPlan = ctx.editorMode.mode === 'plan';
  const seen = ctx.userPreferences?.planTourSeen === true;
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
  const hasPlanWork = boardIds.length > 0 || sheetIds.length > 0;
  // A stable key for the effect below: the ids themselves, not a fresh array each render.
  const workKey = `${boardIds.join(',')}|${sheetIds.join(',')}`;
  // Armed on entering Plan (or mounting in it), and by a relaunch; disarmed on leaving it or once offered.
  // Adjusted during render when the mode changes. A relaunch waits for a board or Sheet like a first offer.
  const [armed, setArmed] = useState(false);
  const [wasInPlan, setWasInPlan] = useState(false);
  if (inPlan !== wasInPlan) {
    setWasInPlan(inPlan);
    setArmed(inPlan);
  }
  // Answered already (here, or on another device): nothing is owed on this entry, so a later Settings
  // change while in Plan does not offer it behind the dialog (only the rerun does).
  if (armed && seen) setArmed(false);

  const endTour = (outcome: TourOutcome) => {
    apiRef.current.closeCard();
    // Onto the freshest preferences, not this render's: the whole blob is written.
    const next = rebaseUserPreferences(ctx.userPreferences, {
      ...ctx.userPreferences,
      planTourSeen: true,
    });
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    debugLog('[plan-tour] end', { outcome });
    if (outcome === 'declined') track('UI', 'Closed', 'PlanTourOffer');
    else track('UI', 'Ended', outcome === 'completed' ? 'PlanTourCompleted' : 'PlanTourSkipped');
  };
  const endTourRef = useLatest(endTour);
  const engineRef = useLatest(engine);

  // The offer: armed, in Plan, usable, not seen, a board or Sheet on the tab, and no other tour on screen.
  // Another tour ending re-renders this through useActiveTour, so the Plan tour follows it.
  useEffect(() => {
    if (!armed || active || seen) return;
    if (!inPlan || !canWork || otherTour || !hasPlanWork) return;
    const t = setTimeout(() => {
      setArmed(false);
      // Read as it is offered, from what is drawn: the board and Sheet the person sees.
      const boardId = visiblePlanWork(boardIds, boardRoot);
      const sheetId = visiblePlanWork(sheetIds, sheetRoot);
      const offer: PlanTourOffer = boardId && sheetId ? 'choice' : boardId ? 'boards' : 'sheets';
      debugLog('[plan-tour] offer', { offer });
      setSubject({ boardId, sheetId });
      setOfferKind(offer);
      setTourTrack(offer === 'sheets' ? 'sheets' : 'boards');
      setHasCards(firstCardOn(boardId) !== null);
      engineRef.current.start();
      track('UI', 'Opened', 'PlanTourOffer');
    }, OFFER_DELAY_MS);
    return () => clearTimeout(t);
    // workKey stands for boardIds and sheetIds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, active, seen, inPlan, canWork, otherTour, hasPlanWork, workKey, engineRef]);

  // Settings rerun (the Tours › "Plan Tour" row, turned on from off + closed): offers again in Plan once a
  // board or Sheet is open, and otherwise the next time the person enters it (the row has cleared
  // `planTourSeen`). It places nothing to show: an empty tab offers Start Planning, which makes one.
  const inPlanRef = useLatest(inPlan);
  useEffect(() => {
    const onRelaunch = () => {
      if (inPlanRef.current) setArmed(true);
    };
    window.addEventListener(PLAN_TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(PLAN_TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [inPlanRef]);

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
    if (!canWork || !inPlan || startedOnRef.current !== activeId || subjectGone) {
      engineRef.current.stop();
      endTourRef.current('skipped');
    }
  }, [active, canWork, inPlan, activeId, subjectGone, engineRef, endTourRef]);

  useEffect(() => () => setActiveTour('plan', false), []);

  // On a choice card, each choice starts its track: the steps switch as the engine leaves the welcome card.
  const pick = (picked: PlanTourTrack) => {
    debugLog('[plan-tour] track', { track: picked });
    track('UI', 'Selected', picked === 'sheets' ? 'PlanTourSheets' : 'PlanTourBoards');
    setTourTrack(picked);
    engine.next();
  };

  return (
    <TourStage
      engine={engine}
      ariaPrefix="Plan tour"
      copy={tourTrack === 'sheets' ? SHEETS_TOUR_COPY : PLAN_TOUR_COPY}
      welcomeArt={<PlanTourArt />}
      {...(offerKind === 'choice'
        ? {
            welcomeChoices: [
              { id: 'boards', label: 'Boards', onPick: () => pick('boards') },
              { id: 'sheets', label: 'Spreadsheets', onPick: () => pick('sheets') },
            ],
          }
        : {})}
    />
  );
}
