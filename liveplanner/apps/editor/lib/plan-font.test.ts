import { describe, expect, it } from 'vitest';
import { FONTS, MARKER_FONT_ID, SKETCH_FONT_ID } from '@liveplanner/project';
import {
  PLAN_HANDWRITING_EX,
  PLAN_HEADING_STYLE,
  PLAN_TEXT_SCALE_MAX,
  PLAN_TEXT_SCALE_MIN,
  PLAN_UI_FONT,
  planBoardFontStyle,
  planFontStyle,
  planTextPx,
  planTextScale,
} from './plan-font';

const stackOf = (id: string) => FONTS.find((f) => f.id === id)!.stack;
const LIFT = `ex-height ${PLAN_HANDWRITING_EX}`;

describe('planBoardFontStyle', () => {
  it('draws a board in the UI face when the tab has none, handing nothing to its headings', () => {
    expect(planBoardFontStyle(undefined)).toEqual({
      fontFamily: PLAN_UI_FONT,
      fontSizeAdjust: 'none',
    });
  });

  // The small text stays in the UI face whatever the tab picked; only the headings take the tab's.
  it('hands the tab face to the headings only', () => {
    expect(planBoardFontStyle(stackOf('abril-fatface'))).toEqual({
      fontFamily: PLAN_UI_FONT,
      fontSizeAdjust: 'none',
      '--plan-heading-font': stackOf('abril-fatface'),
    });
  });

  it('lifts the handwriting face on headings so a card title stays readable', () => {
    expect(planBoardFontStyle(stackOf(SKETCH_FONT_ID))).toEqual({
      fontFamily: PLAN_UI_FONT,
      fontSizeAdjust: 'none',
      '--plan-heading-font': stackOf(SKETCH_FONT_ID),
      '--plan-heading-adjust': LIFT,
    });
  });

  // A face liveplanner does not offer letters its headings in the UI face too, so an older plan stays readable.
  it('draws an excluded face in the UI face throughout', () => {
    expect(planBoardFontStyle(stackOf(MARKER_FONT_ID))).toEqual({
      fontFamily: PLAN_UI_FONT,
      fontSizeAdjust: 'none',
    });
  });
});

describe('planFontStyle', () => {
  it('takes the editor face when the tab has none', () => {
    expect(planFontStyle(undefined)).toEqual({});
  });

  it('letters a whole surface in the tab face and hands it to the boards in it', () => {
    expect(planFontStyle("'Inter', sans-serif")).toEqual({
      fontFamily: "'Inter', sans-serif",
      '--plan-heading-font': "'Inter', sans-serif",
    });
  });

  it('lifts the handwriting face', () => {
    const stack = stackOf(SKETCH_FONT_ID);
    expect(planFontStyle(stack)).toEqual({
      fontFamily: stack,
      fontSizeAdjust: LIFT,
      '--plan-heading-font': stack,
      '--plan-heading-adjust': LIFT,
    });
  });

  it('takes the editor face for a face liveplanner does not draw', () => {
    expect(planFontStyle(stackOf(MARKER_FONT_ID))).toEqual({});
  });
});

describe('PLAN_HEADING_STYLE', () => {
  // A one-weight face (Abril Fatface) drawn at a heading's semibold would otherwise be thickened into a fake bold.
  it('reads the face its root hands down, never synthesising a bold', () => {
    expect(PLAN_HEADING_STYLE).toEqual({
      fontFamily: 'var(--plan-heading-font)',
      fontSizeAdjust: 'var(--plan-heading-adjust)',
      fontSynthesisWeight: 'none',
    });
  });
});

// docs/specs/004-interface-design/fonts.md "Text size on boards and cards".
describe('planTextScale', () => {
  it('leaves a board as drawn at Small, at Scale and with no size set', () => {
    expect(planTextScale('sm')).toBe(1);
    expect(planTextScale('scale')).toBe(1);
    expect(planTextScale(undefined)).toBe(1);
  });

  it('steps up for Medium and Large, by the square root of their ratio to Small', () => {
    expect(planTextScale('md')).toBe(1.25);
    expect(planTextScale('lg')).toBe(1.5);
  });

  it('scales an exact px against Small, rounded to a hundredth', () => {
    expect(planTextScale(14)).toBe(1);
    expect(planTextScale(20)).toBe(1.2);
    expect(planTextScale(12)).toBe(0.93);
  });

  it('keeps a card readable at the slider ends', () => {
    expect(planTextScale(6)).toBe(PLAN_TEXT_SCALE_MIN);
    expect(planTextScale(9)).toBe(PLAN_TEXT_SCALE_MIN);
    expect(planTextScale(48)).toBe(PLAN_TEXT_SCALE_MAX);
  });

  it('never scales by a size that is not a number', () => {
    expect(planTextScale(Number.NaN)).toBe(1);
    expect(planTextScale(0)).toBe(1);
  });

  it('grows with the size across the slider', () => {
    let last = 0;
    for (let px = 6; px <= 48; px++) {
      const scale = planTextScale(px);
      expect(scale).toBeGreaterThanOrEqual(last);
      last = scale;
    }
  });
});

describe('planBoardFontStyle text scale', () => {
  it('hands a scale other than 1 down as --plan-text-scale', () => {
    expect(planBoardFontStyle(undefined, 1.2)).toEqual({
      fontFamily: PLAN_UI_FONT,
      fontSizeAdjust: 'none',
      '--plan-text-scale': '1.2',
    });
  });

  it('sets nothing new at 1', () => {
    expect(planBoardFontStyle(undefined, 1)).not.toHaveProperty('--plan-text-scale');
  });

  it('sizes a face text by the scale, 1 where none is set', () => {
    expect(planTextPx(13)).toBe('calc(13px * var(--plan-text-scale, 1))');
  });
});
