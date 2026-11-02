'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { DRAW_TOUR_RELAUNCH_EVENT } from '@/lib/draw-tour';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { drawTourSteps, drawTourStepTelemetryType, type DrawTourApi } from './draw-tour-steps';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { TourStage } from './TourStage';
import {
  useTourEngine,
  type TourOutcome,
} from '@liveworkspace/workbench/components/tour/useTourEngine';
import { TOUR_OFFER_RANK, useOfferTour } from '@liveworkspace/workbench/components/tour/tour-offer';
import { useStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';

const DRAW_TOUR_COPY = {
  helpHref: '/help/canvas/draw-mode/',
};

const NO_API: DrawTourApi = {};

// Orchestrates the Draw tour (docs/specs/023-draw-mode/draw-tour.md). Mounted once in EditorView beside TourHost.
// While the person is in Draw mode with an editor they can use, it offers the tour on the footer's Start Tour button
// ("Start Draw Tour"); a press there, or the Settings row, starts it. Mirrors WorkshopTourHost. It places nothing: its
// steps point at the dock.
export function DrawTourHost() {
  const ctx = useEditorContext();
  const apiRef = useLatest(NO_API);

  const isMobile = useIsMobileViewport();
  const steps = useMemo(() => drawTourSteps({ mobile: isMobile }), [isMobile]);
  const engine = useTourEngine<DrawTourApi>({
    steps,
    apiRef,
    onStepView: (step) => track('UI', 'View', drawTourStepTelemetryType(step.id)),
    onStart: () => track('UI', 'Started', 'DrawTour'),
    onFinish: (outcome) => endTour(outcome),
  });
  const { active } = engine;

  // One tour at a time: publish this one while it is on screen, and start nothing while another is.
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'draw';
  useEffect(() => {
    setActiveTour('draw', active);
  }, [active]);

  const inDraw = ctx.editorMode.mode === 'draw';
  // Held like the other tours while a start panel is on screen (docs/specs/007-editor/start-diagramming.md "The tours
  // wait"); Draw has none of its own, so this only matters mid-switch.
  const startPanelOpen = useStartPanelOpen();
  const canWork =
    ctx.hydrated &&
    !startPanelOpen &&
    !ctx.anyWelcomeOpen &&
    !ctx.isReadOnly &&
    !ctx.embedMode &&
    ctx.activeTab.locked !== true;

  const endTour = (outcome: TourOutcome) => {
    // Onto the freshest preferences, not this render's: the whole blob is written.
    const next = rebaseUserPreferences(ctx.userPreferences, {
      ...ctx.userPreferences,
      drawTourSeen: true,
    });
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    debugLog('[draw-tour] end', { outcome });
    track('UI', 'Ended', outcome === 'completed' ? 'DrawTourCompleted' : 'DrawTourSkipped');
  };
  const endTourRef = useLatest(endTour);
  const engineRef = useLatest(engine);

  const start = () => {
    if (active || otherTour) return;
    debugLog('[draw-tour] start');
    engineRef.current.start();
  };
  // The footer's Start Tour button: offered whenever the tour could run here, taken or not (it is how it is taken
  // again). The tour never starts on its own.
  useOfferTour(
    'draw',
    inDraw && canWork
      ? {
          name: 'Draw',
          rank: TOUR_OFFER_RANK.mode,
          start,
          onShown: () => track('UI', 'Opened', 'DrawTourOffer'),
        }
      : null,
  );

  // Settings rerun (Tours › "Draw Tour", turned on from off + closed): runs the tour in Draw; elsewhere the
  // footer button is there when the person is.
  const startRef = useLatest(start);
  const canStartRef = useLatest(inDraw && canWork);
  useEffect(() => {
    const onRelaunch = () => {
      if (canStartRef.current) startRef.current();
    };
    window.addEventListener(DRAW_TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(DRAW_TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [canStartRef, startRef]);

  // Ends as skipped when the tour can no longer run where it started: edit rights gone, Draw left,
  // or another tab opened.
  const activeId = ctx.activeTab.id;
  const startedOnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active) {
      startedOnRef.current = null;
      return;
    }
    startedOnRef.current ??= activeId;
    if (!canWork || !inDraw || startedOnRef.current !== activeId) {
      engineRef.current.stop();
      endTourRef.current('skipped');
    }
  }, [active, canWork, inDraw, activeId, engineRef, endTourRef]);

  useEffect(() => () => setActiveTour('draw', false), []);

  return <TourStage engine={engine} ariaPrefix="Draw tour" copy={DRAW_TOUR_COPY} />;
}
