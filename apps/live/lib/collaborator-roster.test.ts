import { describe, expect, it } from 'vitest';
import type { Participant } from './identity';
import { buildCollaboratorRoster, participantBadges, rosterSummary } from './collaborator-roster';

const p = (id: string, over: Partial<Participant> = {}): Participant => ({
  id,
  name: id,
  color: '#000000',
  status: 'online',
  ...over,
});

const tabs = [
  { id: 't1', name: 'Overview' },
  { id: 't2', name: 'Details' },
  { id: 't3', name: 'Empty' },
];

describe('buildCollaboratorRoster', () => {
  it('groups people by tab in tab-bar order and skips empty tabs', () => {
    const roster = buildCollaboratorRoster({
      participantsByTab: new Map([
        ['t2', [p('bea')]],
        ['t1', [p('me')]],
      ]),
      tabs,
      activeId: 't1',
      selfId: 'me',
    });
    expect(roster.groups.map((g) => g.tab?.name)).toEqual(['Overview', 'Details']);
    expect(roster.groups.map((g) => g.isActive)).toEqual([true, false]);
    expect(roster.peopleCount).toBe(2);
  });

  it('puts you first, then orders by status and name', () => {
    const roster = buildCollaboratorRoster({
      participantsByTab: new Map([
        [
          't1',
          [
            p('zed', { status: 'away' }),
            p('amy', { status: 'offline' }),
            p('me'),
            p('cal'),
            p('bob'),
          ],
        ],
      ]),
      tabs,
      activeId: 't1',
      selfId: 'me',
    });
    expect(roster.groups[0]!.participants.map((x) => x.id)).toEqual([
      'me',
      'bob',
      'cal',
      'zed',
      'amy',
    ]);
  });

  it('keeps people on a tab that no longer exists, in a trailing group', () => {
    const roster = buildCollaboratorRoster({
      participantsByTab: new Map([
        ['t1', [p('me')]],
        ['gone', [p('ghost')]],
      ]),
      tabs,
      activeId: 't1',
      selfId: 'me',
    });
    expect(roster.groups).toHaveLength(2);
    expect(roster.groups[1]!.tab).toBeNull();
    expect(roster.groups[1]!.participants[0]!.id).toBe('ghost');
  });

  it('does not mutate the source lists', () => {
    const list = [p('b'), p('a')];
    buildCollaboratorRoster({
      participantsByTab: new Map([['t1', list]]),
      tabs,
      activeId: 't1',
      selfId: 'me',
    });
    expect(list.map((x) => x.id)).toEqual(['b', 'a']);
  });
});

describe('rosterSummary', () => {
  it('counts people and tabs', () => {
    const roster = buildCollaboratorRoster({
      participantsByTab: new Map([
        ['t1', [p('me'), p('a')]],
        ['t2', [p('b')]],
      ]),
      tabs,
      activeId: 't1',
      selfId: 'me',
    });
    expect(rosterSummary(roster)).toBe('3 people across 2 tabs');
  });

  it('says so when you are alone', () => {
    const roster = buildCollaboratorRoster({
      participantsByTab: new Map([['t1', [p('me')]]]),
      tabs,
      activeId: 't1',
      selfId: 'me',
    });
    expect(rosterSummary(roster)).toBe('Just you so far');
  });
});

describe('participantBadges', () => {
  it('tags you with your role', () => {
    expect(participantBadges(p('me'), 'me', 'view')).toEqual(['You', 'Viewer']);
  });
  it('tags a peer with a known role and a follow', () => {
    expect(participantBadges(p('a', { role: 'edit' }), 'me', 'edit', 'a')).toEqual([
      'Editor',
      'Following',
    ]);
  });
  it('is empty for a peer with no role we are not following', () => {
    expect(participantBadges(p('a'), 'me', 'edit', 'b')).toEqual([]);
  });
});
