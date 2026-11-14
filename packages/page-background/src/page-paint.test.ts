import { describe, expect, it } from 'vitest';
import type { PageColourFill, PagePattern } from './index';
import { PAGE_GRADIENT_ANGLE, sameFill as sameFillBy, withBackgroundPatch } from './page-paint';

// Each pages product's pages-mode spec, "Backgrounds".
type Picture = { kind: 'image'; imageId: string };
type Background = { fill?: PageColourFill | Picture; pattern?: PagePattern };
const page = (background?: Background) => (background ? { background } : {});
const sameFill = (
  a: PageColourFill | Picture | undefined,
  b: PageColourFill | Picture | undefined,
) => sameFillBy(a, b, (x, y) => x.imageId === y.imageId);
const solid = { kind: 'solid', color: '#e0f2fe' } as const;
const gradient = {
  kind: 'gradient',
  from: '#000',
  to: '#fff',
  angle: PAGE_GRADIENT_ANGLE,
} as const;

describe('a page background edit', () => {
  it('lays a patch over the background, dropping it once empty', () => {
    expect(withBackgroundPatch(page(), { fill: solid })).toEqual({ fill: solid });
    expect(withBackgroundPatch(page({ fill: solid }), { fill: undefined })).toBeUndefined();
    expect(withBackgroundPatch(page({ fill: solid }), { pattern: 'lines' })).toEqual({
      fill: solid,
      pattern: 'lines',
    });
    expect(withBackgroundPatch(page({ pattern: 'dots' }), undefined)).toEqual({ pattern: 'dots' });
  });

  it('compares fills by value, a colour case aside', () => {
    expect(sameFill(gradient, { ...gradient })).toBe(true);
    expect(sameFill(gradient, { ...gradient, angle: 90 })).toBe(false);
    expect(sameFill(solid, { kind: 'solid', color: '#E0F2FE' })).toBe(true);
    expect(sameFill(solid, gradient)).toBe(false);
    expect(sameFill(undefined, undefined)).toBe(true);
    expect(sameFill(solid, undefined)).toBe(false);
  });

  it("compares two pictures by the product's own check", () => {
    const picture = (imageId: string): Picture => ({ kind: 'image', imageId });
    expect(sameFill(picture('a'), picture('a'))).toBe(true);
    expect(sameFill(picture('a'), picture('b'))).toBe(false);
    expect(sameFill(picture('a'), solid)).toBe(false);
  });
});
