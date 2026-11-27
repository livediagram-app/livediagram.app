'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import type { SessionKindId } from '@liveplanner/items';
import { newSessionTab, readDashboard, readSessionTab } from '@liveplanner/project';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useSelectTab } from '@/app/project/[id]/useSelectTab';
import { useTemplatePickMove } from '@/components/start/useTemplatePickMove';
import { useIsOfflineProject } from '@/hooks/persistence/useIsOfflineProject';
import { BLANK_SHEET_CHOICE } from '@/lib/sheet-seeds';

// The empty-canvas card a Participant or Viewer sees on an empty tab (liveworkspace/docs/specs/011-workbench/
// first-edit.md): loaded only when one is shown, never on an Editor's first load.
const EmptyCanvasBanner = dynamic(
  () => import('@/components/canvas/EmptyCanvasBanner').then((m) => m.EmptyCanvasBanner),
  { ssr: false },
);

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

// A Session tab's page (docs/specs/026-plan/session-tabs.md "The page"): only a Session tab draws it.
const SessionPage = dynamic(
  () => import('@/components/session/SessionPage').then((m) => m.SessionPage),
  { ssr: false },
);
// A session kind's set-up (docs/specs/026-plan/session-tabs.md "Making one"), fetched only when chosen.
const SessionStartHost = dynamic(
  () => import('@/components/session/SessionStartHost').then((m) => m.SessionStartHost),
  { ssr: false },
);

// Describe a Plan's dialog (docs/specs/026-plan/describe-a-plan.md), fetched only when chosen.
const DescribePlanHost = dynamic(
  () =>
    import('@/components/plan/start/describe-plan/DescribePlanHost').then(
      (m) => m.DescribePlanHost,
    ),
  { ssr: false },
);

// Describe a Form's dialog (docs/specs/030-forms/describe-a-form.md), fetched only when chosen.
const DescribeFormHost = dynamic(
  () => import('@/components/forms/describe-form/DescribeFormHost').then((m) => m.DescribeFormHost),
  { ssr: false },
);

