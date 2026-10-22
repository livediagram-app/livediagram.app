// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livepages/document';
import { useTabActions } from './useTabActions';

// docs/specs/026-plan/plan-tabs.md "Names": a Duplicate of a Board or Visualisation tab titles the copy's board or
// chart as the copy is named, so a later change to it never names the copy back after the original.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

function duplicate(src: Tab): Tab {
  const commitTabs = vi.fn();
  const deps = new Proxy<Record<string, unknown>>(
    {
      tabs: [src],
      activeId: src.id,
      commitTabs,
      isTabLoaded: () => true,
    },
    { get: (target, key: string) => (key in target ? target[key] : vi.fn()) },
  );
  const { result } = renderHook(() => useTabActions(deps as never));
  result.current.duplicateTab(src.id);
  const update = commitTabs.mock.calls[0]![0] as (ts: Tab[]) => Tab[];
  return update([src]).at(-1)!;
}

const board = {
  id: 'b1',
  type: 'shape',
  shape: 'plan-board',
  planBoard: { title: 'Bugs', columns: [] },
} as unknown as Element;
const chart = {
  id: 'v1',
  type: 'shape',
  shape: 'plan-view',
  planView: { view: 'gantt', title: 'Launch' },
} as unknown as Element;

describe('duplicating a tab', () => {
  it("titles a Board tab copy's board as the copy", () => {
    const copy = duplicate({ id: 't1', name: 'Bugs', kind: 'board', elements: [board] });
    expect(copy.name).toBe('Bugs copy');
    const el = copy.elements[0] as { planBoard: { title: string } };
    expect(el.planBoard.title).toBe('Bugs copy');
    // The original is untouched.
    expect((board as unknown as { planBoard: { title: string } }).planBoard.title).toBe('Bugs');
  });

  it("titles a Visualisation tab copy's chart as the copy", () => {
    const copy = duplicate({
      id: 't1',
      name: 'Launch',
      kind: 'dashboard',
      elements: [chart],
      dashboard: {
        rows: [
          {
            id: 'r',
            fill: true,
            slots: [{ id: 's', content: { type: 'element', elementId: 'v1' } }],
          },
        ],
      },
    } as unknown as Tab);
    const el = copy.elements[0] as { planView: { title: string } };
    expect(el.planView.title).toBe('Launch copy');
  });

  it('leaves the boards on any other tab as they are', () => {
    const copy = duplicate({ id: 't1', name: 'Plans', elements: [board] });
    expect((copy.elements[0] as { planBoard: { title: string } }).planBoard.title).toBe('Bugs');
  });
});
