// @vitest-environment jsdom
// Charts and tables with live data on the canvas (each reader app's docs/specs/009-elements/pie-chart.md "Live data
// from a plan", liveworkspace/docs/specs/004-index/live-data.md): the host reads, draws a live read over the saved
// values, links in one undo step, unlinks keeping the values, freezes and unfreezes, opens From a Plan for an Editor
// only; the live line and mark; nothing outside an editor.
import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChartSheetSource } from '@liveworkspace/element-model/chart-sheet-source';
import type { SheetRangeRead } from '@liveworkspace/index-client';
import type { SheetChart, SheetLinkStatus } from './sheet-links';

const { readSheetRange, readPlanData, onTrack } = vi.hoisted(() => ({
  readSheetRange: vi.fn(),
  readPlanData: vi.fn(),
  onTrack: vi.fn(),
}));
vi.mock('../../lib/index-client', () => ({ indexClient: { readSheetRange, readPlanData } }));
const linkRead = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('./LinkSheetDialog', () => ({
  LinkSheetDialog({
    chart,
    noun,
    onLink,
    onClose,
  }: {
    chart: SheetChart;
    noun: string;
    onLink: (source: unknown, read: unknown) => void;
    onClose: () => void;
  }) {
    return (
      <div>
        <p>
          dialog for {chart.id} in the {noun}
        </p>
        <button type="button" onClick={() => onLink(linkSource, linkRead.current)}>
          stub link
        </button>
        <button type="button" onClick={onClose}>
          stub close
        </button>
      </div>
    );
  },
}));

import {
  SheetLinkLine,
  SheetLinksContext,
  SheetLinksHost,
  LiveTableFace,
  linkEventOf,
  useChartAsSeen,
  useSheetLinks,
  type SheetLinks,
} from './SheetLinkedCharts';

type Element = SheetChart | { id: string; type: 'arrow' };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const source: ChartSheetSource = {
  app: 'liveplanner',
  itemId: 'plan_1',
  sheetId: 'sheet0001',
  range: { r1: 'r001', c1: 'c001', r2: 'r003', c2: 'c002' },
  itemName: 'Budget',
  sheetName: 'Costs',
  a1: 'A1:B3',
  readAt: 1,
};
const read: SheetRangeRead = {
  itemId: 'plan_1',
  itemName: 'Budget',
  sheetId: 'sheet0001',
  sheetName: 'Costs',
  tabId: 't1',
  range: source.range,
  a1: 'A1:B3',
  table: { categories: ['Q1', 'Q2'], series: [{ name: 'Sales', values: [10, 20] }] },
  readAt: Date.now(),
};
const linkSource: ChartSheetSource = { ...source, sheetId: 'sheet0002' };
const chart: SheetChart = {
  id: 'c1',
  type: 'shape',
  shape: 'bar-chart',
  pieSlices: [
    { label: 'Q1', value: 1 },
    { label: 'Q2', value: 2 },
  ],
  chartSheetSource: source,
};

let api: SheetLinks | null = null;
function Probe({ element }: { element: Element }) {
  const links = useSheetLinks();
  useEffect(() => {
    api = links;
  });
  const seen = useChartAsSeen(element) as SheetChart;
  return (
    <div>
      <p data-testid="values">{seen.pieSlices?.map((s) => s.value).join(',')}</p>
      <SheetLinkLine element={element} selected={false} />
    </div>
  );
}

function arrange(canEdit: boolean, start: Element[] = [chart]) {
  let els: Element[] = start;
  const commit = vi.fn((map: (e: Element[]) => Element[]) => {
    els = map(els);
  });
  const tick = vi.fn();
  const view = render(
    <SheetLinksHost
      elements={els}
      itemId="doc_1"
      canEdit={canEdit}
      commit={commit}
      tick={tick}
      grantOf={async () => null}
      ready
      onTrack={onTrack}
      noun="design"
    >
      <Probe element={els[0]!} />
    </SheetLinksHost>,
  );
  return { view, commit, tick, els: () => els };
}

