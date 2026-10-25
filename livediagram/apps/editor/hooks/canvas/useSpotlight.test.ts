// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { spotlightRadius } from '@/lib/spotlight-config';
import { useSpotlight } from '@liveworkspace/workbench/hooks/canvas/useSpotlight';

// docs/specs/008-canvas/spotlight-panel.md "Persistence": the light opens at the saved Size preset, and the
// session's clicks own the radius from then on.
describe('useSpotlight', () => {
  it('opens at Medium with nothing saved', () => {
    expect(renderHook(() => useSpotlight()).result.current.radius).toBe(spotlightRadius('medium'));
  });

  it('opens at the saved Size', () => {
    const { result } = renderHook(() => useSpotlight(spotlightRadius('large')));
    expect(result.current.radius).toBe(spotlightRadius('large'));
  });

  it('keeps a clicked radius when the saved Size is read again', () => {
    const { result, rerender } = renderHook(({ r }) => useSpotlight(r), {
      initialProps: { r: spotlightRadius('small') },
    });
    act(() => result.current.grow());
    const grown = result.current.radius;
    rerender({ r: spotlightRadius('small') });
    expect(result.current.radius).toBe(grown);
    expect(grown).toBeGreaterThan(spotlightRadius('small'));
  });
});
