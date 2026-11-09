'use client';

import { lazyPanel } from '@liveworkspace/ui/lazy-panel';

// The ⋯ menus' dialogs, each from its own chunk the first time it opens (liveworkspace/docs/specs/004-index/
// one-explorer.md "Cost and performance"): Share, Change Folder and the two defaults dialogs, kept out of the
// Explorer's first load. A menu fetches the ones it offers as it opens (preloadMenuDialogs), so a press on its row
// finds the code in and the dialog opens in the press's own commit, taking focus as it always has.

export const ShareDialog = lazyPanel('share', () =>
  import('../dialogs/ShareDialog').then((m) => m.ShareDialog),
);
export const MoveToFolderDialog = lazyPanel('change-folder', () =>
  import('../dialogs/MoveToFolderDialog').then((m) => m.MoveToFolderDialog),
);
export const UseAsDefaultDialog = lazyPanel('use-as-default', () =>
  import('../defaults/UseAsDefaultDialog').then((m) => m.UseAsDefaultDialog),
);
export const DefaultFoldersDialog = lazyPanel('default-folders', () =>
  import('../defaults/DefaultFolders').then((m) => m.DefaultFoldersDialog),
);

/** Fetches the code of the dialogs a ⋯ menu offers: an item's (Share, Change Folder) or a folder's (the rest). */
export function preloadMenuDialogs(menu: 'item' | 'folder'): void {
  if (menu === 'item') {
    void ShareDialog.preload();
    void MoveToFolderDialog.preload();
    return;
  }
  void MoveToFolderDialog.preload();
  void UseAsDefaultDialog.preload();
  // Use as Default's dialog opens Default Folders from its own row.
  void DefaultFoldersDialog.preload();
}
