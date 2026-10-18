// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MIDNIGHT_PALETTE, useMidnightPalette } from './useMidnightPalette';

// docs/specs/004-interface-design/color-scheme.md "Explorer: Midnight": the root carries the palette while the
// Explorer is mounted, and loses it when the Explorer goes, so the editor keeps Steel.

afterEach(() => {
  delete document.documentElement.dataset.palette;
});

describe('useMidnightPalette', () => {
  it('marks the root while mounted and clears it on unmount', () => {
    const { unmount } = renderHook(() => useMidnightPalette());
    expect(document.documentElement.dataset.palette).toBe(MIDNIGHT_PALETTE);
    unmount();
    expect(document.documentElement.dataset.palette).toBeUndefined();
  });

  it('leaves a palette someone else set after it alone', () => {
    const { unmount } = renderHook(() => useMidnightPalette());
    document.documentElement.dataset.palette = 'other';
    unmount();
    expect(document.documentElement.dataset.palette).toBe('other');
  });
});
