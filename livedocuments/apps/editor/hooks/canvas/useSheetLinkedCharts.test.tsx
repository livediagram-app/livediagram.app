// @vitest-environment jsdom
// Charts linked to a liveplanner sheet (docs/specs/009-elements/pie-chart.md "Charts linked to a liveplanner
// sheet"): each range read once on open, read again on the room's frame for its Sheet and never otherwise, a reader
// without access left on the saved values, and an Editor's live values saved quietly once.
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createShape,
  type ChartSheetSource,
  type Element,
  type ShapeElement,
} from '@livedocuments/document';
import { IndexError, type SheetRangeRead } from '@liveworkspace/index-client';

const { readSheetRange, documentGrant } = vi.hoisted(() => ({
  readSheetRange: vi.fn(),
  documentGrant: vi.fn(),
}));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({ indexClient: { readSheetRange } }));
vi.mock('@/lib/api/document-grants', () => ({ documentGrant }));

import { emitSourceChanged } from '@/lib/sheet-link-signal';
import type { SheetLinkStatus } from '@/lib/sheet-links';
import { readSheetLink, useSheetLinkedCharts } from './useSheetLinkedCharts';

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
const readOf = (values: number[]): SheetRangeRead => ({
  itemId: 'plan_1',
  itemName: 'Budget',
  sheetId: 'sheet0001',
  sheetName: 'Costs',
  tabId: 't1',
  range: source.range,
  a1: 'A1:B3',
  table: { categories: ['Q1', 'Q2'], series: [{ name: 'Sales', values }] },
  readAt: 5,
});
const chart = (id: string): ShapeElement => ({
  ...createShape('bar-chart', 0, 0),
  id,
  pieSlices: [
    { label: 'Q1', value: 1 },
    { label: 'Q2', value: 2 },
  ],
  chartSheetSource: source,
});

afterEach(() => vi.clearAllMocks());

describe('readSheetLink', () => {
  it("reads with the document's grant, asking to watch, and maps each refusal", async () => {
    documentGrant.mockResolvedValue({ grant: 'G' });
    readSheetRange.mockResolvedValueOnce(readOf([1, 2]));
    expect(await readSheetLink(source, 'doc_1')).toEqual({ kind: 'live', read: readOf([1, 2]) });
    expect(readSheetRange).toHaveBeenCalledWith(
      'plan_1',
      { sheetId: 'sheet0001', range: source.range },
      { grant: 'G', watch: 'doc_1' },
    );
    readSheetRange.mockRejectedValueOnce(new IndexError(404, 'not_found'));
    expect(await readSheetLink(source, 'doc_1')).toEqual({ kind: 'saved' });
    readSheetRange.mockRejectedValueOnce(new IndexError(409, 'range_gone'));
    expect(await readSheetLink(source, 'doc_1')).toEqual({ kind: 'gone' });
    readSheetRange.mockRejectedValueOnce(new TypeError('offline'));
    expect(await readSheetLink(source, 'doc_1')).toEqual({ kind: 'failed' });
  });

  it('reads without a watch when there is no grant', async () => {
    documentGrant.mockRejectedValue(new Error('no'));
    readSheetRange.mockResolvedValueOnce(readOf([1, 2]));
    await readSheetLink({ ...source, cols: ['c001', 'c002'] }, null);
    expect(readSheetRange).toHaveBeenCalledWith(
      'plan_1',
      { sheetId: 'sheet0001', range: source.range, cols: ['c001', 'c002'] },
      { grant: null, watch: null },
    );
  });
});

describe('useSheetLinkedCharts', () => {
  const arrange = (
    canSave: boolean,
    read = vi.fn(async (): Promise<SheetLinkStatus> => ({ kind: 'live', read: readOf([3, 4]) })),
  ) => {
    let els: Element[] = [chart('a'), chart('b')];
    const tick = vi.fn((map: (e: Element[]) => Element[]) => {
      els = map(els);
    });
    const hook = renderHook(
      ({ elements }) =>
        useSheetLinkedCharts({ elements, documentId: 'doc_1', canSave, tick, read }),
      { initialProps: { elements: els } },
    );
    return { hook, read, tick, els: () => els };
  };

  it('reads each range once on open, shows reading meanwhile, and the live read after', async () => {
    const { hook, read } = arrange(false);
    expect(hook.result.current.statusOf(source)).toEqual({ kind: 'reading' });
    await waitFor(() => expect(hook.result.current.statusOf(source).kind).toBe('live'));
    expect(read).toHaveBeenCalledTimes(1);
    hook.rerender({ elements: [chart('a'), chart('b')] });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("reads again on the room's frame for its Sheet only", async () => {
    const { hook, read } = arrange(false);
    await waitFor(() => expect(hook.result.current.statusOf(source).kind).toBe('live'));
    act(() => emitSourceChanged({ app: 'liveplanner', itemId: 'plan_1', sheetIds: ['other'] }));
    act(() => emitSourceChanged({ app: 'liveplanner', itemId: 'plan_2', sheetIds: ['sheet0001'] }));
    expect(read).toHaveBeenCalledTimes(1);
    act(() => emitSourceChanged({ app: 'liveplanner', itemId: 'plan_1', sheetIds: ['sheet0001'] }));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    hook.unmount();
  });

  it('reads once more after a read that a second frame landed during', async () => {
    let finish: (s: SheetLinkStatus) => void = () => {};
    const read = vi.fn(
      () =>
        new Promise<SheetLinkStatus>((resolve) => {
          finish = resolve;
        }),
    );
    const { hook } = arrange(false, read);
    act(() => emitSourceChanged({ app: 'liveplanner', itemId: 'plan_1', sheetIds: ['sheet0001'] }));
    act(() => emitSourceChanged({ app: 'liveplanner', itemId: 'plan_1', sheetIds: ['sheet0001'] }));
    expect(read).toHaveBeenCalledTimes(1);
    await act(async () => finish({ kind: 'live', read: readOf([7, 8]) }));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    await act(async () => finish({ kind: 'live', read: readOf([7, 8]) }));
    expect(read).toHaveBeenCalledTimes(2);
    hook.unmount();
  });

  it("saves an Editor's live values quietly, once for every chart", async () => {
    const { hook, tick, els } = arrange(true);
    await waitFor(() => expect(tick).toHaveBeenCalledTimes(1));
    expect(els().map((e) => (e as ShapeElement).pieSlices?.map((s) => s.value))).toEqual([
      [3, 4],
      [3, 4],
    ]);
    expect((els()[0] as ShapeElement).chartSheetSource?.readAt).toBe(5);
    hook.rerender({ elements: els() });
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('leaves a reader without access on the saved values, and never saves for a non-Editor', async () => {
    const { hook, tick } = arrange(
      true,
      vi.fn(async (): Promise<SheetLinkStatus> => ({ kind: 'saved' })),
    );
    await waitFor(() => expect(hook.result.current.statusOf(source).kind).toBe('saved'));
    expect(tick).not.toHaveBeenCalled();
    const viewer = arrange(false);
    await waitFor(() => expect(viewer.hook.result.current.statusOf(source).kind).toBe('live'));
    expect(viewer.tick).not.toHaveBeenCalled();
  });

  it('reads again on Update, and keeps a seeded read without reading', async () => {
    const { hook, read } = arrange(false);
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    act(() => hook.result.current.update(source));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    act(() => hook.result.current.seed({ ...source, sheetId: 'sheet0009' }, readOf([9, 9])));
    expect(hook.result.current.statusOf({ ...source, sheetId: 'sheet0009' }).kind).toBe('live');
  });
});
