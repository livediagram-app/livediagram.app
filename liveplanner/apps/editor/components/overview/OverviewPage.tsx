'use client';

// The Plan Overview (docs/specs/026-plan/plan-overview.md): the plan's own page, drawn over the canvas area in the
// canvas's place while it is open. Loaded only when first opened (EditorView's dynamic import). Reads the editor's
// context and hands OverviewView plain data and actions.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ITEM_TYPES_MAX } from '@liveplanner/items';
import { truncateName } from '@liveworkspace/model-core/names';
import { CANVAS_ROOT_SELECTOR } from '@liveworkspace/workbench/lib/canvas-selectors';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useSelectTab } from '@/app/project/[id]/useSelectTab';
import { useIsOfflineProject } from '@/hooks/persistence/useIsOfflineProject';
import { useToast } from '@/hooks/ui/useToast';
import { saveProjectDescription } from '@/lib/api/project-details';
import { useRelativeNow } from '@/lib/relative-time';
import { track } from '@/lib/telemetry';
import { EditDetailsDialog } from './EditDetailsDialog';
import { datesLine } from './overview-dates';
import { OverviewView, type OverviewActions } from './OverviewView';
import { useOverviewModel } from './useOverviewModel';

export function OverviewPage() {
  const ctx = useEditorContext();
  const plan = ctx.plan.context;
  const selectTab = useSelectTab();
  const toast = useToast();
  const isOffline = useIsOfflineProject(ctx.projectId);
  const now = useRelativeNow();
  const [editing, setEditing] = useState(false);

  // The canvas `main` the page covers: found by its marker once mounted, as a Dashboard's page does.
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);
  const mark = useCallback((node: HTMLElement | null) => {
    if (node) setCanvas(document.querySelector<HTMLElement>(CANVAS_ROOT_SELECTOR));
  }, []);

  // Every tab not yet loaded is asked for once, so its tile can draw (as Search does).
  const { loadAllTabs } = ctx;
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void loadAllTabs();
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
    editDetails: canEdit,
    addTab: canEdit && !ctx.isStructureReadOnly,
    editTypes: canEdit && plan.canEdit,
    addType: plan.types.length < ITEM_TYPES_MAX,
    share: ctx.canShareProject && !isOffline,
  };

  const { setProjectDetails, nameProject, projectName, projectId, sessionShareCode } = ctx;
  const ownerId = ctx.selfParticipant.id;
  const saveDetails = (next: { name: string; description: string }) => {
    setEditing(false);
    const name = truncateName(next.name);
    if (name && name !== projectName.trim()) {
      nameProject(name);
      track('Project', 'Renamed');
    }
    if (next.description.trim() === details.description || !projectId) return;
    const before = details.description;
    // Shown at once; put back if the write is refused.
    setProjectDetails((d) => ({ ...d, description: next.description.trim() }));
    saveProjectDescription(
      { ownerId, projectId, shareCode: sessionShareCode },
      next.description,
    ).then(
      (stored) => {
        setProjectDetails((d) => ({ ...d, description: stored }));
        track('Project', 'Changed', 'Description');
      },
      () => {
        setProjectDetails((d) => ({ ...d, description: before }));
        toast.error('Couldn’t save the description');
      },
    );
  };

  const actions: OverviewActions = {
    openTab: selectTab,
    // Adds a tab and opens it on Start Planning, which closes the Overview.
    addTab: () => ctx.addTab(),
    editType: (id) => plan.editType({ id }),
    addType: () => plan.editType('new'),
    openCard: (id) => plan.openItem(id),
    editDetails: () => setEditing(true),
    share: () => {
      ctx.setShareDialogOpen(true);
      track('UI', 'Opened', 'Share');
    },
  };

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
              <OverviewView
                name={projectName}
                description={details.description}
                dates={dates}
                datesTitle={editedAt > 0 ? new Date(editedAt).toLocaleString() : undefined}
                model={model}
                now={now}
                may={may}
                actions={actions}
              />
            </div>,
            canvas,
          )
        : null}
      {editing ? (
        <EditDetailsDialog
          name={projectName}
          description={details.description}
          onSave={saveDetails}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  );
}
