import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FINISH,
  FINISHES,
  PROFESSIONAL_CORNER_PX,
  PROFESSIONAL_FONT_ID,
  SKETCH_FONT_ID,
  MARKER_FONT_ID,
  MARKER_LINE_PX,
  finishArrowThickness,
  finishArrowWidthPx,
  finishDrawsBodyByHand,
  finishIconWeight,
  isHandDrawn,
  finishBorderStroke,
  finishCornerFallbackPx,
  finishCurvesNewArrows,
  finishDrawsDefaultShadow,
  elementFontId,
  finishFontId,
  finishNewArrowStyle,
  finishSplitsFace,
  supportsFinish,
  finishHatches,
  isFinish,
  resolveFinish,
} from './finish';
import { SHAPE_KINDS } from './validate';
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
    expect(PROFESSIONAL_CORNER_PX).toBe(0);
    expect(finishCornerFallbackPx(1, 'professional')).toBe(0);
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
  it('writes in the handwriting font unless the element or the tab picks one', () => {
    expect(finishFontId(undefined, undefined, 'sketch')).toBe(SKETCH_FONT_ID);
    // A typeface picked on a Sketch tab shows (Workshop's Permanent Marker, a pick in the Text panel).
    expect(finishFontId(undefined, 'inter', 'sketch')).toBe('inter');
    expect(finishFontId('lora', 'inter', 'sketch')).toBe('lora');
    expect(finishFontId(undefined, 'lora', 'professional')).toBe('lora');
    // Professional letters in Inter when neither the element nor the tab picks a font.
    expect(finishFontId(undefined, undefined, 'professional')).toBe(PROFESSIONAL_FONT_ID);
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
    expect(finishHatches(createShape('stadium', 0, 0), '#ffffff')).toBe(true);
    expect(finishHatches(createShape('cloud', 0, 0), '#ffffff')).toBe(true);
  });

  // Every box with a body of its own is shaded (docs/specs/008-canvas/finish.md "Fills"): containers and panels too.
  it('shades containers, cards and panels like any box', () => {
    for (const kind of ['frame', 'lane', 'agenda', 'page', 'card', 'entity'] as const)
      expect(finishHatches(createShape(kind, 0, 0), '#ffffff'), kind).toBe(true);
  });

  it('keeps self-painting kinds, a sequence diagram, see-through fills and non-shapes solid', () => {
    expect(finishHatches(createShape('bar-chart', 0, 0), '#ffffff')).toBe(false);
    expect(finishHatches(createShape('sequence', 0, 0), '#ffffff')).toBe(false);
    expect(finishHatches(createShape('square', 0, 0), 'transparent')).toBe(false);
    expect(finishHatches(createSticky(0, 0), '#fde68a')).toBe(false);
    expect(finishHatches(createText(0, 0), '#ffffff')).toBe(false);
  });
});

describe('supportsFinish', () => {
  it('takes shapes, arrows, text, stickies and tables only', () => {
    for (const type of ['shape', 'arrow', 'text', 'sticky', 'table'])
      expect(supportsFinish({ type }), type).toBe(true);
    for (const type of ['freehand', 'image', 'path', 'annotation', 'link-card'])
      expect(supportsFinish({ type }), type).toBe(false);
  });
});

describe('finishNewArrowStyle', () => {
  it('draws a new arrow right-angled under Professional only', () => {
    expect(finishNewArrowStyle('professional')).toBe('angled');
    expect(finishNewArrowStyle('flexible')).toBeUndefined();
    expect(finishNewArrowStyle('sketch')).toBeUndefined();
  });
});

// docs/specs/008-canvas/finish.md "Where a finish comes from": an element's own finish is more
// specific than the tab's font.
describe("an element's own finish and the tab's font", () => {
  it("letters in the element's own finish over the tab's font, its own font over both", () => {
    expect(elementFontId({ finish: 'sketch' }, 'inter', 'professional')).toBe(SKETCH_FONT_ID);
    expect(elementFontId({ finish: 'professional' }, 'lora', 'flexible')).toBe(
      PROFESSIONAL_FONT_ID,
    );
    expect(elementFontId({ finish: 'sketch', font: 'lora' }, 'inter', 'flexible')).toBe('lora');
  });

  it("keeps the tab's font when the element follows the tab or is Flexible", () => {
    expect(elementFontId({}, 'inter', 'sketch')).toBe('inter');
    expect(elementFontId({ finish: 'flexible' }, 'inter', 'sketch')).toBe('inter');
  });
});

