// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ITEM_TYPES, type PlanBoardSetup } from '@livediagram/items';
import type { PlanViewRef } from '@livediagram/document';
import { usePlanSlice } from './usePlanSlice';

// docs/specs/026-plan/plan-tabs.md "Names": only a change of a board's or chart's title renames its tab; any other
// setting leaves a tab whose name differs (a Duplicate's copy) as it is.
function slice() {
  const commitTabs = vi.fn();
  const { result } = renderHook(() =>
    usePlanSlice({
      planItems: {
        items: new Map(),
        status: 'ready',
        self: null,
        refetch: vi.fn(),
        write: vi.fn(),
      } as never,
      itemTypes: { types: ITEM_TYPES } as never,
      editorMode: 'plan',
      canEdit: true,
      canVote: true,
      teamPeople: [],
      presence: new Map(),
      statusNames: new Map(),
      commit: () => {},
      commitTabs,
      select: () => {},
      announce: () => {},
    }),
  );
  return { context: result.current.context, commitTabs };
}

const boardTab = () => [
  {
    id: 't1',
    name: 'Bugs copy',
    kind: 'board',
    elements: [
      { id: 'b', type: 'shape', shape: 'plan-board', planBoard: { title: 'Bugs', columns: [] } },
    ],
  },
];
const viewTab = () => [
  {
    id: 't1',
    name: 'Launch copy',
    kind: 'dashboard',
    elements: [
      { id: 'v', type: 'shape', shape: 'plan-view', planView: { view: 'gantt', title: 'Launch' } },
    ],
    dashboard: {
      rows: [
        { id: 'r', fill: true, slots: [{ id: 's', content: { type: 'element', elementId: 'v' } }] },
      ],
    },
  },
];

describe('a board or chart changed', () => {
  it('renames a Board tab only when the title changes', () => {
    const { context, commitTabs } = slice();
    context.updateBoard('b', {
      title: 'Bugs',
      columns: [],
      fillTab: true,
    } as unknown as PlanBoardSetup);
    const kept = commitTabs.mock.calls[0]![0](boardTab());
    expect(kept[0].name).toBe('Bugs copy');
    context.updateBoard('b', { title: 'Triage', columns: [] } as unknown as PlanBoardSetup);
    expect(commitTabs.mock.calls[1]![0](boardTab())[0].name).toBe('Triage');
  });

  it('renames a Visualisation tab only when the title changes', () => {
    const { context, commitTabs } = slice();
    context.updateView('v', {
      view: 'gantt',
      title: 'Launch',
      swimlanes: 'type',
    } as unknown as PlanViewRef);
    expect(commitTabs.mock.calls[0]![0](viewTab())[0].name).toBe('Launch copy');
    context.updateView('v', { view: 'gantt', title: 'Roadmap' });
    expect(commitTabs.mock.calls[1]![0](viewTab())[0].name).toBe('Roadmap');
  });
});
