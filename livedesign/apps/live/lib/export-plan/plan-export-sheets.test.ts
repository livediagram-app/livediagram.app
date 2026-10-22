import { describe, expect, it } from 'vitest';
import { Workbook, sheetFromJson, type Sheet } from '@livedesign/sheets';
import type { DashboardLayout, Tab } from '@livedesign/document';
import {
  sheetContentsFor,
  sheetMetricsFor,
  sheetModelsFor,
  sheetTabsToLoad,
} from './plan-export-sheets';
import { sheetContentSize } from '@livedesign/sheets';
import { shape } from '@livedesign/plan-art/test-fixtures';

// docs/specs/026-plan/plan-tabs.md "Export", docs/specs/029-sheets/sheet.md "Exports and images": an image draws the
// cells a Sheet shows, read from the editor's sheet store.
const person = { id: 'p', name: 'Sam', color: '#2563eb' };
const budget: Sheet = sheetFromJson({
  id: 'sheet-one',
  tabId: 'sheet-tab',
  title: 'Budget',
  layout: { rows: ['row0', 'row1', 'row2'], cols: ['col0', 'col1'] },
  cells: [
    { r: 'row0', c: 'col0', i: { s: 'Item' } },
    { r: 'row1', c: 'col0', i: { s: 'Rent' } },
    { r: 'row1', c: 'col1', i: { n: 1200 } },
  ],
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: person,
});
const wb = new Workbook({ sheets: [budget], locale: 'en-GB' });
const store = {
  sheet: (id: string) => (id === budget.id ? budget : undefined),
  workbook: () => wb,
};
const sheetEl = shape('s', 'plan-sheet', {
  planSheet: { sheetId: 'sheet-one' },
  width: 600,
  height: 300,
});
const sheetTab: Tab = { id: 'sheet-tab', name: 'Budget', kind: 'sheet', elements: [sheetEl] };

const metricLayout = (sheetId: string): DashboardLayout => ({
  rows: [
    {
      id: 'r',
      height: 200,
      slots: [
        {
          id: 'm',
          span: 12,
          content: {
            type: 'sheet-metric',
            metric: 'figure',
            sheetId,
            cell: { r: 'row1', c: 'col1' },
          },
        },
      ],
    },
  ],
});

describe('the Sheets an image reads', () => {
  it('measures the grid each framed Sheet’s cells fill, leaving out one it has not loaded', () => {
    const missing = shape('m', 'plan-sheet', { planSheet: { sheetId: 'not-loaded' } });
    const contents = sheetContentsFor([sheetEl, missing], store);
    expect([...contents.keys()]).toEqual(['sheet-one']);
    expect(contents.get('sheet-one')).toEqual(sheetContentSize(budget));
  });

  it('works out each framed Sheet’s cells from the store, leaving out one it has not loaded', () => {
    const models = sheetModelsFor(
      [sheetEl, shape('t', 'plan-sheet', { planSheet: { sheetId: 'not-loaded' } })],
      store,
    );
    expect([...models.keys()]).toEqual(['sheet-one']);
    expect(models.get('sheet-one')!.cells.map((c) => c.text)).toEqual(['Item', 'Rent', '1200']);
  });

  it('reads a figure from a Sheet, or says it is loading, gone or unset', () => {
    expect(
      sheetMetricsFor(metricLayout('sheet-one'), [sheetTab], store, 'en-GB').get('m'),
    ).toMatchObject({ hero: '1200', label: 'Rent' });
    expect(sheetMetricsFor(metricLayout('other-sheet'), [sheetTab], store, 'en-GB').get('m')).toBe(
      'gone',
    );
    const placed: Tab = {
      ...sheetTab,
      elements: [shape('o', 'plan-sheet', { planSheet: { sheetId: 'other-sheet' } })],
    };
    expect(sheetMetricsFor(metricLayout('other-sheet'), [placed], store, 'en-GB').get('m')).toBe(
      'loading',
    );
    expect(sheetMetricsFor(metricLayout(''), [], store, 'en-GB').get('m')).toBe('unset');
    expect(sheetMetricsFor(undefined, [], store, 'en-GB').size).toBe(0);
  });

  it('loads the tabs holding the Sheets it frames and the figures it reads', () => {
    const image: Tab = { id: 'img', name: 'x', elements: [sheetEl] };
    expect(
      sheetTabsToLoad(image, undefined, [sheetTab, { id: 'x', name: 'x', elements: [] }]),
    ).toEqual(['sheet-tab']);
    expect(
      sheetTabsToLoad({ ...image, elements: [] }, metricLayout('sheet-one'), [sheetTab]),
    ).toEqual(['sheet-tab']);
  });
});
