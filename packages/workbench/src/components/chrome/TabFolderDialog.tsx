'use client';

// Organise in Tab Folder (docs/specs/006-document/tab-folders.md "Membership UX"), the same centred modal in every
// editor: the tab menu's row opens it, and its list (TabFolderList) files the tab into a folder, takes it out of one,
// makes a new one (New Folder, first) and sets a folder's colour.
import { useState } from 'react';
import { tabFolderHeroArt } from '@liveworkspace/ui/dialog-hero-art/tab-folder';
import { OrganiseDialogFrame } from '../dialogs/OrganiseDialogFrame';
import { TabFolderList, type TabFolderListProps } from './TabFolderList';

export function AddTabToFolderDialog({
  onClose,
  ...list
}: Omit<TabFolderListProps, 'onDone' | 'onEscapeHeld'> & { onClose: () => void }) {
  const [escapeHeld, setEscapeHeld] = useState(false);
  return (
    <OrganiseDialogFrame
      art={tabFolderHeroArt}
      title="Organise in Tab Folder"
      sub="File this tab into a folder on the tab bar. Same name means same folder."
      onClose={onClose}
      escapeHeld={escapeHeld}
    >
      <TabFolderList {...list} onDone={onClose} onEscapeHeld={setEscapeHeld} />
    </OrganiseDialogFrame>
  );
}
