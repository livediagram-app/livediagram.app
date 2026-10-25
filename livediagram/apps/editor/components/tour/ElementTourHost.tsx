'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Element } from '@livediagram/document';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useSelectionOf } from '@/hooks/canvas/useSelectionStore';
import { useCoarsePointer } from '@/hooks/ui/useCoarsePointer';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { useLatest } from '@/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';
import { setElementTourOffer, type ElementTourOffer } from '@/lib/element-tour-offer';
import {
  canTourElement,
  elementTourKindOf,
  elementTourSeen,
  markElementTourSeen,
  type ElementTourKind,
} from '@/lib/element-tours';
import { helpArticleHref } from '@/lib/help-articles';
import { setConceptTourPreview } from '@/lib/concept-tour-preview';
import { chartDataDialog } from '@liveworkspace/workbench/lib/chart-data-dialog-handle';
import { sankeyFlowsDialog } from '@/lib/sankey-flows-dialog-handle';
import { sequenceDialog } from '@/lib/sequence-dialog-handle';
import { setSankeyTourFocus } from '@liveworkspace/workbench/lib/sankey-tour-focus';
import type { Selection } from '@/lib/selection-store';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { useStartPanelOpen } from '@/components/start/start-panel-open';
import { useAnyModalOpen } from '@/lib/modal-guard';
import type { ElementTourApi } from './element-tour-api';
import { CONTEXT_MENU } from './element-menu-tour';
import { waitForSelector } from './tour-dom';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';
import { ELEMENT_TOUR_DEFS, elementTourStepTelemetryType } from './element-tour-defs';
import { TourStage } from './TourStage';
import type { TourStepOf } from './tour-step';
import { useTourEngine, type TourOutcome } from './useTourEngine';

// The one selected element, or null for none or a multi-selection.
const singleOf = (s: Selection) => (s.multiSelectedIds.size > 0 ? null : s.selectedId);

