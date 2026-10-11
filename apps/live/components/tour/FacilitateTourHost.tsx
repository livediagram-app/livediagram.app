'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useLatest } from '@/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';
import { FACILITATE_TOUR_RELAUNCH_EVENT } from '@/lib/facilitate-tour';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { findTour } from './tour-dom';
import {
  facilitateTourSteps,
  facilitateTourStepTelemetryType,
  type FacilitateTourApi,
} from './facilitate-tour-steps';
import { FacilitateTourArt } from './FacilitateTourArt';
import { TourStage } from './TourStage';
import { useTourEngine, type TourOutcome } from './useTourEngine';
import { useStartPanelOpen } from '@/components/start/start-panel-open';

// The settle delay before the offer, as the Diagram and Plan tours'.
export const OFFER_DELAY_MS = 800;

const FACILITATE_TOUR_COPY = {
  welcomeEyebrow: 'Facilitate tour',
  helpHref: '/help/canvas/facilitate-mode/',
  finish: 'Start facilitating',
};

const NO_API: FacilitateTourApi = {};

// Orchestrates the Facilitate tour (docs/specs/012-collaboration/facilitate-tour.md). Mounted once in
// EditorView beside TourHost; renders nothing until a person who has not seen it is in Facilitate mode with an
// editor they can use, no other tour is on screen and the settle delay has passed, or the Settings row asks
// for a rerun. It no longer waits for the Diagram tour, which never runs in Facilitate. It places nothing: its
// steps point at the chrome.
export function FacilitateTourHost() {
  const ctx = useEditorContext();
  const apiRef = useLatest(NO_API);

  // Whether the header's Share button is on this surface, read when the tour starts.
  const [canShare, setCanShare] = useState(true);
  const steps = useMemo(() => facilitateTourSteps({ canShare }), [canShare]);
  const engine = useTourEngine<FacilitateTourApi>({
    steps,
    apiRef,
    onStepView: (step) => track('UI', 'View', facilitateTourStepTelemetryType(step.id)),
    onStart: () => track('UI', 'Started', 'FacilitateTour'),
    onFinish: (outcome) => endTour(outcome),
  });
  const { active } = engine;

  // One tour at a time: publish this one while it is on screen, and wait while another is.
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'facilitate';
  useEffect(() => {
    setActiveTour('facilitate', active);
  }, [active]);

  const inFacilitate = ctx.editorMode.mode === 'facilitate';
  const seen = ctx.userPreferences?.facilitateTourSeen === true;
  // Start Facilitating on screen holds the offer until a template is picked or the panel closed
  // (docs/specs/007-editor/start-diagramming.md "The tours wait").
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

  // Armed on entering Facilitate (or mounting in it), and by a relaunch; disarmed on leaving it or once
  // offered. Adjusted during render when the mode changes.
  const [armed, setArmed] = useState(false);
  const [wasIn, setWasIn] = useState(false);
  if (inFacilitate !== wasIn) {
    setWasIn(inFacilitate);
    setArmed(inFacilitate);
  }
  // Answered already (here, or on another device): nothing is owed on this entry.
  if (armed && seen) setArmed(false);

  const endTour = (outcome: TourOutcome) => {
    // Onto the freshest preferences, not this render's: the whole blob is written.
    const next = rebaseUserPreferences(ctx.userPreferences, {
      ...ctx.userPreferences,
      facilitateTourSeen: true,
    });
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    debugLog('[facilitate-tour] end', { outcome });
    if (outcome === 'declined') track('UI', 'Closed', 'FacilitateTourOffer');
    else
      track(
        'UI',
        'Ended',
        outcome === 'completed' ? 'FacilitateTourCompleted' : 'FacilitateTourSkipped',
      );
  };
  const endTourRef = useLatest(endTour);
  const engineRef = useLatest(engine);

  // The offer: armed, in Facilitate, usable, not seen, and no other tour on screen. Another tour ending
  // re-renders this through useActiveTour, so this tour follows it.
  useEffect(() => {
    if (!armed || active || seen) return;
    if (!inFacilitate || !canWork || otherTour) return;
    const t = setTimeout(() => {
      setArmed(false);
      debugLog('[facilitate-tour] offer');
      setCanShare(findTour('share') !== null);
      engineRef.current.start();
      track('UI', 'Opened', 'FacilitateTourOffer');
    }, OFFER_DELAY_MS);
    return () => clearTimeout(t);
  }, [armed, active, seen, inFacilitate, canWork, otherTour, engineRef]);

  // Settings rerun (the Onboarding Tutorials › "Facilitate" row, turned on from off + closed): offers again in
  // Facilitate, and otherwise the next time the person enters it (the row has cleared the preference).
  const inFacilitateRef = useLatest(inFacilitate);
  useEffect(() => {
    const onRelaunch = () => {
      if (inFacilitateRef.current) setArmed(true);
    };
    window.addEventListener(FACILITATE_TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(FACILITATE_TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [inFacilitateRef]);

  // Ends as skipped when the tour can no longer run where it started: edit rights gone, Facilitate left,
  // or another tab opened.
  const activeId = ctx.activeTab.id;
  const startedOnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active) {
      startedOnRef.current = null;
      return;
    }
    startedOnRef.current ??= activeId;
    if (!canWork || !inFacilitate || startedOnRef.current !== activeId) {
      engineRef.current.stop();
      endTourRef.current('skipped');
    }
  }, [active, canWork, inFacilitate, activeId, engineRef, endTourRef]);

  useEffect(() => () => setActiveTour('facilitate', false), []);

  return (
    <TourStage
      engine={engine}
      ariaPrefix="Facilitate tour"
      copy={FACILITATE_TOUR_COPY}
      welcomeArt={<FacilitateTourArt />}
    />
  );
}
