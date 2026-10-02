// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_ELEMENTS_PER_TAB,
  type ArrowElement,
  type Element,
  type ShapeElement,
  type Tab,
} from '@livediagram/document';
import type { ShapeLibraryItem } from '@livediagram/api-schema';
import { useLibraryShapeInsert, type LibraryShapeInsertDeps } from './useLibraryShapeInsert';

// docs/specs/013-workspace/blueprints/shape-libraries.md "Behaviour and state" 5: an item placed like
// a paste, centred on the point, fresh ids with its connections, one commit, selected.

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));

const shape = (id: string, x: number): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y: 0,
  width: 40,
  height: 20,
});
const pair: ShapeLibraryItem = {
  id: 'i1',
  title: 'Pair',
  width: 140,
  height: 20,
  elements: [
    shape('a', 0),
    shape('b', 100),
    {
      id: 'e',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
    } as ArrowElement,
  ],
};

function setup(over: Partial<LibraryShapeInsertDeps> = {}) {
  let elements: Element[] = [];
  const deps: LibraryShapeInsertDeps = {
    activeTab: { id: 't', name: 'T', elements: [] } as Tab,
    editsBlocked: false,
    commit: vi.fn((map) => {
      elements = map(elements);
    }),
    setSelectedId: vi.fn(),
    setMultiSelectedIds: vi.fn(),
    getViewportCenter: () => ({ x: 500, y: 300 }),
    ...over,
  };
  const { result } = renderHook(() => useLibraryShapeInsert(deps));
  return { insert: result.current, deps, placed: () => elements };
}

beforeEach(() => {
  track.mockReset();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('useLibraryShapeInsert', () => {
  it('centres the item on the middle of the view, with fresh ids and its connection', () => {
    const h = setup();
    expect(h.insert(pair)).toBe(true);
    const placed = h.placed();
    expect(h.deps.commit).toHaveBeenCalledTimes(1);
    const shapes = placed.filter((e): e is ShapeElement => e.type === 'shape');
    expect(shapes.map((s) => [s.x, s.y])).toEqual([
      [430, 290],
      [530, 290],
    ]);
    expect(placed.some((e) => ['a', 'b', 'e'].includes(e.id))).toBe(false);
    const arrow = placed.find((e): e is ArrowElement => e.type === 'arrow')!;
    expect(arrow.from).toMatchObject({ elementId: shapes[0]!.id });
    expect(arrow.to).toMatchObject({ elementId: shapes[1]!.id });
    expect(h.deps.setMultiSelectedIds).toHaveBeenCalledWith(new Set(placed.map((e) => e.id)));
    expect(track).toHaveBeenCalledWith('Element', 'Added', 'LibraryShape');
  });

  it('places at a drop point, and selects a single element alone', () => {
    const h = setup();
    h.insert({ ...pair, width: 40, elements: [shape('a', 0)] }, { x: 20, y: 10 });
    expect(h.placed()[0]).toMatchObject({ x: 0, y: 0 });
    expect(h.deps.setSelectedId).toHaveBeenCalledWith(h.placed()[0]!.id);
  });

  it('places nothing while edits are blocked, on a locked tab, or past the element cap', () => {
    for (const over of [
      { editsBlocked: true },
      { activeTab: { id: 't', name: 'T', elements: [], locked: true } as Tab },
      {
        activeTab: {
          id: 't',
          name: 'T',
          elements: Array.from({ length: MAX_ELEMENTS_PER_TAB - 1 }, (_, i) => shape(`s${i}`, 0)),
        } as Tab,
      },
    ]) {
      const h = setup(over);
      expect(h.insert(pair)).toBe(false);
      expect(h.deps.commit).not.toHaveBeenCalled();
    }
    expect(track).not.toHaveBeenCalled();
  });
});

// docs/specs/013-workspace/shape-libraries.md "Consecutive clicks never cover one another".
describe('useLibraryShapeInsert, consecutive clicks', () => {
  const service: ShapeLibraryItem = {
    id: 's',
    title: 'Service',
    width: 120,
    height: 60,
    elements: [{ ...shape('a', 0), width: 120, height: 60 }],
  };

  // A stateful host: the hook sees the tab as the commits leave it, as the editor does.
  function host(tabId = 't') {
    let tab = { id: tabId, name: 'T', elements: [] as Element[] } as Tab;
    const commit = vi.fn((map: (els: Element[]) => Element[]) => {
      tab = { ...tab, elements: map(tab.elements) };
    });
    const deps = (): LibraryShapeInsertDeps => ({
      activeTab: tab,
      editsBlocked: false,
      commit,
      setSelectedId: vi.fn(),
      setMultiSelectedIds: vi.fn(),
      getViewportCenter: () => ({ x: 500, y: 300 }),
    });
    const view = renderHook((d: LibraryShapeInsertDeps) => useLibraryShapeInsert(d), {
      initialProps: deps(),
    });
    return {
      insert: (item: ShapeLibraryItem, at?: { x: number; y: number }) => {
        view.rerender(deps());
        return view.result.current(item, at);
      },
      boxes: () =>
        tab.elements
          .filter((e): e is ShapeElement => e.type === 'shape')
          .map((e) => [e.x, e.y, e.width, e.height]),
      edit: (map: (els: Element[]) => Element[]) => {
        tab = { ...tab, elements: map(tab.elements) };
      },
      switchTab: (id: string) => {
        tab = { id, name: id, elements: [] } as Tab;
      },
      commit,
    };
  }

  it('lines a run of clicks up left to right, 24 px apart, one commit each', () => {
    const h = host();
    h.insert(service);
    h.insert(service);
    h.insert(service);
    expect(h.boxes()).toEqual([
      [440, 270, 120, 60],
      [584, 270, 120, 60],
      [728, 270, 120, 60],
    ]);
    expect(h.commit).toHaveBeenCalledTimes(3);
  });

  it('clears an item of a different size, centred on the row it joins', () => {
    const h = host();
    h.insert(service);
    h.insert(pair);
    expect(h.boxes().slice(1)).toEqual([
      [584, 290, 40, 20],
      [684, 290, 40, 20],
    ]);
  });

  it('places at the centre again once the earlier insert has moved or gone', () => {
    const h = host();
    h.insert(service);
    h.edit((els) => els.map((e) => ({ ...e, x: (e as ShapeElement).x + 5 })));
    h.insert(service);
    expect(h.boxes()[1]).toEqual([440, 270, 120, 60]);
    h.edit(() => []);
    h.insert(service);
    expect(h.boxes()).toEqual([[440, 270, 120, 60]]);
  });

  it('drops exactly where dropped, and remembers the drop', () => {
    const h = host();
    h.insert(service);
    h.insert(service, { x: 500, y: 300 });
    expect(h.boxes()[1]).toEqual([440, 270, 120, 60]);
    h.insert(service);
    expect(h.boxes()[2]).toEqual([584, 270, 120, 60]);
  });

  it("ignores another tab's inserts", () => {
    const h = host();
    h.insert(service);
    h.switchTab('other');
    h.insert(service);
    expect(h.boxes()).toEqual([[440, 270, 120, 60]]);
  });
});
