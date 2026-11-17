// @vitest-environment jsdom
// A Door on a Room's back wall, on the canvas (docs/specs/009-elements/room-builder.md "On a back wall", Work Tracker
// 1042): the room breaks its band at an open one and stands a shut one in its face; the Door then draws only what
// moves.
import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  createShape,
  ROOM_BACK_FACE,
  ROOM_WALL,
  snapDoorToWall,
  type Element,
  type ShapeElement,
} from '@livehuddle/document';
import { BackWallDoorsProvider } from './back-wall-doors-store';
import { RoomView } from './RoomView';
import { DoorView } from './RoomBuilderViews';

const ROOM: ShapeElement = {
  ...createShape('room', 0, 0),
  id: 'room',
  width: 400,
  height: 300,
  roomDoor: 'none',
};
function doorAt(x: number, y: number, extra: Partial<ShapeElement> = {}): ShapeElement {
  const base = { ...createShape('door', 0, 0), id: 'door' };
  return {
    ...snapDoorToWall({ ...base, x: x - base.width / 2, y: y - base.height / 2 }, [ROOM]),
    ...extra,
  };
}
const back = (extra: Partial<ShapeElement> = {}) =>
  doorAt(150, ROOM_BACK_FACE - ROOM_WALL / 2, extra);

function board(elements: Element[], room: ShapeElement = ROOM) {
  const door = elements.find((e) => e.id === 'door') as ShapeElement;
  return (
    <BackWallDoorsProvider elements={elements}>
      <RoomView element={room} stroke="#334155" floor="#f5f0e6" />
      <DoorView element={door} stroke="#334155" floor="#f5f0e6" />
    </BackWallDoorsProvider>
  );
}
// The room's back band faces, by where each starts (the painter may draw a part in more than one rect).
const faces = (c: HTMLElement) => [
  ...new Set(
    [...c.querySelectorAll('svg[aria-label^="Room"] rect')]
      .filter((r) => r.getAttribute('height') === String(ROOM_BACK_FACE - ROOM_WALL + 1))
      .map((r) => r.getAttribute('x')),
  ),
];
const doorSvg = (c: HTMLElement) => c.querySelector('svg[aria-label$="door"]')!;

describe('a Door on a back wall, on the canvas', () => {
  it('breaks the room’s band at an open Door, the Door drawing no gap or jambs', () => {
    const { container } = render(board([ROOM, back()]));
    expect(faces(container)).toHaveLength(2);
    // The leaf and its arc only.
    expect(doorSvg(container).querySelectorAll('rect').length).toBe(1);
    expect(doorSvg(container).querySelector('.lh-door-swing')).not.toBeNull();
  });

  it('keeps the band whole with the shut leaf in it, the Door drawing nothing', () => {
    const { container } = render(board([ROOM, back({ doorClosed: true })]));
    expect(faces(container)).toHaveLength(1);
    expect(doorSvg(container).getAttribute('aria-label')).toBe('Closed door');
    expect(doorSvg(container).children).toHaveLength(0);
    expect(container.querySelector('svg[aria-label^="Room"] ellipse')).not.toBeNull();
  });

  it('leaves a Door on a side wall cutting its wall itself, open and shut', () => {
    for (const doorClosed of [false, true]) {
      const side = doorAt(ROOM_WALL / 2, 150, { doorClosed });
      const { container, unmount } = render(board([ROOM, side]));
      expect(faces(container)).toHaveLength(1);
      // Its gap and two jambs, then what moves.
      expect(doorSvg(container).querySelectorAll('rect').length).toBeGreaterThanOrEqual(4);
      unmount();
    }
  });

  it('hands a glass room its back-wall doors: a shut one stands as a frosted leaf in the face', () => {
    const glass = { ...ROOM, variant: 'glass' };
    const { container } = render(board([glass, back({ doorClosed: true })], glass));
    expect(container.querySelectorAll('[data-back-wall-door]')).toHaveLength(1);
  });

  it('draws the room plainly outside a canvas, with no board to read', () => {
    const { container } = render(<RoomView element={ROOM} stroke="#334155" floor="#f5f0e6" />);
    expect(faces(container)).toHaveLength(1);
  });

  it('follows the board: the same doors keep the doorway, a door shutting closes it', () => {
    const tree = (els: Element[]) => (
      <BackWallDoorsProvider elements={els}>
        <RoomView element={ROOM} stroke="#334155" floor="#f5f0e6" />
      </BackWallDoorsProvider>
    );
    const door = back();
    const { rerender, container } = render(tree([ROOM, door]));
    // A new board whose back-wall doors are the same.
    act(() => rerender(tree([ROOM, { ...door }])));
    expect(faces(container)).toHaveLength(2);
    // The door shuts: the room draws whole, the leaf in it.
    act(() => rerender(tree([ROOM, { ...door, doorClosed: true }])));
    expect(faces(container)).toHaveLength(1);
  });
});
