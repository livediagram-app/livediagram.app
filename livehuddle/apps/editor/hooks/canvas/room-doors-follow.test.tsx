// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  createShape,
  doorOnRoom,
  snapDoorToWall,
  withDoorPiece,
  type Element,
  type ShapeElement,
  type Tab,
} from '@livehuddle/document';
import { useShapeStyleSetters } from './useShapeStyleSetters';
import { useStylePreview } from './useStylePreview';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/009-elements/room-builder.md "It rides its room" and corridor.md "It turns": a room or a corridor
// changed from the element menu (a typed size, a reset proportion, a turn) carries the Doors on its walls.

const [room, door] = withDoorPiece({ ...createShape('room', 0, 0), width: 400, height: 300 }) as [
  ShapeElement,
  ShapeElement,
];
const find = (els: Element[], id: string) => els.find((e) => e.id === id) as ShapeElement;

describe('a typed room size', () => {
  it('keeps the Door on the wall it stood on', () => {
    let elements: Element[] = [room, door];
    const setters = renderHook(() =>
      useShapeStyleSetters({
        currentSelectionIds: () => new Set([room.id]),
        commit: (map) => {
          elements = map(elements);
        },
        activeTab: { id: 't', name: 'T', elements } as Tab,
        readSelection: () => ({ selectedId: room.id, multiSelectedIds: new Set() }),
      }),
    ).result.current;
    setters.setSizeSelected({ height: 500 });
    const resized = find(elements, room.id);
    expect(resized.height).toBe(500);
    expect(doorOnRoom(find(elements, door.id), resized)).toBe(true);
  });
});

describe('a Rotate command on a corridor', () => {
  it('turns the Doors on its walls with it', () => {
    const corridor = { ...createShape('corridor', 0, 0), id: 'c' } as ShapeElement;
    const onWall = snapDoorToWall({ ...createShape('door', 150, 100), id: 'd' }, [corridor]);
    let elements: Element[] = [corridor, onWall];
    const setters = renderHook(() =>
      useShapeStyleSetters({
        currentSelectionIds: () => new Set(['c']),
        commit: (map) => {
          elements = map(elements);
        },
        activeTab: { id: 't', name: 'T', elements } as Tab,
        readSelection: () => ({ selectedId: 'c', multiSelectedIds: new Set() }),
      }),
    ).result.current;
    setters.setRotationSelected(90);
    expect(find(elements, 'c').rotation).toBe(90);
    expect(doorOnRoom(find(elements, 'd'), find(elements, 'c'))).toBe(true);
  });
});

describe('turning a corridor from the menu', () => {
  it('turns the Doors on its walls with it, in the one commit', () => {
    const corridor = { ...createShape('corridor', 0, 0), id: 'c' } as ShapeElement;
    const onWall = snapDoorToWall({ ...createShape('door', 150, 100), id: 'd' }, [corridor]);
    let committed: Tab[] = [{ id: 'tab1', name: 'T', elements: [corridor, onWall] }];
    let commits = 0;
    const preview = renderHook(() =>
      useStylePreview({
        editsBlocked: false,
        activeId: 'tab1',
        currentSelectionIds: () => new Set(['c']),
        tabsRef: { current: committed },
        tickTabs: (map) => {
          committed = map(committed);
        },
        commitTabs: (map) => {
          commits += 1;
          committed = map(committed);
        },
        previewingRef: { current: false },
      }),
    ).result.current;
    preview.commitRotation(90);
    const els = committed[0]!.elements;
    expect(commits).toBe(1);
    expect(find(els, 'c').rotation).toBe(90);
    expect(doorOnRoom(find(els, 'd'), find(els, 'c'))).toBe(true);
  });
});
