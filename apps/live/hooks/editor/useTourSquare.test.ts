// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createShape, type Tab } from '@liveplanner/document';
import { useTourSquare } from './useTourSquare';

// The welcome tour's demonstration square (docs/specs/007-editor/editor-tour.md): placed on the active tab,
// taken away when the tour ends, and nothing else touched.
function harness(initial: Tab[]) {
  let tabs = initial;
  const tickTabs = (map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  };
  const { result } = renderHook(() => useTourSquare({ activeId: 'a', tickTabs }));
  return { result, tabs: () => tabs };
}

const tab = (id: string, elements: Tab['elements'] = []): Tab => ({ id, name: id, elements });

describe('useTourSquare', () => {
  it('places the square on the active tab and takes only it away', () => {
    const keep = createShape('circle', 0, 0);
    const h = harness([tab('a', [keep]), tab('b')]);
    const square = createShape('square', 10, 10);
    act(() => h.result.current.place(square));
    expect(h.tabs()[0]!.elements.map((e) => e.id)).toEqual([keep.id, square.id]);
    let removed: string[] = [];
    act(() => {
      removed = h.result.current.remove();
    });
    expect(removed).toEqual([square.id]);
    expect(h.tabs()[0]!.elements.map((e) => e.id)).toEqual([keep.id]);
  });

  it('removes nothing when it placed nothing', () => {
    const keep = createShape('circle', 0, 0);
    const h = harness([tab('a', [keep])]);
    let removed: string[] = ['x'];
    act(() => {
      removed = h.result.current.remove();
    });
    expect(removed).toEqual([]);
    expect(h.tabs()[0]!.elements).toHaveLength(1);
  });

  it('places several, swaps two for one in place, and takes them all away', () => {
    const keep = createShape('circle', 0, 0);
    const h = harness([tab('a', [keep])]);
    const a = createShape('square', 0, 0);
    const b = createShape('circle', 5, 5);
    const merged = createShape('square', 1, 1);
    act(() => h.result.current.place(a, b));
    expect(h.tabs()[0]!.elements.map((e) => e.id)).toEqual([keep.id, a.id, b.id]);
    act(() => h.result.current.replace([a.id, b.id], merged));
    expect(h.tabs()[0]!.elements.map((e) => e.id)).toEqual([keep.id, merged.id]);
    let removed: string[] = [];
    act(() => {
      removed = h.result.current.remove();
    });
    expect(removed).toEqual([merged.id]);
    expect(h.tabs()[0]!.elements.map((e) => e.id)).toEqual([keep.id]);
  });
});
