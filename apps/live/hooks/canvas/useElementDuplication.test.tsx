// @vitest-environment jsdom

// Cmd+D on a multi-selection. It used to hand-roll its own copy, remapping
// arrow pins and nothing else, so element-to-element references on the copies
// still named the originals. These pin that it goes through duplicateElements.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element, ShapeElement } from '@liveplanner/document';
import { useElementDuplication } from './useElementDuplication';

const shape = (id: string, extra: Partial<ShapeElement> = {}): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 50,
  height: 50,
  ...extra,
});

function duplicate(elements: Element[], selected: string[]): Element[] {
  let committed: Element[] = elements;
  const { result } = renderHook(() =>
    useElementDuplication({
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set(selected) }),
      activeTab: { id: 't', name: 'T', elements },
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

describe('duplicateSelected', () => {
  it('lets a lone copy of an attached badge go of its host, offset beside the original', () => {
    const host = shape('h', { width: 200, height: 100 });
    const badge = {
      ...shape('b', { shape: 'badge', x: -12, y: -12, width: 24, height: 24, label: '1' }),
      attachedTo: 'h',
      attachAt: 'top-left',
    } as Element;
    let committed: Element[] = [host, badge];
    const { result } = renderHook(() =>
      useElementDuplication({
        readSelection: () => ({ selectedId: 'b', multiSelectedIds: new Set() }),
        activeTab: { id: 't', name: 'T', elements: committed },
        commit: (m) => {
          committed = m(committed);
        },
        setSelectedId: vi.fn(),
        setMultiSelectedIds: vi.fn(),
      }),
    );
    result.current.duplicateSelected();
    const copy = committed[2] as ShapeElement;
    expect(copy.attachedTo).toBeUndefined();
    expect(copy.attachAt).toBeUndefined();
    expect(copy.x).not.toBe(-12);
  });
});
