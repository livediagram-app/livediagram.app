// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';

// docs/specs/006-document/per-tab-storage.md "Saving": the edits still inside the debounce go when the editor goes.
const flush = vi.fn();
vi.mock('@/lib/api-client', () => ({ flushDocumentSavesBeacon: (a: unknown) => flush(a) }));
vi.mock('@/lib/document-tombstones', () => ({ isDocumentDeleted: () => false }));

const { useUnloadFlush } = await import('./useUnloadFlush');

const tab = (label: string): Tab =>
  ({
    id: 't1',
    name: 'T',
    elements: [{ id: 'e', type: 'text', x: 0, y: 0, width: 10, height: 10, label }],
  }) as Tab;

function mount(tabs: Tab[]) {
  return renderHook(() =>
    useUnloadFlush({
      hydrated: true,
      documentId: 'd1',
      isReadOnly: false,
      tabs,
      documentName: 'Doc',
      selfId: 'me',
      sessionShareCode: null,
      lastSavedTabsRef: { current: [tab('saved')] },
      lastSavedNameRef: { current: 'Doc' },
      loadedTabIdsRef: { current: new Set(['t1']) },
      changesetSeen: new Map(),
      writesForbiddenRef: { current: false },
    }),
  );
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

  it('sends nothing when everything is saved', () => {
    const view = mount([tab('saved')]);
    window.dispatchEvent(new Event('pagehide'));
    view.unmount();
    expect(flush).not.toHaveBeenCalled();
  });
});
