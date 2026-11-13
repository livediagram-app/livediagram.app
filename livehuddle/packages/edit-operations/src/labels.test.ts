import { describe, expect, it } from 'vitest';
import { labelBoxSize, type Element } from '@livehuddle/document';
import { applyLabel, fitToLabel } from './labels';

const signpost = {
  id: 's',
  type: 'shape',
  shape: 'signpost',
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

describe("applyLabel (EO18): the spec's three examples", () => {
  // Nothing moves into a note: livehuddle shows none (Work Tracker 737).
  it('drops a bracketed aside, with no note', () => {
    expect(applyLabel(signpost, 'Web client (React SPA served from the CDN)')).toEqual({
      label: 'Web client',
      capped: true,
    });
  });

  it('keeps the noun phrase before a clause word', () => {
    expect(applyLabel(signpost, 'Orders service which creates orders  and   tracks them')).toEqual({
      label: 'Orders service',
      capped: true,
    });
    expect(applyLabel(signpost, 'Message queue for async events between our services').label).toBe(
      'Message queue',
    );
  });

  it("keeps a short label, cuts an arrow's, and keeps any other element's whole", () => {
    expect(applyLabel(signpost, 'Sign in')).toEqual({ label: 'Sign in', capped: false });
    const long = 'Payment card validation and settlement reconciliation pipeline stage';
    expect(applyLabel(arrow, long)).toMatchObject({ capped: true });
    expect(applyLabel(sticky, long)).toEqual({ label: long, capped: false });
  });
});

describe('fitToLabel (EO22)', () => {
  const need = (label: string) => labelBoxSize(label, 'signpost');
  const longer = 'Sign in with a passkey or a magic link';

  it('grows a box with room to spare only to what the new label needs', () => {
    // "Login" needs less than the 140 the box has, so the box takes the new label's need.
    expect(need('Login').width).toBeLessThan(140);
    const width = need(longer).width;
    const { el, fit } = fitToLabel(signpost, { ...signpost, label: longer });
    expect(fit.widened).toEqual([140, width]);
    expect(el).toMatchObject({ x: Math.round(-(width - 140) / 2), width });
  });

  it('grows a box smaller than its old label needed by the difference of the needs', () => {
    const narrow = { ...signpost, width: 60, label: 'Login' } as Element;
    const dw = need(longer).width - need('Login').width;
    expect(fitToLabel(narrow, { ...narrow, label: longer }).fit.widened).toEqual([60, 60 + dw]);
    expect(fitToLabel(narrow, { ...narrow, label: 'Logout' }).fit).toEqual({});
  });

  it('grows taller for a label that wraps onto more lines', () => {
    const wraps = 'A label long enough to wrap onto many lines inside its box '.repeat(3).trim();
    const dh = need(wraps).height - need('Login').height;
    expect(dh).toBeGreaterThan(0);
    const { el, fit } = fitToLabel(signpost, { ...signpost, label: wraps });
    expect(fit.taller).toEqual([60, 60 + dh]);
    expect(el).toMatchObject({ y: Math.round(-dh / 2), height: 60 + dh });
  });

  it('never shrinks, and leaves fixed-size, scaled and non-shape elements alone', () => {
    expect(fitToLabel(signpost, { ...signpost, label: 'L' }).fit).toEqual({});
    expect(
      fitToLabel(signpost, { ...signpost, label: longer, fixedSize: true } as Element).fit,
    ).toEqual({});
    expect(
      fitToLabel(signpost, { ...signpost, label: longer, textSize: 'scale' } as Element).fit,
    ).toEqual({});
    expect(fitToLabel(sticky, { ...sticky, label: longer }).fit).toEqual({});
    expect(fitToLabel(arrow, signpost).fit).toEqual({});
  });
});
