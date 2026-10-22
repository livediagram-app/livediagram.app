import { describe, expect, it } from 'vitest';
import { layOutPages, newWireframePage, type Element } from '@livedesign/document';
import { buildPageLayout, layoutCatalogueFor } from '@livedesign/templates';

// docs/specs/009-elements/pie-chart.md "Show Values": a column chart names its columns under its baseline only
// with its values on, so one whose legend is off and values are not draws columns nobody can name (the Chart
// Story and Big Chart layouts drew "Revenue by quarter" over four unlabelled bars).
const namesItsColumns = (el: Element) =>
  el.type !== 'shape' ||
  el.shape !== 'bar-chart' ||
  el.chartLegend !== false ||
  el.chartValues === true;

describe('layout charts', () => {
  const [phone] = layOutPages([newWireframePage('w')]);
  const cases = layoutCatalogueFor('wireframe').layouts.map((l) => [l.id, phone!] as const);

  it.each(cases)('%s names every column it draws', (id, on) => {
    for (const el of buildPageLayout(id, on)) expect(namesItsColumns(el), el.id).toBe(true);
  });
});
