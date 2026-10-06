// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import type { Item, ItemWrite } from '@livediagram/items';
import { readLeftover, writeLeftover } from '@/lib/plan-tour';
import { usePlanTourContent } from './usePlanTourContent';

// The Plan tour's tour content (docs/specs/026-plan/plan-tour.md "Tour content"): made and taken away
// with no history (tickTabs, writeQuiet), and a leftover from a cut-short tour swept on the next visit.

const debugLog = vi.hoisted(() => vi.fn());
vi.mock('@/lib/debug-log', () => ({ debugLog }));

function setup(over: { status?: 'loading' | 'ready'; editsBlocked?: boolean; ok?: boolean } = {}) {
  let tabs: Tab[] = [{ id: 'tab1', name: 'Tab', elements: [] as Element[] } as Tab];
  const items = new Map<string, Item>();
  const writes: ItemWrite[] = [];
  const tickTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  const writeQuiet = vi.fn(async (w: ItemWrite) => {
    writes.push(w);
    if (w.kind === 'create')
      for (const c of w.creates)
        items.set(c.id!, {
          id: c.id!,
          type: c.type,
          fields: { ...c.fields, status: c.place?.status ?? '' },
        } as unknown as Item);
    if (w.kind === 'move') {
      const it = items.get(w.id)!;
      items.set(w.id, { ...it, fields: { ...it.fields, status: w.move.status ?? '' } });
    }
    if (w.kind === 'delete') items.delete(w.id);
    return over.ok ?? true;
  });
  const props = {
    documentId: 'doc1' as string | null,
    hydrated: true,
    editsBlocked: over.editsBlocked ?? false,
    activeId: 'tab1',
    tickTabs,
    planItems: { items, status: over.status ?? 'ready', writeQuiet },
  };
  const hook = renderHook((p: typeof props) => usePlanTourContent(p), { initialProps: props });
  return { hook, props, tabs: () => tabs, items, writes, tickTabs, writeQuiet };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.clearAllMocks());

describe('usePlanTourContent', () => {
  it('places the example board once, with no history, and records it', () => {
    const t = setup();
    let id: string | null = null;
    act(() => {
      id = t.hook.result.current.ensureBoard({ x: 0, y: 0 });
    });
    expect(id).toBeTruthy();
    expect(t.hook.result.current.ensureBoard({ x: 0, y: 0 })).toBe(id);
    expect(t.tickTabs).toHaveBeenCalledTimes(1);
    expect(t.tabs()[0]!.elements.map((e) => e.id)).toEqual([id]);
    expect(readLeftover()).toEqual({ documentId: 'doc1', boardId: id, itemIds: [] });
    expect(t.hook.result.current.boardId()).toBe(id);
    expect(t.hook.result.current.status('todo')).toMatch(/^todo~/);
  });

  it('places nothing while edits are blocked or without a document', () => {
    const blocked = setup({ editsBlocked: true });
    expect(blocked.hook.result.current.ensureBoard({ x: 0, y: 0 })).toBeNull();
    const t = setup();
    t.hook.rerender({ ...t.props, documentId: null });
    expect(t.hook.result.current.ensureBoard({ x: 0, y: 0 })).toBeNull();
    expect(t.tickTabs).not.toHaveBeenCalled();
  });

  it('adds the example cards once, quietly, then moves and removes everything', async () => {
    const t = setup();
    act(() => void t.hook.result.current.ensureBoard({ x: 0, y: 0 }));
    expect(await t.hook.result.current.ensureCards()).toBe(true);
    expect(await t.hook.result.current.ensureCards()).toBe(true);
    expect(t.writes.filter((w) => w.kind === 'create')).toHaveLength(1);
    expect(t.items.size).toBe(3);
    const first = t.hook.result.current.firstCardId()!;
    expect(readLeftover()!.itemIds).toHaveLength(3);

    await t.hook.result.current.moveFirstCard();
    expect(t.items.get(first)!.fields['status']).toBe(t.hook.result.current.status('doing'));
    await t.hook.result.current.moveFirstCard();
    expect(t.writes.filter((w) => w.kind === 'move')).toHaveLength(1);

    act(() => t.hook.result.current.removeAll());
    expect(t.items.size).toBe(0);
    expect(t.tabs()[0]!.elements).toEqual([]);
    expect(readLeftover()).toBeNull();
    expect(t.hook.result.current.boardId()).toBeNull();
    // Nothing left to remove.
    act(() => t.hook.result.current.removeAll());
    expect(t.writes.filter((w) => w.kind === 'delete')).toHaveLength(3);
  });

  it('gives up on the cards when the items never load', async () => {
    vi.useFakeTimers();
    const t = setup({ status: 'loading' });
    act(() => void t.hook.result.current.ensureBoard({ x: 0, y: 0 }));
    const pending = t.hook.result.current.ensureCards();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3200);
    });
    expect(await pending).toBe(false);
    expect(t.writeQuiet).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('makes no cards without a board, and warns when the write is refused', async () => {
    const t = setup({ ok: false });
    expect(await t.hook.result.current.ensureCards()).toBe(false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    act(() => void t.hook.result.current.ensureBoard({ x: 0, y: 0 }));
    expect(await t.hook.result.current.ensureCards()).toBe(false);
    expect(warn).toHaveBeenCalledWith('[plan-tour] content.failed', { step: 'cards' });
    await t.hook.result.current.moveFirstCard();
    expect(t.writes.filter((w) => w.kind === 'move')).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith('[plan-tour] content.failed', { step: 'move' });
    warn.mockRestore();
  });

  it("sweeps a cut-short tour's leftovers on the next visit to that document", () => {
    writeLeftover({ documentId: 'doc1', boardId: 'old-board', itemIds: ['old1'] });
    const t = setup();
    // The leftover's board and card exist from the earlier visit.
    expect(t.tickTabs).toHaveBeenCalled();
    expect(readLeftover()).toBeNull();
    expect(debugLog).toHaveBeenCalledWith('[plan-tour] content.swept', { items: 0 });
  });

  it("leaves another document's leftovers alone", () => {
    writeLeftover({ documentId: 'other', boardId: 'b', itemIds: [] });
    const t = setup();
    expect(t.tickTabs).not.toHaveBeenCalled();
    expect(readLeftover()).not.toBeNull();
  });

  it('sweeps the board at once and the cards once the items load', () => {
    writeLeftover({ documentId: 'doc1', boardId: 'old-board', itemIds: ['old1'] });
    const t = setup({ status: 'loading' });
    expect(t.tickTabs).toHaveBeenCalledTimes(1);
    expect(readLeftover()).not.toBeNull();
    t.items.set('old1', { id: 'old1', type: 'task', fields: {} } as unknown as Item);
    t.hook.rerender({ ...t.props, planItems: { ...t.props.planItems, status: 'ready' } });
    expect(t.writes).toEqual([{ kind: 'delete', id: 'old1' }]);
    expect(readLeftover()).toBeNull();
  });
});
