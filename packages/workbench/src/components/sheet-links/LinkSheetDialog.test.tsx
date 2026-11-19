// @vitest-environment jsdom
// Link to Sheet (each reader app's docs/specs/009-elements/pie-chart.md "Charts linked to a liveplanner sheet"): the plan, its sheet
// and the range prefilled with its filled cells, a preview of the read, and Link keeping the read with the link; and
// the menu's Data section, an Editor's Link to Sheet, Update, Change and Unlink, a Viewer's status alone.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChartSheetSource } from '@liveworkspace/element-model/chart-sheet-source';
import { IndexError, type SheetRangeRead } from '@liveworkspace/index-client';
import type { SheetChart } from './sheet-links';

const { listItems, listSheets, readSheetRange } = vi.hoisted(() => ({
  listItems: vi.fn(),
  listSheets: vi.fn(),
  readSheetRange: vi.fn(),
}));
vi.mock('../../lib/index-client', () => ({
  indexClient: { listItems, listSheets, readSheetRange },
}));

import { SheetLinksContext, type SheetLinks } from './SheetLinkedCharts';
import { SheetLinkSection } from './SheetLinkSection';
import { LinkSheetDialog } from './LinkSheetDialog';

const grantOf = async () => null;

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
const bar = (extra: Partial<SheetChart> = {}): SheetChart => ({
  id: 'c1',
  type: 'shape',
  shape: 'bar-chart',
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
    render(
      <LinkSheetDialog
        chart={bar()}
        itemId="doc_1"
        grantOf={grantOf}
        noun="design"
        onLink={onLink}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/saved in the design/)).toBeTruthy();
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
        itemId="doc_1"
        grantOf={grantOf}
        noun="document"
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

describe('LinkSheetDialog states', () => {
  const sheetList = (sheets: unknown[]) => ({ itemId: 'plan_1', itemName: 'Budget', sheets });
  const open = (chart = bar()) =>
    render(
      <LinkSheetDialog
        chart={chart}
        itemId="doc_1"
        grantOf={grantOf}
        noun="document"
        onLink={() => {}}
        onClose={() => {}}
      />,
    );

  it("says why a plan's list or sheets could not be had, and when there is nothing to pick", async () => {
    listItems.mockRejectedValueOnce(new Error('offline'));
    open();
    expect(await screen.findByText("Couldn't load your plans")).toBeTruthy();
    expect(screen.getByText('Pick a plan first.')).toBeTruthy();
    expect(screen.getByText(/Pick a sheet and a range/)).toBeTruthy();
    cleanup();
    listItems.mockResolvedValue({ items: [{ id: 'plan_1', title: '' }] });
    listSheets.mockRejectedValueOnce(new IndexError(404, 'not_found'));
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Untitled plan' }));
    expect(await screen.findByText("Couldn't open this plan")).toBeTruthy();
    cleanup();
    listSheets.mockResolvedValueOnce(sheetList([]));
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Untitled plan' }));
    expect(await screen.findByText('No sheets in this plan')).toBeTruthy();
  });

  it('searches the plans, and offers to clear a search that finds none', async () => {
    listItems.mockResolvedValue({ items: [] });
    open();
    fireEvent.change(screen.getByLabelText('Search your plans'), {
      target: { value: 'zzz' },
    });
    await waitFor(() =>
      expect(listItems).toHaveBeenLastCalledWith(
        expect.objectContaining({ app: 'liveplanner', q: 'zzz' }),
        expect.anything(),
      ),
    );
    expect((await screen.findAllByText(/zzz/)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Clear Search' }));
    await waitFor(() =>
      expect(listItems).toHaveBeenLastCalledWith(
        { app: 'liveplanner', view: 'recent', limit: 30 },
        expect.anything(),
      ),
    );
  });

  it('names each refusal of a range, and nothing to draw', async () => {
    listItems.mockResolvedValue({ items: [] });
    listSheets.mockResolvedValue(
      sheetList([
        { id: 'sheet0001', name: '', tabId: 't1', a1: 'A1:B3' },
        { id: 'sheet0002', name: 'Other', tabId: 't1', a1: 'C1:D9' },
      ]),
    );
    const linked = bar({ shape: 'pie-chart', chartSheetSource: sourceOf() });
    for (const [err, words] of [
      [new IndexError(409, 'range_gone'), 'That range is outside the sheet.'],
      [new IndexError(404, 'not_found'), 'This sheet cannot be opened any more.'],
      [
        new IndexError(503, 'source_unavailable'),
        "Couldn't read the sheet. Try again in a moment.",
      ],
      [new TypeError('offline'), "Couldn't read the sheet. Try again in a moment."],
    ] as const) {
      readSheetRange.mockRejectedValueOnce(err);
      open(linked);
      expect(await screen.findByText(words)).toBeTruthy();
      expect(screen.getByText(/labels each slice/)).toBeTruthy();
      cleanup();
    }
    readSheetRange.mockResolvedValue({ ...read, table: { categories: [], series: [] } });
    open(bar({ shape: 'line-chart', chartSheetSource: sourceOf() }));
    expect(await screen.findByText(/Nothing to draw in this range/)).toBeTruthy();
    expect(screen.getByText(/labels each point/)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Update Link' }).disabled).toBe(
      true,
    );
    // The sheet picked before is kept with its range; picking another takes that one's filled cells.
    expect(screen.getByLabelText<HTMLInputElement>('Range').value).toBe('A1:B3');
    fireEvent.click(screen.getByRole('button', { name: /Other/ }));
    expect(screen.getByLabelText<HTMLInputElement>('Range').value).toBe('C1:D9');
    fireEvent.change(screen.getByLabelText('Range'), { target: { value: 'b2:c4' } });
    expect(screen.getByLabelText<HTMLInputElement>('Range').value).toBe('B2:C4');
  });

  it('previews six rows and counts the rest, and links with the preview when the second read fails', async () => {
    listItems.mockResolvedValue({ items: [] });
    listSheets.mockResolvedValue(
      sheetList([{ id: 'sheet0001', name: 'Costs', tabId: 't1', a1: 'A1:B9' }]),
    );
    const long: SheetRangeRead = {
      ...read,
      table: {
        categories: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
        series: [{ name: 'Sales', values: [1, 2, 3, 4, 5] }],
      },
    };
    readSheetRange.mockResolvedValueOnce(long).mockRejectedValueOnce(new TypeError('offline'));
    const onLink = vi.fn();
    render(
      <LinkSheetDialog
        chart={bar({ chartSheetSource: sourceOf() })}
        itemId="doc_1"
        grantOf={grantOf}
        noun="document"
        onLink={onLink}
        onClose={() => {}}
      />,
    );
    expect(await screen.findByText('and 2 more rows')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Update Link' }));
    await waitFor(() => expect(onLink).toHaveBeenCalledTimes(1));
    expect(onLink.mock.calls[0]![1]).toBe(long);
    cleanup();
    readSheetRange.mockResolvedValueOnce({
      ...long,
      table: { ...long.table, categories: long.table.categories.slice(0, 7) },
    });
    open(bar({ chartSheetSource: sourceOf() }));
    expect(await screen.findByText('and 1 more row')).toBeTruthy();
  });

  it('drops the answers of reads left behind when it closes', async () => {
    const hang = (_ask: unknown, ...rest: unknown[]) => {
      const { signal } = rest.at(-1) as { signal: AbortSignal };
      return new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted'))),
      );
    };
    listItems.mockImplementation(hang);
    listSheets.mockImplementation(hang);
    readSheetRange.mockImplementation((_id: unknown, ...rest: unknown[]) => hang(null, ...rest));
    const view = open(bar({ chartSheetSource: sourceOf() }));
    await waitFor(() => expect(readSheetRange).toHaveBeenCalled());
    view.unmount();
    await new Promise((r) => setTimeout(r, 0));
    expect(listItems).toHaveBeenCalledTimes(1);
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
    keepNumbers: vi.fn(),
    ...over,
  });
  const onClose = vi.fn();
  const show = (value: SheetLinks, chart: SheetChart) =>
    render(
      <SheetLinksContext.Provider value={value}>
        <SheetLinkSection chart={chart} rows={<p>rows</p>} onClose={onClose} />
      </SheetLinksContext.Provider>,
    );

  it('offers an Editor Link to Sheet under the rows, closing the menu, and a Viewer only the rows', () => {
    const editor = links();
    onClose.mockClear();
    show(editor, bar());
    expect(screen.getByText('rows')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Link to Sheet…' }));
    expect(editor.openLink).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
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

  it('says a first read is on its way, with Update off, and names an unnamed sheet', () => {
    show(
      links({ statusOf: () => ({ kind: 'reading' }) }),
      bar({ chartSheetSource: { ...sourceOf(), sheetName: '' } }),
    );
    expect(screen.getByText('Reading the sheet…')).toBeTruthy();
    expect(screen.getByText(/^Sheet ·/)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Update' }).disabled).toBe(true);
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

  it('gives an Editor who cannot open the plan Change and Unlink, but no Update', () => {
    act(() => {
      show(links({ statusOf: () => ({ kind: 'saved' }) }), bar({ chartSheetSource: sourceOf() }));
    });
    expect(screen.getByText(/a sheet you can't open, as last saved/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Change…' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unlink' })).toBeTruthy();
  });

  it('says a chart not linked yet holds sample numbers, with Link to Sheet and Use These Numbers for an Editor', () => {
    const editor = links();
    onClose.mockClear();
    const chart = bar({ chartSheetPending: true });
    show(editor, chart);
    expect(screen.getByText('Not linked to a sheet yet')).toBeTruthy();
    expect(screen.getByText('Sample numbers, meant to come from a sheet.')).toBeTruthy();
    // The rows stay, editable as ever; the dashed Link to Sheet under them gives way to the note's.
    expect(screen.getByText('rows')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Link to Sheet…' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Link to Sheet…' }));
    expect(editor.openLink).toHaveBeenCalledWith(chart.id);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Use These Numbers' }));
    expect(editor.keepNumbers).toHaveBeenCalledWith(chart.id);
    cleanup();
    // A Participant or Viewer reads the note, with no actions.
    show(links({ canEdit: false }), chart);
    expect(screen.getByText('Not linked to a sheet yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Link to Sheet…' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Use These Numbers' })).toBeNull();
  });

  it('draws the rows alone outside an editor', () => {
    render(
      <SheetLinkSection
        chart={bar({ chartSheetSource: sourceOf() })}
        rows={<p>rows</p>}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('rows')).toBeTruthy();
  });
});
