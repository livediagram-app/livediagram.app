import { SIDEBAR_LABELS } from './sidebar/sidebar-structure';
import { SYNTHETIC_FOLDERS } from './synthetic-folders';
import type { SelectedNode } from './views';

// What each Explorer view is called: its page heading, document title and breadcrumb
// (docs/specs/013-workspace/explorer-structure.md#page-titles-follow-the-rows). A view with a
// sidebar row is named by that row; the views without one keep their own names. Folder and
// team views are named by the folder or team.
type NamedKind = Exclude<SelectedNode['kind'], 'folder' | 'team'>;

export const VIEW_TITLES: Readonly<Record<NamedKind, string>> = {
  timeline: SIDEBAR_LABELS.home,
  activity: SIDEBAR_LABELS.activity,
  shared: SIDEBAR_LABELS.shared,
  all: SIDEBAR_LABELS.myDocuments,
  unsorted: SYNTHETIC_FOLDERS.unsorted.label,
  generated: SYNTHETIC_FOLDERS.generated.label,
  offline: SIDEBAR_LABELS.thisBrowser,
  invites: SIDEBAR_LABELS.invites,
  gallery: SIDEBAR_LABELS.gallery,
  themes: SIDEBAR_LABELS.themes,
  'shape-libraries': SIDEBAR_LABELS.shapeLibraries,
  trash: SIDEBAR_LABELS.trash,
  recent: 'Recent',
  favourites: 'Favourites',
  dynamic: SYNTHETIC_FOLDERS.dynamic.label,
};

// The document title a static Explorer page exports.
export function viewDocumentTitle(kind: NamedKind): string {
  return `${VIEW_TITLES[kind]} | livediagram`;
}
