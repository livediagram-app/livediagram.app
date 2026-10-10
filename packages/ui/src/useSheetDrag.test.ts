// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SHEET_FULL_HEIGHT, sheetRelease, useSheetDrag } from './useSheetDrag';

// docs/specs/007-editor/live-app.md "Mobile chrome": a sheet's handle fills the screen, returns or closes it.
describe('sheetRelease', () => {
  it('from rest: up fills, far down closes, a little springs back', () => {
    expect(sheetRelease(false, -60, 0.1)).toBe('expand');
    expect(sheetRelease(false, -20, -1)).toBe('expand');
    expect(sheetRelease(false, 90, 0.1)).toBe('dismiss');
    expect(sheetRelease(false, 20, 1)).toBe('dismiss');
    expect(sheetRelease(false, 30, 0.1)).toBe('stay');
  });

  it('when full: down returns it to rest, never closes it', () => {
    expect(sheetRelease(true, 60, 0.1)).toBe('rest');
    expect(sheetRelease(true, 400, 2)).toBe('rest');
    expect(sheetRelease(true, -60, -1)).toBe('stay');
    expect(sheetRelease(true, 20, 0.1)).toBe('stay');
  });
});

describe('useSheetDrag', () => {
  const handle = () => {
    const sheet = document.createElement('div');
    sheet.getBoundingClientRect = () => ({ height: 300 }) as DOMRect;
    const el = document.createElement('div');
    sheet.appendChild(el);
    return el;
  };
  const press = (el: HTMLElement, y: number, t: number) =>
    ({ currentTarget: el, clientY: y, timeStamp: t, pointerId: 1 }) as never;

  it('grows with the finger, fills on release, and closes only from rest', () => {
    const onDismiss = vi.fn();
    const { result } = renderHook(() => useSheetDrag(onDismiss));
    const el = handle();
    act(() => result.current.handleProps.onPointerDown(press(el, 500, 0)));
    act(() => result.current.handleProps.onPointerMove(press(el, 400, 50)));
    expect(result.current.style.height).toBe(400);
    act(() => result.current.handleProps.onPointerUp(press(el, 400, 500)));
    expect(result.current.expanded).toBe(true);
    expect(result.current.style.height).toBe(SHEET_FULL_HEIGHT);
    act(() => result.current.handleProps.onPointerDown(press(el, 100, 1000)));
    act(() => result.current.handleProps.onPointerUp(press(el, 300, 1500)));
    expect(result.current.expanded).toBe(false);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => result.current.handleProps.onPointerDown(press(el, 500, 2000)));
    act(() => result.current.handleProps.onPointerMove(press(el, 560, 2050)));
    expect(result.current.style.transform).toBe('translateY(60px)');
    act(() => result.current.handleProps.onPointerUp(press(el, 600, 2500)));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
