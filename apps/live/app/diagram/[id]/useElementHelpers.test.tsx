// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element, StickyElement, Tab } from '@livediagram/diagram';
import type { InsertionSlot } from '@/lib/insert-between';
import { useElementHelpers } from './useElementHelpers';

// A row of three 200x200 notes with 72 gaps.
const note = (id: string, x: number): StickyElement =>
  ({ id, type: 'sticky', x, y: 0, width: 200, height: 200 }) as StickyElement;
const ROW: Element[] = [note('a', 0), note('b', 272), note('c', 544)];

const SLOT: InsertionSlot = {
  atX: 272,
  atY: 100,
  shiftDx: 272,
  shiftedIds: ['b', 'c'],
  leftId: 'a',
  rightId: 'b',
  spanTop: -40,
  spanBottom: 240,
};

function harness(elements: Element[] = ROW) {
  const tab: Tab = { id: 't1', name: 'Tab 1', elements } as Tab;
  const commitTabs = vi.fn();
  const emitChange = vi.fn();
  const { result } = renderHook(() =>
    useElementHelpers({
      selectedId: null,
      soloSelectedId: null,
      activeId: 't1',
      activeTab: tab,
      editsBlocked: false,
      multiSelectedIds: new Set<string>(),
      formatSourceId: null,
      formatConfig: { mode: 'keep', groups: {} } as never,
      groupSourceId: null,
      getViewportCenter: () => ({ x: 0, y: 0 }),
      commit: vi.fn(),
      commitTabs,
      emitChange,
      setSelectedId: vi.fn(),
      setEditingId: vi.fn(),
      setFormatSourceId: vi.fn(),
      setGroupSourceId: vi.fn(),
    }),
  );
  return { helpers: result.current, commitTabs, emitChange, tab };
}

// The x of every element on the tab the single commit produced.
function committedXs(commitTabs: ReturnType<typeof vi.fn>, against: Element[]): number[] {
  const updater = commitTabs.mock.calls[0]![0] as (tabs: Tab[]) => Tab[];
  const next = updater([{ id: 't1', name: 'Tab 1', elements: against } as Tab]);
  return next[0]!.elements.map((el) => (el as StickyElement).x);
}

describe('addBoxedAt with an insertion slot (spec/139)', () => {
  it('commits the ripple and the new note as ONE change', () => {
    const { helpers, commitTabs } = harness();
    helpers.addBoxedAt(372, 100, (x) => note('new', x) as StickyElement, {
      edit: true,
      insertion: SLOT,
    });
    // One history entry: one Undo has to take back both halves of the insert.
    expect(commitTabs).toHaveBeenCalledTimes(1);
    expect(committedXs(commitTabs, ROW)).toEqual([0, 544, 816, 272]);
  });

  it('ripples the LIVE board, not the snapshot the drag started from', () => {
    const { helpers, commitTabs } = harness();
    helpers.addBoxedAt(372, 100, (x) => note('new', x) as StickyElement, { insertion: SLOT });
    // A peer moved 'c' further out while the drag was in flight. The commit
    // runs against what the tab holds NOW, so their move survives (shifted),
    // instead of being reverted to the position the drag remembered.
    const live: Element[] = [note('a', 0), note('b', 272), note('c', 900)];
    expect(committedXs(commitTabs, live)).toEqual([0, 544, 1172, 272]);
  });

  it('lands the note exactly where the preview promised', () => {
    const { helpers, commitTabs } = harness();
    // The drop point is the slot's centre (the preview publishes it through
    // the drag's snap channel), and placeBoxed centres the element on it.
    helpers.addBoxedAt(372, 100, (x, y) => ({ ...note('new', x), y }) as StickyElement, {
      insertion: SLOT,
    });
    expect(committedXs(commitTabs, ROW).at(-1)).toBe(SLOT.atX);
  });

  it('leaves an ordinary drop alone', () => {
    const { helpers, commitTabs } = harness();
    helpers.addBoxedAt(372, 100, (x) => note('new', x) as StickyElement, { edit: true });
    expect(committedXs(commitTabs, ROW)).toEqual([0, 272, 544, 272]);
  });

  it('refuses to touch the board when edits are blocked', () => {
    const tab: Tab = { id: 't1', name: 'Tab 1', elements: ROW } as Tab;
    const commitTabs = vi.fn();
    const { result } = renderHook(() =>
      useElementHelpers({
        selectedId: null,
        soloSelectedId: null,
        activeId: 't1',
        activeTab: tab,
        editsBlocked: true,
        multiSelectedIds: new Set<string>(),
        formatSourceId: null,
        formatConfig: { mode: 'keep', groups: {} } as never,
        groupSourceId: null,
        getViewportCenter: () => ({ x: 0, y: 0 }),
        commit: vi.fn(),
        commitTabs,
        emitChange: vi.fn(),
        setSelectedId: vi.fn(),
        setEditingId: vi.fn(),
        setFormatSourceId: vi.fn(),
        setGroupSourceId: vi.fn(),
      }),
    );
    result.current.addBoxedAt(372, 100, (x) => note('new', x) as StickyElement, {
      insertion: SLOT,
    });
    expect(commitTabs).not.toHaveBeenCalled();
  });
});
