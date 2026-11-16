// @vitest-environment jsdom
// Charts linked to a liveplanner sheet on the canvas (docs/specs/009-elements/pie-chart.md "Charts linked to a
// liveplanner sheet"): the host reads, draws a live read over the saved values, links in one undo step, unlinks
// keeping the values, opens Link to Sheet for an Editor only; the Linked to line; nothing outside an editor.
import { useEffect } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createShape,
  type ChartSheetSource,
  type Element,
  type ShapeElement,
} from '@livedocuments/document';
import type { SheetRangeRead } from '@liveworkspace/index-client';

const { readSheetRange, track } = vi.hoisted(() => ({ readSheetRange: vi.fn(), track: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({ indexClient: { readSheetRange } }));
vi.mock('@/lib/api/document-grants', () => ({ documentGrant: async () => null }));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('next/dynamic', () => ({
  default: () =>
    function LinkSheetDialogStub({ chart }: { chart: ShapeElement }) {
      return <p>dialog for {chart.id}</p>;
    },
}));

import {
  SheetLinkLine,
  SheetLinksHost,
  useChartAsSeen,
  useSheetLinks,
  type SheetLinks,
} from './SheetLinkedCharts';

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
const chart: ShapeElement = {
  ...createShape('bar-chart', 0, 0),
  id: 'c1',
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
  const seen = useChartAsSeen(element) as ShapeElement;
  return (
    <div>
      <p data-testid="values">{seen.pieSlices?.map((s) => s.value).join(',')}</p>
      <SheetLinkLine element={element} selected />
    </div>
  );
}

function arrange(canEdit: boolean) {
  let els: Element[] = [chart];
  const commit = vi.fn((map: (e: Element[]) => Element[]) => {
    els = map(els);
  });
  const tick = vi.fn();
  const view = render(
    <SheetLinksHost elements={els} documentId="doc_1" canEdit={canEdit} commit={commit} tick={tick}>
      <Probe element={chart} />
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
    const { commit, els } = arrange(true);
    act(() => api!.unlink('c1'));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(els()[0]).not.toHaveProperty('chartSheetSource');
    expect((els()[0] as ShapeElement).pieSlices).toEqual(chart.pieSlices);
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'ChartSheetUnlink');
  });

  it('opens Link to Sheet for an Editor only', () => {
    readSheetRange.mockResolvedValue(read);
    arrange(true);
    act(() => api!.openLink('c1'));
    expect(screen.getByText('dialog for c1')).toBeTruthy();
    cleanup();
    arrange(false);
    act(() => api!.openLink('c1'));
    expect(screen.queryByText('dialog for c1')).toBeNull();
  });
});

describe('outside an editor', () => {
  it('draws the saved values and no line', () => {
    render(<Probe element={chart} />);
    expect(screen.getByTestId('values').textContent).toBe('1,2');
    expect(screen.queryByText('Budget')).toBeNull();
  });
});
