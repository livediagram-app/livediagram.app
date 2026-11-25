// @vitest-environment jsdom
// docs/specs/020-import-export/svg-import.md "One path per SVG element": a `<use>` of a `<symbol>` (an icon
// sprite) draws with the symbol's own style and its viewBox fitted into the use's box.
import { describe, expect, it } from 'vitest';
import { parseInert } from '@liveworkspace/trusted-types';
import { walkSvg, type Drawn } from './walk';

function walk(body: string, attrs = 'viewBox="0 0 48 48"'): Drawn[] {
  const doc = parseInert(
    `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`,
    'image/svg+xml',
  );
  const r = walkSvg(doc.documentElement, 1);
  if (!r.ok) throw new Error(r.reason);
  return r.drawn;
}

const lucide = `<symbol id="i" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" opacity="0.5">
  <path d="M2 2 L22 22"/></symbol>`;

describe('walkSvg: a use of a symbol', () => {
  it("draws the members with the symbol's own fill, stroke and opacity", () => {
    const [line] = walk(`${lucide}<use href="#i" width="48" height="48"/>`);
    expect(line!.fill).toBeNull();
    expect(line!.stroke).toMatchObject({ hex: '#ff0000', alpha: 1 });
    expect(line!.opacity).toBe(0.5);
  });

  it("fits the symbol's viewBox into the use's width and height, centred", () => {
    const [line] = walk(`${lucide}<use href="#i" x="4" width="48" height="24"/>`);
    // 24 by 24 into 48 by 24: scale 1, centred across (12 either side), after the use's x of 4.
    expect(line!.contours[0]!.start).toEqual({ x: 18, y: 2 });
    expect(line!.contours[0]!.segments.at(-1)!.to).toEqual({ x: 38, y: 22 });
    expect(line!.stroke!.width).toBe(2);
  });

  it('fills the whole viewport when the use gives no size', () => {
    const [line] = walk(`${lucide}<use href="#i"/>`);
    expect(line!.contours[0]!.start).toEqual({ x: 4, y: 4 });
    expect(line!.stroke!.width).toBe(4);
  });

  it("lets a member's own paint beat the symbol's, and draws nothing for a hidden symbol", () => {
    const [dot] = walk(
      `<symbol id="s" fill="red"><rect width="2" height="2" fill="blue"/></symbol><use href="#s"/>`,
    );
    expect(dot!.fill).toMatchObject({ hex: '#0000ff' });
    expect(
      walk(`<symbol id="s" display="none"><rect width="2" height="2"/></symbol><use href="#s"/>`),
    ).toHaveLength(0);
  });
});
