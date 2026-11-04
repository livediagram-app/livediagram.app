'use client';

// The Plan Overview (docs/specs/026-plan/plan-overview.md): the plan's own page, drawn over the canvas area in the
// canvas's place while it is open. Loaded only when first opened (EditorView's dynamic import). Reads the editor's
// context and hands OverviewView plain data and actions.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ITEM_TYPES_MAX, newItemId } from '@liveplanner/items';
import { CANVAS_ROOT_SELECTOR } from '@liveworkspace/workbench/lib/canvas-selectors';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useSelectTab } from '@/app/project/[id]/useSelectTab';
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import { useToast } from '@/hooks/ui/useToast';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useRelativeNow } from '@/lib/relative-time';
import { datesLine } from './overview-dates';
import type { Tab } from '@liveplanner/project';
import type { TabTileSummary } from './overview-tabs';
import { TabPreview } from './TabPreview';
import { OverviewView, type OverviewActions } from './OverviewView';
import { useOverviewModel } from './useOverviewModel';
import { useOverviewEdits } from './useOverviewEdits';
import { overviewLookOf, pickStyle } from './overview-look';
import type { OverviewStyle } from '@liveplanner/api-schema';
import { overviewSurfaceOf } from './overview-style';
import { OverviewStyleDialog } from './OverviewStyleDialog';
import { requestStartCategory } from '@/components/plan/start/start-request';
import { addCardOfType } from './overview-add-card';

const NO_FAILURES: ReadonlySet<string> = new Set();
const NO_TABS: readonly Tab[] = [];

