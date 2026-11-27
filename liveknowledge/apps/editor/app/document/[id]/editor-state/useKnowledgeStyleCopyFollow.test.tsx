// @vitest-environment jsdom
// The last seen copy follows the Knowledgebase Style (page-surface.md "Themed from the first frame", Work Tracker
// 1521): a change after the open is followed, the style the open read is not written again.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_KNOWLEDGE_STYLE } from '@liveknowledge/document';
import { knowledgeStyleStore } from '@/lib/knowledge-style/knowledge-style-store';
import { useKnowledgeStyleCopyFollow } from './useKnowledgeStyleCopyFollow';

afterEach(() => knowledgeStyleStore.clear());

const steel = { ...DEFAULT_KNOWLEDGE_STYLE, theme: 'steel' };
const midnight = { ...DEFAULT_KNOWLEDGE_STYLE, theme: 'midnight' };

function setup(following = true, documentId: string | null = 'd1') {
  const follower = { followItem: vi.fn() };
  knowledgeStyleStore.take('d1', steel);
  const view = renderHook(
    (p: { following: boolean; documentId: string | null }) =>
      useKnowledgeStyleCopyFollow({ follower, reader: 'me', ...p }),
    { initialProps: { following, documentId } },
  );
  return { follower, ...view };
}

describe('useKnowledgeStyleCopyFollow', () => {
  it('writes nothing for the style the open read, then follows each change after it', () => {
    const { follower } = setup();
    expect(follower.followItem).not.toHaveBeenCalled();
    act(() => void knowledgeStyleStore.take('d1', midnight));
    expect(follower.followItem).toHaveBeenCalledTimes(1);
    expect(follower.followItem).toHaveBeenCalledWith('me', 'd1', {
      knowledgeStyle: expect.objectContaining({ theme: 'midnight' }),
    });
  });

  it('follows nothing while the copy is not followed, or with no knowledgebase', () => {
    const { follower, rerender } = setup(false);
    act(() => void knowledgeStyleStore.take('d1', midnight));
    rerender({ following: true, documentId: null });
    act(() => void knowledgeStyleStore.take('d1', steel));
    expect(follower.followItem).not.toHaveBeenCalled();
  });

  it('starts again for another knowledgebase', () => {
    const { follower, rerender } = setup();
    knowledgeStyleStore.take('d2', midnight);
    rerender({ following: true, documentId: 'd2' });
    expect(follower.followItem).not.toHaveBeenCalled();
  });
});
