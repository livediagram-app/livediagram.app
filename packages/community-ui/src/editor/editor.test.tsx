import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getCommunityState,
  hasAutoCopyParam,
  itemIsPublic,
  readCommunityShareInfo,
  setCommunityState,
  useAutoCopyParam,
  useCommunityState,
  withoutAutoCopyParam,
} from './index';

// An app editor's Community pieces: Make a Copy's `?copy=1`, the post's state for the Public badge, and a
// community link's post.

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('hasAutoCopyParam / withoutAutoCopyParam', () => {
  it('reads only copy=1', () => {
    expect(hasAutoCopyParam('?s=abc&copy=1')).toBe(true);
    expect(hasAutoCopyParam('?s=abc&copy=0')).toBe(false);
    expect(hasAutoCopyParam('?s=abc')).toBe(false);
  });

  it('drops the parameter and keeps the rest of the address', () => {
    expect(withoutAutoCopyParam('https://x.test/project/shared?s=abc&copy=1#t')).toBe(
      '/project/shared?s=abc#t',
    );
  });
});

describe('useAutoCopyParam', () => {
  it('waits for hydration, then copies once and strips the parameter', () => {
    window.history.replaceState(null, '', '/project/shared?s=abc&copy=1');
    const makeCopy = vi.fn();
    const { rerender } = renderHook((props) => useAutoCopyParam(props), {
      initialProps: {
        hydrated: false,
        sessionShareCode: null as string | null,
        community: true,
        makeCopy,
      },
    });
    expect(makeCopy).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?s=abc&copy=1');

    rerender({ hydrated: true, sessionShareCode: 'abc', community: true, makeCopy });
    expect(makeCopy).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe('?s=abc');

    rerender({ hydrated: true, sessionShareCode: 'abc', community: true, makeCopy: vi.fn() });
    expect(makeCopy).toHaveBeenCalledTimes(1);
  });

  it('only strips the parameter for an owner, who has nothing to copy', () => {
    window.history.replaceState(null, '', '/project/shared?s=abc&copy=1');
    const makeCopy = vi.fn();
    renderHook(() =>
      useAutoCopyParam({ hydrated: true, sessionShareCode: null, community: true, makeCopy }),
    );
    expect(makeCopy).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?s=abc');
  });

  it('does nothing without the parameter', () => {
    window.history.replaceState(null, '', '/project/shared?s=abc');
    const makeCopy = vi.fn();
    renderHook(() =>
      useAutoCopyParam({ hydrated: true, sessionShareCode: 'abc', community: true, makeCopy }),
    );
    expect(makeCopy).not.toHaveBeenCalled();
  });

  it('never copies through a share link that is not a Community post (a crafted ?copy=1)', () => {
    window.history.replaceState(null, '', '/project/shared?s=abc&copy=1');
    const makeCopy = vi.fn();
    renderHook(() =>
      useAutoCopyParam({ hydrated: true, sessionShareCode: 'abc', community: false, makeCopy }),
    );
    expect(makeCopy).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?s=abc');
  });
});

describe('the community state store', () => {
  it('holds each item’s state and tells its readers when it changes', () => {
    const { result } = renderHook(() => useCommunityState('p1'));
    expect(result.current).toBeNull();
    act(() => setCommunityState('p1', 'listed'));
    expect(result.current).toBe('listed');
    // The same state again notifies nobody.
    act(() => setCommunityState('p1', 'listed'));
    expect(getCommunityState('p1')).toBe('listed');
    expect(getCommunityState(null)).toBeNull();
    expect(getCommunityState('p2')).toBeNull();
    act(() => setCommunityState('p1', null));
    expect(result.current).toBeNull();
  });
});

describe('itemIsPublic', () => {
  it('is Public for a listed post while the Community is on, and for a community visitor', () => {
    expect(itemIsPublic({ communityOn: true, ownPostState: 'listed', communitySession: false })).toBe(
      true,
    );
    expect(
      itemIsPublic({ communityOn: false, ownPostState: 'listed', communitySession: false }),
    ).toBe(false);
    expect(itemIsPublic({ communityOn: true, ownPostState: 'hidden', communitySession: false })).toBe(
      false,
    );
    expect(itemIsPublic({ communityOn: true, ownPostState: null, communitySession: true })).toBe(
      true,
    );
  });
});

describe('readCommunityShareInfo', () => {
  it('reads a community link and fills a missing author', () => {
    expect(readCommunityShareInfo({ postId: 'p1', author: { name: '', color: '' } })).toEqual({
      postId: 'p1',
      author: { name: 'Someone', color: '#64748b', picture: null },
    });
    expect(
      readCommunityShareInfo({
        postId: 'p1',
        author: { name: 'Ada', color: '#f97316', picture: 'https://x.test/a.png' },
      }),
    ).toEqual({
      postId: 'p1',
      author: { name: 'Ada', color: '#f97316', picture: 'https://x.test/a.png' },
    });
  });

  it('is null for an ordinary link or a malformed field', () => {
    expect(readCommunityShareInfo(undefined)).toBeNull();
    expect(readCommunityShareInfo({ postId: 'p1' })).toBeNull();
    expect(readCommunityShareInfo('p1')).toBeNull();
  });
});
