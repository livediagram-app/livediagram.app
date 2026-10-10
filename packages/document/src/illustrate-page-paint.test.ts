import { describe, expect, it } from 'vitest';
import type { IllustratePage } from './illustrate-page';
import { PAGE_GRADIENT_ANGLE, sameFill, withBackgroundPatch } from './illustrate-page-paint';

// docs/specs/007-editor/illustrate-pages.md "Backgrounds".
const page = (background?: IllustratePage['background']): IllustratePage => ({
  id: 'p',
  orientation: 'portrait',
  ...(background ? { background } : {}),
});
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
});
