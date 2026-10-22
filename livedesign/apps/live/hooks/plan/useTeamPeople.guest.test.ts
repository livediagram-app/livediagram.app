// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTeamPeople } from './useTeamPeople';

// docs/specs/026-plan/items.md "Who may do what": a guest has no teams, so the editor never asks for them
// (the 401 it earned was logged by the browser on every load).
const listTeams = vi.fn(async () => []);
vi.mock('@/lib/api/teams', () => ({
  apiListTeams: (...a: unknown[]) => listTeams(...(a as [])),
  apiGetTeam: vi.fn(),
}));

afterEach(() => listTeams.mockClear());

describe('useTeamPeople', () => {
  it('never asks for teams when nobody is signed in', async () => {
    renderHook(() => useTeamPeople('guest-1', true, false));
    await new Promise((r) => setTimeout(r, 0));
    expect(listTeams).not.toHaveBeenCalled();
  });

  it('asks once signed in, on a document with Plan content', async () => {
    renderHook(() => useTeamPeople('user_1', true, true));
    await waitFor(() => expect(listTeams).toHaveBeenCalledWith('user_1'));
  });
});
