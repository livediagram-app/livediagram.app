import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import type { PresenceCoalescer } from '@liveworkspace/workbench/lib/presence-coalescer';
import { receiveRoomOp } from './room-op-receive';
import { createRemoteOpJournal } from './save-baseline';
import type { RoomConnectionOptions } from './useRoomConnection.types';

// A peer's `tab-saved` (docs/specs/006-document/delta-saves.md "A peer's save moves the base copy"): handed on with
// the tab as the autosave's baseline holds it, for a loaded tab only.

const DIGEST = 'c'.repeat(64);
const stored: Tab = { id: 't1', name: 'Board', elements: [] };

function receive(loaded: string[], receiveTabSaved?: RoomConnectionOptions['receiveTabSaved']) {
  const opts = {
    markSeen: vi.fn(),
    loadedTabIdsRef: { current: new Set(loaded) },
    saveBaseline: {
      tabs: { current: [stored] },
      name: { current: 'Doc' },
      journal: { current: createRemoteOpJournal() },
    },
    receiveTabSaved,
  } as unknown as RoomConnectionOptions;
  receiveRoomOp(
    'peer',
    { kind: 'tab-saved', tabId: 't1', rev: 4, digest: DIGEST },
    {} as PresenceCoalescer,
    opts,
    new Map(),
    new Map(),
  );
  return opts;
}

describe('a received tab-saved', () => {
  it('hands on the baseline tab, the revision and the digest', () => {
    const onSaved = vi.fn();
    const opts = receive(['t1'], onSaved);
    expect(onSaved).toHaveBeenCalledWith(stored, 4, DIGEST);
    // Not a document change: the journal does not move, so the autosave is not held back.
    expect(opts.saveBaseline.journal.current.next).toBe(0);
  });

  it('ignores a tab not loaded here, and does nothing without a handler', () => {
    const onSaved = vi.fn();
    receive([], onSaved);
    expect(onSaved).not.toHaveBeenCalled();
    expect(() => receive(['t1'])).not.toThrow();
  });
});
