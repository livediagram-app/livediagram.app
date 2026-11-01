import { describe, expect, it } from 'vitest';
import { labelTextScale, withPickedTextSize } from './label-text-scale';
import { dropMalformedStyles } from './malformed-styles';
import { layOutPages, type Page } from './page';
import { pageTurned } from './pages-edits';
import { svgBoxed } from './svg-render';
import { inlineIconMetrics } from './svg-render-inline-icon';
import { elementValidationIssue, isValidElement, TEXT_SCALE_MAX, TEXT_SCALE_MIN } from './validate';
import type { Element, ShapeElement, StickyElement, Tab, TextElement } from './index';

// docs/specs/007-editor/pages-mode.md "Sizes": a re-fit scales a shape's own label with its box
// (textScale), as it scales a text's text, and every renderer draws it at that scale.

const shape = (extra: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 's',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 220,
  height: 52,
  label: 'Continue with Google',
  textSize: 16,
  ...extra,
});
const text = (extra: Partial<TextElement> = {}): TextElement => ({
  id: 't',
  type: 'text',
  x: 0,
  y: 0,
  width: 220,
  height: 30,
  label: 'Sign In',
  textSize: 24,
  ...extra,
});
const sticky: StickyElement = {
  id: 'n',
  type: 'sticky',
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  label: 'Note',
};
// The first `font-size` an export writes.
const fontSize = (svg: string): number => Number(/font-size="([\d.]+)"/.exec(svg)?.[1]);

describe('labelTextScale', () => {
  it("reads a shape's and a text's scale, 1 when absent or on any other element", () => {
    expect(labelTextScale(shape({ textScale: 0.46 }))).toBe(0.46);
    expect(labelTextScale(text({ textScale: 2 }))).toBe(2);
    expect(labelTextScale(shape())).toBe(1);
    expect(labelTextScale(sticky)).toBe(1);
  });
});

describe('a picked text size', () => {
  it('drops the scale, so the size picked is the size drawn', () => {
    const picked = withPickedTextSize(shape({ textScale: 0.46 }), 18);
    expect(picked.textSize).toBe(18);
    expect('textScale' in picked).toBe(false);
    expect(picked.label).toBe('Continue with Google');
  });

  it('sets the size on an element without a scale', () => {
    expect(withPickedTextSize(sticky, 'lg')).toEqual({ ...sticky, textSize: 'lg' });
  });
});

describe('a shape with a textScale', () => {
  it('validates in the range a text takes, and absent is valid as ever', () => {
    expect(isValidElement(shape())).toBe(true);
    expect(isValidElement(shape({ textScale: TEXT_SCALE_MIN }))).toBe(true);
    expect(isValidElement(shape({ textScale: TEXT_SCALE_MAX }))).toBe(true);
    expect(elementValidationIssue({ ...shape(), textScale: 0 })).toEqual({
      field: 'textScale',
      rule: `a number from ${TEXT_SCALE_MIN} to ${TEXT_SCALE_MAX}`,
    });
    expect(isValidElement({ ...shape(), textScale: '0.5' })).toBe(false);
  });

  it('loses a scale of the wrong type where stored elements enter, keeping the rest', () => {
    const [out] = dropMalformedStyles([{ ...shape(), textScale: 'half' } as unknown as Element]);
    expect('textScale' in out!).toBe(false);
    expect((out as ShapeElement).label).toBe('Continue with Google');
    const kept = [shape({ textScale: 0.5 })];
    expect(dropMalformedStyles(kept)).toBe(kept);
  });

  it('exports its label at its size times its scale, a rich run with it', () => {
    expect(fontSize(svgBoxed(shape()))).toBe(16);
    expect(fontSize(svgBoxed(shape({ textScale: 0.5 })))).toBe(8);
    const rich = shape({
      textScale: 0.5,
      richText: [{ text: 'Continue ', bold: true }, { text: 'with Google' }],
    });
    expect(svgBoxed(rich)).toContain('font-size="8"');
  });

  it("exports an icon's caption at its scale", () => {
    const art = { markup: '<path d="M0 0L24 24"/>', colored: false };
    const icon = (textScale?: number) =>
      svgBoxed(
        shape({ shape: 'icon', iconId: 'cart', label: 'Cart', width: 96, height: 96, textScale }),
        { resolveIconArt: () => art },
      );
    expect(fontSize(icon(0.5))).toBe(fontSize(icon()) / 2);
  });

  it('shrinks its inline icon with its words, a box-fitted label excepted', () => {
    const full = inlineIconMetrics({ width: 400, height: 400 }, 'A', 'lg');
    const half = inlineIconMetrics({ width: 400, height: 400, textScale: 0.5 }, 'A', 'lg');
    expect(half.fontSize).toBe(full.fontSize / 2);
    expect(half.iconSize).toBeLessThan(full.iconSize);
    expect(inlineIconMetrics({ width: 220, height: 72, textScale: 0.5 }, 'A', 'scale')).toEqual(
      inlineIconMetrics({ width: 220, height: 72 }, 'A', 'scale'),
    );
  });
});

describe('turning a page', () => {
  // A column as tall as a portrait A4 page's margin box, so a landscape turn has to shrink it.
  const page: Page = { id: 'p', orientation: 'portrait' };
  const tall = (): Tab => {
    const r = layOutPages([page])[0]!.rect;
    return {
      id: 't',
      name: 'T',
      pages: [page],
      elements: [
        shape({ x: r.x + 100, y: r.y + 40, width: 300, height: r.height - 80 }),
        text({ x: r.x + 100, y: r.y + 60 }),
        { ...sticky, x: r.x + 120, y: r.y + 300 },
        shape({ id: 'floor', x: r.x + 100, y: r.y + 400, textScale: TEXT_SCALE_MIN }),
      ],
    };
  };

  it("scales a shape's label with its box, as a text's text", () => {
    const out = pageTurned(tall(), 'p', 'landscape');
    if (!('tab' in out)) throw new Error('refused');
    const [box, words, note, floor] = out.tab.elements as [
      ShapeElement,
      TextElement,
      StickyElement,
      ShapeElement,
    ];
    expect(box.textScale).toBeGreaterThan(0);
    expect(box.textScale).toBeLessThan(1);
    expect(box.textScale).toBe(words.textScale);
    expect('textScale' in note).toBe(false);
    // However often it is turned, the scale stays one a stored element takes.
    expect(floor.textScale).toBe(TEXT_SCALE_MIN);
    expect(isValidElement(floor)).toBe(true);
  });
});