describe('SheetLinksHost', () => {
  it('draws the live read over the saved values, and the Linked to line', async () => {
    readSheetRange.mockResolvedValue(read);
    arrange(false);
    expect(screen.getByTestId('values').textContent).toBe('1,2');
    await waitFor(() => expect(screen.getByTestId('values').textContent).toBe('10,20'));
    expect(screen.getByText('Budget')).toBeTruthy();
    expect(screen.getByText('updated just now')).toBeTruthy();
    expect(screen.getByText(/Live from/)).toBeTruthy();
    // The live mark: green while the numbers are live.
    expect(document.querySelector('[data-live-mark]')!.getAttribute('data-live-mark')).toBe('live');
    // Counter-scaled to the canvas zoom (1 outside a canvas), so it reads at one size on screen.
    const line = document.querySelector<HTMLElement>('[data-sheet-link-line]')!;
    expect(line.style.transform).toBe('scale(1)');
  });

  it('unlinks keeping the values, in one commit, and says so', async () => {
    readSheetRange.mockResolvedValue(read);
    const { commit, els } = arrange(true, [chart, { id: 'arrow', type: 'arrow' }]);
    act(() => api!.unlink('c1'));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(els()[0]).not.toHaveProperty('chartSheetSource');
    expect((els()[0] as SheetChart).pieSlices).toEqual(chart.pieSlices);
    expect(onTrack).toHaveBeenCalledWith('ChartSheetUnlink');
    // Another element, or one with no link, is left as it is.
    act(() => api!.unlink('arrow'));
    expect(els()[1]).toEqual({ id: 'arrow', type: 'arrow' });
  });

  it('opens Link to Sheet for an Editor only, in its product words', async () => {
    readSheetRange.mockResolvedValue(read);
    arrange(true);
    act(() => api!.openLink('c1'));
    expect(await screen.findByText('dialog for c1 in the design')).toBeTruthy();
    act(() => screen.getByRole('button', { name: 'stub close' }).click());
    expect(screen.queryByText('dialog for c1 in the design')).toBeNull();
    cleanup();
    arrange(false);
    act(() => api!.openLink('c1'));
    expect(screen.queryByText(/dialog for c1/)).toBeNull();
    cleanup();
    arrange(true, [{ id: 'arrow', type: 'arrow' }]);
    act(() => api!.openLink('arrow'));
    expect(screen.queryByText(/dialog for/)).toBeNull();
  });

  it('links in one commit with the read values, says so, and keeps the read as the first', async () => {
    readSheetRange.mockResolvedValue(read);
    const { chartSheetSource: _linked, ...unlinked } = chart;
    const { commit, els } = arrange(true, [unlinked, { id: 'arrow', type: 'arrow' }]);
    linkRead.current = { ...read, sheetId: 'sheet0002' };
    act(() => api!.openLink('c1'));
    act(() => screen.getByRole('button', { name: 'stub link' }).click());
    await waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    expect((els()[0] as SheetChart).pieSlices?.map((s) => s.value)).toEqual([10, 20]);
    expect((els()[0] as SheetChart).chartSheetSource).toEqual(linkSource);
    expect(els()[1]).toEqual({ id: 'arrow', type: 'arrow' });
    expect(onTrack).toHaveBeenCalledWith('ChartSheetLink');
    expect(api!.statusOf(linkSource).kind).toBe('live');
    expect(screen.queryByText(/dialog for/)).toBeNull();
  });
});

describe('a chart not linked to a sheet yet', () => {
  const { chartSheetSource: _linked, ...plain } = chart;
  const pending: SheetChart = { ...plain, chartSheetPending: true };

  it('links in one commit that drops the mark', async () => {
    readSheetRange.mockResolvedValue(read);
    const { commit, els } = arrange(true, [pending]);
    linkRead.current = { ...read, sheetId: 'sheet0002' };
    act(() => api!.openLink('c1'));
    act(() => screen.getByRole('button', { name: 'stub link' }).click());
    await waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    expect(els()[0]).not.toHaveProperty('chartSheetPending');
    expect((els()[0] as SheetChart).chartSheetSource).toEqual(linkSource);
  });

  it('keeps its numbers as its own in one commit, leaving other elements as they are', () => {
    const { commit, els } = arrange(true, [pending, plain, { id: 'arrow', type: 'arrow' }]);
    act(() => api!.keepNumbers('c1'));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(els()[0]).toEqual(plain);
    act(() => api!.keepNumbers('arrow'));
    expect(els()[2]).toEqual({ id: 'arrow', type: 'arrow' });
    // One with no mark is the same element.
    const before = els()[1];
    act(() => api!.keepNumbers(plain.id));
    expect(els()[1]).toEqual(before);
  });
});

