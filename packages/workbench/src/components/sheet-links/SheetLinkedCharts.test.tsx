// @vitest-environment jsdom
// Charts linked to a liveplanner sheet on the canvas (each reader app's docs/specs/009-elements/pie-chart.md "Charts
// linked to a liveplanner sheet"): the host reads, draws a live read over the saved values, links in one undo step, unlinks
// keeping the values, opens Link to Sheet for an Editor only; the Linked to line; nothing outside an editor.
import { useEffect } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChartSheetSource } from '@liveworkspace/element-model/chart-sheet-source';
import type { SheetRangeRead } from '@liveworkspace/index-client';
import type { SheetChart, SheetLinkStatus } from './sheet-links';

const { readSheetRange, onTrack } = vi.hoisted(() => ({
  readSheetRange: vi.fn(),
  onTrack: vi.fn(),
}));
vi.mock('../../lib/index-client', () => ({ indexClient: { readSheetRange } }));
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
      <SheetLinkLine element={element} selected />
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
