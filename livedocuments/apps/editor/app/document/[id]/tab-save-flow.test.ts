import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedocuments/document';
import type { RoomOp, RoomOutgoing } from '@livedocuments/api-schema';
import {
  participantElementOps,
  prepareTabSave,
  relayParticipantChanges,
  saveTabAndRelay,
  type SaveRoom,
} from './tab-save-flow';
import {
  createOwnElementWrites,
  isSupersededByOwnWrite,
  withoutSupersededArticleOps,
} from './own-element-writes';

const shapeTab = (): Tab =>
  ({
    id: 't1',
    name: 'Tab',
    elements: [{ id: 'box', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 100 }],
  }) as unknown as Tab;

const moved = (tab: Tab, x: number): Tab => ({
  ...tab,
  elements: [{ ...tab.elements[0]!, x }] as Tab['elements'],
});

describe('saveTabAndRelay', () => {
  it('sends element ops after the write', async () => {
    const base = shapeTab();
    const order: string[] = [];
    const room: SaveRoom = {
      send: vi.fn((msg: RoomOutgoing) => {
        if (msg.kind === 'op') order.push(`send:${msg.op.kind}`);
      }),
      sequence: vi.fn(() => Promise.resolve(true)),
    };
    const put = vi.fn(() => {
      order.push('put');
      return Promise.resolve(null);
    });

    await saveTabAndRelay(base, moved(base, 40), () => room, put);

    expect(order).toEqual(['put', 'send:el']);
    expect(room.sequence).not.toHaveBeenCalled();
  });

  it('saves without a room, telling nobody', async () => {
    const base = shapeTab();
    const put = vi.fn(() => Promise.resolve(3));
    await expect(saveTabAndRelay(base, moved(base, 40), () => null, put)).resolves.toBe(3);
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

  it("sends its writing in an article as the article's block ops", async () => {
    const sent: RoomOutgoing[] = [];
    const room: SaveRoom = { send: (m) => void sent.push(m), sequence: async () => true };
    const para = (text: string) => ({ id: 'p1', type: 'paragraph', runs: [{ text }] });
    const before = { ...tab([a]), articles: { f1: { blocks: [para('Hi')] } } } as Tab;
    const after = { ...before, articles: { f1: { blocks: [para('Hello')] } } } as Tab;
    await relayParticipantChanges(before, after, () => room);
    expect(sent).toEqual([
      {
        kind: 'op',
        op: {
          kind: 'article',
          tabId: 't1',
          flow: 'f1',
          ops: [{ kind: 'put', block: para('Hello') }],
        },
      },
    ]);
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

// docs/specs/007-editor/article-pages.md "Collaboration": a save holds the article blocks it writes the same way, so two
// people committing one paragraph at once both end on the room's last commit.
describe('a save holding its writing', () => {
  const article = (text: string): Tab =>
    ({
      id: 't1',
      name: 'T',
      elements: [],
      articles: { f1: { blocks: [{ id: 'p1', type: 'paragraph', runs: [{ text }] }] } },
    }) as unknown as Tab;
  const peerPut: RoomOp = {
    kind: 'article',
    tabId: 't1',
    flow: 'f1',
    ops: [{ kind: 'put', block: { id: 'p1', type: 'paragraph', runs: [{ text: 'theirs' }] } }],
  };

  it('sequences its article op and holds the block until the room confirms it', async () => {
    const writes = createOwnElementWrites();
    let confirm: (ok: boolean) => void = () => {};
    const room: SaveRoom = {
      send: vi.fn(),
      sequence: vi.fn(() => new Promise<boolean>((resolve) => (confirm = resolve))),
    };
    const prepared = prepareTabSave(article('was'), article('ours'), writes);
    expect(withoutSupersededArticleOps(writes, peerPut)).toBeNull();
    await saveTabAndRelay(
      article('was'),
      article('ours'),
      () => room,
      async () => null,
      prepared,
    );
    expect(room.sequence).toHaveBeenCalledWith(expect.objectContaining({ kind: 'article' }));
    expect(room.send).not.toHaveBeenCalled();
    expect(withoutSupersededArticleOps(writes, peerPut)).toBeNull();
    confirm(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(withoutSupersededArticleOps(writes, peerPut)).toBe(peerPut);
  });

  it('holds a Participant’s writing until the room answers', async () => {
    const writes = createOwnElementWrites();
    let confirm: (ok: boolean) => void = () => {};
    const room: SaveRoom = {
      send: vi.fn(),
      sequence: vi.fn(() => new Promise<boolean>((resolve) => (confirm = resolve))),
    };
    await relayParticipantChanges(article('was'), article('ours'), () => room, writes);
    expect(withoutSupersededArticleOps(writes, peerPut)).toBeNull();
    confirm(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(writes.held.size).toBe(0);
  });
});
