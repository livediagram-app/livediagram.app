// @vitest-environment jsdom

// Cmd+D on a multi-selection. It used to hand-roll its own copy, remapping
// arrow pins and nothing else, so element-to-element references on the copies
// still named the originals. These pin that it goes through duplicateElements.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element, ShapeElement, Tab } from '@livediagram/diagram';
import { useElementDuplication } from './useElementDuplication';

const shape = (id: string, extra: Partial<ShapeElement> = {}): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 50, height: 50, ...extra }) as Element;

function duplicate(elements: Element[], selected: string[]): Element[] {
  let committed: Element[] = elements;
  const { result } = renderHook(() =>
    useElementDuplication({
      selectedId: null,
      multiSelectedIds: new Set(selected),
      activeTab: { id: 't', name: 'T', elements } as Tab,
      commit: (m) => {
        committed = m(committed);
      },
      setSelectedId: vi.fn(),
      setMultiSelectedIds: vi.fn(),
    }),
  );
  result.current.duplicateMultiSelected();
  return committed.slice(elements.length);
}

describe('duplicateMultiSelected', () => {
  it('re-parents a copied mind-map child onto the copied parent', () => {
    const copies = duplicate(
      [shape('root'), shape('child', { mindParentId: 'root' })],
      ['root', 'child'],
    ) as ShapeElement[];
    const rootCopy = copies.find((c) => c.mindParentId === undefined)!;
    const childCopy = copies.find((c) => c.mindParentId !== undefined)!;
    expect(rootCopy.id).not.toBe('root');
    expect(childCopy.mindParentId).toBe(rootCopy.id);
  });

  it('brings along a connector between two copied boxes', () => {
    const arrow = {
      id: 'a',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'x', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'y', anchor: 'w' },
    } as Element;
    const copies = duplicate([shape('x'), shape('y'), arrow], ['x', 'y']);
    expect(copies.filter((c) => c.type === 'arrow')).toHaveLength(1);
  });
});

// docs/specs/021-event-storming/event-storming.md "Always on a lane": on an event-storming board a duplicate
// holding a workshop note staggers along its lane (24px right, same lane).
describe('duplicate on an event-storming board', () => {
  const note = (id: string, x: number, y: number): Element =>
    ({
      id,
      type: 'sticky',
      x,
      y,
      width: 200,
      height: 200,
      esKind: 'domain-event',
      fillColor: '#fdba74',
      fixedSize: true,
    }) as Element;

  function run(elements: Element[], selected: string[]): Element[] {
    let committed: Element[] = elements;
    const { result } = renderHook(() =>
      useElementDuplication({
        selectedId: selected.length === 1 ? selected[0]! : null,
        multiSelectedIds: new Set(selected.length > 1 ? selected : []),
        activeTab: { id: 't', name: 'T', kind: 'event-storming', elements } as Tab,
        commit: (m) => {
          committed = m(committed);
        },
        setSelectedId: vi.fn(),
        setMultiSelectedIds: vi.fn(),
      }),
    );
    if (selected.length === 1) result.current.duplicateSelected();
    else result.current.duplicateMultiSelected();
    return committed.slice(elements.length);
  }

  it('staggers one note along its lane', () => {
    const [copy] = run([note('a', 100, 240)], ['a']);
    expect(copy).toMatchObject({ x: 124, y: 240 });
  });

  it('lands the copy of a free-placed note on the nearest lane', () => {
    const [copy] = run([note('a', 100, 130)], ['a']);
    expect(copy).toMatchObject({ x: 124, y: 240 });
  });

  it('staggers a selection along the lanes, shapes riding the same offset', () => {
    const copies = run(
      [note('a', 0, 0), note('b', 216, 240), shape('s', { x: 50, y: 500 })],
      ['a', 'b', 's'],
    );
    expect(copies.map((c) => ('x' in c ? [c.x, c.y] : null))).toEqual([
      [24, 0],
      [240, 240],
      [74, 500],
    ]);
  });
});