// What an empty or page-kind tab shows in the canvas's place: a Dashboard or Form tab's page, or an empty tab's Start
// Planning (docs/specs/026-plan/plan-mode.md "Starting a board"). Always mounted, so the template-pick note
// (useTemplatePickMove) keeps watching the tab.
export function EditorStartPanels() {
  const ctx = useEditorContext();
  const {
    hydrated,
    zenMode,
    embedMode,
    activeTab,
    isReadOnly,
    tabs,
    loadAllTabs,
    deleteTab,
    renameTab,
  } = ctx;
  const selectTab = useSelectTab();
  // Describe a Plan open over Start Planning; it stays while the board it made takes the tab, until it closes.
  const [describing, setDescribing] = useState(false);
  // Describe a Form open over Start Planning; it stays while the form it made takes the tab, until it closes.
  const [describingForm, setDescribingForm] = useState(false);
  // A session kind's set-up open over Start Planning (session-tabs.md "Making one"), or none.
  const [settingUpSession, setSettingUpSession] = useState<SessionKindId | null>(null);
  const isOffline = useIsOfflineProject(ctx.projectId);
  // A template picked from Start Planning on a plan /new just made goes to its default folder
  // (docs/specs/013-workspace/default-folders.md "A template picked after creation").
  const moveOnTemplatePick = useTemplatePickMove({
    projectId: ctx.projectId,
    tabId: activeTab.id,
    tabHasContent: activeTab.elements.length > 0,
  });
  // An empty tab: Start Planning, in the middle of the canvas, for someone who can edit. Anything already drawn (a
  // board, a shape, a view) hides it.
  const dashboardHasRows = (readDashboard(activeTab.dashboard)?.rows.length ?? 0) > 0;
  // Read once per change of the tab's session, so the page's queue is worked out only when it changes.
  const isSession = activeTab.kind === 'session';
  const session = useMemo(
    () => (isSession ? readSessionTab(activeTab.session) : null),
    [isSession, activeTab.session],
  );
  // A connected tab is empty but shows its own page, never a start (connected-tabs.md "How it looks").
  const tabEmpty =
    hydrated &&
    !ctx.activeTabConnected &&
    !zenMode &&
    !embedMode &&
    (activeTab.kind === 'dashboard'
      ? !dashboardHasRows
      : activeTab.kind === 'form'
        ? !activeTab.form
        : activeTab.kind === 'session'
          ? !session
          : activeTab.elements.length === 0);
  const showPlanBoardPicker = tabEmpty && !isReadOnly;
  // A Participant's or Viewer's empty tab: the empty-canvas card every editor shares (plan-mode.md "Starting a board").
  const showEmptyCard = tabEmpty && isReadOnly;
  // A Dashboard tab's page (docs/specs/026-plan/plan-tabs.md), for everyone who opens it; one with no rows left shows
  // Start Planning again, a new choice replacing it.
  // A warm open paints it before hydration too, its tiles drawn from what the last seen copy kept (offline-mode.md
  // "Warm open of a cloud project").
  const warmShown = !hydrated && ctx.warmTabId === activeTab.id;
  const showDashboard =
    (hydrated || warmShown) && activeTab.kind === 'dashboard' && dashboardHasRows;
  // A Form tab's page (docs/specs/030-forms/forms.md), for everyone who opens it.
  const showForm = hydrated && activeTab.kind === 'form' && !!activeTab.form;
  // A Session tab's page (docs/specs/026-plan/session-tabs.md), for everyone who opens it, once its cards are there.
  const showSession = hydrated && !!session && !!ctx.plan;
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
          standIns={ctx.warmRefTabs}
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
          // Share Form on a project kept Offline syncs it first (docs/specs/030-forms/forms.md), never as the
          // 'self' placeholder an early open runs under.
          onSyncToCloud={ctx.syncToCloud}
          syncReady={ctx.selfParticipant.id !== 'self'}
          tabScope={ctx.sessionTabScope}
        />
      ) : null}
      {showSession && session && ctx.plan ? (
        <SessionPage
          key={activeTab.id}
          tab={activeTab}
          session={session}
          plan={ctx.plan.context}
          // A locked tab's session reads as a Viewer's does (session-tabs.md "Share roles").
          mayEdit={ctx.can.level === 'edit' && !ctx.activeTabLocked}
          actions={ctx.sessions}
          self={{
            id: ctx.voteSelfId,
            name: ctx.selfParticipant.name,
            color: ctx.selfParticipant.color,
          }}
          presence={ctx.livePresence}
          renameTab={renameTab}
        />
      ) : null}
      {showEmptyCard ? (
        <EmptyCanvasBanner
          key={activeTab.id}
          tabId={activeTab.id}
          tabName={activeTab.name}
          participant={ctx.can.level === 'participate'}
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
          // A Session tab (session-tabs.md "Making one"): set up first, an Editor's as every choice here is.
          onSession={ctx.plan ? setSettingUpSession : undefined}
          // The one Import dialog, on its list (plan-tabs.md "The Import dialog"): an Editor's, as its tools are.
          onImport={ctx.trackerImport.canImport ? () => ctx.setImportOpen(true) : undefined}
          // Describe a Plan (describe-a-plan.md "Who may"): an Editor's, as Import is; a guest sees it with a nudge.
          onDescribe={
            ctx.trackerImport.canImport && ctx.plan ? () => setDescribing(true) : undefined
          }
          // Describe a Form (describe-a-form.md "Who may"): an Editor's, as Describe a Plan is.
          onDescribeForm={
            ctx.trackerImport.canImport && ctx.plan ? () => setDescribingForm(true) : undefined
          }
        />
      ) : null}
      {settingUpSession && ctx.plan ? (
        <SessionStartHost
          sessionKind={settingUpSession}
          plan={ctx.plan.context}
          onStart={(setup) => {
            ctx.sessions.startSession(newSessionTab(settingUpSession, setup));
            setSettingUpSession(null);
          }}
          onClose={() => setSettingUpSession(null)}
        />
      ) : null}
      {describing ? <DescribePlanHost onClose={() => setDescribing(false)} /> : null}
      {describingForm ? <DescribeFormHost onClose={() => setDescribingForm(false)} /> : null}
    </>
  );
}
