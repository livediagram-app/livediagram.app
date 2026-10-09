// @vitest-environment jsdom
// One Sheet element's view of the sheet store (blueprint sheet-store.md "Editor slice"): the document's store,
// attached to the room once while any Sheet draws from it; its tab loaded; a placed sheet made (titled, filled from a
// dropped CSV); a copy made from a loaded sheet, a clipboard seed or on the server, refused across documents when
// too big to travel; and the Plan cards handed over when a formula reads them.
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyLayout, type SheetJson, type SheetWrite } from '@livediagram/sheets';
import type { Element, ShapeElement } from '@livediagram/document';
import type { SheetPresenceOp } from '@livediagram/api-schema';
import { ApiError } from '@/lib/api/core';
import * as api from '@/lib/api/sheets';
import { placeNewSheet, sheetsForClipboard, stashSheetSeeds } from '@/lib/sheet-seeds';
import type { SheetsBridge, SheetsHandlers } from '@/hooks/sheets/useSheetsBridge';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { forgetSheetStores, sheetStoreFor } from './sheet-store-client';
import { sheetPresenceFor } from './sheet-presence-store';
import { CSV_TRUNCATED } from './sheet-csv';
import { SHEET_TOO_BIG_TO_PASTE, useSheetModel } from './useSheetModel';

vi.mock('@/lib/api/sheets', () => ({
  fetchSheets: vi.fn(),
  createSheet: vi.fn(),
  writeSheet: vi.fn(),
  deleteSheet: vi.fn(),
}));

const by = { id: 'me', name: 'Me', color: '#000000' };
let seq = 17;
const rand = () => ((seq = (seq * 16807) % 2147483647) - 1) / 2147483646;
let docSeq = 0;

const sheetJson = (id: string, over: Partial<SheetJson> = {}): SheetJson => ({
  id,
  tabId: 't1',
  title: 'Sheet 1',
  layout: emptyLayout(rand, 4, 3),
  cells: [],
  rev: 0,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: by,
  ...over,
});

const element = (planSheet: { sheetId: string; copyOf?: string }, id = 'el1'): ShapeElement =>
  ({
    id,
    type: 'shape',
    shape: 'plan-sheet',
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    planSheet,
  }) as ShapeElement;

type Fake = SheetsBridge & {
  handlers: SheetsHandlers | null;
  detach: ReturnType<typeof vi.fn<() => void>>;
  elements: Element[];
};

function bridge(over: Partial<SheetsBridge> = {}): Fake {
  const b: Fake = {
    scope: { documentId: `doc${docSeq++}`, ownerId: 'o', shareCode: null, tabId: null },
    activeTabId: 't1',
    self: by,
    canEdit: true,
    locale: 'en-GB',
    peers: [],
    pushUndo: vi.fn(),
    toast: vi.fn(),
    notify: vi.fn(),
    sendPresence: vi.fn(),
    placeElement: vi.fn(),
    tickElements: vi.fn(),
    commitElements: vi.fn((map: (els: Element[]) => Element[]) => {
      b.elements = map(b.elements);
    }),
    switchToPlan: vi.fn(),
    selectElement: vi.fn(),
    handlers: null,
    detach: vi.fn<() => void>(),
    elements: [],
    attach: vi.fn((h: SheetsHandlers) => {
      b.handlers = h;
      return b.detach;
    }),
    ...over,
  };
  return b;
}

const fetchSheets = vi.mocked(api.fetchSheets);
const createSheet = vi.mocked(api.createSheet);
const writeSheet = vi.mocked(api.writeSheet);

beforeEach(() => {
  vi.clearAllMocks();
  forgetSheetStores();
  fetchSheets.mockResolvedValue([]);
  // The server stores what it was given, or a copy of the sheet named (when it has it).
  createSheet.mockImplementation(async (_s, c) => {
    const known = (await fetchSheets.getMockImplementation()?.(_s, { tabId: c.tabId })) ?? [];
    const src = c.copyOf ? known.find((x) => x.id === c.copyOf) : undefined;
    return sheetJson(c.id!, {
      title: c.title,
      tabId: c.tabId,
      layout: c.layout ?? src?.layout ?? emptyLayout(rand, 4, 3),
      cells: c.cells ?? src?.cells ?? [],
    });
  });
  writeSheet.mockImplementation(() => new Promise(() => {}));
});
afterEach(() => vi.useRealTimers());

