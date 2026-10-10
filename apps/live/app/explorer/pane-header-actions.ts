// Which header actions each Explorer section offers (docs/specs/013-workspace/folders.md "Import from"
// and "Create", docs/specs/013-workspace/shape-libraries.md). Kept pure and apart from ExplorerPane
// so the per-section table is unit-testable without mounting the pane.

import type { SelectedNode } from './views';

type Kind = SelectedNode['kind'];

// Sections with no New document: none of them is a place a new document lands. Home is
// deliberately absent (docs/specs/013-workspace/explorer-home.md: starting a document from the
// first screen is never a dead end), as are the aggregate views (Recent, Favourites, Search
// results), whose New document simply files at the root.
const NO_NEW_DOCUMENT: ReadonlySet<Kind> = new Set<Kind>([
  // Activity is an inbox of open actions and threads (docs/specs/013-workspace/activity-page.md §1).
  'activity',
  'shared',
  'gallery',
  'themes',
  'shape-libraries',
  'trash',
  'team',
  'invites',
  // This browser is a read-through view; offline documents come from the /new wizard.
  'offline',
]);

// Sections with New folder: only the places folders live, the My documents root and a folder.
// Every view (Recent, Favourites, Search results, ...) is computed, so a folder made there
// would not appear where it was made (docs/specs/013-workspace/favourites.md "The view").
const NEW_FOLDER: ReadonlySet<Kind> = new Set<Kind>(['all', 'folder']);

export type PaneHeaderActions = {
  newDocument: boolean;
  newFolder: boolean;
  /** The "Import from" toolbar. */
  importFrom: boolean;
};

export function paneHeaderActions(kind: Kind): PaneHeaderActions {
  const newDocument = !NO_NEW_DOCUMENT.has(kind);
  return {
    newDocument,
    newFolder: NEW_FOLDER.has(kind),
    // Import from sits wherever New document does (imports land where new documents do),
    // except Home, which carries no import; plus Shape libraries, where draw.io libraries
    // are imported and its empty state points to Import from draw.io.
    importFrom: (newDocument && kind !== 'home') || kind === 'shape-libraries',
  };
}
