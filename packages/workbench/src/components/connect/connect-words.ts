// The Connect list's words (liveworkspace/docs/specs/004-index/connected-tabs.md "Connecting", "How it looks"), kept
// apart from the components so each line is pinned by a test and every app says the same thing.
import {
  IndexError,
  linkLevelOffered,
  type App,
  type Item,
  type Level,
} from '@liveworkspace/index-client';
import { BRAND_APPS } from '@liveworkspace/brand';

// The roles a pass can grant, in the picker's order: Editor first, as a new connection starts.
export const CONNECT_LEVELS: readonly Level[] = ['edit', 'participate', 'view'];

export const LEVEL_TITLES: Record<Level, string> = {
  edit: 'Editor',
  participate: 'Participant',
  view: 'Viewer',
};

// What each role lets someone do with the connected file, for the line under the picker.
const LEVEL_VERBS: Record<Level, string> = {
  edit: 'edit',
  participate: 'take part in',
  view: 'view',
};

/** An app's name as its logo spells it: "liveplanner". */
export const appName = (app: App): string => `live${BRAND_APPS[app].word}`;

/** "Anyone who can open this diagram can edit the file you connect." */
export function connectRoleLine(level: Level, hostKind: string): string {
  return `Anyone who can open this ${hostKind} can ${LEVEL_VERBS[level]} the file you connect.`;
}

/** The both-ways switch's line: what it does, or why it cannot be turned on. */
export function bothWaysLine(hostKind: string, hostManaged: boolean): string {
  return hostManaged
    ? `The file you connect gets a tab back to this ${hostKind}.`
    : `Only this ${hostKind}'s owner can connect it both ways.`;
}

/** Whether the person may make a pass to an item: its owner or a joined member of its team, never by a link. */
export const managesItem = (item: Pick<Item, 'access' | 'sharedVia'>): boolean =>
  item.access === 'edit' && !item.sharedVia;

/** Why a row cannot be picked at `level`, or null when it can. */
export function rowBlock(
  item: Pick<Item, 'access' | 'sharedVia' | 'app'>,
  level: Level,
): string | null {
  if (!managesItem(item)) return 'Only its owner can share it';
  if (!linkLevelOffered(item.app, level))
    return `${appName(item.app)} has no ${LEVEL_TITLES[level]} role`;
  return null;
}

/** A failed connect, in words for its row. */
export function connectErrorWords(error: unknown, hostKind: string): string {
  const code = error instanceof IndexError ? error.code : null;
  switch (code) {
    case 'connection_limit':
      return `This ${hostKind} has as many connected tabs as it can hold.`;
    case 'share_link_limit':
      return 'This file has too many links already. Remove one in its Share first.';
    case 'forbidden':
      return 'You can no longer share this file.';
    case 'level_not_offered':
      return 'Its app does not offer that role.';
    case 'connection_self':
      return `A ${hostKind} cannot connect to itself.`;
    case 'rate_limited':
      return 'Too many tries just now. Wait a moment and try again.';
    case 'not_found':
      return 'This file is no longer there.';
    default:
      return 'Could not connect it. Check your connection and try again.';
  }
}

/** The screen reader's phrase after a connected tab's name. */
export function connectedTabPhrase(app: App, sameApp: boolean, broken: boolean): string {
  if (broken) return `, connected ${appName(app)} file, needs attention`;
  return sameApp
    ? `, connected ${appName(app)} file`
    : `, connected ${appName(app)} file, opens in a new tab`;
}

/** Case-blind "does this title hold what was typed": a plain substring, never a pattern. */
export function titleMatches(title: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === '' || title.toLowerCase().includes(q);
}
