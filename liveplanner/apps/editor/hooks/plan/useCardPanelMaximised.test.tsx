// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '@/lib/user-preferences';
import { track } from '@/lib/telemetry';
import { useCardPanelMaximised } from './useCardPanelMaximised';

const sync = vi.hoisted(() => ({ saves: [] as { ownerId: string; prefs: unknown }[] }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/preferences-sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/preferences-sync')>()),
  savePreferences: (ownerId: string, prefs: unknown) => sync.saves.push({ ownerId, prefs }),
}));

afterEach(() => {
  window.localStorage.clear();
  sync.saves.length = 0;
  vi.mocked(track).mockClear();
});

const stored = () =>
  JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;

// docs/specs/026-plan/plan-board.md "Maximised": the choice is kept with the person's preferences
// (`cardPanelMaximised`), so every card they open afterwards opens the same way.
describe('useCardPanelMaximised', () => {
  it('reads off by default, and on from the stored preference', () => {
    expect(renderHook(() => useCardPanelMaximised('owner-1')).result.current.maximised).toBe(false);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ cardPanelMaximised: true }));
    expect(renderHook(() => useCardPanelMaximised('owner-1')).result.current.maximised).toBe(true);
  });

  it('keeps a flip for the owner, tracked before it is written, and keeps the other preferences', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ reduceMotion: true }));
    vi.mocked(track).mockImplementation(() => {
      // Tracked first: nothing is written yet.
      expect(stored()['cardPanelMaximised']).toBeUndefined();
    });
    const { result } = renderHook(() => useCardPanelMaximised('owner-1'));
    act(() => result.current.setMaximised(true));
    expect(track).toHaveBeenCalledWith('UI', 'Toggled', 'CardMaximisedOn');
    expect(result.current.maximised).toBe(true);
    expect(stored()).toEqual({ reduceMotion: true, cardPanelMaximised: true });
    expect(sync.saves.at(-1)).toEqual({
      ownerId: 'owner-1',
      prefs: { reduceMotion: true, cardPanelMaximised: true },
    });
    vi.mocked(track).mockImplementation(() => undefined);
    act(() => result.current.setMaximised(false));
    expect(track).toHaveBeenLastCalledWith('UI', 'Toggled', 'CardMaximisedOff');
    expect(result.current.maximised).toBe(false);
    // Off is the default, so it is kept as no key at all.
    expect(stored()).toEqual({ reduceMotion: true });
  });

  it('keeps every open panel in step', () => {
    const one = renderHook(() => useCardPanelMaximised('owner-1'));
    const two = renderHook(() => useCardPanelMaximised('owner-1'));
    act(() => one.result.current.setMaximised(true));
    expect(two.result.current.maximised).toBe(true);
  });

  it('keeps it in this browser alone before the reader is known', () => {
    const { result } = renderHook(() => useCardPanelMaximised(null));
    act(() => result.current.setMaximised(true));
    expect(result.current.maximised).toBe(true);
    expect(sync.saves).toEqual([]);
  });
});
