import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runtimeContract } from '@livediagram/runtime/testing';
import type { RoomHost } from '@livediagram/runtime';
import { LIMITER_CEILINGS } from './limiters';
import { API_MIGRATIONS_DIR, createNodeRuntime } from './node';

// The Node runtime must answer the same contract the Cloudflare runtime is
// compared against (apps/api/src/runtime/parity.test.ts). The expectations below
// are the shape that comparison produced, with the room supplied by the test
// because rooms are Phase 2.

/** A room that answers like a room does. */
const recordingRooms: RoomHost = {
  for: (documentId) => ({
    fetch: async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      return Response.json({ documentId, path: new URL(request.url).pathname });
    },
  }),
};

function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'livediagram-node-runtime-'));
  return run(dir).finally(() => rmSync(dir, { recursive: true, force: true }));
}

function optionsFor(dir: string) {
  return {
    databasePath: join(dir, 'livediagram.sqlite'),
    objectsDir: join(dir, 'objects'),
    migrationsDir: API_MIGRATIONS_DIR,
    rooms: recordingRooms,
  };
}

describe('the Node runtime', () => {
  it('satisfies the runtime contract', async () => {
    await withTempDir(async (dir) => {
      const node = createNodeRuntime({
        ...optionsFor(dir),
        vars: { CLERK_JWKS_URL: 'https://idp.test/jwks.json', CLERK_ISSUER: 'https://idp.test' },
      });
      try {
        expect(await runtimeContract(node.runtime)).toEqual({
          allIds: ['a', 'b'],
          firstCount: 2,
          insertChanges: 1,
          batchLength: 2,
          afterBatch: [
            { id: 'a', n: 11 },
            { id: 'b', n: 2 },
            { id: 'c', n: 3 },
          ],
          objectText: 'hello',
          objectContentType: 'text/plain',
          objectGoneAfterDelete: true,
          // The in-memory limiters admit the first call for each key; the
          // Cloudflare comparison pins the decisions themselves with fixed ones.
          limiterAllows: true,
          limiterDenies: true,
          roomStatus: 200,
          roomBody: JSON.stringify({ documentId: 'doc-1', path: '/broadcast' }),
          identity: { jwksUrl: 'https://idp.test/jwks.json', issuer: 'https://idp.test' },
        });
      } finally {
        await node.close();
      }
    });
  });

  it('provides every named limiter the hosted deployment has', async () => {
    await withTempDir(async (dir) => {
      const node = createNodeRuntime(optionsFor(dir));
      try {
        // The Cloudflare side leaves an unprovisioned binding undefined (and the
        // api treats that as "allow"); the Node runtime always has the ten, at
        // the same ceilings the wrangler file declares.
        for (const name of Object.keys(LIMITER_CEILINGS)) {
          expect(node.runtime.limiters[name as keyof typeof LIMITER_CEILINGS]).toBeDefined();
        }
        expect(LIMITER_CEILINGS.WRITE_RATE_LIMITER).toEqual({ limit: 300, periodSeconds: 60 });
      } finally {
        await node.close();
      }
    });
  });

  it('applies the api migrations once, and remembers them the second time', async () => {
    await withTempDir(async (dir) => {
      const options = optionsFor(dir);
      const first = createNodeRuntime(options);
      const applied = first.migrations.applied;
      expect(applied.length).toBeGreaterThan(0);
      expect(applied[0]).toBe('0001_init.sql');
      await first.close();

      const second = createNodeRuntime(options);
      try {
        expect(second.migrations.applied).toEqual([]);
        expect(second.migrations.alreadyApplied).toEqual(applied);
      } finally {
        await second.close();
      }
    });
  });

  it('refuses the write past the ceiling, and keeps other keys in their own window', async () => {
    await withTempDir(async (dir) => {
      const node = createNodeRuntime(optionsFor(dir));
      try {
        const limiter = node.limiters.WRITE_RATE_LIMITER!;
        for (let i = 0; i < 300; i += 1) {
          expect((await limiter.limit({ key: 'owner' })).success).toBe(true);
        }
        expect((await limiter.limit({ key: 'owner' })).success).toBe(false);
        expect((await limiter.limit({ key: 'other' })).success).toBe(true);
      } finally {
        await node.close();
      }
    });
  });
});
