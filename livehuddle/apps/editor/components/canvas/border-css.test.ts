import type { BorderStyle } from '@livediagram/document';
import { describe, expect, it } from 'vitest';
import { isCssNativeBorderStyle, nearestCssBorderStyle } from './border-css';

// Exhaustive over every BorderStyle: CSS `border-style` renders only
// solid/dashed/dotted, so the composite patterns must report non-native
// and degrade to their nearest plain keyword (table cell borders).
const CASES: { style: BorderStyle; native: boolean; nearest: 'solid' | 'dashed' | 'dotted' }[] = [
  { style: 'solid', native: true, nearest: 'solid' },
  { style: 'dashed', native: true, nearest: 'dashed' },
  { style: 'dotted', native: true, nearest: 'dotted' },
  { style: 'long-dash', native: false, nearest: 'dashed' },
  { style: 'dash-dot', native: false, nearest: 'dashed' },
  { style: 'dash-dot-dot', native: false, nearest: 'dotted' },
];

describe('border-css', () => {
  it.each(CASES)('$style: native=$native, nearest=$nearest', ({ style, native, nearest }) => {
    expect(isCssNativeBorderStyle(style)).toBe(native);
    expect(nearestCssBorderStyle(style)).toBe(nearest);
  });

  it('a nearest mapping is itself a CSS-native style', () => {
    for (const { style } of CASES) {
      expect(isCssNativeBorderStyle(nearestCssBorderStyle(style))).toBe(true);
    }
  });
});