// Element tours (docs/specs/007-editor/element-tours.md): decides whether the selected element is offered its tour,
// publishes the offer for the selection toolbar to draw, and runs the tour when Play is pressed. Mounted once in
// EditorView beside the other tour hosts. Each toured kind's steps, copy and token are its ELEMENT_TOUR_DEFS entry.
export function ElementTourHost() {
  const ctx = useEditorContext();
  const selectedId = useSelectionOf(singleOf);
  const touch = useCoarsePointer();
  // Never offered on a phone (docs/specs/007-editor/element-tours.md "On a phone"): the selection toolbar has no room.
  const phone = useIsMobileViewport();
  const element = useMemo(
    () => (selectedId ? (ctx.activeTab.elements.find((e) => e.id === selectedId) ?? null) : null),
    [ctx.activeTab.elements, selectedId],
  );
  const kind = elementTourKindOf(element);

  // The tour's steps, fixed when Play is pressed; the element it runs on.
  const [steps, setSteps] = useState<TourStepOf<ElementTourApi>[]>([]);
  const [touring, setTouring] = useState<{ id: string; kind: ElementTourKind } | null>(null);
  const touringRef = useLatest(touring);

  const api: ElementTourApi = {
    showTable: sankeyFlowsDialog.showTable,
    showText: sankeyFlowsDialog.showText,
    focus: (part, index) => {
      const id = touringRef.current?.id;
      if (id) setSankeyTourFocus({ elementId: id, part, index });
    },
    clearFocus: () => setSankeyTourFocus(null),
    openFlows: () => {
      const id = touringRef.current?.id;
      if (id && ctx.sankeyFlowsOpenForId !== id) ctx.setSankeyFlowsOpenForId(id);
    },
    // As the dialog's own Done: what is being typed is stored first.
    closeFlows: () => sankeyFlowsDialog.close(),
    openSequence: () => {
      const id = touringRef.current?.id;
      if (id && ctx.sequenceOpenForId !== id) ctx.setSequenceOpenForId(id);
    },
    // As the dialog's own Done: what is being typed is stored first.
    closeSequence: () => sequenceDialog.close(),
    showSequenceTab: (tab) =>
      tab === 'text' ? sequenceDialog.showText() : sequenceDialog.showMessages(),
    openChartData: () => {
      const id = touringRef.current?.id;
      if (id && ctx.lineDataOpenForId !== id) ctx.setLineDataOpenForId(id);
    },
    // As the dialog's own Done: what is being typed is stored first.
    closeChartData: () => chartDataDialog.close(),
    previewConcept: (anim) => {
      const id = touringRef.current?.id;
      if (id) setConceptTourPreview({ elementId: id, anim, run: Date.now() });
    },
    showStageBar: (index) => {
      const id = touringRef.current?.id;
      if (id) setConceptTourPreview({ elementId: id, bar: index, run: Date.now() });
    },
    clearPreview: () => setConceptTourPreview(null),
    openElementMenu: async () => {
      const id = touringRef.current?.id;
      // Always set, never skipped for a menu already on screen: the step before may have just closed it.
      if (!id) return;
      // Beside the element, where a right-click on it opens it; the menu nudges itself into the viewport.
      const r = document.querySelector(elementSelector(id))?.getBoundingClientRect();
      ctx.setContextMenu({
        mode: 'element',
        elementId: id,
        x: r ? r.right + 10 : window.innerWidth / 2,
        y: r ? Math.max(12, r.top) : window.innerHeight / 3,
      });
      await waitForSelector(CONTEXT_MENU, 2000);
    },
    closeElementMenu: () => ctx.closeContextMenu(),
  };
  const apiRef = useLatest(api);

  const def = touring ? ELEMENT_TOUR_DEFS[touring.kind] : null;
  const engine = useTourEngine<ElementTourApi>({
    steps,
    apiRef,
    onStepView: (step) => {
      if (def) track('UI', 'View', elementTourStepTelemetryType(def, step.id));
    },
    onFinish: (outcome) => endTour(outcome),
  });
  const { active } = engine;
  const engineRef = useLatest(engine);

  const endTour = (outcome: TourOutcome) => {
    setSankeyTourFocus(null);
    setConceptTourPreview(null);
    // Done on the closing card puts away what the tour opened (the Sankey's Flows dialog); a Skip leaves the person
    // where they are.
    if (def && outcome === 'completed') def.onDone?.(apiRef.current);
    setTouring(null);
    debugLog('[element-tour] end', { outcome, kind: touring?.kind });
    if (def)
      track('UI', 'Ended', `${def.token}${outcome === 'completed' ? 'Completed' : 'Skipped'}`);
  };
  const endTourRef = useLatest(endTour);

  // One tour at a time: publish this one while it runs, and offer nothing while any tour is on screen.
  const shown = useActiveTour();
  useEffect(() => {
    setActiveTour('element', active);
  }, [active]);

  // Answers the offer for good: onto the freshest preferences, not this render's, since the whole blob is written.
  const answer = (k: ElementTourKind) => {
    const next = rebaseUserPreferences(
      ctx.userPreferences,
      markElementTourSeen(ctx.userPreferences ?? {}, k),
    );
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
  };

  const activeTabRef = useLatest(ctx.activeTab);
  const play = (el: Element, k: ElementTourKind) => {
    const d = ELEMENT_TOUR_DEFS[k];
    answer(k);
    track('UI', 'Started', d.token);
    debugLog('[element-tour] play', { kind: k });
    setSteps(
      d.steps(el, {
        hasMore: document.getElementById('selection-more-actions') !== null,
        touch,
        elements: activeTabRef.current.elements,
      }),
    );
    setTouring({ id: el.id, kind: k });
    engineRef.current.start();
  };
  const dismiss = (k: ElementTourKind) => {
    answer(k);
    debugLog('[element-tour] cancel', { kind: k });
    track('UI', 'Closed', `${ELEMENT_TOUR_DEFS[k].token}Offer`);
  };
  const playRef = useLatest(play);
  const dismissRef = useLatest(dismiss);

  const startPanelOpen = useStartPanelOpen();
  // Dialogs come first (docs/specs/007-editor/editor-tour.md): the offer goes while one is open and comes back after.
  const modalOpen = useAnyModalOpen();
  const usable =
    ctx.hydrated &&
    // The synced preferences are in, so an answer given on another device holds here too.
    ctx.prefsSettled &&
    !startPanelOpen &&
    !ctx.anyWelcomeOpen &&
    !ctx.embedMode;
  const offered =
    usable &&
    !phone &&
    !active &&
    shown === null &&
    !modalOpen &&
    element !== null &&
    kind !== null &&
    canTourElement(ctx.can, element, kind) &&
    !elementTourSeen(ctx.userPreferences, kind);

  // The offer, one object per element offered, so the toolbar re-renders only when it comes or goes.
  const offerId = offered ? element.id : null;
  const offer = useMemo<ElementTourOffer | null>(
    () =>
      offerId && kind
        ? {
            elementId: offerId,
            kind,
            play: () => {
              const el = activeTabRef.current.elements.find((e) => e.id === offerId);
              if (el) playRef.current(el, kind);
            },
            dismiss: () => dismissRef.current(kind),
          }
        : null,
    [offerId, kind, playRef, dismissRef, activeTabRef],
  );
  useEffect(() => {
    setElementTourOffer(offer);
  }, [offer]);
  useEffect(() => () => setElementTourOffer(null), []);

  // The offer's first showing in this page load, per kind.
  const offeredKinds = useRef(new Set<ElementTourKind>());
  useEffect(() => {
    if (!offer || offeredKinds.current.has(offer.kind)) return;
    offeredKinds.current.add(offer.kind);
    track('UI', 'Opened', `${ELEMENT_TOUR_DEFS[offer.kind].token}Offer`);
  }, [offer]);

  // Ends as skipped when the tour can no longer run on its element: deleted, no longer editable, or another tab.
  const touredElement = touring
    ? ctx.activeTab.elements.find((e) => e.id === touring.id)
    : undefined;
  const stillTourable =
    !!touring && !!touredElement && canTourElement(ctx.can, touredElement, touring.kind);
  const tabId = ctx.activeTab.id;
  const startedOnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active) {
      startedOnRef.current = null;
      return;
    }
    startedOnRef.current ??= tabId;
    if (!stillTourable || startedOnRef.current !== tabId) {
      engineRef.current.stop();
      endTourRef.current('skipped');
    }
  }, [active, stillTourable, tabId, engineRef, endTourRef]);

  useEffect(
    () => () => {
      setActiveTour('element', false);
      setSankeyTourFocus(null);
      setConceptTourPreview(null);
    },
    [],
  );

  return (
    <TourStage
      engine={engine}
      // The page waits while a step is up, as on the Diagram tour: a press on what a step opened closed it.
      blockInput
      ariaPrefix={def?.eyebrow ?? 'Element tour'}
      copy={
        def
          ? {
              outroEyebrow: def.eyebrow,
              helpHref: helpArticleHref(def.helpArticle),
              finish: 'Done',
            }
          : undefined
      }
    />
  );
}
