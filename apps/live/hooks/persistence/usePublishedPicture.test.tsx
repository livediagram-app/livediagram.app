// @vitest-environment jsdom
// The published picture and its writer (docs/specs/014-identity/profile-picture.md §4, §6).

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  state: { isSignedIn: true, user: { pictureUrl: 'https://img.clerk.com/me' as string | null } },
}));
vi.mock('@/components/providers/deferred-auth', () => ({ useDeferredAuth: () => auth.state }));
const api = vi.hoisted(() => ({ apiSetProfilePicture: vi.fn(async () => 200) }));
vi.mock('@/lib/api-client', () => api);

import {
  publishedPicture,
  resetPublishedPictureCache,
  usePublishPicture,
} from './usePublishedPicture';
import { SHOW_PROFILE_PICTURE_DEFAULT, writeUserPreferences } from '@/lib/user-preferences';

beforeEach(() => {
  localStorage.clear();
  resetPublishedPictureCache();
  api.apiSetProfilePicture.mockClear();
  auth.state = { isSignedIn: true, user: { pictureUrl: 'https://img.clerk.com/me' } };
});
afterEach(cleanup);

describe('publishedPicture', () => {
  it('shows the picture by default, and never for a guest or with the switch off', () => {
    expect(SHOW_PROFILE_PICTURE_DEFAULT).toBe(true);
    expect(publishedPicture(true, 'https://img.clerk.com/me', {})).toBe('https://img.clerk.com/me');
    expect(
      publishedPicture(true, 'https://img.clerk.com/me', { showProfilePicture: false }),
    ).toBeNull();
    expect(publishedPicture(false, 'https://img.clerk.com/me', {})).toBeNull();
    expect(publishedPicture(true, null, {})).toBeNull();
  });
});

describe('usePublishPicture', () => {
  it('writes the picture once, and clears it when the switch goes off', async () => {
    const { rerender } = renderHook(() => usePublishPicture('user_me'));
    await waitFor(() =>
      expect(api.apiSetProfilePicture).toHaveBeenCalledWith('user_me', 'https://img.clerk.com/me'),
    );
    rerender();
    expect(api.apiSetProfilePicture).toHaveBeenCalledTimes(1);
    act(() => writeUserPreferences({ showProfilePicture: false }));
    await waitFor(() => expect(api.apiSetProfilePicture).toHaveBeenLastCalledWith('user_me', null));
  });

  it('writes nothing for a guest', () => {
    renderHook(() => usePublishPicture(null));
    expect(api.apiSetProfilePicture).not.toHaveBeenCalled();
  });
});
