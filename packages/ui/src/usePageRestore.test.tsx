// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePageRestore } from './usePageRestore';

function pageshow(persisted: boolean) {
  const event = new Event('pageshow') as PageTransitionEvent;
  Object.defineProperty(event, 'persisted', { value: persisted });
  act(() => {
    window.dispatchEvent(event);
  });
}

describe('usePageRestore', () => {
  it('fires when the page comes back out of the back/forward cache', () => {
    const onRestore = vi.fn();
    renderHook(() => usePageRestore(onRestore));
    pageshow(true);
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it('ignores an ordinary load', () => {
    const onRestore = vi.fn();
    renderHook(() => usePageRestore(onRestore));
    pageshow(false);
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('calls the latest handler and stops listening once unmounted', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(({ fn }) => usePageRestore(fn), {
      initialProps: { fn: first },
    });
    rerender({ fn: second });
    pageshow(true);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    unmount();
    pageshow(true);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
