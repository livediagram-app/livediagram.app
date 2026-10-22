import { describe, expect, it } from 'vitest';
import { placeHint } from './place-hint';

const viewport = { width: 1000, height: 800 };
const surface = { width: 100, height: 40 };
const rect = (left: number, top: number, width = 40, height = 20) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

describe('placeHint', () => {
  it('prefers the top, centred on the trigger', () => {
    const layout = placeHint({ trigger: rect(480, 400), surface, viewport, gap: 6, margin: 8 });
    expect(layout).toEqual({ placement: 'top', left: 450, top: 354, arrowOffset: 50 });
  });

  it('falls back to the bottom when the top has no room', () => {
    const layout = placeHint({ trigger: rect(480, 10), surface, viewport, gap: 6, margin: 8 });
    expect(layout.placement).toBe('bottom');
    expect(layout.top).toBe(36);
  });

  it('falls back to the right, then the left, when neither top nor bottom fits', () => {
    const tall = { width: 100, height: 790 };
    expect(
      placeHint({ trigger: rect(10, 390), surface: tall, viewport, gap: 6, margin: 8 }).placement,
    ).toBe('right');
    expect(
      placeHint({ trigger: rect(940, 390), surface: tall, viewport, gap: 6, margin: 8 }).placement,
    ).toBe('left');
  });

  it('uses the top when nothing fits', () => {
    const huge = { width: 2000, height: 2000 };
    expect(
      placeHint({ trigger: rect(480, 400), surface: huge, viewport, gap: 6, margin: 8 }).placement,
    ).toBe('top');
  });

  it('clamps into the viewport and keeps the arrow on the trigger centre', () => {
    const layout = placeHint({ trigger: rect(2, 400), surface, viewport, gap: 6, margin: 8 });
    expect(layout.left).toBe(8);
    expect(layout.arrowOffset).toBe(14); // trigger centre 22, minus the clamped left edge 8
  });

  it('centres a side placement vertically and tracks the arrow on y', () => {
    const tall = { width: 100, height: 790 };
    const layout = placeHint({
      trigger: rect(10, 390),
      surface: tall,
      viewport,
      gap: 6,
      margin: 8,
    });
    expect(layout.left).toBe(56);
    expect(layout.top).toBe(8);
    expect(layout.arrowOffset).toBe(392);
  });

  it("tries the caller's order of sides, beside before below", () => {
    const order = ['right', 'left', 'bottom', 'top'] as const;
    const beside = placeHint({
      trigger: rect(400, 300),
      surface,
      viewport,
      gap: 8,
      margin: 8,
      order,
    });
    expect(beside.placement).toBe('right');
    expect(beside.left).toBe(448);
    // No room on the right: the left side.
    const flipped = placeHint({
      trigger: rect(930, 300),
      surface,
      viewport,
      gap: 8,
      margin: 8,
      order,
    });
    expect(flipped.placement).toBe('left');
    expect(flipped.left).toBe(930 - 100 - 8);
  });
});
