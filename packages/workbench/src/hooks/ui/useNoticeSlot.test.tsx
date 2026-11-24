// @vitest-environment jsdom
// The notice slot (liveworkspace/docs/specs/016-notifications/callouts.md): measured above the dock, or above the
// canvas's bottom where there is none; a notice on show holds it, a suggestion does not; remeasured on resize.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { noticeSlotHeld } from '../../lib/notice-slot';
import { useNoticeSlot } from './useNoticeSlot';

const box = (attr: string, rect: Partial<DOMRect>) => {
  const el = document.createElement('div');
  el.setAttribute(attr, '');
  el.getBoundingClientRect = () => ({ top: 0, bottom: 0, ...rect }) as DOMRect;
  document.body.appendChild(el);
  return el;
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('useNoticeSlot', () => {
  it('sits above the dock and holds the slot while active', () => {
    const observed: Element[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(el: Element) {
          observed.push(el);
        }
        disconnect() {}
      },
    );
    box('data-whiteboard-dock', { top: window.innerHeight - 60 });
    box('data-canvas-a11y-root', { bottom: window.innerHeight });
    const { result, rerender, unmount } = renderHook(({ on }) => useNoticeSlot(on), {
      initialProps: { on: true },
    });
    expect(result.current).toBe(68);
    expect(noticeSlotHeld()).toBe(true);
    expect(observed).toHaveLength(2);
    rerender({ on: false });
    expect(result.current).toBeNull();
    expect(noticeSlotHeld()).toBe(false);
    unmount();
  });

  it('lifts above the canvas without a dock, never holds the slot for a suggestion, and remeasures', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { result, unmount } = renderHook(() => useNoticeSlot(true, false));
    expect(noticeSlotHeld()).toBe(false);
    expect(result.current).toBe(76);
    box('data-canvas-a11y-root', { bottom: window.innerHeight - 100 });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(176);
    unmount();
  });
});
