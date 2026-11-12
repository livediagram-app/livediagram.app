// @vitest-environment jsdom
// /new backing out on a back/forward-cache restore (docs/specs/007-editor/new-document-route.md), until the new
// item has been handed to the editor.
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBackOutOnRestore } from './useBackOutOnRestore';

function pageShow(persisted: boolean) {
  const e = new Event('pageshow') as PageTransitionEvent;
  Object.defineProperty(e, 'persisted', { value: persisted });
  window.dispatchEvent(e);
}

function stubLocation(replace: (url: string) => void) {
  vi.stubGlobal('location', { ...window.location, origin: 'http://localhost', replace });
}

afterEach(() => vi.unstubAllGlobals());

describe('useBackOutOnRestore', () => {
  it('goes home on a restore with nowhere to go back to, and ignores a fresh load', () => {
    const replace = vi.fn();
    stubLocation(replace);
    renderHook(() => useBackOutOnRestore({ current: false }));
    pageShow(false);
    expect(replace).not.toHaveBeenCalled();
    pageShow(true);
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('goes back to the page of ours that opened /new', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    vi.spyOn(document, 'referrer', 'get').mockReturnValue('http://localhost/explorer');
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(3);
    stubLocation(vi.fn());
    renderHook(() => useBackOutOnRestore({ current: false }));
    pageShow(true);
    expect(back).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('stands down once handed off, and stops listening when unmounted', () => {
    const replace = vi.fn();
    stubLocation(replace);
    const handedOff = { current: true };
    const { unmount } = renderHook(() => useBackOutOnRestore(handedOff));
    pageShow(true);
    handedOff.current = false;
    unmount();
    pageShow(true);
    expect(replace).not.toHaveBeenCalled();
  });
});
