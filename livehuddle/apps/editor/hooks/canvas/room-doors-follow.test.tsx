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
} from '@livehuddle/document';
import { useShapeStyleSetters } from './useShapeStyleSetters';

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
        activeTab: { id: 't', name: 'T', elements },
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
        activeTab: { id: 't', name: 'T', elements },
        readSelection: () => ({ selectedId: 'c', multiSelectedIds: new Set() }),
      }),
    ).result.current;
    setters.setRotationSelected(90);
    expect(find(elements, 'c').rotation).toBe(90);
    expect(doorOnRoom(find(elements, 'd'), find(elements, 'c'))).toBe(true);
  });
});
