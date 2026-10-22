import { describe, expect, it } from 'vitest';
import { FONTS, MARKER_FONT_ID, SKETCH_FONT_ID } from '@livepages/document';
import { PLAN_HANDWRITING_EX, planFontStyle } from './plan-font';

describe('planFontStyle', () => {
  it('takes the editor face when the tab has none', () => {
    expect(planFontStyle(undefined)).toEqual({});
  });

  it('lifts the handwriting face so a board stays readable', () => {
    const stack = FONTS.find((f) => f.id === SKETCH_FONT_ID)!.stack;
    expect(planFontStyle(stack)).toEqual({
      fontFamily: stack,
      fontSizeAdjust: `ex-height ${PLAN_HANDWRITING_EX}`,
    });
  });

  // Permanent Marker has no true lowercase: shrunk to the UI face's x-height, its column headings read too small.
  it('draws the marker face at its own size', () => {
    const stack = FONTS.find((f) => f.id === MARKER_FONT_ID)!.stack;
    expect(planFontStyle(stack)).toEqual({ fontFamily: stack });
  });

  it('leaves any other face at its size', () => {
    expect(planFontStyle("'Inter', sans-serif")).toEqual({ fontFamily: "'Inter', sans-serif" });
  });
});
