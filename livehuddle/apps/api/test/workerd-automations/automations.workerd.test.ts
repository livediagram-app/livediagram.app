// A Space's Automations on workerd, the runtime every api Worker runs in. The rest of this api's tests run the room
// on node:sqlite; the engine's tables, its three SQL triggers and the SQL they lean on are checked here against a
// Durable Object's own SQLite, through the real DocumentRoom: the schema, writes no rule hears, a Scheduled rule on
// the alarm, Someone Arrived once for a burst of arrivals, Everyone Left once after its window and not when someone
// comes back, Clear the Suggestion Box by rule, Take Snapshot and Revert to Snapshot end to end, and an Incoming
// Webhook call with a good and a bad signature. What the triggers cost a tab save is measured once, in
// livediagram's harness (liveworkspace/docs/specs/018-automations/blueprints/item-engine.md "Cost").
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
import { DOCUMENT_SCHEMA_VERSION } from '../../src/document-room/document-schema';

const here = (file: string) => fileURLToPath(String(new URL(file, import.meta.url)));

const ANA = 'user_ana';
const MIN = 60_000;
const SUGGESTION_BOX = {
  id: 'box',
  type: 'shape',
  shape: 'suggestion-box',
  x: 0,
  y: 0,
  width: 64,
  height: 112,
  label: '',
};

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

// The caller as the api Worker would have resolved them: an Editor of the whole Space, signed in.
const identity = (name: string) => ({
  accountUserId: ANA,
  verifiedUserId: ANA,
  accountEmail: null,
  owner: ANA,
  token: null,
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

// One Space's room, by name: the platform's driver, and this app's create, tab save and visits.
function room(name: string) {
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
        name: 'Studio',
        tabs: [
          { id: `${name}-t1`, name: 'Lobby', elements: [SUGGESTION_BOX] },
          { id: `${name}-t2`, name: 'Garden', elements: [] },
        ],
      });
      expect(made.status).toBe(201);
    },
    saveTab: async (tabId: string, label: string) => {
      const [stored] = await c.rows<{ rev: number }>('SELECT rev FROM tabs WHERE id = ?', [tabId]);
      const saved = await c.drive('PUT', `${c.base}/tabs/${tabId}`, {
        id: tabId,
        name: 'Lobby',
        rev: stored?.rev ?? 0,
        elements: [
          SUGGESTION_BOX,
          { id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 120, height: 60, label },
        ],
      });
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    },
    // A person's one session moves into `tab` (null: it closes) at `at`, as the room's hello and close record it.
    attend: (person: string, tab: string | null, at: number) =>
      askWorker(worker, '/attend', { name, attend: { person, name: person, tab, at } }),
  };
}

describe('the schema', () => {
  it('makes every Automations table and trigger in a Durable Object’s SQLite', async () => {
    const c = room('schema');
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
      'table automation_hears',
      'table automation_writer',
      'table automation_edits',
      'table automation_quiet',
      'table automation_settles',
      'trigger automation_tab_added',
      'trigger automation_tab_removed',
      'trigger automation_tab_edited',
    ])
      expect(names).toContain(name);
    const [version] = await c.rows<{ version: number }>('SELECT version FROM _document_schema');
    expect(version!.version).toBe(DOCUMENT_SCHEMA_VERSION);
  });
});

describe('the SQL triggers', () => {
  it('write nothing for a save, a tab added or a tab removed while no rule hears them', async () => {
    const c = room('quiet');
    await c.create();
    await c.saveTab('quiet-t1', 'One');
    await c.drive('PUT', `${c.base}/tabs/quiet-t3`, { id: 'quiet-t3', name: 'New', elements: [] });
    expect((await c.drive('DELETE', `${c.base}/tabs/quiet-t2`)).status).toBe(204);
    for (const table of ['automation_queue', 'automation_edits', 'automation_settles'])
      expect(await c.rows(`SELECT * FROM ${table}`), table).toEqual([]);
  });

  it('queue a tab added and a tab removed with the tab’s name and who, and stamp the edit', async () => {
    const c = room('tabs');
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
      { kind: 'tab_removed', tab: 'tabs-t2', by: { id: ANA }, data: { 'tab.name': 'Garden' } },
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
    const c = room('scheduled');
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
    expect(await c.rows('SELECT name FROM snapshots WHERE item_id = ?', [c.name])).toEqual([
      { name: 'Daily Studio' },
    ]);
  });
});