describe('SheetLinkLine', () => {
  const show = (status: SheetLinkStatus, element: Element, selected: boolean) =>
    render(
      <SheetLinksContext.Provider
        value={{
          statusOf: () => status,
          canEdit: false,
          openLink: () => {},
          update: () => {},
          unlink: () => {},
          keepNumbers: () => {},
          freeze: () => {},
          unfreeze: () => {},
          planHref: () => '',
        }}
      >
        <SheetLinkLine element={element} selected={selected} />
      </SheetLinksContext.Provider>,
    );

  it('shows only on hover until selected, and warns when the range is gone', () => {
    show({ kind: 'gone' }, chart, false);
    const line = document.querySelector<HTMLElement>('[data-sheet-link-line]')!;
    expect(line.className).toContain('opacity-0');
    expect(screen.getByText('The linked range is gone').className).toContain('text-amber-700');
    // The live mark shows unselected, in the line's tone.
    expect(document.querySelector('[data-live-mark]')!.getAttribute('data-live-mark')).toBe('warn');
  });

  it('hides the live mark while selected, where it would sit on the resize handle', () => {
    show({ kind: 'gone' }, chart, true);
    expect(document.querySelector('[data-live-mark]')).toBeNull();
    expect(document.querySelector<HTMLElement>('[data-sheet-link-line]')!.className).toContain(
      'opacity-100',
    );
  });

  it('slides left to stay on a phone screen when the element sits near its right edge', () => {
    const rect = (left: number, width: number, top: number, height: number) =>
      ({
        left,
        width,
        right: left + width,
        top,
        bottom: top + height,
        height,
        x: left,
        y: top,
      }) as DOMRect;
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        // The line hangs from the element's left edge, under it.
        return this.hasAttribute('data-sheet-link-line')
          ? rect(250, 240, 100, 16)
          : rect(250, 100, 0, 96);
      });
    const width = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    try {
      show({ kind: 'gone' }, chart, false);
      const line = document.querySelector<HTMLElement>('[data-sheet-link-line]')!;
      expect(line.style.transform).toBe('scale(1)');
      // Hovered: 250 + 240 runs past 390, so it ends 8px inside the right edge.
      fireEvent.pointerEnter(line.parentElement!);
      expect(line.style.transform).toBe('translate(-108px) scale(1)');
      expect(line.style.maxWidth).toMatch(/^min\(20rem, /);
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      spy.mockRestore();
    }
  });

  it('draws nothing for an element with no link', () => {
    show({ kind: 'saved' }, { id: 'arrow', type: 'arrow' }, true);
    expect(document.querySelector('[data-sheet-link-line]')).toBeNull();
  });
});

describe('outside an editor', () => {
  it('draws the saved values and no line', () => {
    render(<Probe element={chart} />);
    expect(screen.getByTestId('values').textContent).toBe('1,2');
    expect(screen.queryByText('Budget')).toBeNull();
  });
});

describe('Freeze and Unfreeze (live-data.md)', () => {
  it('freezes in one commit, keeping the numbers and reading nothing more', async () => {
    readSheetRange.mockResolvedValue(read);
    const { commit, els } = arrange(true, [chart, { id: 'arrow', type: 'arrow' }]);
    await waitFor(() => expect(readSheetRange).toHaveBeenCalledTimes(1));
    act(() => api!.freeze('c1'));
    expect(commit).toHaveBeenCalledTimes(1);
    expect((els()[0] as SheetChart).chartSheetSource).toEqual({ ...source, frozen: true });
    expect(onTrack).toHaveBeenCalledWith('LiveDataFreeze');
    expect(api!.statusOf({ ...source, frozen: true })).toEqual({ kind: 'frozen' });
    // Freezing again, or an element with no link, changes nothing.
    const before = els();
    act(() => api!.freeze('c1'));
    act(() => api!.freeze('arrow'));
    expect(els()[0]).toBe(before[0]);
    expect(els()[1]).toBe(before[1]);
  });

  it('a frozen chart is not read; Unfreeze drops the mark and reads again', async () => {
    readSheetRange.mockResolvedValue(read);
    const frozen: SheetChart = { ...chart, chartSheetSource: { ...source, frozen: true } };
    const { commit } = arrange(true, [frozen, { id: 'arrow', type: 'arrow' }]);
    await new Promise((r) => setTimeout(r, 0));
    expect(readSheetRange).not.toHaveBeenCalled();
    expect(screen.getByTestId('values').textContent).toBe('1,2');
    expect(screen.getByText(/frozen/)).toBeTruthy();
    // Unfreezing an element that is not frozen does nothing.
    act(() => api!.unfreeze('arrow'));
    expect(commit).not.toHaveBeenCalled();
    cleanup();
    const again = arrange(true, [frozen, { id: 'arrow', type: 'arrow' }]);
    act(() => api!.unfreeze('c1'));
    expect(again.commit).toHaveBeenCalledTimes(1);
    expect((again.els()[0] as SheetChart).chartSheetSource).toEqual(source);
    expect(onTrack).toHaveBeenCalledWith('LiveDataUnfreeze');
    await waitFor(() => expect(readSheetRange).toHaveBeenCalled());
  });

  it("saves a live read to the chart beside a frozen one, never the frozen one's", async () => {
    readSheetRange.mockResolvedValue(read);
    const frozen: SheetChart = { ...chart, chartSheetSource: { ...source, frozen: true } };
    const { tick } = arrange(true, [frozen, { ...chart, id: 'c2' }]);
    await waitFor(() => expect(tick).toHaveBeenCalledTimes(1));
    const map = tick.mock.calls[0]![0] as (els: Element[]) => Element[];
    const [a, b] = map([frozen, { ...chart, id: 'c2' }]) as SheetChart[];
    expect(a).toBe(frozen);
    expect(b!.pieSlices!.map((x) => x.value)).toEqual([10, 20]);
    expect(screen.getByText(/frozen/)).toBeTruthy();
  });

  it('opens the plan in liveplanner', () => {
    arrange(false, [{ id: 'arrow', type: 'arrow' }]);
    expect(api!.planHref(source)).toContain('plan_1');
  });
});

