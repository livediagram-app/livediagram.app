// The plan's `.liveplanner` file for the editor (docs/specs/015-api/api.md `GET` / `POST /api/projects/:id/file`;
// docs/specs/026-plan/plan-tabs.md "Whole Plan"): exported by an Editor of the whole plan, read back as a new plan of
// the importer's own. Export then import gives the same plan; the body is untrusted, so a malformed, oversized or
// newer file is refused with nothing made; a Participant, a Viewer and a tab-scoped link are refused.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultCatalogue, type AutomationRule, type Item } from '@liveplanner/items';
import {
  PROJECT_FILE_MAX_BYTES,
  parseProjectEnvelope,
  type CardThread,
  type Comment,
  type Element,
  type ProjectEnvelope,
} from '@liveplanner/project';
import type { SheetJson } from '@liveplanner/sheets';
import { insertLinkStatement, insertThreadStatement } from '../db/card-threads';
import { insertItems } from '../db/items';
import { insertSheetStatements } from '../db/sheets';
import { upsertTab } from '../db/tabs';
import type { PlanGrant } from '../index-service';
import { copiedRuleStatements } from '../plan-room/automations/automation-copy';
import { ruleBody } from '../plan-room/automations/test-automation-world';
import { setPlanItemTypes } from '../plan-room/plan-content';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { handlePlanRequest } from './projects';
import { makeTestRouteContext } from './test-route-context';

const OWNER = 'user_ada';
const VISITOR = 'user_bea';
const MIME = 'application/vnd.liveplanner+json';
const PERSON = { id: OWNER, name: 'Ada', color: '#123456' };

let db: SqliteD1;

const grant = (item: string, over: Partial<PlanGrant> = {}): PlanGrant =>
  ({
    item,
    level: 'edit',
    tab: null,
    sub: OWNER,
    team: null,
    exp: 9_999_999_999,
    shareCode: null,
    token: 'signed',
    ...over,
  }) as PlanGrant;

function call(
  method: string,
  id: string,
  opts: { grant?: PlanGrant | null; owner?: string; body?: string; headers?: Record<string, string> } = {},
) {
  return handlePlanRequest(
    makeTestRouteContext(method, `/api/projects/${id}/file`, {
      env: db.env,
      owner: opts.owner ?? OWNER,
      accountUserId: opts.owner ?? OWNER,
      grant: opts.grant === undefined ? grant(id) : opts.grant,
      ...(opts.body !== undefined ? { rawBody: opts.body } : {}),
      ...(opts.headers ? { headers: opts.headers } : {}),
    }),
  );
}

const box = (id: string, link?: { kind: 'tab'; tabId: string }): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...(link ? { link } : {}),
});

const card = (id: string, key: number, fields: Item['fields']): Item => ({
  id,
  type: 'task',
  key,
  rank: `a${key}`,
  fields,
  rev: 2,
  createdAt: 10,
  updatedAt: 20,
  createdBy: PERSON,
  updatedBy: PERSON,
});

const comment = (id: string, text: string): Comment => ({
  id,
  text,
  createdAt: 400,
  authorName: 'Bea',
  authorColor: '#000000',
  authorId: VISITOR,
});

const thread: CardThread = {
  id: 'th-scope00000000001',
  title: 'Scope',
  resolved: false,
  comments: [comment('cm1', 'Is this in?'), comment('cm2', 'Yes')],
  createdAt: 400,
  createdBy: { name: 'Bea', color: '#000000', authorId: VISITOR },
  updatedAt: 400,
  home: 'A',
  cards: [{ projectId: 'A', itemId: 'card1', key: 1 }],
  rev: 1,
};

const sheet: SheetJson = {
  id: 'sheet0001',
  tabId: 't2',
  title: 'Budget',
  layout: { rows: ['r001'], cols: ['c001'] },
  cells: [{ r: 'r001', c: 'c001', i: { n: 42 } }],
  rev: 0,
  createdAt: 5,
  updatedAt: 5,
  updatedBy: PERSON,
};

const STAMP = { at: 1, by: PERSON };
const rule: AutomationRule = {
  ...ruleBody({ name: 'Done stamp' }),
  id: 'rule1',
  enabled: true,
  made: STAMP,
  edited: STAMP,
};

// The Task with a custom field, so the round trip carries a field the catalogue defines.
const DEFAULTS = defaultCatalogue();
const CATALOGUE = {
  ...DEFAULTS,
  types: DEFAULTS.types.map((t) =>
    t.id === 'task'
      ? {
          ...t,
          fields: [...t.fields, 'f-cost'],
          custom: [{ id: 'f-cost', label: 'Cost', kind: 'number' as const }],
        }
      : t,
  ),
};

beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  db = sqliteD1();
  // Ada's plan A: two tabs (the first linking to the second, the second in a folder with a Sheet), two cards with
  // their fields, the catalogue, a comment thread and a rule.
  db.sql.exec(
    `INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at) VALUES ('A', '${OWNER}', 'Roadmap', 0, 1, 1)`,
  );
  await upsertTab(
    db.env,
    'A',
    { id: 't1', name: 'Board', elements: [box('b1', { kind: 'tab', tabId: 't2' })] },
    0,
  );
  await upsertTab(db.env, 'A', { id: 't2', name: 'Money', elements: [box('b2')] }, 1);
  db.sql.prepare("UPDATE plan_tabs SET folder = 'Later' WHERE tab_id = 't2'").run();
  await setPlanItemTypes(db.env, 'A', CATALOGUE);
  await insertItems(db.env, 'A', [
    card('card1', 1, { title: 'Write it', status: 'todo', 'f-cost': 12 }),
    card('card2', 2, { title: 'Ship it', status: 'done', description: 'Out the door' }),
  ]);
  await db.env.PLAN_DB.batch([
    ...insertSheetStatements(db.env, 'A', sheet, 5),
    insertThreadStatement(db.env, thread),
    insertLinkStatement(db.env, 'A', { itemId: 'card1', threadId: 'th-scope00000000001', home: 'A', openComments: 2 }),
    ...copiedRuleStatements(db.env, [rule]),
  ]);
});
afterEach(() => vi.restoreAllMocks());

const envelopeOf = (text: string): ProjectEnvelope => {
  const parsed = parseProjectEnvelope(text);
  if (!parsed.ok) throw new Error(parsed.failure);
  return parsed.envelope;
};

async function exported(): Promise<string> {
  const res = await call('GET', 'A');
  expect(res.status).toBe(200);
  return res.text();
}

describe('GET /api/projects/:id/file', () => {
  it('answers the whole plan as its .liveplanner file, never cached, without commenters’ account ids', async () => {
    const res = await call('GET', 'A');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(MIME);
    expect(res.headers.get('Content-Disposition')).toBe(
      'attachment; filename="plan.liveplanner"',
    );
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const text = await res.text();
    const { project } = envelopeOf(text);
    expect(project.name).toBe('Roadmap');
    expect(project.tabs.map((t) => [t.name, t.folder])).toEqual([
      ['Board', undefined],
      ['Money', 'Later'],
    ]);
    expect(project.items?.map((i) => i.id)).toEqual(['card1', 'card2']);
    expect(project.threads).toHaveLength(1);
    expect(project.automations?.map((r) => r.name)).toEqual(['Done stamp']);
    expect(text).not.toContain(VISITOR);
  });

  it('is an Editor’s of the whole plan: a Participant or Viewer 403, a tab-scoped link or no grant 404', async () => {
    const visitor = (over: Partial<PlanGrant>) => ({
      owner: VISITOR,
      grant: grant('A', { sub: VISITOR, shareCode: 'LINK', ...over }),
    });
    expect((await call('GET', 'A', visitor({ level: 'edit' }))).status).toBe(200);
    expect((await call('GET', 'A', visitor({ level: 'participate' }))).status).toBe(403);
    expect((await call('GET', 'A', visitor({ level: 'view' }))).status).toBe(403);
    expect((await call('GET', 'A', visitor({ tab: 't1' }))).status).toBe(404);
    expect((await call('GET', 'A', { grant: null })).status).toBe(404);
    // A grant on another plan reaches nothing here.
    expect((await call('GET', 'A', { grant: grant('Z') })).status).toBe(404);
  });

  it('answers 404 for a plan not started', async () => {
    expect((await call('GET', 'Z')).status).toBe(404);
  });
});

