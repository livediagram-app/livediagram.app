// A whole plan's file at its cap imports back (docs/specs/026-plan/blueprints/plan-file.md "Performance and limits";
// Work Tracker 1019): the route runs inside the new plan's Durable Object (128 MB), which reads the text, parses it,
// checks every store and writes it in one transaction. The peak is the live heap (a forced collection before each
// sample) at every tenth statement the import prepares and at its batch, over the heap of an object holding nothing,
// the file's text counted (as the runtime's read of the body is). The budget is memory and CPU time, not wall time: a forced
// collection at each sample makes the import take seconds on a loaded run, so the timeout is wide on purpose.
import { getHeapStatistics, setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEMS_MAX, type Item } from '@liveplanner/items';
import {
  PROJECT_ENVELOPE_KIND,
  PROJECT_FILE_MAX_BYTES,
  PROJECT_SCHEMA_VERSION,
  type ProjectEnvelope,
} from '@liveplanner/project';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import type { PlanGrant } from '../index-service';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { handlePlanRequest } from './projects';
import { makeTestRouteContext } from './test-route-context';

const OWNER = 'user_ada';
const PERSON = { id: OWNER, name: 'Ada', color: '#123456' };
// The most heap the import may hold at once, its text included. Measured 62 MB for a 20 MB file (82 MB while the
// route held the text through the write); the object has 128 MB, and the request's bytes (20 MB, outside the heap)
// take part of the rest.
const IMPORT_HEAP_BUDGET = 80 * 1024 * 1024;
const SAMPLE_EVERY = 10;

let db: SqliteD1;
beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  db = sqliteD1();
});
afterEach(() => vi.restoreAllMocks());

const grant: PlanGrant = {
  item: 'B',
  level: 'edit',
  tab: null,
  sub: OWNER,
  team: null,
  exp: 9_999_999_999,
  shareCode: null,
  token: 'signed',
};

const post = (body: string) =>
  handlePlanRequest(
    makeTestRouteContext('POST', '/api/projects/B/file', {
      env: db.env,
      owner: OWNER,
      accountUserId: OWNER,
      grant,
      rawBody: body,
    }),
  );

// A full plan (ITEMS_MAX cards on one Board tab), each card's description sized so the file sits just under `bytes`.
function fullPlanFile(bytes: number): string {
  const cardOf = (key: number, description: string): Item => ({
    id: `card-${String(key).padStart(5, '0')}`,
    type: 'task',
    key,
    rank: `a${String(key).padStart(5, '0')}`,
    fields: { title: `Card ${key}`, status: 'todo', description },
    rev: 1,
    createdAt: 10,
    updatedAt: 20,
    createdBy: PERSON,
    updatedBy: PERSON,
  });
  const envelope = (description: string): ProjectEnvelope => ({
    kind: PROJECT_ENVELOPE_KIND,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    exportedAt: 1,
    project: {
      id: 'A',
      name: 'Big plan',
      tabs: [{ id: 't1', name: 'Board', elements: [] }],
      items: Array.from({ length: ITEMS_MAX }, (_, i) => cardOf(i + 1, description)),
    },
  });
  const base = JSON.stringify(envelope('')).length;
  const each = Math.floor((bytes * 0.995 - base) / ITEMS_MAX);
  return JSON.stringify(envelope('Long notes. '.repeat(Math.ceil(each / 12)).slice(0, each)));
}

describe('a plan file at its cap', { timeout: 120_000 }, () => {
  it('imports a 20 MB file of a full plan inside the object’s memory', async () => {
    setFlagsFromString('--expose-gc');
    const gc = runInNewContext('gc') as () => void;
    const heap = () => getHeapStatistics().used_heap_size;
    // The heap of an object holding nothing yet: the file's text counts toward the peak, as the request's does.
    gc();
    const before = heap();
    let sampling = false;
    let peak = 0;
    let prepared = 0;
    const sample = () => {
      if (!sampling) return;
      gc();
      peak = Math.max(peak, heap());
    };
    const d1 = db.env.PLAN_DB;
    const prepare = d1.prepare.bind(d1);
    d1.prepare = (query: string) => {
      prepared += 1;
      if (prepared % SAMPLE_EVERY === 0) sample();
      return prepare(query);
    };
    const batch = d1.batch.bind(d1);
    d1.batch = async <T>(stmts: D1PreparedStatement[]) => {
      sample();
      return batch<T>(stmts);
    };

    sampling = true;
    // Only the route holds the text, as the runtime's request does.
    const res = await post(fullPlanFile(PROJECT_FILE_MAX_BYTES));
    sampling = false;
    expect(res.status).toBe(201);
    const count = db.sql.prepare("SELECT COUNT(*) AS n FROM items WHERE plan_id = 'B'").get() as {
      n: number;
    };
    expect(count.n).toBe(ITEMS_MAX);
    console.info('[test] plan file import peak MB', ((peak - before) / 1048576).toFixed(1));
    expect(peak - before).toBeGreaterThan(0);
    expect(peak - before).toBeLessThan(IMPORT_HEAP_BUDGET);
  });

  it('imports it within a CPU budget', async () => {
    const text = fullPlanFile(PROJECT_FILE_MAX_BYTES);
    expect(text.length).toBeGreaterThan(PROJECT_FILE_MAX_BYTES * 0.99);
    expect(text.length).toBeLessThanOrEqual(PROJECT_FILE_MAX_BYTES);
    let status = 0;
    const ms = await cpuMsOfAsync(async () => {
      status = (await post(text)).status;
    });
    expect(status).toBe(201);
    console.info('[test] plan file import CPU ms', ms.toFixed(0));
    expect(ms).toBeLessThan(cpuBudgetMs(3_000));
  });
});
