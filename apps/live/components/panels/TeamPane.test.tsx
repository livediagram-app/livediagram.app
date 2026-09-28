// @vitest-environment jsdom

// The Explorer's team pane (docs/specs/013-workspace/teams.md) loads its team once per team: a caller
// re-render (a new inline callback) never drops it back to the skeleton or refetches, while
// switching team does both.

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TeamDetailResponse } from '@/lib/api/teams';
import { TeamPane } from './TeamPane';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('./ScopedTimeline', () => ({ TeamTimeline: () => null }));
vi.mock('@/components/panels/TeamSharedDiagrams', () => ({ TeamSharedDiagrams: () => null }));

const getTeam = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', () => ({ apiGetTeam: getTeam }));

const detail = (id: string, organisation: string): TeamDetailResponse =>
  ({
    team: { id, name: id, organisation },
    members: [],
    myRole: 'member',
    inviteLink: null,
  }) as unknown as TeamDetailResponse;

type Props = Parameters<typeof TeamPane>[0];
const pane = (over: Partial<Props> = {}) => (
  <TeamPane
    ownerId="me"
    teamId="t1"
    clerkUserId="me"
    clerkDisplayName="Ada"
    onTeamsChanged={() => {}}
    onLeftTeam={() => {}}
    onLoadResult={() => {}}
    {...over}
  />
);

afterEach(() => {
  cleanup();
  getTeam.mockReset();
});

describe('TeamPane loading', () => {
  it('keeps the loaded team through a caller re-render with new callbacks', async () => {
    getTeam.mockResolvedValue(detail('t1', 'ACME'));
    const { rerender } = render(pane());
    await act(async () => {});
    expect(screen.getByText(/ACME/)).toBeTruthy();
    const onLoadResult = vi.fn();
    rerender(pane({ onLoadResult }));
    await act(async () => {});
    expect(screen.getByText(/ACME/)).toBeTruthy();
    expect(getTeam).toHaveBeenCalledTimes(1);
  });

  it('reports the result to the newest callback', async () => {
    let resolve: (d: TeamDetailResponse) => void = () => {};
    getTeam.mockReturnValue(new Promise((r) => (resolve = r)));
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(pane({ onLoadResult: first }));
    rerender(pane({ onLoadResult: latest }));
    await act(async () => resolve(detail('t1', 'ACME')));
    expect(latest).toHaveBeenCalledWith(true);
  });

  it('ignores a late reply for the team it has left', async () => {
    let resolveOld: (d: TeamDetailResponse) => void = () => {};
    getTeam.mockReturnValueOnce(new Promise((r) => (resolveOld = r)));
    getTeam.mockResolvedValueOnce(detail('t2', 'Globex'));
    const { rerender } = render(pane());
    rerender(pane({ teamId: 't2' }));
    await act(async () => {});
    await act(async () => resolveOld(detail('t1', 'ACME')));
    expect(screen.getByText(/Globex/)).toBeTruthy();
    expect(screen.queryByText(/ACME/)).toBeNull();
  });

  it('reloads from the skeleton when the team changes', async () => {
    getTeam.mockResolvedValueOnce(detail('t1', 'ACME'));
    let resolve: (d: TeamDetailResponse) => void = () => {};
    getTeam.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { rerender } = render(pane());
    await act(async () => {});
    rerender(pane({ teamId: 't2' }));
    expect(screen.queryByText(/ACME/)).toBeNull();
    await act(async () => resolve(detail('t2', 'Globex')));
    expect(screen.getByText(/Globex/)).toBeTruthy();
    expect(getTeam).toHaveBeenLastCalledWith('me', 't2');
  });
});
