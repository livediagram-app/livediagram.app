// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { Workbook, sheetFromJson, type Sheet } from '@liveplanner/sheets';
import { shape } from '@liveplanner/plan-art/test-fixtures';
import { renderTabDrawingSvg } from '@/lib/tab-drawing';
import { framedSheetKey, useTabSheets } from './useTabSheets';

// docs/specs/007-editor/split-view.md "The other pane": a Sheet drawn beside the editor shows its cells, read from
// the plan's sheet store, and draws again when they change.
const person = { id: 'p', name: 'Sam', color: '#2563eb' };
const sheetOf = (id: string, tabId: string, text: string): Sheet =>
  sheetFromJson({
    id,
    tabId,
    title: 'Sheet',
    layout: { rows: ['r0', 'r1'], cols: ['c0', 'c1'] },
    cells: [{ r: 'r0', c: 'c0', i: { s: text } }],
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: person,
  });

const sheets = new Map<string, Sheet>([
  ['s-a', sheetOf('s-a', 'tab-a', 'Alpha')],
  ['s-b', sheetOf('s-b', 'tab-b', 'Beta')],
]);
const listeners = new Set<() => void>();
let version = 0;
let readsCards = false;
const store = {
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getVersion: () => version,
  sheet: (id: string) => sheets.get(id),
  workbook: (tabId: string) => {
    const wb = new Workbook({
      sheets: [...sheets.values()].filter((s) => s.tabId === tabId),
      locale: 'en-GB',
    });
    if (readsCards) wb.usesCards = () => true;
    return wb;
  },
  loadTab: vi.fn(() => Promise.resolve()),
};
const notify = () => {
  version++;
  for (const l of listeners) l();
};
const detach = vi.fn();
const attach = vi.fn(() => detach);
let bridge: object | null = {};

const sheetTab = (id: string, sheetId: string): Tab => ({
  id,
  name: id,
  kind: 'sheet',
  elements: [shape(`el-${id}`, 'plan-sheet', { planSheet: { sheetId }, width: 400, height: 200 })],
});
const tabA = sheetTab('tab-a', 's-a');
const tabB = sheetTab('tab-b', 's-b');
const board = { id: 'board', name: 'Board', elements: [shape('b', 'plan-board')] } as Tab;

vi.mock('@/hooks/sheets/useSheetsBridge', () => ({ useSheetsBridgeContext: () => bridge }));
vi.mock('@/app/project/[id]/EditorContext', () => ({
  useEditorContext: () => ({ tabs: [tabA, tabB, board] }),
}));
vi.mock('@/components/sheets/sheet-store-client', () => ({ sheetStoreOf: () => store }));
vi.mock('@/components/sheets/sheet-store-attach', () => ({ attachSheetStore: attach }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  bridge = {};
});

describe('useTabSheets', () => {
  it('names the sheets a tab frames, each once', () => {
    const twice: Tab = { ...tabA, elements: [...tabA.elements, ...tabA.elements] };
    expect(framedSheetKey(twice)).toBe('s-a');
    expect(framedSheetKey(board)).toBe('');
    expect(framedSheetKey(undefined)).toBe('');
  });

  it('draws nothing for no tab, and a tab without a Sheet as it is, loading no store', async () => {
    expect(renderHook(() => useTabSheets(undefined)).result.current).toBeNull();
    const { result } = renderHook(() => useTabSheets(board));
    expect(result.current).toEqual({ tab: board });
    await act(async () => {});
    expect(attach).not.toHaveBeenCalled();
  });

  it('draws a Sheet as its frame outside the editor (no sheets bridge)', async () => {
    bridge = null;
    const { result } = renderHook(() => useTabSheets(tabA));
    await act(async () => {});
    expect(result.current).toEqual({ tab: tabA });
    expect(attach).not.toHaveBeenCalled();
  });

  // Two Sheet tabs side by side: the other pane draws its own cells whichever tab the editor is on.
  it('draws each of two Sheet tabs with its own cells, and draws again when the store moves on', async () => {
    const a = renderHook(() => useTabSheets(tabA));
    const b = renderHook(() => useTabSheets(tabB));
    await waitFor(() => expect(a.result.current?.sheets?.size).toBe(1));
    await waitFor(() => expect(b.result.current?.sheets?.size).toBe(1));
    expect(store.loadTab).toHaveBeenCalledWith('tab-a');
    expect(store.loadTab).toHaveBeenCalledWith('tab-b');
    // The room stays attached while a Sheet shows, so a collaborator's change lands.
    expect(attach).toHaveBeenCalledTimes(2);
    const svgOf = (r: typeof a) =>
      renderTabDrawingSvg(r.result.current!.tab, { sheets: r.result.current!.sheets! });
    expect(svgOf(a)).toContain('Alpha');
    expect(svgOf(b)).toContain('Beta');
    expect(svgOf(a)).not.toContain('Beta');

    sheets.set('s-a', sheetOf('s-a', 'tab-a', 'Changed'));
    act(() => notify());
    await waitFor(() => expect(svgOf(a)).toContain('Changed'));

    // Typing in the other tab's Sheet leaves this drawing as it was; its cells are not worked out again.
    const was = a.result.current;
    sheets.set('s-b', sheetOf('s-b', 'tab-b', 'Typed'));
    act(() => notify());
    await waitFor(() => expect(svgOf(b)).toContain('Typed'));
    expect(a.result.current).toBe(was);

    // A Sheet whose formulas read Plan cards is read again whenever the store moves on.
    readsCards = true;
    act(() => notify());
    await waitFor(() => expect(a.result.current).not.toBe(was));
    readsCards = false;

    a.unmount();
    b.unmount();
    expect(detach).toHaveBeenCalledTimes(2);
  });

  it('lets go of a load that lands after the pane has gone', async () => {
    const { unmount } = renderHook(() => useTabSheets(tabA));
    unmount();
    await act(async () => {});
    expect(attach).not.toHaveBeenCalled();
  });
});
