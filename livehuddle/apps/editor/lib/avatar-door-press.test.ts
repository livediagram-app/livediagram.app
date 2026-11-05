import { describe, expect, it } from 'vitest';
import { DOOR_REACH, type Element, type ShapeElement } from '@livehuddle/document';
import { avatarDoorPress, doorAt, doorNearSide, onDoor } from './avatar-door-press';

// docs/specs/008-canvas/avatar-mode.md "Clicking a piece" (Door).

// A 96 x 24 door centred on (148, 112): a horizontal wall at y = 112.
const door = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'door',
  type: 'shape',
  shape: 'door',
  x: 100,
  y: 100,
  width: 96,
  height: 24,
  ...over,
});
const sticky = { id: 's', type: 'sticky', x: 100, y: 100, width: 96, height: 96 } as Element;

describe('doorAt', () => {
  it('finds the door under a point, a little round its box included', () => {
    expect(doorAt([door()], { x: 148, y: 112 })?.id).toBe('door');
    expect(doorAt([door()], { x: 100 - 8, y: 112 })?.id).toBe('door');
    expect(doorAt([door()], { x: 148, y: 112 - 40 })).toBeNull();
    expect(doorAt([sticky], { x: 148, y: 112 })).toBeNull();
  });

  it('turns with the door: a door on a side wall runs up the canvas', () => {
    const side = door({ rotation: 90 });
    expect(doorAt([side], { x: 148, y: 112 + 40 })?.id).toBe('door');
    expect(doorAt([side], { x: 148 + 40, y: 112 })).toBeNull();
  });

  it('takes the topmost door', () => {
    expect(doorAt([door({ id: 'under' }), door({ id: 'over' })], { x: 148, y: 112 })?.id).toBe(
      'over',
    );
  });
});

// The 96 x 24 door's leaf: hinged at its first jamb on the wall (106, 112), 84 long, sweeping down (+y).
describe('onDoor: what the door paints', () => {
  it('takes a click on the open leaf and inside its swing arc, and not one just past the arc', () => {
    // On the leaf, standing open down from the hinge.
    expect(onDoor(door(), { x: 107, y: 170 })).toBe(true);
    // Inside the quarter circle, near the arc (radius 84 from the hinge).
    const onArc = { x: 106 + 84 * Math.cos(Math.PI / 4), y: 112 + 84 * Math.sin(Math.PI / 4) };
    expect(onDoor(door(), onArc)).toBe(true);
    // Just past the arc, still inside the room's floor: not the door.
    const past = { x: 106 + 100 * Math.cos(Math.PI / 4), y: 112 + 100 * Math.sin(Math.PI / 4) };
    expect(onDoor(door(), past)).toBe(false);
    // Behind the hinge side of the wall the leaf never swings.
    expect(onDoor(door(), { x: 148, y: 112 - 40 })).toBe(false);
  });

  it('shut, is the opening along the wall only', () => {
    expect(onDoor(door({ doorClosed: true }), { x: 107, y: 170 })).toBe(false);
    expect(onDoor(door({ doorClosed: true }), { x: 148, y: 114 })).toBe(true);
  });

  it('is at least 32 screen px across its wall however far out the camera is', () => {
    const shut = door({ doorClosed: true });
    // At 50% zoom, 16 screen px either side is 32 canvas px: the 24 px door's own box reaches only 12 + 10.
    expect(onDoor(shut, { x: 148, y: 112 - 30 }, 0.5)).toBe(true);
    expect(onDoor(shut, { x: 148, y: 112 - 30 }, 1)).toBe(false);
    expect(onDoor(shut, { x: 148, y: 112 - 36 }, 0.5)).toBe(false);
  });

  it('turns its swing with the door', () => {
    // Turned a quarter, the hinge is at (148, 70) and the leaf swings to -x.
    expect(onDoor(door({ rotation: 90 }), { x: 148 - 50, y: 70 + 20 })).toBe(true);
    expect(onDoor(door({ rotation: 90 }), { x: 148 + 50, y: 70 + 20 })).toBe(false);
  });
});

describe('doorNearSide', () => {
  it('is just outside the opening on the side the feet stand on', () => {
    const below = doorNearSide(door(), { x: 148, y: 400 });
    const above = doorNearSide(door(), { x: 148, y: -400 });
    expect(below.x).toBeCloseTo(148);
    expect(below.y).toBeGreaterThan(112);
    expect(above.y).toBeLessThan(112);
    // Within reach once there, so the next click swings it.
    expect(below.y - 112).toBeLessThanOrEqual(DOOR_REACH);
  });
});

describe('avatarDoorPress', () => {
  it('swings a door from a click on its arc inside the room, and passes a click just past it', () => {
    const arc = { x: 106 + 60, y: 112 + 40 };
    expect(avatarDoorPress([door()], arc, { x: 148, y: 140 })).toMatchObject({ next: true });
    expect(avatarDoorPress([door()], { x: 106 + 75, y: 112 + 70 }, { x: 148, y: 140 })).toBeNull();
  });

  it('says the feet can reach a door they stand beside, and walks to it otherwise', () => {
    expect(avatarDoorPress([door()], { x: 148, y: 112 }, { x: 148, y: 140 })).toMatchObject({
      doorId: 'door',
      next: true,
    });
    const far = avatarDoorPress([door()], { x: 148, y: 112 }, { x: 148, y: 600 });
    expect(far?.next).toBe(false);
    expect(far?.nearSide.y).toBeGreaterThan(112);
  });

  it('is null off every door', () => {
    expect(avatarDoorPress([door(), sticky], { x: 600, y: 600 }, { x: 0, y: 0 })).toBeNull();
  });
});
