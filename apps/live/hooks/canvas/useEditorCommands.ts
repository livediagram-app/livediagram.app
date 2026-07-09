// Binds the contextual command catalogue (lib/editor-commands.ts) to the live
// editor so the SearchPanel can surface a power-user action palette (spec/09
// "Search panel"). Reads the selection + the editor's existing action
// handlers off EditorContext, returns the searchable `commandItems` the
// panel matches against plus a `runCommand` dispatcher.
//
// Each handler delegates to the SAME editor action the context menu / toolbar
// / header uses (so behaviour + telemetry can't drift); view-only sessions
// get the view-safe subset only (zen / fit / export, spec/70), with every
// mutating command withheld inside the pure builder.

import { useCallback, useMemo } from 'react';
import { isBoxed } from '@livediagram/diagram';
import { useEditorContext } from '@/app/diagram/[id]/EditorContext';
import { useIsOfflineDiagram } from '@/hooks/persistence/useIsOfflineDiagram';
import { buildEditorCommands, type CommandContext } from '@/lib/editor-commands';
import type { CommandSearchItem } from '@/lib/search';
import { track } from '@/lib/telemetry';

export function useEditorCommands(): {
  // Undefined (not []) when there are no commands, so the SearchPanel can omit
  // the prop the same way it omits palette items for read-only sessions.
  commandItems: CommandSearchItem[] | undefined;
  runCommand: (id: string) => void;
} {
  const ctx = useEditorContext();
  const {
    isReadOnly,
    isOwner,
    diagramId,
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
    deleteDiagram,
    setShareDialogOpen,
    setCanvasThemeTab,
    requestRenameDiagram,
    requestRenameTab,
    undo,
    redo,
    canUndo,
    canRedo,
    zenMode,
    toggleZenMode,
    fitToScreen,
    autoLayoutTab,
    autoAlignTab,
    setExportOpen,
    setExportScope,
    setImportOpen,
    setSettingsOpen,
    setShortcutsOpen,
    openTemplatePicker,
  } = ctx;

  // Offline diagrams (spec/76) have nothing on the server to share, so the
  // Share command is withheld the same way the header hides its button.
  const isOffline = useIsOfflineDiagram(diagramId);

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

  const commands = useMemo(() => {
    // Read-only gating happens inside the pure builder (spec/70): view-only
    // visitors keep the view-safe subset, editors get the full catalogue.
    const cmdCtx: CommandContext = {
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
    };
    return buildEditorCommands(cmdCtx, {
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
      renameDiagram: requestRenameDiagram,
      // deleteDiagram confirms internally and (for the current diagram)
      // redirects to /explorer; it needs the diagram's own id.
      deleteDiagram: () => {
        if (diagramId) void deleteDiagram(diagramId);
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
      // The remaining handlers track internally (undo/redo, zen, fit,
      // auto layout/align) or have untracked entry points everywhere
      // (export / import / templates), so no extra telemetry here.
      undo,
      redo,
      toggleZen: toggleZenMode,
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
        setShortcutsOpen(true);
        track('UI', 'Opened', 'Shortcuts');
      },
      openTemplates: openTemplatePicker,
    });
    // The handlers are stable enough (editor action callbacks); the gating
    // inputs are what actually change the catalogue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isReadOnly,
    isOwner,
    isOffline,
    diagramId,
    isMulti,
    selectionCount,
    selectedId,
    single,
    singleIsBoxed,
    singleIsShape,
    hasAnimation,
    marker,
    canUndo,
    canRedo,
    zenMode,
  ]);

  const runCommand = useCallback(
    (id: string) => {
      commands.find((c) => c.id === id)?.run();
    },
    [commands],
  );

  const commandItems = useMemo(
    () =>
      commands.length
        ? commands.map(({ id, name, keywords }) => ({ id, name, keywords }))
        : undefined,
    [commands],
  );

  return { commandItems, runCommand };
}
