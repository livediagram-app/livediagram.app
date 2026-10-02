import { describe, expect, it } from 'vitest';
import { uprightTitleFrame } from './upright-title';

describe('uprightTitleFrame', () => {
  it('turns a box as long as the strip a quarter anticlockwise into it', () => {
    expect(uprightTitleFrame({ x: 860, y: 0, width: 40, height: 200, alongAlign: 'left' })).toEqual(
      {
        position: 'absolute',
        left: 860,
        top: 200,
        width: 200,
        height: 40,
        transform: 'rotate(-90deg)',
        transformOrigin: '0 0',
        overflow: 'hidden',
      },
    );
  });
});
