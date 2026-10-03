// Binds the contextual command catalogue (lib/editor-commands.ts) to the live
// editor so the SearchPanel can surface a power-user action palette (docs/specs/008-canvas/canvas-and-palette.md
// "Search panel"). Reads the selection + the editor's existing action
// handlers off EditorContext, returns the searchable `commandItems` the
// panel matches against plus a `runCommand` dispatcher.
//
// Each handler delegates to the SAME editor action the context menu / toolbar
// / header uses (so behaviour + telemetry can't drift); view-only sessions
// get the view-safe subset only (zen / fit / export, docs/specs/007-editor/command-palette.md), with every
// mutating command withheld inside the pure builder.

import { useCallback, useMemo } from 'react';
import { isBoxed } from '@livediagram/document';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import type { CanvasTool } from '@/components/palette/CommandPalette.types';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import {
  buildEditorCommands,
  type CommandContext,
  type CommandHandlers,
} from '@/lib/editor-commands';
import type { CommandSearchItem } from '@/lib/search';
import { track } from '@/lib/telemetry';
import { useLatest } from '@/hooks/ui/useLatest';

// What the catalogue is built with: which commands exist, and their words, depend on the context
// alone, never on the handlers, so the searchable list needs none.
const noop = () => {};
const INERT_HANDLERS: CommandHandlers = {
  deleteSelection: noop,
  duplicateSelection: noop,
  toggleLockSelection: noop,
  bringToFront: noop,
  sendToBack: noop,
  rotate: noop,
  clearAnimation: noop,
  setMarker: noop,
  addComment: noop,
  editNote: noop,
  createTab: noop,
  renameDocument: noop,
  deleteDocument: noop,
  renameTab: noop,
  openTheme: noop,
  openCanvasOptions: noop,
  openShare: noop,
  openCollaborators: noop,
  undo: noop,
  redo: noop,
  toggleZen: noop,
  fitToScreen: noop,
  autoLayout: noop,
  autoAlign: noop,
  openExport: noop,
  openImport: noop,
  openSettings: noop,
  openShortcuts: noop,
  openTemplates: noop,
  setTool: noop,
  openPhotoImport: noop,
};

