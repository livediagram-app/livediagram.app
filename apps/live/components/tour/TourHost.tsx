'use client';

import { useEffect, useMemo, useState } from 'react';
import { createShape, isBoxed, type Element } from '@livediagram/document';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { clearTourPending, markTourPending, TOUR_RELAUNCH_EVENT } from '@/lib/tour-pending';
import { track } from '@/lib/telemetry';
import { deriveNewBoxedColours } from '@/lib/themes';
import { computeViewportCenter } from '@/lib/viewport';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { useAnyModalOpen } from '@/lib/modal-guard';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { waitForSelector } from './tour-dom';
import { tourStepsFor, tourStepTelemetryType, type TourApi } from './tour-steps';
import { CoachDockStage } from './coach-dock/CoachDockStage';
import { TOUR_FINISH } from './tour-card-copy';
import { TourWelcomeArt } from './TourWelcomeArt';
import { useTourEngine, type TourOutcome } from './useTourEngine';
import { useLatest } from '@/hooks/ui/useLatest';
import { useStartPanelOpen } from '@/components/start/start-panel-open';
import { elementSelector } from '@/lib/canvas-selectors';

// Orchestrates the Diagram tour (docs/specs/007-editor/editor-tour.md; the welcome tour until October 2026).
// Mounted once in EditorView; renders nothing until a person who has not answered it is on a Diagram tab with an
// editor they can use (offered each time they come to one, until they take it or say No Thanks), or the Settings
// dialog requests a relaunch. The steps run on the
// shared engine (useTourEngine) and draw through the coach dock (CoachDockStage); this host owns the offer, the
// step list and what ending means.

const HELP = { href: '/help', label: 'Help Centre' };
// The tour chip a folded offer leaves in the tab bar (docs/specs/007-editor/coach-dock.md "The offer").
const CHIP = {
  label: 'Diagram Tour',
  about: 'A short tour of the editor: adding shapes, connecting them and styling.',
};

export function TourHost() {
  const ctx = useEditorContext();
  const isMobile = useIsMobileViewport();
  // The effective step list: mobile drops the desktop-only step (the
  // theme dock button), an event-storming board drops the palette-header
  // dropdowns it doesn't render (docs/specs/021-event-storming/event-storming.md).
  const esBoard = ctx.esBoard === true;
  const steps = useMemo(() => tourStepsFor({ mobile: isMobile, esBoard }), [isMobile, esBoard]);
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
  // while on screen, and waits while the Plan or Workshop tour is.
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

  // The `tourSeen` preference (synced, docs/specs/007-editor/user-preferences.md) is the one answer: taken,
  // skipped mid-way or declined. Until it is set the offer comes each time the person is on a Diagram tab; an
  // offer left alone (folded into its chip, or withdrawn as the person moved on) is not an answer.
  const seen = ctx.userPreferences?.tourSeen === true;
  // Diagram mode only (docs/specs/007-editor/editor-tour.md "Where it appears"): a document that opened in
  // another mode keeps the offer owed until the person is on a Diagram tab.
  const inDiagram = ctx.editorMode.mode === 'diagram';
  // Start Diagramming on screen holds the offer until a template is picked or the panel closed
  // (docs/specs/007-editor/start-diagramming.md "The tours wait").
  const startPanelOpen = useStartPanelOpen();
  // Dialogs come first: an offer (or a Settings relaunch) waits for the last open dialog to close.
  const modalOpen = useAnyModalOpen();
  const ready =
    ctx.hydrated &&
    // The synced preferences are in, so an answer given on another device holds here too.
    ctx.prefsSettled &&
    !ctx.anyWelcomeOpen &&
    !startPanelOpen &&
    !modalOpen &&
    !ctx.isReadOnly &&
    !ctx.embedMode &&
    inDiagram &&
    !otherTour;
  // Armed on coming to a Diagram tab (or mounting on one) and by a relaunch; disarmed once offered. Adjusted
  // during render when the mode changes.
  const [armed, setArmed] = useState(false);
  const [wasIn, setWasIn] = useState(false);
  if (inDiagram !== wasIn) {
    setWasIn(inDiagram);
    setArmed(inDiagram);
  }
  // Answered (here, or on another device): nothing is owed on this visit.
  if (armed && seen) setArmed(false);
  // A stale /new handoff flag is tidied once the answer is known.
  useEffect(() => {
    if (seen) clearTourPending();
  }, [seen]);
  const offerRef = useLatest(offer);
  useEffect(() => {
    if (!armed || active || !ready || seen) return;
    // The small delay lets the fit-to-screen pass and the chrome settle.
    const t = setTimeout(() => {
      setArmed(false);
      offerRef.current();
    }, 800);
    return () => clearTimeout(t);
  }, [armed, active, ready, seen, offerRef]);

  // Settings relaunch (the Tours › "Diagram Tour" row, turned on + closed): rerun from the top, the offer first.
  // Off a Diagram tab, or while another tour runs, it waits, offering once the person is on a Diagram tab with
  // nothing else on screen.
  const readyRef = useLatest(ready);
  useEffect(() => {
    const onRelaunch = () => {
      markTourPending();
      if (readyRef.current) offerRef.current();
      else setArmed(true);
    };
    window.addEventListener(TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [readyRef, offerRef]);

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
  const engineRef = useLatest(engine);

  // Leaves when the open tab leaves Diagram (its mode switched, or a tab in another mode opened): the steps point
  // at chrome the other modes do not show. An offer nobody answered is withdrawn, to come back on the next Diagram
  // tab; a tour under way ends as skipped.
  useEffect(() => {
    if (!active || inDiagram) return;
    engineRef.current.leave();
  }, [active, inDiagram, engineRef]);

  return (
    <CoachDockStage
      engine={engine}
      eyebrow="Diagram tour"
      art={<TourWelcomeArt />}
      help={HELP}
      finish={TOUR_FINISH}
      chip={CHIP}
      onFolded={() => track('UI', 'Closed', 'TourOfferFolded')}
      onChipStart={() => track('UI', 'Opened', 'TourChip')}
    />
  );
}
