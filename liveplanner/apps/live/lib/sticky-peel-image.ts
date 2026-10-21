// The sticky note's paper peel as a picture (docs/specs/008-canvas/canvas-and-palette.md "Sticky notes
// read as paper"; docs/specs/008-canvas/canvas-performance.md "A pan or zoom repaints no filter").
//
// The peel is a caster behind the note whose fill is a long vertical ramp, under one small blur. Drawn
// as a live `filter: blur()`, Safari re-ran the blur for every sticky on screen on every frame of a
// pan or zoom, about 180 ms a frame with fifty stickies in view. The same shadow is computed here once
// instead: the caster is a ramp in y times a box in x, and a Gaussian blur of a product of the two is
// the product of their blurs, so the picture is exact. globals.css hangs it behind the note as a
// stretched border-image, which every browser paints as plain bitmap slices.
//
// The picture is three columns (the left band, one interior column, the right band) over two row
// blocks (the sides, stretched to the note's height, then the band under the note, at its own size).

import { useSyncExternalStore } from 'react';
import { debugLog } from './debug-log';
import { encodePngRgba } from './png-encode';

export type PeelVariant = {
  // How far the caster runs proud of the note's sides and below its bottom (CSS px).
  side: number;
  below: number;
  // The ink and its strength at the foot of the ramp.
  ink: readonly [number, number, number];
  peak: number;
};

// The hand-tuned recipe (the bake-off winners): slate 32% on light paper, black 66% and a longer
// throw on a dark canvas.
export const PEEL_LIGHT: PeelVariant = { side: 3, below: 5, ink: [15, 23, 42], peak: 0x52 / 255 };
export const PEEL_DARK: PeelVariant = { side: 4, below: 7, ink: [0, 0, 0], peak: 0xa8 / 255 };

// The blur's standard deviation (CSS px): the recipe's `blur(2px)`.
export const PEEL_BLUR = 2;
// The ramp: no ink above this share of the caster's height, full ink from this one.
export const PEEL_RAMP_FROM = 0.1;
export const PEEL_RAMP_TO = 0.77;
// How far past an edge the blur still shows (three deviations), and how far inside the note's edge
// the band runs before the sheet covers it.
export const PEEL_MARGIN = 3 * PEEL_BLUR;
export const PEEL_INSIDE = 3;
// The note the picture is made at: a default sticky (factories.ts createSticky). Other heights
// stretch the side rows, which keeps the ramp in proportion as the recipe's percentages do.
export const PEEL_REFERENCE_HEIGHT = 200;
// Picture pixels per CSS px, so the shadow stays smooth when zoomed in; and the side rows, which
// stretch.
export const PEEL_SCALE = 4;
export const PEEL_SIDE_ROWS = 64;

export type PeelImage = {
  width: number;
  height: number;
  // Unpremultiplied RGBA, as ImageData takes it.
  data: Uint8ClampedArray;
  // The border-image geometry: slice sizes in picture pixels, band sizes in CSS px.
  sliceSide: number;
  sliceBottom: number;
  band: number;
  bandBottom: number;
};

