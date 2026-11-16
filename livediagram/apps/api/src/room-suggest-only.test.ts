import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { sqliteD1 } from './test-sqlite-d1';
import { getTab, upsertTab } from './db/tabs';
import { RoomParticipantWrites } from './room-participant';

// A Participant on Suggest Only in the room (liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md "Suggest
// Only"): its element changes are refused with a correction, never stored, but for live fields (its comment).

const ME = 'a'.repeat(32);
const T0 = 1_700_000_000_000;
const sticky = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'sticky',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  label: 'x',
  addedBy: ME,
  ...extra,
});

async function setUp() {
  const db = sqliteD1();
  db.sql
    .prepare(
      'INSERT INTO test_documents (id, owner_id, name, saved_at, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run('A', 'owner', 'A', T0, T0);
  await upsertTab(
    db.env,
    'A',
    { id: 't1', name: 't1', elements: [sticky('s1')] } as unknown as Tab,
    0,
  );
  const sendTo = vi.fn();
  const sequence = vi.fn(() => 1);
  const writes = new RoomParticipantWrites({
    env: db.env,
    enqueue: (step) => step(),
    sequence,
    sendTo,
    position: () => ({ epoch: 'e', seq: 0 }),
    readLedger: async () => ({ elements: {} }),
  });
  const sender = { ws: {} as WebSocket, presenceId: 'P', documentId: 'A', adderKey: ME };
  return { db, writes, sendTo, sequence, sender };
}

describe('Suggest Only in the room', () => {
  it('refuses a move with the stored copy back, writing nothing', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db, writes, sendTo, sequence, sender } = await setUp();
    await writes.applyContentOp(
      { ...sender, suggestOnly: true },
      { kind: 'el', tabId: 't1', op: { kind: 'update', element: sticky('s1', { x: 90 }) } },
    );
    expect(sequence).not.toHaveBeenCalled();
    expect(sendTo).toHaveBeenCalledWith(sender.ws, {
      kind: 'op',
      from: 'system',
      op: { kind: 'el', tabId: 't1', op: { kind: 'update', element: sticky('s1') } },
    });
    expect((await getTab(db.env, 'A', 't1'))!.elements[0]).toMatchObject({ x: 0 });
  });

  it('refuses an add by taking it away again', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { writes, sendTo, sender } = await setUp();
    await writes.applyContentOp(
      { ...sender, suggestOnly: true },
      { kind: 'el', tabId: 't1', op: { kind: 'add', element: sticky('s2'), at: 1 } },
    );
    expect(sendTo).toHaveBeenCalledWith(
      sender.ws,
      expect.objectContaining({
        op: { kind: 'el', tabId: 't1', op: { kind: 'remove', id: 's2' } },
      }),
    );
  });

  it('lets the same move through for a Participant not on Suggest Only', async () => {
    const { db, writes, sequence, sender } = await setUp();
    await writes.applyContentOp(sender, {
      kind: 'el',
      tabId: 't1',
      op: { kind: 'update', element: sticky('s1', { x: 90 }) },
    });
    expect(sequence).toHaveBeenCalled();
    expect((await getTab(db.env, 'A', 't1'))!.elements[0]).toMatchObject({ x: 90 });
  });
});
