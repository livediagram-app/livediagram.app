import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { isValidElement } from './validate';
import { isPlanSheetRef, takesTypedLabel } from './element-types';
import { elementKindLabel } from './element-kind-label';
import { renderElementsToSvg } from './svg-render';
import { svgPlanSheet, type SheetRenderModel } from './svg-render-plan-sheet';

const sheet = {
  id: 'e1',
  type: 'shape' as const,
  shape: 'plan-sheet' as const,
  x: 0,
  y: 0,
  width: 960,
  height: 560,
  planSheet: { sheetId: 'sheet0001' },
};

describe('the Sheet element', () => {
  it('is a valid, untyped shape that names its sheet', () => {
    const made = createShape('plan-sheet', 10, 20) as { width: number; planSheet: unknown };
    expect(made.width).toBe(960);
    expect(made.planSheet).toEqual({ sheetId: '' });
    expect(isValidElement(sheet)).toBe(true);
    expect(isValidElement({ ...sheet, planSheet: { sheetId: 'bad id!' } })).toBe(false);
    expect(isPlanSheetRef({ sheetId: 'sheet0001', x: 1 })).toBe(false);
    expect(isPlanSheetRef(null)).toBe(false);
    // A template's Sheet not yet made names its start (sheet-store.md "Template starts").
    expect(isPlanSheetRef({ sheetId: 'sheet0001', start: 'budget-planner' })).toBe(true);
    expect(isPlanSheetRef({ sheetId: 'sheet0001', start: 'Budget Planner' })).toBe(false);
    expect(isPlanSheetRef({ sheetId: 'sheet0001', start: 3 })).toBe(false);
    expect(takesTypedLabel(sheet)).toBe(false);
    expect(elementKindLabel(sheet as never)).toBe('Sheet');
  });
});

const MODEL: SheetRenderModel = {
  title: 'Budget <Q3>',
  colWidths: [100, 100],
  rowHeights: [24, 24],
  colLabels: ['A', 'B'],
  rowLabels: ['1', '2'],
  frozenRows: 1,
  frozenCols: 1,
  cells: [
    {
      r: 0,
      c: 0,
      text: 'Total',
      align: 'l',
      valign: 'b',
      bold: true,
      italic: true,
      underline: true,
      strike: true,
      fill: '#eeeeee',
      colSpan: 2,
      size: 12,
      borders: {
        t: { w: 1, s: 'solid', c: '#000000' },
        b: { w: 2, s: 'dashed', c: '#000000' },
        l: { w: 1, s: 'dotted', c: '#000000' },
        r: { w: 1, s: 'solid', c: '#000000' },
      },
    },
    { r: 1, c: 0, text: '#DIV/0!', align: 'c', valign: 'm', error: true },
    { r: 1, c: 1, text: '12', align: 'r', valign: 't', color: '#123456', wrap: 'w', font: 'lora' },
    // A font the editor no longer offers draws in the sheet's.
    { r: 2, c: 0, text: 'Old', align: 'l', valign: 'm', font: 'gone-font' },
  ],
};