// The standard normal CDF (Abramowitz and Stegun 7.1.26, error under 1.5e-7).
function phi(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const poly =
    t *
    (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

// The blurred side: how much of the caster's box reaches x (CSS px from the note's left edge).
function across(v: PeelVariant, x: number): number {
  return phi((x + v.side) / PEEL_BLUR);
}

// The blurred ramp at y (CSS px from the note's top), for a caster `height` tall.
function down(v: PeelVariant, y: number, height: number): number {
  const fill = (t: number) =>
    t < 0 || t > height
      ? 0
      : v.peak *
        Math.min(1, Math.max(0, (t / height - PEEL_RAMP_FROM) / (PEEL_RAMP_TO - PEEL_RAMP_FROM)));
  // A Gaussian-weighted sum over ±4 deviations, in steps of a tenth of a pixel.
  const step = 0.1;
  let sum = 0;
  let weights = 0;
  for (let d = -4 * PEEL_BLUR; d <= 4 * PEEL_BLUR; d += step) {
    const w = Math.exp(-(d * d) / (2 * PEEL_BLUR * PEEL_BLUR));
    sum += fill(y - d) * w;
    weights += w;
  }
  return sum / weights;
}

export function stickyPeelImage(v: PeelVariant): PeelImage {
  // Each band runs from just inside the note's edge, where the sheet covers it, to where the blur
  // fades out past the caster's.
  const band = v.side + PEEL_MARGIN + PEEL_INSIDE;
  const bandBottom = v.below + PEEL_MARGIN + PEEL_INSIDE;
  const casterHeight = PEEL_REFERENCE_HEIGHT + v.below;
  // The side rows run from the note's top to where the bottom band starts.
  const sideSpan = PEEL_REFERENCE_HEIGHT - PEEL_INSIDE;
  const sideCols = band * PEEL_SCALE;
  const width = 2 * sideCols + PEEL_SCALE;
  const bottomRows = bandBottom * PEEL_SCALE;
  const height = PEEL_SIDE_ROWS + bottomRows;
  const data = new Uint8ClampedArray(width * height * 4);
  const xAt = (col: number): number => {
    // Left band, then the interior column (full width of the caster), then the right band mirrored.
    if (col < sideCols) return -(v.side + PEEL_MARGIN) + (col + 0.5) / PEEL_SCALE;
    if (col >= sideCols + PEEL_SCALE) return xAt(width - 1 - col);
    return Infinity;
  };
  const yAt = (row: number): number =>
    row < PEEL_SIDE_ROWS
      ? ((row + 0.5) / PEEL_SIDE_ROWS) * sideSpan
      : sideSpan + (row - PEEL_SIDE_ROWS + 0.5) / PEEL_SCALE;
  const columns = Array.from({ length: width }, (_, c) => {
    const x = xAt(c);
    return x === Infinity ? 1 : across(v, x);
  });
  for (let row = 0; row < height; row++) {
    const a = down(v, yAt(row), casterHeight);
    for (let col = 0; col < width; col++) {
      const i = (row * width + col) * 4;
      data[i] = v.ink[0];
      data[i + 1] = v.ink[1];
      data[i + 2] = v.ink[2];
      data[i + 3] = Math.round(a * columns[col]! * 255);
    }
  }
  return { width, height, data, sliceSide: sideCols, sliceBottom: bottomRows, band, bandBottom };
}

// The border-image that draws a variant's picture: its slices (picture pixels) and band widths (CSS px),
// with no top band (the ramp is clear there) and no fill (the sheet covers the middle).
export function peelBorderImage(img: PeelImage, url: string): string {
  return `url("${url}") 0 ${img.sliceSide} ${img.sliceBottom} ${img.sliceSide} / 0 ${img.band}px ${img.bandBottom}px ${img.band}px stretch`;
}

// Where the caster's box sits around the note (the CSS inset): flush with the top, out to where the
// blur fades past the sides and the bottom.
export function peelInset(v: PeelVariant): string {
  return `0 -${v.side + PEEL_MARGIN}px -${v.below + PEEL_MARGIN}px`;
}

const NONE: Readonly<Record<string, string>> = Object.freeze({});
let vars: Readonly<Record<string, string>> | null = null;

/**
 * The custom properties globals.css draws the peel from, for the canvas root's style: each variant's
 * border-image and inset. The pictures are made once per page and held as blob URLs, short enough
 * that every sticky resolving the property costs nothing (a data URL would be re-read per note on
 * each style pass). Empty off the browser (a prerender, a test's DOM without blob URLs): the notes
 * then show no peel.
 */
export function stickyPeelVars(): Readonly<Record<string, string>> {
  if (vars) return vars;
  if (typeof window === 'undefined' || typeof URL.createObjectURL !== 'function') return NONE;
  const out: Record<string, string> = {};
  for (const [name, v] of [
    ['--lvd-sticky-peel', PEEL_LIGHT],
    ['--lvd-sticky-peel-dark', PEEL_DARK],
  ] as const) {
    const img = stickyPeelImage(v);
    const png = encodePngRgba(img.width, img.height, img.data);
    const url = URL.createObjectURL(new Blob([png], { type: 'image/png' }));
    out[name] = peelBorderImage(img, url);
    out[`${name}-inset`] = peelInset(v);
  }
  debugLog('[sticky-peel] pictures made', { light: out['--lvd-sticky-peel-inset'] });
  vars = out;
  return vars;
}

const noChange = () => () => {};
const serverVars = () => NONE;

/** stickyPeelVars for a render: none while hydrating a prerendered page, so its markup matches. */
export function useStickyPeelVars(): Readonly<Record<string, string>> {
  return useSyncExternalStore(noChange, stickyPeelVars, serverVars);
}
