import { describe, expect, it, vi } from 'vitest';
import {
  ledgerKey,
  mergeLedgerIntoTab,
  recordInLedger,
  tabLedgerFrom,
  type ElementLedger,
  type Tab,
  type VoteLedger,
} from '@livediagram/document';
import { presetSetup } from '@livediagram/items';
import type { RoomOp, RoomOutgoing } from '@livediagram/api-schema';
import {
  participantElementOps,
  relayParticipantChanges,
  saveTabAndRelay,
  type SaveRoom,
} from './tab-save-flow';

const board = (): Tab =>
  ({
    id: 't1',
    name: 'Board',
    elements: [
      {
        id: 'board',
        type: 'shape',
        shape: 'plan-board',
        x: 0,
        y: 0,
        width: 1100,
        height: 560,
        planBoard: presetSetup('kanban'),
      },
    ],
  }) as unknown as Tab;

const renamed = (tab: Tab, columnId: string, name: string): Tab => ({
  ...tab,
  elements: tab.elements.map((el) =>
    el.type === 'shape' && el.planBoard
      ? {
          ...el,
          planBoard: {
            ...el.planBoard,
            columns: el.planBoard.columns.map((c) => (c.id === columnId ? { ...c, name } : c)),
          },
        }
      : el,
  ),
});

const columnNames = (tab: Tab): string[] => {
  const el = tab.elements[0]!;
  return el.type === 'shape' && el.planBoard ? el.planBoard.columns.map((c) => c.name) : [];
};

// One room and one D1, each built from the pure parts the real ones use. The room takes a frame a tick
// after it is sent (a socket is not instant), sequences it, records it in its ledger and only then
// acknowledges it, as the Durable Object does. D1 answers a tab PUT at once the way the api does: it
// merges in what the room sequenced after the saver's cursor (mergeRoomLedger), then the last write wins.
function world(initial: Tab) {
  let seq = 0;
  const ledger = new Map<string, ElementLedger | VoteLedger>();
  let stored = initial;
  const receive = (op: RoomOp): void => {
    seq += 1;
    const key = ledgerKey(op);
    if (!key) return;
    const next = recordInLedger(ledger.get(key), op, seq);
    if (next) ledger.set(key, next);
  };
  const room: SaveRoom = {
    send: (msg: RoomOutgoing) => {
      if (msg.kind === 'op') setTimeout(() => receive(msg.op), 0);
    },
    sequence: (op) =>
      new Promise((resolve) =>
        setTimeout(() => {
          receive(op);
          resolve(true);
        }, 0),
      ),
  };
  const put = (tab: Tab, cursor: number) => () => {
    stored = mergeLedgerIntoTab(tab, tabLedgerFrom(tab.id, ledger.entries()), cursor);
    return Promise.resolve(stored);
  };
  return { room, put, cursor: () => seq, stored: () => stored };
}

describe('saveTabAndRelay', () => {
  it('keeps both renames in D1 when two people rename different columns of one board at once', async () => {
    const base = board();
    const w = world(base);
    const atSnapshot = w.cursor();
    const a = renamed(base, 'todo', 'Ready');
    const b = renamed(base, 'review', 'Checking');

    await Promise.all([
      saveTabAndRelay(base, a, () => w.room, w.put(a, atSnapshot)),
      saveTabAndRelay(base, b, () => w.room, w.put(b, atSnapshot)),
    ]);

    expect(columnNames(w.stored())).toEqual([
      'Backlog',
      'Ready',
      'In Progress',
      'Checking',
      'Done',
    ]);
  });

  it('writes only once the room has sequenced the board delta', async () => {
    const base = board();
    const after = renamed(base, 'todo', 'Ready');
    let confirm: (ok: boolean) => void = () => {};
    const room: SaveRoom = {
      send: vi.fn(),
      sequence: vi.fn(() => new Promise<boolean>((resolve) => (confirm = resolve))),
    };
    const put = vi.fn(() => Promise.resolve(7));

    const saving = saveTabAndRelay(base, after, () => room, put);
    await Promise.resolve();
    expect(room.sequence).toHaveBeenCalledWith(expect.objectContaining({ kind: 'el-delta' }));
    expect(put).not.toHaveBeenCalled();

    confirm(true);
    await expect(saving).resolves.toBe(7);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('still writes, and logs, when the room cannot confirm the delta', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const base = board();
    const after = renamed(base, 'todo', 'Ready');
    const room: SaveRoom = { send: vi.fn(), sequence: vi.fn(() => Promise.resolve(false)) };
    const put = vi.fn(() => Promise.resolve(null));

    await saveTabAndRelay(base, after, () => room, put);

    expect(put).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[autosave] room did not confirm the deltas before the save',
      expect.objectContaining({ tabId: 't1', deltas: 1 }),
    );
    warn.mockRestore();
  });

  it('sends element ops after the write, and the deltas never twice', async () => {
    const base = board();
    const moved = renamed(base, 'todo', 'Ready');
    const after: Tab = {
      ...moved,
      elements: [{ ...moved.elements[0]!, x: 40 }] as Tab['elements'],
    };
    const order: string[] = [];
    const room: SaveRoom = {
      send: vi.fn((msg: RoomOutgoing) => {
        if (msg.kind === 'op') order.push(`send:${msg.op.kind}`);
      }),
      sequence: vi.fn((op: RoomOp) => {
        order.push(`sequence:${op.kind}`);
        return Promise.resolve(true);
      }),
    };
    const put = vi.fn(() => {
      order.push('put');
      return Promise.resolve(null);
    });

    await saveTabAndRelay(base, after, () => room, put);

    expect(order).toEqual(['sequence:el-delta', 'put', 'send:el']);
  });

  it('saves without a room, telling nobody', async () => {
    const base = board();
    const put = vi.fn(() => Promise.resolve(3));
    await expect(
      saveTabAndRelay(base, renamed(base, 'todo', 'Ready'), () => null, put),
    ).resolves.toBe(3);
    expect(put).toHaveBeenCalledTimes(1);
  });
});

// docs/specs/013-workspace/share-roles.md "Integrity": a Participant's save is element ops to the room.
describe('relayParticipantChanges', () => {
  const box = { x: 0, y: 0, width: 10, height: 10 };
  const tab = (elements: unknown[]): Tab => ({ id: 't1', name: 'T', elements }) as Tab;
  const a = { id: 'a', type: 'sticky', ...box, label: 'a' };
  const b = { id: 'b', type: 'sticky', ...box, label: 'b' };

  it('sends each element change as an el op, never a reorder or a tab', async () => {
    const sent: RoomOutgoing[] = [];
    const room: SaveRoom = { send: (m) => void sent.push(m), sequence: async () => true };
    const before = tab([a, b]);
    const after = tab([{ ...b, label: 'B' }, a, { id: 'c', type: 'text', ...box, label: 'c' }]);
    expect(await relayParticipantChanges(before, after, () => room)).toBeNull();
    const ops = sent.map((m) => (m as { op: { kind: string; op: { kind: string } } }).op);
    expect(ops.every((op) => op.kind === 'el')).toBe(true);
    expect(ops.map((op) => op.op.kind).sort()).toEqual(['add', 'update']);
  });

  it('fails while the room is closed, so the autosave retries', async () => {
    await expect(relayParticipantChanges(tab([a]), tab([b]), () => null)).rejects.toThrow();
  });

  it('derives nothing for an unchanged tab', () => {
    expect(participantElementOps(tab([a]), tab([a]))).toEqual([]);
  });
});
