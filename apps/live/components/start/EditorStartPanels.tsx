'use client';

import dynamic from 'next/dynamic';
import { illustratePagesOf, readDashboard, type EditorMode } from '@livediagram/document';
import type { TemplateKind } from '@livediagram/templates';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useSelectTab } from '@/app/document/[id]/useSelectTab';
import { EmptyCanvasBanner } from '@/components/canvas/EmptyCanvasBanner';
import { track } from '@/lib/telemetry';
import { showsEmptyCanvasCard } from '@/components/canvas/empty-canvas-card';
import { StartAgainTray } from '@/components/start/StartAgainTray';
import { StartViewTransition } from '@/components/start/StartViewTransition';
import { templateStartMode } from '@/components/start/template-start-mode';
import { useTemplatePickMove } from '@/components/start/useTemplatePickMove';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { BLANK_SHEET_CHOICE } from '@/lib/sheet-seeds';

// The template starts (docs/specs/007-editor/start-diagramming.md) carry every template's preview: loaded the first time
// an empty tab offers one, never on the editor's first load.
const StartFromTemplates = dynamic(
  () => import('@/components/start/StartFromTemplates').then((m) => m.StartFromTemplates),
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

// What an empty or page-kind tab shows in the canvas's place: a Dashboard or Form tab's page, an empty Plan tab's
// board picker, an editor's template start, or the empty-canvas card. Always mounted, so the template-pick handoff
// (useTemplatePickMove) keeps watching the tab.
export function EditorStartPanels() {
  const ctx = useEditorContext();
  const {
    hydrated,
    zenMode,
    embedMode,
    pendingDraw,
    activeTab,
    isReadOnly,
    clerkUserId,
    tabs,
    loadAllTabs,
    deleteTab,
    renameTab,
  } = ctx;
  const selectTab = useSelectTab();
  const isOffline = useIsOfflineDocument(ctx.documentId);
  // Empty-canvas hint (docs/specs/007-editor/new-document-route.md "The empty-canvas hint"): a card in the middle of
  // the canvas while the active tab has no elements. Not dismissible: it goes once there's content. The sign-in nudge
  // sits at the bottom, clear of it, so the two show together.
  const showEmptyCanvasBanner = showsEmptyCanvasCard({
    hydrated,
    zen: zenMode,
    embed: embedMode,
    drawToolArmed: !!pendingDraw,
    mode: ctx.editorMode.mode,
    elementCount: activeTab.elements.length,
  });
  // An editor's empty Diagram, Facilitate or Illustrate tab: its template start (docs/specs/007-editor/start-diagramming.md).
  // A template picked from a start screen on a document /new just made goes to its default folder
  // (docs/specs/013-workspace/default-folders.md "A template picked after creation").
  const moveOnTemplatePick = useTemplatePickMove({
    ownerId: ctx.selfParticipant.id,
    documentId: ctx.documentId,
    tabId: activeTab.id,
    signedIn: !!clerkUserId,
    tabHasContent: activeTab.elements.length > 0,
  });
  const templateStart = templateStartMode({
    hydrated,
    zen: zenMode,
    embed: embedMode,
    readOnly: isReadOnly,
    drawToolArmed: !!pendingDraw,
    mode: ctx.editorMode.mode,
    elementCount: activeTab.elements.length,
    // Read only for an empty Illustrate tab: EditorView renders often, and a tab with content shows no start.
    pages:
      ctx.editorMode.mode === 'illustrate' && activeTab.elements.length === 0
        ? illustratePagesOf(activeTab)
        : [],
  });
  // An empty Plan tab: the board types, in the middle of the canvas. Anything already drawn (a board, a shape, a
  // view) hides it; the palette's Boards still add one.
  const dashboardHasRows = (readDashboard(activeTab.dashboard)?.rows.length ?? 0) > 0;
  const showPlanBoardPicker =
    hydrated &&
    !zenMode &&
    !embedMode &&
    !isReadOnly &&
    ctx.editorMode.mode === 'plan' &&
    (activeTab.kind === 'dashboard'
      ? !dashboardHasRows
      : activeTab.kind === 'form'
        ? !activeTab.form
        : activeTab.elements.length === 0);
  // A Dashboard tab's page (docs/specs/026-plan/plan-tabs.md), for everyone who opens it; one with no rows left shows
  // Start Planning again, a new choice replacing it.
  const showDashboard = hydrated && activeTab.kind === 'dashboard' && dashboardHasRows;
  // A template a start's search found in another mode (docs/specs/007-editor/start-diagramming.md "Found in other
  // modes"): it lands as any pick does, and its mode comes with it (templateCanvasOverrides' opensIn), switching the
  // tab. A blank closes its mode's start first (closeStartForBlank), as a start's own blank does, so the tab opens on
  // the empty canvas asked for. Imported at the pick: the template catalogue it reads stays out of the editor's first
  // load (it is in the start's own chunk, already loaded behind the panel).
  const tabId = activeTab.id;
  const chooseFromOtherMode = (_mode: EditorMode, kind: TemplateKind) => {
    track('UI', 'Used', 'StartOtherMode');
    moveOnTemplatePick(kind);
    void import('@/components/start/close-start-for-blank').then(({ closeStartForBlank }) => {
      closeStartForBlank(tabId, kind);
      return ctx.chooseTemplate(kind);
    });
  };
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
          documentId={ctx.documentId}
          ownerId={ctx.selfParticipant.id}
          share={ctx.sessionShareCode}
          online={!isOffline}
          // Share Form on a document in This Browser syncs it first (docs/specs/030-forms/forms.md), never as the
          // 'self' placeholder an early open runs under.
          onSyncToCloud={ctx.syncToCloud}
          syncReady={ctx.selfParticipant.id !== 'self'}
        />
      ) : null}
      {/* One View Transition around every start, so a mode change turns the panel in place. */}
      <StartViewTransition>
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
            onOtherModeTemplate={chooseFromOtherMode}
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
        {/* Empty-canvas hint (docs/specs/007-editor/new-document-route.md): a calm card in the
      middle of an empty canvas, so a blank document reads as intentionally blank. */}
        {/* An editor's empty Diagram, Facilitate or Illustrate tab offers its template start, in
      the card's place (docs/specs/007-editor/start-diagramming.md). */}
        {templateStart ? (
          <>
            <StartFromTemplates
              key={`${activeTab.id}:${templateStart}`}
              mode={templateStart}
              tabId={activeTab.id}
              onTemplate={(kind) => {
                void ctx.chooseTemplate(kind);
                moveOnTemplatePick(kind);
              }}
              onOtherModeTemplate={chooseFromOtherMode}
            />
            {/* Closed, it can be brought back from the palette tray (StartAgainTray). */}
            <StartAgainTray
              key={`tray:${activeTab.id}:${templateStart}`}
              mode={templateStart}
              tabId={activeTab.id}
              tabName={activeTab.name}
            />
          </>
        ) : showEmptyCanvasBanner ? (
          <EmptyCanvasBanner
            key={activeTab.id}
            tabId={activeTab.id}
            tabName={activeTab.name}
            readOnly={isReadOnly}
            participant={ctx.can.addContent && isReadOnly}
          />
        ) : null}
      </StartViewTransition>
    </>
  );
}
