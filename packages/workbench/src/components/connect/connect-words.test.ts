// The Connect list's words (liveworkspace/docs/specs/004-index/connected-tabs.md "Connecting", "How it looks").
import { describe, expect, it } from 'vitest';
import { IndexError } from '@liveworkspace/index-client';
import {
  appName,
  bothWaysLine,
  connectedTabPhrase,
  connectErrorWords,
  connectRoleLine,
  CONNECT_LEVELS,
  managesItem,
  rowBlock,
  titleMatches,
} from './connect-words';

describe('connect words', () => {
  it('names each app as its logo spells it', () => {
    expect(appName('liveplanner')).toBe('liveplanner');
    expect(appName('livehuddle')).toBe('livehuddle');
  });

  it('offers Editor first, then Participant and Viewer', () => {
    expect(CONNECT_LEVELS).toEqual(['edit', 'participate', 'view']);
  });

  it('says what the chosen role lets anyone with the host do', () => {
    expect(connectRoleLine('edit', 'diagram')).toBe(
      'Anyone who can open this diagram can edit the file you connect.',
    );
    expect(connectRoleLine('participate', 'plan')).toBe(
      'Anyone who can open this plan can take part in the file you connect.',
    );
    expect(connectRoleLine('view', 'design')).toBe(
      'Anyone who can open this design can view the file you connect.',
    );
  });

  it('says what both ways does, or why it cannot', () => {
    expect(bothWaysLine('diagram', true)).toBe(
      'The file you connect gets a tab back to this diagram.',
    );
    expect(bothWaysLine('diagram', false)).toBe(
      "Only this diagram's owner can connect it both ways.",
    );
  });

  it('manages an item only at edit and never through a link', () => {
    expect(managesItem({ access: 'edit', sharedVia: null })).toBe(true);
    expect(managesItem({ access: 'edit', sharedVia: 'abc' })).toBe(false);
    expect(managesItem({ access: 'view', sharedVia: null })).toBe(false);
  });

  it('blocks a row it may not share, or whose app lacks the role', () => {
    expect(rowBlock({ access: 'view', sharedVia: null, app: 'livediagram' }, 'edit')).toBe(
      'Only its owner can share it',
    );
    expect(rowBlock({ access: 'edit', sharedVia: null, app: 'livehuddle' }, 'view')).toBe(
      'livehuddle has no Viewer role',
    );
    expect(rowBlock({ access: 'edit', sharedVia: null, app: 'livehuddle' }, 'edit')).toBeNull();
    expect(rowBlock({ access: 'edit', sharedVia: null, app: 'liveplanner' }, 'view')).toBeNull();
  });

  it('puts every refusal into words', () => {
    const words = (code: string, status = 409) =>
      connectErrorWords(new IndexError(status, code), 'diagram');
    expect(words('connection_limit')).toBe(
      'This diagram has as many connected tabs as it can hold.',
    );
    expect(words('share_link_limit')).toMatch(/too many links/);
    expect(words('forbidden', 403)).toBe('You can no longer share this file.');
    expect(words('level_not_offered', 400)).toBe('Its app does not offer that role.');
    expect(words('connection_self', 400)).toBe('A diagram cannot connect to itself.');
    expect(words('rate_limited', 429)).toMatch(/Wait a moment/);
    expect(words('not_found', 404)).toBe('This file is no longer there.');
    expect(words('unknown', 500)).toMatch(/Check your connection/);
    expect(connectErrorWords(new TypeError('Failed to fetch'), 'diagram')).toMatch(
      /Check your connection/,
    );
  });

  it('tells a screen reader what the tab is, never that pressing it opens anything', () => {
    expect(connectedTabPhrase('liveplanner', false)).toBe(', connected liveplanner file');
    expect(connectedTabPhrase('livediagram', true)).toBe(
      ', connected livediagram file, needs attention',
    );
  });

  it('matches a title by plain, case-blind substring', () => {
    expect(titleMatches('Launch Plan', '')).toBe(true);
    expect(titleMatches('Launch Plan', '  plan ')).toBe(true);
    expect(titleMatches('Launch Plan', 'brief')).toBe(false);
    // Pattern characters are only characters.
    expect(titleMatches('Q3 (draft)', '(dr')).toBe(true);
    expect(titleMatches('Anything', '.*')).toBe(false);
  });
});
