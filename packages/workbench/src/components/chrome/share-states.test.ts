import { describe, expect, it } from 'vitest';
import {
  SHARE_LADDER,
  shareStateOf,
  shareStatesLabel,
  shareStatesOf,
  widestShareState,
  type ShareState,
} from './share-states';

// An item can be several visibilities at once (docs/specs/007-editor/editor-app.md "Header actions", owner
// 2026-11-19): Team and Shared, Shared and Public, Team and Public, all three. Private and Offline stand alone.
describe('shareStatesOf', () => {
  it.each<
    [string, boolean, { team?: boolean; community?: boolean; offline?: boolean }, ShareState[]]
  >([
    ['nothing else: Private', false, {}, ['private']],
    ['a link: Shared', true, {}, ['shared']],
    ['a team: Team', false, { team: true }, ['team']],
    ['the Community: Public', false, { community: true }, ['community']],
    ['a team and a link: Shared and Team', true, { team: true }, ['shared', 'team']],
    [
      'a link and the Community: Shared and Public',
      true,
      { community: true },
      ['shared', 'community'],
    ],
    [
      'a team and the Community: Team and Public',
      false,
      { team: true, community: true },
      ['team', 'community'],
    ],
    ['all three', true, { team: true, community: true }, ['shared', 'team', 'community']],
    ['offline: Offline alone', false, { offline: true }, ['offline']],
    [
      'offline wins over everything',
      true,
      { offline: true, team: true, community: true },
      ['offline'],
    ],
  ])('%s', (_name, shareable, v, want) => {
    expect(shareStatesOf(shareable, v)).toEqual(want);
  });

  it('lists every combination in ladder order and never empty', () => {
    for (const shareable of [false, true])
      for (const team of [false, true])
        for (const community of [false, true])
          for (const offline of [false, true]) {
            const states = shareStatesOf(shareable, { team, community, offline });
            expect(states.length).toBeGreaterThan(0);
            const at = states.map((s) => SHARE_LADDER.indexOf(s));
            expect(at).toEqual([...at].sort((a, b) => a - b));
            // The leading state is always one of them.
            expect(states).toContain(shareStateOf(shareable, { team, community, offline }));
          }
  });
});

describe('shareStateOf', () => {
  it('keeps the one leading state: Offline, then Public, Shared, Team, Private', () => {
    expect(shareStateOf(true, { offline: true, community: true })).toBe('offline');
    expect(shareStateOf(true, { community: true, team: true })).toBe('community');
    expect(shareStateOf(true, { team: true })).toBe('shared');
    expect(shareStateOf(false, { team: true })).toBe('team');
    expect(shareStateOf(false, {})).toBe('private');
  });
});

describe('shareStatesLabel', () => {
  it('reads one, two and three states', () => {
    expect(shareStatesLabel(['team'])).toBe('Team');
    expect(shareStatesLabel(['shared', 'team'])).toBe('Shared and Team');
    expect(shareStatesLabel(['shared', 'team', 'community'])).toBe('Shared, Team and Public');
    expect(shareStatesLabel([])).toBe('');
  });
});

describe('widestShareState', () => {
  it('is the last on the ladder', () => {
    expect(widestShareState(['shared', 'team'])).toBe('team');
    expect(widestShareState(['community', 'shared'])).toBe('community');
    expect(widestShareState(['offline'])).toBe('offline');
    expect(widestShareState([])).toBe('private');
  });
});
