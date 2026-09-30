import { describe, expect, it } from 'vitest';
import { hexToHsv, hsvToHex } from './hsv';

// The custom colour picker's square and hue slider (docs/specs/023-whiteboard/whiteboard.md).
describe('hsv', () => {
  it('turns hue, saturation and value into a hex', () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00ff00');
    expect(hsvToHex({ h: 240, s: 1, v: 0.5 })).toBe('#000080');
    expect(hsvToHex({ h: 30, s: 0, v: 1 })).toBe('#ffffff');
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe('#ff0000');
  });

  it('reads a hex back, and round-trips', () => {
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 });
    expect(hexToHsv('red')).toBeNull();
    for (const hex of ['#ff6b00', '#00a39b', '#c026d3', '#3b82f6', '#808080']) {
      expect(hsvToHex(hexToHsv(hex)!)).toBe(hex);
    }
  });
});
