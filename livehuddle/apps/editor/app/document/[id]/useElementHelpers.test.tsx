// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  createArrow,
  createShape,
  doorOnRoom,
  type Element,
  type ShapeElement,
  type StickyElement,
  type Tab,
} from '@livehuddle/document';
import { DEFAULT_FORMAT_CONFIG, type FormatMode } from '@liveworkspace/workbench/lib/format-config';
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
  const next = updater([{ id: 't1', name: 'Tab 1', elements: against }]);
  return next[0]!.elements.map((el) => (el as StickyElement).x);
}

describe('addBoxedAt', () => {
  it('adds the element in one change', () => {
    const { helpers, commitTabs } = harness();
    helpers.addBoxedAt(372, 100, (x) => note('new', x), { edit: true });
    expect(committedXs(commitTabs, ROW)).toEqual([0, 272, 544, 272]);
  });

  // docs/specs/009-elements/office.md "The doorway is a Door": a dropped Room brings its Door in the same change.
  it('drops a Room behind everything with its Door in front, in one change, the room selected', () => {
    const { helpers, commitTabs } = harness();
    helpers.addBoxedAt(600, 400, (x, y) => createShape('room', x, y));
    expect(commitTabs).toHaveBeenCalledTimes(1);
    const updater = commitTabs.mock.calls[0]![0] as (tabs: Tab[]) => Tab[];
    const els = updater([{ id: 't1', name: 'Tab 1', elements: ROW }])[0]!.elements;
    const room = els[0] as ShapeElement;
    const door = els[els.length - 1] as ShapeElement;
    expect(room).toMatchObject({ shape: 'room', roomDoor: 'none' });
    expect(door.shape).toBe('door');
    expect(doorOnRoom(door, room)).toBe(true);
    expect(els).toHaveLength(ROW.length + 2);
  });

  // docs/specs/009-elements/office-amenities.md "The Restroom preset": a dropped Restroom brings its fittings too.
  it('drops a Restroom with its Door, fittings and sign in front of it, in one change', () => {
    const { helpers, commitTabs } = harness();
    helpers.addBoxedAt(600, 400, (x, y) => createShape('room', x, y), { variant: 'restroom' });
    expect(commitTabs).toHaveBeenCalledTimes(1);
    const updater = commitTabs.mock.calls[0]![0] as (tabs: Tab[]) => Tab[];
    const els = updater([{ id: 't1', name: 'Tab 1', elements: ROW }])[0]!.elements;
    expect((els[0] as ShapeElement).shape).toBe('room');
    expect(els.slice(-7).map((e) => (e as ShapeElement).shape)).toEqual([
      'door',
      'toilet-cubicle',
      'toilet-cubicle',
      'hand-dryer',
      'washbasin',
      'washbasin',
      'room-sign',
    ]);
  });

  it('refuses to touch the board when edits are blocked', () => {
    const tab: Tab = { id: 't1', name: 'Tab 1', elements: ROW };
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
    result.current.addBoxedAt(372, 100, (x) => note('new', x));
    expect(commitTabs).not.toHaveBeenCalled();
  });
});

// The Format tool is the only painter (docs/specs/008-canvas/format-panel.md): its
// Mode alone decides whether the brush stays loaded after a paint.
describe('applyFormatFromSource', () => {
  function paintHarness(
    mode: FormatMode,
    source = 'a',
    lock: { element?: string; layer?: string; tab?: boolean } = {},
  ) {
    const line: Element = { ...createArrow(0, 0, 10, 0), id: 'line' };
    const elements = [...ROW, line].map((el) =>
      el.id === lock.element ? { ...el, locked: true } : el,
    );
    const tab: Tab = { id: 't1', name: 'Tab 1', elements, ...(lock.tab ? { locked: true } : {}) };
    const commit = vi.fn();
    const setFormatSourceId = vi.fn();
    const { result } = renderHook(() =>
      useElementHelpers({
        readSelection: () => ({ selectedId: null, multiSelectedIds: new Set<string>() }),
        activeId: 't1',
        activeTab: tab,
        editsBlocked: false,
        formatSourceId: source,
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

  it('keeps a Paint once brush loaded on a tap that paints nothing', () => {
    const { paint, commit, setFormatSourceId } = paintHarness('once');
    telemetry.track.mockClear();
    paint('a'); // the source itself
    paint('line'); // the other kind: a note's look onto an arrow
    expect(commit).not.toHaveBeenCalled();
    expect(setFormatSourceId).not.toHaveBeenCalled();
    expect(telemetry.track).not.toHaveBeenCalled();
  });

  it('empties the brush once its source is gone', () => {
    const { paint, commit, setFormatSourceId } = paintHarness('keep', 'deleted');
    paint('b');
    expect(commit).not.toHaveBeenCalled();
    expect(setFormatSourceId).toHaveBeenCalledWith(null);
  });

  // not-in-livehuddle.md "Element and Tab Locking": what was saved locked behaves as unlocked.
  it('paints onto an element saved locked', () => {
    const { paint, commit } = paintHarness('once', 'a', { element: 'b' });
    paint('b');
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('paints on a tab saved locked', () => {
    const { paint, commit } = paintHarness('once', 'a', { tab: true });
    paint('b');
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('lends a source saved locked its look', () => {
    const { paint, commit } = paintHarness('keep', 'a', { element: 'a' });
    paint('b');
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
