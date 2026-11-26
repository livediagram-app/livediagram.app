import { describe, expect, it } from 'vitest';
import {
  LABEL_FONT_PX,
  LABEL_LINE_HEIGHT,
  layOutPages,
  type TextElement,
} from '@livedocuments/document';
import { buildPageLayout } from './page-layout-build';

// docs/specs/007-editor/pages-mode.md "Layouts" (Work Tracker 1481): a layout's words are set at page type. Lists that
// fit their rows keep their sizes (a pass that stepped whole lists down a size turned them to fine print), and SWOT's
// points keep page type in boxes two lines tall, so a wrapped point is never cut at its row's edge.
const [a4] = layOutPages([{ id: 'p', orientation: 'portrait', size: 'a4', kind: 'infographic' }]);
const sizes = (id: string) => {
  const counts: Record<string, number> = {};
  for (const el of buildPageLayout(id as never, a4!)) {
    const t = el as Partial<TextElement>;
    if (t.label) counts[String(t.textSize)] = (counts[String(t.textSize)] ?? 0) + 1;
  }
  return counts;
};

describe('layout type sizes on an A4 page', () => {
  it.each([
    ['values', { lg: 8, md: 6 }],
    ['how-to', { 31: 6, lg: 8, md: 9 }],
    ['explain-cheat-sheet', { lg: 6, md: 34 }],
  ])('%s keeps its sizes, none small', (id, expected) => {
    expect(sizes(id)).toEqual(expected);
  });

  it('SWOT sets its points at page type, each in a box two lines tall', () => {
    const points = buildPageLayout('swot', a4!).filter(
      (el): el is TextElement =>
        el.type === 'text' &&
        [
          'A small marketing budget',
          'Two new districts opening',
          'Demand for green delivery',
        ].includes(el.label ?? ''),
    );
    expect(points.length).toBeGreaterThanOrEqual(3);
    for (const p of points) {
      expect(p.textSize).toBe('md');
      expect(p.height).toBeGreaterThanOrEqual(Math.floor(LABEL_FONT_PX.md * LABEL_LINE_HEIGHT * 2));
    }
  });
});
