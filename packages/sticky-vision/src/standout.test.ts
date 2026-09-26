import { describe, expect, it } from 'vitest';
import { hexToRgb, type ImageBuffer } from './colour';
import { notStandingOut, standoutOf, standsOut, STANDOUT_CALIBRATION } from './standout';

// Does a box hold paper (docs/specs/021-event-storming/event-storming.md Phase 9)? Every image is drawn here.

function wall(hex: string): ImageBuffer {
  const { r, g, b } = hexToRgb(hex);
  const data = new Uint8ClampedArray(120 * 120 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { width: 120, height: 120, data };
}

const BOX = { x: 30, y: 30, w: 60, h: 60 };

function paint(image: ImageBuffer, hex: string, grainAmount = 0) {
  const { r, g, b } = hexToRgb(hex);
  let seed = 11;
  for (let y = BOX.y; y < BOX.y + BOX.h; y += 1) {
    for (let x = BOX.x; x < BOX.x + BOX.w; x += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const d = ((seed / 0x7fffffff) * 2 - 1) * grainAmount;
      const i = (y * image.width + x) * 4;
      image.data[i] = r + d;
      image.data[i + 1] = g + d;
      image.data[i + 2] = b + d;
    }
  }
}

describe('standsOut', () => {
  it('takes a saturated note on kraft', () => {
    const image = wall('#b08a60');
    paint(image, '#f97316');
    expect(standsOut(image, BOX)).toBe(true);
  });

  it('refuses dark grained cardboard, however much its colour differs', () => {
    const image = wall('#c9b8a0');
    paint(image, '#6b3a10', 30);
    expect(standoutOf(image, BOX)).toBeGreaterThan(STANDOUT_CALIBRATION.STANDOUT_SATURATION);
    expect(standsOut(image, BOX)).toBe(false);
  });
});

describe('notStandingOut', () => {
  it('says nothing of a note that stands out', () => {
    const image = wall('#b08a60');
    paint(image, '#f97316');
    expect(notStandingOut(image, BOX)).toBeNull();
  });

  it('names a patch the colour of its wall', () => {
    const image = wall('#b08a60');
    paint(image, '#b08a60');
    expect(notStandingOut(image, BOX)).toBe('standout');
  });

  it('names dark grained cardboard', () => {
    const image = wall('#c9b8a0');
    paint(image, '#6b3a10', 30);
    expect(notStandingOut(image, BOX)).toBe('dark-grain');
  });

  it('leaves the grain unjudged when asked (a pad note is too small to measure it)', () => {
    const image = wall('#c9b8a0');
    paint(image, '#6b3a10', 30);
    expect(notStandingOut(image, BOX, { grain: false })).toBeNull();
  });

  it('still names a patch the colour of its wall with the grain unjudged', () => {
    const image = wall('#b08a60');
    paint(image, '#b08a60');
    expect(notStandingOut(image, BOX, { grain: false })).toBe('standout');
  });
});
