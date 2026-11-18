import { afterEach, describe, expect, it } from 'vitest';
import { planDir, screenDir, setArrowTurn } from './arrow-turn';

describe('arrow keys steer by the screen (3d-view.md "Turning the camera")', () => {
  afterEach(() => setArrowTurn(0));
  it('maps each screen arrow through the camera turn', () => {
    expect(planDir('up')).toBe('up');
    expect(planDir('up', 1)).toBe('left');
    expect(planDir('right', 1)).toBe('up');
    expect(planDir('up', 2)).toBe('down');
    expect(planDir('up', -1)).toBe('right');
    setArrowTurn(3);
    expect(planDir('up')).toBe('right');
  });
});

describe('screenDir: a plan facing as the turned camera sees it', () => {
  it('undoes planDir for every turn and way', () => {
    for (const q of [0, 1, 2, 3, -1, 5])
      for (const d of ['up', 'right', 'down', 'left'] as const)
        expect(screenDir(planDir(d, q), q)).toBe(d);
  });
  it('is the plan facing itself unturned', () => {
    expect(screenDir('left', 0)).toBe('left');
  });
});
