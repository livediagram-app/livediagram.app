import { useState } from 'react';

// Top-level modal/dialog visibility for the editor: Search, Shortcuts,
// Settings, the Share dialog, and the per-tab Export / Import dialogs.
// Pure open/closed UI flags with no diagram-data coupling — a self-
// contained slice composed into useEditorState and spread into its
// view-model.
export function useEditorDialogs() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  // The right-click Canvas/Theme dialog (spec/42). null = closed; the
  // value is which tab it opened on. A single flag drives both the open
  // state and the active tab.
  const [canvasThemeTab, setCanvasThemeTab] = useState<'canvas' | 'theme' | 'font' | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  // Whether the open Export dialog targets the whole active tab or just
  // the current multi-selection. A plain enum flag (no element data) so
  // this slice stays diagram-data-free; EditorView derives the scoped
  // tab live from `multiSelectedIds` when scope is 'selection'.
  const [exportScope, setExportScope] = useState<'tab' | 'selection'>('tab');
  const [importOpen, setImportOpen] = useState(false);

  return {
    searchOpen,
    setSearchOpen,
    shortcutsOpen,
    setShortcutsOpen,
    settingsOpen,
    setSettingsOpen,
    shareDialogOpen,
    setShareDialogOpen,
    canvasThemeTab,
    setCanvasThemeTab,
    exportOpen,
    setExportOpen,
    exportScope,
    setExportScope,
    importOpen,
    setImportOpen,
  };
}
