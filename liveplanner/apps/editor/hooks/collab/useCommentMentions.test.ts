// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/012-collaboration/comment-mentions.md: the plan's team's people are who a comment can mention (never
// yourself), and a mention is counted. The email is the api's, sent from the stored comment, so nothing is asked.
const api = vi.hoisted(() => ({ apiTeamMembers: vi.fn() }));
vi.mock('@/lib/api-client', () => api);
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import { useCommentMentions } from './useCommentMentions';

const member = (id: string, userId: string | null, name: string | null, status = 'joined') => ({
  id,
  teamId: 't1',
  userId,
  email: `${id}@x.test`,
  role: 'member',
  status,
  name,
  createdAt: 0,
  updatedAt: 0,
});
const mentions = [{ userId: 'u2', memberId: 'm2', name: 'Priya', handle: 'priya' }];

beforeEach(() => {
  vi.clearAllMocks();
  api.apiTeamMembers.mockResolvedValue([
    member('m1', 'me', 'Me'),
    member('m2', 'u2', 'Priya'),
    member('m3', null, null, 'invited'),
  ]);
});

function hook(ownerId: string | null = 'me', projectTeamId: string | null = 't1') {
  return renderHook(() =>
    useCommentMentions({
      ownerId,
      teams: [{ id: 't1', name: 'Team' }],
      projectTeamId,
      projectId: 'd1',
    }),
  );
}

describe('useCommentMentions', () => {
  it("offers the plan's team's people, joined and invited, never yourself", async () => {
    const { result } = hook();
    await waitFor(() => expect(result.current.candidates).toHaveLength(2));
    expect(api.apiTeamMembers).toHaveBeenCalledWith('me', 't1');
    expect(result.current.available).toBe(true);
    expect(result.current.candidates.map((c) => [c.memberId, c.handle, c.pending])).toEqual([
      ['m2', 'priya', false],
      ['m3', 'm3', true],
    ]);
  });

  it('offers nobody on a personal plan or to a guest', () => {
    expect(hook('me', null).result.current.available).toBe(false);
    expect(hook(null).result.current.candidates).toEqual([]);
    expect(api.apiTeamMembers).not.toHaveBeenCalled();
  });

  it('counts a mention, and nothing without one', () => {
    const { result } = hook();
    result.current.notifyMentioned('Hi @priya', mentions, 'item-one', 'c1');
    expect(track).toHaveBeenCalledWith('Comment', 'Mentioned');
    track.mockClear();
    result.current.notifyMentioned('Hi', []);
    expect(track).not.toHaveBeenCalled();
  });
});
