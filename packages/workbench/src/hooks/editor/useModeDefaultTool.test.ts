// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FINE_POINTER_MEDIA_QUERY,
  PHONE_MEDIA_QUERY,
  TOUCH_FIRST_MEDIA_QUERY,
} from '../../lib/responsive';
import {
  modeDefaultTool,
  restingTool,
  startsOnHand,
  useModeDefaultTool,
} from './useModeDefaultTool';

const before = window.matchMedia;
// A device answering these media queries.
const device = (matching: readonly string[]) => {
  window.matchMedia = vi.fn((q: string) => ({ matches: matching.includes(q) }) as MediaQueryList);
};
afterEach(() => {
  window.matchMedia = before;
});

describe('modeDefaultTool', () => {
  it('starts on Select, and on Hand on a phone', () => {
    expect(modeDefaultTool(false)).toBe('select');
    expect(modeDefaultTool(true)).toBe('pan');
  });
});

describe('useModeDefaultTool', () => {
  it('picks the start tool once, Hand for an embedded viewer, and leaves a tool already right', () => {
    const setCanvasTool = vi.fn();
    const { rerender } = renderHook(
      ({ tool }: { tool: string }) => useModeDefaultTool(tool, setCanvasTool, true),
      { initialProps: { tool: 'pen' } },
    );
    expect(setCanvasTool).toHaveBeenCalledExactlyOnceWith('pan');
    rerender({ tool: 'text' });
    expect(setCanvasTool).toHaveBeenCalledOnce();
    const untouched = vi.fn();
    renderHook(() => useModeDefaultTool('select', untouched));
    expect(untouched).not.toHaveBeenCalled();
  });
});

describe('startsOnHand and restingTool', () => {
  it('start, and put a held tool down, on Hand on a phone or an iPad worked by finger', () => {
    device([TOUCH_FIRST_MEDIA_QUERY]);
    expect(startsOnHand()).toBe(true);
    expect(restingTool()).toBe('pan');
    device([PHONE_MEDIA_QUERY]);
    expect(restingTool()).toBe('pan');
  });

  it('keep Select with a trackpad or mouse attached, and on a desktop', () => {
    device([TOUCH_FIRST_MEDIA_QUERY, FINE_POINTER_MEDIA_QUERY]);
    expect(startsOnHand()).toBe(false);
    expect(restingTool()).toBe('select');
    device([FINE_POINTER_MEDIA_QUERY]);
    expect(restingTool()).toBe('select');
  });

  it('starts the editor on Hand on a touch-first screen', () => {
    device([TOUCH_FIRST_MEDIA_QUERY]);
    const setCanvasTool = vi.fn();
    renderHook(() => useModeDefaultTool('select', setCanvasTool));
    expect(setCanvasTool).toHaveBeenCalledExactlyOnceWith('pan');
  });
});
