// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The notify a mentioning comment fires (docs/specs/012-collaboration/comment-mentions.md "The email"): counted
// once, then the api asked to email; a Plan card's comment names its card so the email opens it.
const api = vi.hoisted(() => ({ apiGetTeam: vi.fn(), apiNotifyMention: vi.fn() }));
vi.mock('@/lib/api-client', () => api);
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import { useCommentMentions } from './useCommentMentions';

const team = { id: 't1', name: 'Team' } as never;
const mentions = [{ userId: 'u2', memberId: 'm2', name: 'Priya', handle: 'priya' }];

beforeEach(() => {
  vi.clearAllMocks();
  api.apiGetTeam.mockResolvedValue({ members: [] });
  api.apiNotifyMention.mockResolvedValue(undefined);
});

function hook(ownerId: string | null = 'me') {
  return renderHook(() =>
    useCommentMentions({ ownerId, teams: [team], documentTeamId: 't1', documentId: 'd1' }),
  );
}

describe('useCommentMentions notify', () => {
  it("names the card for a card's comment, and nothing more for a canvas one", async () => {
    const { result } = hook();
    await waitFor(() => expect(api.apiGetTeam).toHaveBeenCalled());
    result.current.notifyMentioned('Hi @priya', mentions, 'item-one', 'c1');
    expect(track).toHaveBeenCalledWith('Comment', 'Mentioned');
    expect(api.apiNotifyMention).toHaveBeenCalledWith('me', 't1', {
      documentId: 'd1',
      commentText: 'Hi @priya',
      mentions: [{ userId: 'u2', memberId: 'm2' }],
      itemId: 'item-one',
      commentId: 'c1',
    });
    result.current.notifyMentioned('Hi @priya', mentions);
    expect(api.apiNotifyMention).toHaveBeenLastCalledWith('me', 't1', {
      documentId: 'd1',
      commentText: 'Hi @priya',
      mentions: [{ userId: 'u2', memberId: 'm2' }],
    });
  });

  it('counts but sends nothing for a guest, and does nothing without mentions', () => {
    const { result } = hook(null);
    result.current.notifyMentioned('Hi', mentions, 'item-one');
    expect(track).toHaveBeenCalledWith('Comment', 'Mentioned');
    expect(api.apiNotifyMention).not.toHaveBeenCalled();
    track.mockClear();
    result.current.notifyMentioned('Hi', []);
    expect(track).not.toHaveBeenCalled();
  });
});
