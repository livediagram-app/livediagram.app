import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FINISH,
  FINISHES,
  PROFESSIONAL_CORNER_PX,
  SKETCH_FONT_ID,
  finishArrowThickness,
  finishBorderStroke,
  finishCornerFallbackPx,
  finishCurvesNewArrows,
  finishDrawsDefaultShadow,
  finishFontId,
  finishHatches,
  isFinish,
  resolveFinish,
} from './finish';
import { createSticky, createText } from './factories';
import { createShape } from './shape-factory';
import { FONTS } from './fonts';

// docs/specs/008-canvas/finish.md
describe('resolveFinish', () => {
  it('is the element’s own, else the tab’s, else Flexible', () => {
    expect(resolveFinish('sketch', 'professional')).toBe('sketch');
    expect(resolveFinish(undefined, 'professional')).toBe('professional');
    expect(resolveFinish(undefined, undefined)).toBe(DEFAULT_FINISH);
    expect(DEFAULT_FINISH).toBe('flexible');
  });

  it('an own Flexible overrides a Sketch tab', () => {
    expect(resolveFinish('flexible', 'sketch')).toBe('flexible');
  });

  it('reads a value that is not a finish as absent', () => {
    expect(resolveFinish('glossy', 'sketch')).toBe('sketch');
    expect(resolveFinish(undefined, 42)).toBe('flexible');
    expect(isFinish('glossy')).toBe(false);
    for (const f of FINISHES) expect(isFinish(f)).toBe(true);
  });
});

describe('Professional fallbacks', () => {
  it('sharpens an unset corner, never rounder than the kind’s own', () => {
    expect(finishCornerFallbackPx(8, 'professional')).toBe(PROFESSIONAL_CORNER_PX);
    expect(finishCornerFallbackPx(1, 'professional')).toBe(1);
    expect(finishCornerFallbackPx(8, 'flexible')).toBe(8);
    expect(finishCornerFallbackPx(8, 'sketch')).toBe(8);
  });

  it('thins an unset border, keeps a picked one', () => {
    expect(finishBorderStroke(undefined, 'professional')).toBe('thin');
    expect(finishBorderStroke('thick', 'professional')).toBe('thick');
    expect(finishBorderStroke(undefined, 'flexible')).toBe('medium');
  });

  it('thins an unset arrow, keeps a picked one', () => {
    expect(finishArrowThickness('medium', false, 'professional')).toBe('thin');
    expect(finishArrowThickness('thick', true, 'professional')).toBe('thick');
    expect(finishArrowThickness('medium', false, 'sketch')).toBe('medium');
  });

  it('drops default shadows and draw-time curves', () => {
    expect(finishDrawsDefaultShadow('professional')).toBe(false);
    expect(finishDrawsDefaultShadow('flexible')).toBe(true);
    expect(finishDrawsDefaultShadow('sketch')).toBe(true);
    expect(finishCurvesNewArrows('professional')).toBe(false);
    expect(finishCurvesNewArrows('sketch')).toBe(true);
  });
});

describe('Sketch lettering', () => {
  it('writes in the handwriting font unless the element has its own, whatever the tab’s', () => {
    expect(finishFontId(undefined, 'inter', 'sketch')).toBe(SKETCH_FONT_ID);
    expect(finishFontId('lora', 'inter', 'sketch')).toBe('lora');
    expect(finishFontId(undefined, 'inter', 'professional')).toBe('inter');
    expect(finishFontId(undefined, undefined, 'flexible')).toBeUndefined();
  });

  it('the handwriting font is in the catalogue', () => {
    expect(FONTS.some((f) => f.id === SKETCH_FONT_ID && f.kind === 'Handwriting')).toBe(true);
  });
});

describe('finishHatches', () => {
  it('hatches a filled shape', () => {
    expect(finishHatches(createShape('square', 0, 0), '#ffffff')).toBe(true);
    expect(finishHatches(createShape('diamond', 0, 0), '#ffffff')).toBe(true);
  });

  it('keeps containers, self-painting kinds, see-through fills and non-shapes solid', () => {
    expect(finishHatches(createShape('frame', 0, 0), '#ffffff')).toBe(false);
    expect(finishHatches(createShape('lane', 0, 0), '#ffffff')).toBe(false);
    expect(finishHatches(createShape('bar-chart', 0, 0), '#ffffff')).toBe(false);
    expect(finishHatches(createShape('square', 0, 0), 'transparent')).toBe(false);
    expect(finishHatches(createSticky(0, 0), '#fde68a')).toBe(false);
    expect(finishHatches(createText(0, 0), '#ffffff')).toBe(false);
  });
});
