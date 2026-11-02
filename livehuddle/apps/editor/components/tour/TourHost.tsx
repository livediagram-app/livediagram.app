'use client';

import { useEffect, useMemo, useRef } from 'react';
import { createShape, isBoxed, type Element } from '@livehuddle/document';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useCoarsePointer } from '@liveworkspace/workbench/hooks/ui/useCoarsePointer';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { TOUR_RELAUNCH_EVENT } from '@/lib/diagram-tour';
import { track } from '@/lib/telemetry';
import { deriveNewBoxedColours } from '@/lib/themes';
import { computeViewportCenter } from '@liveworkspace/workbench/lib/viewport';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { waitForSelector } from '@liveworkspace/workbench/components/tour/tour-dom';
import { tourStepsFor, tourStepTelemetryType, type TourApi } from './tour-steps';
import { TourStage } from './TourStage';
import {
  useTourEngine,
  type TourOutcome,
} from '@liveworkspace/workbench/components/tour/useTourEngine';
import { TOUR_OFFER_RANK, useOfferTour } from '@liveworkspace/workbench/components/tour/tour-offer';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

// Orchestrates the Diagram tour (docs/specs/007-editor/editor-tour.md; the welcome tour until October 2026).
// Mounted once in EditorView. While the open tab is in Diagram mode and the person can work on it, it offers the
// tour on the footer's Start Tour button ("Start Diagram Tour", tour-offer.ts); a press there, or the Settings row
// turned back on, starts it. It never starts or prompts on its own. The steps run on the shared engine
// (useTourEngine) and draw through the shared stage (TourStage); this host owns the offer, the step list and what
// ending means.