describe('POST /api/projects/:id/file', () => {
  it('round trip: export then import gives the same plan (tabs, cards, card types, fields, threads, rules)', async () => {
    const file = await exported();
    const res = await call('POST', 'B', { body: file });
    expect(res.status).toBe(201);
    const { project } = await res.json<{ project: { id: string; name: string; ownerId: string } }>();
    expect(project).toMatchObject({ id: 'B', name: 'Roadmap', ownerId: OWNER });

    const before = envelopeOf(file).project;
    const after = envelopeOf(await (await call('GET', 'B')).text()).project;
    // The same tabs, in the same order and folders, under fresh ids, the link re-pointed at the copy.
    expect(after.tabs.map((t) => [t.name, t.folder])).toEqual(
      before.tabs.map((t) => [t.name, t.folder]),
    );
    const ids = new Map(before.tabs.map((t, i) => [t.id, after.tabs[i]!.id]));
    expect(after.tabs.map((t) => t.id)).not.toContain('t1');
    expect(after.tabs[0]!.elements).toEqual([box('b1', { kind: 'tab', tabId: ids.get('t2')! })]);
    expect(after.tabs[1]!.elements).toEqual(before.tabs[1]!.elements);
    // The same cards, ids, keys, types, ranks and fields.
    const cardsOf = (items: Item[] | undefined) =>
      (items ?? []).map(({ id, key, type, rank, fields }) => ({ id, key, type, rank, fields }));
    expect(cardsOf(after.items)).toEqual(cardsOf(before.items));
    expect(after.items?.[0]?.fields['f-cost']).toBe(12);
    // The same card types, the custom field with them.
    expect(after.itemTypes).toEqual(before.itemTypes);
    // The same Sheet, on the copied tab.
    expect(after.sheets?.map((s) => [s.id, s.tabId, s.title])).toEqual([
      ['sheet0001', ids.get('t2'), 'Budget'],
    ]);
    // The same thread on the same card, its comments in order.
    const threadsOf = (threads: CardThread[] | undefined) =>
      (threads ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        comments: t.comments.map((c) => c.text),
        cards: t.cards.map((c) => [c.itemId, c.key]),
      }));
    expect(threadsOf(after.threads)).toEqual(threadsOf(before.threads));
    expect(db.sql.prepare('SELECT plan_id FROM card_threads WHERE plan_id = ?').all('B')).toHaveLength(1);
    // Every rule, as it was but off, under a fresh id.
    const rulesOf = (rules: AutomationRule[] | undefined) =>
      (rules ?? []).map(({ name, trigger, conditions, steps }) => ({
        name,
        trigger,
        conditions,
        steps,
      }));
    // Each plan's rules table is its own object's SQLite; this test's one store holds A's beside B's, so B's are the
    // rows the import added.
    const landed = (after.automations ?? []).filter((r) => r.id !== 'rule1');
    expect(rulesOf(landed)).toEqual(rulesOf(before.automations));
    expect(landed.map((r) => r.enabled)).toEqual([false]);
  });

  it('files the new plan under the team its grant names', async () => {
    const res = await call('POST', 'B', { body: await exported(), grant: grant('B', { team: 'team_1' }) });
    expect(res.status).toBe(201);
    expect(db.sql.prepare('SELECT team_id FROM plan WHERE id = ?').get('B')).toEqual({
      team_id: 'team_1',
    });
  });

  it('drops what the envelope does not know, at the top, on the plan and on a card', async () => {
    const envelope = JSON.parse(await exported()) as Record<string, unknown> & {
      project: Record<string, unknown> & { items: Record<string, unknown>[] };
    };
    envelope.evil = { script: true };
    envelope.project.owner = 'user_mallory';
    envelope.project.items[0]!.votes = ['user_mallory'];
    const res = await call('POST', 'B', { body: JSON.stringify(envelope) });
    expect(res.status).toBe(201);
    const text = await (await call('GET', 'B')).text();
    expect(text).not.toContain('evil');
    expect(text).not.toContain('user_mallory');
  });

  it('refuses a malformed file, another kind and a newer schema with 400 invalid_file, nothing made', async () => {
    const file = await exported();
    const bad = [
      'not json',
      '[]',
      '{"kind":"liveplanner.project","schemaVersion":1}',
      file.replace('"liveplanner.project"', '"liveplanner.tab"'),
      file.replace('"schemaVersion": 1', '"schemaVersion": 2'),
      // A card with a repeated key.
      file.replace('"key": 2', '"key": 1'),
    ];
    for (const body of bad) {
      const res = await call('POST', 'B', { body });
      expect(res.status, body.slice(0, 60)).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_file' });
    }
    expect(db.sql.prepare('SELECT id FROM plan WHERE id = ?').get('B')).toBeUndefined();
  });

  it('refuses an oversized file by its declared length unread, and by its length, with 413 too_large', async () => {
    const byHeader = await call('POST', 'B', {
      body: '{}',
      headers: { 'Content-Length': String(PROJECT_FILE_MAX_BYTES + 1) },
    });
    expect(byHeader.status).toBe(413);
    expect(await byHeader.json()).toEqual({ error: 'too_large' });
    const byLength = await call('POST', 'B', { body: 'x'.repeat(PROJECT_FILE_MAX_BYTES + 1) });
    expect(byLength.status).toBe(413);
    expect(await byLength.json()).toEqual({ error: 'too_large' });
    expect(db.sql.prepare('SELECT id FROM plan WHERE id = ?').get('B')).toBeUndefined();
  });

  it('refuses an id that already holds a plan with 409, the plan left as it was', async () => {
    const res = await call('POST', 'A', { body: await exported() });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'exists' });
  });

  it('is an Editor’s of the new plan: below edit 403, a tab-scoped grant or none 404, no identity 400', async () => {
    const file = await exported();
    expect(
      (await call('POST', 'B', { body: file, grant: grant('B', { level: 'participate' }) })).status,
    ).toBe(403);
    expect((await call('POST', 'B', { body: file, grant: grant('B', { level: 'view' }) })).status).toBe(
      403,
    );
    expect((await call('POST', 'B', { body: file, grant: grant('B', { tab: 't1' }) })).status).toBe(
      404,
    );
    expect((await call('POST', 'B', { body: file, grant: null })).status).toBe(404);
    const anonymous = await handlePlanRequest(
      makeTestRouteContext('POST', '/api/projects/B/file', {
        env: db.env,
        owner: null,
        grant: grant('B'),
        rawBody: file,
      }),
    );
    expect(anonymous.status).toBe(400);
    expect(db.sql.prepare('SELECT id FROM plan WHERE id = ?').get('B')).toBeUndefined();
  });

  it('answers 404 to any other method on the door', async () => {
    expect((await call('DELETE', 'A')).status).toBe(404);
  });
});
