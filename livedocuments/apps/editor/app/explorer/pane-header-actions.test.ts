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

  it('offers New Document everywhere a new document lands, Home included', () => {
    for (const kind of [
      'home',
      'recent',
      'all',
      'folder',
      'favourites',
      'search',
      'timeline',
    ] as const) {
      expect(paneHeaderActions(kind).newDocument, kind).toBe(true);
    }
    for (const kind of [
      'inbox',
      'shared',
      'gallery',
      'trash',
      'team',
      'invites',
      'offline',
    ] as const) {
      expect(paneHeaderActions(kind), kind).toEqual({ newDocument: false, newFolder: false });
    }
  });
});
