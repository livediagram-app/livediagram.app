// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readUserPreferences,
  writeUserPreferences as writeCache,
  type UserPreferences,
} from '@/lib/user-preferences';
import { useSwatchOverrides } from './useSwatchOverrides';

// docs/specs/008-canvas/quick-style-panel.md "Custom swatches": per user, synced, keyed by theme.

beforeEach(() => localStorage.clear());

function setup(themeId: string, initial: UserPreferences = {}) {
  writeCache(initial);
  const put = vi.fn((prefs: UserPreferences) => writeCache(prefs));
  const hook = renderHook(
    ({ theme }) => {
      const [prefs, setPrefs] = useState<UserPreferences>(initial);
      return useSwatchOverrides({
        themeId: theme,
        userPreferences: prefs,
        setUserPreferences: setPrefs,
        writeUserPreferences: put,
        ownerId: 'owner-1',
      });
    },
    { initialProps: { theme: themeId } },
  );
  return { ...hook, put };
}

describe('useSwatchOverrides', () => {
  it('saves an override into the synced preferences, for the owner', () => {
    const { result, put } = setup('forest');
    act(() => result.current.setOverride('stroke', 3, '#123456'));
    expect(result.current.overrides).toEqual({ stroke: { 3: '#123456' } });
    expect(put).toHaveBeenLastCalledWith(
      expect.objectContaining({ quickSwatchOverrides: [{ t: 'forest', s: { 3: '#123456' } }] }),
      'owner-1',
    );
  });

  it('keeps every other preference when it writes', () => {
    const { result } = setup('forest', { customSwatches: ['#abcdef'], tourSeen: true });
    act(() => result.current.setOverride('fill', 1, '#123456'));
    expect(readUserPreferences()).toMatchObject({ customSwatches: ['#abcdef'], tourSeen: true });
  });

  it('shows each theme its own slots when the theme changes', () => {
    const { result, rerender } = setup('forest');
    act(() => result.current.setOverride('stroke', 3, '#123456'));
    rerender({ theme: 'ocean' });
    expect(result.current.overrides).toEqual({});
    act(() => result.current.setOverride('stroke', 3, '#654321'));
    rerender({ theme: 'forest' });
    expect(result.current.overrides).toEqual({ stroke: { 3: '#123456' } });
  });

  it('Clear override restores the theme colour and leaves nothing behind', () => {
    const { result } = setup('forest');
    act(() => result.current.setOverride('stroke', 3, '#123456'));
    act(() => result.current.clearOverride('stroke', 3));
    expect(result.current.overrides).toEqual({});
    expect(readUserPreferences()).not.toHaveProperty('quickSwatchOverrides');
  });

  it('ignores a malformed stored value rather than failing', () => {
    const { result } = setup('forest', { quickSwatchOverrides: 'junk' as never });
    expect(result.current.overrides).toEqual({});
  });
});
