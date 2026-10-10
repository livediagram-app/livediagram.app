// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  paletteSearchOpen,
  setPaletteSearchOpen,
  usePaletteSearchOpen,
} from './palette-search-open';

// The palette's open Search is shared with the top-centre stack, which stands its timer aside.
describe('palette search open store', () => {
  it('tells subscribers when the Search opens and closes, and only on a change', () => {
    const { result } = renderHook(() => usePaletteSearchOpen());
    expect(result.current).toBe(false);
    act(() => setPaletteSearchOpen(true));
    expect(result.current).toBe(true);
    expect(paletteSearchOpen()).toBe(true);
    const spy = vi.fn();
    const { result: again } = renderHook(() => {
      spy();
      return usePaletteSearchOpen();
    });
    const renders = spy.mock.calls.length;
    act(() => setPaletteSearchOpen(true));
    expect(spy.mock.calls.length).toBe(renders);
    act(() => setPaletteSearchOpen(false));
    expect(again.current).toBe(false);
  });
});
