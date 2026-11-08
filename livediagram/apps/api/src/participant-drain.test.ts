import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import type { Tab } from '@livediagram/document';
import { sqliteD1, type SqliteD1 } from './test-sqlite-d1';
import { upsertTab } from './db/tabs';
import { RoomParticipantWrites } from './room-participant';

// A room of Participants writing one big tab (docs/specs/013-workspace/blueprints/share-roles.md "Performance and
// limits"): the ops waiting on the tab drain in one read and one write, against a real SQLite with every migration,
// and each op is answered exactly as it was when every op read, parsed and swapped the whole tab alone.

const ME = 'a'.repeat(32);
const T0 = 1_700_000_000_000;
const ELEMENTS = 2000;
const OPS = 50;

const sticky = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'sticky',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  label: 'x',
  ...extra,
});

// Half the tab is the Participants' own stickies, half an Editor's.
const bigTab = (): Tab =>
  ({
    id: 't1',
    name: 't1',
    elements: Array.from({ length: ELEMENTS }, (_, i) =>
      i % 2 === 0 ? sticky(`e${i}`, { addedBy: ME }) : sticky(`e${i}`),
    ),
  }) as unknown as Tab;

// Every kind of answer: applied patches, a refusal with its correction, a refusal that re-hydrates, a no-op.
function opFor(i: number): unknown {
  const op =
    i % 5 === 0
      ? { kind: 'remove', id: `e${i * 2 + 1}` }
      : i % 5 === 1
        ? { kind: 'update', element: sticky(`gone-${i}`, { addedBy: ME }) }
        : i % 5 === 2
          ? { kind: 'update', element: sticky(`e${i * 2}`, { addedBy: ME }) }
          : { kind: 'update', element: sticky(`e${i * 2}`, { addedBy: ME, label: `v${i}` }) };
  return { kind: 'el', tabId: 't1', op };
}

type Room = {
  db: SqliteD1;
  writes: RoomParticipantWrites;
  log: unknown[];
  reads: () => number;
  swaps: () => number;
};

async function room(onSwap?: (db: SqliteD1) => Promise<void>): Promise<Room> {
  const db = sqliteD1();
  db.sql
    .prepare(
      'INSERT INTO test_documents (id, owner_id, name, saved_at, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run('A', 'owner', 'A', T0, T0);
  await upsertTab(db.env, 'A', bigTab(), 0);
  let reads = 0;
  let swaps = 0;
  let swapping = false;
  const d1 = db.env.DOCUMENT_DB;
  const prepare = d1.prepare.bind(d1);
  d1.prepare = (query: string) => {
    if (query.includes('SELECT t.data, t.rev, t.updated_at')) reads++;
    if (query.includes('AND rev = ? AND updated_at = ?')) swapping = true;
    return prepare(query);
  };
  const batch = d1.batch.bind(d1);
  d1.batch = async (statements) => {
    if (swapping) {
      swapping = false;
      swaps++;
      if (onSwap && swaps === 1) await onSwap(db);
    }
    return batch(statements);
  };
  let tail: Promise<unknown> = Promise.resolve();
  const log: unknown[] = [];
  let seq = 0;
  const writes = new RoomParticipantWrites({
    env: db.env,
    enqueue: (step) => {
      const run = tail.then(step);
      tail = run.catch(() => undefined);
      return run;
    },
    sequence: (from, op, except) => {
      log.push(['seq', from, op, except ? (except as unknown as { id: number }).id : null]);
      return ++seq;
    },
    sendTo: (ws, payload) => log.push(['to', (ws as unknown as { id: number }).id, payload]),
    position: () => ({ epoch: 'e', seq }),
    readLedger: async () => ({ elements: {} }),
  });
  return { db, writes, log, reads: () => reads, swaps: () => swaps };
}

const senders = Array.from({ length: OPS }, (_, i) => ({
  ws: { id: i } as unknown as WebSocket,
  presenceId: `p${i}`,
  documentId: 'A',
  adderKey: ME,
}));

const stored = (r: Room): { elements: { id: string; label: string }[] } =>
  JSON.parse(r.db.sql.prepare('SELECT data FROM tabs WHERE id = ?').get('t1')!.data as string) as {
    elements: { id: string; label: string }[];
  };

// Every op at once, as frames that reached the room while it was busy.
const together = (r: Room) =>
  Promise.all(senders.map((s, i) => r.writes.applyContentOp(s, opFor(i), i + 1)));

// One op at a time: each drains alone, as every op once read and swapped the tab on its own.
async function oneByOne(r: Room) {
  for (const [i, s] of senders.entries()) await r.writes.applyContentOp(s, opFor(i), i + 1);
}

describe('a room of Participants on a big tab', () => {
  it('drains every waiting op in one read and one write, answering each as it would alone', async () => {
    const drained = await room();
    await together(drained);
    const alone = await room();
    await oneByOne(alone);
    expect(drained.reads()).toBe(1);
    expect(drained.swaps()).toBe(1);
    expect(alone.reads()).toBe(OPS);
    expect(stored(drained)).toEqual(stored(alone));
    expect(drained.log).toEqual(alone.log);
    // Every kind of answer is in there: patches relayed, corrections, re-hydrations.
    const kinds = new Set(drained.log.map((e) => JSON.stringify((e as unknown[])[2]).slice(0, 18)));
    expect(kinds.size).toBeGreaterThan(2);
  });

  it("keeps an owner's save that lands between the drain's read and its write", async () => {
    const r = await room(async (db) => {
      const tab = bigTab();
      tab.elements.push(sticky('owner-new') as never);
      await upsertTab(db.env, 'A', tab, 0);
    });
    await together(r);
    expect(r.reads()).toBe(2);
    const { elements } = stored(r);
    expect(elements.some((el) => el.id === 'owner-new')).toBe(true);
    expect(elements.find((el) => el.id === 'e6')?.label).toBe('v3');
  });

  it('costs one parse and one write for the whole room, within a CPU budget', async () => {
    let best = Infinity;
    for (let run = 0; run < 3; run++) {
      const r = await room();
      best = Math.min(best, await cpuMsOfAsync(() => together(r)));
    }
    // Measured 9 ms locally for 50 ops at 2,000 elements (one op at a time: 140 ms).
    expect(best).toBeLessThan(cpuBudgetMs(40));
  });
});
