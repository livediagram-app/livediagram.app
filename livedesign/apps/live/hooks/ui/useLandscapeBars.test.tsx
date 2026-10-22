// @vitest-environment jsdom
// The bars on a phone held sideways (docs/specs/007-editor/live-app.md "A phone held sideways"): folded
// on each load, shown and folded by the handle with its telemetry, shown by a rename asked for
// elsewhere and while a tour is on screen.
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setActiveTour } from '@/lib/tour-active';
import { useLandscapeBars } from './useLandscapeBars';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

afterEach(() => {
  cleanup();
  track.mockClear();
  act(() => setActiveTour('welcome', false));
});

describe('useLandscapeBars', () => {
  it('starts folded', () => {
    const { result } = renderHook(() => useLandscapeBars([0, 0]));
    expect(result.current.shown).toBe(false);
  });

  it('toggles from the handle and says which way it went', () => {
    const { result } = renderHook(() => useLandscapeBars([0, 0]));
    act(() => result.current.toggle());
    expect(result.current.shown).toBe(true);
    expect(track).toHaveBeenLastCalledWith('UI', 'Toggled', 'LandscapeBarsOn');
    act(() => result.current.toggle());
    expect(result.current.shown).toBe(false);
    expect(track).toHaveBeenLastCalledWith('UI', 'Toggled', 'LandscapeBarsOff');
  });

  it('shows the bars in the same render as a rename asked for elsewhere, without telemetry', () => {
    const seen: boolean[] = [];
    const { result, rerender } = renderHook(
      ({ doc, tab }) => {
        const bars = useLandscapeBars([doc, tab]);
        seen.push(bars.shown);
        return bars;
      },
      { initialProps: { doc: 0, tab: 0 } },
    );
    rerender({ doc: 1, tab: 0 });
    expect(result.current.shown).toBe(true);
    // No committed render in between showed them folded.
    expect(seen.at(-1)).toBe(true);
    expect(track).not.toHaveBeenCalled();

    act(() => result.current.toggle());
    expect(result.current.shown).toBe(false);
    rerender({ doc: 1, tab: 1 });
    expect(result.current.shown).toBe(true);
  });

  it('a rerender with the same nonces keeps the choice', () => {
    const { result, rerender } = renderHook(() => useLandscapeBars([3, 4]));
    rerender();
    expect(result.current.shown).toBe(false);
  });

  it('keeps the bars shown while a tour is on screen, and folds them after it', () => {
    const { result } = renderHook(() => useLandscapeBars([0, 0]));
    act(() => setActiveTour('welcome', true));
    expect(result.current.shown).toBe(true);
    act(() => setActiveTour('welcome', false));
    expect(result.current.shown).toBe(false);
  });

  it('a press during a tour folds from what is on screen', () => {
    const { result } = renderHook(() => useLandscapeBars([0, 0]));
    act(() => setActiveTour('plan', true));
    act(() => result.current.toggle());
    expect(track).toHaveBeenLastCalledWith('UI', 'Toggled', 'LandscapeBarsOff');
    act(() => setActiveTour('plan', false));
    expect(result.current.shown).toBe(false);
  });
});
