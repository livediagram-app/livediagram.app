import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_MIGRATIONS_DIR, createNodeRuntime, type NodeRuntime } from '../runtime/node';
import { RoomRegistry, ROOM_IDLE_MS } from './registry';

// The rooms on a Node runtime (docs/specs/016-platform/blueprints/self-hosted-runtime.md,
// "Node runtime: the rooms"): the api's own room class, served from a Map instead
// of Durable Objects. What is asserted here is the shell — that a room answers
// through the seam, that it is reused, that an idle one leaves memory, and that a
// shutdown closes what it holds. The room's own behaviour (140 tests) is
// apps/api/src/document-room.test.ts.

async function withRuntime<T>(run: (node: NodeRuntime, dir: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'livediagram-rooms-'));
  const node = createNodeRuntime({
    databasePath: join(dir, 'livediagram.sqlite'),
    objectsDir: join(dir, 'objects'),
    migrationsDir: API_MIGRATIONS_DIR,
    vars: {},
  });
  try {
    return await run(node, dir);
  } finally {
    await node.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function roomRequest(path: string, init?: RequestInit): Request {
  return new Request(`https://room${path}`, init);
}

describe('the Node rooms', () => {
  it('answers a room call through the seam', async () => {
    await withRuntime(async (node) => {
      // /ledger is a read: no room state is written, and the answer is the room's
      // own shape. An epoch the room never minted reads as "nothing to merge".
      const res = await node.runtime.rooms
        .for('doc-1')
        .fetch(roomRequest('/ledger?tab=t1&epoch=someone-elses'));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ elements: {} });
    });
  });

  it('takes an internal broadcast', async () => {
    await withRuntime(async (node) => {
      const res = await node.runtime.rooms.for('doc-1').fetch(
        roomRequest('/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: { kind: 'cursor', x: 1, y: 2 } }),
        }),
      );
      expect(res.status).toBe(204);
    });
  });

  it('gives the same room for the same document, and its own table', async () => {
    await withRuntime(async (node) => {
      await node.runtime.rooms.for('doc-a').fetch(roomRequest('/ledger?tab=t&epoch=e'));
      await node.runtime.rooms.for('doc-a').fetch(roomRequest('/ledger?tab=t&epoch=e'));
      await node.runtime.rooms.for('doc-b').fetch(roomRequest('/ledger?tab=t&epoch=e'));
      expect(node.rooms!.size()).toBe(2);
      expect(node.rooms!.get('doc-a')).toBe(node.rooms!.get('doc-a'));

      // The room's storage is a real table, so a room's state outlives the room.
      const table = node.sqlite.sql
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'room_kv'")
        .get() as { name?: string } | undefined;
      expect(table?.name).toBe('room_kv');
    });
  });

  it('lets an idle room leave memory, and builds it again on the next call', async () => {
    await withRuntime(async (node) => {
      let clock = 1_000;
      const registry = new RoomRegistry({
        env: node.runtime,
        sqlite: node.sqlite,
        waitUntil: () => {},
        now: () => clock,
      });
      await registry.for('doc-idle').fetch(roomRequest('/ledger?tab=t&epoch=e'));
      expect(registry.size()).toBe(1);
      // Not idle yet: the room was touched a moment ago.
      expect(registry.sweep()).toEqual([]);

      clock += ROOM_IDLE_MS + 1;
      expect(registry.sweep()).toEqual(['doc-idle']);
      expect(registry.size()).toBe(0);

      // The state lives in SQLite, so the room comes back rather than starting over.
      const res = await registry.for('doc-idle').fetch(roomRequest('/ledger?tab=t&epoch=e'));
      expect(res.status).toBe(200);
      expect(registry.size()).toBe(1);
    });
  });

  it('closes every room on shutdown', async () => {
    await withRuntime(async (node) => {
      const registry = new RoomRegistry({
        env: node.runtime,
        sqlite: node.sqlite,
        waitUntil: () => {},
      });
      await registry.for('doc-1').fetch(roomRequest('/ledger?tab=t&epoch=e'));
      await registry.for('doc-2').fetch(roomRequest('/ledger?tab=t&epoch=e'));
      expect(registry.size()).toBe(2);
      await registry.closeAll(1001, 'test shutdown');
      expect(registry.size()).toBe(0);
    });
  });
});
