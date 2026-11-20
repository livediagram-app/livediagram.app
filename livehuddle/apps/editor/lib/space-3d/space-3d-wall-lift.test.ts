// A character against a wall in the 3D view (docs/specs/008-canvas/3d-view.md "Against a wall").
import { describe, expect, it } from 'vitest';
import { AVATAR_HEAD_CHROME, AVATAR_HEIGHT } from '@livehuddle/avatar/walk';
import type { SpaceWall } from './space-3d-walls';
import {
  figureWallLift,
  wallBehind,
  wallLiftAt,
  wallsTallerThanFigures,
} from './space-3d-wall-lift';

// A room's front wall along y = 500, from x 0 to 400, as the Games Night Den's hall sees it.
const front = { a: { x: 0, y: 500 }, b: { x: 400, y: 500 } };
const lift = figureWallLift(1);

describe('a wall behind a standing figure', () => {
  it('lifts a figure whose feet are just in front of a wall, its whole height and chip', () => {
    expect(lift).toBe(AVATAR_HEIGHT + AVATAR_HEAD_CHROME);
    expect(wallLiftAt([front], { x: 200, y: 508 }, 0, 1)).toBe(lift);
    expect(wallLiftAt([front], { x: 200, y: 500 }, 0, 1)).toBe(lift);
  });

  it('scales the lift with the figure', () => {
    expect(wallLiftAt([front], { x: 200, y: 508 }, 0, 1.5)).toBe(figureWallLift(1.5));
    expect(figureWallLift(1.5)).toBeGreaterThan(lift);
  });

  it('leaves a figure further from the wall than it is tall, or past its end, or behind it, as it is', () => {
    expect(wallLiftAt([front], { x: 200, y: 500 + lift + 1 }, 0, 1)).toBe(0);
    expect(wallLiftAt([front], { x: 420, y: 508 }, 0, 1)).toBe(0);
    // North of the wall: the wall is in front of the figure, which it hides as any wall does.
    expect(wallLiftAt([front], { x: 200, y: 490 }, 0, 1)).toBe(0);
  });

  it('never counts a wall running straight away from the camera', () => {
    const side = { a: { x: 200, y: 300 }, b: { x: 200, y: 500 } };
    expect(wallBehind([side], { x: 200, y: 510 }, 0, lift)).toBe(false);
  });

  it('follows the camera round: turned half way, the wall behind is the one to the south', () => {
    // Turned two quarters the camera looks down the plan from the north, so the wall at y 500 is behind a figure
    // standing just north of it.
    expect(wallLiftAt([front], { x: 200, y: 492 }, 2, 1)).toBe(lift);
    expect(wallLiftAt([front], { x: 200, y: 508 }, 2, 1)).toBe(0);
  });

  it('finds a slanted wall at the feet’s column', () => {
    const slant = { a: { x: 0, y: 400 }, b: { x: 400, y: 600 } };
    // At x 200 the wall is at y 500.
    expect(wallBehind([slant], { x: 200, y: 520 }, 0, lift)).toBe(true);
    expect(wallBehind([slant], { x: 200, y: 480 }, 0, lift)).toBe(false);
  });

  it('takes no time with no walls or no feet', () => {
    expect(wallLiftAt([], { x: 200, y: 508 }, 0, 1)).toBe(0);
    expect(wallLiftAt([front], null, 0, 1)).toBe(0);
  });
});

describe('the walls a figure leans into', () => {
  const wall = (kind: SpaceWall['kind'], height: number): SpaceWall => ({
    id: kind,
    ...front,
    kind,
    height,
    shade: 0,
  });

  it('are the walls taller than a character: not a fence, the grass or a stage', () => {
    const tall = wallsTallerThanFigures([
      wall('wall', 152),
      wall('glass', 152),
      wall('fence', 22),
      wall('grass', 7),
      wall('stage', 20),
    ]);
    expect(tall.map((w) => (w as SpaceWall).kind)).toEqual(['wall', 'glass']);
  });
});