function model(el: ShapeElement, b: SheetsBridge, plan?: PlanContextValue) {
  return renderHook(
    ({ e, br, p }: { e: ShapeElement; br: SheetsBridge; p?: PlanContextValue }) =>
      useSheetModel(e, br, p),
    { initialProps: { e: el, br: b, p: plan } },
  );
}

describe('loading', () => {
  it("loads the element's tab, and shows a sheet already there", async () => {
    fetchSheets.mockResolvedValue([sheetJson('sheetAAAA')]);
    const b = bridge();
    const { result } = model(element({ sheetId: 'sheetAAAA' }), b);
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.sheet?.id).toBe('sheetAAAA'));
    expect(result.current.status).toBe('ready');
    expect(fetchSheets).toHaveBeenCalledWith(b.scope, { tabId: 't1' });
    expect(createSheet).not.toHaveBeenCalled();
    expect(result.current.workbook.sheet('sheetAAAA')).toBeDefined();
  });

  it('has no sheet for an element naming none', async () => {
    const { result } = model(element({ sheetId: '' }), bridge());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.sheet).toBeUndefined();
  });
});

describe('a placed sheet', () => {
  it('is made on the open tab as the next Sheet n', async () => {
    fetchSheets.mockResolvedValue([sheetJson('sheetAAAA', { title: 'Sheet 1' })]);
    const { sheetId } = placeNewSheet();
    const { result } = model(element({ sheetId }), bridge());
    await waitFor(() => expect(result.current.sheet?.id).toBe(sheetId));
    expect(createSheet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: sheetId, tabId: 't1', title: 'Sheet 2' }),
      by,
    );
  });

  it("takes a dropped file's name, kept unique, and its rows from A1", async () => {
    fetchSheets.mockResolvedValue([sheetJson('sheetAAAA', { title: 'Budget' })]);
    const { sheetId } = placeNewSheet({ title: 'Budget', csv: 'a,1\nb,2' });
    const b = bridge();
    const { result } = model(element({ sheetId }), b);
    await waitFor(() => expect(result.current.sheet?.title).toBe('Budget 2'));
    const wb = result.current.workbook;
    expect([wb.value(sheetId, 0, 0), wb.value(sheetId, 0, 1), wb.value(sheetId, 1, 1)]).toEqual([
      'a',
      1,
      2,
    ]);
    expect(b.toast).not.toHaveBeenCalled();
  });

  it('says a dropped file that was cut', async () => {
    const { sheetId } = placeNewSheet({ csv: Array.from({ length: 201 }, () => 'v').join(',') });
    const b = bridge();
    const { result } = model(element({ sheetId }), b);
    await waitFor(() => expect(result.current.sheet).toBeDefined());
    expect(b.toast).toHaveBeenCalledWith(CSV_TRUNCATED);
  });

  it('writes nothing for a dropped file with no rows', async () => {
    const { sheetId } = placeNewSheet({ csv: '' });
    const { result } = model(element({ sheetId }), bridge());
    await waitFor(() => expect(result.current.sheet).toBeDefined());
    expect(result.current.sheet!.cells.size).toBe(0);
  });

  it('is not made by someone who cannot edit', async () => {
    const { sheetId } = placeNewSheet();
    const { result } = model(element({ sheetId }), bridge({ canEdit: false }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.sheet).toBeUndefined();
    expect(createSheet).not.toHaveBeenCalled();
  });

  it('is not made for an element neither placed here nor a copy', async () => {
    const { result } = model(element({ sheetId: 'unknown01' }), bridge());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(createSheet).not.toHaveBeenCalled();
  });
});

