import { describe, expect, it } from 'vitest';
import {
  PADDING_PX,
  createShape,
  createSticky,
  createText,
  defaultArrowStrokeColor,
  defaultFillColor,
  defaultPadding,
  defaultStrokeColor,
  defaultTextAlign,
  defaultTextColor,
  type Padding,
} from './index';

// These default-resolution helpers drive the editor's rendering
// fallbacks: every shape, sticky and text element that doesn't
// carry an explicit style field falls through to one of these.
// Untested, silent drift here is hard to notice (a shape gradually
// becomes a different blue, a sticky's amber palette shifts), so
// the assertions pin the exact hex values they return today. When
// a default changes intentionally, the failing test is the
// reminder to update spec/01 (colour scheme) in the same change.

describe('defaultPadding', () => {
  it('shapes get a small inset so labels read inside the stroke', () => {
    expect(defaultPadding(createShape('square', 0, 0))).toBe('sm');
  });

  it('text elements have no padding so the bounding box hugs the glyphs', () => {
    expect(defaultPadding(createText(0, 0))).toBe('none');
  });

  it('stickies get a medium inset for the post-it look', () => {
    expect(defaultPadding(createSticky(0, 0))).toBe('md');
  });
});

describe('PADDING_PX lookup', () => {
  it('maps every Padding preset to a non-negative pixel value', () => {
    const presets: Padding[] = ['none', 'sm', 'md', 'lg'];
    for (const p of presets) {
      expect(typeof PADDING_PX[p]).toBe('number');
      expect(PADDING_PX[p]).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps "none" at exactly 0 so a hugging text element has zero inset', () => {
    expect(PADDING_PX.none).toBe(0);
  });

  it('orders presets monotonically (none < sm < md < lg) so the Layer accordion icons read correctly', () => {
    expect(PADDING_PX.none).toBeLessThan(PADDING_PX.sm);
    expect(PADDING_PX.sm).toBeLessThan(PADDING_PX.md);
    expect(PADDING_PX.md).toBeLessThan(PADDING_PX.lg);
  });
});

describe('defaultTextColor', () => {
  it('shapes get brand-800 so labels sit on the brand-50 fill with high contrast', () => {
    expect(defaultTextColor(createShape('square', 0, 0))).toBe('#075985');
  });

  it('stickies get a deep amber that pairs with the amber-100 fill', () => {
    expect(defaultTextColor(createSticky(0, 0))).toBe('#451a03');
  });

  it('text elements fall to slate-800 on the transparent fill', () => {
    expect(defaultTextColor(createText(0, 0))).toBe('#1e293b');
  });
});

describe('defaultTextAlign', () => {
  it('stickies pin to top-left (handwritten note look)', () => {
    expect(defaultTextAlign(createSticky(0, 0))).toEqual({ x: 'left', y: 'top' });
  });

  it('shapes centre their labels horizontally and vertically', () => {
    expect(defaultTextAlign(createShape('square', 0, 0))).toEqual({ x: 'center', y: 'middle' });
  });

  it('text elements also centre by default (caller can override)', () => {
    expect(defaultTextAlign(createText(0, 0))).toEqual({ x: 'center', y: 'middle' });
  });
});

describe('defaultFillColor', () => {
  it('shapes fill with brand-50', () => {
    expect(defaultFillColor(createShape('square', 0, 0))).toBe('#f0f9ff');
  });

  it('stickies fill with amber-100', () => {
    expect(defaultFillColor(createSticky(0, 0))).toBe('#fef3c7');
  });

  it('text elements have a transparent fill (no shape behind the glyphs)', () => {
    expect(defaultFillColor(createText(0, 0))).toBe('transparent');
  });
});

describe('defaultStrokeColor', () => {
  it('shapes stroke with brand-500', () => {
    expect(defaultStrokeColor(createShape('square', 0, 0))).toBe('#0ea5e9');
  });

  it('stickies stroke with amber-200 (subtle border so the corner peel reads)', () => {
    expect(defaultStrokeColor(createSticky(0, 0))).toBe('#fde68a');
  });

  it('text elements have a transparent stroke (no border around plain text)', () => {
    expect(defaultStrokeColor(createText(0, 0))).toBe('transparent');
  });
});

describe('defaultArrowStrokeColor', () => {
  it('arrows fall back to slate-700, matching the ArrowView fallback', () => {
    expect(defaultArrowStrokeColor()).toBe('rgb(51 65 85)');
  });
});
