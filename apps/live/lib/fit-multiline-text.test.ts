import { describe, expect, it } from 'vitest';
import { fitMultilineFontPx, FIT_MAX_PX, FIT_MIN_PX } from './fit-multiline-text';

// Genuine auto-fit for multi-line labels (stickies, spec/139): `scale` should
// mean "fill the note", the way writing on a physical sticky does — a
// two-word event large, a long policy sentence small — rather than the fixed
// 14px it used to mean. Pure: same inputs, same answer, so the display label,
// the inline editor and any export can all ask and agree.
describe('fitMultilineFontPx', () => {
  const box = { width: 200, height: 200, padding: 14 };

  it('gives short text a big size and long text a small one', () => {
    const short = fitMultilineFontPx({ text: 'Order placed', ...box });
    const long = fitMultilineFontPx({
      text: 'Whenever an order is placed and payment has cleared, notify the warehouse to begin picking the items for dispatch',
      ...box,
    });
    expect(short).toBeGreaterThan(long);
  });

  it('never exceeds the ceiling, however short the text', () => {
    expect(fitMultilineFontPx({ text: 'Hi', ...box })).toBeLessThanOrEqual(FIT_MAX_PX);
  });

  it('never goes below the floor, however long the text (it clips instead)', () => {
    const wall = 'word '.repeat(400);
    expect(fitMultilineFontPx({ text: wall, ...box })).toBeGreaterThanOrEqual(FIT_MIN_PX);
  });

  it('gives a bigger note a bigger size for the same text', () => {
    const small = fitMultilineFontPx({ text: 'Payment received', ...box });
    const large = fitMultilineFontPx({
      text: 'Payment received',
      width: 400,
      height: 400,
      padding: 14,
    });
    expect(large).toBeGreaterThan(small);
  });

  it('handles an empty label without blowing up', () => {
    expect(fitMultilineFontPx({ text: '', ...box })).toBeLessThanOrEqual(FIT_MAX_PX);
    expect(fitMultilineFontPx({ text: '', ...box })).toBeGreaterThanOrEqual(FIT_MIN_PX);
  });

  it('is deterministic — the editor and the label must land on the same size', () => {
    const a = fitMultilineFontPx({ text: 'Order shipped to the customer', ...box });
    const b = fitMultilineFontPx({ text: 'Order shipped to the customer', ...box });
    expect(a).toBe(b);
  });
});
