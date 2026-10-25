'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';
import { WORKSHOP_TOUR_RELAUNCH_EVENT } from '@/lib/workshop-tour';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { useAnyModalOpen } from '@liveworkspace/workbench/lib/modal-guard';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { findTour } from './tour-dom';
import {
  workshopTourSteps,
  workshopTourStepTelemetryType,
  type WorkshopDemo,
  type WorkshopTourApi,
} from './workshop-tour-steps';
import { createShape, defaultSessionConfig, type Element } from '@livediagram/document';
import { deriveNewBoxedColours } from '@/lib/themes';
import { computeViewportCenter } from '@/lib/viewport';
import { WorkshopTourArt } from './WorkshopTourArt';
import { TourStage } from './TourStage';
import { useTourEngine, type TourOutcome } from './useTourEngine';
import { useStartPanelOpen } from '@/components/start/start-panel-open';

// The settle delay before the offer, as the Diagram and Draw tours'.
export const OFFER_DELAY_MS = 800;

const WORKSHOP_TOUR_COPY = {
  welcomeEyebrow: 'Workshop tour',
  helpHref: '/help/canvas/workshop-mode/',
};

// The demo elements' row: a Timer, a Dot Vote and a Poll, at their palette sizes, this far apart.
const DEMO_GAP = 32;
const DEMOS: readonly { which: WorkshopDemo; width: number; height: number }[] = [
  { which: 'timer', width: 224, height: 64 },
  { which: 'vote', width: 104, height: 96 },
  { which: 'poll', width: 240, height: 116 },
];

// Orchestrates the Workshop tour (docs/specs/012-collaboration/workshop-tour.md). Mounted once in
// EditorView beside TourHost; renders nothing until a person who has not seen it is in Workshop mode with an
// editor they can use, no other tour is on screen and the settle delay has passed, or the Settings row asks
// for a rerun. It no longer waits for the Diagram tour, which never runs in Workshop. It places nothing: its
// steps point at the chrome.
export function WorkshopTourHost() {
  const ctx = useEditorContext();
  // The session elements the tour placed, by kind, while they are on the canvas (no history: ctx.tourSquare).
  const demoRef = useRef<Partial<Record<WorkshopDemo, string>>>({});
  const apiRef = useLatest<WorkshopTourApi>({
    placeDemo: () => {
      if (Object.keys(demoRef.current).length > 0) return;
      const host = ctx.canvasMainRef.current?.getBoundingClientRect();
      const centre = host
        ? computeViewportCenter(host, ctx.viewport.get().offset)
        : { x: 400, y: 300 };
      const total = DEMOS.reduce((w, d) => w + d.width, 0) + DEMO_GAP * (DEMOS.length - 1);
      let x = centre.x - total / 2;
      const placed: Element[] = [];
      for (const d of DEMOS) {
        const base = createShape('session-button', 0, 0);
        placed.push({
          ...base,
          ...deriveNewBoxedColours(base, {
            backgroundColor: ctx.activeTab.backgroundColor,
            patternColor: ctx.activeTab.patternColor,
            theme: ctx.activeTab.theme,
          }),
          session: defaultSessionConfig(d.which),
          x,
          y: centre.y - d.height / 2,
          width: d.width,
          height: d.height,
        });
        demoRef.current[d.which] = base.id;
        x += d.width + DEMO_GAP;
      }
      ctx.tourSquare.place(...placed);
    },
    demoId: (which) => demoRef.current[which] ?? null,
  });

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
    // The session elements it placed go however it ended: the canvas is left as the person had it.
    demoRef.current = {};
    ctx.tourSquare.remove();
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
