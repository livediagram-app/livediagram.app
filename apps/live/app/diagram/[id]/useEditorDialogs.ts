import { useState } from 'react';

// Top-level modal/dialog visibility for the editor: Search, Shortcuts,
// Settings, the Share dialog, and the per-tab Export dialog. Pure
// open/closed UI flags with no diagram-data coupling — a self-contained
// slice composed into useEditorState and spread into its view-model.
export function useEditorDialogs() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  return {
    searchOpen,
    setSearchOpen,
    shortcutsOpen,
    setShortcutsOpen,
    settingsOpen,
    setSettingsOpen,
    shareDialogOpen,
    setShareDialogOpen,
    exportOpen,
    setExportOpen,
  };
}
