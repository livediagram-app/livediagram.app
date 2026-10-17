// The Explorer sidebar's layout rules (docs/specs/013-workspace/explorer-structure.md).

import { describe, expect, it } from 'vitest';
import {
  initialExpanded,
  isLibraryView,
  LIBRARY_EXPAND_KEY,
  MY_DOCUMENTS_EXPAND_KEY,
  SIDEBAR_GROUP_TITLES,
  sidebarDivider,
  sidebarGroups,
  TAGS_EXPAND_KEY,
  type SidebarLayoutInput,
} from './sidebar-structure';

const GUEST: SidebarLayoutInput = {
  signedIn: false,
  signInAvailable: true,
  pendingInvites: 0,
  offlineDocuments: 0,
  selected: 'timeline',
};
const SIGNED_IN: SidebarLayoutInput = { ...GUEST, signedIn: true };

const rowsOf = (input: SidebarLayoutInput, id: string) =>
  sidebarGroups(input).find((g) => g.id === id)?.rows;

describe('sidebarGroups', () => {
  it('orders the groups Overview, Spaces, More', () => {
    expect(sidebarGroups(GUEST).map((g) => g.id)).toEqual(['overview', 'spaces', 'more']);
  });

  it('names the groups Overview, Spaces and More', () => {
    expect(SIDEBAR_GROUP_TITLES).toEqual({ overview: 'Overview', spaces: 'Spaces', more: 'More' });
  });

  it('shows Home, Inbox, Timeline and Shared With Me to everyone', () => {
    expect(rowsOf(GUEST, 'overview')).toEqual(['home', 'inbox', 'timeline', 'shared']);
    expect(rowsOf(SIGNED_IN, 'overview')).toEqual(['home', 'inbox', 'timeline', 'shared']);
  });

  it('gives a signed-in reader My Documents, teams and New Team last', () => {
    expect(rowsOf(SIGNED_IN, 'spaces')).toEqual(['myDocuments', 'teams', 'newTeam']);
  });

  it('gives a guest the sign-in nudge instead of teams and New Team', () => {
    expect(rowsOf(GUEST, 'spaces')).toEqual(['myDocuments', 'signInNudge']);
  });

  it('gives a guest on a deployment without sign-in neither teams nor the nudge', () => {
    expect(rowsOf({ ...GUEST, signInAvailable: false }, 'spaces')).toEqual(['myDocuments']);
  });

  it('shows Invites before New Team only while an invite is pending', () => {
    expect(rowsOf({ ...SIGNED_IN, pendingInvites: 2 }, 'spaces')).toEqual([
      'myDocuments',
      'teams',
      'invites',
      'newTeam',
    ]);
  });

  it('keeps Invites while its view is current, even with none pending', () => {
    expect(rowsOf({ ...SIGNED_IN, selected: 'invites' }, 'spaces')).toContain('invites');
  });

  it('never shows Invites to a guest', () => {
    expect(rowsOf({ ...GUEST, pendingInvites: 3 }, 'spaces')).not.toContain('invites');
  });

  it('hides This Browser while it holds no documents', () => {
    expect(rowsOf(GUEST, 'more')).toEqual(['tags', 'library', 'trash']);
  });

  it('shows This Browser first in More while it holds documents', () => {
    expect(rowsOf({ ...GUEST, offlineDocuments: 1 }, 'more')).toEqual([
      'thisBrowser',
      'tags',
      'library',
      'trash',
    ]);
  });

  // docs/specs/013-workspace/tags.md "The sidebar": always shown, so it can be found before the first tag.
  it('always shows Tags, before Library', () => {
    expect(rowsOf(GUEST, 'more')).toContain('tags');
    expect(rowsOf(SIGNED_IN, 'more')).toContain('tags');
  });

  it('keeps This Browser while its view is current, even when empty', () => {
    expect(rowsOf({ ...GUEST, selected: 'offline' }, 'more')).toContain('thisBrowser');
  });
});

describe('sidebarGroups in the floating Explorer panel', () => {
  const PANEL: SidebarLayoutInput = { ...SIGNED_IN, surface: 'panel', pendingInvites: 2 };

  it('keeps the same three groups and Overview rows', () => {
    expect(sidebarGroups(PANEL).map((g) => g.id)).toEqual(['overview', 'spaces', 'more']);
    expect(rowsOf(PANEL, 'overview')).toEqual(['home', 'inbox', 'timeline', 'shared']);
  });

  it('shows the spaces but no Invites or New Team', () => {
    expect(rowsOf(PANEL, 'spaces')).toEqual(['myDocuments', 'teams']);
  });

  it('shows no sign-in nudge to a guest', () => {
    expect(rowsOf({ ...GUEST, surface: 'panel' }, 'spaces')).toEqual(['myDocuments']);
  });

  it('shows This Browser while it holds documents', () => {
    expect(rowsOf({ ...PANEL, offlineDocuments: 1 }, 'more')).toEqual([
      'thisBrowser',
      'tags',
      'library',
      'trash',
    ]);
  });
});

describe('sidebarDivider', () => {
  it('shows titles when Minimal chrome is off', () => {
    expect(sidebarDivider(false)).toBe('titles');
  });

  it('shows separators when Minimal chrome is on', () => {
    expect(sidebarDivider(true)).toBe('separators');
  });
});

describe('isLibraryView', () => {
  it('recognises the three Library pages', () => {
    expect(['gallery', 'themes', 'shape-libraries'].every((k) => isLibraryView(k as never))).toBe(
      true,
    );
  });

  it('rejects every other view', () => {
    expect(isLibraryView('trash')).toBe(false);
    expect(isLibraryView('timeline')).toBe(false);
  });
});

describe('initialExpanded', () => {
  it('opens My Documents by default', () => {
    expect([...initialExpanded({ kind: 'timeline' })]).toEqual([MY_DOCUMENTS_EXPAND_KEY]);
  });

  it('also opens Library when a Library page is the current view', () => {
    expect(initialExpanded({ kind: 'themes' }).has(LIBRARY_EXPAND_KEY)).toBe(true);
  });

  it('opens Tags when a Tags page is the current view, and only then', () => {
    expect(initialExpanded({ kind: 'tags', id: 't1' }).has(TAGS_EXPAND_KEY)).toBe(true);
    expect(initialExpanded({ kind: 'all' }).has(TAGS_EXPAND_KEY)).toBe(false);
  });

  it('keeps the expand keys apart from folder and team ids', () => {
    expect(MY_DOCUMENTS_EXPAND_KEY).toContain(':');
    expect(LIBRARY_EXPAND_KEY).toContain(':');
  });
});
