// @vitest-environment jsdom
// From a Plan (each reader app's docs/specs/009-elements/pie-chart.md "Live data from a plan", liveworkspace/docs/
// specs/004-index/live-data.md): the plan, then a Sheet range prefilled with its filled cells, a board's counts or a
// metric, a preview of the read and its series, and Link keeping the read with the link; and the menu's Data section,
// an Editor's From a Plan, Update, Freeze, Change and Unlink, anyone's Open Plan, a Viewer's status alone.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChartSheetSource } from '@liveworkspace/element-model/chart-sheet-source';
import {
  IndexError,
  type PlanDataListing,
  type PlanDataRead,
  type SheetRangeRead,
} from '@liveworkspace/index-client';
import type { Linkable, SheetChart } from './sheet-links';

const { listItems, listSheets, readSheetRange, listPlanData, readPlanData } = vi.hoisted(() => ({
  listItems: vi.fn(),
  listSheets: vi.fn(),
  readSheetRange: vi.fn(),
  listPlanData: vi.fn(),
  readPlanData: vi.fn(),
}));
vi.mock('../../lib/index-client', () => ({
  indexClient: { listItems, listSheets, readSheetRange, listPlanData, readPlanData },
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

  // Work Tracker 1212: a bar draws the first series alone, so its preview shows that one and says so; a line shows all.
  it('previews only the series the chart draws', async () => {
    listItems.mockResolvedValue({ items: [] });
    listSheets.mockResolvedValue({
      itemId: 'plan_1',
      itemName: 'Budget',
      sheets: [{ id: 'sheet0001', name: 'Costs', tabId: 't1', a1: 'A1:C3' }],
    });
    readSheetRange.mockResolvedValue({
      ...read,
      table: {
        categories: ['Q1', 'Q2'],
        series: [
          { name: 'Planned', values: [10, 20] },
          { name: 'Actual', values: [11, 21] },
        ],
      },
    });
    const view = (chart: SheetChart) =>
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
    view(bar({ chartSheetSource: sourceOf() }));
    expect(await screen.findByRole('columnheader', { name: 'Planned' })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Actual' })).toBeNull();
    expect(screen.getByText('A column chart draws the first series.')).toBeTruthy();
    cleanup();
    view(bar({ shape: 'pie-chart', chartSheetSource: sourceOf() }));
    expect(await screen.findByText('A pie chart draws the first series.')).toBeTruthy();
    cleanup();
    view(bar({ shape: 'line-chart', chartSheetSource: sourceOf() }));
    expect(await screen.findByRole('columnheader', { name: 'Actual' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Planned' })).toBeTruthy();
    expect(screen.queryByText(/draws the first series/)).toBeNull();
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
        chart={bar({ chartSheetSource: { ...sourceOf(), a1: 'nope' } as ChartSheetSource })}
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

const sourceOf = () =>
  ({
    app: 'liveplanner' as const,
    itemId: 'plan_1',
    sheetId: 'sheet0001',
    range: read.range,
    itemName: 'Budget',
    sheetName: 'Costs',
    a1: 'A1:B3',
    readAt: 5,
  }) satisfies ChartSheetSource;

describe('SheetLinkSection', () => {
  const links = (over: Partial<SheetLinks> = {}): SheetLinks => ({
    statusOf: () => ({ kind: 'live', read: { ...read, readAt: Date.now() } }),
    canEdit: true,
    openLink: vi.fn(),
    update: vi.fn(),
    unlink: vi.fn(),
    keepNumbers: vi.fn(),
    freeze: vi.fn(),
    unfreeze: vi.fn(),
    planHref: () => 'https://www.liveplanner.app/plan/?id=plan_1',
    ...over,
  });
  const onClose = vi.fn();
  const show = (value: SheetLinks, chart: Linkable) =>
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
    fireEvent.click(screen.getByRole('button', { name: 'From a Plan…' }));
    expect(editor.openLink).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    cleanup();
    show(links({ canEdit: false }), bar());
    expect(screen.queryByRole('button', { name: 'From a Plan…' })).toBeNull();
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
      bar({ chartSheetSource: { ...sourceOf(), sheetName: '' } as ChartSheetSource }),
    );
    expect(screen.getByText('Reading the plan…')).toBeTruthy();
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
    expect(screen.getByText(/a plan you can't open, as last saved/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Unlink' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
  });

  // Work Tracker 1212: a read of a range that is gone is refused again, so only Change… picks it anew.
  it('hides Update once the linked range is gone, keeping Change and Unlink', () => {
    act(() => {
      show(links({ statusOf: () => ({ kind: 'gone' }) }), bar({ chartSheetSource: sourceOf() }));
    });
    expect(screen.getByText('The linked range is gone')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Change…' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unlink' })).toBeTruthy();
  });

  it('gives an Editor who cannot open the plan Change and Unlink, but no Update', () => {
    act(() => {
      show(links({ statusOf: () => ({ kind: 'saved' }) }), bar({ chartSheetSource: sourceOf() }));
    });
    expect(screen.getByText(/a plan you can't open, as last saved/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Change…' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unlink' })).toBeTruthy();
  });

  it('says a chart not linked yet holds sample numbers, with Link to Sheet and Use These Numbers for an Editor', () => {
    const editor = links();
    onClose.mockClear();
    const chart = bar({ chartSheetPending: true });
    show(editor, chart);
    expect(screen.getByText('Not linked to a plan yet')).toBeTruthy();
    expect(screen.getByText('Sample numbers, meant to come from a plan.')).toBeTruthy();
    // The rows stay, editable as ever; the dashed Link to Sheet under them gives way to the note's.
    expect(screen.getByText('rows')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'From a Plan…' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'From a Plan…' }));
    expect(editor.openLink).toHaveBeenCalledWith(chart.id);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Use These Numbers' }));
    expect(editor.keepNumbers).toHaveBeenCalledWith(chart.id);
    cleanup();
    // A Participant or Viewer reads the note, with no actions.
    show(links({ canEdit: false }), chart);
    expect(screen.getByText('Not linked to a plan yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'From a Plan…' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Use These Numbers' })).toBeNull();
  });

  it('gives anyone Open Plan, and an Editor Freeze, which Unfreeze undoes', () => {
    const editor = links();
    const chart = bar({ chartSheetSource: sourceOf() });
    show(editor, chart);
    expect(screen.getByRole('link', { name: 'Open Plan' }).getAttribute('href')).toContain(
      'plan_1',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Freeze' }));
    expect(editor.freeze).toHaveBeenCalledWith(chart.id);
    cleanup();
    const frozen = bar({ chartSheetSource: { ...sourceOf(), frozen: true } });
    show(links({ statusOf: () => ({ kind: 'frozen' }) }), frozen);
    expect(screen.getByText(/^Frozen /)).toBeTruthy();
    expect(screen.getByText(/keeps these numbers until it is unfrozen/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Freeze' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Unfreeze' }));
    cleanup();
    // A Viewer opens the plan, and nothing more.
    show(links({ canEdit: false }), chart);
    expect(screen.getByRole('link', { name: 'Open Plan' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Freeze' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change…' })).toBeNull();
  });

  it("names a board's count, and a table in its words", () => {
    const board: ChartSheetSource = {
      app: 'liveplanner',
      itemId: 'plan_1',
      itemName: 'Launch',
      readAt: 5,
      kind: 'board',
      boardId: 'tab_1',
      by: 'label',
      sourceName: 'Roadmap',
      label: 'Cards per label',
    };
    show(links({ statusOf: () => ({ kind: 'saved' }) }), {
      id: 't1',
      type: 'table',
      cells: [['a']],
      chartSheetSource: board,
    });
    expect(screen.getByText(/^Roadmap ·/)).toBeTruthy();
    expect(screen.getByText('Cards per label')).toBeTruthy();
    cleanup();
    show(links(), { id: 't1', type: 'table', cells: [['a']], chartSheetSource: board });
    expect(screen.getByText(/keep this table in step/)).toBeTruthy();
  });

  it('tells a Viewer an unlinked table is not linked', () => {
    const table: Linkable = { id: 't1', type: 'table', cells: [['a']] };
    render(
      <SheetLinksContext.Provider value={links({ canEdit: false })}>
        <SheetLinkSection chart={table} rows={null} onClose={onClose} />
      </SheetLinksContext.Provider>,
    );
    expect(screen.getByText('Not linked to a plan.')).toBeTruthy();
    cleanup();
    // An Editor gets From a Plan.
    render(
      <SheetLinksContext.Provider value={links()}>
        <SheetLinkSection chart={table} rows={null} onClose={onClose} />
      </SheetLinksContext.Provider>,
    );
    expect(screen.getByRole('button', { name: 'From a Plan…' })).toBeTruthy();
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

describe('From a Plan: boards, metrics and series (live-data.md)', () => {
  const listing: PlanDataListing = {
    itemId: 'plan_1',
    itemName: 'Launch',
    boards: [
      { id: 'tab_1', name: 'Roadmap', tabId: 'tab_1' },
      { id: 'tab_2', name: 'Bugs', tabId: 'tab_2' },
    ],
    metrics: [
      { id: 'completion', label: 'Completion' },
      { id: 'workload', label: 'Workload' },
    ],
    filters: {
      priorities: [{ id: 'high', label: 'High' }],
      labels: ['bug'],
      people: [{ id: 'u1', name: 'Ada' }],
      types: [],
    },
  };
  const boardRead: PlanDataRead = {
    itemId: 'plan_1',
    itemName: 'Launch',
    kind: 'board',
    sourceName: 'Roadmap',
    tabId: 'tab_1',
    label: 'Cards per column',
    table: {
      categories: ['To Do', 'Done'],
      series: [
        { name: 'Cards', values: [3, 4] },
        { name: 'Points', values: [5, 9] },
      ],
    },
    readAt: 8,
  };
  const view = (chart: Linkable, onLink = vi.fn()) => {
    render(
      <LinkSheetDialog
        chart={chart}
        itemId="doc_1"
        grantOf={grantOf}
        noun="canvas"
        onLink={onLink}
        onClose={() => {}}
      />,
    );
    return onLink;
  };
  const start = () => {
    listItems.mockResolvedValue({ items: [{ id: 'plan_1', title: 'Launch' }] });
    listSheets.mockResolvedValue({ itemId: 'plan_1', itemName: 'Launch', sheets: [] });
    listPlanData.mockResolvedValue(listing);
    readPlanData.mockResolvedValue(boardRead);
  };

  it("counts a board's cards, filtered, and links a line to the series picked", async () => {
    start();
    const onLink = view({ id: 'c1', type: 'shape', shape: 'line-chart' });
    fireEvent.click(await screen.findByRole('button', { name: 'Launch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Board Counts' }));
    expect(await screen.findByRole('button', { name: 'Roadmap' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Bugs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Priority' }));
    fireEvent.change(screen.getByLabelText('Only cards with this label'), {
      target: { value: 'bug' },
    });
    // The card type filter has nothing to pick.
    expect(
      screen.getByLabelText<HTMLSelectElement>('Only cards with this card type').disabled,
    ).toBe(true);
    await waitFor(() =>
      expect(readPlanData).toHaveBeenLastCalledWith(
        'plan_1',
        { kind: 'board', boardId: 'tab_2', by: 'priority', filter: { label: 'bug' } },
        expect.anything(),
      ),
    );
    expect(await screen.findByRole('columnheader', { name: 'Points' })).toBeTruthy();
    // Take Cards out: Points alone feeds the line.
    fireEvent.click(screen.getByRole('button', { name: /Cards/ }));
    expect(screen.queryByRole('columnheader', { name: 'Cards' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    await waitFor(() => expect(onLink).toHaveBeenCalledTimes(1));
    expect(onLink.mock.calls[0]![0]).toEqual({
      app: 'liveplanner',
      itemId: 'plan_1',
      itemName: 'Launch',
      readAt: 8,
      series: [1],
      kind: 'board',
      boardId: 'tab_2',
      by: 'priority',
      filter: { label: 'bug' },
      sourceName: 'Roadmap',
      label: 'Cards per column',
    });
  });

  it('links a table to a metric, its first one picked by default', async () => {
    start();
    readPlanData.mockResolvedValue({
      ...boardRead,
      kind: 'metric',
      sourceName: 'Dashboard',
      label: 'Workload',
      table: { categories: ['Ada'], series: [{ name: 'Cards', values: [2] }] },
    });
    const onLink = view({ id: 't1', type: 'table', cells: [['a']] });
    expect(screen.getByText(/keep this table in step/i)).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Launch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard Metric' }));
    await waitFor(() =>
      expect(readPlanData).toHaveBeenLastCalledWith(
        'plan_1',
        { kind: 'metric', metric: 'completion' },
        expect.anything(),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Workload' }));
    await waitFor(() =>
      expect(readPlanData).toHaveBeenLastCalledWith(
        'plan_1',
        { kind: 'metric', metric: 'workload' },
        expect.anything(),
      ),
    );
    expect(await screen.findByRole('cell', { name: 'Ada' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    await waitFor(() => expect(onLink).toHaveBeenCalledTimes(1));
    expect(onLink.mock.calls[0]![0]).toMatchObject({ kind: 'metric', metric: 'workload' });
  });

  it('says when a plan has no boards, could not be listed, or a metric is gone', async () => {
    start();
    listPlanData.mockResolvedValue({ ...listing, boards: [] });
    view(bar());
    fireEvent.click(await screen.findByRole('button', { name: 'Launch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Board Counts' }));
    expect(await screen.findByText('No boards in this plan')).toBeTruthy();
    expect(screen.getByText(/Pick a plan and a board/)).toBeTruthy();
    cleanup();
    listPlanData.mockRejectedValue(new IndexError(404, 'not_found'));
    view(bar());
    fireEvent.click(await screen.findByRole('button', { name: 'Launch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard Metric' }));
    expect(await screen.findByText("Couldn't open this plan")).toBeTruthy();
    cleanup();
    listPlanData.mockResolvedValue(listing);
    readPlanData.mockRejectedValue(new IndexError(404, 'not_found'));
    view(bar());
    fireEvent.click(await screen.findByRole('button', { name: 'Launch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard Metric' }));
    expect(await screen.findByText('This metric cannot be read any more.')).toBeTruthy();
    cleanup();
    readPlanData.mockRejectedValue(new TypeError('offline'));
    view(bar());
    fireEvent.click(await screen.findByRole('button', { name: 'Launch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard Metric' }));
    expect(await screen.findByText("Couldn't read the plan. Try again in a moment.")).toBeTruthy();
  });

  it('opens on the link it changes, and a bar takes one series at a time', async () => {
    start();
    const onLink = view(
      bar({
        chartSheetSource: {
          app: 'liveplanner',
          itemId: 'plan_1',
          itemName: 'Launch',
          readAt: 1,
          kind: 'board',
          boardId: 'tab_1',
          by: 'column',
          filter: { priority: 'high' },
          sourceName: 'Roadmap',
          label: 'Cards per column',
        },
      }),
    );
    expect(await screen.findByRole('columnheader', { name: 'Cards' })).toBeTruthy();
    expect(screen.getByLabelText<HTMLSelectElement>('Only cards with this priority').value).toBe(
      'high',
    );
    expect(screen.getByText(/draws one series/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Points/ }));
    expect(await screen.findByRole('columnheader', { name: 'Points' })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Cards' })).toBeNull();
    // Back to the first: no series named.
    fireEvent.click(screen.getByRole('button', { name: /Cards/ }));
    fireEvent.click(screen.getByRole('button', { name: /Points/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Update Link' }));
    await waitFor(() => expect(onLink).toHaveBeenCalledTimes(1));
    expect(onLink.mock.calls[0]![0]).toMatchObject({ series: [1] });
  });

  it('opens on a metric link, or a board link with no filter, and says when nothing can be counted', async () => {
    start();
    listPlanData.mockResolvedValue({ ...listing, metrics: [] });
    const common = { app: 'liveplanner', itemId: 'plan_1', itemName: 'Launch', readAt: 1 } as const;
    view(
      bar({
        chartSheetSource: {
          ...common,
          kind: 'metric',
          metric: 'workload',
          sourceName: 'Dashboard',
          label: 'Workload',
        },
      }),
    );
    expect(await screen.findByText('No metrics in this plan')).toBeTruthy();
    cleanup();
    listPlanData.mockResolvedValue(listing);
    readPlanData.mockResolvedValue({ ...boardRead, table: { categories: [], series: [] } });
    view(
      bar({
        chartSheetSource: {
          ...common,
          kind: 'board',
          boardId: 'tab_1',
          by: 'label',
          sourceName: 'Roadmap',
          label: 'Cards per label',
        },
      }),
    );
    expect(await screen.findByText(/No cards to count here yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Label', pressed: true })).toBeTruthy();
    // A filter picked and then cleared again asks with none.
    fireEvent.change(screen.getByLabelText('Only cards with this assignee'), {
      target: { value: 'u1' },
    });
    fireEvent.change(screen.getByLabelText('Only cards with this assignee'), {
      target: { value: '' },
    });
    await waitFor(() =>
      expect(readPlanData).toHaveBeenLastCalledWith(
        'plan_1',
        { kind: 'board', boardId: 'tab_1', by: 'label' },
        expect.anything(),
      ),
    );
  });

  it('names an unnamed board and every card type, says a gone board is gone, and asks for a plan first', async () => {
    start();
    listItems.mockResolvedValue({ items: [] });
    view({ id: 't1', type: 'table', cells: [['a']] });
    expect(await screen.findByText(/then take this table's numbers from it/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Board Counts' }));
    expect(screen.getByText('Pick a plan first.')).toBeTruthy();
    cleanup();
    start();
    listPlanData.mockResolvedValue({
      ...listing,
      boards: [{ id: 'tab_1', name: '', tabId: 'tab_1' }],
      filters: { ...listing.filters, types: [{ id: 'bug', label: 'Bug' }] },
    });
    readPlanData.mockRejectedValue(new IndexError(404, 'not_found'));
    view(bar());
    fireEvent.click(await screen.findByRole('button', { name: 'Launch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Board Counts' }));
    expect(await screen.findByRole('button', { name: 'Board' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Bug' })).toBeTruthy();
    expect(await screen.findByText('This board cannot be read any more.')).toBeTruthy();
  });

  it('drops a plan listing that comes back after the dialog closed', async () => {
    start();
    let fail: (e: Error) => void = () => {};
    listPlanData.mockImplementation(
      (_id: unknown, { signal }: { signal: AbortSignal }) =>
        new Promise((_r, reject) => {
          fail = reject;
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    view(bar());
    fireEvent.click(await screen.findByRole('button', { name: 'Launch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Board Counts' }));
    await waitFor(() => expect(listPlanData).toHaveBeenCalled());
    cleanup();
    fail(new Error('late'));
    await new Promise((r) => setTimeout(r, 0));
  });
});
