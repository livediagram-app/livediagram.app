'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ShapeElement } from '@livediagram/document';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useSelectionOf } from '@/hooks/canvas/useSelectionStore';
import { useCoarsePointer } from '@/hooks/ui/useCoarsePointer';
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
import { sankeyFlowsDialog } from '@/lib/sankey-flows-dialog-handle';
import { setSankeyTourFocus } from '@/lib/sankey-tour-focus';
import type { Selection } from '@/lib/selection-store';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { useStartPanelOpen } from '@/components/start/start-panel-open';
import {
  sankeyElementTourSteps,
  sankeyFlowsContextOf,
  sankeyTourParts,
  sankeyTourStepTelemetryType,
  type SankeyElementTourApi,
} from './sankey-element-tour-steps';
import { TourStage } from './TourStage';
import type { TourStepOf } from './tour-step';
import { useTourEngine, type TourOutcome } from './useTourEngine';

// The one selected element, or null for none or a multi-selection.
const singleOf = (s: Selection) => (s.multiSelectedIds.size > 0 ? null : s.selectedId);

const COPY = {
  outroEyebrow: 'Sankey tour',
  helpHref: helpArticleHref('sankeyDiagram'),
  helpLabel: 'Sankey Diagram Help',
  finish: 'Done',
};

// Element tours (docs/specs/007-editor/element-tours.md): decides whether the selected element is offered its tour,
// publishes the offer for the selection toolbar to draw, and runs the tour when Play is pressed. Mounted once in
// EditorView beside the other tour hosts. Today the one toured kind is the Sankey diagram.
export function ElementTourHost() {
  const ctx = useEditorContext();
  const selectedId = useSelectionOf(singleOf);
  const touch = useCoarsePointer();
  const element = useMemo(
    () => (selectedId ? (ctx.activeTab.elements.find((e) => e.id === selectedId) ?? null) : null),
    [ctx.activeTab.elements, selectedId],
  );
  const kind = elementTourKindOf(element);

  // The tour's steps, fixed when Play is pressed; the element it runs on.
  const [steps, setSteps] = useState<TourStepOf<SankeyElementTourApi>[]>([]);
  const [touring, setTouring] = useState<{ id: string; kind: ElementTourKind } | null>(null);
  const touringRef = useLatest(touring);

  const api: SankeyElementTourApi = {
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
  };
  const apiRef = useLatest(api);

  const engine = useTourEngine<SankeyElementTourApi>({
    steps,
    apiRef,
    onStepView: (step) => track('UI', 'View', sankeyTourStepTelemetryType(step.id)),
    onFinish: (outcome) => endTour(outcome),
  });
  const { active } = engine;
  const engineRef = useLatest(engine);

  const endTour = (outcome: TourOutcome) => {
    setSankeyTourFocus(null);
    // Done on the closing card puts the Flows dialog away with the tour; a Skip leaves the person where they are.
    if (outcome === 'completed') sankeyFlowsDialog.close();
    setTouring(null);
    debugLog('[element-tour] end', { outcome });
    track('UI', 'Ended', outcome === 'completed' ? 'SankeyTourCompleted' : 'SankeyTourSkipped');
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

  const play = (el: ShapeElement, k: ElementTourKind) => {
    answer(k);
    track('UI', 'Started', 'SankeyTour');
    debugLog('[element-tour] play', { kind: k });
    setSteps(
      sankeyElementTourSteps({
        elementId: el.id,
        ...sankeyTourParts(el),
        hasMore: document.getElementById('selection-more-actions') !== null,
        touch,
        flows: sankeyFlowsContextOf(el),
      }),
    );
    setTouring({ id: el.id, kind: k });
    engineRef.current.start();
  };
  const dismiss = (k: ElementTourKind) => {
    answer(k);
    debugLog('[element-tour] cancel', { kind: k });
    track('UI', 'Closed', 'SankeyTourOffer');
  };
  const playRef = useLatest(play);
  const dismissRef = useLatest(dismiss);

  const startPanelOpen = useStartPanelOpen();
  const usable =
    ctx.hydrated &&
    // The synced preferences are in, so an answer given on another device holds here too.
    ctx.prefsSettled &&
    !startPanelOpen &&
    !ctx.anyWelcomeOpen &&
    !ctx.embedMode;
  const offered =
    usable &&
    !active &&
    shown === null &&
    element !== null &&
    kind !== null &&
    canTourElement(ctx.can, element, kind) &&
    !elementTourSeen(ctx.userPreferences, kind);

  // The offer, one object per element offered, so the toolbar re-renders only when it comes or goes.
  const offerId = offered ? element.id : null;
  const activeTabRef = useLatest(ctx.activeTab);
  const offer = useMemo<ElementTourOffer | null>(
    () =>
      offerId && kind
        ? {
            elementId: offerId,
            kind,
            play: () => {
              const el = activeTabRef.current.elements.find((e) => e.id === offerId);
              if (el?.type === 'shape') playRef.current(el, kind);
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
    track('UI', 'Opened', 'SankeyTourOffer');
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
    },
    [],
  );

  return <TourStage engine={engine} ariaPrefix="Sankey tour" copy={COPY} />;
}
