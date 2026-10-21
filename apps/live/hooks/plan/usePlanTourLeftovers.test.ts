// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@liveplanner/document';
import type { Item, ItemWrite } from '@liveplanner/items';
import { readLeftover, writeLeftover } from '@/lib/plan-tour';
import { LEFTOVER_SHEET_RETRY_MS, usePlanTourLeftovers } from './usePlanTourLeftovers';

// What an older Plan tour cut short left behind, swept on the next visit to that document with no history.

const debugLog = vi.hoisted(() => vi.fn());
vi.mock('@/lib/debug-log', () => ({ debugLog }));

function setup(over: { status?: 'loading' | 'ready'; attached?: boolean } = {}) {
  let tabs: Tab[] = [{ id: 'tab1', name: 'Tab', elements: [{ id: 'old-board' }] as Element[] }];
  const items = new Map<string, Item>();
  const writes: ItemWrite[] = [];
  const tickTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  const writeQuiet = vi.fn(async (w: ItemWrite) => {
    writes.push(w);
    return true;
  });
  const props = {
    documentId: 'doc1' as string | null,
    hydrated: true,
    tickTabs,
    planItems: { items, status: over.status ?? 'ready', writeQuiet },
    releaseSheets: vi.fn((_ids: readonly string[]) => over.attached ?? true),
  };
  const hook = renderHook((p: typeof props) => usePlanTourLeftovers(p), { initialProps: props });
  return { hook, props, tabs: () => tabs, items, writes, tickTabs };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.clearAllMocks());

describe('usePlanTourLeftovers', () => {
  it("sweeps a cut-short tour's board and cards on the next visit to that document", () => {
    writeLeftover({ documentId: 'doc1', elementId: 'old-board', itemIds: ['gone'] });
    const t = setup();
    expect(t.tabs()[0]!.elements).toEqual([]);
    expect(readLeftover()).toBeNull();
    expect(debugLog).toHaveBeenCalledWith('[plan-tour] content.swept', { items: 0 });
  });

  it("leaves another document's leftovers alone, and does nothing with none", () => {
    writeLeftover({ documentId: 'other', elementId: 'b', itemIds: [] });
    const t = setup();
    expect(t.tickTabs).not.toHaveBeenCalled();
    expect(readLeftover()).not.toBeNull();
  });

  it('sweeps the board at once and the cards once the items load', () => {
    writeLeftover({ documentId: 'doc1', elementId: 'old-board', itemIds: ['old1'] });
    const t = setup({ status: 'loading' });
    expect(t.tickTabs).toHaveBeenCalledTimes(1);
    expect(readLeftover()).not.toBeNull();
    t.items.set('old1', { id: 'old1', type: 'task', fields: {} } as unknown as Item);
    t.hook.rerender({ ...t.props, planItems: { ...t.props.planItems, status: 'ready' } });
    expect(t.writes).toEqual([{ kind: 'delete', id: 'old1' }]);
    expect(t.tickTabs).toHaveBeenCalledTimes(1);
    expect(readLeftover()).toBeNull();
  });

  it("sweeps a sheet tour's sheet with its element", () => {
    writeLeftover({ documentId: 'doc1', elementId: 'old-board', sheetId: 's1', itemIds: [] });
    const t = setup();
    expect(t.props.releaseSheets).toHaveBeenCalledWith(['s1']);
    expect(t.tabs()[0]!.elements).toEqual([]);
    expect(readLeftover()).toBeNull();
  });

  it('keeps the element and the record until a Sheet can take the sheet, then sweeps both', () => {
    vi.useFakeTimers();
    try {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      writeLeftover({ documentId: 'doc1', elementId: 'old-board', sheetId: 's1', itemIds: [] });
      const t = setup({ attached: false });
      expect(t.props.releaseSheets).toHaveBeenCalledWith(['s1']);
      expect(warn).toHaveBeenCalledWith('[plan-tour] content.failed', { step: 'sheet' });
      // Nothing orphaned: the element and the record stay.
      expect(t.tabs()[0]!.elements).toHaveLength(1);
      expect(readLeftover()).not.toBeNull();
      // Still no Sheet: tried again, warned once.
      act(() => {
        vi.advanceTimersByTime(LEFTOVER_SHEET_RETRY_MS);
      });
      expect(t.props.releaseSheets).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(t.tabs()[0]!.elements).toHaveLength(1);
      // A Sheet draws: the next try takes the sheet and its element, and the record goes.
      t.props.releaseSheets.mockReturnValue(true);
      act(() => {
        vi.advanceTimersByTime(LEFTOVER_SHEET_RETRY_MS);
      });
      expect(t.tabs()[0]!.elements).toEqual([]);
      expect(readLeftover()).toBeNull();
      act(() => {
        vi.advanceTimersByTime(LEFTOVER_SHEET_RETRY_MS * 3);
      });
      expect(t.props.releaseSheets).toHaveBeenCalledTimes(3);
      warn.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });
});
