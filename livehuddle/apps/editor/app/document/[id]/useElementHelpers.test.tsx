// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  createShape,
  doorOnRoom,
  type Element,
  type ShapeElement,
  type StickyElement,
  type Tab,
} from '@livehuddle/document';
import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
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
  const setSelection = vi.fn<(next: Selection) => void>();
  const setEditingId = vi.fn();
  const { result } = renderHook(() =>
    useElementHelpers({
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set<string>() }),
      activeId: 't1',
      activeTab: tab,
      editsBlocked: false,
      getViewportCenter: () => ({ x: 0, y: 0 }),
      commitTabs,
      setSelection,
      setEditingId,
    }),
  );
  return { helpers: result.current, commitTabs, tab, setSelection, setEditingId };
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
  // office.md "Placing selects every piece": the room and its Door land selected together, one store write.
  it('drops a Room behind everything with its Door in front, in one change, both selected', () => {
    const { helpers, commitTabs, setSelection } = harness();
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
    expect(setSelection).toHaveBeenCalledTimes(1);
    expect(setSelection).toHaveBeenCalledWith({
      selectedId: null,
      multiSelectedIds: new Set([room.id, door.id]),
    });
  });

  // docs/specs/009-elements/office-amenities.md "The Restroom preset": a dropped Restroom brings its fittings too.
  it('drops a Restroom with its Door, fittings and sign in front of it, in one change, all selected', () => {
    const { helpers, commitTabs, setSelection } = harness();
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
    const placed = [els[0]!, ...els.slice(-7)].map((e) => e.id);
    expect(setSelection).toHaveBeenCalledTimes(1);
    expect(setSelection).toHaveBeenCalledWith({
      selectedId: null,
      multiSelectedIds: new Set(placed),
    });
  });

  it('keeps a dropped lone piece a single selection, with its caret', () => {
    const { helpers, setSelection, setEditingId } = harness();
    helpers.addBoxedAt(372, 100, (x) => note('new', x), { edit: true });
    expect(setSelection).toHaveBeenCalledWith({ selectedId: 'new', multiSelectedIds: new Set() });
    expect(setEditingId).toHaveBeenCalledWith('new');
  });

  it('opens no caret when a typed-label drop brings companions', () => {
    const { helpers, setSelection, setEditingId } = harness();
    helpers.addBoxedAt(600, 400, (x, y) => createShape('room', x, y), { edit: true });
    expect(setSelection.mock.calls[0]![0].multiSelectedIds.size).toBe(2);
    expect(setEditingId).not.toHaveBeenCalled();
  });

  it('places without selecting when asked not to', () => {
    const { helpers, commitTabs, setSelection } = harness();
    helpers.addBoxedAt(600, 400, (x, y) => createShape('room', x, y), { select: false });
    expect(commitTabs).toHaveBeenCalledTimes(1);
    expect(setSelection).not.toHaveBeenCalled();
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
        getViewportCenter: () => ({ x: 0, y: 0 }),
        commitTabs,
        setSelection: vi.fn(),
        setEditingId: vi.fn(),
      }),
    );
    result.current.addBoxedAt(372, 100, (x) => note('new', x));
    expect(commitTabs).not.toHaveBeenCalled();
  });
});
