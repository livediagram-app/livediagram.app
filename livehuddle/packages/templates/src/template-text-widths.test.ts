import { describe, expect, it } from 'vitest';
import { fitTextWidth, textWordsWidth, type Element } from '@livehuddle/document';
import { buildTemplate } from './build-template';
import { TEMPLATES } from './templates';

// A template's titles, captions and hints are as wide as their words (docs/specs/008-canvas/canvas-and-palette.md
// "Text sized to its words"): Zoom to Fit, the minimap and the selection outline frame the content, not empty width.
// Text that wraps is no wider than the content it heads.
const isText = (el: Element): el is Extract<Element, { type: 'text' }> => el.type === 'text';

// The width of everything else in the template: what a wrapping text heads.
function contentWidth(els: Element[], text: Element): number {
  const boxes = els.filter((el) => el !== text && el.type !== 'arrow' && 'width' in el) as {
    x: number;
    width: number;
  }[];
  if (boxes.length === 0) return Infinity;
  return Math.max(...boxes.map((b) => b.x + b.width)) - Math.min(...boxes.map((b) => b.x));
}

describe('template text widths', () => {
  it.each(TEMPLATES.map((t) => t.kind))('%s sizes every text box to its words', (kind) => {
    const els = buildTemplate(kind, 0, 0);
    const tooWide = els
      .filter(isText)
      .filter(
        (t) =>
          fitTextWidth(t) !== t ||
          (t.width >= textWordsWidth(t) ? false : t.width > contentWidth(els, t)),
      )
      .map((t) => `${t.label}: ${Math.round(t.width)} px`);
    expect(tooWide).toEqual([]);
  });
});
