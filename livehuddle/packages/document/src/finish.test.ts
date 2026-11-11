import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FINISH,
  FINISHES,
  PROFESSIONAL_CORNER_PX,
  PROFESSIONAL_FONT_ID,
  SKETCH_FONT_ID,
  MARKER_FONT_ID,
  finishDrawsBodyByHand,
  finishIconWeight,
  isHandDrawn,
  finishBorderStroke,
  finishCornerFallbackPx,
  finishDrawsDefaultShadow,
  elementFontId,
  finishFontId,
  finishSplitsFace,
  supportsFinish,
  finishHatches,
  isFinish,
  resolveFinish,
} from './finish';
import { SHAPE_KINDS } from './validate';
import { createShape } from './shape-factory';
import { FONTS } from '@liveworkspace/model-core/fonts';

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

  it('drops default shadows', () => {
    expect(finishDrawsDefaultShadow('professional')).toBe(false);
    expect(finishDrawsDefaultShadow('flexible')).toBe(true);
    expect(finishDrawsDefaultShadow('sketch')).toBe(true);
  });
});

describe('Sketch lettering', () => {
  it('writes in the handwriting font unless the element or the tab picks one', () => {
    expect(finishFontId(undefined, undefined, 'sketch')).toBe(SKETCH_FONT_ID);
    // A typeface picked on a Sketch tab shows (Workshop's Shantell Sans, a pick in the Text panel).
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
    expect(finishHatches(createShape('focus-button', 0, 0), '#ffffff')).toBe(true);
    expect(finishHatches(createShape('mode-button', 0, 0), '#ffffff')).toBe(true);
  });
});

describe('supportsFinish', () => {
  it('takes shapes, text and stickies only', () => {
    for (const type of ['shape', 'text', 'sticky'])
      expect(supportsFinish({ type }), type).toBe(true);
    for (const type of [
      'arrow',
      'freehand',
      'image',
      'path',
      'annotation',
      'link-card',
      'table',
      'video',
    ])
      expect(supportsFinish({ type }), type).toBe(false);
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
      'mode-button',
      'entity',
    ]) {
      expect(finishSplitsFace(shape(kind)), kind).toBe(true);
    }
    for (const type of ['table', 'link-card', 'video', 'annotation']) {
      expect(finishSplitsFace({ type }), type).toBe(true);
    }
  });

  it('leaves icons and stickers to their own drawing', () => {
    for (const kind of ['icon', 'sticker']) {
      expect(finishSplitsFace(shape(kind)), kind).toBe(false);
    }
    for (const type of ['text', 'sticky', 'freehand', 'image', 'path']) {
      expect(finishSplitsFace({ type }), type).toBe(false);
    }
  });

  it('splits a box carrying an inline icon, so the icon is drawn by hand, and not an icon', () => {
    expect(finishSplitsFace(shape('room', 'lucide:star'))).toBe(true);
    expect(finishSplitsFace(shape('icon', 'lucide:star'))).toBe(false);
  });

  it('names only real shape kinds as drawn by their body', () => {
    // Every kind not split must exist, so a renamed kind cannot quietly drop out of Sketch.
    const unsplit = [...SHAPE_KINDS].filter((k) => !finishSplitsFace(shape(k)));
    expect(unsplit).toEqual(['icon', 'sticker']);
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

  it('letters in Shantell Sans, a font picked on the element or the tab winning', () => {
    expect(finishFontId(undefined, undefined, 'marker')).toBe(MARKER_FONT_ID);
    expect(finishFontId('lora', undefined, 'marker')).toBe('lora');
    expect(finishFontId(undefined, 'inter', 'marker')).toBe('inter');
    expect(FONTS.some((f) => f.id === MARKER_FONT_ID && f.kind === 'Marker')).toBe(true);
    // Picked on the element itself, Marker is more specific than the tab's font.
    expect(elementFontId({ finish: 'marker' }, 'inter', 'flexible')).toBe(MARKER_FONT_ID);
  });

  it('draws a line icon without its own weight Bold', () => {
    expect(finishIconWeight(undefined, 'marker')).toBe('bold');
    expect(finishIconWeight('thin', 'marker')).toBe('thin');
  });

  it('keeps Flexible’s corners', () => {
    expect(finishCornerFallbackPx(8, 'marker')).toBe(8);
  });
});
