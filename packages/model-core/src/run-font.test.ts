import { describe, expect, it } from 'vitest';
import { LABEL_FONT_PX, NOTE_FONT_PX, RUN_XS_PX, runFontPx } from './label-font';

describe('runFontPx', () => {
  it('draws each run size on its scale', () => {
    expect(runFontPx('xs')).toBe(RUN_XS_PX);
    expect(runFontPx('sm')).toBe(LABEL_FONT_PX.sm);
    expect(runFontPx('md')).toBe(LABEL_FONT_PX.md);
    expect(runFontPx('lg', true)).toBe(NOTE_FONT_PX.lg);
  });

  it('draws an unknown stored size at md, never NaN', () => {
    // An imported or hand-written run size reached the SVG export as undefined, so the run drew at NaN px.
    expect(runFontPx('xl' as never)).toBe(LABEL_FONT_PX.md);
    expect(runFontPx('constructor' as never, true)).toBe(NOTE_FONT_PX.md);
  });
});
