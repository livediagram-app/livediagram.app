// Binds the contextual command catalogue (lib/editor-commands.ts) to the live
// editor so the SearchPanel can surface a power-user action palette (docs/specs/008-canvas/canvas-and-palette.md
// "Search panel"). Reads the editor's existing action handlers off
// EditorContext, returns the searchable `commandItems` the
// panel matches against plus a `runCommand` dispatcher.
//
// Each handler delegates to the SAME editor action the context menu / toolbar
// / header uses (so behaviour + telemetry can't drift); view-only sessions
// get the view-safe subset only (zen / export / collaborators, docs/specs/007-editor/command-palette.md), with every
// mutating command withheld inside the pure builder.

import { useCallback, useMemo } from 'react';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useIsOfflineProject } from '@/hooks/persistence/useIsOfflineProject';
import {
  buildEditorCommands,
  type CommandContext,
  type CommandHandlers,
} from '@/lib/editor-commands';
import type { CommandSearchItem } from '@/lib/search';
import { track } from '@/lib/telemetry';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

// What the catalogue is built with: which commands exist, and their words, depend on the context
// alone, never on the handlers, so the searchable list needs none.
const noop = () => {};
const INERT_HANDLERS: CommandHandlers = {
  createTab: noop,
  renameProject: noop,
  deleteProject: noop,
  renameTab: noop,
  openTheme: noop,
  openShare: noop,
  openCollaborators: noop,
  undo: noop,
  redo: noop,
  toggleZen: noop,
  openExport: noop,
  openImport: noop,
  openTrackerImport: noop,
  openSettings: noop,
  openShortcuts: noop,
};

export function useEditorCommands(): {
  // Undefined (not []) when there are no commands, so the SearchPanel can omit
  // the prop the same way it omits palette items for read-only sessions.
  commandItems: CommandSearchItem[] | undefined;
  runCommand: (id: string) => void;
} {
  const ctx = useEditorContext();
  const {
    isReadOnly,
    canShareProject,
    projectId,
    addTab,
    deleteProject,
    setShareDialogOpen,
    setCanvasThemeTab,
    requestRenameProject,
    requestRenameTab,
    undo,
    redo,
    canUndo,
    canRedo,
    zenMode,
    toggleZenMode,
    setExportOpen,
    setExportScope,
    openImportOn,
    setSettingsOpen,
    openSettingsOn,
    workbenchMode,
  } = ctx;

  // Offline projects (docs/specs/006-project/offline-mode.md) have nothing on the server to share, so the
  // Share command is withheld the same way the header hides its button.
  const isOffline = useIsOfflineProject(projectId);

  // Read-only gating happens inside the pure builder (docs/specs/007-editor/command-palette.md): view-only
  // visitors keep the view-safe subset, editors get the full catalogue.
  const cmdCtx = useMemo<CommandContext>(
    () => ({
      isReadOnly,
      canUndo,
      canRedo,
      zenMode,
      canShare: canShareProject,
      isOffline,
      workbench: workbenchMode,
    }),
    [isReadOnly, canUndo, canRedo, zenMode, canShareProject, isOffline, workbenchMode],
  );

  // Each handler is the editor's own action for that verb, as it is at the moment a command runs.
  const handlers: CommandHandlers = {
    createTab: addTab,
    renameProject: requestRenameProject,
    // deleteProject confirms internally and (for the current project)
    // redirects to /explorer; it needs the project's own id.
    deleteProject: () => {
      if (projectId) void deleteProject(projectId);
    },
    renameTab: requestRenameTab,
    // Replicate the telemetry the menu/header entry points fire, since the
    // setters themselves don't track.
    openTheme: () => {
      setCanvasThemeTab('theme');
      track('UI', 'Opened', 'ThemePicker');
    },
    openShare: () => {
      setShareDialogOpen(true);
      track('UI', 'Opened', 'Share');
    },
    // No focusId: search is "show me everyone", not "show me this person",
    // which is what the presence-stack entry point passes. The opener tracks
    // its own UI·Opened·Collaborators, so this adds none.
    openCollaborators: () => ctx.openCollaborators(null),
    // The remaining handlers track internally (undo/redo, zen) or have untracked entry points everywhere
    // (export / import), so no extra telemetry here.
    undo,
    redo,
    toggleZen: toggleZenMode,
    openExport: () => {
      setExportScope('tab');
      setExportOpen(true);
    },
    openImport: () => openImportOn('file'),
    openTrackerImport: () => openImportOn('tracker'),
    openSettings: () => {
      setSettingsOpen(true);
      track('UI', 'Opened', 'Settings');
    },
    openShortcuts: () => {
      openSettingsOn('keyboard');
      track('UI', 'Opened', 'Shortcuts');
    },
  };

  // The searchable catalogue changes only with the gating inputs.
  const commandItems = useMemo(() => {
    const commands = buildEditorCommands(cmdCtx, INERT_HANDLERS);
    return commands.length
      ? commands.map(({ id, name, keywords }) => ({ id, name, keywords }))
      : undefined;
  }, [cmdCtx]);

  // Running one builds the commands from the context and handlers as they are now.
  const liveCtx = useLatest(cmdCtx);
  const liveHandlers = useLatest(handlers);
  const runCommand = useCallback(
    (id: string) => {
      buildEditorCommands(liveCtx.current, liveHandlers.current)
        .find((c) => c.id === id)
        ?.run();
    },
    [liveCtx, liveHandlers],
  );

  return { commandItems, runCommand };
}
