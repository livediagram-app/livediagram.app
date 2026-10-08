// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import type { connectRoom } from '@/lib/api-client';

type Room = ReturnType<typeof connectRoom>;

// The autosave stands down while a peer's op has reached the baseline but not yet this render's `tabs`
// (docs/specs/012-collaboration/collab-race-hardening.md), and re-arms on the render that carries it. The
// count of ops a render includes is state (react-state-and-effects.md), never a ref read during render.
const apiSaveTab = vi.fn((): Promise<number | null> => Promise.resolve(null));
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

const timing = vi.hoisted(() => ({ end: vi.fn(), cancel: vi.fn(), endAfterPaint: vi.fn() }));
const sampleSaveTiming = vi.hoisted(() => vi.fn(() => true));
const startEditorTiming = vi.hoisted(() => vi.fn(() => timing));
vi.mock('@/lib/timing', () => ({ sampleSaveTiming, startEditorTiming }));

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
    roomRef: { current: null as Room | null },
  };
  // Stable, as the real state setters are: a fresh function each render would re-run the save
  // effect on every render and hide whether it re-runs for the right reason.
  const setters = { setSaveStatus: vi.fn(), setSavedAt: vi.fn(), setDocumentList: vi.fn() };
  const noneSeen: ReadonlyMap<string, number> = new Map();
  const useSubject = (
    tabs: Tab[],
    opsApplied: number,
    onDocumentTrashed: () => void = () => {},
    changesetSeen: ReadonlyMap<string, number> = noneSeen,
    noteTabRevision?: (tabId: string, rev: number) => void,
  ) =>
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

// docs/specs/012-collaboration/collab-race-hardening.md phase 6: a Plan board's set-up delta is in the
// room's ledger before the save that carries it is written, so a peer's concurrent save merges it.
describe('useAutosave and a board delta', () => {
  const boardTab = (todo: string): Tab =>
    ({
      id: 't1',
      name: 'A',
      elements: [
        {
          id: 'b1',
          type: 'shape',
          shape: 'plan-board',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          planBoard: {
            columns: [{ id: 'todo', status: 'todo', name: todo }],
            swimlaneBy: 'none',
          },
        },
      ],
    }) as unknown as Tab;

  it('writes once the room has sequenced it, with the cursor of the snapshot', async () => {
    const { refs, useSubject } = setup();
    refs.lastSavedTabsRef.current = [boardTab('To Do')];
    let confirm: (ok: boolean) => void = () => {};
    const room = {
      send: vi.fn(),
      cursor: vi.fn(() => ({ epoch: 'e', seq: 4 })),
      sequence: vi.fn(() => new Promise<boolean>((resolve) => (confirm = resolve))),
    };
    refs.roomRef.current = room as unknown as Room;
    renderHook(({ tabs }) => useSubject(tabs, 0), {
      initialProps: { tabs: [boardTab('Ready')] },
    });
    await act(async () => vi.advanceTimersByTime(600));
    expect(room.sequence).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'el-delta', elementId: 'b1' }),
    );
    expect(apiSaveTab).not.toHaveBeenCalled();

    room.cursor.mockReturnValue({ epoch: 'e', seq: 5 });
    await act(async () => confirm(true));
    expect(apiSaveTab).toHaveBeenCalledWith(
      'me',
      'd1',
      expect.anything(),
      null,
      expect.objectContaining({ roomCursor: { epoch: 'e', seq: 4 } }),
    );
  });
});

// docs/specs/024-agents/agent-changesets.md "The write path" step 8: each save says which
// changesets its snapshot holds, from the same render as the snapshot.
describe('useAutosave and changesets', () => {
  it('sends the seen revision of the tab it saves, and none for a tab without one', () => {
    const { useSubject } = setup();
    const { rerender } = renderHook(({ tabs, seen }) => useSubject(tabs, 0, () => {}, seen), {
      initialProps: {
        tabs: [tab('mine')],
        seen: new Map([['t1', 5]]) as ReadonlyMap<string, number>,
      },
    });
    act(() => vi.advanceTimersByTime(600));
    expect(apiSaveTab).toHaveBeenLastCalledWith(
      'me',
      'd1',
      expect.anything(),
      null,
      expect.objectContaining({ changesetSeen: 5 }),
    );
    rerender({ tabs: [tab('again')], seen: new Map() });
    act(() => vi.advanceTimersByTime(600));
    expect(apiSaveTab).toHaveBeenLastCalledWith(
      'me',
      'd1',
      expect.anything(),
      null,
      expect.not.objectContaining({ changesetSeen: expect.anything() }),
    );
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
