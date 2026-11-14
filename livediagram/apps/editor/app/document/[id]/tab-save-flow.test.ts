import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import type { RoomOp, RoomOutgoing } from '@livediagram/api-schema';
import {
  participantElementOps,
  prepareTabSave,
  relayParticipantChanges,
  saveTabAndRelay,
  type SaveRoom,
} from './tab-save-flow';
import { createOwnElementWrites, isSupersededByOwnWrite } from './own-element-writes';

const boxTab = (x: number): Tab => ({
  id: 't1',
  name: 'Tab',
  elements: [{ id: 'a', type: 'shape', shape: 'square', x, y: 0, width: 10, height: 10 }],
});

describe('saveTabAndRelay', () => {
  it('sends element ops after the write', async () => {
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

    await saveTabAndRelay(boxTab(0), boxTab(40), () => room, put);

    expect(order).toEqual(['put', 'send:el']);
  });

  it('saves without a room, telling nobody', async () => {
    const put = vi.fn(() => Promise.resolve(3));
    await expect(saveTabAndRelay(boxTab(0), boxTab(40), () => null, put)).resolves.toBe(3);
    expect(put).toHaveBeenCalledTimes(1);
  });
});

// docs/specs/006-document/delta-saves.md "A peer's save moves the base copy".
describe('announcing a landed save', () => {
  const DIGEST = 'b'.repeat(64);
  const roomLog = () => {
    const sent: RoomOp[] = [];
    const room: SaveRoom = {
      send: (msg) => {
        if (msg.kind === 'op') sent.push(msg.op);
      },
      sequence: async (op) => {
        sent.push(op);
        return true;
      },
    };
    return { sent, room };
  };

  it('sends tab-saved with the revision and digest after the element ops, before the save settles', async () => {
    const { sent, room } = roomLog();
    const digestOf = vi.fn(async () => DIGEST);
    const saved = saveTabAndRelay(
      boxTab(0),
      boxTab(40),
      () => room,
      async () => 7,
      undefined,
      digestOf,
    );
    await expect(saved).resolves.toBe(7);
    expect(digestOf).toHaveBeenCalledWith('t1', 7);
    expect(sent.map((op) => op.kind)).toEqual(['el', 'tab-saved']);
    expect(sent[1]).toEqual({ kind: 'tab-saved', tabId: 't1', rev: 7, digest: DIGEST });
  });

  it('announces nothing without a held copy, a revision, a room, or when the digest fails', async () => {
    const cases: [() => SaveRoom | null, unknown, () => Promise<string | null>][] = [];
    const { sent, room } = roomLog();
    cases.push([() => room, 7, async () => null]);
    cases.push([() => room, null, async () => DIGEST]);
    cases.push([() => null, 7, async () => DIGEST]);
    cases.push([() => room, 7, () => Promise.reject(new Error('no crypto'))]);
    for (const [live, rev, digestOf] of cases) {
      await expect(
        saveTabAndRelay(boxTab(0), boxTab(0), live, async () => rev, undefined, digestOf),
      ).resolves.toBe(rev);
    }
    expect(sent.filter((op) => op.kind === 'tab-saved')).toEqual([]);
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

  // docs/specs/009-elements/images.md "Placement grants": the images a Participant places are claimed before the
  // ops that place them reach anyone.
  describe('claiming the images it places', () => {
    const pic = (id: string, imageId: string | null) => ({ id, type: 'image', ...box, imageId });

    it('claims the placed pictures first, then sends the ops', async () => {
      const order: string[] = [];
      const room: SaveRoom = { send: () => void order.push('send'), sequence: async () => true };
      const claim = vi.fn(async (ids: string[]) => void order.push(`claim:${ids.join(',')}`));
      const after = tab([
        a,
        pic('p', 'img-1'),
        pic('q', 'data:image/png;base64,AA'),
        pic('r', null),
      ]);
      await relayParticipantChanges(tab([a]), after, () => room, undefined, claim);
      expect(order).toEqual(['claim:img-1', 'send', 'send', 'send']);
    });

    it('claims nothing for a change that places no picture', async () => {
      const room: SaveRoom = { send: () => undefined, sequence: async () => true };
      const claim = vi.fn(async () => undefined);
      await relayParticipantChanges(tab([a]), tab([b]), () => room, undefined, claim);
      expect(claim).not.toHaveBeenCalled();
    });

    it('fails, letting its hold go, when the room closed while it claimed', async () => {
      const room: SaveRoom = { send: vi.fn(), sequence: async () => true };
      let open = true;
      const writes = createOwnElementWrites();
      const claim = async () => {
        open = false;
      };
      await expect(
        relayParticipantChanges(
          tab([]),
          tab([pic('p', 'img-1')]),
          () => (open ? room : null),
          writes,
          claim,
        ),
      ).rejects.toThrow();
      expect(room.send).not.toHaveBeenCalled();
      expect(writes.held.size).toBe(0);
    });
  });
});

// docs/specs/012-collaboration/realtime-conflict-resolution.md "Same-element edits converge": the elements a save
// writes are held from its snapshot until the room has sequenced its element ops.
describe('a save holding its elements', () => {
  const sticky = (id: string, x: number) =>
    ({
      id,
      type: 'sticky',
      x,
      y: 0,
      width: 10,
      height: 10,
      label: id,
    }) as unknown as Tab['elements'][number];
  const tab = (x: number): Tab => ({ id: 't1', name: 'T', elements: [sticky('a', x)] });
  const peerMove = (x: number): RoomOp => ({
    kind: 'el',
    tabId: 't1',
    op: { kind: 'update', element: sticky('a', x) },
  });

  it('holds from the snapshot through the write until the room confirms the element op', async () => {
    const writes = createOwnElementWrites();
    let confirm: (ok: boolean) => void = () => {};
    const room: SaveRoom = {
      send: vi.fn(),
      sequence: vi.fn(() => new Promise<boolean>((resolve) => (confirm = resolve))),
    };
    let finishPut: () => void = () => {};
    const put = vi.fn(() => new Promise<null>((resolve) => (finishPut = () => resolve(null))));
    const prepared = prepareTabSave(tab(0), tab(40), writes);
    expect(isSupersededByOwnWrite(writes, peerMove(90))).toBe(true);
    const saving = saveTabAndRelay(tab(0), tab(40), () => room, put, prepared);
    await Promise.resolve();
    expect(isSupersededByOwnWrite(writes, peerMove(90))).toBe(true);
    finishPut();
    await saving;
    expect(room.sequence).toHaveBeenCalledWith(expect.objectContaining({ kind: 'el' }));
    expect(room.send).not.toHaveBeenCalled();
    expect(isSupersededByOwnWrite(writes, peerMove(90))).toBe(true);
    confirm(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(isSupersededByOwnWrite(writes, peerMove(90))).toBe(false);
  });

  it('lets go when the write fails, or when there is no room to tell', async () => {
    const writes = createOwnElementWrites();
    const failing = saveTabAndRelay(
      tab(0),
      tab(40),
      () => null,
      () => Promise.reject(new Error('offline')),
      prepareTabSave(tab(0), tab(40), writes),
    );
    await expect(failing).rejects.toThrow('offline');
    expect(writes.held.size).toBe(0);
    await saveTabAndRelay(
      tab(0),
      tab(40),
      () => null,
      () => Promise.resolve(null),
      prepareTabSave(tab(0), tab(40), writes),
    );
    expect(writes.held.size).toBe(0);
  });

  it('holds a Participant’s element ops until the room confirms them', async () => {
    const writes = createOwnElementWrites();
    let confirm: (ok: boolean) => void = () => {};
    const room: SaveRoom = {
      send: vi.fn(),
      sequence: vi.fn(() => new Promise<boolean>((resolve) => (confirm = resolve))),
    };
    await relayParticipantChanges(tab(0), tab(40), () => room, writes);
    expect(isSupersededByOwnWrite(writes, peerMove(90))).toBe(true);
    confirm(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(writes.held.size).toBe(0);
  });
});
