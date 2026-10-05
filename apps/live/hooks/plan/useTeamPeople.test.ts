import { describe, expect, it } from 'vitest';
import { itemPersonId } from '@livediagram/items';
import type { TeamMember } from '@livediagram/api-schema';
import { teamMemberPerson } from './useTeamPeople';

// docs/specs/026-plan/items.md "Who may do what": assignees are your teams' joined members.
const member = (over: Partial<TeamMember>): TeamMember => ({
  id: 'm',
  teamId: 't',
  userId: 'user_1',
  email: 'sam@example.com',
  role: 'member',
  status: 'joined',
  name: 'Sam Lee',
  pictureUrl: null,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

describe('teamMemberPerson', () => {
  it('names a joined member as items do', async () => {
    const p = await teamMemberPerson(member({}));
    expect(p).toMatchObject({ id: await itemPersonId('user_1'), name: 'Sam Lee' });
    expect(p?.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('falls back to the invite address, and leaves out pending invites', async () => {
    expect((await teamMemberPerson(member({ name: null })))?.name).toBe('sam');
    expect(await teamMemberPerson(member({ status: 'invited' }))).toBeNull();
    expect(await teamMemberPerson(member({ userId: null }))).toBeNull();
  });
});
