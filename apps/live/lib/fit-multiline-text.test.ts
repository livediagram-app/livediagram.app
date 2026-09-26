import { afterEach, describe, expect, it, vi } from 'vitest';
import { labelMeasure, wrapLabel } from '@livediagram/diagram';
import { fitMultilineFontPx, FIT_MAX_PX, FIT_MIN_PX } from './fit-multiline-text';

// Genuine auto-fit for multi-line labels (stickies, docs/specs/021-event-storming/event-storming.md): `scale` should
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

// Workshop notes render in capitals (docs/specs/021-event-storming/event-storming.md), and capitals are WIDER. The
// fitter therefore has to measure the caps, not the typed mixed case — a
// size fitted against "Order placed" overflows the moment it paints as
// "ORDER PLACED".
describe('fitMultilineFontPx — uppercase', () => {
  const note = { width: 200, height: 200, padding: 12 };

  it('measures the capitals it will actually paint', () => {
    const asTyped = fitMultilineFontPx({ text: 'Order placed by customer', ...note });
    const asCaps = fitMultilineFontPx({
      text: 'Order placed by customer',
      ...note,
      uppercase: true,
    });
    const preShouted = fitMultilineFontPx({ text: 'ORDER PLACED BY CUSTOMER', ...note });
    expect(asCaps).toBe(preShouted);
    expect(asCaps).toBeLessThanOrEqual(asTyped);
  });

  it('leaves the fit alone when the flag is off', () => {
    const text = 'Order placed by customer';
    expect(fitMultilineFontPx({ text, ...note, uppercase: false })).toBe(
      fitMultilineFontPx({ text, ...note }),
    );
  });
});

// The note is painted in a face of its own (a workshop note wears the marker,
// docs/specs/021-event-storming/event-storming.md), and faces have different widths at the same px. The fitter
// therefore measures IN THAT FACE — measuring system-ui and painting a marker
// is how a note ends up with its last word over the edge.
describe('fitMultilineFontPx — font family', () => {
  const note = { width: 200, height: 200, padding: 12 };

  // A stand-in browser whose measurer is font-aware: the marker face is
  // half again as wide as the default at the same px, which is the whole
  // reason the family has to reach the measurement.
  function stubFontAwareCanvas() {
    const ctx = {
      font: '',
      measureText(s: string) {
        const px = Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? 16);
        const wide = /Marker/.test(ctx.font);
        return { width: s.length * px * (wide ? 0.8 : 0.55) };
      },
    };
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ctx }) });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('shrinks a note whose face is wider than the default', async () => {
    stubFontAwareCanvas();
    vi.resetModules();
    const { fitMultilineFontPx: fit } = await import('./fit-multiline-text');
    const plain = fit({ text: 'Payment received', ...note });
    const marker = fit({
      text: 'Payment received',
      ...note,
      fontFamily: "'Permanent Marker', cursive",
    });
    expect(marker).toBeLessThan(plain);
  });
});

// A sticky is paper, and nobody writes one word per line on paper. The fit
// therefore has a second constraint beyond "does it fit": at a size where
// every word lands on its own line, the note reads as a column of fragments
// rather than a phrase, so the text is stepped down until at least one pair
// of words shares a line.
describe('fitMultilineFontPx — two words must share a line', () => {
  const note = { width: 200, height: 200, padding: 12 };

  it('keeps two short words on one line rather than stacking them', () => {
    const px = fitMultilineFontPx({ text: 'Cart Emptied', ...note });
    const lines = wrapLabel(
      'Cart Emptied',
      note.width - note.padding * 2,
      labelMeasure(px, false, false),
    );
    expect(lines).toHaveLength(1);
  });

  it('lets a longer phrase wrap, but never one word per line', () => {
    const text = 'Order Placed By Customer';
    const px = fitMultilineFontPx({ text, ...note });
    const lines = wrapLabel(text, note.width - note.padding * 2, labelMeasure(px, false, false));
    expect(lines.length).toBeLessThan(text.split(/\s+/).length);
  });

  it('still fits the box (the pair rule only ever shrinks)', () => {
    const text = 'Payment Authorisation Requested';
    const px = fitMultilineFontPx({ text, ...note });
    const lines = wrapLabel(text, note.width - note.padding * 2, labelMeasure(px, false, false));
    expect(lines.length * px * 1.5).toBeLessThanOrEqual(note.height - note.padding * 2);
  });

  it('gives up gracefully when two words can never share a line', () => {
    // Both words are near the note's width on their own: forcing a pair
    // would shrink to illegibility, so the plain fit wins.
    const text = 'Internationalisation Responsibilities';
    const px = fitMultilineFontPx({ text, ...note });
    expect(px).toBeGreaterThanOrEqual(10);
  });

  it('leaves a single word alone — there is no pair to make', () => {
    const one = fitMultilineFontPx({ text: 'Shipped', ...note });
    expect(one).toBeGreaterThan(20);
  });
});

// The ceiling is 25px. A short label on a big note used to balloon to 44px,
// which reads as a poster rather than a sticky: on a real wall the pen width
// is fixed, so "Cart Emptied" and a two-line policy are written at roughly
// the same size and the board stays legible as one surface. The floor still
// lets a long note shrink; only the top end is pinned.
describe('fitMultilineFontPx — the 25px ceiling', () => {
  it('never exceeds it, however much room there is', () => {
    expect(FIT_MAX_PX).toBe(25);
    const roomy = { width: 600, height: 600, padding: 12 };
    expect(fitMultilineFontPx({ text: 'Hi', ...roomy })).toBe(25);
    expect(fitMultilineFontPx({ text: '', ...roomy })).toBe(25);
  });

  it('caps a short label on an ordinary note too', () => {
    const note = { width: 200, height: 200, padding: 12 };
    expect(fitMultilineFontPx({ text: 'Paid', ...note })).toBeLessThanOrEqual(25);
  });

  it('still shrinks what does not fit', () => {
    const note = { width: 200, height: 200, padding: 12 };
    const long = 'Payment authorisation requested from the external provider and acknowledged';
    expect(fitMultilineFontPx({ text: long, ...note })).toBeLessThan(25);
  });
});