// What the page shows, read from the editor's context and handed to OverviewView as plain data and actions.
function OverviewContent() {
  const ctx = useEditorContext();
  const plan = ctx.plan.context;
  const selectTab = useSelectTab();
  const toast = useToast();
  const now = useRelativeNow();

  // Every tab not yet loaded is asked for once, so its tile can draw (as Search does).
  // The tabs that could not be fetched show Couldn't load preview on their tiles.
  const { loadAllTabs } = ctx;
  const asked = useRef(false);
  const [failed, setFailed] = useState<ReadonlySet<string>>(NO_FAILURES);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void loadAllTabs().then((ids) => {
      if (ids.length > 0) setFailed(new Set(ids));
    });
  }, [loadAllTabs]);

  const model = useOverviewModel({
    tabs: ctx.tabs,
    items: plan.items,
    types: plan.types,
    statusNames: plan.statusNames,
    loadedTabIds: ctx.loadedTabIds,
    owner: ctx.projectOwnerId
      ? {
          id: ctx.projectOwnerId,
          name: ctx.projectOwnerName ?? '',
          color: ctx.projectOwnerColor ?? '#64748b',
        }
      : null,
    participantsByTab: ctx.participantsByTab,
    createdAt: ctx.projectDetails.createdAt,
  });

  // Each tile's preview, from the tab itself: a still picture redrawn only when what it shows changes.
  const tabs = ctx.tabs;
  const tabsById = useMemo(() => new Map(tabs.map((t) => [t.id, t] as const)), [tabs]);
  const preview = useCallback(
    (tile: TabTileSummary) => {
      const tab = tabsById.get(tile.id);
      return tab ? (
        <TabPreview
          tab={tab}
          // Only a Dashboard reads the other tabs, so no other preview redraws when one changes.
          tabs={tab.kind === 'dashboard' ? tabs : NO_TABS}
          state={tile.state}
          failed={failed.has(tile.id)}
        />
      ) : null;
    },
    [tabsById, tabs, failed],
  );

  const details = ctx.projectDetails;
  const editedAt = Math.max(details.savedAt, ctx.savedAt ?? 0, model.lastCardChange);
  const dates = datesLine({
    createdAt: details.createdAt,
    ownerName: ctx.projectOwnerName,
    editedAt,
    now,
  });

  const canEdit = ctx.can.level === 'edit';
  const may = {
    editPlan: canEdit,
    addTab: canEdit && !ctx.isStructureReadOnly,
    editTypes: canEdit && plan.canEdit,
    addType: plan.types.length < ITEM_TYPES_MAX,
  };

  // The Overview's style (plan-overview.md "Style"): its own, else its first tab's, resolved once per change of it.
  const firstTab = tabs[0];
  const { appearance } = useAppearance();
  // The first tab's style fields only, as a key, so a change on its canvas never resolves the look again.
  const firstStyleKey = firstTab ? JSON.stringify(pickStyle(firstTab)) : '';
  const look = useMemo(
    () =>
      overviewLookOf(
        details.overviewStyle,
        firstStyleKey ? (JSON.parse(firstStyleKey) as OverviewStyle) : undefined,
      ),
    [details.overviewStyle, firstStyleKey],
  );
  const surface = useMemo(() => overviewSurfaceOf(look, appearance), [look, appearance]);

  // The only ways the Overview writes the plan's name, description (edited in place in its header) and style: each one
  // step in the editor's undo.
  const { projectName, projectId, sessionShareCode } = ctx;
  const edits = useOverviewEdits({
    projectId,
    ownerId: ctx.selfParticipant.id,
    shareCode: sessionShareCode,
    projectName,
    nameProject: ctx.nameProject,
    details,
    setProjectDetails: ctx.setProjectDetails,
    look,
    pushUndo: ctx.pushUndo,
    toastError: (message) => toast.error(message),
  });

  const actions: OverviewActions = {
    openTab: selectTab,
    // Adds a tab and opens it on Start Planning, which closes the Overview.
    addTab: (start) => {
      if (start) requestStartCategory(start);
      ctx.addTab();
    },
    editType: (id) => plan.editType({ id }),
    addField: (id) => plan.editType({ id, addField: true }),
    // A card of the type on the first board that takes it, as its header chip adds one, then opened to be named.
    addCard: (typeId) => {
      const card = addCardOfType(ctx.tabs, plan.items, plan.types, typeId, plan.statusNames);
      if (!card) return;
      const id = newItemId();
      void plan.addItem({
        id,
        type: card.type,
        fields: card.fields,
        status: card.status,
        after: card.after,
      });
      plan.openNewItem(id);
      plan.announce(`${card.label} added to ${card.columnName}`);
    },
    addTypeToBoard: (typeId, boardElementId) => ctx.plan.addTypeToBoard(boardElementId, typeId),
    addType: () => plan.editType('new'),
    openCard: (id) => plan.openItem(id),
    rename: edits.rename,
    describe: edits.describe,
  };

  // Overview Style, opened from the dock's Style (the tab Style's own open state, which the tab's panel gives way to
  // while the Overview is open): an Editor's only.
  const { canvasThemeTab, setCanvasThemeTab } = ctx;
  return (
    <>
      {canEdit && canvasThemeTab !== null ? (
        <OverviewStyleDialog
          look={look}
          tab={canvasThemeTab}
          onTabChange={setCanvasThemeTab}
          onChange={edits.restyle}
          onClose={() => setCanvasThemeTab(null)}
        />
      ) : null}
      <OverviewView
        name={projectName}
        description={details.description}
        dates={dates}
        datesTitle={editedAt > 0 ? new Date(editedAt).toLocaleString() : undefined}
        model={model}
        preview={preview}
        now={now}
        may={may}
        actions={actions}
        surface={surface}
      />
    </>
  );
}

// The Overview's page (docs/specs/026-plan/plan-overview.md): portalled over the canvas area in its place. Everything
// it draws runs inside the cover's own boundary, so a fault anywhere in it (its derivations included) shows on the
// Overview, never the canvas and its tab underneath with a notice at the foot of the editor.
export function OverviewPage() {
  // The canvas `main` the page covers: found by its marker once mounted, as a Dashboard's page does.
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);
  const mark = useCallback((node: HTMLElement | null) => {
    if (node) setCanvas(document.querySelector<HTMLElement>(CANVAS_ROOT_SELECTOR));
  }, []);
  return (
    <>
      <span hidden ref={mark} />
      {canvas
        ? createPortal(
            // Over the canvas and the chrome laid on it (panels, toolbars), under the editor's modals.
            <div
              data-canvas-cover=""
              className="absolute inset-0 z-[var(--z-chrome)] cursor-default"
              onPointerDown={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.stopPropagation()}
            >
              <AreaErrorBoundary
                area="Overview"
                fallback="panel"
                fallbackClassName="h-full bg-slate-50 dark:bg-slate-950"
              >
                <OverviewContent />
              </AreaErrorBoundary>
            </div>,
            canvas,
          )
        : null}
    </>
  );
}
