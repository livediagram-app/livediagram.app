'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Element } from '@livedocuments/document';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useSelectionOf } from '@/hooks/canvas/useSelectionStore';
import { useCoarsePointer } from '@liveworkspace/workbench/hooks/ui/useCoarsePointer';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import {
  canTourElement,
  elementTourKindOf,
  markElementTourSeen,
  type ElementTourKind,
} from '@/lib/element-tours';
import { helpArticleHref } from '@/lib/help-articles';
import { setConceptTourPreview } from '@liveworkspace/workbench/lib/concept-tour-preview';
import { chartDataDialog } from '@liveworkspace/workbench/lib/chart-data-dialog-handle';
import { sankeyFlowsDialog } from '@/lib/sankey-flows-dialog-handle';
import { setSankeyTourFocus } from '@liveworkspace/workbench/lib/sankey-tour-focus';
import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { useStartPanelOpen } from '@/components/start/start-panel-open';
import type { ElementTourApi } from './element-tour-api';
import { CONTEXT_MENU } from './element-menu-tour';
import { waitForSelector } from '@liveworkspace/workbench/components/tour/tour-dom';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';
import { ELEMENT_TOUR_DEFS, elementTourStepTelemetryType } from './element-tour-defs';
import { TourStage } from './TourStage';
import type { TourStepOf } from '@liveworkspace/workbench/components/tour/tour-step';
import {
  useTourEngine,
  type TourOutcome,
} from '@liveworkspace/workbench/components/tour/useTourEngine';
import {
  TOUR_OFFER_RANK,
  tourNameOf,
  useOfferTour,
} from '@liveworkspace/workbench/components/tour/tour-offer';

// The one selected element, or null for none or a multi-selection.
const singleOf = (s: Selection) => (s.multiSelectedIds.size > 0 ? null : s.selectedId);

// Element tours (docs/specs/007-editor/element-tours.md): decides whether the selected element is offered its tour,
// offers it on the footer's Start Tour button ("Start Sankey Tour", ahead of the mode's own tour), and runs the tour
// when the button is pressed. It never starts or prompts on its own. Mounted once in
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

  // One tour at a time: publish this one while it runs, and start nothing while any tour is on screen.
  const shown = useActiveTour();
  useEffect(() => {
    setActiveTour('element', active);
  }, [active]);

  // Records the kind as taken (Settings › Tours): onto the freshest preferences, not this render's, since the whole blob
  // is written.
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
  const playRef = useLatest(play);

  const startPanelOpen = useStartPanelOpen();
  const usable = ctx.hydrated && !startPanelOpen && !ctx.anyWelcomeOpen && !ctx.embedMode;
  const offered =
    usable && !phone && element !== null && kind !== null && canTourElement(ctx.can, element, kind);

  // The footer's Start Tour button, while the selected element is one with a tour, taken or not. One offer per kind, so
  // the button counts each kind's first showing in this page load.
  const offerId = offered ? element.id : null;
  const offerKind = offered ? kind : null;
  useOfferTour(
    offerKind ? `element-${offerKind}` : 'element',
    offerId && offerKind
      ? {
          name: tourNameOf(ELEMENT_TOUR_DEFS[offerKind].eyebrow),
          rank: TOUR_OFFER_RANK.element,
          start: () => {
            if (shown !== null) return;
            const el = activeTabRef.current.elements.find((e) => e.id === offerId);
            if (el) playRef.current(el, offerKind);
          },
          onShown: () => track('UI', 'Opened', `${ELEMENT_TOUR_DEFS[offerKind].token}Offer`),
        }
      : null,
  );

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