describe('finishSplitsFace (docs/specs/008-canvas/finish.md "Every other face is drawn by hand too")', () => {
  const shape = (kind: string, iconId?: string) => ({ type: 'shape', shape: kind, iconId });

  it('splits every face that draws more than its label', () => {
    for (const kind of [
      'bar-chart',
      'pyramid',
      'sankey',
      'badge',
      'card',
      'desk',
      'plan-board',
      'entity',
    ]) {
      expect(finishSplitsFace(shape(kind)), kind).toBe(true);
    }
    for (const type of ['table', 'link-card', 'video', 'annotation']) {
      expect(finishSplitsFace({ type }), type).toBe(true);
    }
  });

  it('leaves plain boxes, icons, stickers and the sequence diagram to their own drawing', () => {
    for (const kind of ['square', 'circle', 'mind-node', 'frame', 'icon', 'sticker', 'sequence']) {
      expect(finishSplitsFace(shape(kind)), kind).toBe(false);
    }
    for (const type of ['text', 'sticky', 'freehand', 'image', 'path']) {
      expect(finishSplitsFace({ type }), type).toBe(false);
    }
  });

  it('splits a plain box carrying an inline icon, so the icon is drawn by hand', () => {
    expect(finishSplitsFace(shape('square', 'lucide:star'))).toBe(true);
    expect(finishSplitsFace(shape('icon', 'lucide:star'))).toBe(false);
  });

  it('names only real shape kinds as drawn by their body', () => {
    // Every kind not split must exist, so a renamed kind cannot quietly drop out of Sketch.
    const unsplit = [...SHAPE_KINDS].filter((k) => !finishSplitsFace(shape(k)));
    expect(unsplit.length).toBe(26);
  });
});

describe('Marker (docs/specs/008-canvas/finish.md "Marker")', () => {
  it('is a finish, drawn by hand', () => {
    expect(isFinish('marker')).toBe(true);
    expect(FINISHES).toContain('marker');
    expect(isHandDrawn('marker')).toBe(true);
    expect(isHandDrawn('sketch')).toBe(true);
    expect(isHandDrawn('professional')).toBe(false);
    expect(isHandDrawn('flexible')).toBe(false);
  });

  it('redraws every body but a sticky’s, which stays paper', () => {
    expect(finishDrawsBodyByHand('marker', 'shape')).toBe(true);
    expect(finishDrawsBodyByHand('marker', 'table')).toBe(true);
    expect(finishDrawsBodyByHand('marker', 'sticky')).toBe(false);
    expect(finishDrawsBodyByHand('sketch', 'sticky')).toBe(true);
    expect(finishDrawsBodyByHand('flexible', 'shape')).toBe(false);
  });

  it('letters in Permanent Marker, a font picked on the element or the tab winning', () => {
    expect(finishFontId(undefined, undefined, 'marker')).toBe(MARKER_FONT_ID);
    expect(finishFontId('lora', undefined, 'marker')).toBe('lora');
    expect(finishFontId(undefined, 'inter', 'marker')).toBe('inter');
    expect(FONTS.some((f) => f.id === MARKER_FONT_ID && f.kind === 'Marker')).toBe(true);
    // Picked on the element itself, Marker is more specific than the tab's font.
    expect(elementFontId({ finish: 'marker' }, 'inter', 'flexible')).toBe(MARKER_FONT_ID);
  });

  it('draws unset and Thin arrows at a marker’s nib, a wider own width as picked', () => {
    expect(finishArrowWidthPx(undefined, 'marker')).toBe(MARKER_LINE_PX);
    expect(finishArrowWidthPx(1, 'marker')).toBe(MARKER_LINE_PX);
    expect(finishArrowWidthPx(1, 'flexible')).toBe(1);
    expect(finishArrowWidthPx(undefined, 'professional')).toBe(1);
    expect(finishArrowWidthPx(undefined, 'flexible')).toBe(2);
    expect(finishArrowWidthPx(7, 'marker')).toBe(7);
  });

  it('draws a line icon without its own weight Bold', () => {
    expect(finishIconWeight(undefined, 'marker')).toBe('bold');
    expect(finishIconWeight('thin', 'marker')).toBe('thin');
  });

  it('keeps Flexible’s corners and arrows', () => {
    expect(finishCornerFallbackPx(8, 'marker')).toBe(8);
    expect(finishCurvesNewArrows('marker')).toBe(true);
    expect(finishNewArrowStyle('marker')).toBeUndefined();
  });
});
