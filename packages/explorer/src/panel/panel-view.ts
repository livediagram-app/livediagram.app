// The panel's sections as Explorer views and back: the pane's view, which the shared menus read, and where a view
// they ask for sits in the panel.

import type { ExplorerView } from '../views';
import type { LibraryTab, PanelSection } from './sections';

export function paneView(section: PanelSection, folderId: string | null): ExplorerView {
  switch (section.kind) {
    case 'mine':
      return folderId ? { kind: 'folder', id: folderId } : { kind: 'all' };
    case 'team':
      return folderId
        ? { kind: 'team', id: section.id, folderId }
        : { kind: 'team', id: section.id };
    case 'library':
      return { kind: 'gallery' };
    default:
      return { kind: section.kind };
  }
}

// Where a view the shared menus ask for sits in the panel, or null for one only the Explorer page shows.
export function sectionOfView(
  v: ExplorerView,
): { section: PanelSection; folderId: string | null; libraryTab?: LibraryTab } | null {
  switch (v.kind) {
    case 'gallery':
    case 'shape-libraries':
      return { section: { kind: 'library' }, folderId: null, libraryTab: v.kind };
    case 'home':
    case 'inbox':
    case 'shared':
    case 'favourites':
    case 'offline':
    case 'archived':
    case 'trash':
      return { section: { kind: v.kind }, folderId: null };
    case 'all':
      return { section: { kind: 'mine' }, folderId: null };
    case 'folder':
      return { section: { kind: 'mine' }, folderId: v.id };
    case 'team':
      return { section: { kind: 'team', id: v.id }, folderId: v.folderId ?? null };
    default:
      return null;
  }
}
