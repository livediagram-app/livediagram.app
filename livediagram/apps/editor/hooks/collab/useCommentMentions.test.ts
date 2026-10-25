// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/012-collaboration/comment-mentions.md: the canvas's team's people are who a comment can mention (never
// yourself); a mention is counted, then the api asked to email the people it names.
const api = vi.hoisted(() => ({ apiTeamMembers: vi.fn(), apiNotifyMention: vi.fn() }));
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
  api.apiNotifyMention.mockResolvedValue(undefined);
});

function hook(ownerId: string | null = 'me', documentTeamId: string | null = 't1') {
  return renderHook(() =>
    useCommentMentions({
      ownerId,
      teams: [{ id: 't1', name: 'Team' }],
      documentTeamId,
      documentId: 'd1',
    }),
  );
}

describe('useCommentMentions', () => {
  it("offers the canvas's team's people, joined and invited, never yourself", async () => {
    const { result } = hook();
    await waitFor(() => expect(result.current.candidates).toHaveLength(2));
    expect(api.apiTeamMembers).toHaveBeenCalledWith('me', 't1');
    expect(result.current.available).toBe(true);
    expect(result.current.candidates.map((c) => [c.memberId, c.handle, c.pending])).toEqual([
      ['m2', 'priya', false],
      ['m3', 'm3', true],
    ]);
  });

  it('offers nobody on a personal canvas or to a guest', () => {
    expect(hook('me', null).result.current.available).toBe(false);
    expect(hook(null).result.current.candidates).toEqual([]);
    expect(api.apiTeamMembers).not.toHaveBeenCalled();
  });

  it('counts a mention and asks the api to email the people mentioned', async () => {
    const { result } = hook();
    await waitFor(() => expect(api.apiTeamMembers).toHaveBeenCalled());
    result.current.notifyMentioned('Hi @priya', mentions);
    expect(track).toHaveBeenCalledWith('Comment', 'Mentioned');
    expect(api.apiNotifyMention).toHaveBeenLastCalledWith('me', 't1', {
      documentId: 'd1',
      commentText: 'Hi @priya',
      mentions: [{ userId: 'u2', memberId: 'm2' }],
    });
  });

  it('counts but sends nothing for a guest, and does nothing without mentions', () => {
    const { result } = hook(null);
    result.current.notifyMentioned('Hi', mentions);
    expect(track).toHaveBeenCalledWith('Comment', 'Mentioned');
    expect(api.apiNotifyMention).not.toHaveBeenCalled();
    track.mockClear();
    result.current.notifyMentioned('Hi', []);
    expect(track).not.toHaveBeenCalled();
  });
});
