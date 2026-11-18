import { afterEach, describe, expect, it } from 'vitest';
import { planDir } from '@livehuddle/avatar/arrow-turn';
import {
  boxToCamera,
  resetSpace3DTurn,
  space3DTurn,
  toCamera,
  turnQuarter,
  turnSpace3D,
} from './space-3d-turn';
import { floorPointAt, screenPointOf } from './space-3d-camera';
import { seatBehind, seatLift, standingPiecePointAt } from './space-3d-pieces';
import { cutAwayIds, turnedArea, viewArea } from './space-3d-cutaway';
import { space3DTurnKey } from './space-3d-key';
import type { SpaceWall } from './space-3d-walls';

const key = (code: string, shiftKey = false) => ({
  code,
  shiftKey,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
});

describe('the camera\'s quarter turns (docs/specs/008-canvas/3d-view.md "Turning the camera")', () => {
  afterEach(() => resetSpace3DTurn());

  it('turns left and right, keeps going round, and resets with the arrows', () => {
    turnSpace3D(1);
    expect(space3DTurn.get()).toBe(-1);
    expect(planDir('up')).toBe('right');
    turnSpace3D(-1);
    turnSpace3D(-1);
    turnSpace3D(-1);
    expect(space3DTurn.get()).toBe(2);
    resetSpace3DTurn();
    resetSpace3DTurn();
    expect(space3DTurn.get()).toBe(0);
    expect(planDir('up')).toBe('up');
    expect(turnQuarter(-1)).toBe(3);
    expect(turnQuarter(5)).toBe(1);
  });

  it('reads [ and ] alone as the turn keys', () => {
    expect(space3DTurnKey(key('BracketLeft'))).toBe(-1);
    expect(space3DTurnKey(key('BracketRight'))).toBe(1);
    expect(space3DTurnKey(key('BracketRight', true))).toBeNull();
    expect(space3DTurnKey(key('KeyQ'))).toBeNull();
  });

  it('turns points and boxes as the screen does', () => {
    const p = { x: 2, y: 1 };
    expect([0, 1, 2, 3].map((q) => toCamera(p, q))).toEqual([
      { x: 2, y: 1 },
      { x: -1, y: 2 },
      { x: -2, y: -1 },
      { x: 1, y: -2 },
    ]);
    const box = { x: 0, y: 0, width: 4, height: 2 };
    expect(boxToCamera(box, 0)).toBe(box);
    expect(boxToCamera(box, 1)).toEqual({ x: -2, y: 0, width: 2, height: 4 });
  });

  it('traces a press back through the turned camera to the floor point it shows', () => {
    const size = { width: 800, height: 600 };
    const view = { zoom: 1.4, offset: { x: 30, y: -20 } };
    const point = { x: 420, y: 260 };
    for (const turn of [0, 1, 2, 3, -1]) {
      const s = screenPointOf(point, size, view, 52, undefined, turn);
      const back = floorPointAt(s, { left: 0, top: 0, ...size }, view, 52, undefined, turn)!;
      expect(back.x).toBeCloseTo(point.x, 6);
      expect(back.y).toBeCloseTo(point.y, 6);
    }
  });

  it("lifts a sitter by the camera's side of the piece", () => {
    const desk = { x: 0, y: 0, width: 100, height: 40 };
    // Behind the desk from the front, in front of it from behind.
    expect(seatBehind(desk, { x: 50, y: 4 })).toBe(true);
    expect(seatBehind(desk, { x: 50, y: 4 }, 2)).toBe(false);
    expect(seatLift(desk, { x: 50, y: 36 }, 2)).toBe(seatLift(desk, { x: 50, y: 4 }));
    expect(seatLift(desk, { x: 96, y: 20 }, 1)).toBe(
      seatLift({ x: 0, y: 0, width: 40, height: 100 }, { x: 20, y: 96 }),
    );
  });

  it('answers a press on a standing piece with its middle when turned', () => {
    const piece = {
      box: { x: 0, y: 0, width: 40, height: 20 },
      rect: { left: 0, top: 0, width: 100, height: 100 },
      rotated: false,
    };
    expect(standingPiecePointAt([piece], { x: 10, y: 10 }, 1)).toEqual({ x: 20, y: 10 });
  });

  it("cuts the walls in front of you the camera's way, and reaches every way turned", () => {
    const wall = (id: string, y: number): SpaceWall => ({
      id,
      a: { x: -100, y },
      b: { x: 100, y },
      kind: 'wall',
      height: 152,
      shade: 0,
    });
    const walls = [wall('near', 40), wall('far', -40)];
    expect([...cutAwayIds(walls, { x: 0, y: 0 })]).toEqual(['near']);
    expect([...cutAwayIds(walls, { x: 0, y: 0 }, 2)]).toEqual(['far']);
    const area = viewArea({ zoom: 1, offset: { x: 0, y: 0 } }, { width: 800, height: 600 });
    const turned = turnedArea(area);
    expect(turned.bottom - turned.centre.y).toBe(turned.centre.y - turned.top);
    expect(turned.bottom).toBeGreaterThan(area.bottom);
  });
});
