// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { ITEM_TYPES, presetSetup } from '@livediagram/items';
import { usePresetCardTypes } from './usePresetCardTypes';

// docs/specs/026-plan/plan-mode.md "The palette": a board placed while the document is open brings its card types.
const board = (id: string, preset: 'bug-triage' | 'kanban') => ({
  id,
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 800,
  height: 600,
  planBoard: presetSetup(preset),
});
const tab = (elements: unknown[]) => ({ id: 't1', name: 'Board', elements }) as unknown as Tab;

describe('usePresetCardTypes', () => {
  it('adds a new board’s missing preset types, never for the boards the tab opened with', () => {
    const addTypes = vi.fn();
    const { rerender } = renderHook(
      ({ tabs }) =>
        usePresetCardTypes({ tabs, activeId: 't1', enabled: true, types: ITEM_TYPES, addTypes }),
      { initialProps: { tabs: [tab([board('a', 'bug-triage')])] } },
    );
    expect(addTypes).not.toHaveBeenCalled();
    rerender({ tabs: [tab([board('a', 'bug-triage'), board('b', 'kanban')])] });
    expect(addTypes).not.toHaveBeenCalled();
    rerender({
      tabs: [tab([board('a', 'bug-triage'), board('b', 'kanban'), board('c', 'bug-triage')])],
    });
    expect(addTypes).toHaveBeenCalledTimes(1);
    expect(addTypes.mock.lastCall![0].map((t: { id: string }) => t.id)).toEqual(['bug']);
  });
});
