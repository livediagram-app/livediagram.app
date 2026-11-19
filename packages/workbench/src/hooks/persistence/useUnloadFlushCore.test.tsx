// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerOpenEdit } from '../../lib/open-edit';
import { noteSaveFailing, noteTabTooLarge } from '../../lib/save-health';
import type { AutosaveUnloadArgs } from './useAutosaveCore';
import { shouldWarnOnLeave, useUnloadFlushCore, type UnloadFlushDeps } from './useUnloadFlushCore';

// Each product's docs/specs/006-*/per-tab-storage.md "Saving": the edits still inside the debounce go when the editor
// goes, and 007-editor/load-recovery.md "Leaving with unsaved changes asks first". Each editor's own
// useUnloadFlush.test.tsx drives its binding with its real calls; these pin the shared hook's every branch.

type Tab = { id: string; label: string };
type Room = { send: (op: string) => void };

const saved: Tab = { id: 't1', label: 'saved' };

// A diff over labels: a tab differs from its last save when its label does, and a name change counts.
const diffOf: UnloadFlushDeps<Tab, Room>['computeTabSaveDiff'] = (last, tabs, lastName, name) => {
  const changedTabs = tabs.filter((t) => last.find((s) => s.id === t.id)?.label !== t.label);
  const nameChanged = lastName !== name;
  return {
    changedTabs,
    deletedIds: [],
    orderChanged: false,
    nameChanged,
    hasChanges: changedTabs.length > 0 || nameChanged,
  };
};

function makeDeps(over: Partial<UnloadFlushDeps<Tab, Room, string>> = {}) {
  return {
    isItemDeleted: vi.fn((_id: string) => false),
    computeTabSaveDiff: vi.fn(diffOf),
    relayParticipantTab: vi.fn(),
    sendBeacon: vi.fn(),
    ...over,
  } satisfies UnloadFlushDeps<Tab, Room, string>;
}

const args = (
  over: Partial<AutosaveUnloadArgs<Tab, Room>> = {},
): AutosaveUnloadArgs<Tab, Room> => ({
  hydrated: true,
  itemId: 'd1',
  isReadOnly: false,
  participant: false,
  tabs: [{ id: 't1', label: 'typed' }],
  itemName: 'Doc',
  selfId: 'me',
  sessionShareCode: null,
  lastSavedTabsRef: { current: [saved] },
  lastSavedNameRef: { current: 'Doc' },
  loadedTabIdsRef: { current: new Set(['t1']) },
  changesetSeen: new Map(),
  writesForbiddenRef: { current: false },
  roomRef: { current: { send: vi.fn() } },
  ...over,
});

const leaveEvent = () => {
  const e = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(e);
  return e;
};

afterEach(() => {
  noteSaveFailing(false);
  noteTabTooLarge(false);
  vi.restoreAllMocks();
});

describe('shouldWarnOnLeave', () => {
  it('asks only with unsaved changes while saves fail or the browser is offline', () => {
    expect(shouldWarnOnLeave(true, true, true)).toBe(true);
    expect(shouldWarnOnLeave(true, false, false)).toBe(true);
    expect(shouldWarnOnLeave(true, false, true)).toBe(false);
    expect(shouldWarnOnLeave(false, true, false)).toBe(false);
  });
});

