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
import { requestFacilitateTourStart } from '@/lib/facilitate-tour';
import { waitForSelector } from './tour-dom';
import { tourStepsFor, tourStepTelemetryType, type TourApi } from './tour-steps';
import { TourStage } from './TourStage';
import { useTourEngine, type TourOutcome } from './useTourEngine';
import { useLatest } from '@/hooks/ui/useLatest';

// Orchestrates the interactive editor tour (docs/specs/007-editor/editor-tour.md). Mounted once in
// EditorView; renders nothing until either the /new handoff flag is
// consumed (a brand-new user's first document → the welcome offer card) or
// the Settings dialog requests a relaunch. The steps run on the shared
// engine (useTourEngine) and draw through the shared stage (TourStage);
// this host owns the offer, the step list and what ending means.

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
        // Single-undo-block append via the AI merge path: fresh id, so it
        // lands as a plain add.
        ctx.applyAiElements([el], 'generate');
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
    onStepView: (step) => {
      track('UI', 'View', tourStepTelemetryType(step.id));
      // The closing card carries the Facilitate tour's offer while it is owed.
      if (step.card === 'outro' && owedByFacilitateRef.current)
        track('UI', 'Opened', 'FacilitateTourOffer');
    },
    onStart: () => track('UI', 'Started', 'Tour'),
    onFinish: (outcome) => endTour(outcome),
  });
  const { active } = engine;

  // One tour at a time (docs/specs/026-plan/plan-tour.md "Where it appears"): this one publishes itself
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
  // Owed by a sibling (docs/specs/012-collaboration/facilitate-tour.md "Where it appears"): someone in
  // Facilitate who has seen neither tour is offered this one first, and the Facilitate tour as it ends.
  const owedByFacilitate =
    ctx.editorMode.mode === 'facilitate' && ctx.userPreferences?.facilitateTourSeen !== true;
  const ready =
    ctx.hydrated && !ctx.anyWelcomeOpen && !ctx.isReadOnly && !ctx.embedMode && !otherTour;
  const offerRef = useLatest(offer);
  const owedByFacilitateRef = useLatest(owedByFacilitate);
  // Whether "Show me Facilitate" ended this run, so its end is not counted as turning that tour down.
  const pickedFacilitateRef = useRef(false);
  useEffect(() => {
    offerPendingRef.current ??= hasTourPending();
    if (!(offerPendingRef.current || owedByFacilitate) || active || !ready) return;
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
  }, [active, ready, seen, owedByFacilitate, offerRef]);

  // Settings relaunch (the Show Tours › "Welcome Tour" row, turned on + closed):
  // rerun from the top: the welcome card is always step 1. Also re-marks
  // the pending flag so a reload mid-rerun re-offers, exactly like the
  // first-run path. While the Plan tour runs it waits, offering once that ends.
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
    clearTourPending();
    // Onto the freshest preferences, not this render's: the whole blob is written.
    // In Facilitate the Facilitate tour's offer rode on this tour's closing card
    // (docs/specs/012-collaboration/facilitate-tour.md), so ending this tour answers it too: it never pops
    // up on its own afterwards. "Show me Facilitate" starts it straight away.
    const next = rebaseUserPreferences(ctx.userPreferences, {
      ...ctx.userPreferences,
      tourSeen: true,
      ...(owedByFacilitate ? { facilitateTourSeen: true } : {}),
    });
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    if (outcome === 'declined') track('UI', 'Closed', 'TourOffer');
    else track('UI', 'Ended', outcome === 'completed' ? 'TourCompleted' : 'TourSkipped');
    if (owedByFacilitate && outcome === 'completed' && !pickedFacilitateRef.current)
      track('UI', 'Closed', 'FacilitateTourOffer');
    pickedFacilitateRef.current = false;
  };

  const showFacilitate = () => {
    pickedFacilitateRef.current = true;
    engine.next();
    requestFacilitateTourStart();
  };

  return (
    <TourStage
      engine={engine}
      {...(owedByFacilitate
        ? { outroChoice: { label: 'Show me Facilitate', onPick: showFacilitate } }
        : {})}
    />
  );
}
