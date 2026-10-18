'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useLatest } from '@/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';
import { WORKSHOP_TOUR_RELAUNCH_EVENT } from '@/lib/workshop-tour';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { useAnyModalOpen } from '@/lib/modal-guard';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { findTour } from './tour-dom';
import {
  workshopTourSteps,
  workshopTourStepTelemetryType,
  type WorkshopTourApi,
} from './workshop-tour-steps';
import { WorkshopTourArt } from './WorkshopTourArt';
import { TourStage } from './TourStage';
import { useTourEngine, type TourOutcome } from './useTourEngine';
import { useStartPanelOpen } from '@/components/start/start-panel-open';

// The settle delay before the offer, as the Diagram and Plan tours'.
export const OFFER_DELAY_MS = 800;

const WORKSHOP_TOUR_COPY = {
  welcomeEyebrow: 'Workshop tour',
  helpHref: '/help/canvas/workshop-mode/',
  finish: 'Start a workshop',
};

const NO_API: WorkshopTourApi = {};

// Orchestrates the Workshop tour (docs/specs/012-collaboration/workshop-tour.md). Mounted once in
// EditorView beside TourHost; renders nothing until a person who has not seen it is in Workshop mode with an
// editor they can use, no other tour is on screen and the settle delay has passed, or the Settings row asks
// for a rerun. It no longer waits for the Diagram tour, which never runs in Workshop. It places nothing: its
// steps point at the chrome.
export function WorkshopTourHost() {
  const ctx = useEditorContext();
  const apiRef = useLatest(NO_API);

  // Whether the header's Share button is on this surface, read when the tour starts.
  const [canShare, setCanShare] = useState(true);
  const steps = useMemo(() => workshopTourSteps({ canShare }), [canShare]);
  const engine = useTourEngine<WorkshopTourApi>({
    steps,
    apiRef,
    onStepView: (step) => track('UI', 'View', workshopTourStepTelemetryType(step.id)),
    onStart: () => track('UI', 'Started', 'WorkshopTour'),
    onFinish: (outcome) => endTour(outcome),
  });
  const { active } = engine;

  // One tour at a time: publish this one while it is on screen, and wait while another is.
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'workshop';
  // Dialogs come first (docs/specs/007-editor/editor-tour.md): the offer waits for the last one to close.
  const modalOpen = useAnyModalOpen();
  useEffect(() => {
    setActiveTour('workshop', active);
  }, [active]);

  const inWorkshop = ctx.editorMode.mode === 'workshop';
  const seen = ctx.userPreferences?.workshopTourSeen === true;
  // Start a Workshop on screen holds the offer until a template is picked or the panel closed
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

  // Armed on entering Workshop (or mounting in it), and by a relaunch; disarmed on leaving it or once
  // offered. Adjusted during render when the mode changes.
  const [armed, setArmed] = useState(false);
  const [wasIn, setWasIn] = useState(false);
  if (inWorkshop !== wasIn) {
    setWasIn(inWorkshop);
    setArmed(inWorkshop);
  }
  // Answered already (here, or on another device): nothing is owed on this entry.
  if (armed && seen) setArmed(false);

  const endTour = (outcome: TourOutcome) => {
    // Onto the freshest preferences, not this render's: the whole blob is written.
    const next = rebaseUserPreferences(ctx.userPreferences, {
      ...ctx.userPreferences,
      workshopTourSeen: true,
    });
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    debugLog('[workshop-tour] end', { outcome });
    if (outcome === 'declined') track('UI', 'Closed', 'WorkshopTourOffer');
    else
      track(
        'UI',
        'Ended',
        outcome === 'completed' ? 'WorkshopTourCompleted' : 'WorkshopTourSkipped',
      );
  };
  const endTourRef = useLatest(endTour);
  const engineRef = useLatest(engine);

  // The offer: armed, in Workshop, usable, not seen, and no other tour on screen. Another tour ending
  // re-renders this through useActiveTour, so this tour follows it.
  useEffect(() => {
    if (!armed || active || seen) return;
    if (!inWorkshop || !canWork || otherTour || modalOpen) return;
    const t = setTimeout(() => {
      setArmed(false);
      debugLog('[workshop-tour] offer');
      setCanShare(findTour('share') !== null);
      engineRef.current.start();
      track('UI', 'Opened', 'WorkshopTourOffer');
    }, OFFER_DELAY_MS);
    return () => clearTimeout(t);
  }, [armed, active, seen, inWorkshop, canWork, otherTour, modalOpen, engineRef]);

  // Settings rerun (the Tours › "Workshop Tour" row, turned on from off + closed): offers again in
  // Workshop, and otherwise the next time the person enters it (the row has cleared the preference).
  const inWorkshopRef = useLatest(inWorkshop);
  useEffect(() => {
    const onRelaunch = () => {
      if (inWorkshopRef.current) setArmed(true);
    };
    window.addEventListener(WORKSHOP_TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(WORKSHOP_TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [inWorkshopRef]);

  // Ends as skipped when the tour can no longer run where it started: edit rights gone, Workshop left,
  // or another tab opened.
  const activeId = ctx.activeTab.id;
  const startedOnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active) {
      startedOnRef.current = null;
      return;
    }
    startedOnRef.current ??= activeId;
    if (!canWork || !inWorkshop || startedOnRef.current !== activeId) {
      engineRef.current.stop();
      endTourRef.current('skipped');
    }
  }, [active, canWork, inWorkshop, activeId, engineRef, endTourRef]);

  useEffect(() => () => setActiveTour('workshop', false), []);

  return (
    <TourStage
      engine={engine}
      ariaPrefix="Workshop tour"
      copy={WORKSHOP_TOUR_COPY}
      welcomeArt={<WorkshopTourArt />}
    />
  );
}