describe('the visit triggers', () => {
  it('runs Someone Arrived once for a burst of arrivals into an empty tab', async () => {
    const c = room('arrived');
    await c.create();
    const rule = await c.rule({
      trigger: { kind: 'someone_arrived', tab: 'arrived-t1' },
      steps: [{ kind: 'take_snapshot', name: '{{person}} opened {{tab.name}}' }],
    });
    const now = Date.now();
    for (const [i, person] of ['Ana', 'Ben', 'Cy'].entries())
      await c.attend(person, 'arrived-t1', now + i);
    await c.automationsAt(now + 1000);
    expect((await c.runs()).filter((r) => r.result === 'done')).toMatchObject([
      { ruleId: rule.id },
    ]);
    expect(await c.rows('SELECT name FROM snapshots WHERE item_id = ?', [c.name])).toEqual([
      { name: 'Ana opened Lobby' },
    ]);
  });

  it('runs Everyone Left once after its window, and not when someone comes back inside it', async () => {
    const c = room('left');
    await c.create();
    const rule = await c.rule({
      trigger: { kind: 'everyone_left', minutes: 10 },
      steps: [{ kind: 'take_snapshot', name: '{{visit.people}} for {{visit.minutes}} min' }],
    });
    const t0 = Date.now();
    await c.attend('Ana', 'left-t1', t0);
    await c.attend('Ben', 'left-t1', t0 + 1);
    await c.attend('Ana', null, t0 + 20 * MIN);
    await c.attend('Ben', null, t0 + 30 * MIN);
    expect(await c.rows('SELECT key FROM automation_settles')).toEqual([{ key: 'left-t1' }]);
    // Inside the window: nothing runs.
    await c.automationsAt(t0 + 35 * MIN);
    expect(await c.runs()).toEqual([]);
    await c.automationsAt(t0 + 41 * MIN);
    await c.automationsAt(t0 + 60 * MIN);
    expect(await c.runs()).toMatchObject([{ ruleId: rule.id, result: 'done' }]);
    expect(await c.rows('SELECT name FROM snapshots WHERE item_id = ?', [c.name])).toEqual([
      { name: 'Ana, Ben for 30 min' },
    ]);

    // Emptied again, and someone back within the window: the stretch is called off.
    const t1 = t0 + 2 * 60 * MIN;
    await c.attend('Cy', 'left-t1', t1);
    await c.attend('Cy', null, t1 + MIN);
    await c.attend('Dee', 'left-t1', t1 + 5 * MIN);
    expect(await c.rows('SELECT * FROM automation_settles')).toEqual([]);
    await c.automationsAt(t1 + 30 * MIN);
    expect(await c.runs()).toHaveLength(1);
  });
});

describe('the Suggestion Box', () => {
  it('is cleared by rule, end to end', async () => {
    const c = room('box');
    await c.create();
    for (const text of ['More plants', 'Quieter music']) {
      const dropped = await c.drive('POST', `${c.base}/tabs/box-t1/suggestions`, {
        elementId: 'box',
        text,
      });
      expect(dropped.status, JSON.stringify(dropped.body)).toBe(201);
    }
    const clear = await c.rule({ steps: [{ kind: 'clear_suggestions' }] });
    const ran = await c.drive<{ run: { result: string; steps: { text: string }[] } }>(
      'POST',
      `${c.base}/automations/${clear.id}/run`,
      {},
    );
    expect(ran.body.run.result, JSON.stringify(ran.body)).toBe('done');
    expect(ran.body.run.steps.map((s) => s.text)).toContain(
      'Cleared 2 notes from the Suggestion Box',
    );
    expect(await c.rows('SELECT * FROM suggestions')).toEqual([]);
  });
});

describe('snapshots', () => {
  it('takes a snapshot and reverts to it by rule, end to end, silently', async () => {
    const c = room('snapshots');
    await c.create();
    await c.saveTab('snapshots-t1', 'Clean');
    const take = await c.rule({ steps: [{ kind: 'take_snapshot', name: 'Clean lobby' }] });
    const ran = await c.drive<{ run: { result: string } }>(
      'POST',
      `${c.base}/automations/${take.id}/run`,
      {},
    );
    expect(ran.body.run.result).toBe('done');
    const [snapshot] = await c.rows<{ id: string }>('SELECT id FROM snapshots WHERE item_id = ?', [
      c.name,
    ]);

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
      steps: [{ kind: 'revert_snapshot', snapshot: snapshot!.id, name: 'Clean lobby' }],
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
    const c = room('hook');
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
    const body = JSON.stringify({ version: '2.4', tab: 'Lobby' });
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
    expect(await c.rows('SELECT DISTINCT name FROM snapshots WHERE item_id = ?', [c.name])).toEqual(
      [{ name: 'Before 2.4' }],
    );
  });
});
