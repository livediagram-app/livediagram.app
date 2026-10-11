'use client';

import { useEffect, useMemo, useRef } from 'react';
import { createShape, isBoxed, type Element } from '@livediagram/document';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import {
  clearTourPending,
  hasTourPending,
  markTourPending,
  TOUR_RELAUNCH_EVENT,
} from '@/lib/tour-pending';
import { track } from '@/lib/telemetry';
import { deriveNewBoxedColours } from '@/lib/themes';
import { computeViewportCenter } from '@/lib/viewport';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { waitForSelector } from './tour-dom';
import { tourStepsFor, tourStepTelemetryType, type TourApi } from './tour-steps';
import { TourStage } from './TourStage';
import { useTourEngine, type TourOutcome } from './useTourEngine';
import { useLatest } from '@/hooks/ui/useLatest';

// Orchestrates the Diagram tour (docs/specs/007-editor/editor-tour.md; the welcome tour until October 2026).
// Mounted once in EditorView; renders nothing until the open tab is in Diagram mode and either the /new
// handoff flag is set (a brand-new user's first document → the welcome offer card, waiting for a Diagram tab
// when the document opened in another mode) or the Settings dialog requests a relaunch. The steps run on the
// shared engine (useTourEngine) and draw through the shared stage (TourStage); this host owns the offer, the
// step list and what ending means.

export function TourHost() {
  const ctx = useEditorContext();
  const isMobile = useIsMobileViewport();
  // The effective step list: mobile drops the desktop-only step (the
  // theme dock button), an event-storming board drops the palette-header
  // dropdowns it doesn't render (docs/specs/021-event-storming/event-storming.md).
  const esBoard = ctx.esBoard === true;
  const steps = useMemo(() => tourStepsFor({ mobile: isMobile, esBoard }), [isMobile, esBoard]);
  // Whether this mount still owes the /new handoff an offer: read from storage on the first offer
  // check, and resolved once offered or found already seen. Only the offer effect reads it and it
  // never turns back on, so it is a ref rather than state.
  const offerPendingRef = useRef<boolean | null>(null);
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
      const node = await waitForSelector(`[data-element-id="${elementId}"]`, 2000);
      const r = node?.getBoundingClientRect();
      // Open beside the element; the menu clamps itself into the viewport.
      ctx.setContextMenu({
        mode: 'element',
        elementId,
        x: r ? r.right + 10 : window.innerWidth / 2,
        y: r ? Math.max(12, r.top) : window.innerHeight / 3,
      });
    },
    closeContextMenu: () => ctx.closeContextMenu(),
  });

  const engine = useTourEngine<TourApi>({
    steps,
    apiRef,
    // Stage-view funnel (docs/specs/017-telemetry/telemetry.md): one event per step entry (Back re-entry
    // included: it is a real view). The welcome card's view is already
    // covered by Opened/TourOffer; the last View before an
    // Ended/TourSkipped marks the drop-off stage on the dashboard.
    onStepView: (step) => track('UI', 'View', tourStepTelemetryType(step.id)),
    onStart: () => track('UI', 'Started', 'Tour'),
    onFinish: (outcome) => endTour(outcome),
  });
  const { active } = engine;

  // One tour at a time (docs/specs/007-editor/editor-tour.md "Where it appears"): this one publishes itself
  // while on screen, and waits while the Plan or Facilitate tour is.
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'welcome';
  useEffect(() => {
    setActiveTour('welcome', active);
  }, [active]);
  useEffect(() => () => setActiveTour('welcome', false), []);

  const offer = () => {
    engine.start();
    track('UI', 'Opened', 'TourOffer');
  };

  // Peek at the /new handoff flag (NOT consume: it stays set until the
  // offer is resolved, so a reload mid-offer or mid-tour re-offers instead
  // of silently swallowing the tour), then wait for the editor to be
  // usable before offering (the small delay lets the fit-to-screen pass
  // and the chrome settle). The `tourSeen` preference (synced, docs/specs/007-editor/user-preferences.md)
  // makes the offer once-ever for the user, however it was dismissed;
  // checked again at fire time below in case the preferences fetch lands
  // after mount.
  const seen = ctx.userPreferences?.tourSeen === true;
  // Diagram mode only (docs/specs/007-editor/editor-tour.md "Where it appears"): a document that opened in
  // another mode keeps the offer owed until the person is on a Diagram tab.
  const inDiagram = ctx.editorMode.mode === 'diagram';
  const ready =
    ctx.hydrated &&
    !ctx.anyWelcomeOpen &&
    !ctx.isReadOnly &&
    !ctx.embedMode &&
    inDiagram &&
    !otherTour;
  const offerRef = useLatest(offer);
  useEffect(() => {
    offerPendingRef.current ??= hasTourPending();
    if (!offerPendingRef.current || active || !ready) return;
    if (seen) {
      // Resolved elsewhere (another tab / device): tidy the stale flag.
      clearTourPending();
      offerPendingRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      offerPendingRef.current = false;
      offerRef.current();
    }, 800);
    return () => clearTimeout(t);
  }, [active, ready, seen, offerRef]);

  // Settings relaunch (the Show Tours › "Diagram" row, turned on + closed):
  // rerun from the top: the welcome card is always step 1. Also re-marks
  // the pending flag so a reload mid-rerun re-offers, exactly like the
  // first-run path. Off a Diagram tab, or while another tour runs, it waits,
  // offering once the person is on a Diagram tab with nothing else on screen.
  useEffect(() => {
    const onRelaunch = () => {
      markTourPending();
      if (!ready) {
        offerPendingRef.current = true;
        return;
      }
      offerRef.current();
    };
    window.addEventListener(TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [ready, offerRef]);

  const endTour = (outcome: TourOutcome) => {
    // Safety net beyond the current step's cleanup: never strand an open
    // menu; and never offer again, however the tour ended, via the synced
    // tourSeen preference (docs/specs/007-editor/user-preferences.md), so it holds across the user's devices.
    // The offer is now RESOLVED, so the reload-surviving pending flag can
    // finally go.
    apiRef.current.closeContextMenu();
    // The square it placed on an empty tab goes, so the document is left as the person had it.
    if (ctx.tourSquare.remove() !== null) ctx.setSelectedId(null);
    clearTourPending();
    // Onto the freshest preferences, not this render's: the whole blob is written.
    const next = rebaseUserPreferences(ctx.userPreferences, {
      ...ctx.userPreferences,
      tourSeen: true,
    });
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    if (outcome === 'declined') track('UI', 'Closed', 'TourOffer');
    else track('UI', 'Ended', outcome === 'completed' ? 'TourCompleted' : 'TourSkipped');
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

  return <TourStage engine={engine} />;
}
