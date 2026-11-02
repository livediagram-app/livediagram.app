// @vitest-environment jsdom
// The editor's side of the sheet store (blueprint sheet-store.md "Editor slice"): a bridge whose callbacks always
// reach the editor's latest functions, whose identity changes only with what the sheet chunk reads, and which
// routes the room's `sheets` and `sheet-presence` ops to the chunk once it attaches (dropped before).
import { act, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SheetPresenceOp, SheetsRoomOp } from '@liveplanner/api-schema';
import type { Element } from '@liveplanner/project';
import {
  SheetsBridgeContext,
  useSheetsBridge,
  useSheetsBridgeContext,
  type SheetsHandlers,
} from './useSheetsBridge';

type Opts = Parameters<typeof useSheetsBridge>[0];

function opts(over: Partial<Opts> = {}): Opts {
  return {
    projectId: 'd1',
    ownerId: 'o1',
    shareCode: null,
    tabScope: null,
    self: { id: 'me', name: 'Me', color: '#000000' },
    canEdit: true,
    peers: [],
    pushUndo: vi.fn(),
    toast: vi.fn(),
    notify: vi.fn(),
    send: vi.fn(),
    activeTabId: 't1',
    commitElements: vi.fn(),
    placeElement: vi.fn(),
    tickElements: vi.fn(),
    selectElement: vi.fn(),
    sheetRetitled: vi.fn(),
    ...over,
  };
}

const handlers = (): SheetsHandlers => ({
  receive: vi.fn(),
  title: vi.fn((id: string) => (id === 's1' ? 'Budget' : undefined)),
  release: vi.fn(),
  retitle: vi.fn(),
  presence: vi.fn(),
  resync: vi.fn(),
  reannounce: vi.fn(),
});

const sheetsOp: SheetsRoomOp = {
  kind: 'sheets',
  sheetId: 's1',
  tabId: 't1',
  rev: 1,
  deleted: true,
};
const presenceOp: SheetPresenceOp = {
  kind: 'sheet-presence',
  tabId: 't1',
  sheetId: 's1',
  ranges: null,
  editing: false,
};

