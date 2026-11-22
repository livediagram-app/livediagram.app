// The item engine's hot paths, held to CPU-time budgets (blueprint item-engine.md "Cost"). CPU time, not wall
// time: a busy machine slows the clock on the wall, not the work counted here. Each figure is the best of a few
// rounds, and each budget several times what was measured, so only a real regression fails.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs } from '@liveworkspace/vitest-config/cpu-time';
import type { ItemEvent } from '../../item';
import { AUTOMATION_LOG_MAX, AUTOMATION_RULES_MAX } from '../../limits';
import { aiToday } from '../automation-ai';
import { takeHookSignature, type HookCall } from '../automation-incoming';
import { AUTOMATION_NO_MATCH_LOG_MAX, claimRun, markAiAsked, trimRuns } from '../automation-log';
import type { DatabaseSync } from 'node:sqlite';
import { queueItemEvent } from './intake';
import { handleItemAutomationRoutes } from './routes';
import { ANA, itemDb, world, type World } from './test-kit';
import { ITEM_EVENTS_PER_WAKE, runItemAutomations } from './wake';

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// Node's own `process`, typed here: the Workers types this package compiles against leave it untyped.
type Usage = { user: number; system: number };
const { cpuUsage, stderr } = (
  globalThis as unknown as {
    process: { cpuUsage: () => Usage; stderr: { write: (text: string) => void } };
  }
).process;

const cpuMicros = (): number => {
  const { user, system } = cpuUsage();
  return user + system;
};

// The least CPU time `work` took over a few rounds, in microseconds.
// A budget in µs through the shared rule (cpu-time.js): as written locally, three times it on CI, and unbounded under
// coverage, where instrumentation sets the pace; vitest-budgets reruns this file plain, where it holds (docs/ci.md
// "Speed budgets"). A coverage run on CI read the no-rule write at 75 µs against 60, where a plain run reads 27.
const budgetMicros = (micros: number): number => cpuBudgetMs(micros / 1000) * 1000;

async function best(rounds: number, work: () => void | Promise<void>): Promise<number> {
  let least = Infinity;
  for (let i = 0; i < rounds; i += 1) {
    const from = cpuMicros();
    await work();
    least = Math.min(least, cpuMicros() - from);
  }
  return least;
}

const WRITES = 4000;
const WRITE = 'UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = ?';

// A tab's body saved WRITES times. `prepared`: through one statement compiled once, as a Durable Object's statement
// cache runs a repeated write; else compiled on every write, the worst a write can cost (SQLite codes a table's
// triggers into each statement that writes it as the statement is compiled).
function writes(db: DatabaseSync, prepared: boolean): void {
  const statement = db.prepare(WRITE);
  for (let i = 0; i < WRITES; i += 1)
    (prepared ? statement : db.prepare(WRITE)).run(`{"n":${i}}`, 't1');
}

function tabbed(db: DatabaseSync): DatabaseSync {
  db.exec("INSERT INTO tabs (id, name, data) VALUES ('t1', 'Roadmap', '{}')");
  db.exec("INSERT INTO document_tabs (document_id, tab_id) VALUES ('item-1', 't1')");
  return db;
}

// vitest shows a passing test's console only on failure: the figures go straight to stderr.
const report = (name: string, value: string) => void stderr.write(`[perf] ${name}: ${value}\n`);

// What the triggers add to one write, in microseconds: the same writes with and without them.
async function added(w: World, prepared: boolean): Promise<number> {
  const bare = tabbed(itemDb(false).db);
  const without = await best(5, () => writes(bare, prepared));
  const withTriggers = await best(5, () => writes(w.db, prepared));
  return (withTriggers - without) / WRITES;
}

describe('a tab write', () => {
  it('costs an item with no rule on one probe: under 5 µs a write, 60 µs when compiled afresh', async () => {
    const w = world();
    tabbed(w.db);
    const steady = await added(w, true);
    const compiled = await added(w, false);
    report(
      'tab write, no rule on, added',
      `${steady.toFixed(2)} µs (compiled afresh: ${compiled.toFixed(2)} µs)`,
    );
    expect(steady).toBeLessThan(budgetMicros(5));
    expect(compiled).toBeLessThan(budgetMicros(60));
  });

  it('costs an item with 50 settling rules on under 150 µs a write', async () => {
    const w = world();
    tabbed(w.db);
    // The worst case: every rule settles after edits, so each write pushes back 50 settles and stamps the edit.
    for (let i = 0; i < AUTOMATION_RULES_MAX; i += 1)
      w.rule({ trigger: { kind: 'edited', minutes: 5 } });
    const steady = await added(w, true);
    const compiled = await added(w, false);
    report(
      'tab write, 50 settling rules on, added',
      `${steady.toFixed(2)} µs (compiled afresh: ${compiled.toFixed(2)} µs)`,
    );
    expect(steady).toBeLessThan(budgetMicros(150));
    expect(compiled).toBeLessThan(budgetMicros(200));
    // The budget is CPU time per write; the wall clock only bounds a loaded machine's setup.
  }, 60_000);
});

