import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PEEL_BLUR,
  PEEL_DARK,
  PEEL_INSIDE,
  PEEL_LIGHT,
  PEEL_MARGIN,
  PEEL_SCALE,
  PEEL_SIDE_ROWS,
  peelBorderImage,
  peelInset,
  stickyPeelImage,
  stickyPeelVars,
} from '@liveworkspace/workbench/lib/sticky-peel-image';

// docs/specs/008-canvas/canvas-and-palette.md "Sticky notes read as paper": the peel is a slate ramp
// (none above 10% of the caster, full ink from 77%) blurred by 2px, run 3px proud of the sides and 5px
// below; drawn as a picture (docs/specs/008-canvas/canvas-performance.md "A pan or zoom repaints no
// filter").

const alphaAt = (img: ReturnType<typeof stickyPeelImage>, col: number, row: number) =>
  img.data[(row * img.width + col) * 4 + 3]! / 255;

describe('stickyPeelImage', () => {
  const img = stickyPeelImage(PEEL_LIGHT);
  const mid = img.sliceSide + PEEL_SCALE / 2;
  const lastRow = img.height - 1;

  it('is the left band, one interior column and the right band, over the side rows and the bottom band', () => {
    expect(img.band).toBe(PEEL_LIGHT.side + PEEL_MARGIN + PEEL_INSIDE);
    expect(img.bandBottom).toBe(PEEL_LIGHT.below + PEEL_MARGIN + PEEL_INSIDE);
    expect(img.width).toBe(2 * img.band * PEEL_SCALE + PEEL_SCALE);
    expect(img.height).toBe(PEEL_SIDE_ROWS + img.bandBottom * PEEL_SCALE);
    expect(img.sliceSide).toBe(img.band * PEEL_SCALE);
    expect(img.sliceBottom).toBe(img.bandBottom * PEEL_SCALE);
  });

  it('is clear at the top, where the note is glued', () => {
    for (let col = 0; col < img.width; col++) expect(alphaAt(img, col, 0)).toBe(0);
  });

  it('deepens continuously down the side, never stepping back', () => {
    const edge = img.sliceSide - PEEL_INSIDE * PEEL_SCALE - 1; // just outside the note's edge
    let last = 0;
    for (let row = 0; row < PEEL_SIDE_ROWS; row++) {
      const a = alphaAt(img, edge, row);
      expect(a).toBeGreaterThanOrEqual(last);
      last = a;
    }
    expect(last).toBeGreaterThan(0.1);
  });

  it('reaches full ink under the note, and fades to nothing past the throw', () => {
    // Inside the caster, above its bottom edge: the ramp's full ink (slate at 0x52).
    const underNote = PEEL_SIDE_ROWS + PEEL_INSIDE * PEEL_SCALE;
    expect(alphaAt(img, mid, underNote)).toBeCloseTo(PEEL_LIGHT.peak, 1);
    // Three deviations past the caster's bottom edge: next to nothing.
    expect(alphaAt(img, mid, lastRow)).toBeLessThan(0.01);
    // Past the side's throw, likewise.
    expect(alphaAt(img, 0, PEEL_SIDE_ROWS - 1)).toBeLessThan(0.01);
  });

  it('has the blur on the caster edge: half the ink where the caster ends', () => {
    // The caster ends `side` px outside the note: the left band's column there.
    const col = PEEL_MARGIN * PEEL_SCALE;
    const row = PEEL_SIDE_ROWS + PEEL_INSIDE * PEEL_SCALE;
    expect(alphaAt(img, col, row) / alphaAt(img, mid, row)).toBeCloseTo(0.5, 1);
    expect(PEEL_BLUR).toBe(2);
  });

  it('is the same on both sides', () => {
    for (const row of [10, PEEL_SIDE_ROWS - 1, lastRow - 8]) {
      for (let col = 0; col < img.sliceSide; col++) {
        expect(alphaAt(img, col, row)).toBe(alphaAt(img, img.width - 1 - col, row));
      }
    }
  });

  it('inks in slate on light paper and in black, stronger, on a dark canvas', () => {
    expect([...img.data.subarray(0, 3)]).toEqual([15, 23, 42]);
    const dark = stickyPeelImage(PEEL_DARK);
    expect([...dark.data.subarray(0, 3)]).toEqual([0, 0, 0]);
    const darkMid = dark.sliceSide + PEEL_SCALE / 2;
    const row = PEEL_SIDE_ROWS + PEEL_INSIDE * PEEL_SCALE;
    expect(alphaAt(dark, darkMid, row)).toBeGreaterThan(alphaAt(img, mid, row));
  });
});

describe('the peel in CSS', () => {
  it('slices the picture into its bands, with no top band and no fill', () => {
    const img = stickyPeelImage(PEEL_LIGHT);
    expect(peelBorderImage(img, 'blob:x')).toBe(
      'url("blob:x") 0 48 56 48 / 0 12px 14px 12px stretch',
    );
  });

  it('hangs the caster flush with the top, out to where the blur fades', () => {
    expect(peelInset(PEEL_LIGHT)).toBe('0 -9px -11px');
    expect(peelInset(PEEL_DARK)).toBe('0 -10px -13px');
  });

  // The caster runs 9px past a note's sides, more than the gap between notes on an event storming row: as
  // a hit target it swallowed a drop between two notes (e2e smoke "a note dropped between two notes").
  it('takes no pointer, so a click or a drop beside a note reaches the board', () => {
    const css = readFileSync(fileURLToPath(new URL('../app/globals.css', import.meta.url)), 'utf8');
    const rule = /\.lvd-sticky-peel::before \{([^}]*)\}/.exec(css);
    if (!rule) throw new Error('the peel caster rule is missing from globals.css');
    expect(rule[1]).toContain('pointer-events: none');
  });

  it('sets nothing off the browser', () => {
    expect(stickyPeelVars()).toEqual({});
  });
});
