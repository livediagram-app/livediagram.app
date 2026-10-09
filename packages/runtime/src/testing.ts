import type { Limiter, Limiters, Runtime } from './index';

// The Runtime contract (docs/specs/016-platform/blueprints/self-hosted-runtime.md,
// "Testing"): one list of operations every runtime must answer the same way, so
// two implementations can be compared field by field.
//
// Run it against the Cloudflare runtime and against a Node runtime and the two
// results must be equal. A runtime that drifts — a room reached differently, a
// limiter that stops answering, an object store that loses metadata — fails here
// rather than in production.

/** Everything both runtimes must agree on, in a comparable shape. */
export type RuntimeContract = {
  allIds: string[];
  firstCount: number | null;
  insertChanges: number | null;
  batchLength: number;
  afterBatch: { id: string; n: number }[];
  objectText: string | null;
  objectContentType: string | null;
  objectGoneAfterDelete: boolean;
  limiterAllows: boolean | null;
  limiterDenies: boolean | null;
  roomStatus: number;
  roomBody: string;
  identity: { jwksUrl: string | null; issuer: string | null };
};

/**
 * Run the contract against one runtime. The probe table is created and cleared
 * first, so the caller's database carries nothing between runs.
 */
export async function runtimeContract(runtime: Runtime): Promise<RuntimeContract> {
  await runtime.db
    .prepare('CREATE TABLE IF NOT EXISTS parity_probe (id TEXT PRIMARY KEY, n INTEGER)')
    .run();
  await runtime.db.prepare('DELETE FROM parity_probe').run();
  const inserted = await runtime.db
    .prepare('INSERT INTO parity_probe (id, n) VALUES (?, ?)')
    .bind('a', 1)
    .run();
  await runtime.db.prepare('INSERT INTO parity_probe (id, n) VALUES (?, ?)').bind('b', 2).run();

  const rows = await runtime.db
    .prepare('SELECT id FROM parity_probe ORDER BY id')
    .all<{ id: string }>();
  const counted = await runtime.db
    .prepare('SELECT COUNT(*) AS n FROM parity_probe')
    .first<{ n: number }>();
  // Two statements in one batch, the way a save writes a document and its index:
  // the update must land after the insert.
  const batched = await runtime.db.batch([
    runtime.db.prepare('INSERT INTO parity_probe (id, n) VALUES (?, ?)').bind('c', 3),
    runtime.db.prepare('UPDATE parity_probe SET n = n + 10 WHERE id = ?').bind('a'),
  ]);
  const afterBatch = await runtime.db
    .prepare('SELECT id, n FROM parity_probe ORDER BY id')
    .all<{ id: string; n: number }>();

  await runtime.objects?.put('probe', new TextEncoder().encode('hello'), {
    httpMetadata: { contentType: 'text/plain' },
  });
  const stored = await runtime.objects?.get('probe');
  const objectText = stored ? await stored.text() : null;
  await runtime.objects?.delete('probe');
  const afterDelete = await runtime.objects?.get('probe');

  const allows = await runtime.limiters.WRITE_RATE_LIMITER?.limit({ key: 'probe' });
  const denies = await runtime.limiters.SHARE_RATE_LIMITER?.limit({ key: 'probe' });

  const room = await runtime.rooms
    .for('doc-1')
    .fetch(new Request('https://room/broadcast', { method: 'POST' }));

  // Held, not awaited: a runtime must accept background work without blocking the
  // response. Callers assert how their own scheduler recorded it.
  runtime.scheduler.waitUntil(Promise.resolve('contract'));

  return {
    allIds: rows.results.map((r) => r.id),
    firstCount: counted?.n ?? null,
    insertChanges: inserted.meta.changes ?? null,
    batchLength: batched.length,
    afterBatch: afterBatch.results.map((r) => ({ id: r.id, n: r.n })),
    objectText,
    objectContentType: stored?.httpMetadata?.contentType ?? null,
    objectGoneAfterDelete: afterDelete == null,
    limiterAllows: allows?.success ?? null,
    limiterDenies: denies?.success ?? null,
    roomStatus: room.status,
    roomBody: await room.text(),
    identity: {
      jwksUrl: runtime.identity.jwksUrl ?? null,
      issuer: runtime.identity.issuer ?? null,
    },
  };
}

/**
 * The limiters a contract run needs: one that always allows, one that always
 * refuses. Shared so both sides of a comparison are built the same way.
 */
export function contractLimiters(): Limiters {
  const fixed = (success: boolean): Limiter => ({ limit: async () => ({ success }) });
  return { WRITE_RATE_LIMITER: fixed(true), SHARE_RATE_LIMITER: fixed(false) };
}
