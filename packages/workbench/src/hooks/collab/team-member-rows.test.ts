// Who a picker offers as a teammate (docs/specs/012-collaboration/assigned-actions.md §2): joined and
// invited members, never the caller, and never a rejected invite (docs/specs/013-workspace/teams.md).
import { describe, expect, it } from 'vitest';
import type { TeamMember } from '@liveworkspace/api-schema/teams';
import { teamMemberName, teamMemberRows } from './team-member-rows';

const member = (
  id: string,
  status: TeamMember['status'],
  userId: string | null = id,
): TeamMember => ({
  id,
  teamId: 't',
  userId,
  email: `${id}@x.test`,
  role: 'member',
  status,
  name: null,
  createdAt: 0,
  updatedAt: 0,
});

describe('teamMemberRows', () => {
  it('keeps joined and invited members, and drops the caller and rejected invites', () => {
    const rows = teamMemberRows(
      [
        member('me', 'joined'),
        member('a', 'joined'),
        member('b', 'invited', null),
        member('c', 'declined', null),
        member('d', 'expired', 'd'),
      ],
      { id: 't', name: 'Team' },
      'me',
    );
    expect(rows.map((r) => [r.memberId, r.pending])).toEqual([
      ['a', false],
      ['b', true],
    ]);
  });

  it('carries a chosen colour, and Automatic (none) as null', () => {
    const rows = teamMemberRows(
      [{ ...member('a', 'joined'), color: '#ef4444' }, member('b', 'joined')],
      { id: 't', name: 'Team' },
      'me',
    );
    expect(rows.map((r) => [r.memberId, r.color, r.teamId, r.teamName])).toEqual([
      ['a', '#ef4444', 't', 'Team'],
      ['b', null, 't', 'Team'],
    ]);
  });
});

describe('teamMemberName', () => {
  it('prefers the profile name, then the address made readable', () => {
    expect(teamMemberName({ name: 'Ada', email: 'x@y.test' })).toBe('Ada');
    expect(teamMemberName({ name: '  ', email: 'ada.lovelace@y.test' })).toBe('Ada Lovelace');
    expect(teamMemberName({ name: null, email: 'ada.lovelace@y.test' })).toBe('Ada Lovelace');
    expect(teamMemberName({ name: null, email: null })).toBe('Member');
  });

  it('keeps an address whose local part has no letters to make a name of', () => {
    expect(teamMemberName({ name: null, email: '._@y.test' })).toBe('._@y.test');
  });
});
