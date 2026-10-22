// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  palettePopoverOpen,
  setPalettePopoverOpen,
  usePalettePopoverOpen,
} from './palette-popover-open';

// docs/specs/007-editor/start-panel.md "When it shows": the start steps aside while a palette popover is open.
describe('palette popover open', () => {
  afterEach(() => setPalettePopoverOpen(false));

  it('starts closed and follows what the palette publishes', () => {
    const { result } = renderHook(() => usePalettePopoverOpen());
    expect(result.current).toBe(false);
    act(() => setPalettePopoverOpen(true));
    expect(result.current).toBe(true);
    expect(palettePopoverOpen()).toBe(true);
    act(() => setPalettePopoverOpen(false));
    expect(result.current).toBe(false);
  });

  it('does not re-render on a repeat of the same state', () => {
    let renders = 0;
    renderHook(() => {
      renders++;
      return usePalettePopoverOpen();
    });
    act(() => setPalettePopoverOpen(false));
    expect(renders).toBe(1);
  });
});
