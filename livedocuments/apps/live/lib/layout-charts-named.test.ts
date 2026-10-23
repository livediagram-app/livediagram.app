import { describe, expect, it } from 'vitest';
import { layOutPages, newSlidePage, type Element } from '@livedocuments/document';
import { buildPageLayout, PAGE_LAYOUTS, SLIDE_LAYOUTS } from '@livedocuments/templates';

// docs/specs/009-elements/pie-chart.md "Show Values": a column chart names its columns under its baseline only
// with its values on, so one whose legend is off and values are not draws columns nobody can name (the Chart
// Story and Big Chart layouts drew "Revenue by quarter" over four unlabelled bars).
const namesItsColumns = (el: Element) =>
  el.type !== 'shape' ||
  el.shape !== 'bar-chart' ||
  el.chartLegend !== false ||
  el.chartValues === true;

describe('layout charts', () => {
  const [page] = layOutPages([{ id: 'p', orientation: 'portrait', size: 'a4' }]);
  const [slide] = layOutPages([newSlidePage('s', 'slide')]);
  const cases = [
    ...PAGE_LAYOUTS.map((l) => [l.id, page!] as const),
    ...SLIDE_LAYOUTS.map((l) => [l.id, slide!] as const),
  ];

  it.each(cases)('%s names every column it draws', (id, on) => {
    for (const el of buildPageLayout(id, on)) expect(namesItsColumns(el), el.id).toBe(true);
  });
});
