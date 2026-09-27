import { describe, expect, it } from 'vitest';
import { readColour } from './colour';

describe('readColour', () => {
  it('reads rgba() as a hex plus alpha', () => {
    expect(readColour('rgba(255,0,16,0.5)')).toEqual({ hex: '#ff0010', alpha: 0.5 });
    expect(readColour('rgba( 0 , 128 , 255 , 1 )')).toEqual({ hex: '#0080ff', alpha: 1 });
  });

  it('reads rgb(), including the space-separated form', () => {
    expect(readColour('rgb(1, 2, 3)')).toEqual({ hex: '#010203', alpha: 1 });
    expect(readColour('rgb(1 2 3 / 25%)')).toEqual({ hex: '#010203', alpha: 0.25 });
  });

  it('reads 3, 4, 6 and 8 digit hex', () => {
    expect(readColour('#abc')).toEqual({ hex: '#aabbcc', alpha: 1 });
    expect(readColour('#abc8')).toEqual({ hex: '#aabbcc', alpha: 0x88 / 255 });
    expect(readColour('#A1B2C3')).toEqual({ hex: '#a1b2c3', alpha: 1 });
    expect(readColour('#a1b2c380')).toEqual({ hex: '#a1b2c3', alpha: 0x80 / 255 });
  });

  it('reads the handful of keywords Whiteboard markup uses', () => {
    expect(readColour('black')).toEqual({ hex: '#000000', alpha: 1 });
    expect(readColour('white')).toEqual({ hex: '#ffffff', alpha: 1 });
    expect(readColour('transparent')).toEqual({ hex: '#000000', alpha: 0 });
  });

  it('clamps channels and alpha', () => {
    expect(readColour('rgba(300,-5,0,2)')).toEqual({ hex: '#ff0000', alpha: 1 });
  });

  it('returns null for what it cannot read', () => {
    for (const v of ['', 'none', 'url(#p1)', 'hsl(0 0% 0%)', '#12', 'rgb(1,2)']) {
      expect(readColour(v)).toBeNull();
    }
  });
});
