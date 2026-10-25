// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { usePruneInertSelection } from './usePruneInertSelection';

// docs/specs/006-project/layers.md: a layer turning hidden or locked drops its elements from the live
// selection, as delete does, before the next paint.

describe('usePruneInertSelection', () => {
  it('drops newly inert elements from the single and the multi-selection', () => {
    const selection = createSelectionStore();
    selection.setSelection({ selectedId: 'a', multiSelectedIds: new Set(['a', 'b', 'c']) });
    const { rerender } = renderHook(({ inert }) => usePruneInertSelection(inert, selection), {
      initialProps: { inert: new Set<string>() },
    });

    rerender({ inert: new Set(['a', 'c']) });

    expect(selection.get().selectedId).toBeNull();
    expect([...selection.get().multiSelectedIds]).toEqual(['b']);
  });

  it('leaves a selection with nothing inert in it untouched', () => {
    const selection = createSelectionStore();
    selection.setSelection({ selectedId: 'a', multiSelectedIds: new Set() });
    const before = selection.get();
    const { rerender } = renderHook(({ inert }) => usePruneInertSelection(inert, selection), {
      initialProps: { inert: new Set<string>() },
    });

    rerender({ inert: new Set(['z']) });

    expect(selection.get()).toBe(before);
  });

  it('keeps an inert element selected another way (a chart its Sheet draws)', () => {
    const selection = createSelectionStore();
    selection.setSelection({ selectedId: 'chart', multiSelectedIds: new Set() });
    const kept = new Set(['chart']);
    const { rerender } = renderHook(({ inert }) => usePruneInertSelection(inert, selection, kept), {
      initialProps: { inert: new Set<string>(['chart']) },
    });

    rerender({ inert: new Set(['chart', 'other']) });

    expect(selection.get().selectedId).toBe('chart');
  });
});
