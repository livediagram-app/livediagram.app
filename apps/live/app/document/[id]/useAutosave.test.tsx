// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';

// The autosave stands down while a peer's op has reached the baseline but not yet this render's `tabs`
// (docs/specs/012-collaboration/collab-race-hardening.md), and re-arms on the render that carries it. The
// count of ops a render includes is state (react-state-and-effects.md), never a ref read during render.
const apiSaveTab = vi.fn(() => Promise.resolve());
vi.mock('@/lib/api-client', () => ({
  apiSaveTab: (...a: unknown[]) => apiSaveTab(...(a as [])),
  apiDeleteTab: vi.fn(() => Promise.resolve()),
  apiSaveDocumentMeta: vi.fn(() => Promise.resolve()),
  flushDocumentSavesBeacon: vi.fn(),
  reportSaveFailure: vi.fn(),
  connectRoom: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(action: string, status: number) {
      super(`${action} failed: ${status}`);
      this.status = status;
    }
  },
  SessionTokenUnavailableError: class SessionTokenUnavailableError extends Error {},
}));

const { useAutosave } = await import('./useAutosave');
const { createRemoteOpJournal } = await import('./save-baseline');

const tab = (label: string): Tab =>
  ({
    id: 't1',
    name: 'A',
    elements: [
      { id: 'e1', type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, label },
    ],
  }) as unknown as Tab;

beforeEach(() => {
  vi.useFakeTimers();
  apiSaveTab.mockClear();
});
afterEach(() => vi.useRealTimers());

function setup() {
  const journal = { current: createRemoteOpJournal() };
  const refs = {
    lastSavedTabsRef: { current: [tab('saved')] },
    lastSavedNameRef: { current: 'D' },
    loadedTabIdsRef: { current: new Set(['t1']) },
    remoteOpJournalRef: journal,
    previewingRef: { current: false },
    roomRef: { current: null },
  };
  // Stable, as the real state setters are: a fresh function each render would re-run the save
  // effect on every render and hide whether it re-runs for the right reason.
  const setters = { setSaveStatus: vi.fn(), setSavedAt: vi.fn(), setDocumentList: vi.fn() };
  const useSubject = (tabs: Tab[], opsApplied: number, onDocumentTrashed: () => void = () => {}) =>
    useAutosave({
      hydrated: true,
      documentId: 'd1',
      isReadOnly: false,
      tabs,
      documentName: 'D',
      selfId: 'me',
      sessionShareCode: null,
      opsApplied,
      ...refs,
      ...setters,
      onDocumentTrashed,
    });
  return { journal, useSubject };
}

describe('useAutosave and peer ops', () => {
  it('saves a local edit after the debounce', () => {
    const { useSubject } = setup();
    renderHook(({ tabs, n }) => useSubject(tabs, n), {
      initialProps: { tabs: [tab('mine')], n: 0 },
    });
    act(() => vi.advanceTimersByTime(600));
    expect(apiSaveTab).toHaveBeenCalledTimes(1);
  });

  it('stands down while an op is in the baseline but not on screen, then re-arms', () => {
    const { journal, useSubject } = setup();
    const { rerender } = renderHook(({ tabs, n }) => useSubject(tabs, n), {
      initialProps: { tabs: [tab('mine')], n: 0 },
    });
    // A peer op lands in the journal; the render carrying it has not happened yet.
    journal.current.next = 1;
    act(() => vi.advanceTimersByTime(600));
    expect(apiSaveTab).not.toHaveBeenCalled();
    // The render that includes the op re-arms the timer.
    rerender({ tabs: [tab('mine')], n: 1 });
    act(() => vi.advanceTimersByTime(600));
    expect(apiSaveTab).toHaveBeenCalledTimes(1);
  });
});

describe('useAutosave and the Trash', () => {
  it('reports a save refused as trashed to the current callback, and stops writing', async () => {
    const { DocumentTrashedError } = await import('@/lib/document-trashed');
    apiSaveTab.mockImplementation(() => Promise.reject(new DocumentTrashedError('d1')));
    const { useSubject } = setup();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ tabs, cb }) => useSubject(tabs, 0, cb), {
      initialProps: { tabs: [tab('mine')], cb: first },
    });
    // A new callback identity (the caller's inline arrow) must not re-arm the debounce...
    rerender({ tabs: [tab('mine')], cb: second });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(apiSaveTab).toHaveBeenCalledTimes(1);
    // ...and the refusal reaches the callback the caller passes now.
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    // Writes stop: a later edit is not sent.
    rerender({ tabs: [tab('edited again')], cb: second });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(apiSaveTab).toHaveBeenCalledTimes(1);
    apiSaveTab.mockImplementation(() => Promise.resolve());
  });
});

describe('useAutosave after a failed save', () => {
  it('retries on its own after a network failure, with no further edit', async () => {
    apiSaveTab.mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')));
    const { useSubject } = setup();
    renderHook(({ tabs }) => useSubject(tabs, 0), { initialProps: { tabs: [tab('mine')] } });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(apiSaveTab).toHaveBeenCalledTimes(1);
    // The first retry comes after the backoff, then the usual debounce.
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(apiSaveTab).toHaveBeenCalledTimes(2);
  });

  it('does not retry a refusal', async () => {
    const { ApiError } = await import('@/lib/api-client');
    const Refusal = ApiError as unknown as new (action: string, status: number) => Error;
    apiSaveTab.mockImplementationOnce(() => Promise.reject(new Refusal('save tab', 403)));
    const { useSubject } = setup();
    renderHook(({ tabs }) => useSubject(tabs, 0), { initialProps: { tabs: [tab('mine')] } });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });
    expect(apiSaveTab).toHaveBeenCalledTimes(1);
  });
});

// docs/specs/016-platform/new-version-prompt.md: "Reload" waits until nothing edited is unsaved.
describe('hasUnsavedChanges', () => {
  it('is true while an edit waits out the debounce or its save is in flight, false once saved', async () => {
    let finish: () => void = () => {};
    apiSaveTab.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
    const { useSubject } = setup();
    const { result } = renderHook(({ tabs, n }) => useSubject(tabs, n), {
      initialProps: { tabs: [tab('mine')], n: 0 },
    });
    expect(result.current.hasUnsavedChanges()).toBe(true);
    act(() => vi.advanceTimersByTime(600));
    expect(apiSaveTab).toHaveBeenCalledTimes(1);
    expect(result.current.hasUnsavedChanges()).toBe(true);
    await act(async () => {
      finish();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.hasUnsavedChanges()).toBe(false);
  });

  it('is false when nothing differs from the last save', () => {
    const { useSubject } = setup();
    const { result } = renderHook(({ tabs, n }) => useSubject(tabs, n), {
      initialProps: { tabs: [tab('saved')], n: 0 },
    });
    expect(result.current.hasUnsavedChanges()).toBe(false);
  });
});