export function TourHost() {
  const ctx = useEditorContext();
  const isMobile = useIsMobileViewport();
  // A touch screen reads the steps' touch words (a tap, a long-press).
  const touch = useCoarsePointer();
  // The effective step list: an event-storming board drops the palette-header
  // dropdowns it doesn't render (docs/specs/021-event-storming/event-storming.md).
  const esBoard = ctx.esBoard === true;
  const steps = useMemo(
    () => tourStepsFor({ mobile: isMobile, esBoard, touch }),
    [isMobile, esBoard, touch],
  );
  // The element the element-menu step selected to open its menu on, deselected again as the step closes the menu:
  // left selected, its toolbar and Quick Style panel came up behind the next step.
  const selectedByTourRef = useRef<string | null>(null);
  const apiRef = useLatest<TourApi>({
    openElementContextMenu: async () => {
      // Reuse the first boxed element (template diagrams come populated);
      // add a theme-coloured square at the viewport centre when empty.
      let elementId = ctx.activeTab.elements.find(isBoxed)?.id ?? null;
      if (!elementId) {
        const base = createShape('square', 0, 0);
        const colours = deriveNewBoxedColours(base, {
          backgroundColor: ctx.activeTab.backgroundColor,
          patternColor: ctx.activeTab.patternColor,
          theme: ctx.activeTab.theme,
        });
        const hostRect = ctx.canvasMainRef.current?.getBoundingClientRect();
        const centre = hostRect
          ? computeViewportCenter(hostRect, ctx.viewport.get().offset)
          : { x: 400, y: 300 };
        const el: Element = {
          ...base,
          ...colours,
          x: centre.x - base.width / 2,
          y: centre.y - base.height / 2,
        };
        // The tour's own square, with no history, taken away when the tour ends (useTourSquare).
        ctx.tourSquare.place(el);
        elementId = el.id;
      }
      ctx.setSelectedId(elementId);
      selectedByTourRef.current = elementId;
      const node = await waitForSelector(elementSelector(elementId), 2000);
      const r = node?.getBoundingClientRect();
      // Open beside the element; the menu clamps itself into the viewport.
      ctx.setContextMenu({
        mode: 'element',
        elementId,
        x: r ? r.right + 10 : window.innerWidth / 2,
        y: r ? Math.max(12, r.top) : window.innerHeight / 3,
      });
    },
    closeContextMenu: () => {
      ctx.closeContextMenu();
      if (selectedByTourRef.current === null) return;
      selectedByTourRef.current = null;
      ctx.setSelectedId(null);
    },
  });

  const engine = useTourEngine<TourApi>({
    steps,
    apiRef,
    // Stage-view funnel (docs/specs/017-telemetry/telemetry.md): one event per step entry (Back re-entry
    // included: it is a real view); the last View before an Ended/TourSkipped marks the drop-off stage on the
    // dashboard.
    onStepView: (step) => track('UI', 'View', tourStepTelemetryType(step.id)),
    onStart: () => track('UI', 'Started', 'Tour'),
    onFinish: (outcome) => endTour(outcome),
  });
  const { active } = engine;

  // One tour at a time (docs/specs/007-editor/editor-tour.md "Where it appears"): this one publishes itself
  // while on screen, and waits while the Draw or Workshop tour is.
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'welcome';
  useEffect(() => {
    setActiveTour('welcome', active);
  }, [active]);
  useEffect(() => () => setActiveTour('welcome', false), []);

  // Diagram mode only (docs/specs/007-editor/editor-tour.md "Where it appears"): the steps point at diagramming chrome.
  const inDiagram = ctx.editorMode.mode === 'diagram';
  // Start Diagramming on screen holds the button back until a template is picked or the panel closed
  // (docs/specs/007-editor/start-diagramming.md "The tours wait").
  const startPanelOpen = useStartPanelOpen();
  const ready =
    ctx.hydrated &&
    !ctx.anyWelcomeOpen &&
    !startPanelOpen &&
    !ctx.isReadOnly &&
    !ctx.embedMode &&
    inDiagram;
  const start = () => {
    if (active || otherTour) return;
    engine.start();
  };
  // The footer's Start Tour button: offered whenever the tour could run, taken or not (it is how it is taken again).
  useOfferTour(
    'diagram',
    ready
      ? {
          name: 'Diagram',
          rank: TOUR_OFFER_RANK.mode,
          start,
          onShown: () => track('UI', 'Opened', 'TourOffer'),
        }
      : null,
  );

  // Settings relaunch (the Tours › "Diagram Tour" row, turned on + closed): runs the tour from the top when the open
  // tab is in Diagram with nothing else on screen; elsewhere the footer button is there when the person is.
  const startRef = useLatest(start);
  const readyRef = useLatest(ready);
  useEffect(() => {
    const onRelaunch = () => {
      if (readyRef.current) startRef.current();
    };
    window.addEventListener(TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [readyRef, startRef]);

  const endTour = (outcome: TourOutcome) => {
    // Safety net beyond the current step's cleanup: never strand an open menu. The synced tourSeen preference
    // (docs/specs/007-editor/user-preferences.md) records that it was taken, for the Settings row.
    apiRef.current.closeContextMenu();
    // The square it placed on an empty tab goes, so the document is left as the person had it.
    if (ctx.tourSquare.remove().length > 0) ctx.setSelectedId(null);
    // Onto the freshest preferences, not this render's: the whole blob is written.
    const next = rebaseUserPreferences(ctx.userPreferences, {
      ...ctx.userPreferences,
      tourSeen: true,
    });
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    track('UI', 'Ended', outcome === 'completed' ? 'TourCompleted' : 'TourSkipped');
  };
  const endTourRef = useLatest(endTour);
  const engineRef = useLatest(engine);

  // Ends as skipped when the open tab leaves Diagram mid-tour (its mode switched, or a tab in another mode
  // opened): the steps point at chrome the other modes do not show.
  useEffect(() => {
    if (!active || inDiagram) return;
    engineRef.current.stop();
    endTourRef.current('skipped');
  }, [active, inDiagram, engineRef, endTourRef]);

  return <TourStage engine={engine} blockInput />;
}