describe('linkEventOf', () => {
  const common = { app: 'liveplanner', itemId: 'plan_1', itemName: 'L', readAt: 1 } as const;
  const board: ChartSheetSource = {
    ...common,
    kind: 'board',
    boardId: 'tab_1',
    by: 'column',
    sourceName: 'R',
    label: 'Cards per column',
  };
  const metric: ChartSheetSource = {
    ...common,
    kind: 'metric',
    metric: 'completion',
    sourceName: 'Dashboard',
    label: 'Completion',
  };
  it('names a table link, and a chart link by its kind', () => {
    expect(linkEventOf({ id: 't', type: 'table', cells: [] }, board)).toBe('TableLiveLink');
    expect(linkEventOf(chart, board)).toBe('ChartBoardLink');
    expect(linkEventOf(chart, metric)).toBe('ChartMetricLink');
    expect(linkEventOf(chart, source)).toBe('ChartSheetLink');
  });

  it('reads a board link through the plan-data door, and sends its event on link', async () => {
    readPlanData.mockResolvedValue({
      itemId: 'plan_1',
      itemName: 'L',
      kind: 'board',
      sourceName: 'R',
      tabId: 'tab_1',
      label: 'Cards per column',
      table: { categories: ['Q1', 'Q2'], series: [{ name: 'Cards', values: [5, 6] }] },
      readAt: Date.now(),
    });
    arrange(false, [{ ...chart, chartSheetSource: { ...board, filter: { label: 'bug' } } }]);
    await waitFor(() => expect(screen.getByTestId('values').textContent).toBe('5,6'));
    expect(readPlanData).toHaveBeenCalledWith(
      'plan_1',
      { kind: 'board', boardId: 'tab_1', by: 'column', filter: { label: 'bug' } },
      expect.anything(),
    );
    cleanup();
    arrange(false, [{ ...chart, chartSheetSource: board }]);
    await waitFor(() =>
      expect(readPlanData).toHaveBeenCalledWith(
        'plan_1',
        { kind: 'board', boardId: 'tab_1', by: 'column' },
        expect.anything(),
      ),
    );
    cleanup();
    arrange(false, [{ ...chart, chartSheetSource: metric }]);
    await waitFor(() =>
      expect(readPlanData).toHaveBeenCalledWith(
        'plan_1',
        { kind: 'metric', metric: 'completion' },
        expect.anything(),
      ),
    );
  });
});

describe('LiveTableFace', () => {
  it("draws a linked table's live cells, read only, with its line; an unlinked one as stored", async () => {
    const board: ChartSheetSource = {
      app: 'liveplanner',
      itemId: 'plan_1',
      itemName: 'Launch',
      readAt: 1,
      kind: 'board',
      boardId: 'tab_1',
      by: 'column',
      sourceName: 'Roadmap',
      label: 'Cards per column',
    };
    readPlanData.mockResolvedValue({
      itemId: 'plan_1',
      itemName: 'Launch',
      kind: 'board',
      sourceName: 'Roadmap',
      tabId: 'tab_1',
      label: 'Cards per column',
      table: { categories: ['To Do'], series: [{ name: 'Cards', values: [3] }] },
      readAt: Date.now(),
    });
    const table = { id: 't1', type: 'table', cells: [['old']], chartSheetSource: board };
    const face = (el: typeof table | { id: string; type: 'table'; cells: string[][] }) => (
      <LiveTableFace element={el} selected>
        {(seen, linked) => (
          <p data-testid="cells">
            {(seen as { cells: string[][] }).cells.flat().join(',')}
            {linked ? ' (linked)' : ''}
          </p>
        )}
      </LiveTableFace>
    );
    render(
      <SheetLinksHost
        elements={[table]}
        itemId="doc_1"
        canEdit={false}
        commit={vi.fn()}
        tick={vi.fn()}
        grantOf={async () => null}
        ready
        onTrack={onTrack}
        noun="document"
      >
        {face(table)}
        {face({ id: 't2', type: 'table', cells: [['mine']] })}
      </SheetLinksHost>,
    );
    await waitFor(() =>
      expect(screen.getAllByTestId('cells')[0]!.textContent).toBe('Column,Cards,To Do,3 (linked)'),
    );
    expect(screen.getAllByTestId('cells')[1]!.textContent).toBe('mine');
    expect(screen.getByText('Launch')).toBeTruthy();
  });
});
