import { describe, expect, it } from 'vitest';
import { classifyHsv, classifyRgb } from './classify';
import { rgbToHsv, type ImageBuffer } from './colour';
import { detectStickies } from './detect';
import type { PaperFloors } from './floors';
import { rgbToLab } from './lab';

// Pale paper on a pale wall (spec/139 Phase 9). A pale pink note on white
// paper has too little HSV saturation to clear the floor at the wall's hue,
// yet in CIELAB a*b* it sits well clear of the wall. When it is also lit like
// the wall, it is paper.

type Rgb = [number, number, number];

const WHITE_WALL: Rgb = [196, 191, 182];
const PALE_PINK: Rgb = [236, 190, 176];
// The same pink in shade: as far from the wall in a*b*, but darker than the
// wall, which is what the blurred rim of a note and a gap between two notes
// look like.
const SHADED_PINK: Rgb = [158, 124, 116];
// Masking tape: a pale yellow, just as far from the wall.
const TAPE: Rgb = [198, 192, 150];
// The wall's own noise.
const OFF_WHITE: Rgb = [194, 186, 170];

function whiteWallFloors(): PaperFloors {
  const wall = rgbToLab(...WHITE_WALL);
  const hsv = rgbToHsv({ r: WHITE_WALL[0], g: WHITE_WALL[1], b: WHITE_WALL[2] });
  return {
    saturation: 0.28,
    value: hsv.v * 0.7,
    wallHue: hsv.h,
    wallA: wall.a,
    wallB: wall.b,
    wallValue: hsv.v,
  };
}

const hsvOf = ([r, g, b]: Rgb) => rgbToHsv({ r, g, b });

describe('pale paper, judged by its distance from the wall in CIELAB', () => {
  it('is wall to HSV alone (the case this rule exists for)', () => {
    expect(classifyHsv(hsvOf(PALE_PINK), whiteWallFloors())).toBe('wall');
  });

  it('reads pale pink paper on a white wall as paper, by its hue', () => {
    expect(classifyRgb(...PALE_PINK, whiteWallFloors())).toBe('domain-event');
  });

  it('leaves the same colour darker than the wall as wall', () => {
    const wall = rgbToLab(...WHITE_WALL);
    const shaded = rgbToLab(...SHADED_PINK);
    expect(Math.hypot(shaded.a - wall.a, shaded.b - wall.b)).toBeGreaterThan(12);
    expect(classifyRgb(...SHADED_PINK, whiteWallFloors())).toBe('wall');
  });

  it('leaves pale yellow as wall: it is masking tape as often as a note', () => {
    expect(classifyRgb(...TAPE, whiteWallFloors())).toBe('wall');
  });

  it('leaves the wall’s own noise as wall', () => {
    expect(classifyRgb(...OFF_WHITE, whiteWallFloors())).toBe('wall');
  });

  it('decides by HSV alone where the wall’s brightness is not known', () => {
    const { wallValue: _v, ...noValue } = whiteWallFloors();
    expect(classifyRgb(...PALE_PINK, noValue)).toBe('wall');
  });
});

describe('detecting pale pink notes on a white wall', () => {
  function wall(width: number, height: number, [r, g, b]: Rgb): ImageBuffer {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
    return { width, height, data };
  }

  function note(image: ImageBuffer, x: number, y: number, size: number, [r, g, b]: Rgb) {
    for (let yy = y; yy < y + size; yy += 1) {
      for (let xx = x; xx < x + size; xx += 1) {
        const i = (yy * image.width + xx) * 4;
        image.data[i] = r;
        image.data[i + 1] = g;
        image.data[i + 2] = b;
      }
    }
  }

  function detectOn(at: number[][], size: number) {
    const image = wall(480, 320, WHITE_WALL);
    for (const [x, y] of at) note(image, x!, y!, size, PALE_PINK);
    return detectStickies(image);
  }

  it('finds every one of them on a sparse wall', () => {
    const at = [
      [60, 60],
      [300, 60],
      [180, 200],
    ];
    const found = detectOn(at, 32);
    expect(found).toHaveLength(at.length);
    for (const [x, y] of at) {
      expect(found.some((s) => Math.abs(s.x - x!) <= 3 && Math.abs(s.y - y!) <= 3)).toBe(true);
    }
  });
});
