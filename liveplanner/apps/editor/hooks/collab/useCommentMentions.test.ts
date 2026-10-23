// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/012-collaboration/comment-mentions.md: teams are liveworkspace's and their members are not offered to
// apps yet, so there is nobody to suggest and no email to send; a mention is still counted.
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import { useCommentMentions } from './useCommentMentions';

const mentions = [{ userId: 'u2', name: 'Priya', handle: 'priya' }];

beforeEach(() => vi.clearAllMocks());

function hook(ownerId: string | null = 'me') {
  return renderHook(() =>
    useCommentMentions({
      ownerId,
      teams: [{ id: 't1', name: 'Team' }],
      projectTeamId: 't1',
      projectId: 'd1',
    }),
  );
}

describe('useCommentMentions', () => {
  it('offers nobody to mention', () => {
    const { result } = hook();
    expect(result.current.candidates).toEqual([]);
    expect(result.current.available).toBe(false);
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
