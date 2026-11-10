'use client';

import type { EditorSurface } from '@liveworkspace/workbench/lib/editor-surface';
import type { EditorLate } from './editor-state/editor-late';
import { buildEditorView } from './editor-state/editor-view';
import { useEditorEnv } from './editor-state/useEditorEnv';
import { useEditorSelection } from './editor-state/useEditorSelection';
import { useEditorProject } from './editor-state/useEditorProject';
import { useEditorDialogs } from './editor-state/useEditorDialogs';
import { useEditorCollaboration } from './editor-state/useEditorCollaboration';
import { useEditorPersistence } from './editor-state/useEditorPersistence';
import { useEditorPlanData } from './editor-state/useEditorPlanData';
import { useEditorViewport } from './editor-state/useEditorViewport';
import { useEditorComments } from './editor-state/useEditorComments';
import { useEditorEditing } from './editor-state/useEditorEditing';
import { useEditorPlan } from './editor-state/useEditorPlan';
import { useEditorTabs } from './editor-state/useEditorTabs';
import { useEditorTabTools } from './editor-state/useEditorTabTools';
import { useEditorStyle } from './editor-state/useEditorStyle';
import { useEditorInteraction } from './editor-state/useEditorInteraction';
import { useEditorShortcuts } from './editor-state/useEditorShortcuts';

// The editor's state, composed from its slices (editor-state/, docs/development/architecture.md "The editor's
// shape"). Each slice is one hook that takes the slices before it and hands back what the slices after it, and
// the view, read. They run in this order every render, which is the order their effects run in: keep it.
// EditorContext carries the view as `ReturnType<typeof useEditorState>`.
export function useEditorState(opts: { surface?: EditorSurface } = {}) {
  // Read later in a callback, from a slice composed after the one that reads it (editor-late.ts).
  const late: EditorLate = {
    activeLayerStampRef: () => editingSlice.activeLayerStampRef,
    revealChangesetRef: () => viewportSlice.revealChangesetRef,
    plan: () => planSlice.plan,
  };
  // Where the editor runs and who is signed in.
  const env = useEditorEnv(opts);
  // The active tab, the selection and the edit in progress.
  const selectionSlice = useEditorSelection(env);
  // The tabs and their undo timeline, the commit choke points, and the load state.
  const projectSlice = useEditorProject(env, selectionSlice, late);
  // Panels, dialogs, the canvas tool and the shortcuts switch.
  const dialogsSlice = useEditorDialogs(env);
  // Sharing and the session's role, comments, presence, preferences and the persistence state.
  const collaborationSlice = useEditorCollaboration(
    env,
    selectionSlice,
    projectSlice,
    dialogsSlice,
  );
  // Autosave, the load itself, the room's resync and agent changesets.
  const persistenceSlice = useEditorPersistence(
    env,
    selectionSlice,
    projectSlice,
    collaborationSlice,
    late,
  );
  // Cards, threads, card types and sheets, the room connection and the presence it carries.
  const planDataSlice = useEditorPlanData(
    env,
    selectionSlice,
    projectSlice,
    dialogsSlice,
    collaborationSlice,
    persistenceSlice,
  );
  // Pan, zoom, fitting, and arriving at a tab.
  const viewportSlice = useEditorViewport(
    selectionSlice,
    projectSlice,
    collaborationSlice,
    persistenceSlice,
    planDataSlice,
  );
  // Presence rows, comment and action rows, assigned actions and the join screen.
  const commentsSlice = useEditorComments(
    env,
    selectionSlice,
    projectSlice,
    collaborationSlice,
    planDataSlice,
  );
  // What may be edited now, the commit paths, style memory and layers.
  const editingSlice = useEditorEditing(
    selectionSlice,
    projectSlice,
    collaborationSlice,
    persistenceSlice,
    planDataSlice,
    viewportSlice,
    commentsSlice,
    late,
  );
  // Plan boards and cards, Form tabs and the Plan tour.
  const planSlice = useEditorPlan(
    env,
    selectionSlice,
    projectSlice,
    collaborationSlice,
    persistenceSlice,
    planDataSlice,
    viewportSlice,
    editingSlice,
  );
  // Undo and redo, placement, tab and project actions, and starting from a template.
  const tabsSlice = useEditorTabs(
    env,
    selectionSlice,
    projectSlice,
    collaborationSlice,
    planDataSlice,
    viewportSlice,
    editingSlice,
    planSlice,
  );
  // The tab's look, session tools, notes, element creation and the delete guards.
  const tabToolsSlice = useEditorTabTools(
    selectionSlice,
    projectSlice,
    dialogsSlice,
    collaborationSlice,
    persistenceSlice,
    planDataSlice,
    editingSlice,
    planSlice,
    tabsSlice,
  );
  // Selection actions, element style, portals and hover previews.
  const styleSlice = useEditorStyle(
    selectionSlice,
    projectSlice,
    collaborationSlice,
    persistenceSlice,
    planDataSlice,
    commentsSlice,
    editingSlice,
    tabsSlice,
    tabToolsSlice,
  );
  // Links, label editing, canvas accessibility, vote review, nudging and dragging.
  const interactionSlice = useEditorInteraction(
    selectionSlice,
    projectSlice,
    dialogsSlice,
    collaborationSlice,
    planDataSlice,
    viewportSlice,
    commentsSlice,
    editingSlice,
    planSlice,
    tabsSlice,
    tabToolsSlice,
  );
  // The clipboard, Zen mode, keyboard shortcuts, the workbench's messages and Focus.
  const shortcutsSlice = useEditorShortcuts(
    env,
    selectionSlice,
    projectSlice,
    dialogsSlice,
    collaborationSlice,
    persistenceSlice,
    planDataSlice,
    viewportSlice,
    editingSlice,
    planSlice,
    tabsSlice,
    styleSlice,
    interactionSlice,
  );
  return buildEditorView({
    env,
    selectionSlice,
    projectSlice,
    dialogsSlice,
    collaborationSlice,
    persistenceSlice,
    planDataSlice,
    viewportSlice,
    commentsSlice,
    editingSlice,
    planSlice,
    tabsSlice,
    tabToolsSlice,
    styleSlice,
    interactionSlice,
    shortcutsSlice,
  });
}
