'use client';

import dynamic from 'next/dynamic';
import { readDashboard } from '@liveplanner/project';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useSelectTab } from '@/app/project/[id]/useSelectTab';
import { useTemplatePickMove } from '@/components/start/useTemplatePickMove';
import { useIsOfflineProject } from '@/hooks/persistence/useIsOfflineProject';
import { BLANK_SHEET_CHOICE } from '@/lib/sheet-seeds';

// Plan's UI loads only when it is drawn (docs/specs/026-plan/plan-mode.md "Cost").
const PlanBoardPicker = dynamic(
  () => import('@/components/plan/PlanBoardPicker').then((m) => m.PlanBoardPicker),
  { ssr: false },
);
// A Form tab's page (docs/specs/030-forms/forms.md), fetched only when one is opened.
const FormPage = dynamic(() => import('@/components/forms/FormPage').then((m) => m.FormPage), {
  ssr: false,
});
// A Dashboard tab's page (docs/specs/026-plan/plan-tabs.md "Dashboard tab"): only a Dashboard tab draws it.
const DashboardPage = dynamic(
  () => import('@/components/plan/dashboard/DashboardPage').then((m) => m.DashboardPage),
  { ssr: false },
);

// What an empty or page-kind tab shows in the canvas's place: a Dashboard or Form tab's page, or an empty tab's Start
// Planning (docs/specs/026-plan/plan-mode.md "Starting a board"). Always mounted, so the template-pick handoff
// (useTemplatePickMove) keeps watching the tab.
export function EditorStartPanels() {
  const ctx = useEditorContext();
  const {
    hydrated,
    zenMode,
    embedMode,
    activeTab,
    isReadOnly,
    accountUserId,
    tabs,
    loadAllTabs,
    deleteTab,
    renameTab,
  } = ctx;
  const selectTab = useSelectTab();
  const isOffline = useIsOfflineProject(ctx.projectId);
  // A template picked from Start Planning on a project /new just made goes to its default folder
  // (docs/specs/013-workspace/default-folders.md "A template picked after creation").
  const moveOnTemplatePick = useTemplatePickMove({
    ownerId: ctx.selfParticipant.id,
    projectId: ctx.projectId,
    tabId: activeTab.id,
    signedIn: !!accountUserId,
    tabHasContent: activeTab.elements.length > 0,
  });
  // An empty tab: Start Planning, in the middle of the canvas, for someone who can edit. Anything already drawn (a
  // board, a shape, a view) hides it.
  const dashboardHasRows = (readDashboard(activeTab.dashboard)?.rows.length ?? 0) > 0;
  const showPlanBoardPicker =
    hydrated &&
    !zenMode &&
    !embedMode &&
    !isReadOnly &&
    (activeTab.kind === 'dashboard'
      ? !dashboardHasRows
      : activeTab.kind === 'form'
        ? !activeTab.form
        : activeTab.elements.length === 0);
  // A Dashboard tab's page (docs/specs/026-plan/plan-tabs.md), for everyone who opens it; one with no rows left shows
  // Start Planning again, a new choice replacing it.
  const showDashboard = hydrated && activeTab.kind === 'dashboard' && dashboardHasRows;
  // A Form tab's page (docs/specs/030-forms/forms.md), for everyone who opens it.
  const showForm = hydrated && activeTab.kind === 'form' && !!activeTab.form;
  return (
    <>
      {showDashboard ? (
        <DashboardPage
          // One page per Dashboard: opening another draws it still (useSlotEnter).
          key={activeTab.id}
          tab={activeTab}
          tabs={tabs}
          // A locked tab's Dashboard reads as a Viewer's does (plan-tabs.md "Dashboard tab").
          canEdit={ctx.can.level === 'edit' && !ctx.activeTabLocked}
          actions={ctx.planTabs}
          openTab={selectTab}
          loadTabs={loadAllTabs}
          loadedTabIds={ctx.loadedTabIds}
          deleteTab={deleteTab}
          releaseSheets={ctx.releaseSheets}
          renameTab={renameTab}
        />
      ) : null}
      {showForm ? (
        <FormPage
          key={activeTab.id}
          tab={activeTab}
          tabs={tabs}
          // A locked tab's form reads as a Viewer's does.
          canEdit={ctx.can.level === 'edit' && !ctx.activeTabLocked}
          actions={ctx.forms}
          openTab={selectTab}
          loadTabs={loadAllTabs}
          projectId={ctx.projectId}
          ownerId={ctx.selfParticipant.id}
          share={ctx.sessionShareCode}
          online={!isOffline}
          // Share Form on a project in This Browser syncs it first (docs/specs/030-forms/forms.md), never as the
          // 'self' placeholder an early open runs under.
          onSyncToCloud={ctx.syncToCloud}
          syncReady={ctx.selfParticipant.id !== 'self'}
        />
      ) : null}
      {showPlanBoardPicker ? (
        <PlanBoardPicker
          // Each choice makes the tab its kind (docs/specs/026-plan/plan-tabs.md).
          onPick={(preset) => {
            const c = ctx.getViewportCenter();
            ctx.planTabs.startElementTab('board', () =>
              ctx.dropPaletteItem('plan-board', c.x, c.y, {
                choice: preset,
              }),
            );
          }}
          onPickSheet={(start) => {
            const c = ctx.getViewportCenter();
            ctx.planTabs.startElementTab('sheet', () =>
              ctx.dropPaletteItem(
                'plan-sheet',
                c.x,
                c.y,
                // Empty Sheet: a blank grid, with no Setup Sheet (plan-tabs.md "Names").
                { choice: start ?? BLANK_SHEET_CHOICE },
              ),
            );
          }}
          onDashboard={ctx.planTabs.startDashboard}
          onTemplate={(kind) => {
            void ctx.chooseTemplate(kind);
            moveOnTemplatePick(kind);
          }}
          tabs={tabs}
          loadTabs={loadAllTabs}
          onSuggestedDashboard={ctx.planTabs.startSuggestedDashboard}
          onVisualisation={ctx.planTabs.startVisualisationTab}
          onForm={ctx.forms.startForm}
        />
      ) : null}
    </>
  );
}
