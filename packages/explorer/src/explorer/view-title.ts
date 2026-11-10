import type { FolderStore } from '../data/useFolders';
import { VIEW_TITLES, type ExplorerView } from '../views';

/** The name a view goes by: its pane heading's title, and the phone's sections bar (one-explorer.md "The sidebar",
 *  On a phone). A folder's own name ("Folder" while the folders load), a team's name at its root. */
export function viewTitle(
  view: ExplorerView,
  folders: Pick<FolderStore, 'byId'>,
  teamName: (id: string | null) => string | null,
): string {
  switch (view.kind) {
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
