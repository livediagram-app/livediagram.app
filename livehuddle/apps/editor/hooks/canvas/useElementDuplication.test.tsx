// @vitest-environment jsdom

// Cmd+D on a multi-selection. It used to hand-roll its own copy, remapping
// arrow pins and nothing else, so element-to-element references on the copies
// still named the originals. These pin that it goes through duplicateElements.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element, ShapeElement } from '@livehuddle/document';
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
