// Stored cell colours drawn for the surface they sit on, the ink always AA.
import { describe, expect, it } from 'vitest';
import { cellColours, cellFill, readableInk } from './cell-colours';
import { contrastRatio } from './colors';

const LIGHT = { fill: '#f8fafc', ink: '#0f172a', dark: false };
const DARK = { fill: '#111827', ink: '#e2e8f0', dark: true };

describe('cell colours', () => {
  it('tints a pale fill on a dark Sheet, keeps it on a light one', () => {
    expect(cellFill('#ecfdf5', LIGHT)).toBe('#ecfdf5');
    const tinted = cellFill('#ecfdf5', DARK);
    expect(contrastRatio(tinted, DARK.fill)).toBeLessThan(2);
    expect(tinted).not.toBe(DARK.fill);
    // A strong fill stays in either.
    expect(cellFill('#047857', DARK)).toBe('#047857');
  });

  it('draws a dark tint pale on a light Sheet, but keeps a deep accent', () => {
    expect(contrastRatio(cellFill('#212f43', LIGHT), '#ffffff')).toBeLessThan(1.3);
    expect(cellFill('#065f46', LIGHT)).toBe('#065f46');
    expect(cellFill('nope', LIGHT)).toBe('nope');
  });

  it('lifts or deepens an ink until it reads at AA, keeping one that already does', () => {
    expect(readableInk('#0f172a', '#ffffff')).toBe('#0f172a');
    const lifted = readableInk('#047857', '#111827');
    expect(contrastRatio(lifted, '#111827')).toBeGreaterThanOrEqual(4.5);
    const deepened = readableInk('#e2e8f0', '#ecfdf5');
    expect(contrastRatio(deepened, '#ecfdf5')).toBeGreaterThanOrEqual(4.5);
    expect(readableInk('red', '#ffffff')).toBe('red');
  });

  it('resolves a cell: its fill for the surface and an ink readable on it', () => {
    // The reported case: a light band viewed on a dark Sheet with the dark theme's ink.
    const band = cellColours({ bg: '#eef7f1' }, DARK);
    expect(contrastRatio(band.ink, band.fill!)).toBeGreaterThanOrEqual(4.5);
    const plain = cellColours(undefined, DARK);
    expect([plain.fill, plain.ink]).toEqual([undefined, DARK.ink]);
    const muted = cellColours({ fc: '#64748b' }, DARK);
    expect(contrastRatio(muted.ink, DARK.fill)).toBeGreaterThanOrEqual(4.5);
  });
});
