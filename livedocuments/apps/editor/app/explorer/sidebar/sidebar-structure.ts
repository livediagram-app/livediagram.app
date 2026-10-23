// The Explorer sidebar's structure (docs/specs/013-workspace/explorer-structure.md): which groups
// and rows show, from a handful of facts, plus the copy and expand keys every
// surface reads. Pure; the components only render what this decides.

import type { SelectedNode } from '../views';

export const SIDEBAR_GROUP_TITLES = {
  overview: 'Overview',
  spaces: 'Spaces',
  more: 'More',
} as const;

export type SidebarGroupId = keyof typeof SIDEBAR_GROUP_TITLES;

// Title Case copy for every fixed row. Read by the sidebar and by the
// floating Explorer panel, which names its spaces with the same words.
export const SIDEBAR_LABELS = {
  home: 'Home',
  inbox: 'Inbox',
  timeline: 'Timeline',
  shared: 'Shared With Me',
  myDocuments: 'My Work',
  invites: 'Invites',
  newTeam: 'Manage Teams',
  thisBrowser: 'This Browser',
  tags: 'Tags',
  library: 'Library',
  gallery: 'Image Gallery',
  themes: 'Themes',
  trash: 'Trash',
} as const;

// The top-level rows a group may hold; `teams` stands for zero or more team rows.
export type SidebarRowKind =
  | 'home'
  | 'inbox'
  | 'timeline'
  | 'shared'
  | 'myDocuments'
  | 'teams'
  | 'invites'
  | 'newTeam'
  | 'signInNudge'
  | 'thisBrowser'
  | 'library'
  | 'trash';

export type SidebarLayoutInput = {
  // A signed-in session (teams exist only for one).
  signedIn: boolean;
  // The deployment offers sign-in at all (a no-auth self-host does not).
  signInAvailable: boolean;
  pendingInvites: number;
  offlineDocuments: number;
  // The current view, on the page; the panel has none (null).
  selected: SelectedNode['kind'] | null;
  // The full-page sidebar (default) or the editor's floating Explorer panel, which leaves
  // invites, team creation and the sign-in nudge to the Explorer.
  surface?: 'page' | 'panel';
  // Team administration rows (Invites, New Team); a workspace frame shows none (WB62).
  administration?: boolean;
};

type SidebarGroupLayout = { id: SidebarGroupId; rows: SidebarRowKind[] };

export function sidebarGroups(input: SidebarLayoutInput): SidebarGroupLayout[] {
  const { signedIn, signInAvailable, pendingInvites, offlineDocuments, selected } = input;
  const panel = input.surface === 'panel';
  const administration = !panel && (input.administration ?? true);
  const spaces: SidebarRowKind[] = ['myDocuments'];
  if (signedIn) {
    spaces.push('teams');
    if (administration && (pendingInvites > 0 || selected === 'invites')) spaces.push('invites');
    if (administration) spaces.push('newTeam');
  } else if (signInAvailable && !panel) {
    spaces.push('signInNudge');
  }
  // A row whose view is current stays, so the highlight never vanishes under the reader.
  const more: SidebarRowKind[] = [];
  if (offlineDocuments > 0 || selected === 'offline') more.push('thisBrowser');
  // Tags always shows, so it can be found before the first tag (docs/specs/013-workspace/tags.md "The sidebar").
  // Tags lives inside Library (docs/specs/013-workspace/tags.md "The sidebar"), always shown there.
  more.push('library', 'trash');
  return [
    { id: 'overview', rows: ['home', 'inbox', 'timeline', 'shared'] },
    { id: 'spaces', rows: spaces },
    { id: 'more', rows: more },
  ];
}

export type SidebarDivider = 'titles' | 'separators';

// Minimal chrome (docs/specs/007-editor/power-user-mode.md) swaps the titles for hairlines.
export function sidebarDivider(minimalChrome: boolean): SidebarDivider {
  return minimalChrome ? 'separators' : 'titles';
}

const LIBRARY_VIEWS: ReadonlySet<SelectedNode['kind']> = new Set(['gallery', 'themes']);

export function isLibraryView(kind: SelectedNode['kind']): boolean {
  return LIBRARY_VIEWS.has(kind);
}

// Entries of the shared `expanded` set; the colon keeps them apart from folder and team ids.
export const MY_DOCUMENTS_EXPAND_KEY = 'space:my-documents';
export const LIBRARY_EXPAND_KEY = 'more:library';
export const TAGS_EXPAND_KEY = 'more:tags';

// Computed before first paint, so nothing expands after load.
export function initialExpanded(selected: SelectedNode): Set<string> {
  const keys = new Set([MY_DOCUMENTS_EXPAND_KEY]);
  if (isLibraryView(selected.kind)) keys.add(LIBRARY_EXPAND_KEY);
  // A Tags page opens Library, where Tags lives, and Tags itself.
  if (selected.kind === 'tags') {
    keys.add(LIBRARY_EXPAND_KEY);
    keys.add(TAGS_EXPAND_KEY);
  }
  return keys;
}
