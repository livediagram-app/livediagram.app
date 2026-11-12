// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MOTION_CEILING_MS } from '@liveworkspace/style-guards/motion';
import {
  SHEET_EXIT_FADE_MS,
  SHEET_EXIT_MAX_MS,
  SHEET_EXIT_MIN_MS,
  SHEET_FULL_HEIGHT,
  sheetExitMs,
  sheetExitTransition,
  sheetRelease,
  useSheetDrag,
} from './useSheetDrag';

// docs/specs/007-editor/editor-app.md "Mobile chrome": a sheet's handle fills the screen, returns or closes it.
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
    vi.useFakeTimers();
    act(() => result.current.handleProps.onPointerUp(press(el, 600, 2500)));
    // It slides out first (spec "Menus are bottom sheets on a phone"), from where it was let go, then closes once.
    expect(result.current.exiting).toBe(true);
    expect(result.current.style.transform).toBe('translateY(calc(100% + 24px))');
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(SHEET_EXIT_MAX_MS + 100);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('keeps the exit within its bounds, quicker after a faster flick, and under the motion ceiling', () => {
    expect(SHEET_EXIT_MAX_MS).toBeLessThanOrEqual(MOTION_CEILING_MS);
    expect(SHEET_EXIT_FADE_MS).toBeLessThanOrEqual(MOTION_CEILING_MS);
    expect(sheetExitTransition('opacity', 120)).toBe('opacity 120ms ease-out');
    expect(sheetExitMs(300, 0)).toBe(SHEET_EXIT_MAX_MS);
    expect(sheetExitMs(300, 0.5)).toBe(SHEET_EXIT_MAX_MS);
    expect(sheetExitMs(300, 1.4)).toBe(214);
    expect(sheetExitMs(300, 10)).toBe(SHEET_EXIT_MIN_MS);
    expect(sheetExitMs(-20, 1)).toBe(SHEET_EXIT_MIN_MS);
  });

  it('keeps the full height while a full sheet slides out, and gives a host that stayed open its sheet back', () => {
    vi.useFakeTimers();
    const kept = vi.fn();
    const { result } = renderHook(() => useSheetDrag(kept));
    const el = handle();
    act(() => result.current.handleProps.onPointerDown(press(el, 500, 0)));
    act(() => result.current.handleProps.onPointerUp(press(el, 400, 500)));
    act(() => {
      result.current.dismiss(el.parentElement);
    });
    expect(result.current.style.height).toBe(SHEET_FULL_HEIGHT);
    act(() => {
      vi.advanceTimersByTime(SHEET_EXIT_MAX_MS + 100);
    });
    expect(kept).toHaveBeenCalledOnce();
    expect(result.current.exiting).toBe(false);
    vi.useRealTimers();
  });

  it('opens at rest again in a host that stays mounted while closed (Dialog)', () => {
    const { result, rerender } = renderHook(({ open }) => useSheetDrag(() => {}, open), {
      initialProps: { open: true },
    });
    const el = handle();
    act(() => result.current.handleProps.onPointerDown(press(el, 500, 0)));
    act(() => result.current.handleProps.onPointerUp(press(el, 400, 500)));
    expect(result.current.expanded).toBe(true);
    rerender({ open: false });
    rerender({ open: true });
    expect(result.current.expanded).toBe(false);
    expect(result.current.style.height).toBeUndefined();
  });
});
