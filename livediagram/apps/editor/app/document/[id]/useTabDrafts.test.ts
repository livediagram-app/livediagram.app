// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import type { TabDraftEvent } from '@liveworkspace/workbench/lib/api/tab-drafts';
import { draftDroppedMessage, draftRestoredMessage, useTabDrafts, withDraft } from './useTabDrafts';

// The editor's side of the drafts (docs/specs/006-document/delta-saves.md "Drafts of unsaved changes"): a draft a
// load put back goes on screen over its stored tab for an Editor, and one overtaken is said.

const listeners = new Set<(e: TabDraftEvent) => void>();
const replays = new Map<string, Tab>();
const discarded: string[] = [];
vi.mock('@/lib/api-client', () => ({
  onTabDraft: (listener: (e: TabDraftEvent) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  apiDiscardDraft: (ownerId: string, itemId: string, tabId: string) =>
    void discarded.push(`${ownerId}/${itemId}/${tabId}`),
  apiTakeDraftReplay: (ownerId: string, itemId: string, tabId: string) => {
    const key = `${ownerId}/${itemId}/${tabId}`;
    const tab = replays.get(key) ?? null;
    replays.delete(key);
    return tab;
  },
}));

const el = (id: string, label: string) => ({ id, type: 'text', x: 0, y: 0, label }) as never;
const storedTab: Tab = { id: 't1', name: 'Board', elements: [el('a', 'stored')], folder: 'F' };
const draftTab: Tab = { id: 't1', name: 'Board', elements: [el('a', 'draft')] };

describe('withDraft', () => {
  it('puts the draft over the stored tab, keeping the local folder', () => {
    const next = withDraft([storedTab], [storedTab], draftTab);
    expect(next[0]).toEqual({ ...draftTab, folder: 'F' });
  });

  it('leaves a tab edited since the load, a tab not on screen, or one with no baseline', () => {
    const edited = { ...storedTab, elements: [el('a', 'typed')] };
    const tabs = [edited];
    expect(withDraft(tabs, [storedTab], draftTab)).toBe(tabs);
    expect(withDraft([], [storedTab], draftTab)).toEqual([]);
    const shown = [storedTab];
    expect(withDraft(shown, [], draftTab)).toBe(shown);
  });
});

describe('the messages', () => {
  it('name the tab, or say this tab', () => {
    expect(draftDroppedMessage('Board')).toBe(
      "Couldn't apply your last unsaved edit to “Board”: the tab changed since.",
    );
    expect(draftDroppedMessage(null)).toContain('to this tab:');
    expect(draftRestoredMessage('Board')).toBe('Restored your last unsaved edit to “Board”.');
    expect(draftRestoredMessage('')).toBe('Restored your last unsaved edit to this tab.');
  });
});

describe('useTabDrafts', () => {
  beforeEach(() => {
    listeners.clear();
    replays.clear();
    discarded.length = 0;
  });

  function mount(over: { mayEdit?: boolean; loaded?: string[]; documentId?: string | null } = {}) {
    const tabsRef = { current: [storedTab] };
    const lastSavedTabsRef = { current: [storedTab] };
    const applied: Tab[][] = [];
    const applyLoaded = vi.fn((apply: (tabs: Tab[]) => Tab[]) => {
      tabsRef.current = apply(tabsRef.current);
      applied.push(tabsRef.current);
    });
    const toast = { info: vi.fn(), warning: vi.fn() };
    const props = {
      hydrated: true,
      documentId: over.documentId === undefined ? 'd1' : over.documentId,
      selfId: 'me',
      mayEdit: over.mayEdit ?? true,
      tabsRef,
      lastSavedTabsRef,
      loadedTabIds: new Set(over.loaded ?? ['t1']) as ReadonlySet<string>,
      applyLoaded,
      toast,
    };
    const hook = renderHook((p: typeof props) => useTabDrafts(p), { initialProps: props });
    const emit = (e: Partial<TabDraftEvent>) =>
      act(() => {
        for (const listener of listeners) {
          listener({ kind: 'replay', ownerId: 'me', itemId: 'd1', tabId: 't1', name: null, ...e });
        }
      });
    return { hook, props, emit, applyLoaded, toast, tabsRef };
  }

  it('puts a draft back on screen for an Editor, once, and says so', () => {
    const { emit, applyLoaded, toast, tabsRef } = mount();
    replays.set('me/d1/t1', draftTab);
    emit({});
    expect(applyLoaded).toHaveBeenCalledTimes(1);
    expect(tabsRef.current[0]!.elements).toEqual(draftTab.elements);
    expect(toast.info).toHaveBeenCalledWith(draftRestoredMessage('Board'));
    expect(discarded).toEqual([]);
    emit({});
    expect(applyLoaded).toHaveBeenCalledTimes(1);
  });

  it('waits for the tab to load, then takes the draft', () => {
    const { hook, props, emit, applyLoaded } = mount({ loaded: [] });
    replays.set('me/d1/t1', draftTab);
    emit({});
    expect(applyLoaded).not.toHaveBeenCalled();
    hook.rerender({ ...props, loadedTabIds: new Set(['t1']) });
    expect(applyLoaded).toHaveBeenCalledTimes(1);
  });

  it('a session that may not edit leaves the draft waiting', () => {
    const { emit, applyLoaded } = mount({ mayEdit: false });
    replays.set('me/d1/t1', draftTab);
    emit({});
    expect(applyLoaded).not.toHaveBeenCalled();
    expect(replays.has('me/d1/t1')).toBe(true);
  });

  it('no document, nothing taken', () => {
    const { emit, applyLoaded } = mount({ documentId: null });
    replays.set('me/d1/t1', draftTab);
    emit({});
    expect(applyLoaded).not.toHaveBeenCalled();
  });

  it('a tab edited since its load keeps its edits, the draft goes, and nothing is said', () => {
    const { emit, applyLoaded, toast, tabsRef } = mount();
    tabsRef.current = [{ ...storedTab, elements: [el('a', 'typed')] }];
    replays.set('me/d1/t1', { ...draftTab, name: 7 as never });
    emit({});
    expect(applyLoaded).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    expect(discarded).toEqual(['me/d1/t1']);
  });

  it('a restored draft with no name says this tab', () => {
    const { emit, toast } = mount();
    replays.set('me/d1/t1', { ...draftTab, name: 7 as never });
    emit({});
    expect(toast.info).toHaveBeenCalledWith(draftRestoredMessage(null));
  });

  it('says when a draft was overtaken, for this document and person only', () => {
    const { emit, toast } = mount();
    emit({ kind: 'stale', name: 'Board', itemId: 'other' });
    emit({ kind: 'stale', name: 'Board', ownerId: 'someone' });
    expect(toast.warning).not.toHaveBeenCalled();
    emit({ kind: 'stale', name: 'Board' });
    expect(toast.warning).toHaveBeenCalledWith(draftDroppedMessage('Board'));
  });

  it('says a draft dropped before the document id is known, once it is', () => {
    const { hook, props, emit, toast } = mount({ documentId: null });
    emit({ kind: 'stale', name: 'Board' });
    expect(toast.warning).not.toHaveBeenCalled();
    hook.rerender({ ...props, documentId: 'd1' });
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledWith(draftDroppedMessage('Board'));
    hook.rerender({ ...props, documentId: 'd1', hydrated: false });
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });
});
