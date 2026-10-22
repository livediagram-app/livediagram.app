// @vitest-environment jsdom
// The grid's clipboard (docs/specs/029-sheets/sheet.md "Clipboard"): copy and cut put the selection on the
// clipboard three ways (own cells, tab-separated text, an HTML table) and keep it for Paste Values Only and
// Formatting Only; paste reads own cells first (formulas shifted, or a cut moved with references following), else
// HTML, else text; a read-only Sheet copies but never changes.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SHEET_CLIP_TYPE,
  emptyLayout,
  single,
  typeInto,
  type GridRange,
  type SheetJson,
} from '@livediagram/sheets';
import { track } from '@/lib/telemetry';
import type { PlanPalette } from '@/components/plan/plan-palette';
import { SheetStore } from './sheet-store-client';
import { useSheetControllerState } from './sheet-controller';
import { lastSheetClip, useSheetClipboard } from './useSheetClipboard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

let current: ReturnType<typeof useSheetControllerState> | null = null;
vi.mock('./sheet-controller', async (orig) => {
  const real = await orig<typeof import('./sheet-controller')>();
  return { ...real, useSheetController: () => current! };
});

const by = { id: 'me', name: 'Me', color: '#000000' };
let seq = 13;
const rand = () => ((seq = (seq * 16807) % 2147483647) - 1) / 2147483646;
const palette = new Proxy({}, { get: () => '#000000' }) as PlanPalette;
const ID = 'sheet0001';
const OTHER = 'sheet0002';

const json = (id: string, title: string): SheetJson => ({
  id,
  tabId: 't1',
  title,
  layout: emptyLayout(rand, 8, 5),
  cells: [],
  rev: 0,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: by,
});

async function harness(opts: { canEdit?: boolean } = {}) {
  const sheets = [json(ID, 'Sheet 1'), json(OTHER, 'Other')];
  const store = new SheetStore({
    scope: { documentId: 'd1', ownerId: 'o', shareCode: null, tabId: null },
    self: () => by,
    locale: 'en-GB',
    pushUndo: () => {},
    toast: () => {},
    api: {
      fetchSheets: async () => sheets,
      writeSheet: () => new Promise(() => {}),
    } as never,
  });
  await store.loadTab('t1');
  const announce = vi.fn();
  const toast = vi.fn();
  const view = renderHook(() => {
    const c = useSheetControllerState({
      store,
      sheet: store.sheet(ID)!,
      workbook: store.workbook('t1'),
      version: store.version,
      palette,
      interactive: true,
      canEdit: opts.canEdit ?? true,
      maximised: false,
      locale: 'en-GB',
      announce,
      toast,
      notify: () => {},
    });
    current = c;
    return { c, clip: useSheetClipboard() };
  });
  // Every Sheet here is the same sheet id, whose selection is kept for the session: start each at A1.
  act(() => view.result.current.c.setSelection(single({ r: 0, c: 0 })));
  const type = (sheetId: string, r: number, col: number, text: string) => {
    const res = typeInto(store.workbook('t1'), sheetId, { r, c: col }, text);
    if (!res?.ok) throw new Error(text);
    act(() => void store.write(sheetId, res.write));
    view.rerender();
  };
  const select = (g: GridRange) =>
    act(() =>
      view.result.current.c.setSelection({
        ranges: [g],
        active: { r: g.r1, c: g.c1 },
        anchor: { r: g.r1, c: g.c1 },
      }),
    );
  const value = (r: number, col: number, sheetId = ID) =>
    store.workbook('t1').value(sheetId, r, col);
  const input = (r: number, col: number, sheetId = ID) => {
    const s = store.sheet(sheetId)!;
    return s.cells.get(`${s.layout.rows[r]}:${s.layout.cols[col]}`)?.input;
  };
  return { store, view, type, select, value, input, announce, toast };
}

// A DataTransfer as a clipboard event carries it.
function transfer(initial: Record<string, string> = {}, refuse?: string) {
  const data = new Map(Object.entries(initial));
  return {
    setData: vi.fn((t: string, v: string) => {
      if (t === refuse) throw new Error('refused');
      data.set(t, v);
    }),
    getData: (t: string) => data.get(t) ?? '',
    data,
  };
}
function event(dt: ReturnType<typeof transfer>) {
  return {
    preventDefault: vi.fn(),
    clipboardData: dt,
  } as unknown as React.ClipboardEvent<HTMLElement> & {
    preventDefault: ReturnType<typeof vi.fn>;
  };
}

const range = (r1: number, c1: number, r2 = r1, c2 = c1): GridRange => ({ r1, c1, r2, c2 });

