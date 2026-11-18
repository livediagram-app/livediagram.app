import { afterEach, describe, expect, it } from 'vitest';
import { planDir, setArrowTurn } from './arrow-turn';

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
