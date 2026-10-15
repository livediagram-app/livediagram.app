'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Element } from '@livediagram/document';
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
import { setConceptTourPreview } from '@/lib/concept-tour-preview';
import { sankeyFlowsDialog } from '@/lib/sankey-flows-dialog-handle';
import { sequenceDialog } from '@/lib/sequence-dialog-handle';
import { setSankeyTourFocus } from '@/lib/sankey-tour-focus';
import type { Selection } from '@/lib/selection-store';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { useStartPanelOpen } from '@/components/start/start-panel-open';
import type { ElementTourApi } from './element-tour-api';
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
    previewConcept: (anim) => {
      const id = touringRef.current?.id;
      if (id) setConceptTourPreview({ elementId: id, anim, run: Date.now() });
    },
    showStageBar: (index) => {
      const id = touringRef.current?.id;
      if (id) setConceptTourPreview({ elementId: id, bar: index, run: Date.now() });
    },
    clearPreview: () => setConceptTourPreview(null),
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
      ariaPrefix={def?.eyebrow ?? 'Element tour'}
      copy={
        def
          ? {
              outroEyebrow: def.eyebrow,
              helpHref: helpArticleHref(def.helpArticle),
              helpLabel: def.helpLabel,
              finish: 'Done',
            }
          : undefined
      }
    />
  );
}