let clipboard: { writeText: ReturnType<typeof vi.fn>; readText: ReturnType<typeof vi.fn> };
beforeEach(() => {
  vi.clearAllMocks();
  current = null;
  clipboard = { writeText: vi.fn(async () => {}), readText: vi.fn(async () => '') };
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
});
afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
});

describe('copy and cut', () => {
  it('puts the selection on the clipboard three ways, marks it, and keeps it', async () => {
    const h = await harness();
    h.type(ID, 0, 0, '1');
    h.type(ID, 0, 1, '=A1+1');
    h.select(range(0, 0, 0, 1));
    const dt = transfer();
    const e = event(dt);
    act(() => h.view.result.current.clip.onCopy(e));
    expect(e.preventDefault).toHaveBeenCalled();
    expect(dt.data.get('text/plain')).toBe('1\t2');
    expect(dt.data.get('text/html')).toContain('<table');
    expect(JSON.parse(dt.data.get(SHEET_CLIP_TYPE)!)).toMatchObject({ v: 1, rows: 1, cols: 2 });
    expect(lastSheetClip()?.values).toEqual([['1', '2']]);
    expect(h.view.result.current.c.marquee).toEqual({ range: range(0, 0, 0, 1), cut: false });
    expect(h.announce).toHaveBeenCalledWith('Copied 2 cells');
  });

  it('still copies the plain and HTML forms when the browser refuses the custom type', async () => {
    const h = await harness();
    h.type(ID, 0, 0, 'x');
    const dt = transfer({}, SHEET_CLIP_TYPE);
    act(() => h.view.result.current.clip.onCopy(event(dt)));
    expect(dt.data.get('text/plain')).toBe('x');
    expect(dt.data.get('text/html')).toContain('x');
    expect(dt.data.has(SHEET_CLIP_TYPE)).toBe(false);
    expect(h.announce).toHaveBeenCalledWith('Copied 1 cell');
  });

  it('leaves copy, cut and paste to the cell editor while editing', async () => {
    const h = await harness();
    act(() => h.view.result.current.c.setEditing({ r: 0, c: 0, draft: 'x', origin: 'type' }));
    const dt = transfer({ 'text/plain': 'pasted' });
    const e = event(dt);
    act(() => {
      h.view.result.current.clip.onCopy(e);
      h.view.result.current.clip.onCut(e);
      h.view.result.current.clip.onPaste(e);
    });
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(dt.setData).not.toHaveBeenCalled();
    expect(h.value(0, 0)).toBeNull();
  });

  it('cuts as a copy on a read-only Sheet', async () => {
    const h = await harness({ canEdit: false });
    h.type(ID, 0, 0, 'x');
    act(() => h.view.result.current.clip.onCut(event(transfer())));
    expect(h.view.result.current.c.marquee?.cut).toBe(false);
    expect(h.announce).toHaveBeenCalledWith('Copied 1 cell');
  });

  it('copies nothing from a sheet the workbook does not have', async () => {
    const h = await harness();
    // The store forgets the sheet: the controller's sheet is no longer in the workbook.
    act(() => h.store.receive({ kind: 'sheets', sheetId: ID, tabId: 't1', rev: 1, deleted: true }));
    const dt = transfer();
    act(() => h.view.result.current.clip.onCopy(event(dt)));
    expect(dt.setData).not.toHaveBeenCalled();
  });
});

