import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import type { ItemResponse } from '@liveplanner/api-schema';
import {
  cardTemplateFields,
  presetSetup,
  type CardTemplate,
  type ItemTypeCatalogue,
} from '@liveplanner/items';
import { getProject } from '../db';
import { exportPlanCopy, importPlanCopy } from '../plan-room/plan-copy';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// docs/specs/026-plan/item-types.md "Card templates": the api stores a type's templates whole, only an Editor of the
// whole plan changes them (docs/specs/013-workspace/share-roles.md), a Participant starts cards from them and a
// Viewer does neither, and a copy carries them (a Community copy less the people they name).

let sql: SqliteD1;

async function call<T = unknown>(opts: {
  method?: string;
  path: string;
  body?: unknown;
  owner?: string;
  code?: string;
}) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext(opts.method ?? 'POST', `/api/projects/d1${opts.path}`, {
    env: sql.env,
    owner: opts.owner ?? 'owner',
    ...(opts.code ? { headers: { 'X-Share-Code': opts.code } } : {}),
    ...(opts.body === undefined ? {} : { body: opts.body }),
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleProjects(ctx);
  await Promise.all(pending);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

const REPORT = {
  id: 'tp-bug-report',
  name: 'Bug Report',
  fields: {
    title: 'Something broke',
    description: 'What happened?',
    checklist: [{ text: 'Reproduce it', done: false }],
    labels: ['triage'],
    'f-area': 'Web',
    'f-owner': { id: 'p-sam', name: 'Sam', color: '#2563eb' },
  },
};
const BUG = {
  id: 'bug',
  label: 'Bug',
  color: '#dc2626',
  glyph: 'bug',
  fields: ['description', 'checklist', 'labels', 'f-area', 'f-owner', 'f-score'],
  custom: [
    { id: 'f-area', label: 'Area', kind: 'choice', options: ['Web', 'API'] },
    { id: 'f-owner', label: 'Owner', kind: 'person' },
    { id: 'f-score', label: 'Score', kind: 'calculated', calculation: 'childCount' },
  ],
  templates: [REPORT],
};
const catalogue = (...types: unknown[]) => ({ version: 1, types });
const putTypes = (itemTypes: unknown, as: { owner?: string; code?: string } = {}) =>
  call<{ itemTypes: ItemTypeCatalogue; reason?: string; error?: string }>({
    ...as,
    method: 'PUT',
    path: '/item-types',
    body: { itemTypes },
  });
const stored = async () => (await getProject(sql.env, 'd1'))!.itemTypes!.types;

const EDIT = { owner: 'e', code: 'EDIT' };
const PART = { owner: 'p', code: 'PART' };
const VIEW = { owner: 'v', code: 'VIEW' };
const TAB = { owner: 't', code: 'TAB1' };

beforeEach(() => {
  sql = sqliteD1();
  (sql.env as unknown as { PLAN_ROOM: unknown }).PLAN_ROOM = {
    idFromName: (n: string) => n,
    get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
  };
  const board = {
    id: 'b1',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 800,
    height: 500,
    planBoard: presetSetup('kanban'),
  };
  sql.sql.exec(`
    INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'owner', 'Plan', 1, 1, 1);
  `);
  sql.sql
    .prepare(`INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Board', ?, 1)`)
    .run(JSON.stringify({ elements: [board] }));
  sql.sql.exec(`
    INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('EDIT', 'd1', 'edit', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('TAB1', 'd1', 'edit', 't1', 1);
    INSERT INTO test_share_links (code, project_id, role, level, tab_id, created_at) VALUES ('PART', 'd1', 'view', 'participate', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('VIEW', 'd1', 'view', NULL, 1);
  `);
  clearTestProfiles();
  setTestProfile('owner', 'Webber', '#3b82f6');
});

describe('card templates through the api', () => {
  it('stores a type’s templates whole, and answers them as stored', async () => {
    const res = await putTypes(catalogue(BUG));
    expect(res.status).toBe(200);
    expect(res.body.itemTypes.types[0]!.templates).toEqual([REPORT]);
    expect((await stored())[0]!.templates).toEqual([REPORT]);
  });

  it('refuses a template value a template never holds, keeping the last good catalogue', async () => {
    await putTypes(catalogue(BUG));
    const scored = { ...BUG, templates: [{ ...REPORT, fields: { 'f-score': 3 } }] };
    expect(await putTypes(catalogue(scored))).toMatchObject({
      status: 400,
      body: { error: 'item_types_invalid', reason: 'types[0].templates[0].fields' },
    });
    expect((await stored())[0]!.templates).toEqual([REPORT]);
  });

  it('lets only an Editor of the whole plan add, change or remove templates', async () => {
    const renamed = { ...BUG, templates: [{ ...REPORT, name: 'Crash' }] };
    for (const as of [PART, VIEW, TAB])
      expect((await putTypes(catalogue(BUG), as)).status, as.code).toBe(403);
    expect((await putTypes(catalogue(BUG), EDIT)).status).toBe(200);
    for (const as of [PART, VIEW, TAB]) {
      expect((await putTypes(catalogue(renamed), as)).status, as.code).toBe(403);
      expect((await putTypes(catalogue({ ...BUG, templates: [] }), as)).status, as.code).toBe(403);
    }
    expect((await stored())[0]!.templates![0]!.name).toBe('Bug Report');
    expect((await putTypes(catalogue({ ...BUG, templates: [] }), EDIT)).status).toBe(200);
    expect((await stored())[0]!).not.toHaveProperty('templates');
  });

  it('lets a Participant start a card from a template, and never a Viewer', async () => {
    await putTypes(catalogue(BUG));
    const [bug] = await stored();
    const start = (as: { owner: string; code: string }) =>
      call<ItemResponse>({
        ...as,
        path: '/items',
        body: {
          type: 'bug',
          fields: {
            ...cardTemplateFields(bug!, bug!.templates![0] as CardTemplate),
            status: 'todo',
          },
        },
      });
    const made = await start(PART);
    expect(made.status).toBe(201);
    expect(made.body.item.fields).toMatchObject({
      title: 'Something broke',
      checklist: [{ text: 'Reproduce it', done: false }],
      labels: ['triage'],
      'f-area': 'Web',
    });
    expect((await start(VIEW)).status).toBe(403);
  });
});

describe('card templates in a copy', () => {
  async function copied(community: boolean) {
    await putTypes(catalogue(BUG));
    const copy = await exportPlanCopy(sql.env, 'd1', null, null, community);
    sql.sql.exec(`
      INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
        VALUES ('d2', 'owner', 'Copy', 0, 1, 1);
    `);
    await importPlanCopy(sql.env, 'd2', copy!);
    return (await getProject(sql.env, 'd2'))!.itemTypes!.types[0]!.templates;
  }

  it('carries every template, unchanged', async () => {
    expect(await copied(false)).toEqual([REPORT]);
  });

  it('carries them through a Community post less the people they name', async () => {
    const { 'f-owner': _sam, ...rest } = REPORT.fields;
    expect(await copied(true)).toEqual([{ ...REPORT, fields: rest }]);
  });
});