describe('a copied sheet', () => {
  it('copies a loaded sheet, its cells at once, and drops the copy mark', async () => {
    const source = sheetJson('sheetSRC1', {
      title: 'Costs',
      cells: [],
    });
    source.cells = [{ r: source.layout.rows[0]!, c: source.layout.cols[0]!, i: { n: 9 } }];
    fetchSheets.mockResolvedValue([source]);
    const b = bridge();
    const el = element({ sheetId: 'sheetCOPY', copyOf: 'sheetSRC1' });
    b.elements = [el, element({ sheetId: 'other0001', copyOf: 'x' }, 'el2')];
    const { result } = model(el, b);
    await waitFor(() => expect(result.current.sheet?.id).toBe('sheetCOPY'));
    expect(result.current.sheet!.title).toBe('Costs (copy)');
    expect(result.current.workbook.value('sheetCOPY', 0, 0)).toBe(9);
    expect(createSheet).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'sheetCOPY', tabId: 't1', title: 'Costs (copy)', copyOf: 'sheetSRC1' },
      by,
    );
    const [mine, theirs] = b.elements as ShapeElement[];
    expect(mine!.planSheet).toEqual({ sheetId: 'sheetCOPY' });
    expect(theirs!.planSheet).toEqual({ sheetId: 'other0001', copyOf: 'x' });
  });

  it('copies from a clipboard seed when the source is in another document', async () => {
    const seed = sheetJson('seedSRC01', { title: 'Pasted' });
    seed.cells = [{ r: seed.layout.rows[1]!, c: seed.layout.cols[1]!, i: { s: 'hi' } }];
    stashSheetSeeds([seed]);
    const b = bridge();
    const { result } = model(element({ sheetId: 'sheetPST1', copyOf: 'seedSRC01' }), b);
    await waitFor(() => expect(result.current.sheet?.id).toBe('sheetPST1'));
    expect(result.current.workbook.value('sheetPST1', 1, 1)).toBe('hi');
    expect(createSheet).toHaveBeenCalledWith(
      expect.anything(),
      {
        id: 'sheetPST1',
        tabId: 't1',
        title: 'Pasted (copy)',
        layout: seed.layout,
        cells: seed.cells,
      },
      by,
    );
  });

  it('has the server copy a sheet on a tab not loaded', async () => {
    const b = bridge();
    const { result } = model(element({ sheetId: 'sheetSRV1', copyOf: 'notLoaded1' }), b);
    await waitFor(() => expect(result.current.sheet?.id).toBe('sheetSRV1'));
    expect(createSheet).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'sheetSRV1', tabId: 't1', title: 'Sheet (copy)', copyOf: 'notLoaded1' },
      by,
    );
    expect(b.toast).not.toHaveBeenCalled();
  });

  it('refuses a paste from another document of a sheet too big to travel, removing the element', async () => {
    createSheet.mockRejectedValueOnce(new ApiError('sheet create', 404, 'sheet_not_found'));
    const b = bridge();
    const el = element({ sheetId: 'sheetBIG1', copyOf: 'elsewhere1' });
    b.elements = [el, element({ sheetId: 'keep00001' }, 'el2')];
    const { result } = model(el, b);
    await waitFor(() => expect(b.toast).toHaveBeenCalledWith(SHEET_TOO_BIG_TO_PASTE));
    expect(b.elements.map((e) => e.id)).toEqual(['el2']);
    await waitFor(() => expect(result.current.sheet).toBeUndefined());
  });

  it('leaves another refusal of a server copy to the store toast', async () => {
    createSheet.mockRejectedValueOnce(new ApiError('sheet create', 413, 'sheets_full'));
    const b = bridge();
    const el = element({ sheetId: 'sheetFUL1', copyOf: 'elsewhere1' });
    b.elements = [el];
    model(el, b);
    await waitFor(() =>
      expect(b.toast).toHaveBeenCalledWith('This document holds the most sheets it can'),
    );
    expect(b.toast).not.toHaveBeenCalledWith(SHEET_TOO_BIG_TO_PASTE);
    expect(b.elements.map((e) => e.id)).toEqual(['el1']);
  });
});