describe('the static render', () => {
  it('draws the header, headers, cells, formats and borders', () => {
    const svg = svgPlanSheet(sheet, MODEL, 'light');
    expect(svg).toContain('Budget &lt;Q3&gt;');
    expect(svg).toContain('font-weight="700"');
    expect(svg).toContain('text-decoration="underline line-through"');
    expect(svg).toContain('fill="#dc2626"');
    expect(svg).toContain('text-anchor="end"');
    expect(svg).toContain('stroke-dasharray');
    expect(svg).toContain('#123456');
    expect(svg).toContain('font-family="&#39;Lora&#39;');
    expect(svg.match(/font-family="&#39;/g)).toHaveLength(1);
  });
  it('draws a dropdown chip as a pill in its option’s colour, inked to read, and an arrow dropdown’s chevron', () => {
    const cells = (extra: SheetRenderModel['cells']) =>
      svgPlanSheet(sheet, { ...MODEL, cells: extra }, 'light');
    const dark = cells([
      { r: 0, c: 0, text: 'Won', align: 'l', valign: 'm', chip: { color: '#166534' } },
    ]);
    expect(dark).toMatch(
      /<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+" rx="[\d.]+" fill="#166534"\/>/,
    );
    expect(dark).toContain('fill="#ffffff"');
    expect(dark).toContain('stroke-linecap="round"');
    const light = cells([
      { r: 0, c: 0, text: 'Lead', align: 'r', valign: 'm', chip: { color: '#fef08a' } },
    ]);
    expect(light).toContain('fill="#1f2937"');
    // A chip's text starts inside its pill, whatever the cell's alignment.
    expect(/<text[^>]*>Lead</.exec(light)?.[0]).not.toContain('text-anchor');
    const plain = cells([{ r: 0, c: 0, text: 'Other', align: 'l', valign: 'm', chip: {} }]);
    expect(plain).toMatch(/rx="[\d.]+" fill="#f1f5f9"/);
    const arrow = cells([{ r: 0, c: 0, text: 'North', align: 'r', valign: 'm', arrow: true }]);
    expect(arrow).toContain('stroke-linecap="round"');
    expect(/<text[^>]*>North</.exec(arrow)?.[0]).toContain('text-anchor="end"');
  });

  it('leaves out the gridlines and the headers when the sheet hides them', () => {
    const shown = svgPlanSheet(sheet, MODEL, 'light');
    const hidden = svgPlanSheet(sheet, { ...MODEL, hideGrid: true, hideHeaders: true }, 'light');
    const lines = (svg: string) => (svg.match(/stroke-width="1"\/>/g) ?? []).length;
    expect(lines(hidden)).toBeLessThan(lines(shown));
    expect(shown).toContain('>A</text>');
    expect(hidden).not.toContain('>A</text>');
    expect(hidden).toContain('Total');
  });
  it('draws a frame and headers without a model', () => {
    expect(svgPlanSheet(sheet, undefined, 'light')).toContain('>Sheet<');
  });
  it('renders through the tab renderer with the sheets given', () => {
    const svg = renderElementsToSvg({ elements: [sheet] } as never, {
      sheets: new Map([['sheet0001', MODEL]]),
    });
    expect(svg).toContain('Total');
    // The export declares the cells' fonts with the rest.
    expect(svg).toContain('family=Lora');
    expect(renderElementsToSvg({ elements: [sheet] } as never)).toContain('>Sheet<');
  });
});

describe('copies of a Sheet', () => {
  it('frame a new sheet made from the original', async () => {
    const { freshCopyFields } = await import('./duplicate');
    const copy = freshCopyFields(sheet) as {
      planSheet: { sheetId: string; copyOf: string };
    };
    expect(copy.planSheet.copyOf).toBe('sheet0001');
    expect(copy.planSheet.sheetId).not.toBe('sheet0001');
    expect(isPlanSheetRef(copy.planSheet)).toBe(true);
    // A copy of a copy not yet made copies the original.
    const again = freshCopyFields({ ...sheet, planSheet: copy.planSheet }) as typeof copy;
    expect(again.planSheet.copyOf).toBe('sheet0001');
    expect(freshCopyFields({ ...sheet, planSheet: { sheetId: '' } })).toEqual({});
    // A copy of a template's Sheet not yet made is made from the same start.
    const started = freshCopyFields({
      ...sheet,
      planSheet: { sheetId: 'sheet0001', start: 'timesheet' },
    }) as typeof copy & { planSheet: { start?: string } };
    expect(started.planSheet.start).toBe('timesheet');
    expect(started.planSheet.copyOf).toBeUndefined();
    expect(started.planSheet.sheetId).not.toBe('sheet0001');
    expect(isPlanSheetRef({ sheetId: 'sheet0001', copyOf: 'x' })).toBe(false);
    // Fill Tab is exactly true, or absent.
    expect(isPlanSheetRef({ sheetId: 'sheet0001', fillTab: true })).toBe(true);
    expect(isPlanSheetRef({ sheetId: 'sheet0001', fillTab: false })).toBe(false);
  });
});

// docs/specs/029-sheets/formulas.md "Text": a HYPERLINK stays a link in an SVG export, its target escaped like any
// text, in the sheet's accent unless the cell has its own colour.
describe('a HYPERLINK cell in the static render', () => {
  it('wraps its text in an escaped link that opens in a new tab', () => {
    const svg = svgPlanSheet(
      sheet,
      {
        ...MODEL,
        cells: [
          {
            r: 0,
            c: 0,
            text: 'Docs',
            align: 'l',
            valign: 'm',
            underline: true,
            link: 'https://example.com/?a=1&b="2"',
          },
        ],
      },
      'light',
    );
    expect(svg).toContain(
      '<a href="https://example.com/?a=1&amp;b=&quot;2&quot;" target="_blank" rel="noopener noreferrer"><text',
    );
    expect(svg).toMatch(/<a [^>]*><text[^>]*text-decoration="underline"[^>]*>Docs<\/text><\/a>/);
  });

  it('leaves a cell without a link unwrapped', () => {
    expect(svgPlanSheet(sheet, MODEL, 'light')).not.toContain('<a ');
  });
});
