// A canvas's Automations on workerd, the runtime every api Worker runs in. The rest of this api's tests run the room
// on node:sqlite; the engine's tables, its three SQL triggers and the SQL they lean on (`julianday`, `json_patch`,
// `json_object`, `json_each`, `->>`, an upsert inside a trigger body) are checked here against a Durable Object's own
// SQLite, through the real DocumentRoom: the schema, a tab save, a tab added and removed, a Scheduled rule on the
// alarm, an Edited, Then Quiet settle, Take Snapshot and Revert to Snapshot end to end, and an Incoming Webhook
// call with a good and a bad signature. Then what the triggers cost a tab save, measured.
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_dev } from 'wrangler';
import {
  askWorker,
  itemDriver,
  signHook,
  startTestWorker,
  type TestWorker,
} from '@liveworkspace/automations/testing/workerd';

const here = (file: string) => fileURLToPath(String(new URL(file, import.meta.url)));

const ANA = 'user_ana';

let worker: TestWorker;

beforeAll(async () => {
  worker = await startTestWorker(unstable_dev, {
    worker: here('./worker.ts'),
    config: here('./wrangler.toml'),
    port: Number(process.env.WORKERD_TEST_PORT) || undefined,
  });
}, 120_000);

afterAll(async () => {
  await worker?.stop();
});

const post = <T>(path: string, body: unknown) => askWorker<T>(worker, path, body);

// The caller as the api Worker would have resolved them: an Editor of the whole canvas, signed in.
const identity = (name: string) => ({
  accountUserId: ANA,
  verifiedUserId: ANA,
  accountEmail: null,
  owner: ANA,
  token: null,
  workbench: null,
  bearer: null,
  teams: null,
  grant: {
    item: name,
    level: 'edit',
    tab: null,
    sub: ANA,
    team: null,
    owner: ANA,
    exp: Math.floor(Date.now() / 1000) + 3600,
    shareCode: null,
    token: 'grant',
  },
});

// One canvas's room, by name: the platform's driver, and this app's create and tab save.
function canvas(name: string) {
  const c = itemDriver({
    worker: () => worker,
    name,
    base: `/api/documents/${name}`,
    identity: identity(name),
  });
  return {
    ...c,
    create: async () => {
      const made = await c.drive('POST', '/api/documents', {
        id: name,
        name: 'Launch',
        tabs: [
          { id: `${name}-t1`, name: 'Board', elements: [] },
          { id: `${name}-t2`, name: 'Notes', elements: [] },
        ],
      });
      expect(made.status).toBe(201);
    },
    saveTab: async (tabId: string, label: string) => {
      const [stored] = await c.rows<{ rev: number }>('SELECT rev FROM tabs WHERE id = ?', [tabId]);
      const saved = await c.drive('PUT', `${c.base}/tabs/${tabId}`, {
        id: tabId,
        name: 'Board',
        rev: stored?.rev ?? 0,
        elements: [
          { id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 120, height: 60, label },
        ],
      });
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    },
  };
}

describe('the schema', () => {
  it('makes every Automations table and trigger in a Durable Object’s SQLite', async () => {
    const c = canvas('schema');
    await c.create();
    const made = await c.rows<{ type: string; name: string }>(
      "SELECT type, name FROM sqlite_master WHERE name LIKE 'automation_%' AND type IN ('table', 'trigger') ORDER BY name",
    );
    const names = made.map((m) => `${m.type} ${m.name}`);
    for (const name of [
      'table automation_rules',
      'table automation_queue',
      'table automation_runs',
      'table automation_schedule',
      'table automation_hooks',
      'table automation_waiting',
      'table automation_hook_seen',
      'table automation_ai_days',
      'table automation_hears',
      'table automation_writer',
      'table automation_edits',
      'table automation_quiet',
      'table automation_settles',
      'table automation_collab_seen',
      'trigger automation_tab_added',
      'trigger automation_tab_removed',
      'trigger automation_tab_edited',
    ])
      expect(names).toContain(name);
    const [version] = await c.rows<{ version: number }>('SELECT version FROM _document_schema');
    expect(version!.version).toBe(17);
  });
});

