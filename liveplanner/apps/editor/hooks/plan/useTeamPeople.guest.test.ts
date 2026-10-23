// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { itemPersonId } from '@liveplanner/items';

// docs/specs/026-plan/items.md "Who may do what": a guest has no teams, so the editor never asks for them; signed
// in, the joined people of every team the token names are who a card can be assigned to.
const members = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', () => ({ apiTeamMembers: members }));

import { useTeamPeople } from './useTeamPeople';

afterEach(() => members.mockReset());

const member = (id: string, userId: string, name: string) => ({
  id,
  teamId: 't',
  userId,
  email: `${id}@x.test`,
  role: 'member',
  status: 'joined',
  name,
  createdAt: 0,
  updatedAt: 0,
});

describe('useTeamPeople', () => {
  it('never asks when nobody is signed in', async () => {
    renderHook(() => useTeamPeople('guest-1', true, false, [{ id: 't1' }]));
    await new Promise((r) => setTimeout(r, 0));
    expect(members).not.toHaveBeenCalled();
  });

  it("lists each team's joined people once, signed in on a plan with Plan content", async () => {
    members.mockImplementation(async (_owner: string, teamId: string) =>
      teamId === 't1'
        ? [member('a', 'user_a', 'Ada'), member('b', 'user_b', 'Bo')]
        : [member('a2', 'user_a', 'Ada')],
    );
    const teams = [{ id: 't1' }, { id: 't2' }];
    const { result } = renderHook(() => useTeamPeople('user_1', true, true, teams));
    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(members).toHaveBeenCalledWith('user_1', 't1');
    expect(members).toHaveBeenCalledWith('user_1', 't2');
    expect(result.current[0]!.id).toBe(await itemPersonId('user_a'));
  });
});
