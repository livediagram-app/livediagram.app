// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useToastFloor } from './useToastFloor';
import { TOAST_EDGE_PX, TOAST_FLOOR_GAP_PX, announceToastFloorChange } from './toast-floor';

// docs/specs/004-interface-design/toasts.md "Placement": the stack stands on the bottom chrome under it,
// measured while it shows and again when that chrome comes, goes or moves.
function chrome(attr: string, top: number, height = 48) {
  const el = document.createElement('div');
  el.setAttribute(attr, '');
  el.getBoundingClientRect = () =>
    ({ top, left: 0, right: window.innerWidth, width: window.innerWidth, height }) as DOMRect;
  document.body.append(el);
  return el;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('useToastFloor', () => {
  it('stays at the edge, measuring nothing, while the stack is empty', () => {
    chrome('data-editor-tabbar', window.innerHeight - 48);
    const { result } = renderHook(() => useToastFloor(false, 0));
    expect(result.current).toBe(TOAST_EDGE_PX);
  });

  it('stands on the bottom chrome, and follows a banner that comes and goes', () => {
    chrome('data-editor-tabbar', window.innerHeight - 48);
    const { result } = renderHook(() => useToastFloor(true, 1));
    expect(result.current).toBe(48 + TOAST_FLOOR_GAP_PX);
    const banner = chrome('data-toast-floor', window.innerHeight - 160, 100);
    act(() => announceToastFloorChange());
    expect(result.current).toBe(160 + TOAST_FLOOR_GAP_PX);
    banner.remove();
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(48 + TOAST_FLOOR_GAP_PX);
  });

  it('measures again when an animation lands, and stops listening once empty', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const view = renderHook(({ on }) => useToastFloor(on, 1), { initialProps: { on: true } });
    expect(add).toHaveBeenCalledWith('animationend', expect.any(Function), true);
    view.rerender({ on: false });
    expect(remove).toHaveBeenCalledWith('animationend', expect.any(Function), true);
    add.mockRestore();
    remove.mockRestore();
  });
});
