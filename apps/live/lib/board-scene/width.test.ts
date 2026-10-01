import { describe, expect, it } from 'vitest';
import { arrowWidthPx, borderStrokeOf, markerWidthPx } from './width';

// docs/specs/020-import-export/board-scene.md "Widths".
describe('markerWidthPx', () => {
  it.each([
    [0.5, 1],
    [1, 1],
    [1.2, 1],
    [1.3, 1.5],
    [1.5, 1.5],
    [1.9, 1.5],
    [2, 2.5],
    [2.5, 2.5],
    [8, 2.5],
  ])('a %s px ink line takes the %s px marker', (px, preset) => {
    expect(markerWidthPx(px)).toBe(preset);
  });

  it('reads a broken width as Medium', () => {
    expect(markerWidthPx(0)).toBe(1.5);
    expect(markerWidthPx(Number.NaN)).toBe(1.5);
    expect(markerWidthPx(-3)).toBe(1.5);
  });
});

describe('borderStrokeOf', () => {
  it.each([
    [0, 'none'],
    [1, 'thin'],
    [2, 'medium'],
    [3, 'thick'],
    [4, 'thick'],
    [7, 'extra-thick'],
  ] as const)('%s px is %s', (px, preset) => {
    expect(borderStrokeOf(px)).toBe(preset);
  });
});

describe('arrowWidthPx', () => {
  it('stores the nearest preset’s px, no line reading as thin', () => {
    expect(arrowWidthPx(1)).toBe(1);
    expect(arrowWidthPx(2.2)).toBe(2);
    expect(arrowWidthPx(4)).toBe(4);
    expect(arrowWidthPx(0)).toBe(1);
  });
});
