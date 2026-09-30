// @vitest-environment jsdom
// Comment authors' pictures (docs/specs/014-identity/profile-picture.md §5, §6): asked for by
// comment id, only by a signed-in reader, once per new comment; our own comments show our own.

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  state: {
    isSignedIn: true,
    userId: 'user_bob' as string | null,
    user: { pictureUrl: 'https://img.clerk.com/bob' } as { pictureUrl: string | null } | null,
  },
}));
vi.mock('@/components/providers/deferred-auth', () => ({ useDeferredAuth: () => auth.state }));
const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/core', () => ({
  API_BASE: '/api',
  apiFetch: fetchMock,
  apiHeaders: async (_o: string, opts: { share?: string | null }) =>
    opts.share ? { 'X-Share-Code': opts.share } : {},
}));

import {
  resetCommentPictures,
  useCommentAuthorPicture,
  useCommentPicturesLoader,
} from './comment-pictures';

const thread = (...ids: string[]) =>
  [
    {
      id: 'e',
      commentThread: { resolved: false, comments: ids.map((id) => ({ id })) },
    },
  ] as never;

beforeEach(() => {
  resetCommentPictures();
  fetchMock.mockReset();
  auth.state = {
    isSignedIn: true,
    userId: 'user_bob',
    user: { pictureUrl: 'https://img.clerk.com/bob' },
  };
});
afterEach(cleanup);

describe('comment pictures', () => {
  it('loads the tab once, with the share code, and serves each comment its picture', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          pictures: { c1: 'https://img.clerk.com/ann', c2: 'https://evil.example/x' },
        }),
      ),
    );
    const { rerender } = renderHook(() =>
      useCommentPicturesLoader('d1', 't1', thread('c1', 'c2'), 'CODE'),
    );
    const c1 = renderHook(() => useCommentAuthorPicture('c1', undefined));
    const c2 = renderHook(() => useCommentAuthorPicture('c2', undefined));
    await waitFor(() => expect(c1.result.current).toBe('https://img.clerk.com/ann'));
    expect(c2.result.current).toBeNull();
    rerender();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/documents/d1/tabs/t1/comment-pictures');
    expect(fetchMock.mock.calls[0]![1]).toEqual({ headers: { 'X-Share-Code': 'CODE' } });
  });

  it('asks again only when a new comment appears', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ pictures: {} })));
    let elements = thread('c1');
    const { rerender } = renderHook(() => useCommentPicturesLoader('d1', 't1', elements, null));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    elements = thread('c1', 'c3');
    rerender();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('never asks for an anonymous reader, and shows them nothing', () => {
    auth.state = { isSignedIn: false, userId: null, user: null };
    renderHook(() => useCommentPicturesLoader('d1', 't1', thread('c1'), 'CODE'));
    const c1 = renderHook(() => useCommentAuthorPicture('c1', undefined));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(c1.result.current).toBeNull();
  });

  it('shows our own picture on our own comments', () => {
    const mine = renderHook(() => useCommentAuthorPicture('c9', 'user_bob'));
    expect(mine.result.current).toBe('https://img.clerk.com/bob');
  });
});
