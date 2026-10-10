import { describe, expect, it } from 'vitest';
import { paneHeaderActions } from './pane-header-actions';

describe('paneHeaderActions', () => {
  it('offers New folder only where folders live', () => {
    expect(paneHeaderActions('all').newFolder).toBe(true);
    expect(paneHeaderActions('folder').newFolder).toBe(true);
    // Favourites is a computed view like Recent and Search results: a folder made there
    // would not show up there (docs/specs/013-workspace/favourites.md "The view").
    for (const kind of ['favourites', 'recent', 'search', 'home', 'timeline'] as const) {
      expect(paneHeaderActions(kind).newFolder, kind).toBe(false);
    }
  });

  it('shows Import from on Shape libraries, where its empty state points to it', () => {
    // docs/specs/013-workspace/shape-libraries.md: the Import from group shows on that page.
    expect(paneHeaderActions('shape-libraries')).toEqual({
      newDocument: false,
      newFolder: false,
      importFrom: true,
    });
  });

  it('pairs Import from with New document everywhere else, except Home', () => {
    expect(paneHeaderActions('home')).toEqual({
      newDocument: true,
      newFolder: false,
      importFrom: false,
    });
    for (const kind of ['recent', 'all', 'folder', 'favourites', 'search', 'timeline'] as const) {
      expect(paneHeaderActions(kind).importFrom, kind).toBe(true);
    }
    for (const kind of [
      'inbox',
      'shared',
      'gallery',
      'themes',
      'trash',
      'team',
      'invites',
      'offline',
    ] as const) {
      expect(paneHeaderActions(kind), kind).toEqual({
        newDocument: false,
        newFolder: false,
        importFrom: false,
      });
    }
  });
});
