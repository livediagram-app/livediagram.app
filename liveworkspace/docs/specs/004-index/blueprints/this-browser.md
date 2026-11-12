# Blueprint: This Browser, a Space

Spec: [one-explorer.md "This Browser, a Space"](../one-explorer.md#this-browser-a-space) and
[one-explorer-contracts.md "This Browser's list"](../one-explorer-contracts.md#this-browsers-list-in-the-browser-never-the-index).

## Files

- `packages/explorer/src/this-browser.ts`: the stored list, version 2 (`readThisBrowserStore`, `writeThisBrowser`
  keeping folders, `folderId` and archive marks; version 1 read as 2).
- `packages/explorer/src/this-browser-folders.ts`: folder writes over the same key (`createThisBrowserFolder`,
  `renameThisBrowserFolder`, `deleteThisBrowserFolder` moving its folders and items up, `moveThisBrowserFolder`
  refusing a cycle, `moveThisBrowserItem`), the folder tree helpers (`localChildren`, `localPath`, `isLocalWithin`)
  and the sync-place notes (`noteSyncPlace`, `readSyncPlaces`, `dropSyncPlace`).
- `packages/explorer/src/explorer/ThisBrowser.tsx`: the view, and `useThisBrowserSpace` for visibility.
- `packages/explorer/src/explorer/this-browser-store.ts`: the hooks (`useThisBrowserList`, `useThisBrowserFolders`),
  one parse per stored text change.
- `packages/explorer/src/explorer/ThisBrowserItemMenu.tsx`: one item's verbs (open, archive, reload after a move), the
  pill and Changed line, and `ThisBrowserItemMenu`.
- `packages/explorer/src/explorer/this-browser-space/`: the sidebar row and its folder subtree, the folder card and
  its menu, the folder dialogs (Home's tile is `ThisBrowserTile` in `HomeSpaces.tsx`).
- `packages/explorer/src/explorer/this-browser-space/useSyncPlaces.ts`: applies the page's sync-place notes once the item is in the
  account.

## Order

1. The store (version 2, the migration, folder writes) with its tests.
2. The view's `folder` (`/explorer/offline?folder=`), the sidebar row in Spaces, its subtree and drops.
3. The view: back bar, New Folder, folder cards, empty folder.
4. Move to Folder for live items; Sync keeping its place (in place, then the page's notes).
5. Home's tile; the panel's rail order.

## Tests

Visibility at 0 and 1 items and with a folder only; folder create, rename, delete (children move up), nesting,
cycles refused; item moves (menu, drop); version 1 read and rewritten as 2; publish keeping folders; Sync's place
(same-name folder, root, the page's note applied and expired); Home's tile; the phone drawer showing the row.
