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
  shape: 'focus-button',
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

// Duplicate puts the copy in the nearest free spot beside the original, selected (Work Tracker 636,
// lib/duplicate-placement.ts holds the rule and its cases).
describe('duplicateSelected', () => {
  it('puts the copy beside the original, clear of it, and selects it', () => {
    const arcade = shape('m', { shape: 'arcade-machine', x: 100, y: 100, width: 96, height: 144 });
    let committed: Element[] = [arcade];
    const setSelectedId = vi.fn();
    const { result } = renderHook(() =>
      useElementDuplication({
        readSelection: () => ({ selectedId: 'm', multiSelectedIds: new Set() }),
        activeTab: { id: 't', name: 'T', elements: [arcade] },
        commit: (m) => {
          committed = m(committed);
        },
        setSelectedId,
        setMultiSelectedIds: vi.fn(),
      }),
    );
    result.current.duplicateSelected();
    const copy = committed[1] as ShapeElement;
    expect(copy).toMatchObject({ shape: 'arcade-machine', x: 100 + 96 + 24, y: 100 });
    expect(setSelectedId).toHaveBeenCalledWith(copy.id);
  });
});

describe('duplicateMultiSelected placement', () => {
  it('moves the copies as one group beside the selection', () => {
    const copies = duplicate([shape('x'), shape('y', { x: 100 })], ['x', 'y']);
    expect(copies.map((c) => (c as ShapeElement).x)).toEqual([150 + 24, 250 + 24]);
    expect(copies.map((c) => (c as ShapeElement).y)).toEqual([0, 0]);
  });

  it('snaps a copied Door whose Room stayed behind onto the nearest wall', () => {
    const room = shape('r', { shape: 'room', x: 0, y: 0, width: 480, height: 360, roomDoor: 'none' });
    // A Door and a plant standing free just outside the room's front wall: the group's copy lands right of them, the
    // Door's copy still within reach of that wall.
    const door = shape('d', { shape: 'door', x: 200, y: 380, width: 96, height: 24 });
    const plant = shape('p', { shape: 'plant', x: 320, y: 380, width: 40, height: 40 });
    const copies = duplicate([room, door, plant], ['d', 'p']);
    const doorCopy = copies.find((c) => (c as ShapeElement).shape === 'door') as ShapeElement;
    // Snapped onto the front wall: centred on its line (y = 360 - 5).
    expect(doorCopy.y + doorCopy.height / 2).toBeCloseTo(355);
  });
});
