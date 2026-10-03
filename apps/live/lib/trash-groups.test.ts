import { describe, expect, it } from 'vitest';
import { TRASH_RETENTION_MS, type TrashedDocument } from '@livediagram/api-schema';
import { daysLeftLabel, trashGroups, trashedCardLead, trashedOnLabel } from './trash-groups';

// How the Trash view groups what it lists (docs/specs/013-workspace/trash.md,
// "The Trash view"): the personal Trash, one group per team, then this
// browser's, each with its own Empty Trash.

const T0 = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

const row = (id: string, team: [string, string] | null = null): TrashedDocument => ({
  id,
  name: id,
  teamId: team?.[0] ?? null,
  teamName: team?.[1] ?? null,
  trashedAt: T0,
  purgeAt: T0 + TRASH_RETENTION_MS,
  reason: 'deleted',
});

describe('trashGroups', () => {
  it('orders the personal Trash, then teams by name, then this browser', () => {
    const groups = trashGroups({
      cloud: [
        row('t2', ['b', 'Beta']),
        row('p1'),
        row('t1', ['a', 'Alpha']),
        row('t3', ['b', 'Beta']),
      ],
      local: [row('l1')],
    });
    expect(groups.map((g) => [g.title, g.scope, g.rows.map((r) => r.id)])).toEqual([
      ['Your documents', { kind: 'personal' }, ['p1']],
      ['Alpha', { kind: 'team', teamId: 'a' }, ['t1']],
      ['Beta', { kind: 'team', teamId: 'b' }, ['t2', 't3']],
      ['This browser only', { kind: 'local' }, ['l1']],
    ]);
  });

  it('leaves out empty groups', () => {
    expect(trashGroups({ cloud: [], local: [] })).toEqual([]);
    expect(trashGroups({ cloud: null, local: [row('l1')] }).map((g) => g.scope.kind)).toEqual([
      'local',
    ]);
  });

  it('names a team whose name did not come back', () => {
    expect(trashGroups({ cloud: [row('t', ['x', ''])], local: [] })[0]!.title).toBe('A team');
  });

  it('tags each group for telemetry', () => {
    const groups = trashGroups({ cloud: [row('p'), row('t', ['a', 'A'])], local: [row('l')] });
    expect(groups.map((g) => g.telemetryType)).toEqual(['Personal', 'Team', 'Local']);
  });
});

describe('daysLeftLabel', () => {
  it('reads naturally at every count', () => {
    expect(daysLeftLabel(T0, T0)).toBe('30 days left');
    expect(daysLeftLabel(T0, T0 + 29 * DAY + 1)).toBe('1 day left');
    expect(daysLeftLabel(T0, T0 + 30 * DAY)).toBe('Removed at the next clean-up');
  });
});

describe('trashedOnLabel', () => {
  // docs/specs/013-workspace/empty-document-cleanup.md "In the Trash": a row the
  // clean-up moved says why. The date is locale-formatted, so match around it.
  it('says a person deleted it, or that it was moved for being empty', () => {
    expect(trashedOnLabel({ trashedAt: T0, reason: 'deleted' })).toMatch(/^Deleted \S.*$/);
    expect(trashedOnLabel({ trashedAt: T0, reason: 'empty' })).toMatch(
      /^Moved here \S.* because it was empty$/,
    );
  });
});

describe('trashedCardLead', () => {
  it('tells someone who may restore it why it is there and how long is left', () => {
    expect(trashedCardLead({ trashedAt: T0, reason: 'deleted' }, T0)).toBe(
      'It is in the Trash (30 days left).',
    );
    expect(trashedCardLead({ trashedAt: T0, reason: 'empty' }, T0 + 29 * DAY + 1)).toBe(
      'It was empty for 30 days, so it moved to the Trash (1 day left).',
    );
  });
});
