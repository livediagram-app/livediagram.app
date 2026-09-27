// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/diagram';

// The autosave stands down while a peer's op has reached the baseline but not yet this render's `tabs`
// (docs/specs/012-collaboration/collab-race-hardening.md), and re-arms on the render that carries it. The
// count of ops a render includes is state (react-state-and-effects.md), never a ref read during render.
const apiSaveTab = vi.fn(() => Promise.resolve());
vi.mock('@/lib/api-client', () => ({
  apiSaveTab: (...a: unknown[]) => apiSaveTab(...(a as [])),
  apiDeleteTab: vi.fn(() => Promise.resolve()),
  apiSaveDiagramMeta: vi.fn(() => Promise.resolve()),
  flushDiagramSavesBeacon: vi.fn(),
  reportSaveFailure: vi.fn(),
  connectRoom: vi.fn(),
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
  const useSubject = (tabs: Tab[], opsApplied: number) =>
    useAutosave({
      hydrated: true,
      diagramId: 'd1',
      isReadOnly: false,
      tabs,
      diagramName: 'D',
      selfId: 'me',
      sessionShareCode: null,
      opsApplied,
      ...refs,
      setSaveStatus: vi.fn(),
      setSavedAt: vi.fn(),
      setDiagramList: vi.fn(),
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
