import { describe, expect, it } from 'vitest';
import { labelBoxSize, type Element } from '@livediagram/document';
import { applyLabel, fitToLabel } from './labels';

const square = {
  id: 's',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 140,
  height: 60,
  label: 'Login',
} as Element;
const arrow = {
  id: 'a',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 9, y: 9 },
} as Element;
const sticky = { id: 'k', type: 'sticky', x: 0, y: 0, width: 100, height: 100 } as Element;

describe("applyLabel (EO18): the MCP spec's three examples", () => {
  it('drops a bracketed aside into the note', () => {
    expect(applyLabel(square, 'Web client (React SPA served from the CDN)', undefined)).toEqual({
      label: 'Web client',
      note: 'Web client (React SPA served from the CDN)',
      capped: true,
    });
  });

  it('keeps the noun phrase before a clause word, ahead of the note it had', () => {
    expect(
      applyLabel(
        square,
        'Orders service which creates orders  and   tracks them',
        'Owned by the orders team.',
      ),
    ).toEqual({
      label: 'Orders service',
      note: 'Orders service which creates orders and tracks them\n\nOwned by the orders team.',
      capped: true,
    });
    expect(
      applyLabel(square, 'Message queue for async events between our services', undefined).label,
    ).toBe('Message queue');
  });

  it("keeps a short label, cuts an arrow's, and keeps any other element's whole", () => {
    expect(applyLabel(square, 'Sign in', 'n')).toEqual({ label: 'Sign in', capped: false });
    const long = 'Payment card validation and settlement reconciliation pipeline stage';
    expect(applyLabel(arrow, long, undefined)).toMatchObject({ capped: true });
    expect(applyLabel(arrow, long, undefined)).not.toHaveProperty('note');
    expect(applyLabel(sticky, long, undefined)).toEqual({ label: long, capped: false });
  });
});

describe('fitToLabel (EO22)', () => {
  const need = (label: string) => labelBoxSize(label, 'square');
  const longer = 'Sign in with a passkey or a magic link';

  it('grows a box with room to spare only to what the new label needs', () => {
    // "Login" needs less than the 140 the box has, so the box takes the new label's need.
    expect(need('Login').width).toBeLessThan(140);
    const width = need(longer).width;
    const { el, fit } = fitToLabel(square, { ...square, label: longer } as Element);
    expect(fit.widened).toEqual([140, width]);
    expect(el).toMatchObject({ x: Math.round(-(width - 140) / 2), width });
  });

  it('grows a box smaller than its old label needed by the difference of the needs', () => {
    const narrow = { ...square, width: 60, label: 'Login' } as Element;
    const dw = need(longer).width - need('Login').width;
    expect(fitToLabel(narrow, { ...narrow, label: longer } as Element).fit.widened).toEqual([
      60,
      60 + dw,
    ]);
    expect(fitToLabel(narrow, { ...narrow, label: 'Logout' } as Element).fit).toEqual({});
  });

  it('grows taller for a label that wraps onto more lines', () => {
    const wraps = 'A label long enough to wrap onto many lines inside its box '.repeat(3).trim();
    const dh = need(wraps).height - need('Login').height;
    expect(dh).toBeGreaterThan(0);
    const { el, fit } = fitToLabel(square, { ...square, label: wraps } as Element);
    expect(fit.taller).toEqual([60, 60 + dh]);
    expect(el).toMatchObject({ y: Math.round(-dh / 2), height: 60 + dh });
  });

  it('never shrinks, and leaves fixed-size, scaled and non-shape elements alone', () => {
    expect(fitToLabel(square, { ...square, label: 'L' } as Element).fit).toEqual({});
    expect(
      fitToLabel(square, { ...square, label: longer, fixedSize: true } as Element).fit,
    ).toEqual({});
    expect(
      fitToLabel(square, { ...square, label: longer, textSize: 'scale' } as Element).fit,
    ).toEqual({});
    expect(fitToLabel(sticky, { ...sticky, label: longer } as Element).fit).toEqual({});
    expect(fitToLabel(arrow, square).fit).toEqual({});
  });
});