describe('useUnloadFlushCore', () => {
  it('sends one beacon on pagehide, once for the same content however many events follow', () => {
    const deps = makeDeps();
    const o = args();
    renderHook(() => useUnloadFlushCore(deps, o));
    window.dispatchEvent(new Event('pagehide'));
    leaveEvent();
    expect(deps.sendBeacon).toHaveBeenCalledOnce();
    expect(deps.sendBeacon).toHaveBeenCalledWith(
      o,
      'd1',
      expect.objectContaining({ changedTabs: o.tabs, hasChanges: true }),
      undefined,
    );
  });

  it('sends again when the content changed after a flush', () => {
    const deps = makeDeps();
    const { rerender } = renderHook(
      (p: AutosaveUnloadArgs<Tab, Room>) => useUnloadFlushCore(deps, p),
      {
        initialProps: args(),
      },
    );
    window.dispatchEvent(new Event('pagehide'));
    rerender(args({ tabs: [{ id: 't1', label: 'more' }] }));
    window.dispatchEvent(new Event('pagehide'));
    rerender(args({ tabs: [{ id: 't1', label: 'more' }], itemName: 'Renamed' }));
    window.dispatchEvent(new Event('pagehide'));
    expect(deps.sendBeacon).toHaveBeenCalledTimes(3);
  });

  it('sends what the debounce still held when the editor unmounts', () => {
    const deps = makeDeps();
    const { unmount } = renderHook(() => useUnloadFlushCore(deps, args()));
    unmount();
    expect(deps.sendBeacon).toHaveBeenCalledOnce();
    // The listeners went with it.
    window.dispatchEvent(new Event('pagehide'));
    expect(deps.sendBeacon).toHaveBeenCalledOnce();
  });

  it('names what each changed tab saved when the editor reads it, leaving out a tab that names nothing', () => {
    const saveChanges = vi.fn((_before: Tab | undefined, t: Tab) =>
      t.id === 't1' ? 'label' : null,
    );
    const deps = makeDeps({ saveChanges });
    const tabs = [
      { id: 't1', label: 'typed' },
      { id: 't2', label: 'new' },
    ];
    renderHook(() => useUnloadFlushCore(deps, args({ tabs })));
    window.dispatchEvent(new Event('pagehide'));
    expect(saveChanges).toHaveBeenCalledWith(saved, tabs[0]);
    expect(saveChanges).toHaveBeenCalledWith(undefined, tabs[1]);
    expect(vi.mocked(deps.sendBeacon).mock.calls[0]![3]).toEqual(new Map([['t1', 'label']]));
  });

  it("relays a Participant's changed tabs to the room, each with its last save, and sends no beacon", () => {
    const deps = makeDeps();
    const tabs = [
      { id: 't1', label: 'typed' },
      { id: 't2', label: 'new' },
    ];
    const o = args({ participant: true, tabs });
    renderHook(() => useUnloadFlushCore(deps, o));
    window.dispatchEvent(new Event('pagehide'));
    expect(deps.relayParticipantTab).toHaveBeenNthCalledWith(1, o, 'd1', saved, tabs[0]);
    expect(deps.relayParticipantTab).toHaveBeenNthCalledWith(2, o, 'd1', undefined, tabs[1]);
    expect(deps.sendBeacon).not.toHaveBeenCalled();
  });

  it.each([
    ['before hydration', args({ hydrated: false })],
    ['with no item', args({ itemId: null })],
    ['read-only', args({ isReadOnly: true })],
    ['with nothing changed', args({ tabs: [saved] })],
  ])('sends nothing %s', (_name, o) => {
    const deps = makeDeps();
    renderHook(() => useUnloadFlushCore(deps, o));
    window.dispatchEvent(new Event('pagehide'));
    expect(deps.sendBeacon).not.toHaveBeenCalled();
    expect(deps.relayParticipantTab).not.toHaveBeenCalled();
  });

  it('never sends a deleted item back', () => {
    const deps = makeDeps({ isItemDeleted: vi.fn(() => true) });
    renderHook(() => useUnloadFlushCore(deps, args()));
    window.dispatchEvent(new Event('pagehide'));
    expect(deps.isItemDeleted).toHaveBeenCalledWith('d1');
    expect(deps.sendBeacon).not.toHaveBeenCalled();
  });

  it('sends nothing once the server refused a write, but still asks before leaving', () => {
    const deps = makeDeps();
    renderHook(() => useUnloadFlushCore(deps, args({ writesForbiddenRef: { current: true } })));
    const e = leaveEvent();
    expect(deps.sendBeacon).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(true);
  });

  it('commits a label still being typed, synchronously, before the flush reads the tabs', () => {
    const order: string[] = [];
    const unregister = registerOpenEdit(() => order.push('commit'));
    const deps = makeDeps({ sendBeacon: vi.fn(() => order.push('send')) });
    renderHook(() => useUnloadFlushCore(deps, args()));
    window.dispatchEvent(new Event('pagehide'));
    unregister();
    expect(order).toEqual(['commit', 'send']);
  });

  it('asks before leaving with unsaved changes while saves fail, a tab is too large or the browser is offline', () => {
    const deps = makeDeps();
    renderHook(() => useUnloadFlushCore(deps, args()));
    // Healthy and online: never asks.
    expect(leaveEvent().defaultPrevented).toBe(false);
    noteSaveFailing(true);
    expect(leaveEvent().defaultPrevented).toBe(true);
    noteSaveFailing(false);
    noteTabTooLarge(true);
    expect(leaveEvent().defaultPrevented).toBe(true);
    noteTabTooLarge(false);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(leaveEvent().defaultPrevented).toBe(true);
  });

  it('never asks with nothing unsaved, offline or not', () => {
    const deps = makeDeps();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderHook(() => useUnloadFlushCore(deps, args({ tabs: [saved] })));
    expect(leaveEvent().defaultPrevented).toBe(false);
  });
});
