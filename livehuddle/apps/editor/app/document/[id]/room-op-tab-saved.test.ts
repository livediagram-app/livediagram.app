import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livehuddle/document';
import type { RoomOp, RoomOutgoing } from '@livehuddle/api-schema';
import type { PresenceCoalescer } from '@liveworkspace/workbench/lib/presence-coalescer';
import { receiveRoomOp } from './room-op-receive';
import { roomOpIsWellFormed } from './room-op-shape';
import { createRemoteOpJournal } from './save-baseline';
import { saveTabAndRelay, type SaveRoom } from './tab-save-flow';
import type { RoomConnectionOptions } from './useRoomConnection.types';

// The `tab-saved` announcement (docs/specs/006-document/delta-saves.md "A peer's save moves the base copy"): sent after
// a landed save's element ops, checked for its shape when received, and handed on with the tab as the autosave's
// baseline holds it, for a loaded tab only.

const DIGEST = 'c'.repeat(64);
const stored = { id: 't1', name: 'Board', elements: [] } as unknown as Tab;
const saved: RoomOp = { kind: 'tab-saved', tabId: 't1', rev: 4, digest: DIGEST };

describe('sending tab-saved', () => {
  const roomLog = () => {
    const sent: RoomOp[] = [];
    const room: SaveRoom = {
      send: (msg: RoomOutgoing) => {
        if (msg.kind === 'op') sent.push(msg.op);
      },
      sequence: async (op) => {
        sent.push(op);
        return true;
      },
    };
    return { sent, room };
  };

  it('announces the revision and digest once the save lands, last', async () => {
    const { sent, room } = roomLog();
    const digestOf = vi.fn(async () => DIGEST);
    await expect(
      saveTabAndRelay(
        stored,
        stored,
        () => room,
        async () => 4,
        undefined,
        digestOf,
      ),
    ).resolves.toBe(4);
    expect(digestOf).toHaveBeenCalledWith('t1', 4);
    expect(sent.at(-1)).toEqual(saved);
  });

  it('announces nothing for a save that wrote no revision, or without a digest door', async () => {
    const { sent, room } = roomLog();
    await saveTabAndRelay(
      stored,
      stored,
      () => room,
      async () => null,
      undefined,
      async () => DIGEST,
    );
    await saveTabAndRelay(
      stored,
      stored,
      () => room,
      async () => 4,
    );
    expect(sent.filter((op) => op.kind === 'tab-saved')).toEqual([]);
  });
});

describe('a received tab-saved', () => {
  function receive(loaded: string[], receiveTabSaved?: RoomConnectionOptions['receiveTabSaved']) {
    const opts = {
      markSeen: vi.fn(),
      loadedTabIdsRef: { current: new Set(loaded) },
      saveBaseline: {
        tabs: { current: [stored] },
        name: { current: 'Board' },
        journal: { current: createRemoteOpJournal() },
      },
      receiveTabSaved,
    } as unknown as RoomConnectionOptions;
    receiveRoomOp('peer', saved, {} as PresenceCoalescer, opts, { current: new Map() });
    return opts;
  }

  it('is well formed only with a tab id, a whole revision and a digest', () => {
    expect(roomOpIsWellFormed(saved)).toBe(true);
    expect(roomOpIsWellFormed({ ...saved, rev: -1 })).toBe(false);
    expect(roomOpIsWellFormed({ ...saved, digest: 'Z'.repeat(64) })).toBe(false);
  });

  it('hands on the baseline tab, the revision and the digest, moving no journal', () => {
    const onSaved = vi.fn();
    const opts = receive(['t1'], onSaved);
    expect(onSaved).toHaveBeenCalledWith(stored, 4, DIGEST);
    expect(opts.saveBaseline.journal.current.next).toBe(0);
  });

  it('ignores a tab not loaded here, and does nothing without a handler', () => {
    const onSaved = vi.fn();
    receive([], onSaved);
    expect(onSaved).not.toHaveBeenCalled();
    expect(() => receive(['t1'])).not.toThrow();
  });
});
