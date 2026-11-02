import { describe, expect, it } from 'vitest';
import { hexToRgb, type ImageBuffer } from './colour';
import {
  dropBlank,
  edgeContrastOf,
  isDarkGrain,
  lbpEntropyOf,
  roughnessOf,
  valueSpreadOf,
} from './texture';

// Junk rejection by what the PAPER looks like (docs/specs/021-event-storming/event-storming.md Phase 9): every image
// is drawn here, so each feature is checked against a surface whose texture is
// known exactly.

function blank(width: number, height: number, hex: string): ImageBuffer {
  const { r, g, b } = hexToRgb(hex);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

function paint(image: ImageBuffer, x: number, y: number, w: number, h: number, hex: string) {
  const { r, g, b } = hexToRgb(hex);
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      const i = (yy * image.width + xx) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
    }
  }
}

// A deterministic grain, like corrugated cardboard or a rough print: every
// pixel moved up or down in brightness by a pseudo-random amount.
function grain(image: ImageBuffer, x: number, y: number, w: number, h: number, amount: number) {
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      const i = (yy * image.width + xx) * 4;
      const d = (rand() - 0.5) * 2 * amount;
      for (let c = 0; c < 3; c += 1) image.data[i + c] = image.data[i + c]! + d;
    }
  }
}

const BOX = { x: 20, y: 20, w: 60, h: 60 };

describe('roughnessOf', () => {
  it('reads flat paper as smooth', () => {
    const image = blank(100, 100, '#b08a60');
    paint(image, BOX.x, BOX.y, BOX.w, BOX.h, '#fdba74');
    expect(roughnessOf(image, BOX)).toBeLessThan(0.02);
  });

  it('reads grained cardboard as rough', () => {
    const image = blank(100, 100, '#b08a60');
    paint(image, BOX.x, BOX.y, BOX.w, BOX.h, '#fdba74');
    grain(image, BOX.x, BOX.y, BOX.w, BOX.h, 30);
    expect(roughnessOf(image, BOX)).toBeGreaterThan(0.03);
  });

  it('ignores handwriting on smooth paper', () => {
    const image = blank(100, 100, '#b08a60');
    paint(image, BOX.x, BOX.y, BOX.w, BOX.h, '#fdba74');
    for (let row = 0; row < 4; row += 1) paint(image, 30, 30 + row * 10, 40, 3, '#1f2937');
    expect(roughnessOf(image, BOX)).toBeLessThan(0.02);
  });
});

describe('lbpEntropyOf', () => {
  it('is low on flat paper and high on grain', () => {
    const flat = blank(100, 100, '#fdba74');
    const rough = blank(100, 100, '#fdba74');
    grain(rough, 0, 0, 100, 100, 30);
    expect(lbpEntropyOf(flat, BOX)).toBeLessThan(0.1);
    expect(lbpEntropyOf(rough, BOX)).toBeGreaterThan(0.5);
  });
});

describe('edgeContrastOf', () => {
  it('is high round a note and nil round a patch of the wall itself', () => {
    const image = blank(100, 100, '#b08a60');
    paint(image, BOX.x, BOX.y, BOX.w, BOX.h, '#fdba74');
    expect(edgeContrastOf(image, BOX)).toBeGreaterThan(0.2);
    const wall = blank(100, 100, '#b08a60');
    expect(edgeContrastOf(wall, BOX)).toBeLessThan(0.02);
  });

  it('is set by the WEAKEST side, so a patch between two notes stays low', () => {
    const image = blank(100, 100, '#b08a60');
    // Notes left and right of the box; the box itself is bare wall.
    paint(image, 0, BOX.y, BOX.x, BOX.h, '#fdba74');
    paint(image, BOX.x + BOX.w, BOX.y, 100 - BOX.x - BOX.w, BOX.h, '#fdba74');
    expect(edgeContrastOf(image, BOX)).toBeLessThan(0.02);
  });
});