describe('the room', () => {
  it('attaches once while any Sheet draws from the store, routing ops to it', async () => {
    fetchSheets.mockResolvedValue([sheetJson('sheetAAAA')]);
    const b = bridge();
    const one = model(element({ sheetId: 'sheetAAAA' }), b);
    const two = model(element({ sheetId: 'sheetAAAA' }, 'el2'), b);
    await waitFor(() => expect(one.result.current.sheet).toBeDefined());
    expect(b.attach).toHaveBeenCalledOnce();
    const store = one.result.current.store;
    expect(two.result.current.store).toBe(store);
    // The sheet chunk is the clipboard's source while attached.
    expect(sheetsForClipboard(['sheetAAAA']).map((s) => s.id)).toEqual(['sheetAAAA']);
    expect(sheetsForClipboard(['missing01'])).toEqual([]);

    const h = b.handlers!;
    act(() =>
      h.receive({ kind: 'sheets', sheetId: 'sheetAAAA', tabId: 't1', rev: 1, deleted: true }),
    );
    expect(store.sheet('sheetAAAA')).toBeUndefined();
    const op: SheetPresenceOp = {
      kind: 'sheet-presence',
      tabId: 't1',
      sheetId: 'sheetAAAA',
      ranges: [{ r1: 'a', c1: 'b', r2: 'a', c2: 'b' }],
      editing: false,
    };
    act(() => h.presence('peer', op));
    expect(
      sheetPresenceFor(store)
        .on('sheetAAAA')
        .map(([id]) => id),
    ).toEqual(['peer']);
    h.resync();
    await waitFor(() => expect(fetchSheets).toHaveBeenCalledTimes(2));
    // This person's selection goes out through the bridge, and again on reannounce.
    sheetPresenceFor(store).say(op);
    expect(b.sendPresence).toHaveBeenCalledWith(op);
    h.reannounce();
    expect(b.sendPresence).toHaveBeenCalledTimes(2);

    one.unmount();
    expect(b.detach).not.toHaveBeenCalled();
    two.unmount();
    expect(b.detach).toHaveBeenCalledOnce();
    expect(sheetsForClipboard(['sheetAAAA'])).toEqual([]);
  });

  it('says this person selection again when someone new joins', async () => {
    const b = bridge();
    const view = model(element({ sheetId: '' }), b);
    const store = sheetStoreFor({ ...b, self: () => by });
    const reannounce = vi.spyOn(sheetPresenceFor(store), 'reannounce');
    view.rerender({
      e: element({ sheetId: '' }),
      br: { ...b, peers: [{ id: 'p1', name: 'P', color: '#111111' }] },
      p: undefined,
    });
    expect(reannounce).toHaveBeenCalled();
    view.unmount();
  });
});

describe('Plan cards', () => {
  const plan = {
    items: new Map(),
    types: [],
    statusNames: new Map(),
  } as unknown as PlanContextValue;

  it('hands the cards to the workbook when a formula on the tab reads them', async () => {
    const s = sheetJson('sheetCRD1');
    fetchSheets.mockResolvedValue([s]);
    const b = bridge();
    const { result } = model(element({ sheetId: 'sheetCRD1' }), b, plan);
    await waitFor(() => expect(result.current.sheet).toBeDefined());
    const setCards = vi.spyOn(result.current.store, 'setCards');
    const { typeInto } = await import('@livediagram/sheets');
    const t = typeInto(result.current.workbook, 'sheetCRD1', { r: 0, c: 0 }, '=CARDCOUNT()');
    if (!t?.ok) throw new Error('typed');
    act(() => void result.current.store.write('sheetCRD1', t.write as SheetWrite));
    await waitFor(() => expect(setCards).toHaveBeenCalled());
    expect(result.current.workbook.value('sheetCRD1', 0, 0)).toBe(0);
  });

  it('hands nothing over when no formula reads cards, or outside Plan', async () => {
    fetchSheets.mockResolvedValue([sheetJson('sheetNOC1')]);
    const { result } = model(element({ sheetId: 'sheetNOC1' }), bridge(), plan);
    await waitFor(() => expect(result.current.sheet).toBeDefined());
    const setCards = vi.spyOn(result.current.store, 'setCards');
    const other = model(element({ sheetId: 'sheetNOC1' }, 'el2'), bridge());
    await waitFor(() => expect(other.result.current.status).toBe('ready'));
    expect(setCards).not.toHaveBeenCalled();
  });
});
