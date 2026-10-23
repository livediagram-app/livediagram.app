// Which header actions each Explorer section offers (docs/specs/013-workspace/folders.md "Create"). Kept
// pure and apart from ExplorerPane so the per-section table is unit-testable without mounting the pane.

import type { SelectedNode } from './views';

type Kind = SelectedNode['kind'];

// Sections with no New document: none of them is a place a new document lands. Home is
// deliberately absent (docs/specs/013-workspace/explorer-home.md: starting a document from the
// first screen is never a dead end), as are the aggregate views (Recent, Favourites, Search
// results), whose New document simply files at the root.
const NO_NEW_DOCUMENT: ReadonlySet<Kind> = new Set<Kind>([
  // The Inbox lists open actions and threads (docs/specs/013-workspace/inbox.md §1).
  'inbox',
  'shared',
  'gallery',
  'trash',
  'team',
  'invites',
  // This Browser is a read-through view; offline documents come from the /new wizard.
  'offline',
  // Tags gather documents from every place; a new one lands in none of them (docs/specs/013-workspace/tags.md).
  'tags',
]);

// Sections with New folder: only the places folders live, the My Work root and a folder.
// Every view (Recent, Favourites, Search results, ...) is computed, so a folder made there
// would not appear where it was made (docs/specs/013-workspace/favourites.md "The view").
const NEW_FOLDER: ReadonlySet<Kind> = new Set<Kind>(['all', 'folder']);

type PaneHeaderActions = {
  newDocument: boolean;
  newFolder: boolean;
};

export function paneHeaderActions(kind: Kind): PaneHeaderActions {
  return { newDocument: !NO_NEW_DOCUMENT.has(kind), newFolder: NEW_FOLDER.has(kind) };
}
