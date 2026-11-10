import { describe, expect, it } from 'vitest';
import { actorFigureRect } from './actor-figure';

// The rect an actor's 90 × 130 figure is fitted into (docs/specs/008-canvas/canvas-and-palette.md
// "User"): unchanged while the name fits the figure's own band, shrunk and lifted when it does not.
describe('actorFigureRect', () => {
  it('leaves a palette actor whose name fits the band exactly as it was', () => {
    expect(actorFigureRect({ width: 90, height: 130 })).toEqual({
      x: 0,
      y: 0,
      width: 90,
      height: 130,
    });
    expect(actorFigureRect({ width: 180, height: 260, label: 'User', textSize: 'sm' })).toEqual({
      x: 0,
      y: 0,
      width: 180,
      height: 260,
    });
  });

  it('keeps the figure clear of a name that needs more room than its band', () => {
    // 14 px at 1.25 line height and 6 px padding both sides: 29.5 px for one line.
    const box = { width: 120, height: 100, label: 'Returning visitor', textSize: 'sm' as const };
    const r = actorFigureRect(box);
    const k = r.height / 130;
    // The legs (112 of the 130) end where the name's room begins.
    expect(r.y + 112 * k).toBeCloseTo(100 - 29.5, 6);
    expect(k).toBeCloseTo((100 - 29.5) / 112, 6);
  });

  it('gives a name on two lines two lines of room', () => {
    const r = actorFigureRect({ width: 120, height: 140, label: 'Guest\nuser', textSize: 'sm' });
    expect(r.y + (112 * r.height) / 130).toBeCloseTo(140 - (2 * 17.5 + 12), 6);
  });
});
