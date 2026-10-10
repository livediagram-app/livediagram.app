// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element, StickyElement, Tab } from '@livediagram/document';
import { DEFAULT_FORMAT_CONFIG, type FormatMode } from '@/lib/format-config';
import type { InsertionSlot } from '@/lib/insert-between';
import { useElementHelpers } from './useElementHelpers';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

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
  const { result } = renderHook(() =>
    useElementHelpers({
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set<string>() }),
      activeId: 't1',
      activeTab: tab,
      editsBlocked: false,
      formatSourceId: null,
      formatConfig: { mode: 'keep', groups: {} } as never,
      getViewportCenter: () => ({ x: 0, y: 0 }),
      commit: vi.fn(),
      commitTabs,
      setSelectedId: vi.fn(),
      setEditingId: vi.fn(),
      setFormatSourceId: vi.fn(),
    }),
  );
  return { helpers: result.current, commitTabs, tab };
}

// The x of every element on the tab the single commit produced.
function committedXs(commitTabs: ReturnType<typeof vi.fn>, against: Element[]): number[] {
  const updater = commitTabs.mock.calls[0]![0] as (tabs: Tab[]) => Tab[];
  const next = updater([{ id: 't1', name: 'Tab 1', elements: against } as Tab]);
  return next[0]!.elements.map((el) => (el as StickyElement).x);
}

describe('addBoxedAt with an insertion slot (docs/specs/021-event-storming/event-storming.md)', () => {
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
        readSelection: () => ({ selectedId: null, multiSelectedIds: new Set<string>() }),
        activeId: 't1',
        activeTab: tab,
        editsBlocked: true,
        formatSourceId: null,
        formatConfig: { mode: 'keep', groups: {} } as never,
        getViewportCenter: () => ({ x: 0, y: 0 }),
        commit: vi.fn(),
        commitTabs,
        setSelectedId: vi.fn(),
        setEditingId: vi.fn(),
        setFormatSourceId: vi.fn(),
      }),
    );
    result.current.addBoxedAt(372, 100, (x) => note('new', x) as StickyElement, {
      insertion: SLOT,
    });
    expect(commitTabs).not.toHaveBeenCalled();
  });
});

// The Format tool is the only painter (docs/specs/008-canvas/format-panel.md): its
// Mode alone decides whether the brush stays loaded after a paint.
describe('applyFormatFromSource', () => {
  function paintHarness(mode: FormatMode) {
    const tab: Tab = { id: 't1', name: 'Tab 1', elements: ROW } as Tab;
    const commit = vi.fn();
    const setFormatSourceId = vi.fn();
    const { result } = renderHook(() =>
      useElementHelpers({
        readSelection: () => ({ selectedId: null, multiSelectedIds: new Set<string>() }),
        activeId: 't1',
        activeTab: tab,
        editsBlocked: false,
        formatSourceId: 'a',
        formatConfig: { ...DEFAULT_FORMAT_CONFIG, mode },
        getViewportCenter: () => ({ x: 0, y: 0 }),
        commit,
        commitTabs: vi.fn(),
        setSelectedId: vi.fn(),
        setEditingId: vi.fn(),
        setFormatSourceId,
      }),
    );
    return { paint: result.current.applyFormatFromSource, commit, setFormatSourceId };
  }

  it('keeps the brush loaded in Keep painting', () => {
    const { paint, commit, setFormatSourceId } = paintHarness('keep');
    paint('b');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(setFormatSourceId).not.toHaveBeenCalled();
  });

  it('empties the brush after one paint in Paint once', () => {
    const { paint, commit, setFormatSourceId } = paintHarness('once');
    paint('b');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(setFormatSourceId).toHaveBeenCalledWith(null);
  });
});
