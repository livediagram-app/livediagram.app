// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';

// docs/specs/006-document/per-tab-storage.md "Saving": the edits still inside the debounce go when the editor goes.
const flush = vi.fn<typeof import('@/lib/api-client').flushDocumentSavesBeacon>();
vi.mock('@/lib/api-client', () => ({
  flushDocumentSavesBeacon: (...a: Parameters<typeof flush>) => flush(...a),
}));
vi.mock('@/lib/document-tombstones', () => ({ isDocumentDeleted: () => false }));

const { useUnloadFlush, shouldWarnOnLeave } = await import('./useUnloadFlush');
const { noteSaveFailing } = await import('@/lib/save-health');
const { useCommitOnLeave } = await import('@/hooks/ui/useCommitOnLeave');

const tab = (label: string): Tab => ({
  id: 't1',
  name: 'T',
  elements: [{ id: 'e', type: 'text', x: 0, y: 0, width: 10, height: 10, label }],
});

const options = (tabs: Tab[], participant = false, send = vi.fn()) => ({
  hydrated: true,
  documentId: 'd1',
  isReadOnly: false,
  participant,
  tabs,
  documentName: 'Doc',
  selfId: 'me',
  sessionShareCode: null,
  lastSavedTabsRef: { current: [tab('saved')] },
  lastSavedNameRef: { current: 'Doc' },
  loadedTabIdsRef: { current: new Set(['t1']) },
  changesetSeen: new Map(),
  writesForbiddenRef: { current: false },
  roomRef: { current: { send } as never },
});

function mount(tabs: Tab[], participant = false, send = vi.fn()) {
  return renderHook(() => useUnloadFlush(options(tabs, participant, send)));
}

describe('useUnloadFlush', () => {
  beforeEach(() => flush.mockClear());

  it('flushes on pagehide, once for the same content however many events follow', () => {
    mount([tab('typed')]);
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('beforeunload'));
    expect(flush).toHaveBeenCalledOnce();
    expect(flush.mock.calls[0]![0]).toMatchObject({
      documentId: 'd1',
      changedTabs: [tab('typed')],
    });
  });

  it('flushes when the editor unmounts for another page of the app', () => {
    const view = mount([tab('typed')]);
    view.unmount();
    expect(flush).toHaveBeenCalledOnce();
  });

  // docs/specs/013-workspace/share-roles.md: a Participant's changes go to the open room, never a beacon.
  it("relays a Participant's changes to the room instead of a beacon", () => {
    const send = vi.fn();
    mount([tab('typed')], true, send);
    window.dispatchEvent(new Event('pagehide'));
    expect(flush).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'op', op: expect.objectContaining({ tabId: 't1' }) }),
    );
  });

  // A label still open when the page goes commits on blur, which a reload never fires: the flush commits it first.
  it('commits a label still being typed before it reads the tabs', () => {
    const view = renderHook(() => {
      const [tabs, setTabs] = useState([tab('saved')]);
      useCommitOnLeave(true, () => setTabs([tab('typed but never blurred')]));
      useUnloadFlush(options(tabs));
    });
    window.dispatchEvent(new Event('pagehide'));
    expect(flush).toHaveBeenCalledOnce();
    expect(flush.mock.calls[0]![0].changedTabs).toEqual([tab('typed but never blurred')]);
    view.unmount();
  });

  it('commits no edit once it has closed', () => {
    const commit = vi.fn();
    const view = renderHook(({ open }) => useCommitOnLeave(open, commit), {
      initialProps: { open: true },
    });
    view.rerender({ open: false });
    mount([tab('saved')]);
    window.dispatchEvent(new Event('pagehide'));
    expect(commit).not.toHaveBeenCalled();
  });

  it('sends nothing when everything is saved', () => {
    const view = mount([tab('saved')]);
    window.dispatchEvent(new Event('pagehide'));
    view.unmount();
    expect(flush).not.toHaveBeenCalled();
  });
});

// docs/specs/007-editor/load-recovery.md "Leaving with unsaved changes asks first".
describe('the leave prompt', () => {
  const setOnline = (online: boolean) =>
    Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
  const leave = () => {
    const e = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  };
  beforeEach(() => {
    flush.mockClear();
    noteSaveFailing(false);
    setOnline(true);
  });

  it('asks with unsaved changes while saves fail or the browser is offline', () => {
    expect(shouldWarnOnLeave(true, true, true)).toBe(true);
    expect(shouldWarnOnLeave(true, false, false)).toBe(true);
    expect(shouldWarnOnLeave(true, false, true)).toBe(false);
    expect(shouldWarnOnLeave(false, true, false)).toBe(false);
  });

  it('raises the prompt while the last save failed, still flushing what it can', () => {
    const view = mount([tab('typed')]);
    noteSaveFailing(true);
    expect(leave()).toBe(true);
    expect(flush).toHaveBeenCalledOnce();
    view.unmount();
  });

  it('raises the prompt offline', () => {
    const view = mount([tab('typed')]);
    setOnline(false);
    expect(leave()).toBe(true);
    view.unmount();
  });

  it('never asks in the healthy case, or with everything saved', () => {
    const view = mount([tab('typed')]);
    expect(leave()).toBe(false);
    view.unmount();
    noteSaveFailing(true);
    const saved = mount([tab('saved')]);
    expect(leave()).toBe(false);
    saved.unmount();
  });
});
