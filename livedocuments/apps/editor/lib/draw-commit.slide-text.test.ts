import { layOutPages, newSlidePage, pagesOf, type Page, type Tab } from '@livedocuments/document';
import { describe, expect, it } from 'vitest';
import { buildDrawnBoxed, presetTextAt, SLIDE_TEXT_SPAN, slideAt } from './draw-commit';

// docs/specs/008-canvas/canvas-and-palette.md "On a slide, a style spans the slide".
const deck = {
  id: 't',
  elements: [],
  pages: [newSlidePage('s1'), newSlidePage('s2')],
} as unknown as Tab;
const [first, second] = layOutPages(pagesOf(deck));
const centre = (r: { x: number; y: number; width: number; height: number }) => ({
  x: r.x + r.width / 2,
  y: r.y + r.height / 2,
});

describe('a text style on a slide', () => {
  it('spans 80% of the slide, centred across it, wrapping there, at the tapped height', () => {
    const at = centre(second!.rect);
    const title = presetTextAt(at.x + 300, at.y, 'title', slideAt(deck, at.x + 300, at.y));
    expect(title.width).toBe(Math.round(second!.rect.width * SLIDE_TEXT_SPAN));
    expect(title.x).toBeCloseTo(second!.rect.x + (second!.rect.width - title.width) / 2);
    expect(title.sizing).toBe('wrap');
    expect(title.y + title.height / 2).toBeCloseTo(at.y);
  });

  it('starts every style at the same left edge, wherever on the slide it is tapped', () => {
    const r = first!.rect;
    const xs = (['title', 'heading', 'paragraph', 'quote'] as const).map((p, i) => {
      const x = r.x + r.width * (0.2 + 0.2 * i);
      return presetTextAt(x, r.y + 100, p, slideAt(deck, x, r.y + 100)).x;
    });
    expect(new Set(xs).size).toBe(1);
  });

  it('keeps its own box off a slide: on an infographic, between pages, or with no pages', () => {
    const info = {
      id: 'i',
      elements: [],
      pages: [{ id: 'p', kind: 'infographic', size: 'a4', orientation: 'portrait' } as Page],
    } as unknown as Tab;
    const r = layOutPages(pagesOf(info))[0]!.rect;
    expect(slideAt(info, r.x + 10, r.y + 10)).toBeUndefined();
    expect(slideAt(deck, first!.rect.x - 500, first!.rect.y)).toBeUndefined();
    expect(slideAt({ id: 'c', elements: [] } as unknown as Tab, 0, 0)).toBeUndefined();
    expect(presetTextAt(0, 0, 'title').sizing).toBe('fit');
  });

  it('lets a drag set its own width on a slide', () => {
    const r = first!.rect;
    const made = buildDrawnBoxed(
      { type: 'text', preset: 'title' } as never,
      r.x + 100,
      r.y + 100,
      r.x + 500,
      r.y + 160,
      null,
      deck,
    );
    expect(made.width).toBe(400);
    expect(made.x).toBe(r.x + 100);
  });

  it('takes a tap on a slide from the palette at the slide width', () => {
    const c = centre(first!.rect);
    const made = buildDrawnBoxed(
      { type: 'text', preset: 'subtitle' } as never,
      c.x,
      c.y,
      c.x,
      c.y,
      null,
      deck,
    );
    expect(made.width).toBe(Math.round(first!.rect.width * SLIDE_TEXT_SPAN));
  });
});
