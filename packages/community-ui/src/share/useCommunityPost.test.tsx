// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunityOwnPost, CommunityPostState } from '@liveworkspace/community';
import type { CommunityOwnerClient } from './host';
import { useCommunityPost } from './useCommunityPost';
import { COMMUNITY_APP_WORDS } from './words';

// The owner's post as the Share dialog reads it (liveworkspace/docs/specs/007-community/community.md "The Share
// dialog's Community tab"), and the state it reports as each read, publish and remove leaves it.

const words = COMMUNITY_APP_WORDS['livediagram.app'];

const api = {
  get: vi.fn<(doc: string) => Promise<CommunityOwnPost | null>>(),
  publish: vi.fn<(doc: string) => Promise<CommunityOwnPost>>(),
  remove: vi.fn<(doc: string) => Promise<void>>(),
};

// The client a host builds for one document.
const clientFor = (doc: string): CommunityOwnerClient => ({
  get: () => api.get(doc),
  publish: () => api.publish(doc),
  remove: () => api.remove(doc),
  popularTags: async () => [],
});

const states = new Map<string, CommunityPostState | null>();
const hook = (doc: string | null, open = true) =>
  useCommunityPost({
    client: clientFor(doc ?? ''),
    ownerId: 'user_a',
    documentId: doc,
    open,
    words,
    onStateChange: (state) => states.set(doc ?? '', state),
  });

const post = (id: string, state: CommunityOwnPost['state'] = 'listed') =>
  ({ id, state, title: id }) as CommunityOwnPost;

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  states.clear();
});

describe('useCommunityPost', () => {
  it('reads nothing while closed, then the post once open, reporting its state', async () => {
    api.get.mockResolvedValue(post('p1'));
    const { result, rerender } = renderHook((p: { open: boolean }) => hook('d1', p.open), {
      initialProps: { open: false },
    });
    expect(result.current).toMatchObject({ post: null, loading: false });
    expect(api.get).not.toHaveBeenCalled();

    rerender({ open: true });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.post?.id).toBe('p1'));
    expect(result.current.loading).toBe(false);
    expect(states.get('d1')).toBe('listed');
  });

  it('drops an answer for a document no longer open', async () => {
    let answerD1: (p: CommunityOwnPost) => void = () => {};
    api.get.mockImplementation((doc) =>
      doc === 'd1' ? new Promise((resolve) => (answerD1 = resolve)) : Promise.resolve(post('p2')),
    );
    const { result, rerender } = renderHook((p: { doc: string }) => hook(p.doc), {
      initialProps: { doc: 'd1' },
    });
    rerender({ doc: 'd2' });
    await waitFor(() => expect(result.current.post?.id).toBe('p2'));
    await act(async () => answerD1(post('p1')));
    expect(result.current.post?.id).toBe('p2');
    expect(states.has('d1')).toBe(false);
  });

  it('words a failed read, and publishes and removes through the client', async () => {
    api.get.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => hook('d1'));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    api.publish.mockResolvedValue(post('p9'));
    await act(async () => {
      await result.current.publish({} as never);
    });
    expect(result.current.post?.id).toBe('p9');
    expect(result.current.error).toBeNull();
    expect(states.get('d1')).toBe('listed');

    api.remove.mockResolvedValue(undefined);
    await act(async () => {
      await result.current.remove();
    });
    expect(result.current.post).toBeNull();
    expect(states.get('d1')).toBeNull();
  });

  it('cannot publish without a document', async () => {
    const { result } = renderHook(() => hook(null));
    await expect(result.current.publish({} as never)).rejects.toThrow('no document');
    await result.current.remove();
    expect(api.remove).not.toHaveBeenCalled();
  });
});
