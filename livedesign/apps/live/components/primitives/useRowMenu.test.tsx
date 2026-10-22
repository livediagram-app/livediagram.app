// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useRowMenu } from './useRowMenu';

const mouse = () =>
  ({ preventDefault: vi.fn(), stopPropagation: vi.fn() }) as unknown as MouseEvent & {
    preventDefault: ReturnType<typeof vi.fn>;
    stopPropagation: ReturnType<typeof vi.fn>;
  };

describe('useRowMenu', () => {
  it('starts closed, with the trigger reporting it', () => {
    const { result } = renderHook(() => useRowMenu());
    expect(result.current.open).toBe(false);
    expect(result.current.triggerProps.expanded).toBe(false);
  });

  it('toggles from the trigger without letting the click reach the row', () => {
    const { result } = renderHook(() => useRowMenu());
    const e = mouse();
    act(() => result.current.triggerProps.onClick(e));
    expect(result.current.open).toBe(true);
    expect(result.current.triggerProps.expanded).toBe(true);
    expect(e.stopPropagation).toHaveBeenCalled();
    act(() => result.current.triggerProps.onClick(mouse()));
    expect(result.current.open).toBe(false);
  });

  // docs/specs/004-interface-design/menus.md: Down or Up Arrow on the trigger opens it too.
  it('opens on Down or Up Arrow from the trigger, and ignores other keys', () => {
    const { result } = renderHook(() => useRowMenu());
    const key = (k: string) =>
      ({ key: k, preventDefault: vi.fn(), stopPropagation: vi.fn() }) as unknown as KeyboardEvent;
    act(() => result.current.triggerProps.onKeyDown(key('a')));
    expect(result.current.open).toBe(false);
    const down = key('ArrowDown');
    act(() => result.current.triggerProps.onKeyDown(down));
    expect(result.current.open).toBe(true);
    expect(down.preventDefault).toHaveBeenCalled();
    act(() => result.current.close());
    act(() => result.current.triggerProps.onKeyDown(key('ArrowUp')));
    expect(result.current.open).toBe(true);
  });

  it('opens on right-click, replacing the browser menu', () => {
    const { result } = renderHook(() => useRowMenu());
    const e = mouse();
    act(() => result.current.onContextMenu?.(e));
    expect(result.current.open).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('leaves the browser menu alone while disabled (a rename in progress)', () => {
    const { result } = renderHook(() => useRowMenu({ disabled: true }));
    expect(result.current.onContextMenu).toBeUndefined();
  });

  it('closes', () => {
    const { result } = renderHook(() => useRowMenu());
    act(() => result.current.onContextMenu?.(mouse()));
    act(() => result.current.close());
    expect(result.current.open).toBe(false);
  });

  it('hands the trigger ref through for the menu anchor', () => {
    const { result } = renderHook(() => useRowMenu());
    expect(result.current.triggerProps.ref).toBe(result.current.triggerRef);
  });
});
