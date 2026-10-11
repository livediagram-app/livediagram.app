'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useLatest } from '@/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';
import { ILLUSTRATE_TOUR_RELAUNCH_EVENT } from '@/lib/illustrate-tour';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import {
  ILLUSTRATE_TOUR_STEPS,
  illustrateTourSteps,
  illustrateTourStepTelemetryType,
  type IllustrateTourApi,
} from './illustrate-tour-steps';
import { findTour } from './tour-dom';
import { IllustrateTourArt } from './IllustrateTourArt';
import { TourStage } from './TourStage';
import { useTourEngine, type TourOutcome } from './useTourEngine';
import { useStartPanelOpen } from '@/components/start/start-panel-open';

// The settle delay before the offer, as the Diagram and Plan tours'.
export const OFFER_DELAY_MS = 800;

const ILLUSTRATE_TOUR_COPY = {
  welcomeEyebrow: 'Illustrate tour',
  helpHref: '/help/canvas/illustrate/',
  finish: 'Start illustrating',
};

const NO_API: IllustrateTourApi = {};

// Orchestrates the Illustrate tour (docs/specs/007-editor/illustrate-tour.md). Mounted once in
// EditorView beside TourHost; renders nothing until a person who has not seen it is in Illustrate mode with an
// editor they can use, no other tour is on screen and the settle delay has passed, or the Settings row asks
// for a rerun. Mirrors IllustrateTourHost. It places nothing: its steps point at the page chrome.
export function IllustrateTourHost() {
  const ctx = useEditorContext();
  const apiRef = useLatest(NO_API);

  // The steps whose anchors are on screen, read when the tour starts (a page too small for its name, no +, no
  // Slides button on this surface).
  const [steps, setSteps] = useState(ILLUSTRATE_TOUR_STEPS);
  const engine = useTourEngine<IllustrateTourApi>({
    steps,
    apiRef,
    onStepView: (step) => track('UI', 'View', illustrateTourStepTelemetryType(step.id)),
    onStart: () => track('UI', 'Started', 'IllustrateTour'),
    onFinish: (outcome) => endTour(outcome),
  });
  const { active } = engine;

  // One tour at a time: publish this one while it is on screen, and wait while another is.
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'illustrate';
  useEffect(() => {
    setActiveTour('illustrate', active);
  }, [active]);

  const inIllustrate = ctx.editorMode.mode === 'illustrate';
  const seen = ctx.userPreferences?.illustrateTourSeen === true;
  // Start Illustrating on screen holds the offer until a template is picked or the panel closed: the pages it points
  // at are hidden while it is open (docs/specs/007-editor/start-diagramming.md "The tours wait").
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

  // Armed on entering Illustrate (or mounting in it), and by a relaunch; disarmed on leaving it or once
  // offered. Adjusted during render when the mode changes.
  const [armed, setArmed] = useState(false);
  const [wasIn, setWasIn] = useState(false);
  if (inIllustrate !== wasIn) {
    setWasIn(inIllustrate);
    setArmed(inIllustrate);
  }
  // Answered already (here, or on another device): nothing is owed on this entry.
  if (armed && seen) setArmed(false);

  const endTour = (outcome: TourOutcome) => {
    // Onto the freshest preferences, not this render's: the whole blob is written.
    const next = rebaseUserPreferences(ctx.userPreferences, {
      ...ctx.userPreferences,
      illustrateTourSeen: true,
    });
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    debugLog('[illustrate-tour] end', { outcome });
    if (outcome === 'declined') track('UI', 'Closed', 'IllustrateTourOffer');
    else
      track(
        'UI',
        'Ended',
        outcome === 'completed' ? 'IllustrateTourCompleted' : 'IllustrateTourSkipped',
      );
  };
  const endTourRef = useLatest(endTour);
  const engineRef = useLatest(engine);

  // The offer: armed, in Illustrate, usable, not seen, and no other tour on screen. Another tour ending
  // re-renders this through useActiveTour, so this tour follows it.
  useEffect(() => {
    if (!armed || active || seen) return;
    if (!inIllustrate || !canWork || otherTour) return;
    const t = setTimeout(() => {
      setArmed(false);
      debugLog('[illustrate-tour] offer');
      setSteps(illustrateTourSteps((id) => findTour(id) !== null));
      engineRef.current.start();
      track('UI', 'Opened', 'IllustrateTourOffer');
    }, OFFER_DELAY_MS);
    return () => clearTimeout(t);
  }, [armed, active, seen, inIllustrate, canWork, otherTour, engineRef]);

  // Settings rerun (the Onboarding Tutorials › "Illustrate" row, turned on from off + closed): offers again in
  // Illustrate, and otherwise the next time the person enters it (the row has cleared the preference).
  const inIllustrateRef = useLatest(inIllustrate);
  useEffect(() => {
    const onRelaunch = () => {
      if (inIllustrateRef.current) setArmed(true);
    };
    window.addEventListener(ILLUSTRATE_TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(ILLUSTRATE_TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [inIllustrateRef]);

  // Ends as skipped when the tour can no longer run where it started: edit rights gone, Illustrate left,
  // or another tab opened.
  const activeId = ctx.activeTab.id;
  const startedOnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active) {
      startedOnRef.current = null;
      return;
    }
    startedOnRef.current ??= activeId;
    if (!canWork || !inIllustrate || startedOnRef.current !== activeId) {
      engineRef.current.stop();
      endTourRef.current('skipped');
    }
  }, [active, canWork, inIllustrate, activeId, engineRef, endTourRef]);

  useEffect(() => () => setActiveTour('illustrate', false), []);

  return (
    <TourStage
      engine={engine}
      ariaPrefix="Illustrate tour"
      copy={ILLUSTRATE_TOUR_COPY}
      welcomeArt={<IllustrateTourArt />}
    />
  );
}
