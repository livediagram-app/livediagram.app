// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { itemPersonId } from '@liveplanner/items';

// docs/specs/026-plan/items.md "Who may do what": a guest has no teams, so the editor never asks for them; signed
// in, the joined people of the plan's team (when the token names it) are who a card can be assigned to, never the
// people of your other teams.
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
    renderHook(() => useTeamPeople('guest-1', true, false, [{ id: 't1' }], 't1'));
    await new Promise((r) => setTimeout(r, 0));
    expect(members).not.toHaveBeenCalled();
  });

  it('never asks while the plan has no Plan content', async () => {
    const { result } = renderHook(() => useTeamPeople('user_1', false, true, [{ id: 't1' }], 't1'));
    await new Promise((r) => setTimeout(r, 0));
    expect(members).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });

  it("lists only the plan's team's joined people, once each", async () => {
    members.mockImplementation(async (_owner: string, teamId: string) =>
      teamId === 't1'
        ? [member('a', 'user_a', 'Ada'), member('b', 'user_b', 'Bo'), member('a2', 'user_a', 'Ada')]
        : [member('c', 'user_c', 'Cy')],
    );
    const teams = [{ id: 't1' }, { id: 't2' }];
    const { result } = renderHook(() => useTeamPeople('user_1', true, true, teams, 't1'));
    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(members).toHaveBeenCalledTimes(1);
    expect(members).toHaveBeenCalledWith('user_1', 't1');
    expect(result.current.map((p) => p.name)).toEqual(['Ada', 'Bo']);
    expect(result.current[0]!.id).toBe(await itemPersonId('user_a'));
  });

  it('asks for nobody on a plan with no team (My Work, This Browser), whatever teams you are in', async () => {
    const { result } = renderHook(() =>
      useTeamPeople('user_1', true, true, [{ id: 't1' }, { id: 't2' }], null),
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(members).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });

  it("asks for nobody when the plan's team is not one your sign-in names", async () => {
    const { result } = renderHook(() => useTeamPeople('user_1', true, true, [{ id: 't1' }], 't9'));
    await new Promise((r) => setTimeout(r, 0));
    expect(members).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });

  it("drops the old team's people when the plan leaves its team, and keeps the list on a failed load", async () => {
    members.mockResolvedValueOnce([member('a', 'user_a', 'Ada')]);
    const teams = [{ id: 't1' }, { id: 't2' }];
    const start: { team: string | null } = { team: 't1' };
    const { result, rerender } = renderHook(
      ({ team }) => useTeamPeople('user_1', true, true, teams, team),
      { initialProps: start },
    );
    await waitFor(() => expect(result.current).toHaveLength(1));
    rerender({ team: null });
    expect(result.current).toEqual([]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    members.mockRejectedValueOnce(new Error('offline'));
    rerender({ team: 't2' });
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(result.current).toEqual([]);
    warn.mockRestore();
  });
});
