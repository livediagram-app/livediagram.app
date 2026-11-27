// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useEarshotFlash } from './useEarshotFlash';

// docs/specs/012-collaboration/proximity-audio.md "Your hearing ring".
describe('useEarshotFlash', () => {
  const self = { x: 0, y: 0 };
  const w = (id: string, x: number) => ({ id, at: { x, y: 0 } });

  it('counts up when someone new comes within earshot, not for whoever is near as you start', () => {
    const { result, rerender } = renderHook(({ walkers }) => useEarshotFlash(self, walkers, []), {
      initialProps: { walkers: [w('already', 100)] },
    });
    expect(result.current).toBe(0);
    rerender({ walkers: [w('already', 100), w('far', 2000)] });
    expect(result.current).toBe(0);
    rerender({ walkers: [w('already', 100), w('far', 200)] });
    expect(result.current).toBe(1);
    // Someone leaving does not flash it.
    rerender({ walkers: [w('already', 100)] });
    expect(result.current).toBe(1);
  });

  it('counts nothing while you are not walking', () => {
    const { result, rerender } = renderHook(({ me }) => useEarshotFlash(me, [w('a', 100)], []), {
      initialProps: { me: null as { x: number; y: number } | null },
    });
    rerender({ me: null });
    expect(result.current).toBe(0);
  });
});
