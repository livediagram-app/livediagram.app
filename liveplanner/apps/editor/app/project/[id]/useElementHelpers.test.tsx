// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type Element, type StickyElement, type Tab } from '@liveplanner/project';
import { useElementHelpers } from './useElementHelpers';

const telemetry = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => telemetry);

// A row of three 200x200 notes with 72 gaps.
const note = (id: string, x: number): StickyElement => ({
  id,
  type: 'sticky',
  x,
  y: 0,
  width: 200,
  height: 200,
});
const ROW: Element[] = [note('a', 0), note('b', 272), note('c', 544)];

function harness(elements: Element[] = ROW) {
  const tab: Tab = { id: 't1', name: 'Tab 1', elements };
  const commitTabs = vi.fn();
  const { result } = renderHook(() =>
    useElementHelpers({
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set<string>() }),
      activeId: 't1',
      activeTab: tab,
      editsBlocked: false,
      getViewportCenter: () => ({ x: 0, y: 0 }),
      commitTabs,
      setSelectedId: vi.fn(),
      setEditingId: vi.fn(),
    }),
  );
  return { helpers: result.current, commitTabs, tab };
}

describe('addBoxedAt', () => {
  it('appends the element, centred on the point, in one commit', () => {
    const { helpers, commitTabs } = harness();
    helpers.addBoxedAt(372, 100, (x) => note('new', x));
    expect(commitTabs).toHaveBeenCalledTimes(1);
    const updater = commitTabs.mock.calls[0]![0] as (tabs: Tab[]) => Tab[];
    const next = updater([{ id: 't1', name: 'Tab 1', elements: ROW }]);
    expect(next[0]!.elements.map((el) => el.id)).toEqual(['a', 'b', 'c', 'new']);
    expect((next[0]!.elements[3] as StickyElement).x).toBe(272);
  });
});