// A note carries writing; a patch of wall, a window pane or a strip of
// ceiling that scraped past the colour floor is blank.
function written(image: ImageBuffer, x: number, y: number, w: number, h: number) {
  paint(image, x, y, w, h, '#fdba74');
  for (let row = 0; row < 3; row += 1) {
    paint(
      image,
      x + Math.round(w * 0.2),
      y + Math.round(h * (0.3 + row * 0.2)),
      Math.round(w * 0.6),
      2,
      '#1f2937',
    );
  }
}

describe('valueSpreadOf', () => {
  it('is nil on blank paper and clear of it on written paper', () => {
    const image = blank(100, 100, '#b08a60');
    paint(image, BOX.x, BOX.y, BOX.w, BOX.h, '#fdba74');
    expect(valueSpreadOf(image, BOX)).toBeLessThan(0.01);
    written(image, BOX.x, BOX.y, BOX.w, BOX.h);
    expect(valueSpreadOf(image, BOX)).toBeGreaterThan(0.1);
  });
});

describe('dropBlank', () => {
  const wall = () => blank(400, 100, '#b08a60');
  const boxes = [0, 1, 2, 3, 4].map((k) => ({ x: 10 + k * 75, y: 20, w: 60, h: 60 }));

  it('drops a blank box with no edge of its own among written notes', () => {
    const image = wall();
    boxes.slice(0, 4).forEach((b) => written(image, b.x, b.y, b.w, b.h));
    // A window pane: one flat surface running past the box on every side.
    paint(image, 305, 0, 95, 100, '#1e3a8a');
    expect(dropBlank(image, boxes)).toEqual(boxes.slice(0, 4));
  });

  it('keeps a blank note framed by its own edges among written notes', () => {
    const image = wall();
    boxes.slice(0, 4).forEach((b) => written(image, b.x, b.y, b.w, b.h));
    paint(image, boxes[4]!.x, boxes[4]!.y, 60, 60, '#fdba74');
    expect(dropBlank(image, boxes)).toEqual(boxes);
  });

  it('keeps every box when no box on the frame shows writing', () => {
    const image = wall();
    boxes.forEach((b) => paint(image, b.x, b.y, b.w, b.h, '#fdba74'));
    expect(dropBlank(image, boxes)).toEqual(boxes);
  });

  it('keeps a lightly written note among heavily written ones', () => {
    const image = wall();
    boxes.slice(0, 4).forEach((b) => {
      written(image, b.x, b.y, b.w, b.h);
      paint(image, b.x + 12, b.y + 22, 36, 4, '#1f2937');
    });
    // One short word.
    paint(image, boxes[4]!.x, boxes[4]!.y, 60, 60, '#fdba74');
    paint(image, boxes[4]!.x + 20, boxes[4]!.y + 28, 20, 2, '#1f2937');
    expect(dropBlank(image, boxes)).toEqual(boxes);
  });
});

// Cardboard, furniture and a window frame at night are DARK and GRAINED;
// paper is smooth once its writing is set aside, whether it is lit or shaded.
describe('isDarkGrain', () => {
  it('takes dark grained cardboard', () => {
    const image = blank(100, 100, '#b08a60');
    paint(image, BOX.x, BOX.y, BOX.w, BOX.h, '#6b5238');
    grain(image, BOX.x, BOX.y, BOX.w, BOX.h, 30);
    expect(isDarkGrain(image, BOX)).toBe(true);
  });

  it('leaves grained paper that is lit', () => {
    const image = blank(100, 100, '#b08a60');
    paint(image, BOX.x, BOX.y, BOX.w, BOX.h, '#fdba74');
    grain(image, BOX.x, BOX.y, BOX.w, BOX.h, 30);
    expect(isDarkGrain(image, BOX)).toBe(false);
  });

  it('leaves a written note in deep shade', () => {
    const image = blank(100, 100, '#584530');
    paint(image, BOX.x, BOX.y, BOX.w, BOX.h, '#7f5d3a');
    for (let row = 0; row < 4; row += 1) paint(image, 30, 30 + row * 10, 40, 3, '#1f1a14');
    expect(isDarkGrain(image, BOX)).toBe(false);
  });
});