describe('useSheetsBridge', () => {
  it('carries the scope, tab, identity and permissions the chunk reads', () => {
    const { result } = renderHook(() =>
      useSheetsBridge(opts({ shareCode: 'sc', tabScope: 'tX', canEdit: false })),
    );
    const b = result.current.bridge;
    expect(b.scope).toEqual({ projectId: 'd1', ownerId: 'o1', shareCode: 'sc', tabId: 'tX' });
    expect(b.activeTabId).toBe('t1');
    expect(b.self).toEqual({ id: 'me', name: 'Me', color: '#000000' });
    expect(b.canEdit).toBe(false);
    expect(b.locale).toBe(navigator.language || 'en-GB');
    expect(b.peers).toEqual([]);
  });

  it('keeps its identity across renders with new callbacks, and calls the latest ones', () => {
    const first = opts();
    const { result, rerender } = renderHook((o: Opts) => useSheetsBridge(o), {
      initialProps: first,
    });
    const before = result.current;
    const next = opts({ peers: first.peers, self: first.self });
    rerender(next);
    expect(result.current.bridge).toBe(before.bridge);
    expect(result.current.receiveSheets).toBe(before.receiveSheets);
    const b = result.current.bridge;
    const step = { undo: () => {}, redo: () => {} };
    const map = (els: Element[]) => els;
    b.pushUndo(step);
    b.toast('t');
    b.notify('n');
    b.sendPresence(presenceOp);
    b.commitElements(map);
    const make = () => ({}) as never;
    b.placeElement({ x: 1, y: 2 }, make, { select: false });
    b.tickElements(map);
    b.selectElement('el1');
    expect(next.pushUndo).toHaveBeenCalledWith(step);
    expect(next.toast).toHaveBeenCalledWith('t');
    expect(next.notify).toHaveBeenCalledWith('n');
    expect(next.send).toHaveBeenCalledWith(presenceOp);
    expect(next.commitElements).toHaveBeenCalledWith(map);
    expect(next.placeElement).toHaveBeenCalledWith({ x: 1, y: 2 }, make, { select: false });
    expect(next.tickElements).toHaveBeenCalledWith(map);
    expect(next.selectElement).toHaveBeenCalledWith('el1');
    for (const f of [first.pushUndo, first.toast, first.send, first.selectElement])
      expect(f).not.toHaveBeenCalled();
  });

  it('is a new bridge when what it carries changes', () => {
    const first = opts();
    const { result, rerender } = renderHook((o: Opts) => useSheetsBridge(o), {
      initialProps: first,
    });
    const before = result.current.bridge;
    rerender({ ...first, activeTabId: 't2' });
    expect(result.current.bridge).not.toBe(before);
    expect(result.current.bridge.activeTabId).toBe('t2');
    const again = result.current.bridge;
    rerender({ ...first, activeTabId: 't2', canEdit: false });
    expect(result.current.bridge).not.toBe(again);
  });

  it('drops room ops before anything attaches, and routes them once something has', () => {
    const { result } = renderHook(() => useSheetsBridge(opts()));
    const r = result.current;
    expect(() => {
      r.receiveSheets(sheetsOp);
      r.receiveSheetPresence('peer', presenceOp);
      r.resync();
      r.reannounce();
    }).not.toThrow();
    const h = handlers();
    const detach = r.bridge.attach(h);
    // What was dropped is read again as it attaches.
    expect(h.resync).toHaveBeenCalledOnce();
    r.receiveSheets(sheetsOp);
    r.receiveSheetPresence('peer', presenceOp);
    r.resync();
    r.reannounce();
    expect(h.receive).toHaveBeenCalledWith(sheetsOp);
    expect(h.presence).toHaveBeenCalledWith('peer', presenceOp);
    expect(h.resync).toHaveBeenCalledTimes(2);
    expect(h.reannounce).toHaveBeenCalledOnce();
    detach();
    r.receiveSheets(sheetsOp);
    expect(h.receive).toHaveBeenCalledOnce();
  });

  // A sheet form's builder loads its sheet without drawing it, and a Sheet's tab left behind detaches: a response or
  // a collaborator's write that arrives then is dropped, so the sheet once drawn read stale until a reload.
  it('reads the loaded sheets again on attaching after an op was dropped, and only then', () => {
    const { result } = renderHook(() => useSheetsBridge(opts()));
    const r = result.current;
    const first = handlers();
    const detach = r.bridge.attach(first);
    expect(first.resync).not.toHaveBeenCalled();
    detach();
    // Nothing missed while detached: attaching again reads nothing.
    const quiet = handlers();
    r.bridge.attach(quiet)();
    expect(quiet.resync).not.toHaveBeenCalled();
    // A write lands while nothing is attached.
    r.receiveSheets(sheetsOp);
    const next = handlers();
    r.bridge.attach(next);
    expect(next.resync).toHaveBeenCalledOnce();
    expect(next.receive).not.toHaveBeenCalled();
  });

  it('names and releases sheets only once the chunk has attached', () => {
    const { result } = renderHook(() => useSheetsBridge(opts()));
    const r = result.current;
    expect(r.sheetsAttached()).toBe(false);
    expect(r.sheetTitle('s1')).toBeUndefined();
    expect(r.releaseSheets(['s1'])).toBe(false);
    const h = handlers();
    r.bridge.attach(h);
    expect(r.sheetsAttached()).toBe(true);
    expect(r.sheetTitle('s1')).toBe('Budget');
    expect(r.releaseSheets(['s1'])).toBe(true);
    expect(h.release).toHaveBeenCalledWith(['s1']);
  });

  it('keeps the newer handlers when an older attachment detaches', () => {
    const { result } = renderHook(() => useSheetsBridge(opts()));
    const older = handlers();
    const newer = handlers();
    const detachOlder = result.current.bridge.attach(older);
    result.current.bridge.attach(newer);
    act(() => detachOlder());
    result.current.receiveSheets(sheetsOp);
    expect(newer.receive).toHaveBeenCalledWith(sheetsOp);
    expect(older.receive).not.toHaveBeenCalled();
  });
});

describe('SheetsBridgeContext', () => {
  it('is null outside a provider, and the bridge inside one', () => {
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useSheetsBridgeContext());
      return null;
    }
    const { result } = renderHook(() => useSheetsBridge(opts()));
    render(<Probe />);
    render(
      <SheetsBridgeContext.Provider value={result.current.bridge}>
        <Probe />
      </SheetsBridgeContext.Provider>,
    );
    expect(seen).toEqual([null, result.current.bridge]);
  });
});
