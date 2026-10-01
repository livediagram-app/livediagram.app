// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFavourites } from './useFavourites';

const apiListFavourites = vi.fn<(ownerId: string) => Promise<string[]>>();
const apiSetFavourite = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiListFavourites: (ownerId: string) => apiListFavourites(ownerId),
  apiSetFavourite: (...a: unknown[]) => apiSetFavourite(...a),
}));

afterEach(() => vi.clearAllMocks());

// Per-user document favourites (docs/specs/013-workspace/favourites.md).
describe('useFavourites', () => {
  it('loads the stars for the owner', async () => {
    apiListFavourites.mockResolvedValue(['d1']);
    const { result } = renderHook(() => useFavourites('u1'));
    await waitFor(() => expect(result.current.favouriteIds).toEqual(new Set(['d1'])));
  });

  it('toggles optimistically, twice in a row', async () => {
    apiListFavourites.mockResolvedValue([]);
    const { result } = renderHook(() => useFavourites('u1'));
    await waitFor(() => expect(apiListFavourites).toHaveBeenCalled());
    act(() => {
      result.current.toggleFavourite('d1');
      result.current.toggleFavourite('d1');
    });
    expect(result.current.favouriteIds).toEqual(new Set());
    expect(apiSetFavourite.mock.calls).toEqual([
      ['u1', 'd1', true],
      ['u1', 'd1', false],
    ]);
  });

  it('drops every star when the owner goes away', async () => {
    apiListFavourites.mockResolvedValue(['d1']);
    const { result, rerender } = renderHook(({ owner }) => useFavourites(owner), {
      initialProps: { owner: 'u1' as string | null },
    });
    await waitFor(() => expect(result.current.favouriteIds.size).toBe(1));
    rerender({ owner: null });
    expect(result.current.favouriteIds).toEqual(new Set());
  });
});
