// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ChangesetRoomOp } from '@livediagram/api-schema';
import type { Tab } from '@livediagram/document';

const apiRevertChangeset = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiRevertChangeset: (...a: unknown[]) => apiRevertChangeset(...a),
}));
const track = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...a: unknown[]) => track(...a) }));

import { useChangesetFeed } from './useChangesetFeed';
import { createRemoteOpJournal } from './save-baseline';
import type { ToastActionSpec } from '@/hooks/ui/useToast';

// What an editor does with a relayed changeset (docs/specs/024-agents/blueprints/agent-changesets.md
// "The editor"): apply, refetch, outline, toast, Show and Undo.

const op = (over: Partial<ChangesetRoomOp> = {}): ChangesetRoomOp => ({
  kind: 'changeset',
  tabId: 't1',
  id: 'cs_0000000001',
  rev: 2,
  prevRev: null,
  author: { name: 'Webber', color: '#0ea5e9' },
  agentKey: 'abcabcabcabc',
  summary: 'add payment service',
  counts: { added: 1, changed: 0, removed: 0 },
  elementOps: [
    {
      kind: 'add',
      element: { id: 'n', type: 'shape', shape: 'square', x: 0, y: 0, width: 1, height: 1 },
      at: 0,
    },
  ],
  ...over,
});

function setup(seen = new Map([['t1', 1]])) {
  let tabs: Tab[] = [{ id: 't1', name: 'T', elements: [] }];
  const toast = {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    offer: vi.fn(),
    action: vi.fn(),
  };
  const deps = {
    noteSeen: vi.fn((tabId: string, rev: number) => seen.set(tabId, rev)),
    refetchTabs: vi.fn(async () => {}),
    revealInView: vi.fn(),
    countAppliedOp: vi.fn(),
    markTabLoaded: vi.fn(),
  };
  const { result } = renderHook(() =>
    useChangesetFeed({
      documentId: 'd1',
      selfId: 'me',
      sessionShareCodeRef: { current: null },
      seenRef: { current: seen },
      loadedTabIdsRef: { current: new Set(['t1']) },
      applyRemoteTabs: (updater) => {
        tabs = updater(tabs);
      },
      saveBaseline: {
        tabs: { current: [] },
        name: { current: '' },
        journal: { current: createRemoteOpJournal() },
      },
      toast,
      ...deps,
    }),
  );
  const lastToast = () => toast.action.mock.calls.at(-1)![0] as ToastActionSpec;
  const press = async (label: string) => {
    await act(async () =>
      lastToast()
        .actions.find((a) => a.label === label)!
        .onSelect(),
    );
  };
  return { result, toast, deps, lastToast, press, tabs: () => tabs };
}

beforeEach(() => {
  apiRevertChangeset.mockReset();
  track.mockReset();
});

describe('useChangesetFeed', () => {
  it('applies the next changeset, raises the seen revision, outlines it and toasts the burst', () => {
    const { result, deps, lastToast, tabs } = setup();
    act(() => result.current.receiveChangeset(op()));
    expect(tabs()[0]!.elements.map((e) => e.id)).toEqual(['n']);
    expect(deps.noteSeen).toHaveBeenCalledWith('t1', 2);
    expect(deps.countAppliedOp).toHaveBeenCalledTimes(1);
    expect(result.current.reveals.getSnapshot()).toMatchObject([{ ids: ['n'], color: '#0ea5e9' }]);
    expect(lastToast()).toMatchObject({
      key: 'abcabcabcabc',
      message: 'Webber changed 1 element: add payment service',
      actions: [
        { label: 'Show', ariaLabel: "Show Webber's changes" },
        { label: 'Undo', ariaLabel: "Undo Webber's changes" },
      ],
    });
  });

  it('skips what this editor already holds', () => {
    const { result, deps, toast } = setup(new Map([['t1', 2]]));
    act(() => result.current.receiveChangeset(op()));
    expect(deps.countAppliedOp).not.toHaveBeenCalled();
    expect(toast.action).not.toHaveBeenCalled();
  });

  it('re-reads the tab when a changeset before this one never arrived, leaving the seen revision to it', () => {
    const { result, deps } = setup(new Map([['t1', 1]]));
    act(() => result.current.receiveChangeset(op({ prevRev: 3, rev: 4 })));
    expect(deps.refetchTabs).toHaveBeenCalledWith({ tabIds: ['t1'] });
    expect(deps.noteSeen).not.toHaveBeenCalled();
  });

  it('Show frames what the burst touched and is counted', async () => {
    const { result, deps, press } = setup();
    act(() => result.current.receiveChangeset(op()));
    await press('Show');
    expect(track).toHaveBeenCalledWith('Agent', 'Opened', 'Toast');
    expect(deps.revealInView).toHaveBeenCalledWith('t1', ['n']);
  });

  it('Undo reverts each changeset of the burst newest first, then says what it kept', async () => {
    apiRevertChangeset.mockResolvedValue({ changeset: null, reverted: 1, kept: [], lint: null });
    const { result, press, lastToast } = setup();
    act(() => result.current.receiveChangeset(op()));
    act(() => result.current.receiveChangeset(op({ id: 'cs_0000000002', rev: 3, prevRev: 2 })));
    expect(lastToast().message).toBe('Webber changed 2 elements: add payment service');
    await press('Undo');
    expect(apiRevertChangeset.mock.calls.map((c) => c[2])).toEqual([
      'cs_0000000002',
      'cs_0000000001',
    ]);
    expect(lastToast()).toEqual({ key: 'abcabcabcabc', message: 'Undone', actions: [] });
  });

  it('raises no toast for the revert its own Undo relays back', async () => {
    apiRevertChangeset.mockResolvedValue({ changeset: null, reverted: 1, kept: [], lint: null });
    const { result, press, toast } = setup();
    act(() => result.current.receiveChangeset(op()));
    await press('Undo');
    const before = toast.action.mock.calls.length;
    act(() =>
      result.current.receiveChangeset(
        op({
          id: 'cs_0000000009',
          rev: 3,
          prevRev: 2,
          agentKey: undefined,
          revertOf: 'cs_0000000001',
        }),
      ),
    );
    expect(toast.action.mock.calls.length).toBe(before);
  });

  it('a failed Undo says so, logs it and offers the buttons again', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    apiRevertChangeset.mockRejectedValue(Object.assign(new Error('nope'), { status: 409 }));
    const { result, press, toast, lastToast } = setup();
    act(() => result.current.receiveChangeset(op()));
    await press('Undo');
    expect(toast.error).toHaveBeenCalledWith("Could not undo Webber's change");
    expect(warn).toHaveBeenCalledWith('[changeset] undo-failed', { status: 409 });
    expect(lastToast().actions.every((a) => !a.disabled)).toBe(true);
    warn.mockRestore();
  });
});
