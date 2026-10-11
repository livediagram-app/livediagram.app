// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Moving a slot": Escape, a cancelled pointer, or the page going away puts the slot
// back, with nothing moved and no listener left behind.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSlotMove } from './useSlotMove';

afterEach(() => vi.restoreAllMocks());

function setup() {
  const page = document.createElement('div');
  const onMove = vi.fn();
  const hook = renderHook(() =>
    useSlotMove({ pageRef: { current: page }, allowMove: () => () => true, onMove }),
  );
  act(() => hook.result.current.beginMove('s', { clientX: 10, clientY: 10 }));
  return { ...hook, onMove };
}

const pointer = (type: string) => {
  const e = new Event(type) as Event & { clientX: number; clientY: number };
  Object.assign(e, { clientX: 20, clientY: 20 });
  return e;
};

describe('a slot carried by its grip', () => {
  it('moves where it is let go', () => {
    const { result, onMove } = setup();
    expect(result.current.moving?.slotId).toBe('s');
    act(() => {
      window.dispatchEvent(pointer('pointerup'));
    });
    expect(onMove).toHaveBeenCalledWith('s', { kind: 'row-gap', index: 0 });
    expect(result.current.moving).toBeNull();
  });

  it('goes back when the pointer is cancelled, and a later tap moves nothing', () => {
    const { result, onMove } = setup();
    act(() => {
      window.dispatchEvent(pointer('pointercancel'));
    });
    expect(result.current.moving).toBeNull();
    act(() => {
      window.dispatchEvent(pointer('pointerup'));
    });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('goes back on Escape', () => {
    const { result, onMove } = setup();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.moving).toBeNull();
    act(() => {
      window.dispatchEvent(pointer('pointerup'));
    });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('takes its listeners with it when the page goes mid-move', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount, onMove } = setup();
    unmount();
    expect(remove.mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel', 'keydown']),
    );
    window.dispatchEvent(pointer('pointerup'));
    expect(onMove).not.toHaveBeenCalled();
  });
});