describe('the SQL triggers', () => {
  it('write nothing for a save, a tab added or a tab removed while no rule hears them', async () => {
    const c = canvas('quiet');
    await c.create();
    await c.saveTab('quiet-t1', 'One');
    await c.drive('PUT', `${c.base}/tabs/quiet-t3`, { id: 'quiet-t3', name: 'New', elements: [] });
    expect((await c.drive('DELETE', `${c.base}/tabs/quiet-t2`)).status).toBe(204);
    for (const table of ['automation_queue', 'automation_edits', 'automation_settles'])
      expect(await c.rows(`SELECT * FROM ${table}`), table).toEqual([]);
  });

  it('queue a tab added and a tab removed with the tab’s name and who, and stamp the edit', async () => {
    const c = canvas('tabs');
    await c.create();
    await c.rule({ trigger: { kind: 'tab_added' } });
    await c.rule({ trigger: { kind: 'tab_removed' } });
    await c.rule({ trigger: { kind: 'not_edited', days: 30, at: '09:00' } });
    expect(await c.rows('SELECT kind FROM automation_hears ORDER BY kind')).toEqual([
      { kind: 'edit' },
      { kind: 'tab_added' },
      { kind: 'tab_removed' },
    ]);
    await c.drive('PUT', `${c.base}/tabs/tabs-t3`, {
      id: 'tabs-t3',
      name: 'Roadmap',
      elements: [],
    });
    expect((await c.drive('DELETE', `${c.base}/tabs/tabs-t2`)).status).toBe(204);
    expect(await c.queued()).toMatchObject([
      {
        kind: 'tab_added',
        tab: 'tabs-t3',
        by: { id: ANA },
        role: 'editor',
        data: { 'tab.name': 'Roadmap' },
      },
      { kind: 'tab_removed', tab: 'tabs-t2', by: { id: ANA }, data: { 'tab.name': 'Notes' } },
    ]);
    // `julianday('now')` as milliseconds: the edit is stamped within a minute of now.
    const edits = await c.rows<{ tab_id: string; at: number }>(
      'SELECT tab_id, at FROM automation_edits ORDER BY tab_id',
    );
    expect(edits.map((e) => e.tab_id)).toEqual(['', 'tabs-t3']);
    for (const e of edits) expect(Math.abs(e.at - Date.now())).toBeLessThan(60_000);
    expect(await c.rows('SELECT * FROM automation_writer')).toEqual([]);
    // The wake runs both rules.
    await c.automationsAt(Date.now());
    expect((await c.runs()).map((r) => r.result)).toEqual(['done', 'done']);
  });
});

describe('time', () => {
  it('runs a Scheduled rule on the alarm at its time, once', async () => {
    const c = canvas('scheduled');
    await c.create();
    const rule = await c.rule({
      trigger: { kind: 'scheduled', every: 'day', at: '09:00' },
      steps: [{ kind: 'take_snapshot', name: 'Daily {{item.name}}' }],
    });
    const at = (await c.wakeAt())!;
    expect(at).toBe(rule.stats.nextAt);
    expect(at).toBeGreaterThan(Date.now());
    await c.automationsAt(at - 60_000);
    expect(await c.runs()).toEqual([]);
    await c.automationsAt(at + 1000);
    await c.automationsAt(at + 2000);
    expect(await c.runs()).toMatchObject([{ ruleId: rule.id, result: 'done' }]);
    expect(await c.rows('SELECT name FROM snapshots')).toEqual([{ name: 'Daily Launch' }]);
  });

  it('settles Edited, Then Quiet: pushed back by each save, fired once it is quiet', async () => {
    const c = canvas('settle');
    await c.create();
    const rule = await c.rule({
      trigger: { kind: 'edited', minutes: 5 },
      steps: [{ kind: 'take_snapshot', name: 'After {{tab.name}}' }],
    });
    await c.saveTab('settle-t1', 'One');
    const [first] = await c.rows<{ rule_id: string; due_at: number; data: string }>(
      'SELECT rule_id, due_at, data FROM automation_settles',
    );
    expect(first).toMatchObject({ rule_id: rule.id });
    expect(JSON.parse(first!.data)).toEqual({ tab: 'settle-t1' });
    expect(first!.due_at - Date.now()).toBeGreaterThan(4 * 60_000);
    await new Promise((resolve) => setTimeout(resolve, 30));
    await c.saveTab('settle-t1', 'Two');
    const [second] = await c.rows<{ due_at: number }>('SELECT due_at FROM automation_settles');
    expect(second!.due_at).toBeGreaterThan(first!.due_at);
    await c.automationsAt(Date.now() + 60_000);
    expect(await c.runs()).toEqual([]);
    await c.automationsAt(second!.due_at + 1000);
    expect(await c.runs()).toMatchObject([{ ruleId: rule.id, result: 'done' }]);
    expect(await c.rows('SELECT name FROM snapshots')).toEqual([{ name: 'After Board' }]);
    expect(await c.rows('SELECT * FROM automation_settles')).toEqual([]);
  });
});

