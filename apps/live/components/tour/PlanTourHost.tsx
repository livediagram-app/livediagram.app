'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { useLatest } from '@/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';
import { PLAN_TOUR_RELAUNCH_EVENT } from '@/lib/plan-tour';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { hasTourPending } from '@/lib/tour-pending';
import { resolvePanelLayout } from '@/lib/user-preferences';
import { waitForSelector } from './tour-dom';
import { PLAN_TOUR_STEPS, planTourStepTelemetryType, type PlanTourApi } from './plan-tour-steps';
import { PlanTourArt } from './PlanTourArt';
import { TourStage } from './TourStage';
import { useTourEngine, type TourOutcome } from './useTourEngine';

// The settle delay before the offer, as the welcome tour's.
export const OFFER_DELAY_MS = 800;

const PLAN_TOUR_COPY = {
  welcomeEyebrow: 'Plan tour',
  helpHref: '/help/canvas/plan-mode/',
  finish: 'Start planning',
};

// Orchestrates the Plan tour (docs/specs/026-plan/plan-tour.md, blueprint plan-tour.md). Mounted once in
// EditorView beside TourHost; renders nothing until a person who has not seen it is in Plan mode with an
// editor they can use, the welcome tour is neither on screen nor still owed, and the settle delay has
// passed, or the Settings row asks for a rerun. The steps run on the shared engine and draw through the
// shared stage; the tour content they show is made and taken away by usePlanTourContent.
export function PlanTourHost() {
  const ctx = useEditorContext();
  const isMobile = useIsMobileViewport();
  const toolbar = resolvePanelLayout(ctx.userPreferences ?? {}, { mobile: isMobile }) === 'toolbar';
  const content = ctx.planTour;

  const apiRef = useLatest<PlanTourApi>({
    toolbar,
    placeBoard: async () => {
      const id = content.ensureBoard(ctx.getViewportCenter());
      if (id) await waitForSelector(`[data-element-id="${id}"]`, 2000);
    },
    addCards: async () => {
      await content.ensureCards();
    },
    moveCard: () => content.moveFirstCard(),
    openCard: () => {
      const id = content.firstCardId();
      if (id && ctx.plan.openItemId !== id) ctx.plan.showItem(id);
    },
    closeCard: () => {
      if (ctx.plan.openItemId !== null) ctx.plan.closeItem();
    },
    removeContent: () => content.removeAll(),
    boardId: content.boardId,
    firstCardId: content.firstCardId,
    status: content.status,
  });

  const engine = useTourEngine<PlanTourApi>({
    steps: PLAN_TOUR_STEPS,
    apiRef,
    onStepView: (step) => track('UI', 'View', planTourStepTelemetryType(step.id)),
    onStart: () => track('UI', 'Started', 'PlanTour'),
    onFinish: (outcome) => endTour(outcome),
  });
  const { active } = engine;

  // One tour at a time: publish this one while it is on screen.
  const otherTour = useActiveTour() === 'welcome';
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

  // Armed on entering Plan (or mounting in it), and by a relaunch; disarmed on leaving it or once offered.
  // Adjusted during render when the mode changes.
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
    content.removeAll();
    const next = { ...ctx.userPreferences, planTourSeen: true };
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    debugLog('[plan-tour] end', { outcome });
    if (outcome === 'declined') track('UI', 'Closed', 'PlanTourOffer');
    else track('UI', 'Ended', outcome === 'completed' ? 'PlanTourCompleted' : 'PlanTourSkipped');
  };
  const endTourRef = useLatest(endTour);
  const engineRef = useLatest(engine);

  // The offer: armed, in Plan, usable, not seen, and no other tour on screen or owed. The welcome tour
  // ending re-renders this through useActiveTour, so the Plan tour follows it.
  useEffect(() => {
    if (!armed || active || seen) return;
    if (!inPlan || !canWork || otherTour || hasTourPending()) return;
    const t = setTimeout(() => {
      setArmed(false);
      debugLog('[plan-tour] offer');
      engineRef.current.start();
      track('UI', 'Opened', 'PlanTourOffer');
    }, OFFER_DELAY_MS);
    return () => clearTimeout(t);
  }, [armed, active, seen, inPlan, canWork, otherTour, engineRef]);

  // Settings rerun (the "Show Plan Tour" row, turned on from off + closed): offers again in Plan, and
  // otherwise the next time the person enters it (the row has cleared `planTourSeen`).
  const inPlanRef = useLatest(inPlan);
  useEffect(() => {
    const onRelaunch = () => {
      if (inPlanRef.current) setArmed(true);
    };
    window.addEventListener(PLAN_TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(PLAN_TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [inPlanRef]);

  // Ends as skipped when the tour can no longer run where it started: edit rights gone, Plan left, or
  // another tab opened.
  const activeId = ctx.activeTab.id;
  const startedOnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active) {
      startedOnRef.current = null;
      return;
    }
    startedOnRef.current ??= activeId;
    if (!canWork || !inPlan || startedOnRef.current !== activeId) {
      engineRef.current.stop();
      endTourRef.current('skipped');
    }
  }, [active, canWork, inPlan, activeId, engineRef, endTourRef]);

  // Leaving the editor mid-tour still takes the tour content away.
  const removeRef = useLatest(content.removeAll);
  useEffect(() => () => removeRef.current(), [removeRef]);
  useEffect(() => () => setActiveTour('plan', false), []);

  return (
    <TourStage
      engine={engine}
      ariaPrefix="Plan tour"
      copy={PLAN_TOUR_COPY}
      welcomeArt={<PlanTourArt />}
    />
  );
}
