// A view is named by its sidebar row (docs/specs/013-workspace/explorer-structure.md#page-titles-follow-the-rows).

import { describe, expect, it } from 'vitest';
import { leadsBackHome, VIEW_TITLES } from './view-titles';
import { SIDEBAR_LABELS } from './sidebar/sidebar-structure';

describe('VIEW_TITLES', () => {
  it('names each view with a row by that row', () => {
    expect(VIEW_TITLES.home).toBe(SIDEBAR_LABELS.home);
    expect(VIEW_TITLES.inbox).toBe(SIDEBAR_LABELS.inbox);
    expect(VIEW_TITLES.timeline).toBe(SIDEBAR_LABELS.timeline);
    expect(VIEW_TITLES.shared).toBe(SIDEBAR_LABELS.shared);
    expect(VIEW_TITLES.all).toBe(SIDEBAR_LABELS.myDocuments);
    expect(VIEW_TITLES.offline).toBe(SIDEBAR_LABELS.thisBrowser);
    expect(VIEW_TITLES.gallery).toBe(SIDEBAR_LABELS.gallery);
    expect(VIEW_TITLES.themes).toBe(SIDEBAR_LABELS.themes);
    expect(VIEW_TITLES['shape-libraries']).toBe(SIDEBAR_LABELS.shapeLibraries);
    expect(VIEW_TITLES.trash).toBe(SIDEBAR_LABELS.trash);
    expect(VIEW_TITLES.invites).toBe(SIDEBAR_LABELS.invites);
  });

  it('reads Home, Inbox, Timeline, Shared with me and This browser', () => {
    expect([
      VIEW_TITLES.home,
      VIEW_TITLES.inbox,
      VIEW_TITLES.timeline,
      VIEW_TITLES.shared,
      VIEW_TITLES.offline,
    ]).toEqual(['Home', 'Inbox', 'Timeline', 'Shared with me', 'This browser']);
  });

  it('keeps their own names for the views without a row', () => {
    expect([VIEW_TITLES.recent, VIEW_TITLES.favourites, VIEW_TITLES.search]).toEqual([
      'Recent',
      'Favourites',
      'Search results',
    ]);
  });
});

describe('leadsBackHome', () => {
  it('puts Recent, reached from Home, under it in the breadcrumb', () => {
    expect(leadsBackHome('recent')).toBe(true);
    expect(leadsBackHome('home')).toBe(false);
    expect(leadsBackHome('favourites')).toBe(false);
    expect(leadsBackHome('folder')).toBe(false);
  });

  it('gives the Timeline, which has a row of its own, its own breadcrumb', () => {
    expect(leadsBackHome('timeline')).toBe(false);
  });
});
