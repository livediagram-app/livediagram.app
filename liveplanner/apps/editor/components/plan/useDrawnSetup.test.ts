// @vitest-environment jsdom
// useDrawnSetup.ts (docs/specs/026-plan/blueprints/board-widgets.md "Performance and limits"): the set-up without its
// filter keeps one identity across filter changes, a teammate's whole new set-up included, and changes with anything
// else.
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { presetSetup, type PlanBoardSetup } from '@liveplanner/items';
import { drawnSetupKey, useDrawnSetup } from './useDrawnSetup';

describe('useDrawnSetup', () => {
  it('drops the filter and keeps its object while only the filter changes', () => {
    const base = presetSetup('kanban');
    const start: PlanBoardSetup = { ...base, filter: { text: 'a' } };
    const { result, rerender } = renderHook<PlanBoardSetup | null, { s: PlanBoardSetup | null }>(
      ({ s }) => useDrawnSetup(s),
      { initialProps: { s: start } },
    );
    const first = result.current;
    expect(first).toEqual(base);
    expect(first).not.toHaveProperty('filter');
    // A remote change: a whole new set-up parsed off the wire, equal in all but its filter.
    rerender({ s: JSON.parse(JSON.stringify({ ...base, filter: { priority: 'high' } })) });
    expect(result.current).toBe(first);
    rerender({ s: { ...base, widgets: ['count'] } });
    expect(result.current).not.toBe(first);
    rerender({ s: null });
    expect(result.current).toBeNull();
  });

  it('keys nothing for no set-up', () => {
    expect(drawnSetupKey(null)).toBeNull();
  });
});
