'use client';

// View As Diagram in the editor (docs/specs/026-plan/view-as-diagram.md): mounted inside the plan's provider, it opens
// the dialog for the Board tab whose menu asked, with the cards the editor already holds for its preview. Nothing for a
// session that may not draw (Offline, an embed, Community, a guest). The dialog's code loads on its first open.
import { lazy, Suspense, useEffect, useState } from 'react';
import { boardSetupsOfTab } from '@liveplanner/items';
import { useOptionalEditorContext } from '@/app/project/[id]/EditorContext';
import { useConnectHost } from '@/components/connect/useConnectHost';
import { usePlan } from '@/components/plan/PlanContext';
import { onViewAsDiagram } from './view-entry';

const ViewAsDiagramDialog = lazy(() =>
  import('./ViewAsDiagramDialog').then((m) => ({ default: m.ViewAsDiagramDialog })),
);

export function ViewAsDiagramHost({ enabled }: { enabled: boolean }) {
  const ctx = useOptionalEditorContext();
  const plan = usePlan();
  const connect = useConnectHost();
  const [tabId, setTabId] = useState<string | null>(null);
  const planId = enabled ? (ctx?.projectId ?? null) : null;

  useEffect(() => (planId ? onViewAsDiagram(setTabId) : undefined), [planId]);

  if (!planId || !tabId || !ctx || !plan) return null;
  const tab = ctx.tabs.find((t) => t.id === tabId);
  const boards = tab ? boardSetupsOfTab(tab.elements) : [];
  if (boards.length === 0) return null;
  return (
    <Suspense fallback={null}>
      <ViewAsDiagramDialog
        planId={planId}
        planTitle={ctx.projectName?.trim() || 'Untitled plan'}
        boards={boards}
        items={plan.items}
        types={plan.types}
        me={ctx.accountUserId ?? ''}
        connect={
          connect
            ? {
                grant: connect.grant,
                add: (made, newTabId) => connect.addConnectedTab(made, newTabId),
              }
            : null
        }
        onClose={() => setTabId(null)}
      />
    </Suspense>
  );
}
