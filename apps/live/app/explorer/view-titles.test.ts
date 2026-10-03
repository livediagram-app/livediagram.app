// A view is named by its sidebar row (docs/specs/013-workspace/explorer-structure.md#page-titles-follow-the-rows).

import { describe, expect, it } from 'vitest';
import { VIEW_TITLES } from './view-titles';
import { SIDEBAR_LABELS } from './sidebar/sidebar-structure';

describe('VIEW_TITLES', () => {
  it('names each view with a row by that row', () => {
    expect(VIEW_TITLES.timeline).toBe(SIDEBAR_LABELS.home);
    expect(VIEW_TITLES.activity).toBe(SIDEBAR_LABELS.activity);
    expect(VIEW_TITLES.shared).toBe(SIDEBAR_LABELS.shared);
    expect(VIEW_TITLES.all).toBe(SIDEBAR_LABELS.myDocuments);
    expect(VIEW_TITLES.offline).toBe(SIDEBAR_LABELS.thisBrowser);
    expect(VIEW_TITLES.gallery).toBe(SIDEBAR_LABELS.gallery);
    expect(VIEW_TITLES.themes).toBe(SIDEBAR_LABELS.themes);
    expect(VIEW_TITLES['shape-libraries']).toBe(SIDEBAR_LABELS.shapeLibraries);
    expect(VIEW_TITLES.trash).toBe(SIDEBAR_LABELS.trash);
    expect(VIEW_TITLES.invites).toBe(SIDEBAR_LABELS.invites);
  });

  it('reads Home, Shared with me and This browser', () => {
    expect([VIEW_TITLES.timeline, VIEW_TITLES.shared, VIEW_TITLES.offline]).toEqual([
      'Home',
      'Shared with me',
      'This browser',
    ]);
  });

  it('keeps their own names for the views without a row', () => {
    expect([VIEW_TITLES.recent, VIEW_TITLES.favourites, VIEW_TITLES.search]).toEqual([
      'Recent',
      'Favourites',
      'Search results',
    ]);
  });
});
