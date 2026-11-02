import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livehuddle/document';
import type { RoomOp, RoomOutgoing } from '@livehuddle/api-schema';
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
