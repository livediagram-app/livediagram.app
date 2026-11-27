'use client';

// The editor's side of Plan AI's host (plan-ai-host.ts): the open tab and the edit paths it changes through, from the
// editor's context and the plan's, and the person's role on the plan as the editor knows it (the api's grant has the
// last word). `latest` builds the host from the newest values when a turn's changes come back, so they are made on
// the tab as it is then, not as it was when the turn was sent.
import { useMemo } from 'react';
import { isPlanAiKind, type PlanAiKind, type PlanAiRole } from '@liveplanner/items';
import { tabKindOf } from '@liveplanner/project';
import type { useEditorContext } from '@/app/project/[id]/EditorContext';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { sheetRefusalMessage, sheetStoreOf } from '@/components/sheets/sheet-store-client';
import { dashboardOf } from '@/hooks/plan/usePlanTabActions';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { planAiTabOf, type PlanAiHostInput, type PlanAiTab } from './plan-ai-host';

type EditorContext = ReturnType<typeof useEditorContext>;

/** The person's role as the editor knows it: an Editor, a Participant (cards and cells), else a Viewer. */
export function planAiRoleOf(isReadOnly: boolean, canEditCards: boolean): PlanAiRole {
  if (!isReadOnly) return 'edit';
  return canEditCards ? 'participate' : 'view';
}

export function hostInputOf(
  ctx: EditorContext,
  plan: PlanContextValue | undefined,
): PlanAiHostInput {
  const bridge = ctx.sheetsBridge;
  return {
    tab: ctx.activeTab,
    tabs: ctx.tabs,
    projectId: ctx.projectId ?? '',
    board: plan
      ? {
          items: plan.items,
          types: plan.types,
          addItems: plan.addItems,
          moveItems: plan.moveItems,
          patchItems: plan.patchItems,
          trashItems: plan.trashItems,
        }
      : null,
    changeForm: ctx.forms.changeForm,
    renameForm: ctx.forms.renameForm,
    changeDashboard: (change) => void ctx.planTabs.changeDashboard(change, 'DashboardRow'),
    dashboardOf,
    sheets: bridge
      ? {
          workbook: (tabId) => sheetStoreOf(bridge).workbook(tabId),
          writeAll: (writes) => {
            const refused = sheetStoreOf(bridge).writeAll(writes);
            return refused ? sheetRefusalMessage(refused) : null;
          },
          commitElements: bridge.commitElements,
          locale: bridge.locale,
        }
      : null,
  };
}

export function usePlanAiHost(
  ctx: EditorContext,
  plan: PlanContextValue | undefined,
): { kind: PlanAiKind | null; role: PlanAiRole; latest: () => PlanAiTab | null } {
  const role = planAiRoleOf(ctx.isReadOnly, !!plan?.canEditCards);
  const newest = useLatest({ ctx, plan });
  // Only the kind on render: the tab is read, and its edit paths built, when a turn is sent.
  const tabKind = tabKindOf(ctx.activeTab);
  const kind = isPlanAiKind(tabKind) ? tabKind : null;
  const latest = useMemo(
    () => () => planAiTabOf(hostInputOf(newest.current.ctx, newest.current.plan)),
    [newest],
  );
  return { kind, role, latest };
}
