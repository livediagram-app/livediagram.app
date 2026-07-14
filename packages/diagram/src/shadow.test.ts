import { describe, expect, it } from 'vitest';
import {
  clampShadow,
  DEFAULT_SHADOW,
  SHADOW_LIMITS,
  SHADOW_PRESETS,
  shadowBoxCss,
  shadowFilterCss,
  shadowFilterId,
  supportsShadow,
  svgShadowFilterDef,
  type ElementShadow,
} from './shadow';

// The shadow model (spec/86) feeds three surfaces from one module: the
// canvas wrapper style (box-shadow / drop-shadow strings), the headless
// SVG export (feDropShadow defs keyed by deterministic ids), and the
// Shadow menu section (presets + slider limits). These tests pin the
// cross-surface contracts: presets are in-range, the css builders clamp
// hostile values, and the def id stays a valid XML name so an exported
// SVG parses.

describe('SHADOW_PRESETS', () => {
  it('every preset is already within the slider limits (a preset outside the sliders could not be re-created or fine-tuned)', () => {
    for (const p of SHADOW_PRESETS) {
      expect(clampShadow(p.shadow), p.id).toEqual(p.shadow);
    }
  });

  it('has unique ids and non-empty labels (they render as tiles)', () => {
    const ids = SHADOW_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of SHADOW_PRESETS) expect(p.label.length).toBeGreaterThan(0);
  });

  it('DEFAULT_SHADOW is a visible shadow (a slider drag on a shadow-less element seeds from it, spec/86)', () => {
    expect(DEFAULT_SHADOW.opacity).toBeGreaterThan(0);
    expect(
      DEFAULT_SHADOW.blur + Math.abs(DEFAULT_SHADOW.offsetX) + DEFAULT_SHADOW.offsetY,
    ).toBeGreaterThan(0);
  });
});

describe('clampShadow', () => {
  it('clamps every axis to the documented limits (imported / hand-edited payloads render sanely)', () => {
    const wild: ElementShadow = { offsetX: 999, offsetY: -999, blur: 999, opacity: 7 };
    expect(clampShadow(wild)).toEqual({
      offsetX: SHADOW_LIMITS.offset,
      offsetY: -SHADOW_LIMITS.offset,
      blur: SHADOW_LIMITS.blur,
      opacity: 1,
    });
  });

  it('passes in-range values through (rounded to whole px)', () => {
    expect(clampShadow({ offsetX: -3.4, offsetY: 4, blur: 12.6, opacity: 0.25 })).toEqual({
      offsetX: -3,
      offsetY: 4,
      blur: 13,
      opacity: 0.25,
    });
  });
});

describe('css builders', () => {
  const s: ElementShadow = { offsetX: 6, offsetY: -4, blur: 12, opacity: 0.25 };

  it('shadowBoxCss emits a box-shadow value with the fixed ink', () => {
    expect(shadowBoxCss(s)).toBe('6px -4px 12px rgba(15, 23, 42, 0.25)');
  });

  it('shadowFilterCss emits the drop-shadow() twin of the same values', () => {
    expect(shadowFilterCss(s)).toBe('drop-shadow(6px -4px 12px rgba(15, 23, 42, 0.25))');
  });

  it('both clamp hostile values instead of emitting them', () => {
    const wild: ElementShadow = { offsetX: 999, offsetY: 0, blur: 0, opacity: 2 };
    expect(shadowBoxCss(wild)).toBe(`${SHADOW_LIMITS.offset}px 0px 0px rgba(15, 23, 42, 1)`);
  });
});

describe('shadowFilterId + svgShadowFilterDef', () => {
  it('produces the same id for equal shadows (elements sharing a shadow share one def)', () => {
    const a: ElementShadow = { offsetX: 0, offsetY: 4, blur: 12, opacity: 0.25 };
    const b: ElementShadow = { ...a };
    expect(shadowFilterId(a)).toBe(shadowFilterId(b));
  });

  it('encodes negative offsets as a valid XML id (no minus sign, which url(#…) refs and strict parsers reject as a name start)', () => {
    const id = shadowFilterId({ offsetX: -6, offsetY: -2, blur: 4, opacity: 0.3 });
    expect(id).toBe('elshadow-n6-n2-4-30');
    expect(id).toMatch(/^[A-Za-z][A-Za-z0-9_-]*$/);
  });

  it('def markup references its own id and carries the blur/2 stdDeviation (CSS ≈ 2σ parity, spec/86)', () => {
    const s: ElementShadow = { offsetX: 0, offsetY: 4, blur: 12, opacity: 0.25 };
    const def = svgShadowFilterDef(s);
    expect(def).toContain(`id="${shadowFilterId(s)}"`);
    expect(def).toContain('stdDeviation="6"');
    expect(def).toContain('flood-opacity="0.25"');
    expect(def).toContain('<feDropShadow');
  });
});

describe('supportsShadow', () => {
  it('accepts the body-drawing boxed types and rejects the rest (spec/86)', () => {
    for (const type of ['shape', 'sticky', 'image', 'link-card'] as const) {
      expect(supportsShadow({ type }), type).toBe(true);
    }
    for (const type of ['text', 'freehand', 'annotation', 'table', 'arrow'] as const) {
      expect(supportsShadow({ type }), type).toBe(false);
    }
  });
});
