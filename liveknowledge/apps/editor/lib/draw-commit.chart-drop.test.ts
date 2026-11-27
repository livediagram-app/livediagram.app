import {
  layOutPages,
  newSlidePage,
  pageContentBox,
  pagesOf,
  type Tab,
} from '@liveknowledge/document';
import { describe, expect, it } from 'vitest';
import { buildDrawnBoxed, chartDropOn } from './draw-commit';

// A chart dropped on a slide is sized for the slide (docs/specs/009-elements/pie-chart.md "Behaviour").
const deck = { id: 't', elements: [], pages: [newSlidePage('s1')] } as unknown as Tab;
const slide = layOutPages(pagesOf(deck))[0]!;
const box = pageContentBox(slide);
const mid = { x: slide.rect.x + slide.rect.width / 2, y: slide.rect.y + slide.rect.height / 2 };

describe('a chart dropped on a slide', () => {
  it('takes 60% of the slide’s content box, centred on the drop', () => {
    const at = chartDropOn(deck, 'bar-chart', mid.x, mid.y)!;
    expect(at.width).toBe(Math.round(box.width * 0.6));
    expect(Math.abs(at.x + at.width / 2 - mid.x)).toBeLessThanOrEqual(1);
  });

  it('lands at that size when tapped from the palette, and keeps a dragged box', () => {
    const tapped = buildDrawnBoxed(
      { type: 'shape', kind: 'line-chart' } as never,
      mid.x,
      mid.y,
      mid.x,
      mid.y,
      null,
      deck,
    );
    expect(tapped.width).toBe(Math.round(box.width * 0.6));
    const dragged = buildDrawnBoxed(
      { type: 'shape', kind: 'line-chart' } as never,
      mid.x,
      mid.y,
      mid.x + 300,
      mid.y + 200,
      null,
      deck,
    );
    expect(dragged.width).toBe(300);
  });

  it('keeps its own size off a page, and for a kind that is not a chart', () => {
    expect(chartDropOn(deck, 'bar-chart', slide.rect.x - 900, mid.y)).toBeNull();
    expect(chartDropOn(deck, 'square', mid.x, mid.y)).toBeNull();
    expect(chartDropOn({ id: 'c', elements: [] } as unknown as Tab, 'bar-chart', 0, 0)).toBeNull();
  });
});
