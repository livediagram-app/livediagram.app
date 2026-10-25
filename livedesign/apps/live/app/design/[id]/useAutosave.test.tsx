// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedesign/design';
import type { connectRoom } from '@/lib/api-client';
import { whenTabSaved } from '@liveworkspace/workbench/lib/tab-saved';

type Room = ReturnType<typeof connectRoom>;

// The autosave stands down while a peer's op has reached the baseline but not yet this render's `tabs`
// (docs/specs/012-collaboration/collab-race-hardening.md), and re-arms on the render that carries it. The
// count of ops a render includes is state (react-state-and-effects.md), never a ref read during render.
const apiSaveTab = vi.fn((): Promise<number | null> => Promise.resolve(null));
const apiSaveDesignMeta = vi.fn((): Promise<void> => Promise.resolve());
vi.mock('@/lib/api-client', () => ({
  apiSaveTab: (...a: unknown[]) => apiSaveTab(...(a as [])),
  apiDeleteTab: vi.fn(() => Promise.resolve()),
  apiSaveDesignMeta: (...a: unknown[]) => apiSaveDesignMeta(...(a as [])),
  flushDesignSavesBeacon: vi.fn(),
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

const timing = vi.hoisted(() => ({ end: vi.fn(), cancel: vi.fn(), endAfterPaint: vi.fn() }));
const sampleSaveTiming = vi.hoisted(() => vi.fn(() => true));
const startEditorTiming = vi.hoisted(() => vi.fn(() => timing));
vi.mock('@/lib/timing', () => ({ sampleSaveTiming, startEditorTiming }));

const { useAutosave } = await import('./useAutosave');
const { createRemoteOpJournal, foldRemoteOpIntoBaseline, SAVE_RESAVE_GRACE_MS } =
  await import('./save-baseline');

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
  apiSaveDesignMeta.mockClear();
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
    roomRef: { current: null as Room | null },
  };
  // Stable, as the real state setters are: a fresh function each render would re-run the save
  // effect on every render and hide whether it re-runs for the right reason.
  const setters = { setSaveStatus: vi.fn(), setSavedAt: vi.fn(), setDesignList: vi.fn() };
  const noneSeen: ReadonlyMap<string, number> = new Map();
  const useSubject = (
    tabs: Tab[],
    opsApplied: number,
    onDesignTrashed: () => void = () => {},
    changesetSeen: ReadonlyMap<string, number> = noneSeen,
    noteTabRevision?: (tabId: string, rev: number) => void,
  ) =>
    useAutosave({
      hydrated: true,
      designId: 'd1',
      isReadOnly: false,
      tabs,
      designName: 'D',
      selfId: 'me',
      sessionShareCode: null,
      opsApplied,
      ...refs,
      ...setters,
      onDesignTrashed,
      changesetSeen,
      noteTabRevision,
    });
  return { journal, refs, useSubject };
}

// The selection reference names the revision the editor knows (docs/specs/013-workspace/blueprints/
// workbench-embeds.md "The selection reference"): a save's answer is one.
describe('useAutosave and tab revisions', () => {
  it('notes the revision each save wrote, and nothing when the answer names none', async () => {
    const { useSubject } = setup();
    const noted = vi.fn();
    apiSaveTab.mockResolvedValueOnce(12);
    const { rerender } = renderHook(({ tabs }) => useSubject(tabs, 0, () => {}, undefined, noted), {
      initialProps: { tabs: [tab('mine')] },
    });
    await act(async () => vi.advanceTimersByTime(600));
    expect(noted).toHaveBeenCalledWith('t1', 12);

    rerender({ tabs: [tab('again')] });
    await act(async () => vi.advanceTimersByTime(600));
    expect(noted).toHaveBeenCalledTimes(1);
  });
});

describe('useAutosave and waiting creates', () => {
  it('notes each saved tab, so a sheet waiting for its new tab is sent (issue #984)', async () => {
    const { useSubject } = setup();
    let saved: boolean | null = null;
    void whenTabSaved('d1', 't1', 5_000).then((v) => (saved = v));
    renderHook(({ tabs }) => useSubject(tabs, 0), { initialProps: { tabs: [tab('mine')] } });
    await act(async () => vi.advanceTimersByTime(600));
    expect(saved).toBe(true);
  });
});

describe('useAutosave and peer ops', () => {
  it('saves a local edit after the debounce', () => {
    const { useSubject } = setup();
    renderHook(({ tabs, n }) => useSubject(tabs, n), {
      initialProps: { tabs: [tab('mine')], n: 0 },
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(apiSaveTab).toHaveBeenCalledTimes(1);
  });

  it('stands down while an op is in the baseline but not on screen, then re-arms', () => {
    const { journal, useSubject } = setup();
    const { rerender } = renderHook(({ tabs, n }) => useSubject(tabs, n), {
      initialProps: { tabs: [tab('mine')], n: 0 },
    });
    // A peer op lands in the journal; the render carrying it has not happened yet.
    journal.current.next = 1;
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(apiSaveTab).not.toHaveBeenCalled();
    // The render that includes the op re-arms the timer.
    rerender({ tabs: [tab('mine')], n: 1 });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(apiSaveTab).toHaveBeenCalledTimes(1);
  });
});

describe('useAutosave and the Trash', () => {
  it('reports a save refused as trashed to the current callback, and stops writing', async () => {
    const { DesignTrashedError } = await import('@/lib/design-trashed');
    apiSaveTab.mockImplementation(() => Promise.reject(new DesignTrashedError('d1')));
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
    apiSaveTab.mockImplementation(() => Promise.resolve(null));
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

  // docs/specs/007-editor/load-recovery.md "Offline": reconnecting saves at once.
  it('retries as soon as the browser is back online, not after the backoff', async () => {
    apiSaveTab.mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')));
    const { useSubject } = setup();
    renderHook(({ tabs }) => useSubject(tabs, 0), { initialProps: { tabs: [tab('mine')] } });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(apiSaveTab).toHaveBeenCalledTimes(1);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(apiSaveTab).toHaveBeenCalledTimes(2);
  });

  it('does not save on reconnect when nothing is waiting to retry', async () => {
    const { useSubject } = setup();
    renderHook(({ tabs }) => useSubject(tabs, 0), { initialProps: { tabs: [tab('mine')] } });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(apiSaveTab).toHaveBeenCalledTimes(1);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      vi.advanceTimersByTime(600);
    });
    expect(apiSaveTab).toHaveBeenCalledTimes(1);
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

// per-tab-storage.md "A tab too big to save says so": a 413 waits for an edit, never a timer.
describe('useAutosave with a tab too big to save', () => {
  it('does not retry on a timer, and saves again on the next edit', async () => {
    const { ApiError } = await import('@/lib/api-client');
    const TooLarge = ApiError as unknown as new (action: string, status: number) => Error;
    apiSaveTab.mockImplementationOnce(() => Promise.reject(new TooLarge('save tab', 413)));
    const { useSubject } = setup();
    const view = renderHook(({ tabs }) => useSubject(tabs, 0), {
      initialProps: { tabs: [tab('mine')] },
    });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });
    expect(apiSaveTab).toHaveBeenCalledTimes(1);
    view.rerender({ tabs: [tab('smaller')] });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(apiSaveTab).toHaveBeenCalledTimes(2);
  });
});

// docs/specs/016-platform/new-version-prompt.md: "Reload" waits until nothing edited is unsaved.
describe('hasUnsavedChanges', () => {
  it('is true while an edit waits out the debounce or its save is in flight, false once saved', async () => {
    let finish: () => void = () => {};
    apiSaveTab.mockImplementationOnce(
      () => new Promise<number | null>((resolve) => (finish = () => resolve(null))),
    );
    const { useSubject } = setup();
    const { result } = renderHook(({ tabs, n }) => useSubject(tabs, n), {
      initialProps: { tabs: [tab('mine')], n: 0 },
    });
    expect(result.current.hasUnsavedChanges()).toBe(true);
    act(() => {
      vi.advanceTimersByTime(600);
    });
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

// docs/specs/024-agents/agent-changesets.md "The write path" step 8: each save says which
// changesets its snapshot holds, from the same render as the snapshot.
describe('useAutosave and changesets', () => {
  it('sends the seen revision of the tab it saves, and none for a tab without one', async () => {
    const { useSubject } = setup();
    const { rerender } = renderHook(({ tabs, seen }) => useSubject(tabs, 0, () => {}, seen), {
      initialProps: {
        tabs: [tab('mine')],
        seen: new Map([['t1', 5]]),
      },
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(apiSaveTab).toHaveBeenLastCalledWith(
      'me',
      'd1',
      expect.anything(),
      null,
      expect.objectContaining({ changesetSeen: 5 }),
    );
    rerender({ tabs: [tab('again')], seen: new Map() });
    // The tab's second save goes once its first has settled (tab-save-queue.ts).
    await act(async () => {
      vi.advanceTimersByTime(600);
      await vi.runAllTimersAsync();
    });
    expect(apiSaveTab).toHaveBeenLastCalledWith(
      'me',
      'd1',
      expect.anything(),
      null,
      expect.not.objectContaining({ changesetSeen: expect.anything() }),
    );
  });
});

// docs/specs/012-collaboration/collab-race-hardening.md "Saves": a tab's newer save never overtakes its older one.
describe('useAutosave ordering', () => {
  it("holds a tab's newer save until its older one has landed", async () => {
    const { useSubject } = setup();
    let land!: (rev: number | null) => void;
    apiSaveTab.mockImplementationOnce(() => new Promise((r) => (land = r)));
    const { rerender } = renderHook(({ tabs }) => useSubject(tabs, 0, () => {}), {
      initialProps: { tabs: [tab('first')] },
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(apiSaveTab).toHaveBeenCalledTimes(1);
    rerender({ tabs: [tab('second')] });
    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });
    expect(apiSaveTab).toHaveBeenCalledTimes(1);
    await act(async () => {
      land(1);
      await vi.runAllTimersAsync();
    });
    expect(apiSaveTab).toHaveBeenCalledTimes(2);
  });
});

// docs/specs/006-design/per-tab-storage.md "New tabs and the tab order": the order only places rows that exist, so a
// tab added with others (a template's tabs) is saved before the order naming it, or it lands at the end by its id.
describe('useAutosave and new tabs', () => {
  it('writes the tab order once the new tabs it names are saved', async () => {
    const { useSubject, refs } = setup();
    const added = { ...tab('new'), id: 't2', name: 'Backlog' };
    refs.loadedTabIdsRef.current.add('t2');
    let land!: (rev: number | null) => void;
    apiSaveTab.mockImplementation((...a: unknown[]) =>
      (a[2] as Tab).id === 't2' ? new Promise((r) => (land = r)) : Promise.resolve(null),
    );
    renderHook(({ tabs }) => useSubject(tabs, 0), {
      initialProps: { tabs: [tab('saved'), added] },
    });
    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });
    expect(apiSaveTab).toHaveBeenCalledTimes(1);
    expect(apiSaveDesignMeta).not.toHaveBeenCalled();
    await act(async () => {
      land(1);
      await vi.runAllTimersAsync();
    });
    expect(apiSaveDesignMeta).toHaveBeenCalledTimes(1);
    expect(apiSaveDesignMeta.mock.calls[0]).toEqual(
      expect.arrayContaining([expect.objectContaining({ tabs: [{ id: 't1' }, { id: 't2' }] })]),
    );
    apiSaveTab.mockReset();
    apiSaveTab.mockImplementation(() => Promise.resolve(null));
  });

  it('still writes the order when a new tab fails to save', async () => {
    const { useSubject, refs } = setup();
    const added = { ...tab('new'), id: 't2', name: 'Backlog' };
    refs.loadedTabIdsRef.current.add('t2');
    apiSaveTab.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    renderHook(({ tabs }) => useSubject(tabs, 0), {
      initialProps: { tabs: [tab('saved'), added] },
    });
    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(apiSaveDesignMeta).toHaveBeenCalledTimes(1);
  });
});

// The Save timing (docs/specs/017-telemetry/timing-telemetry.md): Saving to Saved, sampled, never a
// failed save.
describe('useAutosave Save timing', () => {
  beforeEach(() => {
    Object.values(timing).forEach((fn) => fn.mockClear());
    startEditorTiming.mockClear();
    sampleSaveTiming.mockReset().mockReturnValue(true);
  });

  it('ends when the save lands', async () => {
    const { useSubject } = setup();
    renderHook(({ tabs }) => useSubject(tabs, 0), { initialProps: { tabs: [tab('mine')] } });
    await act(async () => vi.advanceTimersByTime(600));
    expect(startEditorTiming).toHaveBeenCalledWith('Save');
    expect(timing.end).toHaveBeenCalledTimes(1);
  });

  it('is dropped when the sampler holds it', async () => {
    sampleSaveTiming.mockReturnValue(false);
    const { useSubject } = setup();
    renderHook(({ tabs }) => useSubject(tabs, 0), { initialProps: { tabs: [tab('mine')] } });
    await act(async () => vi.advanceTimersByTime(600));
    expect(timing.end).not.toHaveBeenCalled();
    expect(timing.cancel).toHaveBeenCalled();
  });

  it('is dropped for a failed save', async () => {
    apiSaveTab.mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')));
    const { useSubject } = setup();
    renderHook(({ tabs }) => useSubject(tabs, 0), { initialProps: { tabs: [tab('mine')] } });
    await act(async () => vi.advanceTimersByTime(600));
    expect(timing.end).not.toHaveBeenCalled();
    expect(timing.cancel).toHaveBeenCalled();
  });
});

// docs/specs/012-collaboration/collab-race-hardening.md "A save that wrote over a peer's change writes again".
describe('useAutosave and a peer change during a save', () => {
  const peerEdit = {
    kind: 'el' as const,
    tabId: 't1',
    op: { kind: 'update' as const, element: tab('peer').elements[0]! },
  };

  it('writes the tab again, as it is on screen, once the save has landed', async () => {
    const { journal, refs, useSubject } = setup();
    let land: (rev: number | null) => void = () => {};
    apiSaveTab.mockImplementationOnce(() => new Promise((resolve) => (land = resolve)));
    const { rerender } = renderHook(({ tabs, n }) => useSubject(tabs, n), {
      initialProps: { tabs: [tab('mine')], n: 0 },
    });
    await act(async () => vi.advanceTimersByTime(600));
    expect(apiSaveTab).toHaveBeenCalledTimes(1);
    // A peer's change arrives while our write is in flight: on screen and in the baseline.
    foldRemoteOpIntoBaseline(
      { tabs: refs.lastSavedTabsRef, name: refs.lastSavedNameRef, journal },
      peerEdit,
    );
    rerender({ tabs: [tab('peer')], n: 1 });
    await act(async () => land(null));
    await act(async () => vi.advanceTimersByTime(SAVE_RESAVE_GRACE_MS));
    await act(async () => vi.advanceTimersByTime(600));
    expect(apiSaveTab).toHaveBeenCalledTimes(2);
    expect(apiSaveTab.mock.calls[1]).toEqual(
      expect.arrayContaining([expect.objectContaining({ elements: tab('peer').elements })]),
    );
    // And once is enough: nothing changed since.
    await act(async () => vi.advanceTimersByTime(SAVE_RESAVE_GRACE_MS));
    await act(async () => vi.advanceTimersByTime(600));
    expect(apiSaveTab).toHaveBeenCalledTimes(2);
  });

  it('writes nothing more when no peer changed the tab', async () => {
    const { useSubject } = setup();
    renderHook(({ tabs, n }) => useSubject(tabs, n), {
      initialProps: { tabs: [tab('mine')], n: 0 },
    });
    await act(async () => vi.advanceTimersByTime(600));
    await act(async () => vi.advanceTimersByTime(SAVE_RESAVE_GRACE_MS));
    await act(async () => vi.advanceTimersByTime(600));
    expect(apiSaveTab).toHaveBeenCalledTimes(1);
  });
});
