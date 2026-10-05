// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunityOwnPost } from '@livediagram/api-schema';

// The owner's post as the Share dialog reads it (docs/specs/025-community/community.md "Publishing"), and the header
// badge's store it keeps in step.

const api = vi.hoisted(() => ({
  apiGetCommunityPost: vi.fn(),
  apiPublishCommunityPost: vi.fn(),
  apiRemoveCommunityPost: vi.fn(),
}));
vi.mock('@/lib/api-client', () => api);

import { getCommunityState, setCommunityState } from '@/lib/community-state-store';
import { useCommunityPost } from './useCommunityPost';

const post = (id: string, state: CommunityOwnPost['state'] = 'listed') =>
  ({ id, state, title: id }) as CommunityOwnPost;

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  setCommunityState('d1', null);
  setCommunityState('d2', null);
});

describe('useCommunityPost', () => {
  it('reads nothing while closed, then the post once open, keeping the badge in step', async () => {
    api.apiGetCommunityPost.mockResolvedValue(post('p1'));
    const { result, rerender } = renderHook(
      (p: { open: boolean }) =>
        useCommunityPost({ ownerId: 'user_a', documentId: 'd1', open: p.open }),
      { initialProps: { open: false } },
    );
    expect(result.current).toMatchObject({ post: null, loading: false });
    expect(api.apiGetCommunityPost).not.toHaveBeenCalled();

    rerender({ open: true });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.post?.id).toBe('p1'));
    expect(result.current.loading).toBe(false);
    expect(getCommunityState('d1')).toBe('listed');
  });

  it('drops an answer for a document no longer open', async () => {
    let answerD1: (p: CommunityOwnPost) => void = () => {};
    api.apiGetCommunityPost.mockImplementation((_owner: string, doc: string) =>
      doc === 'd1' ? new Promise((resolve) => (answerD1 = resolve)) : Promise.resolve(post('p2')),
    );
    const { result, rerender } = renderHook(
      (p: { doc: string }) =>
        useCommunityPost({ ownerId: 'user_a', documentId: p.doc, open: true }),
      { initialProps: { doc: 'd1' } },
    );
    rerender({ doc: 'd2' });
    await waitFor(() => expect(result.current.post?.id).toBe('p2'));
    await act(async () => answerD1(post('p1')));
    expect(result.current.post?.id).toBe('p2');
    expect(getCommunityState('d1')).toBeNull();
  });

  it('words a failed read, and publishes and removes through the api', async () => {
    api.apiGetCommunityPost.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() =>
      useCommunityPost({ ownerId: 'user_a', documentId: 'd1', open: true }),
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());

    api.apiPublishCommunityPost.mockResolvedValue(post('p9'));
    await act(async () => {
      await result.current.publish({} as never);
    });
    expect(result.current.post?.id).toBe('p9');
    expect(result.current.error).toBeNull();
    expect(getCommunityState('d1')).toBe('listed');

    api.apiRemoveCommunityPost.mockResolvedValue(undefined);
    await act(async () => {
      await result.current.remove();
    });
    expect(result.current.post).toBeNull();
    expect(getCommunityState('d1')).toBeNull();
  });

  it('cannot publish without a document', async () => {
    const { result } = renderHook(() =>
      useCommunityPost({ ownerId: 'user_a', documentId: null, open: true }),
    );
    await expect(result.current.publish({} as never)).rejects.toThrow('no document');
    await result.current.remove();
    expect(api.apiRemoveCommunityPost).not.toHaveBeenCalled();
  });
});
