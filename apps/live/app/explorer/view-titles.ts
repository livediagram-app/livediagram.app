import { SIDEBAR_LABELS } from './sidebar/sidebar-structure';
import type { SelectedNode } from './views';

// What each Explorer view is called: its page heading, document title and breadcrumb
// (docs/specs/013-workspace/explorer-structure.md#page-titles-follow-the-rows). A view with a
// sidebar row is named by that row; the views without one keep their own names. Folder and
// team views are named by the folder or team.
type NamedKind = Exclude<SelectedNode['kind'], 'folder' | 'team'>;

export const VIEW_TITLES: Readonly<Record<NamedKind, string>> = {
  home: SIDEBAR_LABELS.home,
  inbox: SIDEBAR_LABELS.inbox,
  timeline: SIDEBAR_LABELS.timeline,
  shared: SIDEBAR_LABELS.shared,
  all: SIDEBAR_LABELS.myDocuments,
  offline: SIDEBAR_LABELS.thisBrowser,
  invites: SIDEBAR_LABELS.invites,
  gallery: SIDEBAR_LABELS.gallery,
  themes: SIDEBAR_LABELS.themes,
  'shape-libraries': SIDEBAR_LABELS.shapeLibraries,
  trash: SIDEBAR_LABELS.trash,
  recent: 'Recent',
  favourites: 'Favourites',
  search: 'Search results',
};

// The document title a static Explorer page exports.
export function viewDocumentTitle(kind: NamedKind): string {
  return `${VIEW_TITLES[kind]} | livediagram`;
}

// The view reached from Home, without a sidebar row of its own: Recent (See more). Its breadcrumb
// leads back to Home
// (docs/specs/013-workspace/explorer-structure.md#page-titles-follow-the-rows).
const UNDER_HOME: ReadonlySet<SelectedNode['kind']> = new Set(['recent']);

export function leadsBackHome(kind: SelectedNode['kind']): boolean {
  return UNDER_HOME.has(kind);
}
