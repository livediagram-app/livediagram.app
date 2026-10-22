// The Explorer sidebar's layout rules (docs/specs/013-workspace/explorer-structure.md).

import { describe, expect, it } from 'vitest';
import {
  initialExpanded,
  isLibraryView,
  LIBRARY_EXPAND_KEY,
  MY_PROJECTS_EXPAND_KEY,
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
  offlineProjects: 0,
  selected: 'inbox',
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

  it('shows Home, Inbox and Shared With Me to everyone', () => {
    expect(rowsOf(GUEST, 'overview')).toEqual(['home', 'inbox', 'shared']);
    expect(rowsOf(SIGNED_IN, 'overview')).toEqual(['home', 'inbox', 'shared']);
  });

  it('gives a signed-in reader My Projects, teams and New Team last', () => {
    expect(rowsOf(SIGNED_IN, 'spaces')).toEqual(['myProjects', 'teams', 'newTeam']);
  });

  it('gives a guest the sign-in nudge instead of teams and New Team', () => {
    expect(rowsOf(GUEST, 'spaces')).toEqual(['myProjects', 'signInNudge']);
  });

  it('gives a guest on a deployment without sign-in neither teams nor the nudge', () => {
    expect(rowsOf({ ...GUEST, signInAvailable: false }, 'spaces')).toEqual(['myProjects']);
  });

  it('shows Invites before New Team only while an invite is pending', () => {
    expect(rowsOf({ ...SIGNED_IN, pendingInvites: 2 }, 'spaces')).toEqual([
      'myProjects',
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

  it('hides This Browser while it holds no projects', () => {
    expect(rowsOf(GUEST, 'more')).toEqual(['library', 'trash']);
  });

  it('shows This Browser first in More while it holds projects', () => {
    expect(rowsOf({ ...GUEST, offlineProjects: 1 }, 'more')).toEqual([
      'thisBrowser',
      'library',
      'trash',
    ]);
  });

  // docs/specs/013-workspace/tags.md "The sidebar": always shown, so it can be found before the first tag.
  it('holds Tags inside Library, not as a row of More (tags.md "The sidebar")', () => {
    expect(rowsOf(GUEST, 'more')).not.toContain('tags' as never);
    expect(rowsOf(SIGNED_IN, 'more')).toContain('library');
  });

  it('keeps This Browser while its view is current, even when empty', () => {
    expect(rowsOf({ ...GUEST, selected: 'offline' }, 'more')).toContain('thisBrowser');
  });
});

describe('sidebarGroups in the floating Explorer panel', () => {
  const PANEL: SidebarLayoutInput = { ...SIGNED_IN, surface: 'panel', pendingInvites: 2 };

  it('keeps the same three groups and Overview rows', () => {
    expect(sidebarGroups(PANEL).map((g) => g.id)).toEqual(['overview', 'spaces', 'more']);
    expect(rowsOf(PANEL, 'overview')).toEqual(['home', 'inbox', 'shared']);
  });

  it('shows the spaces but no Invites or New Team', () => {
    expect(rowsOf(PANEL, 'spaces')).toEqual(['myProjects', 'teams']);
  });

  it('shows no sign-in nudge to a guest', () => {
    expect(rowsOf({ ...GUEST, surface: 'panel' }, 'spaces')).toEqual(['myProjects']);
  });

  it('shows This Browser while it holds projects', () => {
    expect(rowsOf({ ...PANEL, offlineProjects: 1 }, 'more')).toEqual([
      'thisBrowser',
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
  it('recognises the Library page', () => {
    expect(isLibraryView('themes')).toBe(true);
  });

  it('rejects every other view', () => {
    expect(isLibraryView('trash')).toBe(false);
    expect(isLibraryView('inbox')).toBe(false);
  });
});

describe('initialExpanded', () => {
  it('opens My Projects by default', () => {
    expect([...initialExpanded({ kind: 'inbox' })]).toEqual([MY_PROJECTS_EXPAND_KEY]);
  });

  it('also opens Library when a Library page is the current view', () => {
    expect(initialExpanded({ kind: 'themes' }).has(LIBRARY_EXPAND_KEY)).toBe(true);
  });

  it('opens Tags when a Tags page is the current view, and only then', () => {
    expect(initialExpanded({ kind: 'tags', id: 't1' }).has(TAGS_EXPAND_KEY)).toBe(true);
    // Tags lives inside Library, so a Tags page opens Library too.
    expect(initialExpanded({ kind: 'tags', id: 't1' }).has(LIBRARY_EXPAND_KEY)).toBe(true);
    expect(initialExpanded({ kind: 'all' }).has(TAGS_EXPAND_KEY)).toBe(false);
  });

  it('keeps the expand keys apart from folder and team ids', () => {
    expect(MY_PROJECTS_EXPAND_KEY).toContain(':');
    expect(LIBRARY_EXPAND_KEY).toContain(':');
  });
});
