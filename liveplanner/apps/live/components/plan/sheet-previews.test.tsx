// @vitest-environment jsdom
// docs/specs/029-sheets/sheet.md "Sheet templates": every Spreadsheets choice has a picture; a template's draws its
// header in its accent, and the chart it places.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { accentHead, SHEET_TEMPLATES } from '@liveplanner/sheets';
import { planPalette } from './plan-palette';
import { SHEET_TILES, SheetPreview } from './sheet-previews';

const palette = planPalette('light');

describe('the Spreadsheets pictures', () => {
  it('lists the empty sheet, the card table, then every template', () => {
    expect(SHEET_TILES.map((t) => t.start)).toEqual([
      null,
      'cards',
      ...SHEET_TEMPLATES.map((t) => t.id),
    ]);
  });

  it.each(SHEET_TEMPLATES)('draws $name in its accent, with its chart when it has one', (t) => {
    const tile = SHEET_TILES.find((x) => x.start === t.id)!;
    const { container } = render(<SheetPreview palette={palette} tile={tile} />);
    const fills = [...container.querySelectorAll('rect')].map((r) => r.getAttribute('fill'));
    expect(fills).toContain(accentHead(t.accent));
    const chartMark =
      t.chart === 'pie-chart' ? 'path' : t.chart === 'line-chart' ? 'polyline' : null;
    if (chartMark) expect(container.querySelector(chartMark)).toBeTruthy();
  });

  it('draws the empty sheet’s picked cell and the card table’s chips', () => {
    const empty = render(<SheetPreview palette={palette} tile={SHEET_TILES[0]!} />);
    expect(empty.container.querySelectorAll('rect').length).toBeGreaterThan(1);
    const cards = render(<SheetPreview palette={palette} tile={SHEET_TILES[1]!} />);
    expect(cards.container.querySelectorAll('rect').length).toBeGreaterThan(10);
  });
});