describe('paste', () => {
  it("pastes the sheet's own cells with formulas shifted, selecting what landed", async () => {
    const h = await harness();
    h.type(ID, 0, 0, '1');
    h.type(ID, 0, 1, '=A1+1');
    h.select(range(0, 0, 0, 1));
    const dt = transfer();
    act(() => h.view.result.current.clip.onCopy(event(dt)));
    h.select(range(3, 0));
    const e = event(dt);
    act(() => h.view.result.current.clip.onPaste(e));
    h.view.rerender();
    expect(e.preventDefault).toHaveBeenCalled();
    expect([h.value(3, 0), h.value(3, 1)]).toEqual([1, 2]);
    expect(h.view.result.current.c.selection.ranges).toEqual([range(3, 0, 3, 1)]);
    expect(track).toHaveBeenCalledWith('Sheet', 'Changed', 'Paste');
  });

  it('moves a cut, references following, then forgets it', async () => {
    const h = await harness();
    h.type(ID, 0, 0, '5');
    h.type(OTHER, 0, 0, "='Sheet 1'!A1*2");
    h.select(range(0, 0));
    const dt = transfer();
    act(() => h.view.result.current.clip.onCut(event(dt)));
    expect(h.view.result.current.c.marquee?.cut).toBe(true);
    expect(h.announce).toHaveBeenCalledWith('Cut 1 cell');
    h.select(range(4, 2));
    act(() => h.view.result.current.clip.onPaste(event(dt)));
    h.view.rerender();
    expect([h.value(0, 0), h.value(4, 2)]).toEqual([null, 5]);
    // The other sheet's formula follows the moved cell.
    expect(h.value(0, 0, OTHER)).toBe(10);
    expect(h.input(0, 0, OTHER)).toBeDefined();
    expect(lastSheetClip()).toBeNull();
    expect(h.view.result.current.c.marquee).toBeNull();
  });

  it('pastes the kept copy when only its text arrived (a browser that dropped the custom type)', async () => {
    const h = await harness();
    h.type(ID, 0, 0, '1');
    h.type(ID, 1, 0, '=A1*10');
    h.select(range(0, 0, 1, 0));
    act(() => h.view.result.current.clip.onCopy(event(transfer())));
    h.select(range(0, 2));
    act(() => h.view.result.current.clip.onPaste(event(transfer({ 'text/plain': '1\n10' }))));
    // A formula, shifted, not the text "10".
    expect(h.input(1, 2)).toHaveProperty('f');
  });

  it('reads an HTML table, else tab-separated text, from elsewhere; a broken own payload reads as text', async () => {
    const h = await harness();
    act(() =>
      h.view.result.current.clip.onPaste(
        event(
          transfer({
            'text/html': '<table><tr><td>x</td><td>5</td></tr></table>',
            'text/plain': 'ignored',
          }),
        ),
      ),
    );
    expect([h.value(0, 0), h.value(0, 1)]).toEqual(['x', 5]);
    h.select(range(2, 0));
    act(() =>
      h.view.result.current.clip.onPaste(
        event(transfer({ [SHEET_CLIP_TYPE]: '{broken', 'text/plain': 'a\tb\nc\td' })),
      ),
    );
    expect([h.value(2, 0), h.value(2, 1), h.value(3, 0), h.value(3, 1)]).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('says a paste cut at the sheet limits', async () => {
    const h = await harness();
    // 200 columns from column B pass the 200-column limit by one.
    h.select(range(0, 1));
    const wide = Array.from({ length: 200 }, () => 'v').join('\t');
    act(() => h.view.result.current.clip.onPaste(event(transfer({ 'text/plain': wide }))));
    expect(h.toast).toHaveBeenCalledWith(
      'A sheet holds up to 10,000 rows and 200 columns: the paste was cut there',
    );
  });

  it('also says a paste cut by its text, 201 columns at A1', async () => {
    const h = await harness();
    h.select(range(0, 0));
    const wide = Array.from({ length: 201 }, () => 'v').join('\t');
    act(() => h.view.result.current.clip.onPaste(event(transfer({ 'text/plain': wide }))));
    expect(h.toast).toHaveBeenCalledWith(
      'A sheet holds up to 10,000 rows and 200 columns: the paste was cut there',
    );
  });

  // A paste with nothing readable (an image, files) changes nothing.
  it('leaves the cells alone for a paste with no text', async () => {
    const h = await harness();
    h.type(ID, 0, 0, 'filled');
    act(() => h.view.result.current.clip.onPaste(event(transfer())));
    expect(h.value(0, 0)).toBe('filled');
  });

  it('changes nothing on a read-only Sheet', async () => {
    const h = await harness({ canEdit: false });
    act(() => h.view.result.current.clip.onPaste(event(transfer({ 'text/plain': 'x' }))));
    clipboard.readText.mockResolvedValue('y');
    await act(async () => {
      await h.view.result.current.clip.pasteNow();
      await h.view.result.current.clip.pasteSpecial('values');
    });
    expect(h.value(0, 0)).toBeNull();
    expect(clipboard.readText).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});

describe('the menu and shortcut commands', () => {
  it('copyNow keeps the copy and writes its text to the system clipboard, a refusal ignored', async () => {
    const h = await harness();
    h.type(ID, 0, 0, 'hi');
    clipboard.writeText.mockRejectedValueOnce(new Error('denied'));
    act(() => h.view.result.current.clip.copyNow(false));
    expect(clipboard.writeText).toHaveBeenCalledWith('hi');
    expect(lastSheetClip()?.values).toEqual([['hi']]);
    await Promise.resolve();
  });

  it('copyNow works without a system clipboard', async () => {
    const h = await harness();
    h.type(ID, 0, 0, 'hi');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    expect(() => act(() => h.view.result.current.clip.copyNow(true))).not.toThrow();
    expect(lastSheetClip()?.cut).toBe(true);
  });

  it('pasteNow pastes the kept copy when the system text is it, or empty', async () => {
    const h = await harness();
    h.type(ID, 0, 0, '1');
    h.type(ID, 0, 1, '=A1+1');
    h.select(range(0, 0, 0, 1));
    act(() => h.view.result.current.clip.copyNow(false));
    h.select(range(2, 0));
    clipboard.readText.mockResolvedValueOnce('1\t2');
    await act(() => h.view.result.current.clip.pasteNow());
    expect(h.input(2, 1)).toHaveProperty('f');
    h.select(range(4, 0));
    clipboard.readText.mockRejectedValueOnce(new Error('denied'));
    await act(() => h.view.result.current.clip.pasteNow());
    expect(h.input(4, 1)).toHaveProperty('f');
  });

  it('pasteNow pastes text copied elsewhere, and nothing for no text', async () => {
    const h = await harness();
    h.type(ID, 0, 0, 'mine');
    act(() => h.view.result.current.clip.copyNow(false));
    h.select(range(1, 0));
    clipboard.readText.mockResolvedValueOnce('a\tb');
    await act(() => h.view.result.current.clip.pasteNow());
    expect([h.value(1, 0), h.value(1, 1)]).toEqual(['a', 'b']);
  });

  it('pasteNow with nothing kept and nothing on the clipboard changes nothing', async () => {
    const h = await harness();
    h.type(ID, 0, 0, 'x');
    // A cut pasted clears the kept copy.
    act(() => h.view.result.current.clip.copyNow(true));
    h.select(range(1, 1));
    clipboard.readText.mockResolvedValueOnce('');
    await act(() => h.view.result.current.clip.pasteNow());
    const before = h.store.version;
    clipboard.readText.mockResolvedValueOnce('');
    await act(() => h.view.result.current.clip.pasteNow());
    expect(h.store.version).toBe(before);
  });

  it('Paste Values Only pastes what the kept copy shows, not its formulas', async () => {
    const h = await harness();
    h.type(ID, 0, 0, '1');
    h.type(ID, 0, 1, '=A1+1');
    h.select(range(0, 0, 0, 1));
    act(() => h.view.result.current.clip.copyNow(false));
    h.select(range(3, 0));
    clipboard.readText.mockResolvedValueOnce('1\t2');
    await act(() => h.view.result.current.clip.pasteSpecial('values'));
    expect(h.input(3, 1)).toEqual({ n: 2 });
  });

  it('Paste Formatting Only takes the kept copy formats and leaves the values', async () => {
    const h = await harness();
    h.type(ID, 0, 0, '1');
    const s = h.store.sheet(ID)!;
    act(
      () =>
        void h.store.write(ID, {
          kind: 'cells',
          cells: [{ r: s.layout.rows[0]!, c: s.layout.cols[0]!, f: { b: true } }],
        }),
    );
    h.view.rerender();
    h.select(range(0, 0));
    act(() => h.view.result.current.clip.copyNow(false));
    h.type(ID, 5, 0, 'keep');
    h.select(range(5, 0));
    clipboard.readText.mockResolvedValueOnce('');
    await act(() => h.view.result.current.clip.pasteSpecial('formats'));
    const t = h.store.sheet(ID)!;
    expect(t.cells.get(`${t.layout.rows[5]}:${t.layout.cols[0]}`)).toMatchObject({
      input: { s: 'keep' },
      format: { b: true },
    });
  });

  it('Paste Values Only reads text from elsewhere as values; formatting only ignores it', async () => {
    const h = await harness();
    // Forget any copy kept from before: a cut, pasted, is forgotten.
    h.select(range(7, 4));
    act(() => h.view.result.current.clip.copyNow(true));
    await act(() => h.view.result.current.clip.pasteNow());
    expect(lastSheetClip()).toBeNull();
    h.select(range(0, 0));
    clipboard.readText.mockResolvedValueOnce('=1+1\t3');
    await act(() => h.view.result.current.clip.pasteSpecial('values'));
    expect(h.value(0, 1)).toBe(3);
    const before = h.store.version;
    clipboard.readText.mockResolvedValueOnce('elsewhere');
    await act(() => h.view.result.current.clip.pasteSpecial('formats'));
    clipboard.readText.mockRejectedValueOnce(new Error('denied'));
    await act(() => h.view.result.current.clip.pasteSpecial('values'));
    expect(h.store.version).toBe(before);
  });
});
