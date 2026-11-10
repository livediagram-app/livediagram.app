// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { planPalette } from '@liveplanner/project';
import { useStartPalette } from './useStartPalette';

// The start spec's "Look": the app's own light or dark colours, never the tab's theme.
const appearance = vi.hoisted(() => ({ value: 'light' as 'light' | 'dark' }));
vi.mock('@liveplanner/ui', async (actual) => ({
  ...(await actual<typeof import('@liveplanner/ui')>()),
  useAppearance: () => ({ appearance: appearance.value }),
}));

describe('useStartPalette', () => {
  it.each(['light', 'dark'] as const)("wears the app's own %s look, whatever the tab", (mode) => {
    appearance.value = mode;
    const { result } = renderHook(() => useStartPalette());
    expect(result.current).toEqual(planPalette(mode, {}));
  });
});
