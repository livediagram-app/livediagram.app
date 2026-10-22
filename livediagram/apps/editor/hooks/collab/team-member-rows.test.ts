// Who a picker offers as a teammate (docs/specs/012-collaboration/assigned-actions.md §2): joined and
// invited members, never the caller, and never a rejected invite (docs/specs/013-workspace/teams.md).
import { describe, expect, it } from 'vitest';
import type { TeamMember } from '@/lib/api-client';
import { teamMemberRows } from './team-member-rows';

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
  pictureUrl: null,
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
});
