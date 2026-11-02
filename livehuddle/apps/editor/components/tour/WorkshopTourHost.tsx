'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { WORKSHOP_TOUR_RELAUNCH_EVENT } from '@/lib/workshop-tour';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { findTour } from '@liveworkspace/workbench/components/tour/tour-dom';
import {
  workshopTourSteps,
  workshopTourStepTelemetryType,
  type WorkshopDemo,
  type WorkshopTourApi,
} from './workshop-tour-steps';
import { createShape, defaultSessionConfig, type Element } from '@livehuddle/document';
import { deriveNewBoxedColours } from '@/lib/themes';
import { computeViewportCenter } from '@liveworkspace/workbench/lib/viewport';
import { TourStage } from './TourStage';
import {
  useTourEngine,
  type TourOutcome,
} from '@liveworkspace/workbench/components/tour/useTourEngine';
import { TOUR_OFFER_RANK, useOfferTour } from '@liveworkspace/workbench/components/tour/tour-offer';
import { useStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';

const WORKSHOP_TOUR_COPY = {
  helpHref: '/help/canvas/workshop-mode/',
};

// The demo elements' row: a Timer, a Dot Vote and a Poll, at their palette sizes, this far apart.
const DEMO_GAP = 32;
const DEMOS: readonly { which: WorkshopDemo; width: number; height: number }[] = [
  { which: 'timer', width: 224, height: 64 },
  { which: 'vote', width: 104, height: 96 },
  { which: 'poll', width: 240, height: 116 },
];

// Orchestrates the Workshop tour (docs/specs/012-collaboration/workshop-tour.md). Mounted once in EditorView beside
// TourHost. While the person is in Workshop mode with an editor they can use, it offers the tour on the footer's Start
// Tour button ("Start Workshop Tour"); a press there, or the Settings row, starts it. Its demo session elements are
// the tour's own, taken away as it ends.
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

  // One tour at a time: publish this one while it is on screen, and start nothing while another is.
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'workshop';
  useEffect(() => {
    setActiveTour('workshop', active);
  }, [active]);

  const inWorkshop = ctx.editorMode.mode === 'workshop';
  // Start a Workshop on screen holds the offer until a template is picked or the panel closed
  // (docs/specs/007-editor/start-diagramming.md "The tours wait").
  const startPanelOpen = useStartPanelOpen();
  const canWork =
    ctx.hydrated &&
    !startPanelOpen &&
    !ctx.anyWelcomeOpen &&
    !ctx.isReadOnly &&
    !ctx.embedMode &&
    ctx.activeTab.locked !== true;

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
    track('UI', 'Ended', outcome === 'completed' ? 'WorkshopTourCompleted' : 'WorkshopTourSkipped');
  };
  const endTourRef = useLatest(endTour);
  const engineRef = useLatest(engine);

  const start = () => {
    if (active || otherTour) return;
    setCanShare(findTour('share') !== null);
    debugLog('[workshop-tour] start');
    engineRef.current.start();
  };
  // The footer's Start Tour button: offered whenever the tour could run here, taken or not (it is how it is taken
  // again). The tour never starts on its own.
  useOfferTour(
    'workshop',
    inWorkshop && canWork
      ? {
          name: 'Workshop',
          rank: TOUR_OFFER_RANK.mode,
          start,
          onShown: () => track('UI', 'Opened', 'WorkshopTourOffer'),
        }
      : null,
  );

  // Settings rerun (Tours › "Workshop Tour", turned on from off + closed): runs the tour in Workshop; elsewhere the
  // footer button is there when the person is.
  const startRef = useLatest(start);
  const canStartRef = useLatest(inWorkshop && canWork);
  useEffect(() => {
    const onRelaunch = () => {
      if (canStartRef.current) startRef.current();
    };
    window.addEventListener(WORKSHOP_TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(WORKSHOP_TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [canStartRef, startRef]);

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

  return <TourStage engine={engine} ariaPrefix="Workshop tour" copy={WORKSHOP_TOUR_COPY} />;
}
