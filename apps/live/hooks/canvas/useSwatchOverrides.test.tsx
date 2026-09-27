// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSwatchOverrides } from './useSwatchOverrides';

// docs/specs/008-canvas/quick-style-panel.md "Custom swatches": kept per diagram, in this browser.

beforeEach(() => localStorage.clear());

describe('useSwatchOverrides', () => {
  it('sets and clears a slot, and keeps it for the diagram', () => {
    const { result, unmount } = renderHook(() => useSwatchOverrides({ diagramId: 'd1' }));
    act(() => result.current.setOverride('stroke', 3, '#123456'));
    expect(result.current.overrides).toEqual({ stroke: { 3: '#123456' } });
    unmount();
    const again = renderHook(() => useSwatchOverrides({ diagramId: 'd1' }));
    expect(again.result.current.overrides).toEqual({ stroke: { 3: '#123456' } });
    act(() => again.result.current.clearOverride('stroke', 3));
    expect(again.result.current.overrides).toEqual({});
  });

  it('keeps each diagram to itself', () => {
    const { result, rerender } = renderHook(({ id }) => useSwatchOverrides({ diagramId: id }), {
      initialProps: { id: 'd1' as string | null },
    });
    act(() => result.current.setOverride('fill', 1, '#abcdef'));
    rerender({ id: 'd2' });
    expect(result.current.overrides).toEqual({});
    rerender({ id: 'd1' });
    expect(result.current.overrides).toEqual({ fill: { 1: '#abcdef' } });
  });

  it('is inert until the diagram id is known', () => {
    const { result } = renderHook(() => useSwatchOverrides({ diagramId: null }));
    act(() => result.current.setOverride('fill', 1, '#abcdef'));
    expect(result.current.overrides).toEqual({});
    expect(localStorage.length).toBe(0);
  });
});