describe('snapshots', () => {
  it('takes a snapshot and reverts to it by rule, end to end, silently', async () => {
    const c = canvas('snapshots');
    await c.create();
    await c.saveTab('snapshots-t1', 'Clean');
    const take = await c.rule({ steps: [{ kind: 'take_snapshot', name: 'Clean board' }] });
    const ran = await c.drive<{ run: { result: string } }>(
      'POST',
      `${c.base}/automations/${take.id}/run`,
      {},
    );
    expect(ran.body.run.result).toBe('done');
    const [snapshot] = await c.rows<{ id: string }>('SELECT id FROM snapshots');

    await c.saveTab('snapshots-t1', 'Scribbled over');
    await c.drive('PUT', `${c.base}/tabs/snapshots-t3`, {
      id: 'snapshots-t3',
      name: 'Scratch',
      elements: [],
    });
    // Rules that would hear the revert's rewrites, were they not silent.
    await c.rule({ trigger: { kind: 'tab_removed' } });
    await c.rule({ trigger: { kind: 'edited', minutes: 5 } });
    const revert = await c.rule({
      steps: [{ kind: 'revert_snapshot', snapshot: snapshot!.id, name: 'Clean board' }],
    });
    const [before] = await c.rows<{ generation: number }>('SELECT generation FROM snapshot_state');
    const reverted = await c.drive<{ run: { result: string; steps: { text: string }[] } }>(
      'POST',
      `${c.base}/automations/${revert.id}/run`,
      {},
    );
    expect(reverted.body.run.result, JSON.stringify(reverted.body)).toBe('done');
    expect(await c.rows('SELECT tab_id FROM document_tabs ORDER BY order_index')).toEqual([
      { tab_id: 'snapshots-t1' },
      { tab_id: 'snapshots-t2' },
    ]);
    const [tab] = await c.rows<{ data: string }>("SELECT data FROM tabs WHERE id = 'snapshots-t1'");
    expect(tab!.data).toContain('Clean');
    expect(tab!.data).not.toContain('Scribbled');
    expect(
      await c.rows("SELECT COUNT(*) AS n FROM snapshots WHERE kind = 'before-revert'"),
    ).toEqual([{ n: 1 }]);
    const [after] = await c.rows<{ generation: number }>('SELECT generation FROM snapshot_state');
    expect(after!.generation).toBe((before?.generation ?? 0) + 1);
    expect(await c.queued()).toEqual([]);
    expect(await c.rows('SELECT * FROM automation_settles')).toEqual([]);
    expect(await c.rows('SELECT * FROM automation_writer')).toEqual([]);
  });
});

describe('Incoming Webhook', () => {
  it('takes a call with a good signature and refuses a bad one', async () => {
    const c = canvas('hook');
    await c.create();
    const rule = await c.rule({
      trigger: { kind: 'incoming_webhook' },
      steps: [{ kind: 'take_snapshot', name: 'Before {{webhook.version}}' }],
    });
    const made = await c.drive<{ secret: string }>(
      'POST',
      `${c.base}/automations/${rule.id}/secret`,
    );
    expect(made.status).toBe(201);
    const body = JSON.stringify({ version: '2.4', tab: 'Board' });
    const sign = (text: string) => signHook(made.body.secret, text);
    const call = (signature: string | null, authorization: string | null = null) =>
      c.hook(rule.id, { body, authorization, signature });
    expect(await call(sign('{"version":"other"}'))).toMatchObject({
      status: 401,
      body: { error: 'webhook_unauthorized' },
    });
    expect(await call(null, 'Bearer lwh_wrong')).toMatchObject({ status: 401 });
    expect(await c.queued()).toEqual([]);
    expect(await call(sign(body))).toMatchObject({ status: 202, body: { queued: 1 } });
    expect(await call(null, `Bearer ${made.body.secret}`)).toMatchObject({ status: 202 });
    await c.automationsAt(Date.now());
    expect((await c.runs()).map((r) => r.result)).toEqual(['done', 'done']);
    expect(await c.rows('SELECT DISTINCT name FROM snapshots')).toEqual([{ name: 'Before 2.4' }]);
  });
});

describe('what the triggers cost a tab save', () => {
  // SQLite codes a table's triggers into every statement that writes the table, as that statement is compiled. A
  // Durable Object's `sql.exec` keeps compiled statements by their text, so a tab save, whose text never changes,
  // pays for the engine's three triggers once per wake of the object and never again. Measured here, on workerd,
  // against the same schema with the three dropped; the fresh-text figure (a statement compiled anew every time)
  // is what a save would pay were nothing kept.
  it('is nothing a save can feel while no rule is on, because exec reuses the compiled statement', async () => {
    const N = 10_000;
    const per = (ms: number) => (ms * 1000) / N;
    const bench = async (name: string, fresh: boolean) =>
      per((await post<{ ms: number }>('/bench', { name, n: N, fresh })).ms);
    await post('/bench', { name: 'with', setup: true, n: 1 });
    await post('/bench', { name: 'without', setup: false, n: 1 });
    const best = { with: Infinity, without: Infinity, withFresh: Infinity, withoutFresh: Infinity };
    for (let round = 0; round < 3; round += 1) {
      best.with = Math.min(best.with, await bench('with', false));
      best.without = Math.min(best.without, await bench('without', false));
      best.withFresh = Math.min(best.withFresh, await bench('with', true));
      best.withoutFresh = Math.min(best.withoutFresh, await bench('without', true));
    }
    console.log(
      `[automations] a tab save on workerd, no rule on (µs, best of 3 × ${N}): ` +
        `${best.with.toFixed(1)} with the triggers, ${best.without.toFixed(1)} without; ` +
        `compiled afresh each time: ${best.withFresh.toFixed(1)} with, ${best.withoutFresh.toFixed(1)} without`,
    );
    // Reused: the triggers add no more than noise to a save (measured 14 against 14 µs, 2026-11-20).
    expect(best.with).toBeLessThan(best.without * 1.5 + 5);
    // Compiled afresh they would cost tens of microseconds each time, which is what the reuse saves.
    expect(best.withFresh).toBeGreaterThan(best.with);
  }, 120_000);
});