export function useEditorCommands(): {
  // Undefined (not []) when there are no commands, so the SearchPanel can omit
  // the prop the same way it omits palette items for read-only sessions.
  commandItems: CommandSearchItem[] | undefined;
  runCommand: (id: string) => void;
} {
  const ctx = useEditorContext();
  // Draw mode (docs/specs/007-editor/editor-modes.md) has no format painter.
  const whiteboard = ctx.editorMode.mode === 'draw';
  const {
    isReadOnly,
    isOwner,
    documentId,
    selectedId,
    multiSelectedIds,
    activeTab,
    deleteSelected,
    deleteMultiSelected,
    duplicateSelected,
    duplicateMultiSelected,
    toggleLockSelected,
    toggleLockMultiSelected,
    sendSelectedToBack,
    bringSelectedToFront,
    setRotationSelected,
    setAnimationSelected,
    setArrowFlowSelected,
    setMarkerSelected,
    openComments,
    openNote,
    addTab,
    deleteDocument,
    setShareDialogOpen,
    setCanvasThemeTab,
    requestRenameDocument,
    requestRenameTab,
    undo,
    redo,
    canUndo,
    canRedo,
    zenMode,
    toggleZenMode,
    esBoard,
    photoImportAvailable,
    openPhotoImport,
    fitToScreen,
    autoLayoutTab,
    autoAlignTab,
    setExportOpen,
    setExportScope,
    setImportOpen,
    setSettingsOpen,
    openSettingsOn,
    openTemplatePicker,
    canvasTool,
    setCanvasTool,
  } = ctx;

  // Offline documents (docs/specs/006-document/offline-mode.md) have nothing on the server to share, so the
  // Share command is withheld the same way the header hides its button.
  const isOffline = useIsOfflineDocument(documentId);
  // Spotlight is desktop-only, so the tool commands need the same viewport
  // answer the palette's tool dropdown uses.
  const isMobile = useIsMobileViewport();

  const isMulti = multiSelectedIds.size > 0;
  const selectionCount = isMulti ? multiSelectedIds.size : selectedId ? 1 : 0;
  // The single selection's element (null for a multi- or empty selection), so
  // boxed-only / shape-only / animated gating can read its type + fields.
  const single =
    !isMulti && selectedId ? (activeTab.elements.find((e) => e.id === selectedId) ?? null) : null;
  const singleIsBoxed = single ? isBoxed(single) : false;
  const singleIsShape = single?.type === 'shape';
  const marker = single?.type === 'shape' ? (single.marker ?? null) : null;
  const hasAnimation = single
    ? single.type === 'arrow'
      ? !!single.flow
      : isBoxed(single) && !!single.animation
    : false;

  // Read-only gating happens inside the pure builder (docs/specs/007-editor/command-palette.md): view-only
  // visitors keep the view-safe subset, editors get the full catalogue.
  const canvasEmpty = activeTab.elements.length === 0;
  const cmdCtx = useMemo<CommandContext>(
    () => ({
      isReadOnly,
      canUndo,
      canRedo,
      zenMode,
      selectionCount,
      singleIsBoxed,
      singleIsShape,
      hasAnimation,
      marker,
      isOwner,
      isOffline,
      canvasTool,
      // Same emptiness test the palette's tool dropdown uses to disable the
      // content-dependent tools, so search can never offer a tool the palette
      // has greyed out.
      canvasEmpty,
      isMobile,
      esBoard,
      whiteboard,
      photoImportAvailable,
    }),
    [
      isReadOnly,
      canUndo,
      canRedo,
      zenMode,
      selectionCount,
      singleIsBoxed,
      singleIsShape,
      hasAnimation,
      marker,
      isOwner,
      isOffline,
      canvasTool,
      canvasEmpty,
      isMobile,
      esBoard,
      whiteboard,
      photoImportAvailable,
    ],
  );

  // Each handler is the editor's own action for that verb, as it is at the moment a command runs.
  const handlers: CommandHandlers = {
    deleteSelection: () => (isMulti ? deleteMultiSelected() : deleteSelected()),
    duplicateSelection: () => (isMulti ? duplicateMultiSelected() : duplicateSelected()),
    toggleLockSelection: () => (isMulti ? toggleLockMultiSelected() : toggleLockSelected()),
    // Layer-order handlers already act on the whole selection (single +
    // multi), so they need no per-mode branch.
    bringToFront: bringSelectedToFront,
    sendToBack: sendSelectedToBack,
    rotate: setRotationSelected,
    clearAnimation: () =>
      single?.type === 'arrow' ? setArrowFlowSelected(null) : setAnimationSelected(null),
    setMarker: setMarkerSelected,
    addComment: () => {
      if (selectedId) openComments(selectedId);
    },
    editNote: () => {
      if (selectedId) openNote(selectedId);
    },
    createTab: addTab,
    renameDocument: requestRenameDocument,
    // deleteDocument confirms internally and (for the current document)
    // redirects to /explorer; it needs the document's own id.
    deleteDocument: () => {
      if (documentId) void deleteDocument(documentId);
    },
    renameTab: requestRenameTab,
    // Replicate the telemetry the menu/header entry points fire, since the
    // setters themselves don't track.
    openTheme: () => {
      setCanvasThemeTab('theme');
      track('UI', 'Opened', 'ThemePicker');
    },
    openCanvasOptions: () => {
      setCanvasThemeTab('canvas');
      track('UI', 'Opened', 'CanvasStyle');
    },
    openShare: () => {
      setShareDialogOpen(true);
      track('UI', 'Opened', 'Share');
    },
    // No focusId: search is "show me everyone", not "show me this person",
    // which is what the presence-stack entry point passes. The opener tracks
    // its own UI·Opened·Collaborators, so this adds none.
    openCollaborators: () => ctx.openCollaborators(null),
    // The remaining handlers track internally (undo/redo, zen, fit,
    // auto layout/align) or have untracked entry points everywhere
    // (export / import / templates), so no extra telemetry here.
    undo,
    redo,
    toggleZen: toggleZenMode,
    openPhotoImport,
    fitToScreen,
    autoLayout: autoLayoutTab,
    autoAlign: autoAlignTab,
    openExport: () => {
      setExportScope('tab');
      setExportOpen(true);
    },
    openImport: () => setImportOpen(true),
    openSettings: () => {
      setSettingsOpen(true);
      track('UI', 'Opened', 'Settings');
    },
    openShortcuts: () => {
      openSettingsOn('keyboard');
      track('UI', 'Opened', 'Shortcuts');
    },
    openTemplates: openTemplatePicker,
    // The context's setter, not the raw one: it carries the pressed-state
    // and telemetry the dropdown's onChange relies on.
    setTool: (tool) => setCanvasTool(tool as CanvasTool),
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
