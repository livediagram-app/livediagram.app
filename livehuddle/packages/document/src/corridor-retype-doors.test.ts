import { describe, expect, it } from 'vitest';
import {
  CORRIDOR_VARIANTS,
  corridorWalls,
  createShape,
  onRoomWall,
  retypeCorridorDoors,
  snapDoorToWall,
  withPieceType,
  type Element,
  type ShapeElement,
} from './index';

// docs/specs/009-elements/office.md "A Corridor's Doors move to its new walls" (Work Tracker 1453): a corridor's Type
// change puts the Doors and Windows on its old walls onto the nearest stretch of its new walls, never on top of each
// other, and removes (and counts) one no new wall can hold.

const corridorOf = (type: string): ShapeElement =>
  withPieceType({ ...createShape('corridor', 0, 0), id: 'c' }, type);

// A wall piece snapped onto the middle of each of the corridor's wall runs long enough to hold it.
function piecesOn(corridor: ShapeElement, kind: 'door' | 'window' = 'door'): ShapeElement[] {
  const base = createShape(kind, 0, 0);
  return corridorWalls(corridor)
    .filter((w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) >= base.width)
    .map((w, i) => {
      const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
      return snapDoorToWall(
        { ...base, id: `${kind}${i}`, x: mid.x - base.width / 2, y: mid.y - base.height / 2 },
        [corridor],
      );
    });
}

const centre = (el: ShapeElement) => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });

function expectSeated(pieces: readonly ShapeElement[], corridor: ShapeElement) {
  for (const p of pieces) expect(onRoomWall(p, corridor)).toBe(true);
  for (const [i, p] of pieces.entries())
    for (const q of pieces.slice(i + 1)) {
      const a = centre(p);
      const b = centre(q);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual((p.width + q.width) / 2);
    }
}

describe('retypeCorridorDoors', () => {
  for (const from of CORRIDOR_VARIANTS)
    for (const to of CORRIDOR_VARIANTS) {
      if (from === to) continue;
      it(`moves every Door from a ${from} onto the walls of a ${to}`, () => {
        const old = corridorOf(from);
        const doors = piecesOn(old);
        expect(doors.length).toBeGreaterThan(0);
        const before: Element[] = [old, ...doors];
        const next = corridorOf(to);
        const { elements, removed } = retypeCorridorDoors(before, [next, ...doors]);
        const kept = elements.filter(
          (el): el is ShapeElement => el.type === 'shape' && el.shape === 'door',
        );
        expect(kept.length + removed.doors).toBe(doors.length);
        expect(removed.windows).toBe(0);
        expectSeated(kept, next);
        // Every kept Door keeps its id: the same Door, moved.
        for (const d of kept) expect(doors.some((o) => o.id === d.id)).toBe(true);
      });
    }

  it('puts a Door on the nearest new wall run to where it stood', () => {
    const old = corridorOf('straight');
    // A Door on the bottom wall's right end (y = 115).
    const door = snapDoorToWall({ ...createShape('door', 0, 0), id: 'd', x: 360, y: 103 }, [old]);
    const corner = corridorOf('corner');
    const [, moved] = retypeCorridorDoors([old, door], [corner, door]).elements as ShapeElement[];
    // The Corner's (360 x 360, centred on the Straight's centre) nearest run to it is its inner arm's bottom wall.
    expect(onRoomWall(moved!, corner)).toBe(true);
    const at = centre(moved!);
    const was = centre(door);
    expect(Math.hypot(at.x - was.x, at.y - was.y)).toBeLessThan(150);
  });

  it('removes and counts a Door wider than every new wall run, keeping the others', () => {
    const old = corridorOf('straight');
    const wide = snapDoorToWall(
      { ...createShape('door', 0, 0), id: 'wide', width: 400, x: 40, y: -7 },
      [old],
    );
    const door = snapDoorToWall({ ...createShape('door', 0, 0), id: 'd', x: 192, y: 103 }, [old]);
    const corner = corridorOf('corner');
    const { elements, removed } = retypeCorridorDoors([old, wide, door], [corner, wide, door]);
    expect(removed).toEqual({ doors: 1, windows: 0 });
    expect(elements.map((e) => e.id)).toEqual(['c', 'd']);
  });

  it('counts a Window apart, and faces a moved one into the corridor', () => {
    const old = corridorOf('straight');
    const windows = piecesOn(old, 'window');
    const wide = { ...windows[0]!, id: 'wide', width: 400, x: 40 };
    const cross = corridorOf('cross');
    const { elements, removed } = retypeCorridorDoors(
      [old, windows[1]!, wide],
      [cross, windows[1]!, wide],
    );
    expect(removed).toEqual({ doors: 0, windows: 1 });
    const moved = elements[1] as ShapeElement;
    expectSeated([moved], cross);
    // Snapped as a Window is: turned to face into the corridor's floor.
    expect(moved).toEqual(snapDoorToWall(moved, [cross]));
  });

  it('leaves a Door that also stands on a neighbouring wall where it is, and moves the others clear of it', () => {
    const old = corridorOf('straight');
    const door = snapDoorToWall({ ...createShape('door', 0, 0), id: 'd', x: 192, y: -7 }, [old]);
    // A room above whose front wall line is the corridor's top wall (y = 5) from x = 0 to 150: its Door stays put.
    const room: ShapeElement = {
      ...createShape('room', 0, -290),
      id: 'room',
      width: 150,
      height: 300,
      roomDoor: 'none',
    };
    const shared = snapDoorToWall({ ...createShape('door', 0, 0), id: 'shared', x: 40, y: -7 }, [
      room,
    ]);
    const tee = corridorOf('tee');
    const { elements } = retypeCorridorDoors([old, room, shared, door], [tee, room, shared, door]);
    const [, , keptShared, moved] = elements as ShapeElement[];
    expect(keptShared).toBe(shared);
    expect(onRoomWall(moved!, tee)).toBe(true);
    expectSeated(
      [keptShared!, moved!].filter((d) => onRoomWall(d, tee)),
      tee,
    );
  });

  it('gives back the same board when no corridor changed type, or a retyped one held nothing', () => {
    const old = corridorOf('straight');
    const doors = piecesOn(old);
    const same: Element[] = [old, ...doors];
    expect(retypeCorridorDoors(same, same).elements).toBe(same);
    const bare: Element[] = [corridorOf('corner')];
    expect(retypeCorridorDoors([old], bare).elements).toBe(bare);
    const other: Element[] = [createShape('rug', 0, 0)];
    expect(retypeCorridorDoors(other, other).elements).toBe(other);
  });
});
