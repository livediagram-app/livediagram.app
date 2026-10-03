import { describe, expect, it } from 'vitest';
import type { InfographicPage } from '@livediagram/document';
import {
  fillCss,
  gradientFill,
  PAGE_GRADIENT_PRESETS,
  pageSheetStyle,
  sameFill,
  withBackgroundPatch,
} from './infographic-page-paint';

// docs/specs/007-editor/infographic-pages.md "Backgrounds".
const page = (background?: InfographicPage['background']): InfographicPage => ({
  id: 'p',
  orientation: 'portrait',
  ...(background ? { background } : {}),
});

describe('page paint', () => {
  it('leaves the paper to the sheet, and paints a fill with its pattern over it', () => {
    expect(pageSheetStyle(undefined)).toEqual({});
    const style = pageSheetStyle({ fill: { kind: 'solid', color: '#0f172a' }, pattern: 'dots' });
    expect(style.backgroundColor).toBe('#0f172a');
    expect(style.backgroundImage).toContain('radial-gradient');
    // Light ink on a dark page.
    expect(style.color).toContain('255');
  });

  it('lays the pattern over a gradient', () => {
    const style = pageSheetStyle({
      fill: gradientFill(PAGE_GRADIENT_PRESETS[0]!),
      pattern: 'grid',
    });
    const layers = String(style.backgroundImage);
    expect(layers.indexOf('linear-gradient(160deg')).toBeGreaterThan(layers.indexOf('90deg'));
  });

  it('patches a background, dropping it once empty', () => {
    const solid = { kind: 'solid', color: '#e0f2fe' } as const;
    expect(withBackgroundPatch(page(), { fill: solid })).toEqual({ fill: solid });
    expect(withBackgroundPatch(page({ fill: solid }), { fill: undefined })).toBeUndefined();
    expect(withBackgroundPatch(page({ fill: solid }), { pattern: 'lines' })).toEqual({
      fill: solid,
      pattern: 'lines',
    });
  });

  it('compares fills by value', () => {
    const g = gradientFill(PAGE_GRADIENT_PRESETS[1]!);
    expect(sameFill(g, { ...g })).toBe(true);
    expect(sameFill({ kind: 'solid', color: '#ABCDEF' }, { kind: 'solid', color: '#abcdef' })).toBe(
      true,
    );
    expect(sameFill(undefined, undefined)).toBe(true);
    expect(sameFill(g, undefined)).toBe(false);
    expect(fillCss(g)).toBe('linear-gradient(160deg, #bae6fd, #c7d2fe)');
  });
});
