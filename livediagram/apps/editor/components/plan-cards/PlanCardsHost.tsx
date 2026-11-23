'use client';

// Diagrams and Plans in the editor (docs/specs/013-workspace/make-plan-cards.md): mounted beside Send to Plan's host,
// it opens Make Plan Cards' preview when the selection toolbar or the tab menu asks, reading the tab's shapes once at
// that moment, and on a tab View As Diagram drew it gathers the drawing's offers for the plan (PlanChangesPill). The
// preview's code loads on its first open; a session that cannot send has neither.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { Element } from '@livediagram/document';
import {
  refElement,
  useAllSends,
} from '@liveworkspace/workbench/components/send-to-plan/send-store';
import { onMakePlanCards, type MakeAsk } from '@/lib/plan-cards/make-entry';
import { drawnPlanOf, planChangeOffers } from '@/lib/plan-cards/plan-changes';
import { readPlanShapes } from '@/lib/plan-cards/read-shapes';
import type { MakeShape, RemovedCard } from '@/lib/plan-cards/make-plan-rows';
import { setPlanChanges } from './PlanChangesPill';

const MakePlanCardsDialog = lazy(() =>
  import('./MakePlanCardsDialog').then((m) => ({ default: m.MakePlanCardsDialog })),
);

// The drawing settles before the offers are read again: a drag publishes many commits.
const OFFER_SETTLE_MS = 400;

export function PlanCardsHost({
  itemId,
  tabId,
  tabName,
  title,
  elements,
  enabled,
  canEdit,
}: {
  // The open diagram, null until it is live.
  itemId: string | null;
  tabId: string;
  tabName: string;
  title: string;
  // The tab shown.
  elements: readonly Element[];
  // canSendToPlan(...) for this session.
  enabled: boolean;
  // Whether this session may edit the diagram (the offers are an Editor's).
  canEdit: boolean;
}) {
  const live = enabled && itemId ? itemId : null;
  const [open, setOpen] = useState<{
    shapes: MakeShape[];
    removed: RemovedCard[];
    tabId: string;
    label: string;
  } | null>(null);
  const sends = useAllSends();
  // Read at the moment an entry asks, never on every render.
  const now = useRef({ elements, tabId, tabName, sends });
  now.current = { elements, tabId, tabName, sends };

  useEffect(
    () =>
      live
        ? onMakePlanCards((ask: MakeAsk) => {
            const { elements: els, tabId: tab, tabName: label, sends: all } = now.current;
            const shapes = readPlanShapes(els, {
              only: ask.only ? new Set(ask.only) : null,
              today: new Date(),
            });
            // A whole tab's make offers its gone shapes' cards; a selection's reads only what is picked.
            const here = new Set(els.map((e) => e.id));
            const removed: RemovedCard[] = ask.only
              ? []
              : all
                  .filter(
                    (s) =>
                      s.kind === 'element' &&
                      s.ref.split(':')[1] === tab &&
                      !here.has(refElement(s.ref)),
                  )
                  .map((send) => ({ send }));
            if (shapes.length === 0 && removed.length === 0) return;
            setOpen({ shapes, removed, tabId: tab, label });
          })
        : undefined,
    [live],
  );

  // The offers on a drawn tab, read once the drawing settles.
  const planId = useMemo(() => (live && canEdit ? drawnPlanOf(elements) : null), [live, canEdit, elements]);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [settled, setSettled] = useState(elements);
  useEffect(() => {
    if (!planId) return undefined;
    const t = setTimeout(() => setSettled(elements), OFFER_SETTLE_MS);
    return () => clearTimeout(t);
  }, [planId, elements]);
  useEffect(() => {
    if (!planId) {
      setPlanChanges(null);
      return undefined;
    }
    setPlanChanges({
      planId,
      offers: planChangeOffers(settled, dismissed),
      onDismiss: (key) => setDismissed((was) => new Set(was).add(key)),
    });
    return () => setPlanChanges(null);
  }, [planId, settled, dismissed]);

  if (!live || !open) return null;
  return (
    <Suspense fallback={null}>
      <MakePlanCardsDialog
        shapes={open.shapes}
        removed={open.removed}
        sends={sends}
        source={{ itemId: live, tabId: open.tabId, label: open.label.slice(0, 120) || 'Untitled' }}
        sourceTitle={title}
        onClose={() => setOpen(null)}
      />
    </Suspense>
  );
}
