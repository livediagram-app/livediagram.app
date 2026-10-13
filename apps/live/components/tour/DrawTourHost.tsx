'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useLatest } from '@/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';
import { DRAW_TOUR_RELAUNCH_EVENT } from '@/lib/draw-tour';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { drawTourSteps, drawTourStepTelemetryType, type DrawTourApi } from './draw-tour-steps';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { DrawTourArt } from './DrawTourArt';
import { TourStage } from './TourStage';
import { useTourEngine, type TourOutcome } from './useTourEngine';
import { useStartPanelOpen } from '@/components/start/start-panel-open';

// The settle delay before the offer, as the Diagram and Plan tours'.
export const OFFER_DELAY_MS = 800;

const DRAW_TOUR_COPY = {
  welcomeEyebrow: 'Draw tour',
  helpHref: '/help/canvas/draw-mode/',
  finish: 'Start drawing',
};

const NO_API: DrawTourApi = {};

// Orchestrates the Draw tour (docs/specs/023-draw-mode/draw-tour.md). Mounted once in
// EditorView beside TourHost; renders nothing until a person who has not seen it is in Draw mode with an
// editor they can use, no other tour is on screen and the settle delay has passed, or the Settings row asks
// for a rerun. Mirrors FacilitateTourHost. It places nothing: its steps point at the dock.
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

  // One tour at a time: publish this one while it is on screen, and wait while another is.
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'draw';
  useEffect(() => {
    setActiveTour('draw', active);
  }, [active]);

  const inDraw = ctx.editorMode.mode === 'draw';
  const seen = ctx.userPreferences?.drawTourSeen === true;
  // Held like the other tours while a start panel is on screen (docs/specs/007-editor/start-diagramming.md "The tours
  // wait"); Draw has none of its own, so this only matters mid-switch.
  const startPanelOpen = useStartPanelOpen();
  const canWork =
    ctx.hydrated &&
    !startPanelOpen &&
    // The synced preferences are in, so an answer given on another device holds here too.
    ctx.prefsSettled &&
    !ctx.anyWelcomeOpen &&
    !ctx.isReadOnly &&
    !ctx.embedMode &&
    ctx.activeTab.locked !== true;

  // Armed on entering Draw (or mounting in it), and by a relaunch; disarmed on leaving it or once
  // offered. Adjusted during render when the mode changes.
  const [armed, setArmed] = useState(false);
  const [wasIn, setWasIn] = useState(false);
  if (inDraw !== wasIn) {
    setWasIn(inDraw);
    setArmed(inDraw);
  }
  // Answered already (here, or on another device): nothing is owed on this entry.
  if (armed && seen) setArmed(false);

  const endTour = (outcome: TourOutcome) => {
    // Onto the freshest preferences, not this render's: the whole blob is written.
    const next = rebaseUserPreferences(ctx.userPreferences, {
      ...ctx.userPreferences,
      drawTourSeen: true,
    });
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    debugLog('[draw-tour] end', { outcome });
    if (outcome === 'declined') track('UI', 'Closed', 'DrawTourOffer');
    else track('UI', 'Ended', outcome === 'completed' ? 'DrawTourCompleted' : 'DrawTourSkipped');
  };
  const endTourRef = useLatest(endTour);
  const engineRef = useLatest(engine);

  // The offer: armed, in Draw, usable, not seen, and no other tour on screen. Another tour ending
  // re-renders this through useActiveTour, so this tour follows it.
  useEffect(() => {
    if (!armed || active || seen) return;
    if (!inDraw || !canWork || otherTour) return;
    const t = setTimeout(() => {
      setArmed(false);
      debugLog('[draw-tour] offer');
      engineRef.current.start();
      track('UI', 'Opened', 'DrawTourOffer');
    }, OFFER_DELAY_MS);
    return () => clearTimeout(t);
  }, [armed, active, seen, inDraw, canWork, otherTour, engineRef]);

  // Settings rerun (the Tours › "Draw Tour" row, turned on from off + closed): offers again in
  // Draw, and otherwise the next time the person enters it (the row has cleared the preference).
  const inDrawRef = useLatest(inDraw);
  useEffect(() => {
    const onRelaunch = () => {
      if (inDrawRef.current) setArmed(true);
    };
    window.addEventListener(DRAW_TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(DRAW_TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [inDrawRef]);

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

  return (
    <TourStage
      engine={engine}
      ariaPrefix="Draw tour"
      copy={DRAW_TOUR_COPY}
      welcomeArt={<DrawTourArt />}
    />
  );
}