describe('a wake', () => {
  it('runs 25 events over 50 rules within 900 ms of CPU', async () => {
    let least = Infinity;
    for (let round = 0; round < 3; round += 1) {
      const w = world();
      for (let i = 0; i < AUTOMATION_RULES_MAX; i += 1) w.rule({ trigger: { kind: 'joined' } });
      for (let i = 0; i < ITEM_EVENTS_PER_WAKE; i += 1) {
        const event: ItemEvent = {
          id: `e${i}`,
          kind: 'joined',
          at: Date.now(),
          by: ANA,
          role: 'editor',
        };
        queueItemEvent(w.sql, w.engine, event);
      }
      const from = cpuMicros();
      await runItemAutomations(w.engine, Date.now());
      least = Math.min(least, cpuMicros() - from);
      // The day's 1,000 runs stop it short of 25 x 50.
      expect(w.taken).toHaveLength(1000);
    }
    report('wake, 25 events over 50 rules (1,000 runs)', `${(least / 1000).toFixed(1)} ms`);
    expect(least).toBeLessThan(budgetMicros(900_000));
  });
});

describe('the rules list', () => {
  const fill = (w: World) => {
    const run = JSON.stringify({
      id: 'x',
      ruleId: 'r1',
      at: 0,
      result: 'done',
      steps: [{ kind: 'trigger', text: 'x' }],
    });
    w.sql.exec(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${AUTOMATION_LOG_MAX + AUTOMATION_NO_MATCH_LOG_MAX})
       INSERT INTO automation_runs (id, rule_id, at, result, body)
       SELECT 'run' || i, 'r' || (i % 50 + 1), ? - i * 1000,
              CASE WHEN i > ${AUTOMATION_LOG_MAX} THEN 'no_match' ELSE 'done' END, ? FROM n`,
      Date.now(),
      run,
    );
  };

  it('reads 50 rules over a full Audit Trail within 25 ms of CPU, and the trail itself never whole', async () => {
    const w = world();
    for (let i = 0; i < AUTOMATION_RULES_MAX; i += 1)
      w.rule({ trigger: { kind: 'scheduled', every: 'day', at: '09:00' } });
    fill(w);
    const url = new URL('https://app.example/api/documents/item-1/automations');
    const ask = (segments: string[], at = url) =>
      handleItemAutomationRoutes({
        engine: w.engine,
        method: 'GET',
        segments,
        url: at,
        request: new Request(at),
        caller: { editor: true, signedIn: true, person: ANA, reader: true },
      });
    let listed = 0;
    const list = await best(5, async () => {
      const response = await ask([]);
      listed = (await response!.json<{ rules: unknown[] }>()).rules.length;
    });
    expect(listed).toBe(AUTOMATION_RULES_MAX);
    report('rules list, 50 rules over 2,500 runs', `${(list / 1000).toFixed(1)} ms`);
    expect(list).toBeLessThan(budgetMicros(25_000));
    const trail = new URL(`${url.href}/runs?limit=100000`);
    const response = await ask(['runs'], trail);
    expect((await response!.json<{ runs: unknown[] }>()).runs).toHaveLength(200);
  });
});

describe('a wake’s upkeep and a call’s replay check', () => {
  const full = (w: World) =>
    w.sql.exec(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${AUTOMATION_LOG_MAX + AUTOMATION_NO_MATCH_LOG_MAX})
       INSERT INTO automation_runs (id, rule_id, at, result, body)
       SELECT 'run' || i, 'r' || (i % 50), ? - i * 10,
              CASE WHEN i > ${AUTOMATION_LOG_MAX} THEN 'no_match' ELSE 'done' END,
              '{"steps":[{"kind":"trigger"},{"kind":"action","ai":true},{"kind":"action"}]}' FROM n`,
      Date.now(),
    );

  it('trims a full Audit Trail under its caps, and reads the day’s AI asks, in microseconds', async () => {
    const w = world();
    full(w);
    const now = Date.now();
    claimRun(w.sql, 'p', 'r1', now);
    for (let i = 0; i < 100; i += 1) markAiAsked(w.sql, 'p', 1, now);
    const trim = await best(10, () => trimRuns(w.sql, now));
    const ai = await best(10, () => {
      aiToday(w.sql, now);
    });
    report('trim, a full Audit Trail (2,000 + 500), nothing over', `${trim} µs`);
    report('the day’s AI asks, over a full Audit Trail', `${ai} µs`);
    expect(aiToday(w.sql, now)).toBe(100);
    expect(trim).toBeLessThan(budgetMicros(400));
    expect(ai).toBeLessThan(budgetMicros(200));
  });

  it('keeps a signed call’s signature with a rule’s 600 kept, in microseconds', async () => {
    const w = world();
    const now = Date.now();
    const call = (i: number): HookCall => ({
      body: new Uint8Array(),
      authorization: null,
      signature: `sha256=${i.toString(16).padStart(64, '0')}`,
    });
    for (let i = 0; i < 600; i += 1) takeHookSignature(w.sql, 'r1', call(i), now + i);
    let i = 600;
    const take = await best(10, () => {
      takeHookSignature(w.sql, 'r1', call(i), now + i);
      i += 1;
    });
    report('a signature kept, 600 a rule', `${take} µs`);
    expect(take).toBeLessThan(budgetMicros(500));
  });
});
