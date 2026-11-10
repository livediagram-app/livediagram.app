import type { FolderStore } from '../data/useFolders';
import type { ThisBrowserFolder } from '../this-browser';
import { VIEW_TITLES, type ExplorerView } from '../views';

/** The name a view goes by: its pane heading's title, and the phone's sections bar (one-explorer.md "The sidebar",
 *  On a phone). A folder's own name ("Folder" while the folders load), a team's name at its root, a local folder's
 *  name in This Browser (its root's name for one not there). */
export function viewTitle(
  view: ExplorerView,
  folders: Pick<FolderStore, 'byId'>,
  teamName: (id: string | null) => string | null,
  localFolders: readonly ThisBrowserFolder[] = [],
): string {
  switch (view.kind) {
    case 'offline':
      return (
        (view.folder ? localFolders.find((f) => f.id === view.folder)?.name : undefined) ??
        VIEW_TITLES.offline
      );
    case 'folder':
      return folders.byId.get(view.id)?.name ?? 'Folder';
    case 'team':
      return view.folderId
        ? (folders.byId.get(view.folderId)?.name ?? 'Folder')
        : (teamName(view.id) ?? 'Team');
    default:
      return VIEW_TITLES[view.kind];
  }
}
