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

  it('shows Home, Activity and Shared with me to everyone', () => {
    expect(rowsOf(GUEST, 'overview')).toEqual(['home', 'activity', 'shared']);
    expect(rowsOf(SIGNED_IN, 'overview')).toEqual(['home', 'activity', 'shared']);
  });

  it('gives a signed-in reader My documents, teams and New team last', () => {
    expect(rowsOf(SIGNED_IN, 'spaces')).toEqual(['myDocuments', 'teams', 'newTeam']);
  });

  it('gives a guest the sign-in nudge instead of teams and New team', () => {
    expect(rowsOf(GUEST, 'spaces')).toEqual(['myDocuments', 'signInNudge']);
  });

  it('gives a guest on a deployment without sign-in neither teams nor the nudge', () => {
    expect(rowsOf({ ...GUEST, signInAvailable: false }, 'spaces')).toEqual(['myDocuments']);
  });

  it('shows Invites before New team only while an invite is pending', () => {
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

  it('hides This browser while it holds no documents', () => {
    expect(rowsOf(GUEST, 'more')).toEqual(['library', 'trash']);
  });

  it('shows This browser first in More while it holds documents', () => {
    expect(rowsOf({ ...GUEST, offlineDocuments: 1 }, 'more')).toEqual([
      'thisBrowser',
      'library',
      'trash',
    ]);
  });

  it('keeps This browser while its view is current, even when empty', () => {
    expect(rowsOf({ ...GUEST, selected: 'offline' }, 'more')).toContain('thisBrowser');
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
  it('opens My documents by default', () => {
    expect([...initialExpanded({ kind: 'timeline' })]).toEqual([MY_DOCUMENTS_EXPAND_KEY]);
  });

  it('also opens Library when a Library page is the current view', () => {
    expect(initialExpanded({ kind: 'themes' }).has(LIBRARY_EXPAND_KEY)).toBe(true);
  });

  it('keeps the expand keys apart from folder and team ids', () => {
    expect(MY_DOCUMENTS_EXPAND_KEY).toContain(':');
    expect(LIBRARY_EXPAND_KEY).toContain(':');
  });
});
