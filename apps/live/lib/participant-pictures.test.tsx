// @vitest-environment jsdom
// Comment authors' pictures (docs/specs/014-identity/profile-picture.md §5): looked up only for a
// signed-in viewer, once per author, and our own id answers with our own picture.

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  state: {
    isSignedIn: true,
    userId: 'user_me' as string | null,
    user: { pictureUrl: 'https://img.clerk.com/me' } as { pictureUrl: string | null } | null,
  },
}));
vi.mock('@/components/providers/deferred-auth', () => ({ useDeferredAuth: () => auth.state }));
const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/core', () => ({ API_BASE: '/api', apiFetch: fetchMock }));

import { resetParticipantPictures, useParticipantPicture } from './participant-pictures';

const reply = (pictureUrl: string | null) =>
  new Response(
    JSON.stringify({
      participant: { id: 'x', name: 'X', color: '#f00', createdAt: 0, pictureUrl },
    }),
  );

beforeEach(() => {
  resetParticipantPictures();
  fetchMock.mockReset();
  auth.state = {
    isSignedIn: true,
    userId: 'user_me',
    user: { pictureUrl: 'https://img.clerk.com/me' },
  };
});
afterEach(cleanup);

describe('useParticipantPicture', () => {
  it("fetches an author's picture once and shares it", async () => {
    fetchMock.mockResolvedValue(reply('https://img.clerk.com/ann'));
    const a = renderHook(() => useParticipantPicture('user_ann'));
    const b = renderHook(() => useParticipantPicture('user_ann'));
    await waitFor(() => expect(a.result.current).toBe('https://img.clerk.com/ann'));
    expect(b.result.current).toBe('https://img.clerk.com/ann');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never asks for an anonymous viewer', () => {
    auth.state = { isSignedIn: false, userId: null, user: null };
    const { result } = renderHook(() => useParticipantPicture('user_ann'));
    expect(result.current).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers our own id with our own picture, without a request', () => {
    const { result } = renderHook(() => useParticipantPicture('user_me'));
    expect(result.current).toBe('https://img.clerk.com/me');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a non-Clerk URL or a failed lookup as no picture', async () => {
    fetchMock.mockResolvedValueOnce(reply('https://evil.example/x.png'));
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const bad = renderHook(() => useParticipantPicture('user_eve'));
    const down = renderHook(() => useParticipantPicture('user_bob'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(bad.result.current).toBeNull();
    expect(down.result.current).toBeNull();
  });
});
