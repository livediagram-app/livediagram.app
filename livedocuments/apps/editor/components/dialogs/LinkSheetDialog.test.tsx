// @vitest-environment jsdom
// Link to Sheet (docs/specs/009-elements/pie-chart.md "Charts linked to a liveplanner sheet"): the plan, its sheet
// and the range prefilled with its filled cells, a preview of the read, and Link keeping the read with the link; and
// the menu's Data section, an Editor's Link to Sheet, Update, Change and Unlink, a Viewer's status alone.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ChartSheetSource, type ShapeElement } from '@livedocuments/document';
import { IndexError, type SheetRangeRead } from '@liveworkspace/index-client';

const { listItems, listSheets, readSheetRange } = vi.hoisted(() => ({
  listItems: vi.fn(),
  listSheets: vi.fn(),
  readSheetRange: vi.fn(),
}));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({
  indexClient: { listItems, listSheets, readSheetRange },
}));
vi.mock('@/lib/api/document-grants', () => ({ documentGrant: async () => null }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { SheetLinksContext, type SheetLinks } from '@/components/canvas/SheetLinkedCharts';
import { SheetLinkSection } from '@/components/palette/SheetLinkSection';
import { LinkSheetDialog } from './LinkSheetDialog';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

const read: SheetRangeRead = {
  itemId: 'plan_1',
  itemName: 'Budget',
  sheetId: 'sheet0001',
  sheetName: 'Costs',
  tabId: 't1',
  range: { r1: 'r001', c1: 'c001', r2: 'r003', c2: 'c002' },
  a1: 'A1:B3',
  table: { categories: ['Q1', 'Q2'], series: [{ name: 'Sales', values: [10, 20] }] },
  readAt: 5,
};
const bar = (extra: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('bar-chart', 0, 0),
  ...extra,
});

describe('LinkSheetDialog', () => {
  it('picks a plan and its first sheet, previews the range, and links with the read', async () => {
    listItems.mockResolvedValue({ items: [{ id: 'plan_1', title: 'Budget' }] });
    listSheets.mockResolvedValue({
      itemId: 'plan_1',
      itemName: 'Budget',
      sheets: [{ id: 'sheet0001', name: 'Costs', tabId: 't1', a1: 'A1:B3' }],
    });
    readSheetRange.mockResolvedValue(read);
    const onLink = vi.fn();
    render(<LinkSheetDialog chart={bar()} documentId="doc_1" onLink={onLink} onClose={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Budget' }));
    expect(await screen.findByRole('button', { name: /Costs/ })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Range').value).toBe('A1:B3');
    expect(await screen.findByRole('columnheader', { name: 'Sales' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '20' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    await waitFor(() => expect(onLink).toHaveBeenCalledTimes(1));
    const [source] = onLink.mock.calls[0] as [ChartSheetSource];
    expect(source).toEqual({
      app: 'liveplanner',
      itemId: 'plan_1',
      sheetId: 'sheet0001',
      range: read.range,
      itemName: 'Budget',
      sheetName: 'Costs',
      a1: 'A1:B3',
      readAt: 5,
    });
  });

  it('says why a range cannot be read, and keeps Link off', async () => {
    listItems.mockResolvedValue({ items: [] });
    listSheets.mockResolvedValue({
      itemId: 'plan_1',
      itemName: 'Budget',
      sheets: [{ id: 'sheet0001', name: 'Costs', tabId: 't1', a1: 'A1:B3' }],
    });
    readSheetRange.mockRejectedValue(new IndexError(400, 'invalid_range'));
    render(
      <LinkSheetDialog
        chart={bar({ chartSheetSource: { ...sourceOf(), a1: 'nope' } })}
        documentId="doc_1"
        onLink={() => {}}
        onClose={() => {}}
      />,
    );
    expect(await screen.findByText('No plans yet')).toBeTruthy();
    expect(await screen.findByText(/That is not a range/)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Update Link' }).disabled).toBe(
      true,
    );
  });
});

const sourceOf = (): ChartSheetSource => ({
  app: 'liveplanner',
  itemId: 'plan_1',
  sheetId: 'sheet0001',
  range: read.range,
  itemName: 'Budget',
  sheetName: 'Costs',
  a1: 'A1:B3',
  readAt: 5,
});

describe('SheetLinkSection', () => {
  const links = (over: Partial<SheetLinks> = {}): SheetLinks => ({
    statusOf: () => ({ kind: 'live', read: { ...read, readAt: Date.now() } }),
    canEdit: true,
    openLink: vi.fn(),
    update: vi.fn(),
    unlink: vi.fn(),
    ...over,
  });
  const show = (value: SheetLinks, chart: ShapeElement) =>
    render(
      <SheetLinksContext.Provider value={value}>
        <SheetLinkSection chart={chart} rows={<p>rows</p>} />
      </SheetLinksContext.Provider>,
    );

  it('offers an Editor Link to Sheet under the rows, and a Viewer only the rows', () => {
    const editor = links();
    show(editor, bar());
    expect(screen.getByText('rows')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Link to Sheet…' }));
    expect(editor.openLink).toHaveBeenCalled();
    cleanup();
    show(links({ canEdit: false }), bar());
    expect(screen.queryByRole('button', { name: 'Link to Sheet…' })).toBeNull();
  });

  it('shows a linked chart its sheet in place of the rows, with Update, Change and Unlink for an Editor', () => {
    const editor = links();
    const chart = bar({ chartSheetSource: sourceOf() });
    show(editor, chart);
    expect(screen.queryByText('rows')).toBeNull();
    expect(screen.getByText('Budget')).toBeTruthy();
    expect(screen.getByText('Updated just now')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unlink' }));
    expect(editor.update).toHaveBeenCalled();
    expect(editor.openLink).toHaveBeenCalledWith(chart.id);
    expect(editor.unlink).toHaveBeenCalledWith(chart.id);
  });

  it('tells a reader without access the values are the last saved, with no actions', () => {
    act(() => {
      show(
        links({ canEdit: false, statusOf: () => ({ kind: 'saved' }) }),
        bar({ chartSheetSource: sourceOf() }),
      );
    });
    expect(screen.getByText(/a sheet you can't open, as last saved/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Unlink' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
  });

  it('draws the rows alone outside an editor', () => {
    render(<SheetLinkSection chart={bar({ chartSheetSource: sourceOf() })} rows={<p>rows</p>} />);
    expect(screen.getByText('rows')).toBeTruthy();
  });
});
