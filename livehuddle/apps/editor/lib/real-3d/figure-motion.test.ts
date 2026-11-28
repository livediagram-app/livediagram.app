import { describe, expect, it } from 'vitest';
import { FigureMotion, YAW, headingOf, turnToward } from './figure-motion';

const run = (
  m: FigureMotion,
  vx: number,
  vy: number,
  s: number,
  facing: keyof typeof YAW = 'down',
) => {
  const at = { x: 0, y: 0 };
  for (let i = 0; i < s * 60; i++) {
    at.x += vx / 60;
    at.y += vy / 60;
    m.update(at, 1 / 60, facing, false);
  }
};

describe('FigureMotion', () => {
  it('faces a diagonal walk diagonally, not the nearest of four ways', () => {
    const m = new FigureMotion('down');
    m.update({ x: 0, y: 0 }, 1 / 60, 'right', false);
    run(m, 184, 184, 1, 'right');
    expect(m.yaw).toBeCloseTo(headingOf(1, 1), 2);
    expect(Math.abs(m.yaw - YAW.right)).toBeGreaterThan(0.5);
  });

  it('turns smoothly, never in one frame', () => {
    const m = new FigureMotion('down');
    m.update({ x: 0, y: 0 }, 1 / 60, 'up', false);
    m.update({ x: 0, y: -4 }, 1 / 60, 'up', false);
    // At most a sixtieth of 2.5 turns a second: a half turn takes a fifth of a second or more.
    expect(Math.abs(m.yaw)).toBeLessThan(0.31);
    expect(Math.abs(m.yaw)).toBeGreaterThan(0);
  });

  it('keeps its way when it stops, until the walker turns it', () => {
    const m = new FigureMotion('down');
    run(m, 184, 184, 1, 'right');
    const diag = m.yaw;
    run(m, 0, 0, 1, 'right');
    expect(m.yaw).toBeCloseTo(diag, 2);
    run(m, 0, 0, 1, 'up');
    expect(Math.abs(Math.atan2(Math.sin(m.yaw - YAW.up), Math.cos(m.yaw - YAW.up)))).toBeLessThan(
      0.01,
    );
  });

  it('takes a jump (a portal, a seat) as no movement', () => {
    const m = new FigureMotion('down');
    m.update({ x: 0, y: 0 }, 1 / 60, 'down', false);
    m.update({ x: 800, y: 0 }, 1 / 60, 'down', false);
    expect(m.speed).toBe(0);
  });

  it('turns the short way round', () => {
    expect(turnToward(3, -3, 1 / 60, 1)).toBeGreaterThan(3);
  });
});
